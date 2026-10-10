// Keep each query bounded while retaining the complete chronological register.
// A changed page boundary replaces its dependent listeners; partial pages are
// never delivered as a complete calendar while the new tail is still loading.
export function observePaginatedSchedule({ subscribePage, onRows, onError, pageSize = 120 }) {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('Invalid schedule page size.');
  const pages = new Map();
  let stopped = false;
  const boundary = item => `${item.id}\n${String(item.data()?.dateIso || '')}`;
  function removeFrom(index) {
    for (const [number, page] of pages) if (number >= index) {
      pages.delete(number);
      page.unsubscribe?.();
    }
  }
  function publishComplete() {
    if (stopped) return;
    const documents = new Map();
    for (let number = 0; ; number++) {
      const page = pages.get(number);
      if (!page?.ready) return;
      for (const item of page.docs) documents.set(item.id, { id: item.id, ...item.data() });
      if (page.docs.length < pageSize) break;
    }
    onRows([...documents.values()].sort((a, b) =>
      String(a.dateIso || a.dateKey || '').localeCompare(String(b.dateIso || b.dateKey || '')) || a.id.localeCompare(b.id)));
  }
  function listen(number, cursor = null) {
    const page = { ready: false, docs: [], cursorKey: cursor ? boundary(cursor) : '', unsubscribe: null };
    pages.set(number, page);
    const unsubscribe = subscribePage(cursor, snapshot => {
      if (stopped || pages.get(number) !== page) return;
      page.docs = snapshot.docs;
      page.ready = true;
      if (page.docs.length === pageSize) {
        const last = page.docs.at(-1);
        if (pages.get(number + 1)?.cursorKey !== boundary(last)) {
          removeFrom(number + 1);
          listen(number + 1, last);
        }
      } else removeFrom(number + 1);
      publishComplete();
    }, error => {
      if (stopped || pages.get(number) !== page) return;
      page.ready = false;
      onError?.(error);
    }, number);
    // Also support subscriptions whose first callback runs synchronously.
    if (stopped || pages.get(number) !== page) unsubscribe?.();
    else page.unsubscribe = unsubscribe;
  }
  try { listen(0); } catch (error) { stopped = true; removeFrom(0); throw error; }
  return () => { stopped = true; removeFrom(0); };
}
