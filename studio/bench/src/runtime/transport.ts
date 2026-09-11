import { createAssistantMessageEventStream, type Model, type Provider, type Context, type AssistantMessage } from '@earendil-works/pi-ai';
export const scriptedModel:Model<'bench-scripted'>={id:'clara-script-v1',name:'Deterministic in-process transport (not inference)',provider:'bench-scripted',api:'bench-scripted',baseUrl:'in-process://bench',reasoning:false,input:['text'],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:32768,maxTokens:1024};
/** Real Pi runs this transport through its registered provider API. It is NOT a model capability evaluation. */
export function scriptedProvider(onContext?:(ctx:Context)=>void):Provider {
 const stream=(model:Model<any>,ctx:Context)=>{onContext?.(ctx);const out=createAssistantMessageEventStream();queueMicrotask(()=>{
 const hasResult=ctx.messages.some(m=>m.role==='toolResult'&&m.toolName==='prepare_invoice'&&!m.isError);
 const message:AssistantMessage={role:'assistant',api:model.api,provider:model.provider,model:model.id,timestamp:Date.now(),content:hasResult?[{type:'text',text:'Draft prepared; no invoice was sent and no payment collected.'}]:[{type:'toolCall',id:'prepare-1',name:'prepare_invoice',arguments:{}}],stopReason:hasResult?'stop':'toolUse',usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}};
 out.push({type:'start',partial:message});out.push({type:'done',reason:message.stopReason as 'stop'|'toolUse',message});out.end(message);
 });return out;};
 return {id:'bench-scripted',name:'Bench scripted transport',auth:{apiKey:{name:'No credentials',resolve:async()=>({auth:{},source:'in-process fixture'})}},getModels:()=>[scriptedModel],stream,streamSimple:stream};
}
