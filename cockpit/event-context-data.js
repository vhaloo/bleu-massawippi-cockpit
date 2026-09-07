import { subscribeCommentsForSection, subscribeMediaLinksForEvent } from "./firebase-client.js?v=20260907-b77";

const validId = (value) => /^[A-Za-z0-9_-]{3,160}$/.test(String(value || ""));

export function createEventContextController({ enabled, onRows, onError }) {
  let currentId = "";
  let unsubscribes = [];
  const snapshots = new Map();
  let generation = 0;

  const stop = () => {
    generation++;
    snapshots.clear();
    unsubscribes.forEach((unsubscribe) => {
      try { unsubscribe?.(); } catch { /* désabonnement idempotent */ }
    });
    unsubscribes = [];
    currentId = "";
  };

  const activate = (eventId) => {
    const id = String(eventId || "");
    if (!enabled || !validId(id) || currentId === id) return;
    stop();
    currentId = id;
    const activeGeneration = generation;
    try {
      unsubscribes.push(subscribeCommentsForSection(id, (rows) => {
        if (currentId !== id || generation !== activeGeneration) return;
        snapshots.set("comments", rows);
        onRows?.("comments", id, rows);
      }, onError));
      unsubscribes.push(subscribeMediaLinksForEvent(id, (rows) => {
        if (currentId !== id || generation !== activeGeneration) return;
        snapshots.set("media", rows);
        onRows?.("media", id, rows);
      }, onError));
    } catch (error) {
      onError?.(error);
      stop();
    }
  };

  return {
    activate,
    stop,
    current: () => currentId,
    snapshot: kind => snapshots.has(kind) ? { eventId: currentId, rows: snapshots.get(kind) } : null,
  };
}
