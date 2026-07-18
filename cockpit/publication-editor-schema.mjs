const TEXT_LIMITS = Object.freeze({
  title: 220, theme: 80, tier: 80, format: 220, role: 5000, cta: 220,
  visual: 5000, source: 500, fallback: 2000, kpi: 500, task: 2000,
  copy: 10000, optionGroup: 80, optionLabel: 220, calendarTime: 20,
  calendarLocation: 220, calendarCost: 500
});

export const PUBLICATION_TEMPLATES = Object.freeze({
  educational: { label: "Capsule éducative", theme: "Éducation", tier: "Pilier", format: "Affiche éducative + légende bilingue", cta: "Découvrir et partager" },
  nature: { label: "Zoom nature", theme: "Nature", tier: "Pilier", format: "Photo réelle ou planche naturaliste + légende bilingue", cta: "Observer avec nous" },
  community: { label: "Communauté", theme: "Communauté", tier: "Passerelle", format: "Photo réelle + récit bilingue", cta: "Participer à la conversation" },
  heritage: { label: "Patrimoine", theme: "Patrimoine", tier: "Pilier", format: "Archive vérifiée + récit bilingue", cta: "Partager un souvenir" },
  quiz: { label: "Quiz du lac", theme: "Interaction", tier: "Passerelle", format: "Question visuelle + réponse + lien vers le quiz", cta: "Jouer au quiz du lac" },
  blank: { label: "Publication libre", theme: "Actualité", tier: "Passerelle", format: "Publication bilingue", cta: "En savoir plus" }
});

const cleanText = (value, limit, fallback = "") => String(value ?? fallback).trim().slice(0, limit);
const cleanList = (value) => (Array.isArray(value) ? value : String(value || "").split(/\r?\n/))
  .map((item) => cleanText(item, 1000)).filter(Boolean).slice(0, 8);
const isoPattern = /^\d{4}-\d{2}-\d{2}$/;

export function frenchDateLabel(dateIso) {
  if (!isoPattern.test(String(dateIso || ""))) return "";
  const [year, month, day] = dateIso.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day, 12));
  const text = new Intl.DateTimeFormat("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function weekForDate(dateIso, startDateIso) {
  if (!isoPattern.test(String(dateIso || "")) || !isoPattern.test(String(startDateIso || ""))) return 1;
  const date = Date.parse(`${dateIso}T12:00:00Z`);
  const start = Date.parse(`${startDateIso}T12:00:00Z`);
  return Math.max(1, Math.floor((date - start) / 604800000) + 1);
}

export function publicationIdFrom({ title = "publication", dateIso = "" } = {}) {
  const slug = String(title).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 42) || "publication";
  const date = isoPattern.test(dateIso) ? dateIso.replaceAll("-", "") : "sans-date";
  return `pub-${date}-${slug}`.slice(0, 80);
}

export function uniquePublicationId(input = {}, existingIds = []) {
  const base = publicationIdFrom(input);
  const used = new Set(Array.from(existingIds || [], (value) => String(value || "").trim().toLowerCase()).filter(Boolean));
  if (!used.has(base.toLowerCase())) return base;
  for (let index = 2; index <= 9999; index += 1) {
    const suffix = `-${index}`;
    const stem = base.slice(0, 80 - suffix.length).replace(/-+$/g, "");
    const candidate = `${stem}${suffix}`;
    if (!used.has(candidate.toLowerCase())) return candidate;
  }
  throw new Error("Impossible de produire un identifiant unique pour cette publication.");
}

export function resolvePublicationId({ draft = {}, existingIds = [], stableId = "" } = {}) {
  const locked = cleanText(stableId, 80);
  return locked || uniquePublicationId(draft, existingIds);
}

export function validatePublicationDraft(input) {
  const errors = [];
  if (!cleanText(input?.title, TEXT_LIMITS.title)) errors.push("Le titre est obligatoire.");
  if (!isoPattern.test(String(input?.dateIso || ""))) errors.push("La date doit utiliser le format AAAA-MM-JJ.");
  if (!cleanText(input?.copy, TEXT_LIMITS.copy)) errors.push("Le texte de publication est obligatoire.");
  if (String(input?.copy || "").length > TEXT_LIMITS.copy) errors.push("Le texte dépasse la limite permise.");
  if (String(input?.copy || "") && !/\bFR\s*[—-]/i.test(String(input.copy))) errors.push("La version française doit commencer par « FR — ».");
  if (String(input?.copy || "") && !/\bEN\s*[—-]/i.test(String(input.copy))) errors.push("La version anglaise doit commencer par « EN — ».");
  const duration = Number(input?.calendarDurationMinutes || 60);
  if (!Number.isInteger(duration) || duration < 1 || duration > 1440) errors.push("La durée doit être comprise entre 1 et 1 440 minutes.");
  const week = Number(input?.week || 1);
  if (!Number.isInteger(week) || week < 1 || week > 260) errors.push("Le numéro de semaine est invalide.");
  return errors;
}

export function normalizePublicationDraft(input = {}, { startDateIso = input.dateIso || "", existing = null } = {}) {
  const template = PUBLICATION_TEMPLATES[input.templateId] || PUBLICATION_TEMPLATES.blank;
  const dateIso = cleanText(input.dateIso, 10);
  const week = Number.isInteger(Number(input.week)) && Number(input.week) > 0
    ? Number(input.week)
    : weekForDate(dateIso, startDateIso || dateIso);
  return {
    id: cleanText(input.id || existing?.id || publicationIdFrom(input), 80),
    title: cleanText(input.title, TEXT_LIMITS.title),
    dateIso,
    date: frenchDateLabel(dateIso),
    theme: cleanText(input.theme, TEXT_LIMITS.theme, template.theme),
    week,
    tier: cleanText(input.tier, TEXT_LIMITS.tier, template.tier),
    format: cleanText(input.format, TEXT_LIMITS.format, template.format),
    role: cleanText(input.role, TEXT_LIMITS.role),
    cta: cleanText(input.cta, TEXT_LIMITS.cta, template.cta),
    visual: cleanText(input.visual, TEXT_LIMITS.visual),
    source: cleanText(input.source, TEXT_LIMITS.source),
    fallback: cleanText(input.fallback, TEXT_LIMITS.fallback),
    kpi: cleanText(input.kpi, TEXT_LIMITS.kpi),
    task: cleanText(input.task, TEXT_LIMITS.task),
    copy: cleanText(input.copy, TEXT_LIMITS.copy),
    tasksValentin: cleanList(input.tasksValentin),
    tasksAnnie: cleanList(input.tasksAnnie),
    calendarTime: cleanText(input.calendarTime, TEXT_LIMITS.calendarTime, "08:00"),
    calendarDurationMinutes: Math.min(1440, Math.max(1, Number.parseInt(input.calendarDurationMinutes || 60, 10) || 60)),
    calendarLocation: cleanText(input.calendarLocation, TEXT_LIMITS.calendarLocation),
    calendarCost: cleanText(input.calendarCost, TEXT_LIMITS.calendarCost, "Gratuit"),
    choiceRequired: input.choiceRequired === true,
    optionGroup: cleanText(input.optionGroup, TEXT_LIMITS.optionGroup),
    optionLabel: cleanText(input.optionLabel, TEXT_LIMITS.optionLabel),
    isAlternative: input.isAlternative === true,
    archivedEditorial: input.archivedEditorial === true,
    originId: cleanText(input.originId || existing?.originId || "", 80),
    templateId: cleanText(input.templateId || existing?.templateId || "blank", 80)
  };
}

export function schedulePayloadFromDraft(draft, current = {}) {
  const normalized = normalizePublicationDraft(draft, { existing: current });
  const currentEditorial = current.editorial && typeof current.editorial === "object" ? current.editorial : {};
  return {
    title: normalized.title,
    dateKey: normalized.date,
    dateIso: normalized.dateIso,
    format: normalized.format,
    role: normalized.role,
    cta: normalized.cta,
    source: normalized.source,
    tasksValentin: normalized.tasksValentin,
    tasksAnnie: normalized.tasksAnnie,
    calendarTime: normalized.calendarTime,
    calendarDurationMinutes: normalized.calendarDurationMinutes,
    calendarLocation: normalized.calendarLocation,
    calendarCost: normalized.calendarCost,
    status: ["approved", "needs_work", "pending", "deleted"].includes(current.status) ? current.status : "pending",
    deleted: current.status === "deleted" || current.deleted === true,
    selected: typeof current.selected === "boolean" ? current.selected : !normalized.choiceRequired,
    editorial: {
      revision: Number(currentEditorial.revision || 0) + 1,
      theme: normalized.theme,
      week: normalized.week,
      tier: normalized.tier,
      visual: normalized.visual,
      copy: normalized.copy,
      fallback: normalized.fallback,
      kpi: normalized.kpi,
      task: normalized.task,
      choiceRequired: normalized.choiceRequired,
      optionGroup: normalized.optionGroup,
      optionLabel: normalized.optionLabel,
      isAlternative: normalized.isAlternative,
      archivedEditorial: normalized.archivedEditorial,
      originId: normalized.originId,
      templateId: normalized.templateId,
      createdBy: currentEditorial.createdBy || "",
      createdAt: currentEditorial.createdAt || null
    }
  };
}

export function publicationFromScheduleRow(row = {}) {
  const editorial = row.editorial && typeof row.editorial === "object" ? row.editorial : {};
  return normalizePublicationDraft({
    id: row.id,
    title: row.title,
    dateIso: row.dateIso,
    theme: editorial.theme,
    week: editorial.week,
    tier: editorial.tier,
    format: row.format,
    role: row.role,
    cta: row.cta,
    visual: editorial.visual,
    source: row.source,
    fallback: editorial.fallback,
    kpi: editorial.kpi,
    task: editorial.task,
    copy: editorial.copy,
    tasksValentin: row.tasksValentin,
    tasksAnnie: row.tasksAnnie,
    calendarTime: row.calendarTime,
    calendarDurationMinutes: row.calendarDurationMinutes,
    calendarLocation: row.calendarLocation,
    calendarCost: row.calendarCost,
    choiceRequired: editorial.choiceRequired,
    optionGroup: editorial.optionGroup,
    optionLabel: editorial.optionLabel,
    isAlternative: editorial.isAlternative,
    archivedEditorial: editorial.archivedEditorial,
    originId: editorial.originId,
    templateId: editorial.templateId
  });
}

export function mergePublication(base = {}, row = {}) {
  if (!row?.editorial || typeof row.editorial !== "object") return { ...base };
  const edited = publicationFromScheduleRow(row);
  return {
    ...base,
    ...edited,
    id: row.id || base.id,
    t: edited.theme,
    w: edited.week,
    date: edited.date,
    dateIso: edited.dateIso,
    archivedEditorial: edited.archivedEditorial
  };
}

export function mergePostsWithScheduleRows(basePosts = [], rows = []) {
  const rowMap = new Map(rows.map((row) => [row.id, row]));
  const merged = basePosts.map((post) => mergePublication(post, rowMap.get(post.id)));
  const known = new Set(basePosts.map((post) => post.id));
  rows.filter((row) => !known.has(row.id) && row.editorial && typeof row.editorial === "object")
    .forEach((row) => merged.push(mergePublication({}, row)));
  return merged.sort((left, right) => String(left.dateIso || "").localeCompare(String(right.dateIso || "")) || String(left.id).localeCompare(String(right.id)));
}

export function editorialRowsSignature(rows = []) {
  return JSON.stringify(rows.filter((row) => row.editorial).map((row) => [row.id, row.dateIso, row.editorial?.revision, row.editorial?.archivedEditorial]));
}
