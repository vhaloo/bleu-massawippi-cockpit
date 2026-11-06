// Local, bounded counters only. No document values, identifiers or credentials
// are retained. Decoded SDK JSON sizes are estimates, never billed wire bytes.
export function createReadDiagnostics({now=()=>Date.now()}={}) {
  const sources=new Map(),events=[],starts=[];
  let serverBytes=0,cacheBytes=0;
  const sourceKey=name=>String(name||'lecture').split(':')[0].slice(0,60);
  function trim() {
    const cutoff=now()-10*60000;
    while(events.length&&events[0].at<cutoff)events.shift();
    while(starts.length&&starts[0]<now()-5*60000)starts.shift();
    if(events.length>2048)events.splice(0,events.length-2048);
    if(starts.length>256)starts.splice(0,starts.length-256);
  }
  function listenerStarted(){starts.push(now());trim();}
  function record(name,snapshot) {
    const cache=snapshot?.metadata?.fromCache===true;
    let documents=[];
    try {
      // Metadata-only acknowledgements do not redeliver the whole query.
      if(typeof snapshot?.docChanges==='function')documents=snapshot.docChanges({includeMetadataChanges:false}).filter(change=>change.type!=='removed').map(change=>change.doc);
      else if(Array.isArray(snapshot?.docs))documents=snapshot.docs;
      else if(snapshot?.exists?.())documents=[snapshot];
    } catch {return;}
    let bytes=0;
    for(const document of documents)try{bytes+=new TextEncoder().encode(JSON.stringify(document.data())).byteLength;}catch{}
    if(!bytes)return;
    const key=sourceKey(name),row=sources.get(key)||{source:key,serverApproxBytes:0,cacheApproxBytes:0,documentDeliveries:0};
    row[cache?'cacheApproxBytes':'serverApproxBytes']+=bytes;row.documentDeliveries+=documents.length;sources.set(key,row);
    if(cache)cacheBytes+=bytes;else{serverBytes+=bytes;events.push({at:now(),bytes});}
    trim();
  }
  function snapshot(){trim();return {sdkServerApproxBytes:serverBytes,sdkCacheApproxBytes:cacheBytes,sdkRecentServerApproxBytes:events.reduce((n,event)=>n+event.bytes,0),listenerStartsRecent:starts.length,readSources:[...sources.values()].map(row=>({...row})).sort((a,b)=>b.serverApproxBytes-a.serverApproxBytes)};}
  return {record,listenerStarted,snapshot};
}
