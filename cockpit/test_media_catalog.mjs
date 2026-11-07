import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {MEDIA_CATALOG_FIELDS,mediaCatalogQuery,mediaCatalogWatermark,mergeMediaCatalogDelta,decodeMediaCatalog,mediaPreviewRevision,mediaCatalogMarker,mediaCatalogCache,clearMediaCatalogCache,observeMediaCatalog} from './media-catalog.mjs';
import {observeLazyMediaPreviews} from './lazy-media-preview.mjs';
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const wire=(id='m1')=>[{document:{name:`projects/test/databases/(default)/documents/mediaLinks/${id}`,fields:{eventId:{stringValue:'event-1'},label:{stringValue:'Le lac'},updatedAt:{timestampValue:'2026-11-06T08:00:00.123456789Z'},selectedFinal:{booleanValue:true}}}}];
const body=mediaCatalogQuery().structuredQuery;
assert.equal(body.limit,160);assert.equal(body.from[0].collectionId,'mediaLinks');
assert(!MEDIA_CATALOG_FIELDS.includes('previewDataUrl'));
for(const field of ['url','previewUrl','rightsConfirmed','publicationBlocked','archived','approvedAt','selectedFinal','updatedAt']) assert(MEDIA_CATALOG_FIELDS.includes(field));
assert.equal(decodeMediaCatalog(wire())[0].selectedFinal,true);
assert.equal(decodeMediaCatalog(wire(),x=>({precise:x}))[0].updatedAt.precise,'2026-11-06T08:00:00.123456789Z');
assert.equal(mediaPreviewRevision({updatedAt:{seconds:1,nanoseconds:123456789}}),'1:123456789');
assert.throws(()=>decodeMediaCatalog([{document:{name:'x/documents/mediaLinks/m1',fields:{previewDataUrl:{stringValue:'heavy'}}}}]));
assert.throws(()=>decodeMediaCatalog([{document:{name:'x/documents/users/admin',fields:{}}}]));
assert.equal(mediaCatalogMarker({id:'m',previewDataUrl:'heavy',label:'a'}),mediaCatalogMarker({label:'a',id:'m'}));
assert.notEqual(mediaCatalogMarker({id:'m',rightsConfirmed:true}),mediaCatalogMarker({id:'m',rightsConfirmed:false}));
const watermark=mediaCatalogWatermark(wire());assert.equal(watermark,'2026-11-06T08:00:00.123456789Z');
assert.equal(mediaCatalogQuery(watermark).structuredQuery.where.fieldFilter.op,'GREATER_THAN_OR_EQUAL');
const complete=Array.from({length:160},(_,i)=>wire(`original-${i}`)[0]),changed=wire('original-80')[0];changed.document.fields.archived={booleanValue:true};
const merged=mergeMediaCatalogDelta(complete,[wire('new')[0],changed]);assert.equal(merged.length,160);assert.equal(new Set(merged.map(x=>x.document.name)).size,160);assert.equal(decodeMediaCatalog(merged)[1].archived,true);assert.equal(decodeMediaCatalog(merged)[2].id,'original-0');
assert.deepEqual(mergeMediaCatalogDelta(complete,[{readTime:'2026-11-06T09:00:00Z'}]),complete,'An empty delta preserves the cached catalogue');
const map=new Map(),storage={getItem:k=>map.get(k)||null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k),key:i=>[...map.keys()][i],get length(){return map.size;}};
const cache=mediaCatalogCache(storage,'project','alice',true);
cache.write({marker:'A',payload:wire()});assert.equal(cache.read().marker,'A');
assert.equal(mediaCatalogCache(storage,'project','bob',true).read(),null);
assert.equal(mediaCatalogCache(storage,'project','alice',false).read(),null);
map.set('unrelated-preference','keep');clearMediaCatalogCache(storage);assert.deepEqual([...map],[['unrelated-preference','keep']]);
assert.equal(mediaCatalogCache({getItem:()=>'{bad'},'p','u',true).read(),null);

// Cold start, a local pending write, reconnect and a write racing the catalogue.
let next,stops=0,loads=[],rows=[],saved=[];
const stop=observeMediaCatalog({watch:fn=>{next=fn;return()=>stops++;},cache:{read:()=>null,write:x=>saved.push(x)},
  load:signal=>new Promise(resolve=>loads.push({resolve,signal})),onRows:x=>rows.push(x)});
next({token:'A',fromCache:true});next({token:'A',pendingWrites:true});assert.equal(loads.length,0);
next({token:'A'});next({token:'A'});assert.equal(loads.length,1);
next({token:'B'});next({token:'B'});loads[0].resolve(wire());await tick();assert.equal(loads.length,2,'Coalesce a batch to one follow-up query');
loads[1].resolve(wire('m2'));await tick();assert.equal(rows.at(-1)[0].id,'m2');assert.equal(saved.at(-1).marker,'B');
next({token:'B',fromCache:true});next({token:'B'});await tick();assert.equal(loads.length,2,'Reconnection with no change does not query again');
next({token:'C'});stop();loads[2].resolve(wire('late'));await tick();assert.equal(rows.at(-1)[0].id,'m2');assert(loads[2].signal.aborted);assert.equal(stops,1);
let reloads=0;
const stopWarm=observeMediaCatalog({watch:fn=>{next=fn;return()=>{};},cache:{read:()=>saved.at(-1)},load:async()=>{reloads++;return wire();},onRows:()=>{}});
next({token:'B'});await tick();assert.equal(reloads,0,'Persisted matching catalogue needs zero repeat metadata reads');stopWarm();
let attempts=0,errors=0,timers=[];
const stopRetry=observeMediaCatalog({watch:fn=>{next=fn;return()=>{};},load:async()=>{attempts++;throw Error('network');},onRows:()=>{},onError:()=>errors++,delay:fn=>{timers.push(fn);return timers.length;},cancelDelay:()=>{}});
next({token:'A'});await tick();timers.shift()();await tick();timers.shift()();await tick();
assert.equal(attempts,3);assert.equal(errors,1);assert.equal(timers.length,0,'Bounded retry, no background polling');stopRetry();

// Actual DOM: two visible copies share a request; hidden cards never read.
const {document}=parseHTML('<html><body><img data-lazy-media-id="one"><img data-lazy-media-id="one"><img data-lazy-media-id="hidden"></body></html>');
let intersect,mutate,requests=0,resolvePreview,disconnected=0;
const images=[...document.querySelectorAll('img')];
const stopImages=observeLazyMediaPreviews({root:document,load:()=>{requests++;return new Promise(r=>resolvePreview=r);},
  observerFactory:fn=>{intersect=fn;return{observe(){},unobserve(){},disconnect(){disconnected++;}};},
  mutationFactory:fn=>{mutate=fn;return{observe(){},disconnect(){disconnected++;}};}});
await tick();assert.equal(requests,0,'Creating hidden DOM must not fetch media');
intersect(images.slice(0,2).map(target=>({target,isIntersecting:true})));await tick();assert.equal(requests,1);
resolvePreview('data:image/jpeg;base64,/9j/AAAA//k=');await tick();assert.equal(images[0].src,images[1].src);assert(!images[0].hasAttribute('data-lazy-media-id'));assert.equal(images[2].src,'');
const late=document.createElement('img');late.dataset.lazyMediaId='late';document.body.append(late);mutate();intersect([{target:late,isIntersecting:true}]);await tick();late.remove();resolvePreview('late');await tick();assert.equal(late.src,'');
stopImages();assert.equal(disconnected,2);
// Recycled DOM images must be observed again after the media version changes.
const dom2=parseHTML('<html><body>'+Array.from({length:8},(_,i)=>`<img data-lazy-media-id="image-${i}" data-lazy-media-revision="one">`).join('')+'</body></html>').document;
let io2,mo2;const running=[],seen=[];
const stop2=observeLazyMediaPreviews({root:dom2,load:(id,revision)=>new Promise(resolve=>running.push({id,revision,resolve})),
 observerFactory:fn=>{io2=fn;return{observe:x=>seen.push(x.dataset.lazyMediaRevision),unobserve(){},disconnect(){}};},
 mutationFactory:fn=>{mo2=fn;return{observe(){},disconnect(){}};}});
const imgs=[...dom2.querySelectorAll('img')];io2(imgs.map(target=>({target,isIntersecting:true})));await tick();assert.equal(running.length,3,'At most three visible previews in flight');
imgs[7].remove();running[0].resolve('first');await tick();assert.equal(running.length,4);assert.equal(imgs[0].src,'first');
imgs[0].dataset.lazyMediaId='image-0';imgs[0].dataset.lazyMediaRevision='two';mo2();assert.equal(seen.at(-1),'two','Reused element re-observed with its new revision');
stop2();running.slice(1).forEach(job=>job.resolve('discarded'));await tick();assert.equal(running.length,4,'Unmount clears queued network work');
console.log('Media catalogue: projected fields, privacy/cache isolation, cold/warm/offline behavior, concurrent edits, bounded retry, cancellation and visible-only deduplicated previews verified.');
