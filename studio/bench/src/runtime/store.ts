import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { join } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { RunRequest, RunStatus } from './contract.ts';
import { calculateInvoice, type ClaraResult } from '../workflows/clara.ts';
export interface Job { id:string; clientId:string; actor:string; status:RunStatus; request:RunRequest; sessionFile?:string; token?:string; lease:number; toolCalls:number; turns:number; result?:ClaraResult }
export const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export class JobStore {
  db:DatabaseSync;
  constructor(root:string){mkdirSync(root,{recursive:true,mode:0o700});chmodSync(root,0o700);const file=join(root,'jobs.sqlite');this.db=new DatabaseSync(file);chmodSync(file,0o600);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=3000;
    CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,client TEXT NOT NULL,key TEXT NOT NULL,hash TEXT NOT NULL,json TEXT NOT NULL,UNIQUE(client,key));
    CREATE TABLE IF NOT EXISTS reservations(client TEXT NOT NULL,session TEXT NOT NULL,job TEXT NOT NULL,PRIMARY KEY(client,session));
    CREATE TABLE IF NOT EXISTS effects(job TEXT PRIMARY KEY,json TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS traces(seq INTEGER PRIMARY KEY AUTOINCREMENT,job TEXT NOT NULL,json TEXT NOT NULL);`);}
  transaction<T>(fn:()=>T):T{this.db.exec('BEGIN IMMEDIATE');try{const r=fn();this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
  get(client:string,id:string):Job {const row=this.db.prepare('SELECT json FROM jobs WHERE id=? AND client=?').get(id,client);if(!row)throw Error('JOB_NOT_FOUND');return JSON.parse(row.json as string);}
  save(job:Job){this.db.prepare('UPDATE jobs SET json=? WHERE id=? AND client=?').run(JSON.stringify(job),job.id,job.clientId);}
  enqueue(request:RunRequest):Job {return this.transaction(()=>{const row=this.db.prepare('SELECT json,hash FROM jobs WHERE client=? AND key=?').get(request.clientId,request.idempotencyKey);if(row){if(row.hash!==digest(request))throw Error('IDEMPOTENCY_MISMATCH');return JSON.parse(row.json as string);}const job:Job={id:randomUUID(),clientId:request.clientId,actor:request.actor,status:'queued',request,lease:0,toolCalls:0,turns:0};this.db.prepare('INSERT INTO jobs VALUES(?,?,?,?,?)').run(job.id,job.clientId,request.idempotencyKey,digest(request),JSON.stringify(job));this.event(job,'queued');return job;});}
  claim(client:string,id:string,leaseMs:number):Job{return this.transaction(()=>{const job=this.get(client,id);if(!['queued','running'].includes(job.status))return job;
    const rows=this.db.prepare('SELECT json FROM jobs WHERE client=?').all(client);for(const row of rows){const other=JSON.parse(row.json as string) as Job;if(other.status==='running'&&other.lease>Date.now())throw Error('CLIENT_BUSY');}
    job.status='running';job.token=randomUUID();job.lease=Date.now()+leaseMs;this.save(job);this.event(job,'claimed');return job;});}
  fenced(client:string,id:string,token:string):Job{const job=this.get(client,id);if(job.status!=='running'||job.token!==token||job.lease<=Date.now())throw Error('LEASE_LOST');return job;}
  mutate(client:string,id:string,token:string,fn:(j:Job)=>void){return this.transaction(()=>{const job=this.fenced(client,id,token);fn(job);this.save(job);return job;});}
  effect(client:string,id:string,token:string):ClaraResult{return this.transaction(()=>{const job=this.fenced(client,id,token);const prior=this.db.prepare('SELECT json FROM effects WHERE job=?').get(id);if(prior)return JSON.parse(prior.json as string);const result=calculateInvoice(job.request.input,'draft-'+id);for(const line of result.lines){const reservation=job.request.configurationReleaseId?`${line.sessionId}@release:${job.request.configurationReleaseId}`:line.sessionId;const existing=this.db.prepare('SELECT job FROM reservations WHERE client=? AND session=?').get(client,reservation);if(existing&&existing.job!==id)throw Error('SESSION_ALREADY_DRAFTED');this.db.prepare('INSERT OR IGNORE INTO reservations VALUES(?,?,?)').run(client,reservation,id);}this.db.prepare('INSERT INTO effects VALUES(?,?)').run(id,JSON.stringify(result));this.event(job,'draft_persisted');return result;});}
  result(id:string):ClaraResult|undefined{const row=this.db.prepare('SELECT json FROM effects WHERE job=?').get(id);return row?JSON.parse(row.json as string):undefined;}
  event(job:Job,type:string,detail:Record<string,unknown>={}){const event={runId:job.id,clientId:job.clientId,actor:job.actor,at:new Date().toISOString(),type,...detail};this.db.prepare('INSERT INTO traces(job,json) VALUES(?,?)').run(job.id,JSON.stringify(event));return event;}
  trace(client:string,id:string){this.get(client,id);return this.db.prepare('SELECT seq,json FROM traces WHERE job=? ORDER BY seq').all(id).map(r=>({sequence:r.seq,...JSON.parse(r.json as string)}));}
  close(){this.db.close();}
}
