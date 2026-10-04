/** Read-only queue: reading, approval or a partial reply never closes a request. */
export const ANNIE_UID = "3wXu7TuOE5OMIBiohOtH1vpUVf43";
export const REQUEST_PAGE_SIZE = 80;
export function requestTime(value) {
  const date = value?.toDate?.() || (value?.__timestamp ? new Date(value.__timestamp) : value instanceof Date ? value : new Date(value || 0));
  return Number.isFinite(date?.valueOf()) ? date.valueOf() : 0;
}
export function pendingAnnieRequests({ comments = [], feedback = [] } = {}) {
  const rows = new Map();
  for (const [kind, items] of [["comment", comments], ["feedback", feedback]]) {
    for (const item of items) {
      if (item.authorUid !== ANNIE_UID || item.deleted === true || item.resolved === true || ["done", "closed", "archived"].includes(item.status)) continue;
      const text = String(kind === "comment" ? item.comment || "" : item.message || "").trim();
      if (!text || !item.id) continue;
      const key = `${kind}:${item.id}`;
      rows.set(key, { key, id: item.id, kind, sectionId: String(item.sectionId || "cockpit"), text,
        status: item.status === "in_review" ? "En cours" : "À traiter", date: requestTime(item.createdAt), editedAt: requestTime(item.updatedAt) });
    }
  }
  return [...rows.values()].sort((a,b) => b.date - a.date || b.editedAt - a.editedAt || a.key.localeCompare(b.key));
}
/** At most two listeners, only while the desktop admin panel is mounted. */
export function watchAnnieRequests({ subscribe, onUpdate }) {
  let stopped = false; const stops = []; const state = { comments: [], feedback: [], sources: {} };
  for (const kind of ["comments", "feedback"]) {
    try { stops.push(subscribe(kind, (rows, meta = {}) => {
      if (stopped) return;
      state[kind] = rows;
      state.sources[kind] = { loaded: true, fromCache: meta.fromCache === true, hasMore: rows.length >= REQUEST_PAGE_SIZE, error: false };
      onUpdate({ ...state, sources: { ...state.sources } });
    }, () => {
      if (stopped) return;
      state.sources[kind] = { ...state.sources[kind], error: true };
      onUpdate({ ...state, sources: { ...state.sources } });
    })); } catch {
      state.sources[kind] = { error: true }; onUpdate({ ...state, sources: { ...state.sources } });
    }
  }
  return () => { stopped = true; stops.forEach(stop => stop?.()); };
}
