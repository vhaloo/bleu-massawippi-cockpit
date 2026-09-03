export function assertPublicationMutable(id, schedule = {}, workflow = {}) {
  const protectedStages = new Set(["completed", "published", "scheduled", "done"]);
  if (protectedStages.has(String(workflow.stage || "").toLowerCase())
      || protectedStages.has(String(schedule.status || "").toLowerCase())
      || schedule.completed === true || schedule.published === true || schedule.scheduled === true
      || schedule.deleted === true || schedule.editorial?.archivedEditorial === true) {
    throw new Error(`${id}: publication terminée, programmée, publiée ou archivée; mutation refusée.`);
  }
}

export function reschedulePatch(post, schedule = {}) {
  const patch = {dateKey: post.date, dateIso: post.dateIso};
  if (schedule.editorial) {
    patch["editorial.dateIso"] = post.dateIso;
    patch["editorial.dateLabel"] = post.date;
    patch["editorial.week"] = post.w;
  }
  return patch;
}
