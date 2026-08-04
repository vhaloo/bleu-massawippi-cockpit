export const isDryRun = (argv = process.argv) => argv.includes("--dry-run");

export const protectedScheduleFields = Object.freeze(["dateIso", "dateKey", "calendarTime"]);
export const scheduleLockedWorkflowStages = new Set(["scheduled", "published"]);

export function assertProtectedScheduleChange({
  eventId,
  before = {},
  after = {},
  workflowStage = "proposal",
  allowedEventIds = new Set(),
  reason = ""
} = {}) {
  const changedFields = protectedScheduleFields.filter((key) => JSON.stringify(before?.[key] ?? null) !== JSON.stringify(after?.[key] ?? null));
  const normalizedStage = String(workflowStage || "proposal").trim().toLowerCase();
  const locked = scheduleLockedWorkflowStages.has(normalizedStage);
  if (!changedFields.length || !locked) {
    return { changedFields, locked, overrideUsed: false, workflowStage: normalizedStage };
  }

  const normalizedId = String(eventId || "").trim();
  const normalizedReason = String(reason || "").trim();
  if (!allowedEventIds.has(normalizedId)) {
    throw new Error(`Déplacement refusé pour ${normalizedId} : le workflow est ${normalizedStage}. Utiliser un override explicite et motivé seulement pour une correction autorisée.`);
  }
  if (normalizedReason.length < 20) {
    throw new Error(`Déplacement refusé pour ${normalizedId} : --reschedule-reason doit expliquer la correction autorisée (20 caractères minimum).`);
  }
  return { changedFields, locked, overrideUsed: true, workflowStage: normalizedStage, reason: normalizedReason };
}

export function sameSeedFields(existing = {}, desired = {}) {
  return Object.entries(desired).every(([key, value]) => JSON.stringify(existing?.[key] ?? null) === JSON.stringify(value ?? null));
}

export function dryRunSummary(name, items, extra = {}) {
  return { ready: true, dryRun: true, seed: name, items: items.length, maximumWrites: items.length, ...extra };
}
