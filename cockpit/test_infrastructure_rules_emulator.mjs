import fs from 'node:fs/promises';
import {initializeTestEnvironment,assertFails,assertSucceeds}from'@firebase/rules-unit-testing';
import {doc,getDoc,getDocs,collection,setDoc}from'firebase/firestore';
import {INFRASTRUCTURE_ADMIN_UID,INFRASTRUCTURE_DOCUMENT}from'./infrastructure-model.mjs';
const [host='127.0.0.1',port='8187']=String(process.env.FIRESTORE_EMULATOR_HOST||'127.0.0.1:8187').split(':');
const environment=await initializeTestEnvironment({projectId:'cockpit-media-decision-test',firestore:{host,port:Number(port),rules:await fs.readFile(new URL('./firestore.rules',import.meta.url),'utf8')}});
try{
 await environment.withSecurityRulesDisabled(async context=>{const db=context.firestore();for(const[uid,role,active]of[[INFRASTRUCTURE_ADMIN_UID,'admin',true],['annie-infrastructure','director',true],['inactive-infrastructure','admin',false]])await setDoc(doc(db,'users',uid),{role,active});await setDoc(doc(db,'privateContentVersions',INFRASTRUCTURE_DOCUMENT),{kind:'admin-infrastructure',snapshot:{schemaVersion:1}});});
 const admin=environment.authenticatedContext(INFRASTRUCTURE_ADMIN_UID).firestore(),annie=environment.authenticatedContext('annie-infrastructure').firestore(),inactive=environment.authenticatedContext('inactive-infrastructure').firestore(),anonymous=environment.unauthenticatedContext().firestore();
 await assertSucceeds(getDoc(doc(admin,'privateContentVersions',INFRASTRUCTURE_DOCUMENT)));
 for(const db of[annie,inactive,anonymous]){await assertFails(getDoc(doc(db,'privateContentVersions',INFRASTRUCTURE_DOCUMENT)));await assertFails(getDocs(collection(db,'privateContentVersions')));}
 await assertFails(setDoc(doc(admin,'privateContentVersions',INFRASTRUCTURE_DOCUMENT),{snapshot:{tampered:true}}));
 console.log('Infrastructure snapshot: active admin read, Annie/inactive/anonymous get and list denied, browser writes denied. Existing deployed rules unchanged.');
}finally{await environment.cleanup();}
