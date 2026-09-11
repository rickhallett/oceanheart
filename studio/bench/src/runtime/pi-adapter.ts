import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Type } from '@sinclair/typebox';
import { createAgentSession, DefaultResourceLoader, ModelRuntime, SessionManager, SettingsManager, type AgentSession } from '@earendil-works/pi-coding-agent';
import type { Model, Provider } from '@earendil-works/pi-ai';
import { JobStore, digest, type Job } from './store.ts';
import { validateInput } from '../workflows/clara.ts';
import type { RunLimits, RunRequest } from './contract.ts';
import { scriptedModel, scriptedProvider } from './transport.ts';
export interface RuntimeOptions {root:string;limits?:Partial<RunLimits>; provider?:Provider; model?:Model<any>}
export class PiWorkflowRuntime {
 readonly store:JobStore; readonly root:string; readonly limits:RunLimits;
 private active=new Map<string,AgentSession>(); private listeners=new Set<(event:Record<string,unknown>)=>void>();
 private provider:Provider; private model:Model<any>;
 constructor(options:RuntimeOptions){this.root=resolve(options.root);this.store=new JobStore(this.root);this.limits={maxRunMs:30000,maxToolCalls:4,maxTurns:6,...options.limits};for(const n of Object.values(this.limits))if(!Number.isSafeInteger(n)||n<=0||n>180000)throw Error('INVALID_LIMIT');this.provider=options.provider??scriptedProvider();this.model=options.model??scriptedModel;if(this.model.provider!==this.provider.id)throw Error('PROVIDER_MISMATCH');}
 subscribeEvents(listener:(event:Record<string,unknown>)=>void){this.listeners.add(listener);return()=>this.listeners.delete(listener);}
 private emit(job:Job,type:string,detail:Record<string,unknown>={}){const event=this.store.event(job,type,detail);for(const listener of this.listeners){try{listener(event);}catch{/* observers do not alter durable jobs */}}}
 async startRun(request:RunRequest):Promise<Job>{validateInput(request.input);if(request.clientId!==request.input.clientId||!request.actor||!request.idempotencyKey||request.idempotencyKey.length>128||(request.configurationVersion!==undefined&&!/^[a-zA-Z0-9._-]{1,100}$/.test(request.configurationVersion)))throw Error('INVALID_REQUEST');const snapshot=JSON.parse(JSON.stringify(request));return this.resumeSession(request.clientId,this.store.enqueue(snapshot).id);}
 async resumeSession(clientId:string,runId:string):Promise<Job>{
  const initial=this.store.get(clientId,runId);if(!['queued','running'].includes(initial.status))return initial;
  const leaseMs=this.limits.maxRunMs+5000;let job=this.store.claim(clientId,runId,leaseMs);if(job.status!=='running')return job;const token=job.token!;
  // A durable draft receipt is authoritative even if the process died before job completion.
  const recovered=this.store.result(runId);if(recovered){job=this.store.mutate(clientId,runId,token,j=>{j.result=recovered;j.status=recovered.unresolved.length?'waiting_for_input':'succeeded';j.lease=0;});this.emit(job,'recovered_receipt');return job;}
  const dir=join(this.root,clientId,runId);mkdirSync(dir,{recursive:true,mode:0o700});const agentDir=join(dir,'config');mkdirSync(agentDir,{recursive:true,mode:0o700});
  let limitHit=false;let session:AgentSession|undefined;let timer:ReturnType<typeof setTimeout>|undefined;
  try {
   const settings=SettingsManager.inMemory({compaction:{enabled:false},retry:{enabled:false,provider:{maxRetries:0}},defaultTools:[]});
   const loader=new DefaultResourceLoader({cwd:dir,agentDir,settingsManager:settings,noExtensions:true,noSkills:true,noPromptTemplates:true,noThemes:true,noContextFiles:true,systemPrompt:'You prepare synthetic Clara draft invoices. Use only prepare_invoice. Its trusted records and deterministic arithmetic are authoritative. Never send invoices, collect money or access files. Unresolved records require clarification.'});await loader.reload();
   const modelRuntime=await ModelRuntime.create({credentials:{read:async()=>undefined,list:async()=>[],modify:async()=>{throw Error("CREDENTIAL_WRITES_DISABLED");},delete:async()=>{throw Error("CREDENTIAL_WRITES_DISABLED");}},modelsPath:null,allowModelNetwork:false,refreshOnCreate:false});modelRuntime.registerNativeProvider(this.provider);
   const manager=job.sessionFile?SessionManager.open(job.sessionFile,dir,dir):SessionManager.create(dir,dir);
   const created=await createAgentSession({cwd:dir,agentDir,modelRuntime,model:this.model,thinkingLevel:'off',settingsManager:settings,resourceLoader:loader,sessionManager:manager,tools:['prepare_invoice'],customTools:[{
    name:'prepare_invoice',label:'Prepare synthetic invoice',description:'Prepare a durable draft from this job’s trusted fixture; no arguments, no sending or charging.',parameters:Type.Object({}, {additionalProperties:false}),
    execute:async(_id,args,signal)=>{if(signal?.aborted)throw Error('CANCELLED');if((!args || typeof args!=="object" || Object.keys(args).length))throw Error('UNEXPECTED_ARGUMENTS');this.store.mutate(clientId,runId,token,j=>{if(++j.toolCalls>this.limits.maxToolCalls)throw Error('TOOL_LIMIT');});const result=this.store.effect(clientId,runId,token);return {content:[{type:'text',text:JSON.stringify(result)}],details:{draftId:result.draftId}};}
   }]});session=created.session;this.active.set(runId,session);
   if(session.getActiveToolNames().join(',')!=='prepare_invoice'||loader.getExtensions().extensions.length||loader.getAgentsFiles().agentsFiles.length)throw Error('ISOLATION_FAILURE');
   job=this.store.mutate(clientId,runId,token,j=>{j.sessionFile=session!.sessionFile;});this.emit(job,'session_started',{sdk:'0.85.1',model:this.model.id,provider:this.provider.id,workflowVersion:'clara-v1',configurationVersion:job.request.configurationVersion??'clara-v1',inputHash:digest(job.request.input),tools:session.getActiveToolNames()});
   session.subscribe(event=>{try{if(event.type==='turn_start')this.store.mutate(clientId,runId,token,j=>{if(++j.turns>this.limits.maxTurns)throw Error('TURN_LIMIT');});this.emit(job,'pi_event',{eventType:event.type});}catch{limitHit=true;void session!.abort();}});
   const expiry=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{void session!.abort();reject(Error('RUN_LIMIT'));},this.limits.maxRunMs);});
   await Promise.race([session.prompt('Prepare the invoice draft for the supplied trusted job. Call prepare_invoice.',{expandPromptTemplates:false}),expiry]);
   if(limitHit)throw Error('TURN_LIMIT');
   const result=this.store.result(runId);if(!result)throw Error('NO_DRAFT_RESULT');job=this.store.mutate(clientId,runId,token,j=>{j.result=result;j.status=result.unresolved.length?'waiting_for_input':'succeeded';j.lease=0;});this.emit(job,'finished',{status:job.status});
  }catch {const latest=this.store.get(clientId,runId);if(latest.status==='running'&&latest.token===token){latest.status='failed';latest.lease=0;latest.result=this.store.result(runId);this.store.save(latest);this.emit(latest,'failed',{code:'RUN_FAILED',effectPersisted:!!latest.result});}job=this.store.get(clientId,runId);}
  finally {if(timer)clearTimeout(timer);if(session){await session.abort();session.dispose();}this.active.delete(runId);}
  return job;
 }
 async cancelRun(clientId:string,runId:string){const job=this.store.transaction(()=>{const j=this.store.get(clientId,runId);if(['queued','running'].includes(j.status)){j.status='cancelled';j.lease=0;this.store.save(j);this.emit(j,'cancelled');}return j;});await this.active.get(runId)?.abort();return job;}
 exportTrace(clientId:string,runId:string){const job=this.store.get(clientId,runId);return {schemaVersion:1,job:{id:job.id,clientId:job.clientId,status:job.status,configurationVersion:job.request.configurationVersion??'clara-v1',inputHash:digest(job.request.input),resultHash:job.result?digest(job.result):undefined},events:this.store.trace(clientId,runId)};}
 close(){if(this.active.size)throw Error('ACTIVE_RUNS');this.store.close();}
}
