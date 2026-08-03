export const PROJECT_EVENT_CATEGORIES = Object.freeze({
  internal_project: "Projet interne",
  external_opportunity: "Occasion ou candidature",
  meeting: "Rencontre",
  field_activity: "Activité sur le terrain",
  deadline: "Échéance",
  other: "Autre"
});

export const PROJECT_EVENT_URGENCIES = Object.freeze({
  normal: "À garder en vue",
  watch: "À surveiller",
  important: "Important",
  urgent: "Urgent"
});

export const PROJECT_EVENT_STAGES = Object.freeze({
  planned: "À planifier",
  confirmed: "Confirmé",
  in_progress: "En cours",
  waiting: "En attente",
  completed: "Terminé",
  cancelled: "Classé sans suite"
});

export const PROJECT_PROPOSAL_STATUSES = Object.freeze({
  submitted: "Nouvelle proposition",
  in_review: "En préparation",
  converted: "Ajoutée au calendrier",
  closed: "Classée"
});

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isIsoDate(value) {
  if (!DATE_PATTERN.test(String(value || ""))) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

export function normalizeDateRange(startDate, endDate = "") {
  const start = String(startDate || "").trim();
  const end = String(endDate || start).trim() || start;
  if (!isIsoDate(start)) throw new Error("Choisissez une date de début valide.");
  if (!isIsoDate(end)) throw new Error("Choisissez une date de fin valide.");
  if (end < start) throw new Error("La date de fin doit suivre la date de début.");
  return { startDate: start, endDate: end, dateMode: start === end ? "single" : "range" };
}

export function normalizeOptionalTime(value, label = "heure") {
  const time = String(value || "").trim();
  if (time && !TIME_PATTERN.test(time)) throw new Error(`L’${label} doit utiliser le format HH:MM.`);
  return time;
}

function compactText(value, maximum, label, { required = false } = {}) {
  const text = String(value || "").replace(/\r\n/g, "\n").trim();
  if (required && !text) throw new Error(`${label} est requis.`);
  if (text.length > maximum) throw new Error(`${label} dépasse ${maximum} caractères.`);
  return text;
}

export function normalizeSharePointUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error("Le lien de document n’est pas valide."); }
  const host = parsed.hostname.toLowerCase();
  const allowed = parsed.protocol === "https:" && (host.endsWith(".sharepoint.com") || host === "1drv.ms" || host === "onedrive.live.com");
  if (!allowed) throw new Error("Utilisez un lien HTTPS OneDrive ou SharePoint.");
  return parsed.href.slice(0, 2048);
}

export function normalizeHttpsUrl(value, label = "Le lien") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error(`${label} n’est pas valide.`); }
  if (parsed.protocol !== "https:") throw new Error(`${label} doit commencer par https://.`);
  return parsed.href.slice(0, 2048);
}

export function normalizeProjectEventProposal(input = {}) {
  const range = normalizeDateRange(input.startDate, input.endDate);
  const category = Object.hasOwn(PROJECT_EVENT_CATEGORIES, input.category) ? input.category : "internal_project";
  const urgency = Object.hasOwn(PROJECT_EVENT_URGENCIES, input.urgency) ? input.urgency : "normal";
  return {
    schemaVersion: 1,
    title: compactText(input.title, 180, "Le titre", { required: true }),
    description: compactText(input.description, 4000, "La description"),
    ...range,
    category,
    urgency,
    projectId: compactText(input.projectId, 80, "Le projet associé"),
    attachmentUrl: normalizeSharePointUrl(input.attachmentUrl),
    attachmentLocation: compactText(input.attachmentLocation, 500, "L’emplacement SharePoint"),
    notes: compactText(input.notes, 2000, "Les notes"),
    status: "submitted",
    convertedEventId: ""
  };
}

export function normalizeProjectCalendarEvent(input = {}) {
  const range = normalizeDateRange(input.startDate, input.endDate);
  const category = Object.hasOwn(PROJECT_EVENT_CATEGORIES, input.category) ? input.category : "internal_project";
  const urgency = Object.hasOwn(PROJECT_EVENT_URGENCIES, input.urgency) ? input.urgency : "normal";
  const stage = Object.hasOwn(PROJECT_EVENT_STAGES, input.stage) ? input.stage : "planned";
  const startTime = normalizeOptionalTime(input.startTime, "heure de début");
  const endTime = normalizeOptionalTime(input.endTime, "heure de fin");
  if (range.startDate === range.endDate && startTime && endTime && endTime <= startTime) {
    throw new Error("L’heure de fin doit suivre l’heure de début.");
  }
  return {
    schemaVersion: 1,
    title: compactText(input.title, 180, "Le titre", { required: true }),
    summary: compactText(input.summary, 3000, "Le résumé"),
    ...range,
    startTime,
    endTime,
    allDay: !(startTime || endTime),
    category,
    urgency,
    stage,
    projectId: compactText(input.projectId, 80, "Le projet associé"),
    sourceProposalId: compactText(input.sourceProposalId, 160, "La proposition source"),
    attachmentUrl: normalizeSharePointUrl(input.attachmentUrl),
    attachmentLabel: compactText(input.attachmentLabel, 180, "Le nom du document"),
    actionUrl: normalizeHttpsUrl(input.actionUrl, "Le lien d’action"),
    actionLabel: compactText(input.actionLabel, 120, "Le nom de l’action"),
    location: compactText(input.location, 300, "Le lieu"),
    ownerLabel: compactText(input.ownerLabel, 120, "La personne responsable")
  };
}

export function compareProjectCalendarEvents(left, right) {
  return String(left.startDate || "").localeCompare(String(right.startDate || ""))
    || String(left.endDate || "").localeCompare(String(right.endDate || ""))
    || String(left.title || "").localeCompare(String(right.title || ""), "fr");
}

export function eventIntersectsMonth(event, year, monthIndex) {
  const first = `${year}-${String(monthIndex + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const last = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return String(event.endDate || event.startDate || "") >= first && String(event.startDate || "") <= last;
}

export function datesForEvent(event, maximum = 62) {
  const range = normalizeDateRange(event.startDate, event.endDate);
  const dates = [];
  let cursor = new Date(`${range.startDate}T00:00:00Z`);
  const end = new Date(`${range.endDate}T00:00:00Z`);
  while (cursor <= end && dates.length < maximum) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

export function monthGridDates(year, monthIndex) {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const cursor = new Date(first);
  cursor.setUTCDate(cursor.getUTCDate() - mondayOffset);
  return Array.from({ length: 42 }, () => {
    const iso = cursor.toISOString().slice(0, 10);
    const result = { iso, inMonth: cursor.getUTCMonth() === monthIndex, day: cursor.getUTCDate() };
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    return result;
  });
}

export function projectEventIcs(event) {
  const safe = (value) => String(value || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const compactDate = (value) => String(value || "").replace(/-/g, "");
  const nextDay = new Date(`${event.endDate || event.startDate}T00:00:00Z`);
  nextDay.setUTCDate(nextDay.getUTCDate() + 1);
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Bleu Massawippi//Cockpit Communication//FR", "BEGIN:VEVENT"];
  if (event.allDay !== false || !event.startTime) {
    lines.push(`DTSTART;VALUE=DATE:${compactDate(event.startDate)}`);
    lines.push(`DTEND;VALUE=DATE:${compactDate(nextDay.toISOString().slice(0, 10))}`);
  } else {
    lines.push(`DTSTART:${compactDate(event.startDate)}T${event.startTime.replace(":", "")}00`);
    const endDate = event.endDate || event.startDate;
    const endTime = event.endTime || event.startTime;
    lines.push(`DTEND:${compactDate(endDate)}T${endTime.replace(":", "")}00`);
  }
  lines.push(`SUMMARY:${safe(event.title)}`);
  if (event.summary) lines.push(`DESCRIPTION:${safe(event.summary)}`);
  if (event.location) lines.push(`LOCATION:${safe(event.location)}`);
  lines.push(`UID:${safe(event.id || `${event.startDate}-${event.title}`)}@cockpit.bleumassawippi`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  return lines.join("\r\n");
}
