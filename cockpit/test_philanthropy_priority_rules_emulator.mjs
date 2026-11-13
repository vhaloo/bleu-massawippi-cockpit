import fs from 'node:fs/promises';
import {initializeTestEnvironment,assertFails,assertSucceeds} from '@firebase/rules-unit-testing';
import {doc,setDoc,updateDoc,getDoc,serverTimestamp,runTransaction,collection} from 'firebase/firestore';
import {priorityText,prioritySection} from './philanthropy-priorities.mjs';
const [host='127.0.0.1',port='8187']=String(process.env.FIRESTORE_EMULATOR_HOST||'127.0.0.1:8187').split(':');
const env=await initializeTestEnvironment({projectId:'cockpit-media-decision-test',firestore:{host,port:Number(port),rules:await fs.readFile(new URL('./firestore.rules',import.meta.url),'utf8')}});
try {
 await env.withSecurityRulesDisabled(async ctx=>{for(const [uid,role,active] of [['priority-admin','admin',true],['priority-annie','director',true],['priority-viewer','viewer',true],['priority-inactive','admin',false]]) await setDoc(doc(ctx.firestore(),'users',uid),{role,active});});
 const admin=env.authenticatedContext('priority-admin').firestore(),annie=env.authenticatedContext('priority-annie').firestore(),viewer=env.authenticatedContext('priority-viewer').firestore(),inactive=env.authenticatedContext('priority-inactive').firestore(),anon=env.unauthenticatedContext().firestore();
 const section=prioritySection('program','test-demo');
 const payload=uid=>({sectionId:section,comment:priorityText(true,'Synthétique'),quickTag:null,dictated:false,authorUid:uid,authorLabel:uid,deleted:false,resolved:false,resolvedAt:null,resolvedBy:'',resolvedByLabel:'',createdAt:serverTimestamp(),updatedAt:serverTimestamp(),updatedBy:uid});
 for(const [db,uid] of [[admin,'priority-admin'],[annie,'priority-annie']]){
  const ref=doc(db,'comments',section+'--'+uid);
  await assertSucceeds(setDoc(ref,payload(uid)));
  await assertSucceeds(updateDoc(ref,{comment:priorityText(false,'Synthétique'),updatedAt:serverTimestamp(),updatedBy:uid}));
 }
 await assertSucceeds(getDoc(doc(annie,'comments',section+'--priority-admin')));
 await assertFails(updateDoc(doc(annie,'comments',section+'--priority-admin'),{comment:priorityText(false,'Autre'),updatedAt:serverTimestamp(),updatedBy:'priority-annie'}));
 for(const db of [viewer,inactive,anon]) await assertFails(setDoc(doc(db,'comments','priority-denied'),payload('priority-viewer')));
 await assertSucceeds(runTransaction(admin,async tx=>{const ref=doc(admin,'comments',section+'--priority-admin');await tx.get(ref);tx.update(ref,{comment:priorityText(true,'Synthétique'),updatedAt:serverTimestamp(),updatedBy:'priority-admin'});tx.set(doc(collection(admin,'changeArchive')),{entityType:'comment',entityId:ref.id,action:'priorité signalée',before:{},after:{},actorUid:'priority-admin',actorLabel:'Test',createdAt:serverTimestamp()});}));
 console.log('PASS existing rules: admin/director own signals, shared read, other-author deny, roles deny, atomic archive');
} finally {await env.cleanup();}
