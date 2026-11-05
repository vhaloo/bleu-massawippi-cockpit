/** Controlled private import. Default: preview only. No workbook or approval writes. */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {initializeApp,applicationDefault,deleteApp} from 'firebase-admin/app';
import {getFirestore} from 'firebase-admin/firestore';
import {validateMemberRegistry} from './members-model.mjs';
const argument=key=>{const i=process.argv.indexOf(key);return i<0?'':process.argv[i+1]||'';};
const input=argument('--snapshot'),output=argument('--receipts'),uid=argument('--actor-uid'),project=argument('--project'),apply=process.argv.includes('--apply');
assert(input&&output&&uid&&/^[a-z0-9-]+$/.test(project),'Required: --snapshot PRIVATE.json --receipts PRIVATE_DIR --actor-uid UID --project PROJECT');
const reviewed=JSON.parse(fs.readFileSync(input,'utf8'));validateMemberRegistry(reviewed);fs.mkdirSync(output,{recursive:true});
const hash=x=>crypto.createHash('sha256').update(typeof x==='string'?x:JSON.stringify(x)).digest('hex');
const stamp=t=>new Date(t.seconds*1000).toISOString().slice(0,19)+'.'+String(t.nanoseconds).padStart(9,'0')+'Z';
const encode=x=>x?.toDate?{timestampValue:stamp(x)}:x===null?{nullValue:null}:typeof x==='string'?{stringValue:x}:typeof x==='boolean'?{booleanValue:x}:typeof x==='number'?(Number.isInteger(x)?{integerValue:String(x)}:{doubleValue:x}):Array.isArray(x)?{arrayValue:{values:x.map(encode)}}:{mapValue:{fields:fields(x)}};
const fields=x=>Object.fromEntries(Object.entries(x).map(([k,v])=>[k,encode(v)]));
const app=initializeApp({credential:applicationDefault(),projectId:project}),db=getFirestore(app),base=`projects/${project}/databases/(default)`;
try{
  const entries=[{id:'philanthropie-membres',data:reviewed.manifest},...reviewed.chunks];
  assert(entries.length<=21);for(const x of entries)assert(Buffer.byteLength(JSON.stringify(x.data))<750000,'Private document too large');
  const refs=entries.map(x=>db.doc('privateContent/'+x.id)),docs=await db.getAll(...refs,db.doc('users/'+uid));
  const actor=docs.pop();assert(actor.exists&&actor.data().active===true&&actor.data().role==='admin','Existing active admin actor required');
  const digest=hash(entries.map((x,i)=>({path:refs[i].path,exists:docs[i].exists,updateTime:docs[i].exists?stamp(docs[i].updateTime):null,next:fields(x.data)})));
  const preview={at:new Date().toISOString(),digest,snapshotId:reviewed.manifest.snapshotId,paths:refs.map(r=>r.path),stats:reviewed.manifest.stats,paymentCount:reviewed.manifest.paymentCount,expectedMutationWrites:entries.length*4,sourceETag:reviewed.manifest.source.eTag,approvalsChanged:false,workbookChanged:false,publicDataUploaded:false};
  if(!apply){fs.writeFileSync(path.join(output,'SIMULATION.json'),JSON.stringify(preview,null,2));console.log(JSON.stringify(preview,null,2));}
  else{
    assert(!fs.existsSync(path.join(output,'INTEGRATION_VERIFIEE.json')),'Already applied; read the current version before a new import');
    assert.equal(JSON.parse(fs.readFileSync(path.join(output,'SIMULATION.json'),'utf8')).digest,digest,'Source or cloud state changed after preview');
    assert.equal(argument('--expected-digest'),digest,'Explicit preview digest required');
    const proof=JSON.parse(fs.readFileSync(argument('--backup-proof'),'utf8'));assert(proof.verified===true&&proof.status==='complete','Complete verified backup receipt required');
    const freshness=JSON.parse(fs.readFileSync(argument('--source-proof'),'utf8'));assert.equal(freshness.e_tag,reviewed.manifest.source.eTag,'SharePoint version changed');assert.equal(freshness.id,reviewed.manifest.source.itemId);assert(Date.now()-Date.parse(freshness.checkedAt)<300000,'Fresh source metadata required');
    const syncProof=JSON.parse(fs.readFileSync(argument('--cycle-proof'),'utf8'));assert(syncProof.complete===true&&Date.now()-Date.parse(syncProof.at)<300000,'Second bounded editorial check required');
    const cli=async command=>(await promisify(execFile)(process.env.ComSpec||'cmd.exe',['/d','/s','/c',command],{windowsHide:true,maxBuffer:2000000})).stdout;
    const session=async()=>(JSON.parse(await cli('npx firebase-tools@15.23.0 login:list --json')).result||[]).find(x=>x.tokens?.access_token&&Number(x.tokens.expires_at)>Date.now()+120000);
    let login=await session();if(!login){await cli('npx firebase-tools@15.23.0 apps:list --project '+project+' --json');login=await session();}assert(login,'Normal Firebase CLI login required');
    const archiveRefs=entries.map(()=>db.collection('changeArchive').doc()),beforeRefs=entries.map(()=>db.collection('privateContentVersions').doc()),afterRefs=entries.map(()=>db.collection('privateContentVersions').doc());
    const create=(ref,data)=>({update:{name:base+'/documents/'+ref.path,fields:fields(data)},currentDocument:{exists:false},updateTransforms:[{fieldPath:'createdAt',setToServerValue:'REQUEST_TIME'}]});
    const writes=entries.flatMap((x,i)=>[
      {update:{name:base+'/documents/'+refs[i].path,fields:fields({...x.data,updatedBy:uid})},currentDocument:docs[i].exists?{updateTime:stamp(docs[i].updateTime)}:{exists:false},updateTransforms:[{fieldPath:'updatedAt',setToServerValue:'REQUEST_TIME'}]},
      create(beforeRefs[i],docs[i].exists?{...docs[i].data(),documentId:x.id,source:'Avant integration du registre documente',createdBy:uid}:{documentId:x.id,documentDidNotExist:true,source:'Avant integration du registre documente',createdBy:uid}),
      create(afterRefs[i],{...x.data,documentId:x.id,source:'Registre des membres rapproche du classeur SharePoint',createdBy:uid}),
      create(archiveRefs[i],{entityType:'privateContent',entityId:x.id,entityPath:refs[i].path,action:'Integration du registre documente des membres et contacts',actorUid:uid,actorLabel:'Communications',beforeVersionPath:beforeRefs[i].path,afterVersionPath:afterRefs[i].path,beforeHash:docs[i].exists?hash(fields(docs[i].data())):null,afterHash:hash(fields(x.data))})]);
    writes.push({verify:base+'/documents/'+actor.ref.path,currentDocument:{updateTime:stamp(actor.updateTime)}});
    const response=await fetch('https://firestore.googleapis.com/v1/'+base+'/documents:commit',{method:'POST',headers:{Authorization:'Bearer '+login.tokens.access_token,'Content-Type':'application/json'},body:JSON.stringify({writes})});
    if(!response.ok)throw Error('Private import rejected HTTP '+response.status);const receipt=await response.json();assert.equal(receipt.writeResults.length,writes.length);
    const saved=await db.getAll(...refs,...archiveRefs,...beforeRefs,...afterRefs);
    for(let i=0;i<entries.length;i++)for(const[k,v]of Object.entries(entries[i].data))assert.deepEqual(saved[i].data()[k],v);
    validateMemberRegistry({manifest:saved[0].data(),chunks:entries.slice(1).map((x,i)=>({id:x.id,data:saved[i+1].data()}))});
    fs.writeFileSync(path.join(output,'AVANT_PRIVE.ndjson'),docs.map(d=>JSON.stringify({path:d.ref.path,exists:d.exists,fields:d.exists?fields(d.data()):null,updateTime:d.exists?stamp(d.updateTime):null})).join('\n')+'\n',{flag:'wx'});
    const delta=saved.map(d=>JSON.stringify({name:base+'/documents/'+d.ref.path,fields:fields(d.data()),updateTime:stamp(d.updateTime)})).join('\n')+'\n';fs.writeFileSync(path.join(output,'APRES_TYPE.ndjson'),delta,{flag:'wx'});
    const result={...preview,verified:true,commitTime:receipt.commitTime,mutationWrites:entries.length*4,guardWrites:1,typedDeltaSha256:hash(delta),archives:archiveRefs.map(x=>x.path),beforeVersions:beforeRefs.map(x=>x.path),afterVersions:afterRefs.map(x=>x.path)};
    fs.writeFileSync(path.join(output,'INTEGRATION_VERIFIEE.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result,null,2));
  }
}finally{await deleteApp(app);}
