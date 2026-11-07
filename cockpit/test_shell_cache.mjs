import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('./sw.js',import.meta.url),'utf8'),events={},entries=new Map(),calls=[];
const scope='https://example.org/cockpit/',url=value=>new URL(typeof value==='string'?value:value.url,scope).href;
const release=source.match(/const RELEASE = "([^"]+)"/)[1];
const cache={match:async key=>entries.get(url(key))?.clone(),put:async(key,value)=>entries.set(url(key),value),addAll:async()=>{}};
let offline=false;
vm.runInNewContext(source,{self:{location:{origin:'https://example.org'},registration:{scope},addEventListener:(type,fn)=>events[type]=fn},caches:{open:async()=>cache},URL,Response,fetch:async(request,options)=>{calls.push({url:url(request),options});if(offline)throw Error('offline');return new Response('network');}});
async function request(relative,{method='GET',mode='cors',destination='script'}={}) {
 const promises=[];let response;
 events.fetch({request:{url:url(relative),method,mode,destination},waitUntil:promise=>promises.push(promise),respondWith:value=>{response=Promise.resolve(value);}});
 const result=response?await response:null;await Promise.all(promises);return result;
}
const module=`firebase-client.js?v=${release}`;
entries.set(url(module),new Response('cached current module'));
assert.equal(await(await request(module)).text(),'cached current module');assert.equal(calls.length,0,'Versioned static module does not redownload');
entries.set(url('index.html'),new Response('cached page'));
assert.equal(await(await request('index.html',{mode:'navigate',destination:'document'})).text(),'network');assert.equal(calls.length,1,'Online navigation always checks the current page');
assert.equal(calls[0].options.cache,'no-store');
assert.equal(await request('https://firestore.googleapis.com/v1/projects/x'),null);
assert.equal(await request('https://tenant.sharepoint.com/image.jpg'),null);
assert.equal(await request('save',{method:'POST'}),null);assert.equal(calls.length,1,'No private request or write intercepted');
offline=true;
assert.equal(await(await request(module)).text(),'cached current module');
assert.equal((await request('firebase-client.js?v=unknown')).status,503,'No mixed release fallback');
assert.equal(await(await request('missing-route',{mode:'navigate',destination:'document'})).text(),'network','Navigation falls back to the cached current page');
entries.clear();assert.equal((await request('missing-route',{mode:'navigate',destination:'document'})).status,503,'Never returns undefined when storage is empty');
console.log('Service worker: immutable cache, fresh navigation, private/write bypass, exact releases and offline fallback verified.');
