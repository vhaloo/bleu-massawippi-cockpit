// Reuse one IndexedDB cache across tabs. A user's memory-only choice remains explicit.
export const CACHE_PREFERENCE_KEY = 'bleu-massawippi-firestore-cache-v1';
export const AUTH_CACHE_RECOVERY_KEY = 'bleu-massawippi-auth-cache-recovery-v1';
export function readCachePreference(storage) {
  try { return storage?.getItem(CACHE_PREFERENCE_KEY) ?? null; }
  catch { return 'memory'; }
}
export function wantsPersistentCache({safeMode=false,offline='',preference=null}={}) {
  return safeMode || offline === '1' || (offline !== '0' && preference !== 'memory');
}

export function readAuthCacheRecovery(storage) {
  try { return storage?.getItem(AUTH_CACHE_RECOVERY_KEY) === 'memory'; }
  catch { return false; }
}

export function clearAuthCacheRecovery(storage) {
  try { storage?.removeItem(AUTH_CACHE_RECOVERY_KEY); } catch {}
}

/** Isolate this tab after a persistent-cache auth failure; retain the disk cache. */
export function prepareAuthCacheRecovery({storage,persistentCacheRequested=false,safeMode=false,offline='',error}={}) {
  if (!persistentCacheRequested || safeMode || offline === '1'
    || !/^(?:firestore\/)?permission-denied$/.test(String(error?.code || ''))) return false;
  try {
    if (!storage?.setItem || readAuthCacheRecovery(storage)) return false;
    storage.setItem(AUTH_CACHE_RECOVERY_KEY, 'memory');
    return readAuthCacheRecovery(storage);
  } catch { return false; }
}
