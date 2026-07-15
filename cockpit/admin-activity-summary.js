const TIME_ZONE = "America/Toronto";
let currentLogs = [];

const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;" })[character]);

function ensureStyles() {
  if (document.querySelector("#cockpit-activity-styles")) return;
  const style = document.createElement("style");
  style.id = "cockpit-activity-styles";
  style.textContent = `
    #cockpit-director-activity{margin:0 0 22px;padding:14px;border:1px solid #cbe1e4;border-radius:18px;background:linear-gradient(145deg,#eef9fa,#f9fcfc);box-shadow:0 8px 22px rgba(7,58,82,.06)}
    .cockpit-activity-heading{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.cockpit-activity-heading h2{margin:2px 0 4px!important;font-size:1.05rem!important}.cockpit-activity-heading p{margin:0;color:#55727c;font-size:.75rem}.cockpit-activity-heading strong{color:#073a52}.cockpit-activity-kicker{color:#147d8e;font-size:.63rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase}
    .cockpit-activity-metrics{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin:12px 0 8px}.cockpit-activity-metrics span{min-width:0;padding:8px;border-radius:11px;color:#58717a;background:rgba(255,255,255,.82);font-size:.66rem;line-height:1.2}.cockpit-activity-metrics b{display:block;color:#073a52;font-size:1.2rem;line-height:1}
    .cockpit-activity-chart{display:block;width:100%;height:auto;overflow:visible}.cockpit-activity-chart line{stroke:#b9d4d9;stroke-width:1}.cockpit-activity-chart text{fill:#66818a;font:9px Aptos,Inter,system-ui,sans-serif}.cockpit-activity-action-bar{fill:#de806e}
    .cockpit-activity-legend{display:flex;flex-wrap:wrap;gap:5px 10px;color:#5c747d;font-size:.63rem}.cockpit-activity-legend i{display:inline-block;width:8px;height:8px;margin-right:3px;border-radius:2px;vertical-align:-1px}.cockpit-activity-legend i.actions{background:#de806e}
    .cockpit-activity-insights{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;margin-top:9px}.cockpit-activity-insights span{min-width:0;overflow-wrap:anywhere;color:#55727c;font-size:.61rem}.cockpit-activity-insights b{display:block;margin-bottom:2px;color:#164f63;font-size:.56rem;letter-spacing:.03em;text-transform:uppercase}
    .cockpit-activity-cost{margin:9px 0 0;padding-top:8px;border-top:1px solid #d7e9eb;color:#71868d;font-size:.61rem;line-height:1.35}.cockpit-activity-loading{margin:0;color:#55727c;font-size:.75rem}
    [data-theme="dark"] #cockpit-director-activity{border-color:#587984;background:linear-gradient(145deg,#183743,#152c36);box-shadow:none}[data-theme="dark"] .cockpit-activity-heading :is(h2,strong),[data-theme="dark"] .cockpit-activity-metrics b{color:#e9f8fa!important}[data-theme="dark"] :is(.cockpit-activity-heading p,.cockpit-activity-metrics span,.cockpit-activity-legend,.cockpit-activity-insights span,.cockpit-activity-cost){color:#c3d8dd}[data-theme="dark"] .cockpit-activity-insights b{color:#a6e5ec}[data-theme="dark"] .cockpit-activity-metrics span{background:#1c3944}[data-theme="dark"] .cockpit-activity-chart line{stroke:#587984}[data-theme="dark"] .cockpit-activity-chart text{fill:#c3d8dd}[data-theme="dark"] .cockpit-activity-cost{border-top-color:#52727d}`;
  document.head.appendChild(style);
}

function timestampDate(value) {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  const parsed = new Date(value || 0);
  return Number.isNaN(parsed.valueOf()) ? null : parsed;
}

function relativeTime(value, now = new Date()) {
  const date = timestampDate(value);
  if (!date) return "Aucune action enregistrée";
  const minutes = Math.max(0, Math.round((now - date) / 60000));
  if (minutes < 2) return "À l’instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  return date.toLocaleString("fr-CA", { timeZone: TIME_ZONE, dateStyle: "medium", timeStyle: "short" });
}

function isDirectionLog(log) {
  const label = String(log.userLabel || "").toLocaleLowerCase("fr");
  return label.includes("annie") || label.includes("direction générale") || label.includes("directrice générale");
}

function actionCategory(log) {
  const text = `${log.action || ""} ${log.sectionId || ""}`.toLocaleLowerCase("fr");
  if (/comment|consigne|rétroaction|avis|recommandation/.test(text)) return "commentaires";
  if (/média|media|visuel|image/.test(text)) return "médias";
  if (/approuv|valid|statut|workflow|décision|choix/.test(text)) return "validations";
  return "autres";
}

function activityRows(logs, now = new Date()) {
  const threshold = now.valueOf() - 48 * 3600000;
  return logs.filter(isDirectionLog).map((log) => ({ ...log, when: timestampDate(log.createdAt) })).filter((log) => log.when && log.when.valueOf() >= threshold).sort((left, right) => left.when - right.when);
}

function timeline48Hours(rows, now = new Date()) {
  const keys = new Map();
  rows.forEach((row) => {
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", hourCycle:"h23" }).format(row.when);
    keys.set(key, (keys.get(key) || 0) + 1);
  });
  return Array.from({ length: 48 }, (_, index) => {
    const date = new Date(now.valueOf() - (47 - index) * 3600000);
    const key = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", hourCycle:"h23" }).format(date);
    return { date, count: keys.get(key) || 0 };
  });
}

function chart(rows) {
  const baseline = 54;
  const maxValue = Math.max(1, ...rows.map((row) => row.count));
  const bars = rows.map((row, index) => {
    const x = 4 + index * 9.8;
    const height = Math.round(36 * row.count / maxValue);
    const title = `${row.date.toLocaleString("fr-CA", { timeZone: TIME_ZONE, weekday:"short", hour:"2-digit" })} — ${row.count} action${row.count > 1 ? "s" : ""}`;
    return `<g><title>${esc(title)}</title><rect class="cockpit-activity-action-bar" x="${x.toFixed(1)}" y="${baseline - height}" width="6" height="${height}" rx="2"/></g>`;
  }).join("");
  const labels = [0, 12, 24, 36, 47].map((index) => {
    const row = rows[index];
    const x = 4 + index * 9.8;
    const label = row.date.toLocaleString("fr-CA", { timeZone: TIME_ZONE, weekday:"short", hour:"2-digit" }).replace(" h", "h");
    return `<text x="${x.toFixed(1)}" y="72" text-anchor="${index === 0 ? "start" : index === 47 ? "end" : "middle"}">${esc(label)}</text>`;
  }).join("");
  return `<svg class="cockpit-activity-chart" viewBox="0 0 480 78" role="img" aria-label="Actions de la Direction enregistrées au cours des 48 dernières heures"><line x1="4" y1="54.5" x2="476" y2="54.5"/><g>${bars}</g><g>${labels}</g></svg>`;
}

function render() {
  const host = document.querySelector("#cockpit-director-activity");
  if (!host) return;
  ensureStyles();
  host.setAttribute("aria-label", "Statistiques d’activité de la Direction");
  const now = new Date();
  const directionLogs = currentLogs.filter(isDirectionLog).map((log) => ({ ...log, when: timestampDate(log.createdAt) })).filter((log) => log.when).sort((left, right) => right.when - left.when);
  const recent = activityRows(currentLogs, now);
  const categories = recent.reduce((result, log) => {
    result[actionCategory(log)] += 1;
    return result;
  }, { commentaires:0, validations:0, médias:0, autres:0 });
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year:"numeric", month:"2-digit", day:"2-digit" }).format(now);
  const todayCount = recent.filter((log) => new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE, year:"numeric", month:"2-digit", day:"2-digit" }).format(log.when) === todayKey).length;
  const lastAction = directionLogs[0] || null;
  const topSection = [...recent.reduce((result, log) => result.set(String(log.sectionId || "Cockpit"), (result.get(String(log.sectionId || "Cockpit")) || 0) + 1), new Map()).entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || "—";
  const peakHour = [...recent.reduce((result, log) => {
    const hour = log.when.toLocaleTimeString("fr-CA", { timeZone:TIME_ZONE, hour:"2-digit", hour12:false });
    result.set(hour, (result.get(hour) || 0) + 1);
    return result;
  }, new Map()).entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || "—";
  const dominantCategory = Object.entries(categories).sort((left, right) => right[1] - left[1])[0];
  host.innerHTML = `
    <div class="cockpit-activity-heading">
      <div><span class="cockpit-activity-kicker">Activité opérationnelle · 48 heures</span><h2>Activité de la Direction</h2><p>Dernière action : <strong>${esc(relativeTime(lastAction?.when, now))}</strong></p></div>
    </div>
    <div class="cockpit-activity-metrics">
      <span><b>${todayCount}</b>actions aujourd’hui</span>
      <span><b>${recent.length}</b>actions sur 48 h</span>
      <span><b>${categories.validations + categories.médias}</b>validations et médias</span>
      <span><b>${categories.commentaires}</b>commentaires et consignes</span>
    </div>
    ${chart(timeline48Hours(recent, now))}
    <div class="cockpit-activity-legend"><span><i class="actions"></i> Actions enregistrées dans le cockpit</span><span>${categories.autres} autre${categories.autres > 1 ? "s" : ""}</span></div>
    <div class="cockpit-activity-insights"><span><b>Sujet le plus actif</b>${esc(topSection)}</span><span><b>Heure la plus active</b>${esc(peakHour)}</span><span><b>Type dominant</b>${dominantCategory?.[1] ? esc(dominantCategory[0]) : "—"}</span></div>
    <p class="cockpit-activity-cost">Résumé calculé localement à partir des 100 dernières entrées du journal déjà chargées : aucune lecture, écriture ou écoute Firebase supplémentaire. Une consultation sans action n’est volontairement pas mesurée.</p>`;
}

export function setAdminActivityLogs(logs) {
  currentLogs = Array.isArray(logs) ? logs : [];
  render();
}

export function clearAdminActivitySummary() {
  currentLogs = [];
  document.querySelector("#cockpit-director-activity")?.replaceChildren();
}

export function renderAdminActivitySummary() {
  render();
}
