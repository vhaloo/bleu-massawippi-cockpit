import {
  getClientState,
  fetchPrivateContent,
  observeAuth,
  signIn,
  sendPasswordReset,
  logOut,
  subscribeScheduleItems,
  upsertScheduleItem,
  setScheduleSelection,
  addComment,
  writeAuditLog,
  subscribeAuditLogs,
  addCockpitFeedback,
  subscribeCockpitFeedback,
  updateCockpitFeedbackStatus,
  upsertActionTask,
  completeActionTask,
  subscribeActionTasks,
  uploadImageAttachment,
  subscribeImageAttachments,
  MAX_ATTACHMENT_BYTES
} from "./firebase-client.js?v=20260711-auth-fix-v1";
import { applyPlanOverridesToPosts } from "./plan-overrides.js";

const { configured } = getClientState();
// Le volet visuel est conservé dans le dépôt pour une reprise ultérieure, mais
// reste volontairement suspendu afin que le cockpit demeure entièrement textuel.
const IMAGE_ATTACHMENTS_ENABLED = false;
const demoMode = new URLSearchParams(location.search).get("demo") === "1";
const state = { user: null, profile: null, rows: new Map(), attachments: [], tasks: [], auditUnsubscribe: null, feedbackUnsubscribe: null, tasksUnsubscribe: null, attachmentUnsubscribe: null, scheduleUnsubscribe: null, contentLoaded: false };
let pastEventsVisible = false;
let activeRecognition = null;
let activeTextarea = null;
let recognitionRestart = false;
let recognitionRestartTimer = null;
let recognitionWatchdogTimer = null;
let recognitionPermissionPromise = null;
let recognitionLanguageIndex = 0;
let recognitionRestartAttempts = 0;
const recognitionLanguages = ["fr-CA", "fr-FR", "fr", "en-CA", "en-US"];
const terminalRecognitionErrors = new Set(["not-allowed", "service-not-allowed", "audio-capture", "network"]);

const style = document.createElement("style");
style.textContent = `
  body.cockpit-locked > *:not(#cockpit-login) { filter: blur(5px); pointer-events: none; user-select: none; }
  #cockpit-login { position: fixed; inset: 0; z-index: 1000; display: grid; place-items: center; padding: 24px; background: rgba(5, 35, 51, .72); backdrop-filter: blur(14px); }
  #cockpit-login[hidden] { display: none; }
  button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible, a:focus-visible { outline: 3px solid #2ab6bb; outline-offset: 3px; }
  .cockpit-login-card { width: min(450px, 100%); padding: 30px; border: 1px solid rgba(255,255,255,.35); border-radius: 24px; color: #102f3f; background: #f8fcfc; box-shadow: 0 30px 70px rgba(0,0,0,.25); }
  .cockpit-login-card h2 { margin: 0 0 7px; color: #073a52; font-size: 2rem; letter-spacing: -.04em; }
  .cockpit-login-card p { color: #54717d; }
  .cockpit-login-card label { display: grid; gap: 5px; margin-top: 13px; color: #315564; font-size: .82rem; font-weight: 800; }
  .cockpit-login-card input { min-height: 44px; padding: 0 12px; border: 1px solid #cfe3e6; border-radius: 10px; color: #102f3f; background: white; }
  .cockpit-login-card button { width: 100%; min-height: 45px; margin-top: 17px; border: 0; border-radius: 11px; color: white; background: #073a52; font-weight: 850; cursor: pointer; }
  .cockpit-login-error { min-height: 20px; margin-top: 10px; color: #a33f35; font-size: .83rem; }
  .cockpit-login-note { margin-top: 17px; padding: 11px; border-radius: 11px; color: #486874; background: #edf7f7; font-size: .78rem; }
  .cockpit-login-reset { display: block; width: 100%; margin-top: 9px; padding: 0; border: 0; color: #0b657d; background: transparent; font-size: .78rem; font-weight: 800; text-align: center; text-decoration: underline; cursor: pointer; }
  #cockpit-session { position: sticky; top: 0; z-index: 20; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px max(16px, calc((100% - 1280px) / 2)); color: #e9fbfb; background: #073a52; font-size: .82rem; box-shadow: 0 7px 18px rgba(7,58,82,.16); }
  #cockpit-session strong { color: white; }
  #cockpit-session button { padding: 6px 10px; border: 1px solid rgba(255,255,255,.38); border-radius: 999px; color: #fff; background: transparent; font-size: .76rem; font-weight: 800; cursor: pointer; }
  .cockpit-toast { position: fixed; right: 20px; bottom: 20px; z-index: 1100; max-width: 360px; padding: 12px 15px; border-radius: 13px; color: white; background: #073a52; box-shadow: 0 10px 28px rgba(0,0,0,.2); font-size: .84rem; }
  .cockpit-toast.error { background: #9a4035; }
  .cockpit-controls { margin: 2px 16px 13px 20px; padding: 11px; border: 1px solid #d6e8ea; border-radius: 13px; background: #f7fbfb; }
  .cockpit-status-row, .cockpit-comment-row, .cockpit-quick-row { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .cockpit-status-row button, .cockpit-quick-row button { padding: 5px 8px; border: 1px solid #d1e3e6; border-radius: 999px; color: #3f6370; background: #fff; font-size: .71rem; font-weight: 800; cursor: pointer; }
  .cockpit-controls button:disabled, .cockpit-controls textarea:disabled, .cockpit-controls input:disabled { cursor: not-allowed; opacity: .56; }
  body.cockpit-readonly .cockpit-controls { background: #f3f6f6; }
  .cockpit-status-row button.active { border-color: #0b7895; color: #fff; background: #0b7895; }
  .cockpit-status-row button[data-status="needs_work"].active { border-color: #b27a1a; background: #b27a1a; }
  .cockpit-status-row button[data-status="deleted"] { margin-left: auto; color: #9a4035; }
  .cockpit-comment-row { margin-top: 8px; align-items: stretch; }
  .cockpit-comment-row textarea { flex: 1; min-width: 180px; min-height: 46px; padding: 8px; resize: vertical; border: 1px solid #d1e3e6; border-radius: 9px; color: #264a58; background: #fff; font: inherit; font-size: .78rem; }
  .cockpit-comment-row button { min-width: 40px; padding: 7px; border: 1px solid #d1e3e6; border-radius: 9px; color: #073a52; background: #fff; font-weight: 850; cursor: pointer; }
  .cockpit-comment-row button.save { color: #fff; background: #0b7895; }
  .cockpit-quick-row { margin-top: 7px; }
  .cockpit-quick-row button[data-tag="cancel"] { color: #9a4035; }
  .cockpit-quick-row button[data-tag="delay"] { color: #956a16; }
  .cockpit-quick-row button[data-tag="perfect"] { color: #26705f; }
  .cockpit-choice-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; padding: 8px 10px; border: 1px solid #bfe1e3; border-radius: 10px; color: #0b6077; background: #ecf9f9; font-size: .78rem; font-weight: 800; }
  .cockpit-choice-row input { width: 17px; height: 17px; accent-color: #0b7895; }
  .cockpit-choice-row small { margin-left: auto; color: #527783; font-size: .7rem; font-weight: 600; }
  .post.choice-unselected { border-style: dashed; opacity: .72; }
  .post.choice-selected { box-shadow: 0 0 0 2px rgba(42,182,187,.2), 0 7px 20px rgba(7,58,82,.04); }
  .cockpit-voice-status { min-height: 18px; margin-top: 4px; color: #54717d; font-size: .7rem; }
  .cockpit-voice-status.live { color: #0b7895; font-weight: 800; }
  .cockpit-voice-status.error { color: #9a4035; }
  .cockpit-voice-help { flex-basis: 100%; color: #6b858d; font-size: .68rem; line-height: 1.35; }
  .cockpit-attachments { margin-top: 14px; padding-top: 13px; border-top: 1px solid #d6e8ea; }
  .cockpit-attachments-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 6px; margin-bottom: 9px; }
  .cockpit-attachments-head b { color: #073a52; font-size: .8rem; }
  .cockpit-attachments-head span { color: #6b858d; font-size: .68rem; }
  .cockpit-attachment-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(116px, 1fr)); gap: 9px; margin-bottom: 9px; }
  .cockpit-attachment { position: relative; overflow: hidden; min-width: 0; border: 1px solid #cbe1e4; border-radius: 11px; background: #eef7f7; }
  .cockpit-attachment a { display: block; color: inherit; text-decoration: none; }
  .cockpit-attachment img { display: block; width: 100%; aspect-ratio: 4 / 5; object-fit: cover; background: #dcecee; }
  .cockpit-attachment figcaption { padding: 6px 7px 7px; color: #54717d; font-size: .64rem; line-height: 1.25; }
  .cockpit-attachment figcaption strong { display: block; overflow: hidden; color: #315564; text-overflow: ellipsis; white-space: nowrap; }
  .cockpit-attachment-empty { grid-column: 1 / -1; margin: 0; color: #78919a; font-size: .72rem; }
  .cockpit-attachment-upload { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
  .cockpit-attachment-upload input { max-width: 100%; padding: 6px; border: 1px dashed #a9cfd3; border-radius: 9px; color: #315564; background: #f8fcfc; font-size: .71rem; }
  .cockpit-attachment-note { margin: 6px 0 0; color: #6b858d; font-size: .67rem; line-height: 1.35; }
  .cockpit-attachment-status { flex-basis: 100%; min-height: 17px; color: #54717d; font-size: .69rem; }
  .cockpit-attachment-status.error { color: #9a4035; }
  .cockpit-attachment-status.success { color: #26705f; }
  .cockpit-past-toggle { margin-left: auto; padding: 7px 10px; border: 1px solid #b9d7da; border-radius: 999px; color: #315564; background: #f8fcfc; font-size: .72rem; font-weight: 800; cursor: pointer; }
  .cockpit-past-toggle.active { color: #fff; background: #0b7895; border-color: #0b7895; }
  .day-group.cockpit-past-visible { opacity: .82; }
  .cockpit-past-badge { margin-left: 8px; padding: 3px 7px; border-radius: 999px; color: #6b858d; background: #eef3f3; font-size: .65rem; font-weight: 800; }
  #cockpit-past-empty { margin: 12px 0; padding: 14px; border: 1px dashed #b9d7da; border-radius: 13px; color: #54717d; background: #f8fcfc; font-size: .78rem; }
  #cockpit-feedback-launch { position: fixed; left: 15px; bottom: 15px; z-index: 31; min-height: 42px; padding: 0 14px; border: 1px solid #073a52; border-radius: 999px; color: #fff; background: #073a52; box-shadow: 0 8px 22px rgba(7,58,82,.2); font-weight: 850; cursor: pointer; }
  #cockpit-feedback-panel { position: fixed; left: 15px; bottom: 68px; z-index: 32; display: none; width: min(390px, calc(100vw - 30px)); padding: 16px; border: 1px solid #cbe1e4; border-radius: 18px; color: #234b5a; background: #f8fcfc; box-shadow: 0 18px 42px rgba(7,58,82,.2); }
  #cockpit-feedback-panel.open { display: block; }
  #cockpit-feedback-panel h2 { margin: 0 0 5px; color: #073a52; font-size: 1.05rem; }
  #cockpit-feedback-panel p { margin: 0 0 10px; color: #587680; font-size: .76rem; }
  #cockpit-feedback-panel select, #cockpit-feedback-panel textarea { width: 100%; padding: 8px; border: 1px solid #d1e3e6; border-radius: 9px; color: #264a58; background: #fff; font: inherit; font-size: .78rem; }
  #cockpit-feedback-panel textarea { min-height: 92px; resize: vertical; }
  #cockpit-feedback-panel button[data-submit-feedback] { width: 100%; margin-top: 8px; padding: 9px; border: 0; border-radius: 9px; color: #fff; background: #0b7895; font-weight: 850; cursor: pointer; }
  .section-feedback { margin: 14px 0 18px; padding: 13px 15px; border: 1px solid #d6e8ea; border-radius: 14px; background: rgba(245,251,251,.92); }
  .section-feedback summary { padding: 0; font-size: .8rem; }
  .section-feedback summary:after { content: ""; }
  .section-feedback[open] summary { margin-bottom: 8px; }
  .section-feedback textarea { width: 100%; min-height: 62px; padding: 8px; border: 1px solid #d1e3e6; border-radius: 9px; color: #264a58; background: #fff; font: inherit; font-size: .78rem; resize: vertical; }
  .section-feedback .feedback-actions { display: flex; gap: 7px; align-items: center; margin-top: 7px; }
  .section-feedback select { padding: 7px; border: 1px solid #d1e3e6; border-radius: 8px; color: #315564; background: #fff; font-size: .74rem; }
  .section-feedback button { padding: 7px 10px; border: 0; border-radius: 8px; color: #fff; background: #0b7895; font-size: .74rem; font-weight: 800; cursor: pointer; }
  .section-feedback .feedback-note { margin: 5px 0 0; color: #6b858d; font-size: .7rem; }
  #cockpit-feedback-list { margin-top: 14px; }
  .cockpit-feedback-item { padding: 9px 0; border-top: 1px solid #d6e8ea; color: #4f6c77; font-size: .74rem; }
  .cockpit-feedback-item b { display: block; color: #073a52; }
  .cockpit-feedback-item p { margin: 3px 0; white-space: pre-wrap; }
  .cockpit-feedback-item button { margin-right: 4px; padding: 4px 7px; border: 1px solid #cbe1e4; border-radius: 7px; color: #315564; background: #fff; font-size: .68rem; cursor: pointer; }
  .post.is-deleted { display: none; }
  body.cockpit-admin .post.is-deleted { display: block; opacity: .45; }
  .cockpit-admin .post.is-deleted h4 { text-decoration: line-through; }
  #cockpit-sidebar { position: fixed; top: 45px; right: 0; bottom: 0; z-index: 30; width: min(390px, 94vw); padding: 18px; overflow: auto; border-left: 1px solid #cbe1e4; background: #f8fcfc; box-shadow: -15px 0 35px rgba(7,58,82,.13); transform: translateX(100%); transition: transform .22s ease; }
  #cockpit-sidebar.open { transform: translateX(0); }
  #cockpit-sidebar h2 { margin: 0; color: #073a52; font-size: 1.2rem; }
  #cockpit-task-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  #cockpit-task-count { display: inline-grid; min-width: 25px; height: 25px; padding: 0 6px; place-items: center; border-radius: 999px; color: #fff; background: #c26b50; font-size: .75rem; }
  #cockpit-task-list { margin: 10px 0 22px; }
  .cockpit-task-empty { margin: 8px 0 0; color: #587680; font-size: .76rem; }
  .cockpit-task-item { margin-top: 8px; padding: 10px; border: 1px solid #d6e8ea; border-radius: 11px; background: #fff; }
  .cockpit-task-item b { display: block; color: #073a52; font-size: .78rem; }
  .cockpit-task-item p { margin: 4px 0 7px; color: #587680; font-size: .72rem; line-height: 1.38; white-space: pre-wrap; }
  .cockpit-task-item small { display: block; margin-bottom: 7px; color: #78919a; font-size: .66rem; }
  .cockpit-task-actions { display: flex; gap: 6px; }
  .cockpit-task-actions button { padding: 5px 7px; border: 1px solid #cbe1e4; border-radius: 7px; color: #315564; background: #fff; font-size: .68rem; font-weight: 800; cursor: pointer; }
  .cockpit-task-actions button[data-complete-task] { border-color: #0b7895; color: #fff; background: #0b7895; }
  #cockpit-task-launch { position: fixed; right: 15px; bottom: 68px; z-index: 31; min-height: 42px; padding: 0 13px; border: 1px solid #073a52; border-radius: 999px; color: #fff; background: #073a52; box-shadow: 0 8px 22px rgba(7,58,82,.2); font-weight: 850; cursor: pointer; }
  #cockpit-task-launch[data-has-tasks="true"] { background: #c26b50; }
  #cockpit-debug-launch { position: fixed; right: 15px; bottom: 174px; z-index: 31; min-height: 36px; padding: 0 11px; border: 1px solid #8eaab1; border-radius: 999px; color: #315564; background: #eef5f5; box-shadow: 0 8px 22px rgba(7,58,82,.14); font-size: .72rem; font-weight: 850; cursor: pointer; }
  #cockpit-debug-launch[data-has-errors="true"] { border-color: #c26b50; color: #fff; background: #9a4035; }
  #cockpit-debug-panel { position: fixed; right: 15px; bottom: 219px; z-index: 32; display: none; width: min(480px, calc(100vw - 30px)); max-height: min(460px, calc(100vh - 250px)); overflow: hidden; border: 1px solid #b9cfd3; border-radius: 16px; color: #284c59; background: #f8fcfc; box-shadow: 0 18px 42px rgba(7,58,82,.22); }
  #cockpit-debug-panel.open { display: block; }
  .cockpit-debug-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 11px 13px; border-bottom: 1px solid #d6e8ea; background: #edf6f6; }
  .cockpit-debug-head strong { color: #073a52; font-size: .8rem; }
  .cockpit-debug-actions { display: flex; gap: 5px; }
  .cockpit-debug-actions button { padding: 4px 7px; border: 1px solid #cbe1e4; border-radius: 7px; color: #315564; background: #fff; font-size: .67rem; font-weight: 800; cursor: pointer; }
  #cockpit-debug-list { max-height: 380px; overflow: auto; padding: 9px 12px; }
  .cockpit-debug-line { padding: 7px 0; border-bottom: 1px solid #e0ecee; font-size: .68rem; line-height: 1.35; white-space: pre-wrap; overflow-wrap: anywhere; }
  .cockpit-debug-line b { margin-right: 5px; color: #78919a; font-size: .62rem; }
  .cockpit-debug-line.error strong { color: #9a4035; }
  .cockpit-debug-line.warn strong { color: #956a16; }
  .cockpit-debug-empty { margin: 3px 0; color: #6b858d; font-size: .7rem; }
  .task-focus { outline: 3px solid #2ab6bb; outline-offset: 5px; animation: cockpit-task-pulse 1.4s ease; }
  @keyframes cockpit-task-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(42,182,187,0); } 35% { box-shadow: 0 0 0 8px rgba(42,182,187,.23); } }
  #cockpit-install-launch { position: fixed; right: 15px; bottom: 121px; z-index: 31; display: flex; align-items: center; gap: 8px; max-width: min(340px, calc(100vw - 30px)); padding: 10px 12px; border: 1px solid #b9dde2; border-radius: 14px; color: #073a52; background: #f8fcfc; box-shadow: 0 11px 28px rgba(7,58,82,.16); font-size: .76rem; }
  #cockpit-install-launch[hidden] { display: none; }
  #cockpit-install-launch p { margin: 0; line-height: 1.3; }
  #cockpit-install-launch button { padding: 6px 8px; border: 0; border-radius: 8px; color: #fff; background: #0b7895; font-size: .7rem; font-weight: 850; cursor: pointer; white-space: nowrap; }
  #cockpit-install-launch button[data-dismiss-install] { padding: 2px 4px; color: #55727d; background: transparent; font-size: 1rem; }
  #cockpit-sidebar .cockpit-log { padding: 10px 0; border-bottom: 1px solid #d6e8ea; color: #4f6c77; font-size: .76rem; }
  #cockpit-sidebar .cockpit-log b { display: block; color: #073a52; }
  #cockpit-sidebar-toggle { position: fixed; right: 15px; bottom: 15px; z-index: 31; display: none; min-height: 42px; padding: 0 13px; border: 1px solid #073a52; border-radius: 999px; color: #fff; background: #073a52; font-weight: 850; cursor: pointer; }
  body.cockpit-admin #cockpit-sidebar-toggle { display: block; }
  #cockpit-credit { margin-top: 12px; color: #587680; font-size: .78rem; }
  @media (max-width: 700px) {
    #cockpit-session { padding: 8px 12px; }
    .cockpit-status-row button[data-status="deleted"] { margin-left: 0; }
    #cockpit-task-launch { right: 12px; bottom: 68px; }
    #cockpit-install-launch { right: 12px; bottom: 120px; }
    #cockpit-debug-launch { right: 12px; bottom: 174px; }
    #cockpit-debug-panel { right: 12px; bottom: 219px; }
  }
`;
document.head.appendChild(style);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function toast(message, error = false) {
  if (error) recordDebugEvent("error", [message]);
  const existing = document.querySelector(".cockpit-toast");
  if (existing) existing.remove();
  const node = document.createElement("div");
  node.className = "cockpit-toast" + (error ? " error" : "");
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 4200);
}

const debugState = { events: [], open: false };
const nativeConsole = {
  warn: console.warn?.bind(console),
  error: console.error?.bind(console)
};

function debugValue(value) {
  if (value instanceof Error) return value.stack || value.message;
  if (typeof value === "string") return value;
  try { return JSON.stringify(value); } catch { return String(value); }
}

function renderDebugWidget() {
  const launch = document.querySelector("#cockpit-debug-launch");
  const list = document.querySelector("#cockpit-debug-list");
  if (!launch || !list) return;
  const errors = debugState.events.filter((entry) => entry.level === "error").length;
  launch.dataset.hasErrors = String(errors > 0);
  launch.innerHTML = `Diagnostic <span>${debugState.events.length ? `· ${debugState.events.length}` : ""}</span>`;
  list.innerHTML = debugState.events.length ? debugState.events.map((entry) => `<div class="cockpit-debug-line ${esc(entry.level)}"><b>${esc(entry.when)}</b><strong>${esc(entry.level === "error" ? "Erreur" : "Avertissement")}</strong> · ${esc(entry.message)}</div>`).join("") : "<p class=\"cockpit-debug-empty\">Aucun avertissement capturé depuis l’ouverture de la session.</p>";
}

function recordDebugEvent(level, values) {
  const message = (Array.isArray(values) ? values : [values]).map(debugValue).join(" ").slice(0, 4000);
  debugState.events.unshift({ level, message, when: new Date().toLocaleTimeString("fr-CA") });
  if (debugState.events.length > 80) debugState.events.length = 80;
  renderDebugWidget();
}

console.warn = (...values) => {
  nativeConsole.warn?.(...values);
  recordDebugEvent("warn", values);
};
console.error = (...values) => {
  nativeConsole.error?.(...values);
  recordDebugEvent("error", values);
};
window.addEventListener("error", (event) => recordDebugEvent("error", [event.message || "Erreur JavaScript", event.filename ? `${event.filename}:${event.lineno || "?"}` : ""]));
window.addEventListener("unhandledrejection", (event) => recordDebugEvent("error", ["Promesse non gérée", event.reason]));

function buildDebugWidget() {
  if (state.profile?.role !== "admin" || document.querySelector("#cockpit-debug-launch")) return;
  const launch = document.createElement("button");
  launch.id = "cockpit-debug-launch";
  launch.type = "button";
  launch.title = "Ouvrir le diagnostic technique";
  launch.addEventListener("click", () => {
    debugState.open = !debugState.open;
    document.querySelector("#cockpit-debug-panel")?.classList.toggle("open", debugState.open);
  });
  const panel = document.createElement("aside");
  panel.id = "cockpit-debug-panel";
  panel.innerHTML = `<div class="cockpit-debug-head"><strong>Diagnostic technique local</strong><div class="cockpit-debug-actions"><button type="button" data-clear-debug>Effacer</button><button type="button" data-close-debug>Réduire</button></div></div><div id="cockpit-debug-list"></div>`;
  panel.querySelector("[data-clear-debug]").addEventListener("click", () => { debugState.events = []; renderDebugWidget(); });
  panel.querySelector("[data-close-debug]").addEventListener("click", () => { debugState.open = false; panel.classList.remove("open"); });
  document.body.appendChild(panel);
  document.body.appendChild(launch);
  renderDebugWidget();
}

let deferredInstallPrompt = null;
const installDismissKey = "bleu-massawippi-install-dismissed";

function buildInstallWidget() {
  if (document.querySelector("#cockpit-install-launch") || localStorage.getItem(installDismissKey) === "1") return;
  if (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true) return;
  const node = document.createElement("aside");
  node.id = "cockpit-install-launch";
  node.setAttribute("aria-label", "Installer le cockpit");
  node.innerHTML = `<p><strong>Accès rapide</strong><br>Ajouter le cockpit comme application sur cet appareil.</p><button type="button" data-install-app>Installer</button><button type="button" data-dismiss-install aria-label="Masquer ce conseil">×</button>`;
  node.querySelector("[data-dismiss-install]").addEventListener("click", () => {
    localStorage.setItem(installDismissKey, "1");
    node.remove();
  });
  node.querySelector("[data-install-app]").addEventListener("click", async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      const choice = await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      if (choice?.outcome === "accepted") {
        localStorage.setItem(installDismissKey, "1");
        node.remove();
      }
      return;
    }
    toast("Dans le menu du navigateur, choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».");
  });
  document.body.appendChild(node);
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  buildInstallWidget();
});
window.addEventListener("appinstalled", () => {
  localStorage.setItem(installDismissKey, "1");
  document.querySelector("#cockpit-install-launch")?.remove();
});
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", buildInstallWidget, { once: true });
else buildInstallWidget();

function buildLogin() {
  const login = document.createElement("div");
  login.id = "cockpit-login";
  login.innerHTML = `
    <form class="cockpit-login-card" id="cockpit-login-form">
      <p class="eyebrow">Bleu Massawippi · espace sécurisé</p>
      <h2>Connexion</h2>
      <p>Accédez au cockpit de collaboration avec votre compte Firebase autorisé.</p>
      <label>Adresse courriel<input id="cockpit-email" type="email" autocomplete="username" required></label>
      <label>Mot de passe<input id="cockpit-password" type="password" autocomplete="current-password" required></label>
      <button type="submit">Ouvrir la session</button>
      <button class="cockpit-login-reset" id="cockpit-reset-password" type="button">Réinitialiser le mot de passe</button>
      <div class="cockpit-login-error" id="cockpit-login-error" role="alert"></div>
      <div class="cockpit-login-note" id="cockpit-login-note"></div>
    </form>`;
  document.body.appendChild(login);
  login.querySelector("#cockpit-login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const error = login.querySelector("#cockpit-login-error");
    const submit = login.querySelector("#cockpit-login-form button[type=submit]");
    error.textContent = "";
    submit.disabled = true;
    submit.textContent = "Connexion…";
    try {
      await signIn(login.querySelector("#cockpit-email").value.trim(), login.querySelector("#cockpit-password").value);
    } catch (reason) {
      const message = String(reason?.message || "");
      error.textContent = /15 secondes|ne répond pas/i.test(message)
        ? message
        : "Connexion refusée. Vérifiez les identifiants ou utilisez la réinitialisation du mot de passe.";
      console.error(reason);
    } finally {
      submit.disabled = false;
      submit.textContent = "Ouvrir la session";
    }
  });
  login.querySelector("#cockpit-reset-password").addEventListener("click", async () => {
    const email = login.querySelector("#cockpit-email").value.trim();
    const error = login.querySelector("#cockpit-login-error");
    error.textContent = "";
    if (!email) {
      error.textContent = "Indiquez d’abord votre adresse courriel professionnelle.";
      return;
    }
    try {
      await sendPasswordReset(email);
      login.querySelector("#cockpit-login-note").textContent = "Si ce compte est autorisé, un courriel de réinitialisation vient d’être envoyé.";
    } catch (reason) {
      error.textContent = "La réinitialisation est indisponible. Vérifiez la configuration Firebase ou réessayez plus tard.";
      console.error(reason);
    }
  });
  return login;
}

function buildSession() {
  let session = document.querySelector("#cockpit-session");
  if (session) return session;
  session = document.createElement("div");
  session.id = "cockpit-session";
  session.innerHTML = `<span id="cockpit-session-label"></span><button id="cockpit-logout" type="button">Se déconnecter</button>`;
  document.body.prepend(session);
  session.querySelector("#cockpit-logout").addEventListener("click", async () => {
    if (demoMode) {
      toast("Aperçu local : aucune session à fermer.");
      return;
    }
    try {
      await logOut();
      location.reload();
    } catch (error) {
      toast(error.message, true);
    }
  });
  return session;
}

function buildAdminSidebar() {
  if (document.querySelector("#cockpit-sidebar")) return;
  const sidebar = document.createElement("aside");
  sidebar.id = "cockpit-sidebar";
  sidebar.innerHTML = "<div id=\"cockpit-task-heading\"><h2>À accomplir</h2><span id=\"cockpit-task-count\">0</span></div><p class=\"cockpit-sidebar-note\">Les décisions et recommandations reçues de la direction restent ici jusqu’à leur validation ou leur achèvement forcé.</p><div id=\"cockpit-task-list\"></div><h2>Journal de modifications</h2><p class=\"cockpit-sidebar-note\">Lecture technique des changements synchronisés.</p><div id=\"cockpit-log-list\"></div><h2 style=\"margin-top:24px\">Rétroactions du cockpit</h2><p class=\"cockpit-sidebar-note\">Les avis déposés dans les sections et la boîte à idées.</p><div id=\"cockpit-feedback-list\"></div>";
  document.body.appendChild(sidebar);
  const toggle = document.createElement("button");
  toggle.id = "cockpit-sidebar-toggle";
  toggle.type = "button";
  toggle.textContent = "Ouvrir le journal";
  toggle.addEventListener("click", () => sidebar.classList.toggle("open"));
  document.body.appendChild(toggle);
}

function buildTaskWidget() {
  if (document.querySelector("#cockpit-task-launch")) return;
  const button = document.createElement("button");
  button.id = "cockpit-task-launch";
  button.type = "button";
  button.dataset.hasTasks = "false";
  button.innerHTML = "À accomplir <span data-task-count>0</span>";
  button.addEventListener("click", () => {
    const sidebar = document.querySelector("#cockpit-sidebar");
    sidebar?.classList.add("open");
    document.querySelector("#cockpit-task-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.body.appendChild(button);
}

function taskWhen(task) {
  return task.createdAt?.toDate ? task.createdAt.toDate().toLocaleString("fr-CA") : "date en attente";
}

function renderActionTasks(tasks) {
  state.tasks = Array.isArray(tasks) ? tasks : [];
  const pending = state.tasks.filter((task) => task.status === "pending");
  const count = String(pending.length);
  document.querySelectorAll("[data-task-count]").forEach((node) => { node.textContent = count; });
  const launch = document.querySelector("#cockpit-task-launch");
  if (launch) {
    launch.dataset.hasTasks = String(pending.length > 0);
    launch.setAttribute("aria-label", `${pending.length} tâche${pending.length > 1 ? "s" : ""} à accomplir`);
  }
  const list = document.querySelector("#cockpit-task-list");
  if (!list) return;
  if (!pending.length) {
    list.innerHTML = "<p class=\"cockpit-task-empty\">Aucune tâche en attente. Les décisions acceptées et les éléments marqués comme complétés disparaissent de cette liste.</p>";
    return;
  }
  list.innerHTML = pending.map((task) => `<article class="cockpit-task-item" data-task-id="${esc(task.id)}"><b>${esc(task.title || "Tâche à accomplir")}</b><small>${esc(task.targetLabel || task.targetId || "Cible non précisée")} · ${esc(taskWhen(task))}</small><p>${esc(task.message || "")}</p><div class="cockpit-task-actions"><button type="button" data-open-task="${esc(task.id)}" data-task-target-type="${esc(task.targetType || "schedule")}" data-task-target="${esc(task.targetId || "")}">Ouvrir</button><button type="button" data-complete-task="${esc(task.id)}">Marquer complétée</button></div></article>`).join("");
}

function findTaskTarget(type, id) {
  if (!id) return null;
  if (type === "section") return document.getElementById(id);
  return [...document.querySelectorAll("[data-item-id]")].find((node) => node.dataset.itemId === id) || document.getElementById(id);
}

function enhanceTaskEvents() {
  if (document.body.dataset.taskEventsReady === "true") return;
  document.body.dataset.taskEventsReady = "true";
  document.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-open-task]");
    if (openButton) {
      const target = findTaskTarget(openButton.dataset.taskTargetType, openButton.dataset.taskTarget);
      if (!target) {
        toast("La cible de cette tâche n’est plus visible dans le cockpit.", true);
        return;
      }
      target.closest("details")?.setAttribute("open", "");
      target.closest(".context-fold")?.setAttribute("open", "");
      target.scrollIntoView({ behavior: "smooth", block: "center" });
      target.classList.add("task-focus");
      window.setTimeout(() => target.classList.remove("task-focus"), 1800);
      return;
    }
    const completeButton = event.target.closest("[data-complete-task]");
    if (!completeButton || !state.profile || state.profile.role !== "admin") return;
    completeButton.disabled = true;
    completeActionTask(completeButton.dataset.completeTask, state.profile)
      .then(() => toast("Tâche marquée comme complétée."))
      .catch((error) => toast(error.message, true))
      .finally(() => { completeButton.disabled = false; });
  });
}

const feedbackSectionLabels = {
  cap: "Le cap",
  cadence: "La cadence choisie",
  collaboration: "Le mode de collaboration",
  validation: "Validation avant diffusion",
  calendrier: "Calendrier opérationnel",
  production: "Production durable",
  pilotage: "Pilotage et apprentissage",
  photo: "Participation photo",
  sources: "Sources et transparence"
};

function feedbackFormMarkup(sectionId) {
  return `<form class="feedback-form" data-feedback-form data-section-id="${esc(sectionId)}"><textarea data-feedback-message maxlength="5000" placeholder="Ajoutez un avis, une recommandation ou une idée de mise à jour. Cette case sert à préparer la prochaine mouture; elle ne modifie pas le texte immédiatement."></textarea><div class="feedback-actions"><select data-feedback-category aria-label="Type de rétroaction"><option value="recommandation">Recommandation</option><option value="avis">Avis</option><option value="a_verifier">À vérifier</option><option value="idee">Idée de mise à jour</option></select><button type="submit">Envoyer</button></div><p class="feedback-note">Votre note sera enregistrée dans le journal du cockpit pour suivi et arbitrage.</p></form>`;
}

function submitFeedbackForm(form) {
  const messageField = form.querySelector("[data-feedback-message]");
  const categoryField = form.querySelector("[data-feedback-category]");
  const submitButton = form.querySelector("button[type=submit]");
  const sectionId = form.dataset.sectionId || "cockpit";
  const message = messageField.value.trim();
  if (!message) {
    messageField.focus();
    toast("Écrivez d’abord votre avis ou votre recommandation.", true);
    return;
  }
  submitButton.disabled = true;
  addCockpitFeedback(sectionId, message, categoryField.value, state.profile)
    .then(async (feedbackId) => {
      await writeAuditLog("cockpit:" + sectionId, "rétroaction déposée", state.profile);
      await recordActionTask(`feedback-${feedbackId}`, {
        status: "pending",
        title: `Rétroaction à intégrer — ${feedbackSectionLabels[sectionId] || sectionId}`,
        targetType: "section",
        targetId: sectionId,
        targetLabel: feedbackSectionLabels[sectionId] || sectionId,
        message: `${message}\n\nLa rétroaction concerne une prochaine mouture; elle ne modifie pas le texte immédiatement.`
      });
    })
    .then(() => {
      messageField.value = "";
      toast("Rétroaction enregistrée pour la prochaine mouture.");
    })
    .catch((error) => toast(error.message, true))
    .finally(() => { submitButton.disabled = false; });
}

function enhanceSectionFeedback() {
  document.querySelectorAll("#cockpit-content main section[id]").forEach((section) => {
    if (section.querySelector("[data-section-feedback]")) return;
    const heading = section.querySelector(".heading") || section.firstElementChild;
    if (!heading) return;
    const details = document.createElement("details");
    details.className = "section-feedback";
    details.dataset.sectionFeedback = section.id;
    details.innerHTML = `<summary>Avis / recommandation sur « ${esc(feedbackSectionLabels[section.id] || section.id)} »</summary>${feedbackFormMarkup(section.id)}`;
    heading.appendChild(details);
    details.querySelector("[data-feedback-form]").addEventListener("submit", (event) => {
      event.preventDefault();
      submitFeedbackForm(event.currentTarget);
    });
  });
}

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

function nextCalendarDate(weekday, hour, minute = 0) {
  const now = new Date();
  const target = new Date(now);
  const currentDay = target.getDay();
  let daysAhead = (weekday - currentDay + 7) % 7;
  if (daysAhead === 0 && (now.getHours() > hour || (now.getHours() === hour && now.getMinutes() >= minute))) daysAhead = 7;
  target.setDate(target.getDate() + daysAhead);
  target.setHours(hour, minute, 0, 0);
  return target;
}

function downloadCalendarFile(filename, content) {
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

const frenchMonthNumbers = {
  janvier: 0, février: 1, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, août: 7, aout: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11, decembre: 11
};

function parsePlanDate(value) {
  const match = String(value || "").toLocaleLowerCase("fr-CA").match(/(\d{1,2})(?:er)?\s+([a-zéûô]+)/i);
  if (!match) return null;
  const month = frenchMonthNumbers[match[2]];
  if (typeof month !== "number") return null;
  return new Date(2026, month, Number(match[1]), 12, 0, 0, 0);
}

function postCalendarStart(planItem) {
  const start = parsePlanDate(planItem?.date) || new Date(2026, 6, 13, 9, 0, 0, 0);
  const hoursByDay = { 0: 9, 1: 9, 2: 12, 3: 18, 4: 12, 5: 17, 6: 10 };
  start.setHours(hoursByDay[start.getDay()] ?? 12, 0, 0, 0);
  return start;
}

function profileTaskLabel() {
  if (state.profile?.role === "director") return "Annie — Directrice générale";
  if (state.profile?.role === "admin") return "Valentin — Directeur des communications";
  return "Répartition des tâches";
}

function profileTasks(planItem) {
  const valentin = Array.isArray(planItem?.tasksValentin) ? planItem.tasksValentin : [planItem?.task].filter(Boolean);
  const annie = Array.isArray(planItem?.tasksAnnie) ? planItem.tasksAnnie : [];
  if (state.profile?.role === "director") return annie.length ? annie : ["Aucune tâche assignée à la direction générale pour ce contenu; prendre connaissance au besoin."];
  if (state.profile?.role === "admin") return valentin;
  return [...valentin.map((task) => "Valentin : " + task), ...(annie.length ? annie.map((task) => "Annie : " + task) : ["Annie : aucune tâche assignée pour ce contenu."])];
}

function buildPostCalendarIcs(planItem) {
  const start = postCalendarStart(planItem);
  const end = new Date(start.getTime() + 30 * 60000);
  const roleLabel = profileTaskLabel();
  const taskLines = profileTasks(planItem).map((task) => "• " + task).join("\n");
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
    "Lieu : en ligne — Facebook / Instagram",
    "Coût prévu : aucun coût de diffusion; confirmer les droits, la production et tout achat éventuel avant programmation.",
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
      "LOCATION:En ligne — Facebook / Instagram",
      `URL:${escapeCalendarText(planItem.source || "https://bleumassawippi.com")}`,
      "CATEGORIES:BLEU MASSAWIPPI,SOCIAL",
      "STATUS:CONFIRMED",
      "TRANSP:TRANSPARENT",
      "END:VEVENT",
      "END:VCALENDAR"
    ].join("\r\n")
  };
}

function enhancePostCalendarEvents() {
  if (document.body.dataset.postCalendarEventsReady === "true") return;
  document.body.dataset.postCalendarEventsReady = "true";
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-add-post-calendar]");
    if (!button) return;
    const itemId = button.dataset.addPostCalendar;
    const planItem = Array.isArray(globalThis.posts) ? globalThis.posts.find((item) => item.id === itemId) : null;
    if (!planItem) {
      toast("Cet événement n’est plus disponible dans le calendrier.", true);
      return;
    }
    const calendar = buildPostCalendarIcs(planItem);
    downloadCalendarFile(calendar.filename, calendar.content);
    const feedback = button.parentElement?.querySelector("[data-post-calendar-feedback]");
    if (feedback) feedback.textContent = `Fichier prêt pour ${profileTaskLabel()}.`;
    button.textContent = "Fichier calendrier prêt";
    window.setTimeout(() => { button.textContent = "Ajouter cet événement à mon agenda"; }, 3200);
  });
}

function enhanceCalendarButtons() {
  enhancePostCalendarEvents();
  document.querySelectorAll("[data-calendar-event][data-add-calendar]").forEach((card) => {
    if (card.dataset.calendarReady === "true") return;
    const button = card.querySelector("[data-add-calendar]");
    if (!button) return;
    card.dataset.calendarReady = "true";
    button.addEventListener("click", () => {
      const weekday = Math.max(0, Math.min(6, Number(card.dataset.calendarWeekday || 1)));
      const hour = Math.max(0, Math.min(23, Number(card.dataset.calendarHour || 10)));
      const minute = Math.max(0, Math.min(59, Number(card.dataset.calendarMinute || 0)));
      const duration = Math.max(15, Number(card.dataset.calendarDuration || 60));
      const start = nextCalendarDate(weekday, hour, minute);
      const end = new Date(start.getTime() + duration * 60000);
      const uid = `bleu-massawippi-${start.getTime()}@bleumassawippi.com`;
      const summary = "Point de coordination — Bleu Massawippi";
      const weeklyTasks = state.profile?.role === "director"
        ? ["Arbitrer les choix éditoriaux et les sujets sensibles.", "Confirmer les validations, partenaires et décisions qui exigent la direction générale."]
        : ["Préparer la synthèse des choix, commentaires et tâches en attente.", "Mettre à jour le calendrier, les sources, les visuels et les suivis après l’arbitrage."];
      const description = [
        "Point de coordination hebdomadaire proposé autour de 10 h. L’horaire demeure modifiable dans l’agenda partagé.",
        "",
        `Tâches de ${profileTaskLabel()} :`,
        weeklyTasks.map((task) => "• " + task).join("\n"),
        "",
        "Ordre du jour : décisions à prendre, validations sensibles, contenu de la semaine et suivis.",
        "Lieu : en ligne ou lieu confirmé dans l’agenda partagé.",
        "Coût prévu : aucun."
      ].join("\n");
      const ics = [
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
      ].join("\r\n");
      downloadCalendarFile(`coordination-bleu-massawippi-${start.toISOString().slice(0, 10)}.ics`, ics);
      const feedback = card.querySelector("[data-calendar-feedback]");
      if (feedback) feedback.textContent = "Fichier prêt : choisissez l’application de calendrier proposée par votre appareil.";
      button.textContent = "Fichier calendrier prêt";
      window.setTimeout(() => { button.textContent = "Ajouter à mon agenda"; }, 3200);
    });
  });
}

function buildFeedbackWidget() {
  if (document.querySelector("#cockpit-feedback-launch")) return;
  const launch = document.createElement("button");
  launch.id = "cockpit-feedback-launch";
  launch.type = "button";
  launch.textContent = "Boîte à idées";
  launch.setAttribute("aria-expanded", "false");
  const panel = document.createElement("section");
  panel.id = "cockpit-feedback-panel";
  panel.setAttribute("aria-label", "Rétroaction sur le cockpit");
  panel.innerHTML = `<h2>Améliorer le cockpit</h2><p>Déposez ici une idée générale ou une recommandation d’utilisation. Pour un avis sur une section précise, utilisez sa boîte de rétroaction.</p>${feedbackFormMarkup("cockpit")}`;
  launch.addEventListener("click", () => {
    const open = panel.classList.toggle("open");
    launch.setAttribute("aria-expanded", String(open));
    if (open) panel.querySelector("textarea")?.focus();
  });
  panel.querySelector("[data-feedback-form]").addEventListener("submit", (event) => {
    event.preventDefault();
    submitFeedbackForm(event.currentTarget);
  });
  document.body.appendChild(launch);
  document.body.appendChild(panel);
}

function renderFeedbackList(feedback) {
  const list = document.querySelector("#cockpit-feedback-list");
  if (!list) return;
  if (!feedback.length) {
    list.innerHTML = "<p>Aucune rétroaction déposée pour le moment.</p>";
    return;
  }
  const statusLabels = { open: "À traiter", in_review: "En cours", done: "Traité" };
  list.innerHTML = feedback.map((item) => {
    const when = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString("fr-CA") : "date en attente";
    return `<article class="cockpit-feedback-item"><b>${esc(when)} · ${esc(feedbackSectionLabels[item.sectionId] || item.sectionId || "Cockpit")} · ${esc(statusLabels[item.status] || item.status || "À traiter")}</b><p>${esc(item.message || "")}</p><button type="button" data-feedback-status="in_review" data-feedback-id="${esc(item.id)}">En cours</button><button type="button" data-feedback-status="done" data-feedback-id="${esc(item.id)}">Traité</button></article>`;
  }).join("");
}

function enhanceFeedbackListEvents() {
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-feedback-status]");
    if (!button || !state.profile || state.profile.role !== "admin") return;
    button.disabled = true;
    updateCockpitFeedbackStatus(button.dataset.feedbackId, button.dataset.feedbackStatus, state.profile)
      .then(() => toast("Statut de rétroaction mis à jour."))
      .catch((error) => toast(error.message, true))
      .finally(() => { button.disabled = false; });
  });
}

function addFooterCredit() {
  let credit = document.querySelector("#cockpit-credit");
  if (credit) return;
  credit = document.createElement("div");
  credit.id = "cockpit-credit";
  credit.textContent = "Conçu, programmé et designé par Valentin Wittwe — Directeur des Communications © Bleu Massawippi";
  document.querySelector("footer")?.appendChild(credit);
}

function getPlanItem(card) {
  const title = card.querySelector("h4")?.textContent?.trim();
  const rows = Array.isArray(globalThis.posts) ? globalThis.posts : [];
  return rows.find((item) => item.title === title) || null;
}

function canEdit() {
  return Boolean(state.profile && ["director", "admin"].includes(state.profile.role));
}

function choiceGroupIds(planItem) {
  if (!planItem?.optionGroup || !Array.isArray(globalThis.posts)) return [];
  return globalThis.posts.filter((item) => item.optionGroup === planItem.optionGroup).map((item) => item.id);
}

function isChoiceSelected(planItem) {
  const row = state.rows.get(planItem.id);
  if (typeof row?.selected === "boolean") return row.selected;
  return planItem.choiceRequired !== true;
}

function syncCardAccess() {
  const editable = canEdit();
  document.body.classList.toggle("cockpit-readonly", !editable);
  document.querySelectorAll(".cockpit-controls button, .cockpit-controls textarea, .cockpit-controls input").forEach((control) => {
    control.disabled = !editable;
  });
}

function enhanceCards() {
  document.querySelectorAll(".post").forEach((card) => {
    const planItem = getPlanItem(card);
    if (!planItem) return;
    card.dataset.itemId = planItem.id;
    card.dataset.id = `post-${planItem.id}`;
    card.dataset.optionGroup = planItem.optionGroup || "";
    if (card.querySelector(".cockpit-controls")) return;
    const controls = document.createElement("div");
    controls.className = "cockpit-controls";
    controls.innerHTML = `
      ${planItem.choiceRequired ? `<label class="cockpit-choice-row"><input type="checkbox" data-choice="${esc(planItem.id)}" ${isChoiceSelected(planItem) ? "checked" : ""}><span>${esc(planItem.optionLabel || "Choisir cette option")}</span><small>Une seule option par journée</small></label>` : ""}
      <div class="cockpit-status-row" aria-label="Statut de la publication">
        <button type="button" data-status="approved" aria-pressed="false">🟢 Approuvé</button>
        <button type="button" data-status="needs_work" aria-pressed="false">🟡 À retravailler</button>
        <button type="button" data-status="pending" aria-pressed="false">⚪ En attente</button>
        <button type="button" data-status="deleted" aria-label="Masquer virtuellement cette ligne" title="Masquer virtuellement cette ligne">✕</button>
      </div>
      <div class="cockpit-comment-row">
        <textarea data-comment maxlength="5000" spellcheck="true" autocapitalize="sentences" inputmode="text" placeholder="Ajouter une consigne ou un commentaire…" aria-label="Commentaire de pilotage"></textarea>
        <button type="button" data-dictate aria-pressed="false" aria-label="Dicter un commentaire" title="Dicter un commentaire">🎙️</button>
        <button class="save" type="button" data-save-comment>Enregistrer</button>
        <div class="cockpit-voice-status" data-voice-status aria-live="polite">Cliquez sur le micro, puis autorisez le microphone si demandé.</div>
      </div>
      <div class="cockpit-quick-row" aria-label="Badges rapides">
        <button type="button" data-tag="cancel">🔴 À annuler</button>
        <button type="button" data-tag="delay">🟡 À décaler</button>
        <button type="button" data-tag="perfect">🟢 Parfait</button>
      </div>`;
    card.appendChild(controls);
  });
  applyRemoteRows();
  renderAttachmentBlocks();
  applyPastEventFilter();
  syncCardAccess();
}

function formatAttachmentBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return `${value} o`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} Ko`;
  return `${(value / (1024 * 1024)).toFixed(2)} Mo`;
}

function attachmentBlockMarkup(planItem) {
  return `<section class="cockpit-attachments" data-attachments-for="${esc(planItem.id)}">
    <div class="cockpit-attachments-head"><b>Visuels liés à cet événement</b><span>JPEG optimisé · format 4:5</span></div>
    <div class="cockpit-attachment-grid" data-attachment-grid></div>
    <label class="cockpit-attachment-upload"><span>Ajouter une ou plusieurs photos</span><input type="file" data-attachment-input accept="image/*" multiple></label>
    <p class="cockpit-attachment-note">Chaque image est cadrée automatiquement pour Facebook / Instagram (4:5, jusqu’à 1080 × 1350), convertie en JPEG et gardée sous 1 Mo. L’image optimisée devient la version de travail réutilisable.</p>
    <div class="cockpit-attachment-status" data-attachment-status aria-live="polite"></div>
  </section>`;
}

function renderAttachmentBlocks() {
  if (!IMAGE_ATTACHMENTS_ENABLED) {
    document.querySelectorAll(".cockpit-attachments").forEach((node) => node.remove());
    return;
  }
  document.querySelectorAll(".post[data-item-id]").forEach((card) => {
    const planItem = getPlanItem(card);
    const detail = card.querySelector(".detail");
    if (!planItem || !detail) return;
    let block = detail.querySelector("[data-attachments-for]");
    if (!block) {
      detail.insertAdjacentHTML("beforeend", attachmentBlockMarkup(planItem));
      block = detail.querySelector(`[data-attachments-for="${planItem.id}"]`);
    }
    const grid = block?.querySelector("[data-attachment-grid]");
    if (!grid) return;
    const rows = state.attachments.filter((attachment) => attachment.eventId === planItem.id && attachment.archived !== true);
    grid.innerHTML = rows.length ? rows.map((attachment) => {
      const image = attachment.downloadUrl
        ? `<a href="${esc(attachment.downloadUrl)}" target="_blank" rel="noopener noreferrer" title="Ouvrir le visuel optimisé en pleine qualité"><img src="${esc(attachment.downloadUrl)}" alt="${esc(attachment.filename || "Visuel lié")}" loading="lazy"></a>`
        : `<div class="cockpit-attachment-missing">Visuel temporairement indisponible</div>`;
      return `<figure class="cockpit-attachment">${image}<figcaption><strong>${esc(attachment.filename || "Visuel optimisé")}</strong>${formatAttachmentBytes(attachment.sizeBytes)} · ${esc(attachment.width || 1080)} × ${esc(attachment.height || 1350)}</figcaption></figure>`;
    }).join("") : `<p class="cockpit-attachment-empty">Aucun visuel lié pour le moment. Les photos ajoutées ici restent associées à cet événement.</p>`;
  });
  const usage = document.querySelector("#cockpit-attachment-usage");
  if (usage) {
    const activeAttachments = state.attachments.filter((attachment) => attachment.archived !== true);
    const bytes = activeAttachments.reduce((total, attachment) => total + Number(attachment.sizeBytes || 0), 0);
    usage.textContent = `${activeAttachments.length} visuel${activeAttachments.length === 1 ? "" : "s"} · ${formatAttachmentBytes(bytes)} suivis par le cockpit. Estimation interne; le quota Firebase facturé se vérifie dans la console.`;
  }
  syncCardAccess();
}

async function loadImageSource(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      try { return await createImageBitmap(file); } catch {}
    }
  }
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(objectUrl); resolve(image); };
    image.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Le navigateur ne peut pas lire cette image.")); };
    image.src = objectUrl;
  });
}

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("La conversion JPEG a échoué.")), "image/jpeg", quality);
  });
}

async function convertImageForSocial(file) {
  if (!file || !String(file.type || "").startsWith("image/")) throw new Error("Sélectionnez uniquement des fichiers image.");
  const source = await loadImageSource(file);
  const sourceWidth = Number(source.width || source.naturalWidth || 0);
  const sourceHeight = Number(source.height || source.naturalHeight || 0);
  if (!sourceWidth || !sourceHeight) throw new Error("Les dimensions de cette image sont illisibles.");
  const dimensions = [[1080, 1350], [960, 1200], [840, 1050], [720, 900]];
  const qualities = [0.84, 0.78, 0.72, 0.66, 0.60, 0.54];
  let lastBlob = null;
  let lastWidth = 0;
  let lastHeight = 0;
  for (const [width, height] of dimensions) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Le navigateur ne peut pas préparer le visuel.");
    context.fillStyle = "#eef7f7";
    context.fillRect(0, 0, width, height);
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const drawWidth = sourceWidth * scale;
    const drawHeight = sourceHeight * scale;
    context.drawImage(source, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    for (const quality of qualities) {
      const blob = await canvasToJpeg(canvas, quality);
      lastBlob = blob;
      lastWidth = width;
      lastHeight = height;
      if (blob.size < Math.min(MAX_ATTACHMENT_BYTES, 980 * 1024)) {
        source.close?.();
        return { blob, width, height, originalWidth: sourceWidth, originalHeight: sourceHeight };
      }
    }
  }
  source.close?.();
  if (!lastBlob || lastBlob.size >= MAX_ATTACHMENT_BYTES) throw new Error("Cette image reste trop lourde après optimisation. Choisissez une image plus simple.");
  return { blob: lastBlob, width: lastWidth, height: lastHeight, originalWidth: sourceWidth, originalHeight: sourceHeight };
}

function attachmentFilename(name) {
  const stem = String(name || "visuel").replace(/\.[^.]+$/, "").normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 54) || "visuel";
  return `${stem}-meta-4x5.jpg`;
}

async function uploadAttachmentFiles(input) {
  const block = input.closest("[data-attachments-for]");
  const eventId = block?.dataset.attachmentsFor;
  const status = block?.querySelector("[data-attachment-status]");
  if (!eventId || !state.profile || !canEdit()) return;
  const files = [...(input.files || [])];
  input.value = "";
  if (!files.length || input.dataset.busy === "true") return;
  input.dataset.busy = "true";
  try {
    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      if (status) {
        status.className = "cockpit-attachment-status";
        status.textContent = `Optimisation du visuel ${index + 1} / ${files.length}…`;
      }
      const prepared = await convertImageForSocial(file);
      const uploaded = await uploadImageAttachment({
        eventId,
        blob: prepared.blob,
        filename: attachmentFilename(file.name),
        width: prepared.width,
        height: prepared.height,
        originalName: file.name,
        originalWidth: prepared.originalWidth,
        originalHeight: prepared.originalHeight
      }, state.profile);
      state.attachments = [uploaded, ...state.attachments];
    }
    renderAttachmentBlocks();
    if (status) {
      status.className = "cockpit-attachment-status success";
      status.textContent = `${files.length} visuel${files.length > 1 ? "s" : ""} optimisé${files.length > 1 ? "s" : ""} et associé${files.length > 1 ? "s" : ""} à cet événement.`;
    }
    toast("Visuel ajouté au brief.");
  } catch (error) {
    if (status) {
      status.className = "cockpit-attachment-status error";
      status.textContent = error.message || "Le visuel n’a pas pu être ajouté.";
    }
    toast(error.message || "Le visuel n’a pas pu être ajouté.", true);
  } finally {
    delete input.dataset.busy;
  }
}

function enhanceAttachmentEvents() {
  if (!IMAGE_ATTACHMENTS_ENABLED) return;
  if (document.body.dataset.attachmentEventsReady === "true") return;
  document.body.dataset.attachmentEventsReady = "true";
  document.addEventListener("change", (event) => {
    const input = event.target.closest("[data-attachment-input]");
    if (!input) return;
    uploadAttachmentFiles(input);
  });
}

const calendarMonthNumbers = {
  janvier: 0, février: 1, fevrier: 1, mars: 2, avril: 3, mai: 4, juin: 5,
  juillet: 6, août: 7, aout: 7, septembre: 8, octobre: 9, novembre: 10, décembre: 11, decembre: 11
};

function parseCalendarDayLabel(value) {
  const match = String(value || "").toLocaleLowerCase("fr-CA").match(/(\d{1,2})(?:er)?\s+([a-zéûô]+)/i);
  if (!match) return null;
  const month = calendarMonthNumbers[match[2]];
  if (typeof month !== "number") return null;
  return new Date(2026, month, Number(match[1]), 0, 0, 0, 0);
}

function ensurePastFilterControl() {
  const toolbar = document.querySelector("#calendrier .toolbar");
  if (!toolbar || toolbar.querySelector("[data-past-toggle]")) return;
  const button = document.createElement("button");
  button.type = "button";
  button.dataset.pastToggle = "true";
  button.className = "cockpit-past-toggle";
  button.addEventListener("click", () => {
    pastEventsVisible = !pastEventsVisible;
    applyPastEventFilter();
  });
  toolbar.appendChild(button);
}

function applyPastEventFilter() {
  ensurePastFilterControl();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const groups = [...document.querySelectorAll("#calendrier #posts .day-group")];
  let visibleCards = 0;
  groups.forEach((group) => {
    const dayLabel = group.querySelector(".day-heading strong")?.textContent || "";
    const date = parseCalendarDayLabel(dayLabel);
    const past = Boolean(date && date < todayStart);
    group.dataset.past = String(past);
    group.hidden = past && !pastEventsVisible;
    group.classList.toggle("cockpit-past-visible", past && pastEventsVisible);
    let badge = group.querySelector("[data-past-badge]");
    if (past && pastEventsVisible) {
      if (!badge) {
        badge = document.createElement("span");
        badge.dataset.pastBadge = "true";
        badge.className = "cockpit-past-badge";
        badge.textContent = "Historique";
        group.querySelector(".day-heading")?.appendChild(badge);
      }
    } else {
      badge?.remove();
    }
    if (!group.hidden) visibleCards += group.querySelectorAll(".post").length;
  });
  document.querySelectorAll("#calendrier #posts .week-group").forEach((week) => {
    week.hidden = [...week.querySelectorAll(".day-group")].every((group) => group.hidden);
  });
  const button = document.querySelector("[data-past-toggle]");
  if (button) {
    button.classList.toggle("active", pastEventsVisible);
    button.setAttribute("aria-pressed", String(pastEventsVisible));
    button.textContent = pastEventsVisible ? "Masquer l’historique" : "Afficher les événements passés";
  }
  const postsHost = document.querySelector("#calendrier #posts");
  const noVisible = groups.length > 0 && groups.every((group) => group.hidden);
  let empty = document.querySelector("#cockpit-past-empty");
  if (noVisible && !pastEventsVisible) {
    if (!empty) {
      empty = document.createElement("div");
      empty.id = "cockpit-past-empty";
      postsHost?.appendChild(empty);
    }
    empty.innerHTML = "Aucun événement aujourd’hui ou à venir dans ce filtre. <button type=\"button\" data-past-empty-toggle>Afficher l’historique</button>";
    empty.querySelector("[data-past-empty-toggle]")?.addEventListener("click", () => { pastEventsVisible = true; applyPastEventFilter(); });
  } else {
    empty?.remove();
  }
  const shown = document.querySelector("#shown");
  if (shown) shown.textContent = `${visibleCards} carte${visibleCards === 1 ? "" : "s"} affichée${visibleCards === 1 ? "" : "s"}${pastEventsVisible ? " · historique inclus" : " · aujourd’hui et à venir"}`;
}

function applyRemoteRows() {
  document.querySelectorAll(".post[data-item-id]").forEach((card) => {
    const row = state.rows.get(card.dataset.itemId);
    const planItem = getPlanItem(card);
    const status = row?.status || "pending";
    card.dataset.status = status;
    card.classList.toggle("is-deleted", Boolean(row?.deleted || status === "deleted"));
    const choiceInput = card.querySelector("[data-choice]");
    const selected = planItem ? isChoiceSelected(planItem) : Boolean(row?.selected);
    if (choiceInput) choiceInput.checked = selected;
    card.classList.toggle("choice-selected", Boolean(choiceInput && selected));
    card.classList.toggle("choice-unselected", Boolean(choiceInput && !selected));
    card.querySelectorAll("[data-status]").forEach((button) => {
      const selected = button.dataset.status === status;
      button.classList.toggle("active", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
  });
}

async function recordAudit(card, action) {
  try {
    await writeAuditLog(card.dataset.itemId, action, state.profile);
  } catch (error) {
    console.warn("Journal opérationnel non écrit", error);
  }
}

function taskKeyForPlanItem(planItem) {
  const key = planItem?.optionGroup ? `choice-${planItem.optionGroup}` : `post-${planItem?.id || "unknown"}`;
  return `schedule-${key}`.replace(/[^a-z0-9-]/gi, "-");
}

function responsibilitySummary(planItem) {
  if (!planItem) return "";
  const valentin = Array.isArray(planItem.tasksValentin) ? planItem.tasksValentin : [planItem.task].filter(Boolean);
  const annie = Array.isArray(planItem.tasksAnnie) ? planItem.tasksAnnie : [];
  const parts = ["Répartition pour cet événement :", `Valentin — Directeur des communications :\n${valentin.map((task) => "• " + task).join("\n")}`];
  if (annie.length) parts.push(`Annie — Direction générale :\n${annie.map((task) => "• " + task).join("\n")}`);
  return parts.join("\n\n");
}

async function recordActionTask(taskId, payload) {
  if (!state.profile || state.profile.role !== "director") return;
  try {
    await upsertActionTask(taskId, payload, state.profile);
  } catch (error) {
    console.warn("Tâche de suivi non enregistrée", error);
    toast("L’action est enregistrée, mais la tâche de suivi n’a pas pu être créée.", true);
  }
}

async function syncScheduleTask(card, status, planItem, reason = "") {
  if (!planItem) return;
  const accepted = status === "approved";
  const action = accepted ? "Acceptation à intégrer" : status === "deleted" ? "Ligne à retirer ou remplacer" : status === "needs_work" ? "Révision demandée" : "Décision à traiter";
  await recordActionTask(taskKeyForPlanItem(planItem), {
    status: accepted ? "done" : "pending",
    title: `${action} — ${planItem.title}`,
    targetType: "schedule",
    targetId: planItem.id,
    targetLabel: `${planItem.date || "Date à confirmer"} · ${planItem.title}`,
    message: `${reason || "Une interaction de la direction demande un suivi."}\n\n${responsibilitySummary(planItem)}`
  });
}

async function changeStatus(card, status) {
  if (!state.profile || !["director", "admin"].includes(state.profile.role)) {
    toast("Votre session est en lecture seule.", true);
    return;
  }
  const itemId = card.dataset.itemId;
  const planItem = getPlanItem(card);
  try {
    await upsertScheduleItem(itemId, {
      title: planItem?.title || "",
      dateKey: planItem?.date || "",
      status,
      deleted: status === "deleted"
    }, state.profile);
    await recordAudit(card, "statut : " + status);
    await syncScheduleTask(card, status, planItem, `Statut choisi : ${status}.`);
    toast("Statut enregistré.");
  } catch (error) {
    toast(error.message, true);
  }
}

function setVoiceStatus(textarea, message, kind = "") {
  const status = textarea?.closest(".cockpit-comment-row")?.querySelector("[data-voice-status]");
  if (!status) return;
  status.textContent = message;
  status.className = "cockpit-voice-status" + (kind ? " " + kind : "");
}

function setVoiceButtonState(textarea, active) {
  const button = textarea?.closest(".cockpit-comment-row")?.querySelector("[data-dictate]");
  if (!button) return;
  button.setAttribute("aria-pressed", String(active));
  button.textContent = active ? "⏹️" : "🎙️";
  button.title = active ? "Arrêter la dictée" : "Dicter un commentaire";
}

function clearRecognitionRestartTimer() {
  if (recognitionRestartTimer) window.clearTimeout(recognitionRestartTimer);
  recognitionRestartTimer = null;
}

function clearRecognitionWatchdog() {
  if (recognitionWatchdogTimer) window.clearTimeout(recognitionWatchdogTimer);
  recognitionWatchdogTimer = null;
}

async function ensureMicrophonePermission(textarea) {
  if (!navigator.mediaDevices?.getUserMedia) return true;
  if (!recognitionPermissionPromise) {
    recognitionPermissionPromise = navigator.mediaDevices.getUserMedia({ audio: true })
      .then((stream) => {
        stream.getTracks().forEach((track) => track.stop());
        return true;
      })
      .catch((error) => {
        const code = error?.name || "permission-denied";
        setVoiceStatus(textarea, code === "NotAllowedError" ? "Autorisation du microphone refusée. Autorisez le micro pour ce site puis réessayez." : "Le microphone n’est pas accessible sur cet appareil.", "error");
        return false;
      })
      .finally(() => { recognitionPermissionPromise = null; });
  }
  return recognitionPermissionPromise;
}

function voiceFallback(textarea, message) {
  textarea?.focus();
  setVoiceButtonState(textarea, false);
  setVoiceStatus(textarea, message, "error");
  const row = textarea?.closest(".cockpit-comment-row");
  if (!row) return;
  let help = row.querySelector("[data-voice-help]");
  if (!help) {
    help = document.createElement("small");
    help.dataset.voiceHelp = "true";
    help.className = "cockpit-voice-help";
    row.appendChild(help);
  }
  help.textContent = "Solution de secours : utilisez la dictée du clavier ou du système (Windows : Win+H, macOS/iPhone : touche microphone).";
}

function finishDictation(recognition, textarea, message, kind = "") {
  if (activeRecognition !== recognition) return;
  recognitionRestart = false;
  clearRecognitionRestartTimer();
  clearRecognitionWatchdog();
  activeRecognition = null;
  activeTextarea = null;
  setVoiceButtonState(textarea, false);
  setVoiceStatus(textarea, message, kind);
}

function stopDictation(message = "Dictée arrêtée.") {
  recognitionRestart = false;
  clearRecognitionRestartTimer();
  clearRecognitionWatchdog();
  const recognition = activeRecognition;
  const textarea = activeTextarea;
  activeRecognition = null;
  activeTextarea = null;
  if (recognition) {
    try { recognition.stop(); } catch {}
  }
  if (textarea) {
    setVoiceButtonState(textarea, false);
    setVoiceStatus(textarea, message);
  }
}

function scheduleRecognitionRestart(recognition, textarea) {
  if (!recognitionRestart || activeRecognition !== recognition) return;
  clearRecognitionRestartTimer();
  const delay = Math.min(1200, 220 + recognitionRestartAttempts * 120);
  recognitionRestartTimer = window.setTimeout(() => {
    recognitionRestartTimer = null;
    if (!recognitionRestart || activeRecognition !== recognition) return;
    try {
      recognition.lang = recognitionLanguages[recognitionLanguageIndex] || "fr-CA";
      recognition.start();
    } catch (error) {
      recognitionRestartAttempts += 1;
      if (recognitionRestartAttempts < 4) {
        scheduleRecognitionRestart(recognition, textarea);
      } else {
        finishDictation(recognition, textarea, "Le navigateur a interrompu la dictée. Cliquez sur le micro pour reprendre.", "error");
      }
    }
  }, delay);
}

async function startDictation(textarea) {
  if (!textarea) return;
  if (activeRecognition && activeTextarea === textarea) {
    stopDictation();
    return;
  }
  if (activeRecognition) stopDictation();
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    voiceFallback(textarea, "La reconnaissance vocale intégrée n’est pas exposée par ce navigateur.");
    toast("Utilisez la dictée du clavier ou du système dans ce navigateur.", true);
    return;
  }
  if (window.isSecureContext === false && !["localhost", "127.0.0.1"].includes(location.hostname)) {
    voiceFallback(textarea, "La dictée exige une connexion HTTPS.");
    return;
  }
  activeTextarea = textarea;
  setVoiceButtonState(textarea, true);
  setVoiceStatus(textarea, "Vérification du microphone…", "live");
  if (!(await ensureMicrophonePermission(textarea))) {
    activeTextarea = null;
    setVoiceButtonState(textarea, false);
    voiceFallback(textarea, "Autorisation du microphone refusée ou microphone indisponible.");
    return;
  }
  let recognition;
  try {
    recognition = new Recognition();
  } catch (error) {
    activeTextarea = null;
    voiceFallback(textarea, "Impossible d’ouvrir le service vocal de ce navigateur.");
    return;
  }
  activeRecognition = recognition;
  recognitionRestart = true;
  recognitionLanguageIndex = 0;
  recognitionRestartAttempts = 0;
  recognition.lang = recognitionLanguages[recognitionLanguageIndex];
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  setVoiceButtonState(textarea, true);
  setVoiceStatus(textarea, "Autorisez le microphone si le navigateur le demande…", "live");
  recognition.onstart = () => {
    recognitionRestartAttempts = 0;
    clearRecognitionWatchdog();
    recognitionWatchdogTimer = window.setTimeout(() => {
      if (activeRecognition !== recognition || !recognitionRestart) return;
      setVoiceStatus(textarea, "Reprise automatique de l’écoute…", "live");
      try { recognition.stop(); } catch {}
    }, 52000);
    setVoiceButtonState(textarea, true);
    setVoiceStatus(textarea, "Écoute en cours… cliquez de nouveau sur le micro pour arrêter.", "live");
  };
  recognition.onaudiostart = () => setVoiceStatus(textarea, "Microphone actif… parlez naturellement.", "live");
  recognition.onresult = (event) => {
    let interim = "";
    let finalText = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0]?.transcript || "";
      if (event.results[index].isFinal) finalText += transcript;
      else interim += transcript;
    }
    if (finalText.trim()) {
      const existing = textarea.value.trimEnd();
      textarea.value = existing + (existing ? " " : "") + finalText.trim();
      textarea.dataset.dictated = "true";
      textarea.focus();
    }
    setVoiceStatus(textarea, interim ? `Écoute… ${interim}` : "Écoute en cours…", "live");
  };
  recognition.onerror = (event) => {
    const errorCode = event.error || "unknown";
    if (errorCode === "no-speech") {
      setVoiceStatus(textarea, "Aucune parole détectée; l’écoute reprend automatiquement…", "live");
      return;
    }
    if (errorCode === "language-not-supported" && recognitionLanguageIndex < recognitionLanguages.length - 1) {
      recognitionLanguageIndex += 1;
      setVoiceStatus(textarea, "La langue régionale n’est pas disponible; nouvel essai en français…", "live");
      try { recognition.stop(); } catch {}
      return;
    }
    if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
      finishDictation(recognition, textarea, "Autorisation du microphone refusée. Autorisez le micro pour ce site puis réessayez.", "error");
      return;
    }
    if (errorCode === "audio-capture") {
      finishDictation(recognition, textarea, "Aucun microphone n’est disponible. Vérifiez le micro choisi dans le navigateur.", "error");
      return;
    }
    if (errorCode === "aborted" && recognitionRestart) return;
    if (terminalRecognitionErrors.has(errorCode)) {
      finishDictation(recognition, textarea, "Le service vocal est indisponible. Utilisez la dictée du clavier ou du système.", "error");
      return;
    }
    finishDictation(recognition, textarea, `Dictée interrompue (${errorCode}). Cliquez sur le micro pour reprendre.`, "error");
  };
  recognition.onnomatch = () => setVoiceStatus(textarea, "Aucun mot reconnu; continuez à parler…", "live");
  recognition.onend = () => {
    clearRecognitionWatchdog();
    if (!recognitionRestart || activeRecognition !== recognition) return;
    setVoiceStatus(textarea, "Reprise de l’écoute…", "live");
    scheduleRecognitionRestart(recognition, textarea);
  };
  try {
    recognition.start();
  } catch {
    finishDictation(recognition, textarea, "Le microphone est occupé. Fermez une autre dictée puis réessayez.", "error");
  }
}

async function saveCardComment(card, quickTag = null) {
  if (!state.profile) {
    toast("Session requise.", true);
    return;
  }
  const textarea = card.querySelector("[data-comment]");
  const text = textarea.value.trim();
  if (!text && !quickTag) return;
  try {
    const commentId = await addComment(card.dataset.itemId, text || quickTag, state.profile, quickTag, textarea.dataset.dictated === "true");
    await recordAudit(card, quickTag ? "badge : " + quickTag : (textarea.dataset.dictated === "true" ? "commentaire dicté" : "commentaire ajouté"));
    const planItem = getPlanItem(card);
    await recordActionTask(`comment-${commentId}`, {
      status: "pending",
      title: `Commentaire à traiter — ${planItem?.title || card.dataset.itemId}`,
      targetType: "schedule",
      targetId: card.dataset.itemId,
      targetLabel: `${planItem?.date || "Date à confirmer"} · ${planItem?.title || card.dataset.itemId}`,
      message: `${text || quickTag}\n\n${responsibilitySummary(planItem)}`
    });
    textarea.value = "";
    delete textarea.dataset.dictated;
    toast("Commentaire enregistré.");
  } catch (error) {
    toast(error.message, true);
  }
}

function enhanceCardEvents() {
  document.addEventListener("click", (event) => {
    const card = event.target.closest(".post[data-item-id]");
    if (!card) return;
    const statusButton = event.target.closest("[data-status]");
    if (statusButton) {
      if (statusButton.dataset.status === "deleted" && !confirm("Masquer virtuellement cette ligne?")) return;
      changeStatus(card, statusButton.dataset.status);
      return;
    }
    if (event.target.closest("[data-dictate]")) {
      startDictation(card.querySelector("[data-comment]"));
      return;
    }
    if (event.target.closest("[data-save-comment]")) {
      saveCardComment(card);
      return;
    }
    const tagButton = event.target.closest("[data-tag]");
    if (tagButton) {
      const textarea = card.querySelector("[data-comment]");
      textarea.value = tagButton.textContent.trim() + (textarea.value ? " " + textarea.value : "");
      saveCardComment(card, tagButton.dataset.tag);
      return;
    }
    const copyButton = event.target.closest(".copybtn");
    if (copyButton) return;
  });

  document.addEventListener("change", (event) => {
    const choice = event.target.closest("[data-choice]");
    if (!choice) return;
    const card = choice.closest(".post[data-item-id]");
    const planItem = card && getPlanItem(card);
    if (!card || !planItem) return;
    if (!canEdit()) {
      choice.checked = isChoiceSelected(planItem);
      toast("Votre session est en lecture seule.", true);
      return;
    }
    const selected = choice.checked;
    setScheduleSelection(planItem.id, choiceGroupIds(planItem), selected, state.profile)
      .then(async () => {
        await recordAudit(card, selected ? "option choisie : " + (planItem.optionLabel || planItem.title) : "option désélectionnée");
        await syncScheduleTask(card, "pending", planItem, selected ? `Option choisie : ${planItem.optionLabel || planItem.title}.` : "Option désélectionnée : un arbitrage reste à faire.");
        toast(selected ? "Option choisie pour cette journée." : "Aucune option sélectionnée pour cette journée.");
      })
      .catch((error) => {
        choice.checked = isChoiceSelected(planItem);
        toast(error.message, true);
      });
  });
}

async function loadPrivateContent() {
  if (state.contentLoaded) return;
  const content = await fetchPrivateContent();
  const host = document.querySelector("#cockpit-content");
  if (!host) throw new Error("Conteneur du cockpit introuvable.");
  document.querySelector("#cockpit-private-style")?.remove();
  const privateStyle = document.createElement("style");
  privateStyle.id = "cockpit-private-style";
  privateStyle.textContent = content.css;
  document.head.appendChild(privateStyle);
  host.innerHTML = content.html;
  const mastNote = host.querySelector(".mast span:last-child");
  if (mastNote) mastNote.textContent = "Cockpit permanent · première séquence du 13 juillet au 9 août 2026";
  const heroEyebrow = host.querySelector(".hero .eyebrow");
  if (heroEyebrow) heroEyebrow.textContent = "Cadence permanente · première séquence du 13 juillet au 9 août 2026";
  const heroTitle = host.querySelector(".hero h1");
  if (heroTitle) heroTitle.innerHTML = "Plan d’attaque<br><em>2026</em><br>cockpit permanent.";
  const calendarTitle = host.querySelector("#calendrier .heading h2");
  if (calendarTitle) calendarTitle.textContent = "Calendrier opérationnel permanent";
  const calendarIntro = host.querySelector("#calendrier .heading p:last-child");
  if (calendarIntro) calendarIntro.textContent = "Les 28 premières journées forment la séquence de lancement; la page reste le registre permanent des idées, validations, visuels et publications à venir. Les options déplacées alimentent les semaines suivantes sans rien supprimer.";
  const weekSelect = host.querySelector("#week");
  if (weekSelect && !weekSelect.querySelector("option[value='5']")) weekSelect.insertAdjacentHTML("beforeend", "<option value=\"5\">Semaine 5 · Réserve éditoriale</option>");
  const footerTitle = host.querySelector("footer strong");
  if (footerTitle) footerTitle.textContent = "Bleu Massawippi — Plan d’attaque 2026 · cockpit permanent.";
  const planScript = document.createElement("script");
  planScript.textContent = content.script;
  document.body.appendChild(planScript);
  planScript.remove();
  if (Array.isArray(globalThis.posts)) {
    applyPlanOverridesToPosts(globalThis.posts);
    if (globalThis.meta) globalThis.meta[5] = ["Semaine 5 · Réserve éditoriale", "10 au 16 août"];
    globalThis.render?.();
  }
  state.contentLoaded = true;
}

function clearPrivateContent() {
  document.querySelector("#cockpit-content")?.replaceChildren();
  document.querySelector("#cockpit-private-style")?.remove();
  state.contentLoaded = false;
  globalThis.posts = [];
}

async function applyProfile(profile) {
  state.profile = profile;
  await loadPrivateContent();
  document.body.classList.remove("cockpit-locked");
  document.body.classList.remove("cockpit-readonly");
  document.querySelector("#cockpit-login")?.setAttribute("hidden", "");
  const session = buildSession();
  session.querySelector("#cockpit-session-label").innerHTML = "Connecté : <strong>" + esc(profile.displayLabel) + "</strong> · rôle " + esc(profile.role);
  if (profile.role === "admin") {
    document.body.classList.add("cockpit-admin");
    buildAdminSidebar();
    buildTaskWidget();
    buildDebugWidget();
    enhanceTaskEvents();
    state.auditUnsubscribe?.();
    state.feedbackUnsubscribe?.();
    state.tasksUnsubscribe?.();
    if (configured) {
      state.auditUnsubscribe = subscribeAuditLogs((logs) => {
        const list = document.querySelector("#cockpit-log-list");
        if (!list) return;
        list.innerHTML = logs.length ? logs.map((log) => {
          const when = log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString("fr-CA") : "date en attente";
          return `<div class="cockpit-log"><b>${esc(when)} · ${esc(log.action || "modification")}</b><span>section: ${esc(log.sectionId || "—")} · utilisateur: ${esc(log.userLabel || log.userUid || "—")}</span></div>`;
        }).join("") : "<p>Aucun journal accessible pour le moment.</p>";
      }, (error) => toast("Le journal n’est pas accessible : " + error.message, true));
      state.feedbackUnsubscribe = subscribeCockpitFeedback(renderFeedbackList, (error) => toast("Les rétroactions ne sont pas accessibles : " + error.message, true));
      state.tasksUnsubscribe = subscribeActionTasks(renderActionTasks, (error) => toast("La liste des tâches n’est pas accessible : " + error.message, true));
    }
  } else {
    document.body.classList.remove("cockpit-admin");
    state.feedbackUnsubscribe?.();
    state.tasksUnsubscribe?.();
    state.feedbackUnsubscribe = null;
    state.tasksUnsubscribe = null;
    document.querySelector("#cockpit-task-launch")?.remove();
  }
  addFooterCredit();
  enhanceCards();
  enhanceSectionFeedback();
  enhanceCalendarButtons();
  if (IMAGE_ATTACHMENTS_ENABLED) enhanceAttachmentEvents();
  state.attachmentUnsubscribe?.();
  state.attachmentUnsubscribe = null;
  if (IMAGE_ATTACHMENTS_ENABLED && configured) {
    state.attachmentUnsubscribe = subscribeImageAttachments((rows) => {
      state.attachments = rows;
      renderAttachmentBlocks();
    }, (error) => toast("Les visuels ne sont pas accessibles : " + error.message, true));
  }
  buildFeedbackWidget();
  syncCardAccess();
}

function applySignedOut(message = "") {
  if (activeRecognition) stopDictation("Session fermée.");
  state.profile = null;
  state.user = null;
  state.rows = new Map();
  state.scheduleUnsubscribe?.();
  state.auditUnsubscribe?.();
  state.feedbackUnsubscribe?.();
  state.tasksUnsubscribe?.();
  state.attachmentUnsubscribe?.();
  state.scheduleUnsubscribe = null;
  state.auditUnsubscribe = null;
  state.feedbackUnsubscribe = null;
  state.tasksUnsubscribe = null;
  state.attachmentUnsubscribe = null;
  state.attachments = [];
  state.tasks = [];
  pastEventsVisible = false;
  clearPrivateContent();
  document.body.classList.add("cockpit-locked");
  document.querySelector("#cockpit-session")?.remove();
  document.querySelector("#cockpit-sidebar")?.remove();
  document.querySelector("#cockpit-sidebar-toggle")?.remove();
  document.querySelector("#cockpit-task-launch")?.remove();
  document.querySelector("#cockpit-debug-launch")?.remove();
  document.querySelector("#cockpit-debug-panel")?.remove();
  document.querySelector("#cockpit-feedback-launch")?.remove();
  document.querySelector("#cockpit-feedback-panel")?.remove();
  document.body.classList.remove("cockpit-admin");
  debugState.events = [];
  debugState.open = false;
  document.body.classList.add("cockpit-readonly");
  const login = document.querySelector("#cockpit-login") || buildLogin();
  login.removeAttribute("hidden");
  const note = login.querySelector("#cockpit-login-note");
  if (demoMode) {
    note.textContent = "L’aperçu local ne charge pas de contenu stratégique.";
    return;
  }
  note.textContent = configured
    ? "Les droits et le nom affiché sont récupérés depuis Firebase après connexion."
    : "Firebase n’est pas encore raccordé. Renseignez firebase-config.js avec la configuration Web du projet.";
  if (message) login.querySelector("#cockpit-login-error").textContent = message;
}

function subscribeRemoteData() {
  if (!configured || !state.profile) return;
  state.scheduleUnsubscribe?.();
  state.scheduleUnsubscribe = subscribeScheduleItems((rows) => {
    state.rows = new Map(rows.map((row) => [row.id, row]));
    applyRemoteRows();
  }, (error) => toast("Le calendrier n’est pas accessible : " + error.message, true));
}

function start() {
  document.body.classList.add("cockpit-locked");
  buildLogin();
  enhanceCardEvents();
  enhanceFeedbackListEvents();
  if (IMAGE_ATTACHMENTS_ENABLED) enhanceAttachmentEvents();
  const observer = new MutationObserver(() => enhanceCards());
  observer.observe(document.body, { childList: true, subtree: true });

  if (demoMode) {
    applySignedOut();
    return;
  }

  observeAuth((user, profile, error) => {
    if (error) {
      applySignedOut();
      return;
    }
    if (!user || !profile) {
      applySignedOut();
      return;
    }
    if (profile.active !== true) {
      logOut().catch(() => {});
      applySignedOut("Ce compte n’est pas autorisé à accéder au cockpit.");
      return;
    }
    state.user = user;
    applyProfile(profile)
      .then(() => subscribeRemoteData())
      .catch((reason) => {
        logOut().catch(() => {});
        applySignedOut(reason.message || "Le contenu sécurisé est indisponible.");
      });
  });
}

start();
