// Private, account-scoped cache. Every online reuse first checks the server's
// document updateTime AND current read permission. Never stale-on-error.
export const CONTENT_CACHE_DATABASE = 'bleu-versioned-content-v1';
const allowed = id => /^(plan|philanthropie)$/.test(id);
const valid = (raw, project, id) => raw?.name === `projects/${project}/databases/(default)/documents/privateContent/${id}`
  && typeof raw.updateTime === 'string' && Number.isFinite(Date.parse(raw.updateTime)) && raw.fields && typeof raw.fields === 'object';

export function createContentStore(indexedDB) {
  let opening;
  const memory = new Map();
  function open() {
    if (!indexedDB) return Promise.resolve(null);
    if (!opening) opening = new Promise(resolve => {
      let done = false;
      const finish = value => { if (done) { value?.close(); return; } done = true; clearTimeout(timer); resolve(value); };
      const timer = setTimeout(() => finish(null), 1500);
      try {
        const request = indexedDB.open(CONTENT_CACHE_DATABASE, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('documents');
        request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); finish(request.result); };
        request.onerror = request.onblocked = () => finish(null);
      } catch { finish(null); }
    });
    return opening;
  }
  async function operate(key, mode, value) {
    const db = await open(); if (!db) return null;
    return new Promise(resolve => {
      let result = null, tx, settled = false;
      const finish = value => { if (settled) return; settled = true; clearTimeout(timer); resolve(value); };
      const timer = setTimeout(() => { try { tx?.abort(); } catch {} finish(null); }, 2000);
      try {
        tx = db.transaction('documents', mode === 'get' ? 'readonly' : 'readwrite');
        const store = tx.objectStore('documents');
        const request = mode === 'get' ? store.get(key) : mode === 'put' ? store.put(value, key) : store.clear();
        request.onsuccess = () => { result = request.result ?? null; };
        tx.oncomplete = () => finish(result); tx.onerror = tx.onabort = () => finish(null);
      } catch { finish(null); }
    });
  }
  return {
    async get(key, persistent) { return memory.get(key) || (persistent ? await operate(key, 'get') : null); },
    async put(key, value, persistent) {
      memory.set(key, value); if (memory.size > 24) memory.delete(memory.keys().next().value);
      if (persistent) await operate(key, 'put', value);
    },
    async clear() { memory.clear(); await operate(null, 'clear'); },
    clearMemory() { memory.clear(); }
  };
}

export function createVersionedContentReader({ project, currentUser, persistent, store, request, onMetric = () => {} }) {
  const pending = new Map();
  return {
    read(id, { offline = false } = {}) {
      if (!allowed(id)) return Promise.reject(new Error('Document hors du cache autorisé.'));
      const user = currentUser(); if (!user?.uid) return Promise.reject(new Error('Connexion requise.'));
      const key = `${project}:${user.uid}:${id}`, jobKey = `${key}:${offline}`;
      if (pending.has(jobKey)) return pending.get(jobKey);
      const sameUser = () => { if (currentUser()?.uid !== user.uid) throw new DOMException('Session fermée.', 'AbortError'); };
      const job = (async () => {
        const cached = await store.get(key, persistent()); sameUser();
        const usable = cached?.version === 1 && cached.owner === user.uid && valid(cached.document, project, id);
        if (offline) {
          if (!usable) throw new Error('Ce contenu n’est pas disponible hors connexion sur cet appareil.');
          onMetric({ kind: 'offline-hit', id }); return cached.document;
        }
        if (usable) {
          const revision = await request(id, { user, metadataOnly: true }); sameUser();
          if (!revision?.updateTime || revision.name !== cached.document.name) throw new Error('Version du document non vérifiable.');
          if (revision.updateTime === cached.document.updateTime) {
            onMetric({ kind: 'validated-hit', id }); return cached.document;
          }
        }
        const document = await request(id, { user, metadataOnly: false }); sameUser();
        if (!valid(document, project, id)) throw new Error('Contenu sécurisé incomplet.');
        // Store the updateTime of THIS response, not the earlier revision probe:
        // a writer can update the document between the two requests.
        await store.put(key, { version: 1, owner: user.uid, document }, persistent()); sameUser();
        onMetric({ kind: 'download', id }); return document;
      })().finally(() => pending.delete(jobKey));
      pending.set(jobKey, job); return job;
    }
  };
}
