// A shared observer serves V1 galleries and V2 calendar/list thumbnails. Hidden
// cards, off-screen images and unopened videos cannot start a document read.
export const MEDIA_PREVIEW_PLACEHOLDER = new URL('./media-preview-placeholder.svg',import.meta.url).href;
export function observeLazyMediaPreviews({root,load,observerFactory,mutationFactory}) {
  const win=root.defaultView || root.ownerDocument?.defaultView || globalThis;
  const observed=new WeakSet(), pending=new Map(), failures=new Set();
  let stopped=false;
  const selector='img[data-lazy-media-id]';
  const keyFor=image=>`${image.dataset.lazyMediaId}:${image.dataset.lazyMediaRevision || ''}`;
  function fill(image) {
    if(stopped || !image.isConnected) return;
    const key=keyFor(image); if(failures.has(key)) return;
    let request=pending.get(key);
    if(!request) {
      request=Promise.resolve().then(()=>load(image.dataset.lazyMediaId,image.dataset.lazyMediaRevision || ''));
      pending.set(key,request);
      request.catch(()=>failures.add(key)).finally(()=>{if(pending.get(key)===request)pending.delete(key);});
    }
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
      if(observed.has(image)) continue;
      if(intersection) { observed.add(image); intersection.observe(image); }
      // Older browsers still work; inspect visibility without eagerly loading
      // every card in the hidden classic interface.
      else if(image.getClientRects().length) { observed.add(image); fill(image); }
    }
  }
  const createMutation=mutationFactory || (callback=>win.MutationObserver ? new win.MutationObserver(callback) : null);
  const mutation=createMutation(scan);
  mutation?.observe(root.documentElement || root,{childList:true,subtree:true,attributes:true,attributeFilter:['data-lazy-media-id','data-lazy-media-revision']});
  if(!intersection) {win.addEventListener?.('scroll',scan,{passive:true});win.addEventListener?.('resize',scan);}
  scan();
  return ()=>{stopped=true;intersection?.disconnect();mutation?.disconnect();pending.clear();failures.clear();win.removeEventListener?.('scroll',scan);win.removeEventListener?.('resize',scan);};
}
