const frenchMonthNumbers = {
  janvier: 0, février: 1, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, août: 7, aout: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11, decembre: 11
};

function escapeCalendarText(value) {
  return String(value ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/([,;])/g, "\\$1");
}

function calendarUtcStamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function nextCalendarDate(weekday, hour, minute = 0, now = new Date()) {
  const target = new Date(now);
  const currentDay = target.getDay();
  let daysAhead = (weekday - currentDay + 7) % 7;
  if (daysAhead === 0 && (now.getHours() > hour || (now.getHours() === hour && now.getMinutes() >= minute))) daysAhead = 7;
  target.setDate(target.getDate() + daysAhead);
  target.setHours(hour, minute, 0, 0);
  return target;
}

export function downloadCalendarFile(filename, content) {
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = filename;
  anchor.rel = "noopener";
  anchor.setAttribute("aria-hidden", "true");
  document.body.appendChild(anchor);
  anchor.click();
  window.setTimeout(() => {
    anchor.remove();
    URL.revokeObjectURL(objectUrl);
  }, 1200);
}

export function parsePlanDate(value) {
  const item = value && typeof value === "object" ? value : null;
  const dateIso = String(item?.dateIso || "");
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    const [year, month, day] = dateIso.split("-").map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }
  const label = item?.date ?? value;
  const match = String(label || "").toLocaleLowerCase("fr-CA").match(/(\d{1,2})(?:er)?\s+([a-zéûô]+)/i);
  if (!match) return null;
  const month = frenchMonthNumbers[match[2]];
  if (typeof month !== "number") return null;
  return new Date(2026, month, Number(match[1]), 12, 0, 0, 0);
}

export function profileTaskLabel(role) {
  if (role === "director") return "Annie — Directrice générale";
  if (role === "admin") return "Valentin — Directeur des communications";
  return "Répartition des tâches";
}

function profileTasks(planItem, role) {
  const valentin = Array.isArray(planItem?.tasksValentin) ? planItem.tasksValentin : [planItem?.task].filter(Boolean);
  const annie = Array.isArray(planItem?.tasksAnnie) ? planItem.tasksAnnie : [];
  if (role === "director") return annie.length ? annie : ["Aucune tâche assignée à la direction générale pour ce contenu; prendre connaissance au besoin."];
  if (role === "admin") return valentin;
  return [...valentin.map((task) => "Valentin : " + task), ...(annie.length ? annie.map((task) => "Annie : " + task) : ["Annie : aucune tâche assignée pour ce contenu."])];
}

function postCalendarStart(planItem, schedule) {
  const start = parsePlanDate(planItem) || new Date(2026, 6, 13, 9, 0, 0, 0);
  const hoursByDay = { 0: 9, 1: 9, 2: 12, 3: 18, 4: 12, 5: 17, 6: 10 };
  const calendarTime = String(schedule?.calendarTime || planItem?.calendarTime || "").trim();
  const validTime = calendarTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  const hour = validTime ? Number(validTime[1]) : (hoursByDay[start.getDay()] ?? 12);
  const minute = validTime ? Number(validTime[2]) : 0;
  start.setHours(hour, minute, 0, 0);
  return start;
}

function postCalendarMetadata(planItem, schedule) {
  const rawDuration = Number(schedule?.calendarDurationMinutes ?? planItem?.calendarDurationMinutes);
  const durationMinutes = Number.isInteger(rawDuration) && rawDuration > 0 && rawDuration <= 1440 ? rawDuration : 30;
  const location = String(schedule?.calendarLocation || planItem?.calendarLocation || "En ligne — Facebook / Instagram").trim();
  const cost = String(schedule?.calendarCost || planItem?.calendarCost || "Aucun coût de diffusion; confirmer les droits, la production et tout achat éventuel.").trim();
  return {
    durationMinutes,
    location: location || "En ligne — Facebook / Instagram",
    cost: cost || "Aucun coût de diffusion; confirmer les droits, la production et tout achat éventuel."
  };
}

export function buildPostCalendarIcs(planItem, { schedule = {}, role = "" } = {}) {
  const start = postCalendarStart(planItem, schedule);
  const metadata = postCalendarMetadata(planItem, schedule);
  const end = new Date(start.getTime() + metadata.durationMinutes * 60000);
  const roleLabel = profileTaskLabel(role);
  const taskLines = profileTasks(planItem, role).map((task) => "• " + task).join("\n");
  const description = [
    `Publication prévue — créneau à tester (${start.toLocaleString("fr-CA", { dateStyle: "full", timeStyle: "short", timeZone: "America/Toronto" })})`,
    "",
    `Tâches de ${roleLabel} :`,
    taskLines,
    "",
    `Format : ${planItem.format || "à confirmer"}`,
    `Objectif : ${planItem.role || "à confirmer"}`,
    `CTA : ${planItem.cta || "à confirmer"}`,
    `Source / validation : ${planItem.source || "à confirmer"}`,
    `Lieu : ${metadata.location}`,
    `Coût prévu : ${metadata.cost}`,
    "Cet événement est une aide de coordination : il ne programme pas automatiquement la publication."
  ].join("\n");
  const uid = `bleu-massawippi-post-${planItem.id}-${start.getTime()}@bleumassawippi.com`;
  return {
    filename: `bleu-massawippi-${planItem.id}-${start.toISOString().slice(0, 10)}.ics`,
    content: [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Bleu Massawippi//Cockpit//FR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${calendarUtcStamp(new Date())}`,
      `DTSTART:${calendarUtcStamp(start)}`,
      `DTEND:${calendarUtcStamp(end)}`,
      `SUMMARY:${escapeCalendarText("Publication — " + (planItem.title || "Bleu Massawippi"))}`,
      `DESCRIPTION:${escapeCalendarText(description)}`,
      `LOCATION:${escapeCalendarText(metadata.location)}`,
      `URL:${escapeCalendarText(planItem.source || "https://bleumassawippi.com")}`,
      "CATEGORIES:BLEU MASSAWIPPI,SOCIAL",
      "STATUS:CONFIRMED",
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n")
  };
}

export function buildWeeklyCoordinationIcs({ weekday = 1, hour = 10, minute = 0, duration = 60, role = "", now = new Date() } = {}) {
  const start = nextCalendarDate(weekday, hour, minute, now);
  const end = new Date(start.getTime() + duration * 60000);
  const uid = `bleu-massawippi-${start.getTime()}@bleumassawippi.com`;
  const summary = "Point de coordination — Bleu Massawippi";
  const weeklyTasks = role === "director"
    ? ["Arbitrer les choix éditoriaux et les sujets sensibles.", "Confirmer les validations, partenaires et décisions qui exigent la direction générale."]
    : ["Préparer la synthèse des choix, commentaires et tâches en attente.", "Mettre à jour le calendrier, les sources, les visuels et les suivis après l’arbitrage."];
  const description = [
    "Point de coordination hebdomadaire proposé autour de 10 h. L’horaire demeure modifiable dans l’agenda partagé.",
    "",
    `Tâches de ${profileTaskLabel(role)} :`,
    weeklyTasks.map((task) => "• " + task).join("\n"),
    "",
    "Ordre du jour : décisions à prendre, validations sensibles, contenu de la semaine et suivis.",
    "Lieu : en ligne ou lieu confirmé dans l’agenda partagé.",
    "Coût prévu : aucun."
  ].join("\n");
  return {
    filename: `coordination-bleu-massawippi-${start.toISOString().slice(0, 10)}.ics`,
    content: [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Bleu Massawippi//Cockpit//FR",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${calendarUtcStamp(new Date())}`,
      `DTSTART:${calendarUtcStamp(start)}`,
      `DTEND:${calendarUtcStamp(end)}`,
      `SUMMARY:${escapeCalendarText(summary)}`,
      `DESCRIPTION:${escapeCalendarText(description)}`,
      "LOCATION:En ligne ou lieu confirmé dans l’agenda partagé",
      "STATUS:CONFIRMED",
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n")
  };
}
