import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import * as sdk from 'firebase/firestore';
import {mediaSelectionBlocked} from './media-choice-ui.js';

const source = await fs.readFile(new URL('./firebase-client.js', import.meta.url), 'utf8');
const [host, port] = (process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8187').split(':');
const environment = await initializeTestEnvironment({projectId:'cockpit-media-decision-test', firestore:{host,port:Number(port),rules:await fs.readFile(new URL('./firestore.rules',import.meta.url),'utf8')}});
const profile = role => ({uid:`client-${role}`,role,displayLabel:role==='admin'?'Communications test':'Direction test'});
const client = role => {
  const context = {...sdk,db:environment.authenticatedContext(profile(role).uid).firestore(),crypto:globalThis.crypto,mediaSelectionBlocked,requireWritable:()=>{},recordConfirmedWrites:()=>{}};
  const part=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from))).replaceAll('export async function','async function').replaceAll('export function','function');
  const code=part('function changeArchiveEntry(', '\nexport ') + '\n' + part('const workflowStages =', '\nexport function subscribeWorkflowStates') + '\n' + part('const MAX_MEDIA_CHOICES', '\nexport function subscribeMediaDecisions');
  return {...context,...new Function(...Object.keys(context),code+'\nreturn {setMediaDecision,setWorkflowStage};')(...Object.values(context))};
};
const admin=client('admin'),director=client('director');
let count=0;
const seed=async stage=>environment.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  for(const role of ['admin','director']) await sdk.setDoc(sdk.doc(db,'users',profile(role).uid),{role,active:true,displayLabel:profile(role).displayLabel});
  await sdk.setDoc(sdk.doc(db,'workflowStates','client-sept10'),{eventId:'client-sept10',stage,updatedAt:sdk.Timestamp.now(),updatedBy:profile('admin').uid,updatedByLabel:profile('admin').displayLabel});
  for(const id of ['photo-current','photo-other']) await sdk.setDoc(sdk.doc(db,'mediaLinks',id),{eventId:'client-sept10',archived:false,publicationBlocked:true,rightsStatus:'Droits à confirmer'});
  await sdk.deleteDoc(sdk.doc(db,'mediaDecisions','client-sept10'));
});
const decision=async()=> (await sdk.getDoc(sdk.doc(admin.db,'mediaDecisions','client-sept10'))).data();
const stage=async()=> (await sdk.getDoc(sdk.doc(admin.db,'workflowStates','client-sept10'))).data().stage;
try {
  for(const role of ['admin','director']) {
    await seed('media_review');
    await admin.setMediaDecision('client-sept10','photo-current',true,profile('admin')); count++;
    const actor=role==='admin'?admin:director;
    await actor.setMediaDecision('client-sept10','photo-current',true,profile(role),{override:true,reason:'Validation explicite du visuel'}); count++;
    assert.equal(await stage(),'final_approved');
    assert.equal((await decision()).override.actorUid,profile(role).uid);
    assert.equal((await decision()).direction.status,role==='admin'?'none':'selected');
    await actor.setMediaDecision('client-sept10','photo-current',false,profile(role)); count++;
    assert.equal(await stage(),'media_review');
    assert.equal((await decision()).override.active,false);
  }
  await seed('media_review');
  await admin.setMediaDecision('client-sept10','photo-current',true,profile('admin'));
  await director.setMediaDecision('client-sept10','photo-current',true,profile('director')); count++;
  assert.equal(await stage(),'final_approved');
  assert.equal((await decision()).agreement.status,'agreed');
  await director.setMediaDecision('client-sept10','photo-other',true,profile('director')); count++;
  assert.equal(await stage(),'media_review');
  assert.equal((await decision()).agreement.status,'divergent');
  console.log(`✓ ${count} transactions du client réel avec les règles, deux rôles, forçage et retour arrière.`);
} finally { await environment.cleanup(); }
