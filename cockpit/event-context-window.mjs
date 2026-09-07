/** A bounded global window must never erase the open event's full snapshot. */
export function mergeEventWindow(rows, key, snapshot = null) {
  const grouped = new Map();
  for (const row of rows) {
    const id = String(row[key] || "");
    if (!grouped.has(id)) grouped.set(id, []);
    grouped.get(id).push(row);
  }
  // The existing targeted listener is authoritative for the open event,
  // including an empty result after an archive/removal. No extra network read.
  if (snapshot?.eventId && Array.isArray(snapshot.rows)) {
    grouped.set(snapshot.eventId, [...snapshot.rows]);
  }
  return grouped;
}
