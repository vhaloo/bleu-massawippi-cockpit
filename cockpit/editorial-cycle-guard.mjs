/** Shared by the Studio, local editor and maintenance jobs. Never bypass completion. */
export function assertPublicationNotCompleted(id, schedule = {}, workflow = {}) {
  const protectedStages = new Set(["completed", "published", "scheduled", "done"]);
  if (protectedStages.has(String(workflow.stage || "").trim().toLowerCase())
      || protectedStages.has(String(schedule.status || "").trim().toLowerCase())
      || schedule.completed === true || schedule.published === true || schedule.scheduled === true) {
    throw new Error(`${id}: publication terminée, programmée ou publiée; mutation refusée. Conservez l’original et préparez une copie distincte.`);
  }
}

export function assertPublicationMutable(id, schedule = {}, workflow = {}) {
  assertPublicationNotCompleted(id, schedule, workflow);
  if (schedule.deleted === true || schedule.editorial?.archivedEditorial === true) {
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
