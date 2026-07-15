import { subscribeCommentsForSection, subscribeMediaLinksForEvent } from "./firebase-client.js?v=20260715-b16";

const validId = (value) => /^[A-Za-z0-9_-]{3,160}$/.test(String(value || ""));

export function createEventContextController({ enabled, onRows, onError }) {
  let currentId = "";
  let unsubscribes = [];

  const stop = () => {
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
    try {
      unsubscribes.push(subscribeCommentsForSection(id, (rows) => {
        if (currentId === id) onRows?.("comments", id, rows);
      }, onError));
      unsubscribes.push(subscribeMediaLinksForEvent(id, (rows) => {
        if (currentId === id) onRows?.("media", id, rows);
      }, onError));
    } catch (error) {
      onError?.(error);
      stop();
    }
  };

  return { activate, stop, current: () => currentId };
}
