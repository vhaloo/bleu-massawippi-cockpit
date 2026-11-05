import assert from 'node:assert/strict';
import {readCachePreference,wantsPersistentCache,CACHE_PREFERENCE_KEY,readAuthCacheRecovery,prepareAuthCacheRecovery,clearAuthCacheRecovery,AUTH_CACHE_RECOVERY_KEY} from './cache-policy.mjs';
assert.equal(wantsPersistentCache(),true);
assert.equal(wantsPersistentCache({preference:'persistent'}),true);
assert.equal(wantsPersistentCache({preference:'memory'}),false);
assert.equal(wantsPersistentCache({offline:'0'}),false);
assert.equal(wantsPersistentCache({offline:'1',preference:'memory'}),true);
assert.equal(wantsPersistentCache({safeMode:true,offline:'0',preference:'memory'}),true);
assert.equal(readCachePreference({getItem:key=>{assert.equal(key,CACHE_PREFERENCE_KEY);return 'memory';}}),'memory');
assert.equal(readCachePreference({getItem(){throw Error('stockage indisponible');}}),'memory');
assert.equal(readCachePreference(null),null);
console.log('Cache: réutilisation par défaut, choix mémoire, mode secours et stockage bloqué vérifiés.');

const denied = {code:'permission-denied'};
const storage = () => { const values=new Map(); return {getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}; };
const tab=storage();
assert.equal(readAuthCacheRecovery(tab),false);
assert.equal(prepareAuthCacheRecovery({storage:tab,persistentCacheRequested:true,error:denied}),true);
assert.equal(tab.getItem(AUTH_CACHE_RECOVERY_KEY),'memory');
assert.equal(readAuthCacheRecovery(tab),true);
assert.equal(wantsPersistentCache({preference:readAuthCacheRecovery(tab)?'memory':null}),false);
assert.equal(prepareAuthCacheRecovery({storage:tab,persistentCacheRequested:true,error:denied}),false,'Pas de boucle de rechargement.');
assert.equal(readAuthCacheRecovery(storage()),false,'Un autre onglet garde sa préférence.');
clearAuthCacheRecovery(tab);
assert.equal(readAuthCacheRecovery(tab),false,'Un choix explicite peut rétablir le cache persistant.');
assert.doesNotThrow(()=>clearAuthCacheRecovery({removeItem(){throw Error('blocked')}}));
for(const condition of [{safeMode:true},{offline:'1'},{persistentCacheRequested:false},{error:{code:'unavailable'}}]) {
  const current=storage();
  assert.equal(prepareAuthCacheRecovery({storage:current,persistentCacheRequested:true,error:denied,...condition}),false);
  assert.equal(current.getItem(AUTH_CACHE_RECOVERY_KEY),null);
}
assert.equal(prepareAuthCacheRecovery({storage:null,persistentCacheRequested:true,error:denied}),false);
assert.equal(prepareAuthCacheRecovery({storage:{getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}},persistentCacheRequested:true,error:denied}),false);
console.log('Reprise auth: un essai en mémoire par onglet, sans purge ni changement de préférence durable.');
