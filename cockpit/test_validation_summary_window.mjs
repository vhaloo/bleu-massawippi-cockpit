import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=fs.readFileSync(process.argv[2]||new URL('./firebase-client.js',import.meta.url),'utf8');
const declaration=source.match(/const VALIDATION_SUMMARY_LIMIT = \d+;/)?.[0]||'';
const extract=name=>{
 const start=source.indexOf(`export function ${name}(`);
 assert(start>=0,name);
 const end=source.indexOf('\nexport ',start+1);
 return source.slice(start,end<0?source.length:end).replace(/^export /,'');
};
const listeners=[];
const context={
 db:{},requireConfigured:()=>{},
 collection:(_,name)=>name,
 orderBy:(field,direction)=>({field,direction}),
 limit:value=>({limit:value}),
 query:(collection,...constraints)=>({collection,...Object.assign({},...constraints)}),
 trackedOnSnapshot:(name,query,next)=>{
  assert.equal(query.field,'updatedAt');assert.equal(query.direction,'desc');
  assert(Number.isInteger(query.limit)&&query.limit>0&&query.limit<=240,'Bounded listener');
  listeners.push({name,query,next});
  return()=>{};
 }
};
vm.createContext(context);
vm.runInContext(declaration+'\n'+extract('subscribeWorkflowStates')+'\n'+extract('subscribeMediaDecisions'),context);
const delivered=new Map();
for(const [subscriber,count]of [['subscribeWorkflowStates',158],['subscribeMediaDecisions',154]]){
 context[subscriber](rows=>delivered.set(subscriber,rows));
 const listener=listeners.at(-1);
 // Ordered as the real server window: retained August/October decisions are
 // behind the newer winter calendar. Neither listener may drop this event.
 const documents=Array.from({length:count},(_,index)=>{
  const id=index===count-14?'alt-20260724':`event-${index}`;
  const data=subscriber==='subscribeWorkflowStates'
   ?{eventId:id,stage:'final_approved',communicationsTextApproval:{approved:true,copy:'FR — Lac\nEN — Lake',actorUid:'communications'}}
   :{eventId:id,direction:{status:'selected',mediaIds:['lake-photo'],actorUid:'direction'},communications:{status:'selected',mediaIds:['lake-photo'],actorUid:'communications'},agreement:{status:'agreed',mediaIds:['lake-photo']}};
  return{id,data:()=>data};
 });
 const docs=documents.slice(0,listener.query.limit);
 listener.next({docs,size:docs.length,metadata:{fromCache:false,hasPendingWrites:false}});
 const rows=delivered.get(subscriber);
 assert.equal(rows.length,count,'All current confirmations remain in the summary');
 const retained=rows.find(row=>row.eventId==='alt-20260724');assert(retained,'Retained watershed approvals');
 if(subscriber==='subscribeWorkflowStates')assert.equal(retained.communicationsTextApproval.actorUid,'communications');
 else{assert.equal(retained.direction.actorUid,'direction');assert.equal(retained.communications.actorUid,'communications');}
}
assert.equal(listeners.length,2,'One summary listener per collection');
console.log('Validation summary: retained decisions after the 120-document boundary, bounded reads, distinct actors.');
