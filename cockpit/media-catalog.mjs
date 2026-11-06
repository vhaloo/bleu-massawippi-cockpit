// A Firestore projection is applied by the server, before bytes are transferred.
// Keep the existing documents and writers: original files still live in SharePoint.
export const MEDIA_CATALOG_LIMIT = 160;
export const MEDIA_CATALOG_FIELDS = Object.freeze([
  'altText', 'archiveReason', 'archived', 'archivedAt', 'archivedBy', 'archivedReason',
  'approvedAt', 'approvedBy', 'approvedByLabel', 'authorLabel', 'authorUid',
  'correctionStatus', 'createdAt', 'durationSeconds', 'eventId', 'kind', 'label',
  'note', 'previewDataHeight', 'previewDataSha256', 'previewDataWidth', 'previewUrl',
  'publicationBlocked', 'replacedBy', 'rightsConfirmed', 'rightsConfirmedAt',
  'rightsConfirmedBy', 'rightsConfirmedByLabel', 'rightsStatus', 'selectedFinal',
  'sourceDriveId', 'sourceFileSha256', 'sourceItemId', 'stage', 'updatedAt',
  'updatedBy', 'updatedByLabel', 'url'
]);
export function mediaCatalogQuery(since = '') {
  const structuredQuery = {
    select: { fields: MEDIA_CATALOG_FIELDS.map(fieldPath => ({fieldPath})) },
    from: [{collectionId:'mediaLinks'}],
    orderBy: [{field:{fieldPath:'updatedAt'}, direction:'DESCENDING'}],
    limit: MEDIA_CATALOG_LIMIT
  };
  if (since && Number.isFinite(Date.parse(since))) structuredQuery.where={fieldFilter:{field:{fieldPath:'updatedAt'},op:'GREATER_THAN_OR_EQUAL',value:{timestampValue:since}}};
  return {structuredQuery};
}
export function mediaCatalogWatermark(payload) {return payload?.find(row=>row.document)?.document.fields?.updatedAt?.timestampValue || '';}
export function mergeMediaCatalogDelta(previous, delta) {
  // The >= cursor includes all records tied at the last timestamp. The server
  // orders that complete prefix, including its document-ID tie breaker.
  const fresh=delta.filter(row=>row.document),names=new Set(fresh.map(row=>row.document.name));
  return [...fresh,...(previous || []).filter(row=>row.document&&!names.has(row.document.name))].slice(0,MEDIA_CATALOG_LIMIT);
}
export function decodeFirestoreValue(value, timestamp = value => value) {
  if ('nullValue' in value) return null;
  for (const key of ['stringValue','booleanValue','doubleValue','referenceValue']) if (key in value) return value[key];
  if ('integerValue' in value) return Number(value.integerValue);
  if ('timestampValue' in value) {if(!Number.isFinite(Date.parse(value.timestampValue)))throw new Error('Date de média invalide.');return timestamp(value.timestampValue);}
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(v => decodeFirestoreValue(v,timestamp));
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([k,v]) => [k,decodeFirestoreValue(v,timestamp)]));
  return undefined;
}
export function decodeMediaCatalog(payload, timestamp) {
  if (!Array.isArray(payload) || payload.length > MEDIA_CATALOG_LIMIT + 1) throw new Error('Catalogue médias invalide.');
  return payload.filter(row => row.document).map(({document}) => {
    const id = document.name?.match(/\/documents\/mediaLinks\/([A-Za-z0-9_-]{1,200})$/)?.[1];
    if (!id || !document.fields || 'previewDataUrl' in document.fields) throw new Error('Projection médias invalide.');
    return {id, ...Object.fromEntries(Object.entries(document.fields).map(([k,v]) => [k,decodeFirestoreValue(v,timestamp)]))};
  });
}
export function mediaPreviewRevision(row) {
  if (row.previewDataSha256) return String(row.previewDataSha256);
  const at = row.updatedAt;
  return at?.seconds !== undefined ? `${at.seconds}:${at.nanoseconds || 0}` : String(at || '');
}
export function mediaCatalogMarker(row) {
  // Every supported media writer updates updatedAt. Also distinguish legacy edits
  // to the latest record, even if their timestamp has accidentally stayed fixed.
  if (!row) return 'empty';
  const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().filter(k=>k!=='previewDataUrl').map(k=>[k,stable(value[k])])) : value;
  return JSON.stringify(stable(row));
}

export const MEDIA_CATALOG_CACHE_PREFIX = 'bleu-media-catalog-v1:';
export function mediaCatalogCache(storage, project, uid, enabled) {
  const key = `${MEDIA_CATALOG_CACHE_PREFIX}${project}:${uid}`;
  return {
    read() {
      if (!enabled) return null;
      try { const item=JSON.parse(storage?.getItem(key) || 'null');
        if (item?.version !== 1 || typeof item.marker !== 'string') return null;
        decodeMediaCatalog(item.payload); return item;
      } catch { return null; }
    },
    write(item) {
      if (!enabled) return;
      try { const text=JSON.stringify({version:1,...item}); if(text.length <= 1048576) storage?.setItem(key,text); } catch {}
    }
  };
}
export function clearMediaCatalogCache(storage) {
  try { for (let i=storage.length-1;i>=0;i--) { const key=storage.key(i); if(key?.startsWith(MEDIA_CATALOG_CACHE_PREFIX)) storage.removeItem(key); } } catch {}
}

/** One live record invalidates a bounded, projected catalogue; never poll it.
 * Cache-only callbacks do not trigger REST traffic. A matching persisted marker
 * avoids downloading even the metadata again on an ordinary reload/reconnect.
 */
export function observeMediaCatalog({watch, load, cache, onRows, onError, timestamp,
  delay = (fn,ms) => setTimeout(fn,ms), cancelDelay = id => clearTimeout(id)}) {
  let closed=false, running=false, pending=false, marker=null, loadedMarker=null, timer=null;
  const controller=new AbortController();
  const cached=cache?.read(); let currentPayload=cached?.payload || null;
  if(cached) { loadedMarker=cached.marker; onRows(decodeMediaCatalog(cached.payload,timestamp)); }
  async function refresh(attempt=0) {
    if(closed || running || marker===loadedMarker) return;
    running=true; pending=false; const requested=marker;
    try {
      const delta=await load(controller.signal,mediaCatalogWatermark(currentPayload));
      if(closed) return;
      decodeMediaCatalog(delta,timestamp);
      const payload=currentPayload ? mergeMediaCatalogDelta(currentPayload,delta) : delta;
      const rows=decodeMediaCatalog(payload,timestamp);
      currentPayload=payload;
      loadedMarker=requested;
      cache?.write({marker:requested,payload}); onRows(rows);
    } catch(error) {
      if(closed || error?.name==='AbortError') return;
      if(attempt<2 && !/permission-denied|unauthenticated/.test(error?.code || '')) {
        timer=delay(()=>{timer=null;refresh(attempt+1);}, 2000*(attempt+1));
      } else onError?.(error);
    } finally {
      running=false;
      if(!closed && pending && timer===null) { pending=false; void refresh(); }
    }
  }
  const stop=watch(({token,fromCache=false,pendingWrites=false})=>{
    if(closed || fromCache || pendingWrites) return;
    if(token===marker && (running || timer!==null || marker===loadedMarker)) return;
    marker=token;
    if(timer!==null) { cancelDelay(timer); timer=null; }
    if(running) pending=true; else void refresh();
  }, error=>{if(!closed) onError?.(error);});
  return ()=>{closed=true;controller.abort();if(timer!==null)cancelDelay(timer);stop();};
}
