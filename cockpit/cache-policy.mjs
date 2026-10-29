// Reuse one IndexedDB cache across tabs. A user's memory-only choice remains explicit.
export const CACHE_PREFERENCE_KEY = 'bleu-massawippi-firestore-cache-v1';
export function readCachePreference(storage) {
  try { return storage?.getItem(CACHE_PREFERENCE_KEY) ?? null; }
  catch { return 'memory'; }
}
export function wantsPersistentCache({safeMode=false,offline='',preference=null}={}) {
  return safeMode || offline === '1' || (offline !== '0' && preference !== 'memory');
}
