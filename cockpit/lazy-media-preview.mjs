// A shared observer serves V1 galleries and V2 calendar/list thumbnails. Hidden
// cards, off-screen images and unopened videos cannot start a document read.
export const MEDIA_PREVIEW_PLACEHOLDER = new URL('./media-preview-placeholder.svg',import.meta.url).href;
export function observeLazyMediaPreviews({root,load,observerFactory,mutationFactory}) {
  const win=root.defaultView || root.ownerDocument?.defaultView || globalThis;
  let observed=new WeakMap();
  const pending=new Map(), failures=new Set(), queue=[], jobs=new Map();
  let active=0;
  let stopped=false;
  const selector='img[data-lazy-media-id]';
  const keyFor=image=>`${image.dataset.lazyMediaId}:${image.dataset.lazyMediaRevision || ''}`;
  function pump() {
    while(!stopped && active<3 && queue.length) {
      const job=queue.shift();
      if(![...job.images].some(image=>image.isConnected && job.key===keyFor(image))) { job.resolve(''); continue; }
      active++;
      Promise.resolve().then(()=>load(job.id,job.revision)).then(job.resolve,job.reject)
        .finally(()=>{active--;pump();});
    }
  }
  function fill(image) {
    if(stopped || !image.isConnected) return;
    const key=keyFor(image); if(failures.has(key)) return;
    let request=pending.get(key);
    if(!request) {
      request=new Promise((resolve,reject)=>{const job={images:new Set([image]),key,id:image.dataset.lazyMediaId,revision:image.dataset.lazyMediaRevision || '',resolve,reject};jobs.set(key,job);queue.push(job);});
      pending.set(key,request);
      request.catch(()=>failures.add(key)).finally(()=>{if(pending.get(key)===request){pending.delete(key);jobs.delete(key);}});
      pump();
    } else jobs.get(key)?.images.add(image);
    request.then(url=>{
      if(stopped || !image.isConnected || key!==keyFor(image) || !url) return;
      image.src=url; image.removeAttribute('data-lazy-media-id'); image.removeAttribute('data-lazy-media-revision');
    }).catch(()=>{}); // The original SharePoint link stays usable on failure.
  }
  const createObserver=observerFactory || (callback=>win.IntersectionObserver ? new win.IntersectionObserver(callback,{rootMargin:'100px'}) : null);
  const intersection=createObserver(entries=>{
    for(const entry of entries) if(entry.isIntersecting) { intersection?.unobserve(entry.target); fill(entry.target); }
  });
  function scan() {
    if(stopped) return;
    for(const image of root.querySelectorAll(selector)) {
      const key=keyFor(image);
      if(observed.get(image)===key) continue;
      if(intersection) { intersection.unobserve(image); observed.set(image,key); intersection.observe(image); }
      // Older browsers still work; inspect visibility without eagerly loading
      // every card in the hidden classic interface.
      else if(image.getClientRects().length) { observed.set(image,key); fill(image); }
    }
  }
  const createMutation=mutationFactory || (callback=>win.MutationObserver ? new win.MutationObserver(callback) : null);
  const mutation=createMutation(scan);
  mutation?.observe(root.documentElement || root,{childList:true,subtree:true,attributes:true,attributeFilter:['data-lazy-media-id','data-lazy-media-revision']});
  if(!intersection) {win.addEventListener?.('scroll',scan,{passive:true});win.addEventListener?.('resize',scan);}
  const retry=()=>{if(stopped)return;failures.clear();observed=new WeakMap();scan();};
  win.addEventListener?.('online',retry);
  scan();
  return ()=>{stopped=true;intersection?.disconnect();mutation?.disconnect();queue.splice(0).forEach(job=>job.resolve(''));pending.clear();failures.clear();win.removeEventListener?.('scroll',scan);win.removeEventListener?.('resize',scan);win.removeEventListener?.('online',retry);};
}
