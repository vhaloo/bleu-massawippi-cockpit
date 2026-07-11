import {
  getClientState,
  fetchPrivateContent,
  fetchMediaConfig,
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
  addMediaLink,
  archiveMediaLink,
  subscribeMediaLinks,
  subscribeComments,
  updateOwnComment,
  archiveOwnComment,
  setWorkflowStage,
  subscribeWorkflowStates,
  setOpportunityStage,
  subscribeOpportunityStates
} from "./firebase-client.js?v=20260711-opportunities-v2";

const { configured } = getClientState();
const demoMode = new URLSearchParams(location.search).get("demo") === "1";
const state = { user: null, profile: null, rows: new Map(), mediaByEvent: new Map(), commentsByEvent: new Map(), workflows: new Map(), opportunities: new Map(), mediaConfig: null, tasks: [], auditUnsubscribe: null, feedbackUnsubscribe: null, tasksUnsubscribe: null, scheduleUnsubscribe: null, mediaUnsubscribe: null, commentsUnsubscribe: null, workflowUnsubscribe: null, opportunityUnsubscribe: null, contentLoaded: false };
let activeRecognition = null;
let activeTextarea = null;
let recognitionRestart = false;
let recognitionRestartTimer = null;
let recognitionLanguageIndex = 0;
let recognitionRestartAttempts = 0;
let microphoneRequestPending = false;
const recognitionLanguages = ["fr-CA", "fr-FR", "en-CA", "en-US"];
const terminalRecognitionErrors = new Set(["not-allowed", "service-not-allowed", "audio-capture", "network", "aborted"]);
const guideCollapsedKey = "bleu-massawippi-guide-collapsed";
const guideSeenVersionKey = "bleu-massawippi-guide-seen-version";
const projectCollapsedKey = "bleu-massawippi-projects-collapsed";
const projectSeenVersionKey = "bleu-massawippi-projects-seen-version";

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
  .cockpit-decision-guide { margin:0 0 9px; padding:10px 11px; border:1px solid #b9dde2; border-radius:11px; color:#315d6b; background:#eef9fa; font-size:.72rem; line-height:1.45; }
  .cockpit-decision-guide b { display:block; margin-bottom:3px; color:#073a52; font-size:.76rem; }
  .cockpit-control-label { flex-basis:100%; margin:0 0 2px; color:#315564; font-size:.7rem; font-weight:900; }
  .cockpit-control-help { flex-basis:100%; margin:1px 0 3px; color:#67828d; font-size:.66rem; line-height:1.38; }
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
  .cockpit-media { margin-top: 10px; overflow: hidden; border: 1px solid #cfe3e6; border-radius: 12px; background: #fff; }
  .cockpit-media > summary { display: flex; align-items: center; gap: 7px; padding: 9px 11px; color: #174e62; font-size: .76rem; }
  .cockpit-media > summary:after { margin-left: auto; }
  .cockpit-media-count { display: inline-grid; min-width: 21px; min-height: 21px; padding: 0 6px; place-items: center; border-radius: 999px; color: #fff; background: #0b7895; font-size: .66rem; }
  .cockpit-media-body { padding: 0 10px 10px; }
  .cockpit-media-gallery { display: flex; gap: 9px; overflow-x: auto; padding: 3px 1px 9px; scroll-snap-type: x proximity; }
  .cockpit-media-empty { margin: 4px 0 9px; color: #67828d; font-size: .72rem; }
  .cockpit-media-card { position: relative; flex: 0 0 min(220px, 78vw); overflow: hidden; scroll-snap-align: start; border: 1px solid #d3e6e8; border-radius: 11px; background: #f7fbfb; }
  .cockpit-media-card.is-final { border:3px solid #21866d; box-shadow:0 0 0 3px rgba(33,134,109,.14); }
  .cockpit-media-preview { display: grid; min-height: 128px; place-items: center; overflow: hidden; color: #0b6077; background: #e9f4f5; text-decoration: none; }
  .cockpit-media-preview img { display: block; width: 100%; height: 150px; object-fit: cover; }
  .cockpit-media-icon { font-size: 2rem; }
  .cockpit-media-meta { padding: 8px 9px 10px; }
  .cockpit-media-meta b { display: block; overflow: hidden; color: #174e62; font-size: .73rem; text-overflow: ellipsis; white-space: nowrap; }
  .cockpit-media-meta p { margin: 3px 0 0; color: #64808a; font-size: .66rem; line-height: 1.35; }
  .cockpit-media-stage { display: inline-block; margin-top: 5px; padding: 2px 6px; border-radius: 999px; color: #0b6077; background: #dff3f3; font-size: .61rem; font-weight: 850; }
  .cockpit-media-final-badge { display:block; margin-top:6px; color:#155c4e; font-size:.66rem; font-weight:900; }
  .cockpit-media-final-action { width:calc(100% - 16px); margin:0 8px 9px; padding:7px; border:1px solid #21866d; border-radius:8px; color:#155c4e; background:#e3f5ee; font-size:.66rem; font-weight:900; cursor:pointer; }
  .cockpit-media-comment { display:grid; grid-template-columns:1fr auto; gap:6px; margin:0 8px 9px; }
  .cockpit-media-comment input { min-width:0; padding:7px; border:1px solid #c9dde0; border-radius:8px; color:#294d59; background:#fff; font-size:.66rem; }
  .cockpit-media-comment button { padding:7px 9px; border:1px solid #0b7895; border-radius:8px; color:#fff; background:#0b7895; font-size:.66rem; font-weight:900; cursor:pointer; }
  .cockpit-media-card button[data-archive-media] { position: absolute; top: 6px; right: 6px; min-width: 27px; padding: 4px; border: 1px solid rgba(255,255,255,.75); border-radius: 999px; color: #fff; background: rgba(68,48,48,.76); cursor: pointer; }
  .cockpit-media-form { display: grid; grid-template-columns: minmax(0,1.5fr) minmax(120px,.8fr) auto; gap: 6px; padding-top: 9px; border-top: 1px solid #d8e8ea; }
  .cockpit-media-form input, .cockpit-media-form select { min-width: 0; padding: 7px; border: 1px solid #d1e3e6; border-radius: 8px; color: #264a58; background: #fff; font: inherit; font-size: .7rem; }
  .cockpit-media-form [name="media-note"] { grid-column: 1 / 3; }
  .cockpit-media-form button { grid-column: 3; grid-row: 1 / 3; padding: 7px 10px; border: 0; border-radius: 8px; color: #fff; background: #0b7895; font-size: .7rem; font-weight: 850; cursor: pointer; }
  .cockpit-media-tools { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; margin-top: 8px; }
  .cockpit-media-folder { display: inline-block; padding: 6px 9px; border: 1px solid #0b7895; border-radius: 999px; color: #0b6077; font-size: .68rem; font-weight: 850; text-decoration: none; }
  .cockpit-media-note { margin: 0; color: #6b858d; font-size: .65rem; }
  .cockpit-brand-logo { display:block; width:clamp(115px,14vw,190px); height:auto; margin:0 0 14px; object-fit:contain; }
  .mast .cockpit-brand-logo { display:inline-block; width:96px; margin:0 10px 0 0; vertical-align:middle; }
  .cockpit-workflow { margin:12px 0 0; padding:13px; border:2px solid #8dcfd4; border-radius:14px; background:#f8fdfd; box-shadow:0 7px 18px rgba(7,58,82,.07); }
  .cockpit-workflow h5 { margin:0; color:#073a52; font-size:.86rem; }
  .cockpit-workflow-intro { margin:3px 0 10px; color:#587680; font-size:.69rem; line-height:1.4; }
  .cockpit-workflow-gates { display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
  .cockpit-workflow-gate { position:relative; min-height:76px; padding:9px 8px 8px 32px; border:1px solid #d5e6e8; border-radius:10px; color:#607b85; background:#f4f8f9; font-size:.66rem; text-align:left; }
  .cockpit-workflow-gate:before { position:absolute; left:9px; top:10px; display:grid; width:17px; height:17px; place-items:center; border:2px solid #9db4bc; border-radius:5px; content:""; color:#fff; background:#fff; font-size:.7rem; font-weight:900; }
  .cockpit-workflow-gate b { display:block; margin-bottom:3px; color:#315564; font-size:.7rem; }
  .cockpit-workflow-gate span { display:block; line-height:1.35; }
  .cockpit-workflow-gate.done { color:#155c4e; border-color:#8ec8b5; background:#e3f5ee; font-weight:850; }
  .cockpit-workflow-gate.done:before { border-color:#21866d; content:"✓"; background:#21866d; }
  .cockpit-workflow-gate.current { border-color:#d7a33f; background:#fff8e8; box-shadow:0 0 0 2px rgba(215,163,63,.13); }
  .cockpit-workflow-actions { display:flex; flex-wrap:wrap; gap:5px; margin-top:7px; }
  .cockpit-workflow-actions button { min-height:38px; padding:8px 11px; border:1px solid #0b7895; border-radius:10px; color:#0b6077; background:#fff; font-size:.7rem; font-weight:900; cursor:pointer; }
  .cockpit-workflow-actions button.primary { color:#fff; background:#0b7895; box-shadow:0 5px 13px rgba(11,120,149,.2); }
  .cockpit-workflow-actions button.correction { color:#7a4d10; border-color:#d7a33f; background:#fff8e8; }
  .cockpit-workflow-complete { margin:8px 0 0; padding:8px 10px; border-radius:9px; color:#155c4e; background:#e3f5ee; font-size:.7rem; font-weight:850; }
  .post.workflow-complete { box-shadow:0 0 0 2px rgba(33,134,109,.18); }
  .post.workflow-complete:after { position:absolute; top:10px; right:10px; z-index:2; padding:3px 7px; border-radius:999px; content:"✓ Terminé"; color:#155c4e; background:#dff4ea; font-size:.62rem; font-weight:900; }
  .ready { display:none !important; }
  .cockpit-thread { margin-top:10px; padding-top:9px; border-top:1px solid #d8e8ea; }
  .cockpit-thread h5 { margin:0 0 7px; color:#174e62; font-size:.76rem; }
  .cockpit-thread-empty { margin:0; color:#718993; font-size:.68rem; }
  .cockpit-message { margin-top:6px; padding:8px 9px; border:1px solid #d7e7e9; border-radius:10px; background:#fff; }
  .cockpit-message header { display:flex; justify-content:space-between; gap:7px; color:#607b85; font-size:.62rem; }
  .cockpit-message header b { color:#174e62; }
  .cockpit-message p { margin:4px 0 0; color:#365b69; font-size:.72rem; white-space:pre-wrap; }
  .cockpit-message-actions { display:flex; gap:5px; margin-top:5px; }
  .cockpit-message-actions button { padding:3px 6px; border:1px solid #c8dde0; border-radius:6px; color:#315564; background:#f8fbfb; font-size:.6rem; cursor:pointer; }
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
    .cockpit-media-form { grid-template-columns: 1fr; }
    .cockpit-media-form [name="media-note"], .cockpit-media-form button { grid-column: 1; grid-row: auto; }
    .cockpit-workflow-gates { grid-template-columns:1fr; }
  }
`;
document.head.appendChild(style);

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  })[char]);
}

function toast(message, error = false) {
  const existing = document.querySelector(".cockpit-toast");
  if (existing) existing.remove();
  const node = document.createElement("div");
  node.className = "cockpit-toast" + (error ? " error" : "");
  node.textContent = message;
  document.body.appendChild(node);
  setTimeout(() => node.remove(), 4200);
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
    const note = login.querySelector("#cockpit-login-note");
    const submit = event.currentTarget.querySelector("button[type=submit]");
    error.textContent = "";
    note.textContent = "Connexion en cours…";
    submit.disabled = true;
    submit.textContent = "Connexion…";
    try {
      await signIn(login.querySelector("#cockpit-email").value.trim(), login.querySelector("#cockpit-password").value);
    } catch (reason) {
      const timedOut = /délai|timeout/i.test(reason?.message || "");
      error.textContent = timedOut
        ? "Le service de connexion ne répond pas. Vérifiez votre réseau puis réessayez."
        : "Connexion refusée. Vérifiez les identifiants.";
      note.textContent = "";
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
  projets: "Projets et candidatures",
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

function setupGuidePreference() {
  const guide = document.querySelector("#context-collapsible");
  const summary = guide?.querySelector(":scope > summary");
  if (!guide || !summary || guide.dataset.preferenceReady === "true") return;
  guide.dataset.preferenceReady = "true";

  const version = guide.dataset.layoutVersion || "1";
  const storedPreference = localStorage.getItem(guideCollapsedKey);
  const lastSeenVersion = localStorage.getItem(guideSeenVersionKey);
  const collapseAtStartup = storedPreference === "1";
  const isFirstVisit = storedPreference === null && lastSeenVersion === null;
  const hasUpdate = !isFirstVisit && lastSeenVersion !== version;

  const oldHint = summary.querySelector("small");
  const actions = document.createElement("span");
  actions.className = "guide-summary-actions";
  if (oldHint) actions.appendChild(oldHint);
  actions.insertAdjacentHTML("beforeend", `
    <label class="guide-startup-control" title="Conserver le guide replié lors des prochaines visites">
      <input type="checkbox" data-guide-collapse-default ${collapseAtStartup ? "checked" : ""}>
      <span>Masquer au démarrage</span>
    </label>
    <b class="guide-new-badge" data-guide-new-badge ${hasUpdate ? "" : "hidden"}>✨ Nouveauté</b>`);
  summary.appendChild(actions);

  const checkbox = actions.querySelector("[data-guide-collapse-default]");
  const badge = actions.querySelector("[data-guide-new-badge]");
  const updateHint = () => { if (oldHint) oldHint.textContent = guide.open ? "Réduire" : "Afficher"; };
  const markSeen = () => {
    localStorage.setItem(guideSeenVersionKey, version);
    badge.hidden = true;
    guide.classList.remove("has-guide-update");
  };

  guide.open = !collapseAtStartup;
  if (hasUpdate) guide.classList.add("has-guide-update");
  if (isFirstVisit) localStorage.setItem(guideSeenVersionKey, version);
  updateHint();

  actions.addEventListener("click", (event) => event.stopPropagation());
  checkbox.addEventListener("change", () => {
    localStorage.setItem(guideCollapsedKey, checkbox.checked ? "1" : "0");
    guide.open = !checkbox.checked;
    if (guide.open) {
      guide.classList.add("guide-new-focus");
      markSeen();
      setTimeout(() => guide.classList.remove("guide-new-focus"), 1300);
    }
    updateHint();
  });
  badge.addEventListener("click", () => {
    guide.open = true;
    guide.classList.add("guide-new-focus");
    markSeen();
    updateHint();
    setTimeout(() => guide.classList.remove("guide-new-focus"), 1300);
  });
  guide.addEventListener("toggle", () => {
    updateHint();
    if (guide.open && hasUpdate) markSeen();
  });
}

const opportunityStageLabels = {
  watch: "Repéré",
  research: "Éligibilité à vérifier",
  active: "En préparation",
  submitted: "Déposé · réponse attendue",
  completed: "Finalisé · archivé"
};

function setupProjectPreference() {
  const project = document.querySelector("[data-project-register]");
  const summary = project?.querySelector(":scope > summary");
  if (!project || !summary || project.dataset.preferenceReady === "true") return;
  project.dataset.preferenceReady = "true";
  const version = project.dataset.layoutVersion || "1";
  const storedPreference = localStorage.getItem(projectCollapsedKey);
  const lastSeenVersion = localStorage.getItem(projectSeenVersionKey);
  const firstVisit = storedPreference === null && lastSeenVersion === null;
  const collapseAtStartup = storedPreference === null ? true : storedPreference === "1";
  const hasUpdate = !firstVisit && lastSeenVersion !== version;
  if (storedPreference === null) localStorage.setItem(projectCollapsedKey, "1");

  const oldHint = summary.querySelector("small");
  const actions = document.createElement("span");
  actions.className = "project-summary-actions";
  if (oldHint) actions.appendChild(oldHint);
  actions.insertAdjacentHTML("beforeend", `<label class="guide-startup-control" title="Conserver les projets repliés lors des prochaines visites"><input type="checkbox" data-project-collapse-default ${collapseAtStartup ? "checked" : ""}><span>Masquer au démarrage</span></label><b class="project-new-badge" data-project-new-badge ${hasUpdate ? "" : "hidden"}>✨ Nouveau</b>`);
  summary.appendChild(actions);
  const checkbox = actions.querySelector("[data-project-collapse-default]");
  const badge = actions.querySelector("[data-project-new-badge]");
  const updateHint = () => { if (oldHint) oldHint.textContent = project.open ? "Réduire" : "Afficher"; };
  const markSeen = () => {
    localStorage.setItem(projectSeenVersionKey, version);
    badge.hidden = true;
    project.classList.remove("has-project-update");
  };
  project.open = firstVisit ? true : !collapseAtStartup;
  if (firstVisit) localStorage.setItem(projectSeenVersionKey, version);
  if (hasUpdate) project.classList.add("has-project-update");
  updateHint();
  actions.addEventListener("click", (event) => event.stopPropagation());
  checkbox.addEventListener("change", () => {
    localStorage.setItem(projectCollapsedKey, checkbox.checked ? "1" : "0");
    project.open = !checkbox.checked;
    if (project.open) markSeen();
    updateHint();
  });
  badge.addEventListener("click", () => { project.open = true; markSeen(); updateHint(); });
  project.addEventListener("toggle", () => { updateHint(); if (project.open && hasUpdate) markSeen(); });
}

function opportunityWhen(row) {
  return row?.updatedAt?.toDate ? row.updatedAt.toDate().toLocaleString("fr-CA", { dateStyle:"short", timeStyle:"short" }) : "état initial du registre";
}

function renderOpportunityStates() {
  const project = document.querySelector("[data-project-register]");
  if (!project) return;
  let archived = 0;
  document.querySelectorAll(".opportunity[data-opportunity-id]").forEach((card) => {
    const row = state.opportunities.get(card.dataset.opportunityId);
    const stage = row?.stage || card.dataset.initialStage || "watch";
    const completed = stage === "completed";
    if (completed) archived += 1;
    card.classList.toggle("is-archived", completed);
    const label = card.querySelector("[data-opportunity-stage-label]");
    if (label) label.textContent = opportunityStageLabels[stage] || "Repéré";
    const host = card.querySelector("[data-opportunity-controls]");
    if (!host) return;
    const buttons = Object.entries(opportunityStageLabels).map(([value, text]) => `<button type="button" data-opportunity-stage="${value}" class="${stage === value ? "active" : ""}" aria-pressed="${stage === value}">${text}</button>`).join("");
    host.innerHTML = `<div class="opportunity-stage-controls"><b>Où en sommes-nous? Choix partagé entre la direction et les communications.</b><div class="opportunity-stage-buttons">${buttons}</div><span class="opportunity-stage-meta">${row ? `Mis à jour par ${esc(row.updatedByLabel || "un utilisateur")} · ${esc(opportunityWhen(row))}` : "État proposé à confirmer dans le cockpit."}</span></div>`;
  });
  const count = project.querySelector("[data-opportunity-archive-count]");
  if (count) count.textContent = String(archived);
}

function setupOpportunityEvents() {
  if (document.body.dataset.opportunityEventsReady === "true") return;
  document.body.dataset.opportunityEventsReady = "true";
  document.addEventListener("click", (event) => {
    const archiveToggle = event.target.closest("[data-toggle-opportunity-archives]");
    if (archiveToggle) {
      const project = document.querySelector("[data-project-register]");
      const active = !project.classList.contains("show-opportunity-archives");
      project.classList.toggle("show-opportunity-archives", active);
      archiveToggle.setAttribute("aria-pressed", String(active));
      archiveToggle.firstChild.textContent = active ? "Masquer les archives " : "Voir les archives ";
      return;
    }
    const button = event.target.closest("button[data-opportunity-stage]");
    if (!button || !state.profile || !["director", "admin"].includes(state.profile.role)) return;
    const card = button.closest(".opportunity[data-opportunity-id]");
    if (!card) return;
    button.disabled = true;
    setOpportunityStage(card.dataset.opportunityId, button.dataset.opportunityStage, state.profile)
      .then(async () => {
        await writeAuditLog("opportunity:" + card.dataset.opportunityId, "étape : " + button.dataset.opportunityStage, state.profile);
        toast(button.dataset.opportunityStage === "completed" ? "Occasion finalisée et classée dans les archives." : "Étape de l’occasion enregistrée.");
      })
      .catch((error) => toast(error.message, true))
      .finally(() => { button.disabled = false; });
  });
}

const mediaStageLabels = {
  source: "Source",
  draft: "En révision",
  approved: "Approuvé",
  published: "Publié",
  reference: "Référence"
};

const mediaKindIcons = {
  video: "🎬",
  pdf: "📄",
  document: "📎",
  folder: "📁",
  other: "🔗"
};

function safeMediaUrl(value) {
  try {
    const parsed = new URL(String(value || ""));
    const host = parsed.hostname.toLowerCase();
    if (parsed.protocol !== "https:") return "";
    if (!host.endsWith(".sharepoint.com") && host !== "1drv.ms" && host !== "onedrive.live.com") return "";
    return parsed.href;
  } catch {
    return "";
  }
}

function mediaPreviewUrl(row) {
  const url = safeMediaUrl(row.url);
  if (!url || row.kind !== "image") return "";
  const parsed = new URL(url);
  if (parsed.hostname.toLowerCase().endsWith(".sharepoint.com") && parsed.pathname.includes("/:i:/")) {
    parsed.searchParams.set("download", "1");
    return parsed.href;
  }
  return /\.(jpe?g|png|webp|gif)(?:$|\?)/i.test(url) ? url : "";
}

function renderMediaForCard(card) {
  const gallery = card.querySelector("[data-media-gallery]");
  const count = card.querySelector("[data-media-count]");
  if (!gallery || !count) return;
  const rows = (state.mediaByEvent.get(card.dataset.itemId) || []).filter((row) => row.archived !== true && safeMediaUrl(row.url));
  const decisions = (state.commentsByEvent.get(card.dataset.itemId) || []).filter((row) => row.deleted !== true && /^\[MÉDIA RETENU:/.test(row.comment || ""));
  const latestDecision = decisions.at(-1)?.comment || "";
  count.textContent = String(rows.length);
  if (!rows.length) {
    gallery.innerHTML = `<p class="cockpit-media-empty">Aucun média lié. Déposez le fichier dans OneDrive, créez un lien de consultation, puis ajoutez-le ici.</p>`;
    return;
  }
  gallery.innerHTML = rows.map((row) => {
    const url = safeMediaUrl(row.url);
    const preview = mediaPreviewUrl(row);
    const visual = preview
      ? `<img data-media-preview src="${esc(preview)}" alt="${esc(row.label || "Aperçu du média")}" loading="lazy">`
      : `<span class="cockpit-media-icon" aria-hidden="true">${mediaKindIcons[row.kind] || "🔗"}</span>`;
    const isFinal = latestDecision.startsWith(`[MÉDIA RETENU:${row.id}]`);
    return `<article class="cockpit-media-card ${isFinal ? "is-final" : ""}" data-media-id="${esc(row.id)}">
      <a class="cockpit-media-preview" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="Ouvrir ${esc(row.label || "le média")} dans une nouvelle fenêtre">${visual}</a>
      <div class="cockpit-media-meta"><b title="${esc(row.label || "Média OneDrive")}">${esc(row.label || "Média OneDrive")}</b>${row.note ? `<p>${esc(row.note)}</p>` : ""}<span class="cockpit-media-stage">${esc(mediaStageLabels[row.stage] || "Référence")}</span>${isFinal ? `<span class="cockpit-media-final-badge">✓ Média final retenu par la direction</span>` : ""}</div>
      ${["director","admin"].includes(state.profile?.role) ? `<button type="button" class="cockpit-media-final-action" data-select-final-media="${esc(row.id)}" data-media-label="${esc(row.label || "Média OneDrive")}" aria-pressed="${isFinal}">${isFinal ? "✓ Média final choisi" : "Choisir ce média"}</button><div class="cockpit-media-comment"><input type="text" maxlength="1000" data-media-comment="${esc(row.id)}" placeholder="Dire quelque chose sur ce média…" aria-label="Commentaire sur ${esc(row.label || "ce média")}"><button type="button" data-save-media-comment="${esc(row.id)}" data-media-label="${esc(row.label || "Média OneDrive")}">Envoyer</button></div>` : ""}
      ${canEdit() ? `<button type="button" data-archive-media="${esc(row.id)}" aria-label="Archiver ce lien média" title="Archiver sans supprimer">×</button>` : ""}
    </article>`;
  }).join("");
  gallery.querySelectorAll("img[data-media-preview]").forEach((image) => {
    image.addEventListener("error", () => {
      const replacement = document.createElement("span");
      replacement.className = "cockpit-media-icon";
      replacement.textContent = "🖼️";
      image.replaceWith(replacement);
    }, { once: true });
  });
}

function renderAllMedia() {
  document.querySelectorAll(".post[data-item-id]").forEach(renderMediaForCard);
}

function mediaControlsMarkup(planItem) {
  const folderUrl = safeMediaUrl(state.mediaConfig?.folderUrl || state.mediaConfig?.folderViewUrl || "");
  return `<details class="cockpit-media" open>
    <summary>Médias OneDrive <span class="cockpit-media-count" data-media-count>0</span></summary>
    <div class="cockpit-media-body">
      <div class="cockpit-media-gallery" data-media-gallery></div>
      <form class="cockpit-media-form" data-media-form data-event-id="${esc(planItem.id)}">
        <input type="url" name="media-url" maxlength="2048" required placeholder="Lien de consultation OneDrive / SharePoint" aria-label="Lien OneDrive ou SharePoint">
        <input type="text" name="media-label" maxlength="180" required placeholder="Nom du média" aria-label="Nom du média">
        <select name="media-kind" aria-label="Type de média"><option value="image">Image</option><option value="video">Vidéo</option><option value="pdf">PDF</option><option value="document">Document</option><option value="folder">Dossier</option><option value="other">Autre lien</option></select>
        <input type="text" name="media-note" maxlength="1000" placeholder="Note facultative : source, droits, correction demandée…" aria-label="Note sur le média">
        <select name="media-stage" aria-label="Étape du média"><option value="source">Source</option><option value="draft" selected>En révision</option><option value="approved">Approuvé</option><option value="published">Publié</option><option value="reference">Référence</option></select>
        <button type="submit">Ajouter le lien</button>
      </form>
      <div class="cockpit-media-tools">${folderUrl ? `<a class="cockpit-media-folder" href="${esc(folderUrl)}" target="_blank" rel="noopener noreferrer">Déposer dans Media Cockpit ↗</a>` : ""}<p class="cockpit-media-note">Les fichiers restent dans OneDrive. Le cockpit conserve seulement les liens et leur étape.</p></div>
    </div>
  </details>`;
}

const workflowOrder = ["proposal", "content_review", "changes_requested", "content_approved", "media_review", "final_approved", "scheduled", "published"];
function workflowRank(stage) { return workflowOrder.indexOf(stage || "proposal"); }

function workflowMarkup(planItem) {
  return `<section class="cockpit-workflow" data-workflow><h5>Les 3 feux verts</h5><p class="cockpit-workflow-intro">Le texte et le visuel sont validés par la direction, ou par les communications lorsque son aval a déjà été donné. Une fois les deux feux verts obtenus, la publication peut être programmée puis terminée.</p><div class="cockpit-workflow-gates"><div class="cockpit-workflow-gate" data-gate="content"><b>1 · Texte</b><span data-gate-label>À valider</span></div><div class="cockpit-workflow-gate" data-gate="media"><b>2 · Visuel</b><span data-gate-label>Commence après le texte</span></div><div class="cockpit-workflow-gate" data-gate="publication"><b>3 · Terminé</b><span data-gate-label>Publié ou programmé</span></div></div><div class="cockpit-workflow-actions" data-workflow-actions data-event-id="${esc(planItem.id)}"></div><p class="cockpit-workflow-complete" data-workflow-complete hidden>Tout est terminé. Cet événement reste conservé et consultable.</p></section>`;
}

function renderWorkflow(card) {
  const row = state.workflows.get(card.dataset.itemId) || { stage: "proposal" };
  const stage = row.stage || "proposal";
  const contentDone = ["content_approved","media_review","final_approved","scheduled","published"].includes(stage);
  const mediaDone = ["final_approved","scheduled","published"].includes(stage);
  const publicationDone = ["scheduled","published"].includes(stage);
  const contentGate = card.querySelector('[data-gate="content"]');
  const mediaGate = card.querySelector('[data-gate="media"]');
  const publicationGate = card.querySelector('[data-gate="publication"]');
  contentGate?.classList.toggle("done", contentDone);
  mediaGate?.classList.toggle("done", mediaDone);
  publicationGate?.classList.toggle("done", publicationDone);
  [contentGate,mediaGate,publicationGate].forEach((gate) => gate?.classList.remove("current"));
  if (!contentDone) contentGate?.classList.add("current"); else if (!mediaDone) mediaGate?.classList.add("current"); else if (!publicationDone) publicationGate?.classList.add("current");
  const contentLabel = contentGate?.querySelector("[data-gate-label]");
  const mediaLabel = mediaGate?.querySelector("[data-gate-label]");
  const publicationLabel = publicationGate?.querySelector("[data-gate-label]");
  if (contentLabel) contentLabel.textContent = contentDone ? "Approuvé" : (stage === "changes_requested" ? "Corrections demandées" : stage === "content_review" ? "Prêt pour validation" : "En préparation");
  if (mediaLabel) mediaLabel.textContent = mediaDone ? "Approuvé" : (stage === "media_review" ? "Prêt pour validation" : contentDone ? "En production" : "Attend le texte");
  if (publicationLabel) publicationLabel.textContent = publicationDone ? "Publié ou programmé" : mediaDone ? "Prêt à publier" : "Attend les 2 validations";
  card.classList.toggle("workflow-complete", publicationDone);
  const completeNote = card.querySelector("[data-workflow-complete]");
  if (completeNote) completeNote.hidden = !publicationDone;
  const actions = card.querySelector("[data-workflow-actions]");
  if (!actions) return;
  const buttons = [];
  if (state.profile?.role === "admin") {
    if (["proposal","changes_requested"].includes(stage)) buttons.push(["content_review","Texte prêt — envoyer à la direction","primary"]);
    if (["proposal","content_review","changes_requested"].includes(stage)) buttons.push(["content_approved","✓ Valider le texte avec l’aval de la direction","primary"]);
    if (["content_approved"].includes(stage)) buttons.push(["media_review","Visuel prêt — envoyer à la direction","primary"]);
    if (["content_approved","media_review"].includes(stage)) buttons.push(["final_approved","✓ Valider le visuel avec l’aval de la direction","primary"]);
    if (["final_approved","scheduled"].includes(stage)) buttons.push(["published","✓ Terminer — publié ou programmé","primary"]);
  }
  if (state.profile?.role === "director") {
    if (["content_review","proposal","changes_requested"].includes(stage)) buttons.push(["content_approved","✓ Approuver le texte et le concept","primary"]);
    if (stage === "content_review") buttons.push(["changes_requested","Correction demandée au texte","correction"]);
    const mediaDecision = (state.commentsByEvent.get(card.dataset.itemId) || []).filter((comment) => comment.deleted !== true && /^\[MÉDIA RETENU:/.test(comment.comment || "")).at(-1);
    const finalMediaCount = mediaDecision ? 1 : 0;
    if (stage === "media_review" && finalMediaCount > 0) buttons.push(["final_approved",`✓ Approuver ${finalMediaCount > 1 ? finalMediaCount + " médias retenus" : "le média retenu"}`,"primary"]);
    if (stage === "media_review" && finalMediaCount === 0) buttons.push(["","Choisir d’abord un média ci-dessus","disabled"]);
    if (stage === "media_review") buttons.push(["changes_requested","Correction demandée au visuel","correction"]);
  }
  const waiting = state.profile?.role === "director" && stage === "content_approved" ? "Le texte est approuvé. Les communications produisent maintenant le visuel." : state.profile?.role === "director" && stage === "final_approved" ? "Vos deux validations sont faites. Les communications peuvent publier." : publicationDone ? "Événement terminé; rien ne disparaît de la base de données." : `Étape actuelle : ${stage.replaceAll("_", " ")}`;
  actions.innerHTML = buttons.map(([value,label,kind]) => `<button type="button" class="${kind}" ${value ? `data-workflow-stage="${value}"` : "disabled"}>${label}</button>`).join("") || `<span class="cockpit-media-note">${esc(waiting)}</span>`;
}

function renderCommentThread(card) {
  const host = card.querySelector("[data-comment-thread]");
  if (!host) return;
  const rows = (state.commentsByEvent.get(card.dataset.itemId) || []).filter((row) => row.deleted !== true);
  host.innerHTML = rows.length ? rows.map((row) => {
    const mine = row.authorUid === state.profile?.uid;
    const when = row.createdAt?.toDate ? row.createdAt.toDate().toLocaleString("fr-CA", { dateStyle:"short", timeStyle:"short" }) : "à l’instant";
    const edited = row.updatedAt?.toMillis && row.createdAt?.toMillis && row.updatedAt.toMillis() > row.createdAt.toMillis() + 1000;
    return `<article class="cockpit-message" data-comment-id="${esc(row.id)}"><header><b>Commentaire · ${esc(row.authorLabel || "Utilisateur")}</b><span>${esc(when)}${edited ? " · modifié" : ""}</span></header><p>${esc(row.comment || "")}</p>${mine ? `<div class="cockpit-message-actions"><button type="button" data-edit-comment="${esc(row.id)}">Modifier</button><button type="button" data-archive-comment="${esc(row.id)}">Archiver</button></div>` : ""}</article>`;
  }).join("") : `<p class="cockpit-thread-empty">Aucun commentaire pour cet événement.</p>`;
}

function renderAllCollaboration() {
  document.querySelectorAll(".post[data-item-id]").forEach((card) => { renderWorkflow(card); renderCommentThread(card); });
}

function installBrandLogo() {
  const url = safeMediaUrl(state.mediaConfig?.logoUrl || "");
  if (!url || document.querySelector(".cockpit-brand-logo")) return;
  const parsed = new URL(url); parsed.searchParams.set("download", "1");
  const img = document.createElement("img"); img.className = "cockpit-brand-logo"; img.src = parsed.href; img.alt = "Bleu Massawippi";
  document.querySelector(".hero > div")?.prepend(img);
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
      <div class="cockpit-decision-guide"><b>${state.profile?.role === "director" ? "Pour la direction : deux validations seulement" : "Lecture rapide de l’événement"}</b>${state.profile?.role === "director" ? "1. Approuver le texte. 2. Plus tard, approuver le visuel. Les boutons ci-dessous servent aux avis rapides; les deux vrais feux verts sont dans le bloc « Les 3 feux verts »." : "Les avis rapides alimentent le fil. Le bloc « Les 3 feux verts » indique exactement la prochaine action à accomplir."}</div>
      <div class="cockpit-status-row" aria-label="Statut de la publication">
        <p class="cockpit-control-label">Avis rapide sur la proposition</p>
        <button type="button" data-status="approved" aria-pressed="false">🟢 Approuvé</button>
        <button type="button" data-status="needs_work" aria-pressed="false">🟡 À retravailler</button>
        <button type="button" data-status="pending" aria-pressed="false">⚪ En attente</button>
        <button type="button" data-status="deleted" aria-label="Masquer virtuellement cette ligne" title="Masquer virtuellement cette ligne">✕</button>
        <p class="cockpit-control-help"><b>Approuvé</b> : l’idée est retenue. <b>À retravailler</b> : une correction est nécessaire. <b>En attente</b> : aucune décision pour le moment. Ces avis ne remplacent pas l’approbation officielle du texte et du visuel.</p>
      </div>
      <div class="cockpit-comment-row">
        <textarea data-comment maxlength="5000" spellcheck="true" autocapitalize="sentences" inputmode="text" placeholder="Ajouter une consigne ou un commentaire…" aria-label="Commentaire de pilotage"></textarea>
        <button type="button" data-dictate aria-pressed="false" aria-label="Dicter un commentaire" title="Dicter un commentaire">🎙️</button>
        <button class="save" type="button" data-save-comment>Enregistrer</button>
        <div class="cockpit-voice-status" data-voice-status aria-live="polite">Cliquez sur le micro, puis autorisez le microphone si demandé.</div>
      </div>
      <div class="cockpit-quick-row" aria-label="Badges rapides">
        <p class="cockpit-control-label">Ajouter une consigne rapide au fil</p>
        <button type="button" data-tag="cancel">🔴 À annuler</button>
        <button type="button" data-tag="delay">🟡 À décaler</button>
        <button type="button" data-tag="perfect">🟢 Parfait</button>
        <p class="cockpit-control-help"><b>À annuler</b> : retirer de la programmation sans supprimer l’historique. <b>À décaler</b> : déplacer à une autre date. <b>Parfait</b> : aucune correction sur l’élément commenté; ce n’est pas encore le feu vert final.</p>
      </div>
      ${workflowMarkup(planItem)}
      ${mediaControlsMarkup(planItem)}
      <section class="cockpit-thread"><h5>Fil de collaboration</h5><div data-comment-thread></div></section>`;
    card.appendChild(controls);
  });
  applyRemoteRows();
  renderAllMedia();
  renderAllCollaboration();
  syncCardAccess();
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
  activeRecognition = null;
  activeTextarea = null;
  setVoiceButtonState(textarea, false);
  setVoiceStatus(textarea, message, kind);
}

function stopDictation(message = "Dictée arrêtée.") {
  recognitionRestart = false;
  clearRecognitionRestartTimer();
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

async function requestMicrophoneAccess(textarea) {
  if (microphoneRequestPending) {
    setVoiceStatus(textarea, "La demande d’accès au microphone est déjà en cours…", "live");
    return false;
  }
  if (!navigator.mediaDevices?.getUserMedia) return true;
  microphoneRequestPending = true;
  setVoiceStatus(textarea, "Demande d’accès au microphone…", "live");
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return true;
  } catch (error) {
    const denied = error?.name === "NotAllowedError" || error?.name === "SecurityError";
    voiceFallback(textarea, denied
      ? "Le microphone est bloqué pour ce site. Autorisez-le dans les paramètres du navigateur, puis réessayez."
      : "Aucun microphone utilisable n’a été trouvé. Vérifiez le périphérique choisi dans le navigateur.");
    return false;
  } finally {
    microphoneRequestPending = false;
  }
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
    voiceFallback(textarea, "La reconnaissance vocale n’est pas exposée par ce navigateur.");
    toast("Utilisez la dictée du clavier ou du système dans ce navigateur.", true);
    return;
  }
  if (window.isSecureContext === false && !["localhost", "127.0.0.1"].includes(location.hostname)) {
    voiceFallback(textarea, "La dictée exige une connexion HTTPS.");
    return;
  }
  setVoiceButtonState(textarea, true);
  if (!(await requestMicrophoneAccess(textarea))) return;
  if (activeRecognition) stopDictation();
  let recognition;
  try {
    recognition = new Recognition();
  } catch (error) {
    voiceFallback(textarea, "Impossible d’ouvrir le service vocal de ce navigateur.");
    return;
  }
  activeRecognition = recognition;
  activeTextarea = textarea;
  recognitionRestart = true;
  recognitionLanguageIndex = 0;
  recognitionRestartAttempts = 0;
  recognition.lang = recognitionLanguages[recognitionLanguageIndex];
  // Une session courte, relancée proprement, est plus fiable que continuous=true
  // sur Chrome, Edge et Safari, qui interrompent tous trois les longues sessions.
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  setVoiceButtonState(textarea, true);
  setVoiceStatus(textarea, "Autorisez le microphone si le navigateur le demande…", "live");
  recognition.onstart = () => {
    recognitionRestartAttempts = 0;
    setVoiceButtonState(textarea, true);
    setVoiceStatus(textarea, "Écoute en cours… cliquez de nouveau sur le micro pour arrêter.", "live");
  };
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
      setVoiceStatus(textarea, "Aucune parole détectée; continuez à parler…", "live");
      return;
    }
    if (errorCode === "language-not-supported" && recognitionLanguageIndex < recognitionLanguages.length - 1) {
      recognitionLanguageIndex += 1;
      setVoiceStatus(textarea, "La langue régionale n’est pas disponible; nouvel essai en français…", "live");
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
    if (terminalRecognitionErrors.has(errorCode) || errorCode === "network") {
      finishDictation(recognition, textarea, "Le service vocal est indisponible. Utilisez la dictée du clavier ou du système.", "error");
      return;
    }
    finishDictation(recognition, textarea, `Dictée interrompue (${errorCode}). Cliquez sur le micro pour reprendre.`, "error");
  };
  recognition.onnomatch = () => setVoiceStatus(textarea, "Aucun mot reconnu; continuez à parler…", "live");
  recognition.onend = () => {
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

async function saveMediaForm(form) {
  if (!state.profile || !canEdit()) {
    toast("Votre session est en lecture seule.", true);
    return;
  }
  const submit = form.querySelector("button[type=submit]");
  submit.disabled = true;
  try {
    await addMediaLink(form.dataset.eventId, {
      url: form.elements["media-url"].value,
      label: form.elements["media-label"].value,
      kind: form.elements["media-kind"].value,
      stage: form.elements["media-stage"].value,
      note: form.elements["media-note"].value
    }, state.profile);
    form.reset();
    form.elements["media-stage"].value = "draft";
    await writeAuditLog(form.dataset.eventId, "lien média ajouté", state.profile);
    toast("Lien média ajouté.");
  } catch (error) {
    toast(error.message, true);
  } finally {
    submit.disabled = false;
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
    const workflowButton = event.target.closest("button[data-workflow-stage]");
    if (workflowButton) {
      setWorkflowStage(card.dataset.itemId, workflowButton.dataset.workflowStage, state.profile)
        .then(async () => {
          const planItem = getPlanItem(card);
          if (state.profile.role === "director" && ["content_approved","final_approved","changes_requested"].includes(workflowButton.dataset.workflowStage)) {
            await recordActionTask(`workflow-${card.dataset.itemId}`, { status: "pending", title: workflowButton.dataset.workflowStage === "final_approved" ? `Prêt à publier — ${planItem?.title}` : `Cycle de validation — ${planItem?.title}`, targetType:"schedule", targetId:card.dataset.itemId, targetLabel:`${planItem?.date || ""} · ${planItem?.title || ""}`, message:`Nouvelle étape : ${workflowButton.textContent.trim()}.\n\n${responsibilitySummary(planItem)}` });
          }
          toast("Étape de validation enregistrée.");
        }).catch((error) => toast(error.message, true));
      return;
    }
    const editCommentButton = event.target.closest("button[data-edit-comment]");
    if (editCommentButton) {
      const row = (state.commentsByEvent.get(card.dataset.itemId) || []).find((item) => item.id === editCommentButton.dataset.editComment);
      const next = prompt("Modifier votre commentaire :", row?.comment || "");
      if (next !== null) updateOwnComment(editCommentButton.dataset.editComment, next, state.profile).then(() => toast("Commentaire modifié.")).catch((error) => toast(error.message, true));
      return;
    }
    const archiveCommentButton = event.target.closest("button[data-archive-comment]");
    if (archiveCommentButton) {
      if (!confirm("Archiver ce commentaire? Son historique sera conservé.")) return;
      archiveOwnComment(archiveCommentButton.dataset.archiveComment, state.profile).then(() => toast("Commentaire archivé.")).catch((error) => toast(error.message, true));
      return;
    }
    const dictateButton = event.target.closest("button[data-dictate]");
    if (dictateButton) {
      event.preventDefault();
      event.stopPropagation();
      startDictation(card.querySelector("[data-comment]"));
      return;
    }
    const archiveButton = event.target.closest("button[data-archive-media]");
    if (archiveButton) {
      event.preventDefault();
      event.stopPropagation();
      if (!confirm("Archiver ce lien média? Le fichier OneDrive ne sera pas supprimé.")) return;
      archiveMediaLink(archiveButton.dataset.archiveMedia, state.profile)
        .then(() => toast("Lien média archivé."))
        .catch((error) => toast(error.message, true));
      return;
    }
    const finalMediaButton = event.target.closest("button[data-select-final-media]");
    if (finalMediaButton) {
      event.preventDefault();
      event.stopPropagation();
      if (finalMediaButton.getAttribute("aria-pressed") === "true") {
        toast("Ce média est déjà le choix final.");
        return;
      }
      const mediaId = finalMediaButton.dataset.selectFinalMedia;
      const label = finalMediaButton.dataset.mediaLabel || "Média OneDrive";
      addComment(card.dataset.itemId, `[MÉDIA RETENU:${mediaId}] ${label}`, state.profile, null, false)
        .then(async (commentId) => {
          const planItem = getPlanItem(card);
          await recordActionTask(`media-choice-${commentId}`, { status:"pending", title:`Média retenu — ${planItem?.title || card.dataset.itemId}`, targetType:"schedule", targetId:card.dataset.itemId, targetLabel:`${planItem?.date || ""} · ${label}`, message:`La direction a retenu « ${label} » comme média final.` });
          toast("Média final retenu. La décision est conservée dans le fil.");
        }).catch((error) => toast(error.message, true));
      return;
    }
    const mediaCommentButton = event.target.closest("button[data-save-media-comment]");
    if (mediaCommentButton) {
      event.preventDefault();
      event.stopPropagation();
      const mediaId = mediaCommentButton.dataset.saveMediaComment;
      const input = card.querySelector(`input[data-media-comment="${CSS.escape(mediaId)}"]`);
      const note = input?.value.trim() || "";
      if (!note) { toast("Écrivez d’abord votre commentaire sur ce média.", true); return; }
      const label = mediaCommentButton.dataset.mediaLabel || "Média OneDrive";
      addComment(card.dataset.itemId, `🎨 Média « ${label} » : ${note}`, state.profile, null, false)
        .then(async (commentId) => {
          const planItem = getPlanItem(card);
          await recordActionTask(`media-comment-${commentId}`, { status:"pending", title:`Commentaire média — ${planItem?.title || card.dataset.itemId}`, targetType:"schedule", targetId:card.dataset.itemId, targetLabel:`${planItem?.date || ""} · ${label}`, message:note });
          input.value = "";
          toast("Commentaire sur le média enregistré.");
        }).catch((error) => toast(error.message, true));
      return;
    }
    const statusButton = event.target.closest("button[data-status]");
    if (statusButton) {
      if (statusButton.dataset.status === "deleted" && !confirm("Masquer virtuellement cette ligne?")) return;
      changeStatus(card, statusButton.dataset.status);
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
  const planScript = document.createElement("script");
  planScript.textContent = content.script;
  document.body.appendChild(planScript);
  planScript.remove();
  setupGuidePreference();
  setupProjectPreference();
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
  const loginNote = document.querySelector("#cockpit-login-note");
  if (loginNote) loginNote.textContent = "Identifiants vérifiés. Chargement du cockpit…";
  state.mediaConfig = await fetchMediaConfig().catch((error) => {
    console.warn("Configuration OneDrive indisponible", error);
    return { folderUrl: "", folderViewUrl: "" };
  });
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
  installBrandLogo();
  enhanceCards();
  enhanceSectionFeedback();
  enhanceCalendarButtons();
  buildFeedbackWidget();
  setupOpportunityEvents();
  renderOpportunityStates();
  syncCardAccess();
}

function applySignedOut(message = "") {
  if (activeRecognition) stopDictation("Session fermée.");
  state.profile = null;
  state.user = null;
  state.rows = new Map();
  state.mediaByEvent = new Map();
  state.commentsByEvent = new Map();
  state.workflows = new Map();
  state.opportunities = new Map();
  state.mediaConfig = null;
  state.scheduleUnsubscribe?.();
  state.auditUnsubscribe?.();
  state.feedbackUnsubscribe?.();
  state.tasksUnsubscribe?.();
  state.mediaUnsubscribe?.();
  state.commentsUnsubscribe?.();
  state.workflowUnsubscribe?.();
  state.opportunityUnsubscribe?.();
  state.scheduleUnsubscribe = null;
  state.auditUnsubscribe = null;
  state.feedbackUnsubscribe = null;
  state.tasksUnsubscribe = null;
  state.mediaUnsubscribe = null;
  state.commentsUnsubscribe = null;
  state.workflowUnsubscribe = null;
  state.opportunityUnsubscribe = null;
  state.tasks = [];
  clearPrivateContent();
  document.body.classList.add("cockpit-locked");
  document.querySelector("#cockpit-session")?.remove();
  document.querySelector("#cockpit-sidebar")?.remove();
  document.querySelector("#cockpit-sidebar-toggle")?.remove();
  document.querySelector("#cockpit-task-launch")?.remove();
  document.querySelector("#cockpit-feedback-launch")?.remove();
  document.querySelector("#cockpit-feedback-panel")?.remove();
  document.body.classList.remove("cockpit-admin");
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
  state.mediaUnsubscribe?.();
  state.mediaUnsubscribe = subscribeMediaLinks((rows) => {
    const grouped = new Map();
    rows.forEach((row) => {
      const eventId = String(row.eventId || "");
      if (!grouped.has(eventId)) grouped.set(eventId, []);
      grouped.get(eventId).push(row);
    });
    state.mediaByEvent = grouped;
    renderAllMedia();
    renderAllCollaboration();
  }, (error) => toast("Les liens médias ne sont pas accessibles : " + error.message, true));
  state.commentsUnsubscribe?.();
  state.commentsUnsubscribe = subscribeComments((rows) => {
    const grouped = new Map();
    rows.forEach((row) => { const id=String(row.sectionId||""); if(!grouped.has(id)) grouped.set(id,[]); grouped.get(id).push(row); });
    state.commentsByEvent = grouped; renderAllCollaboration(); renderAllMedia();
  }, (error) => toast("Le fil de commentaires n’est pas accessible : " + error.message, true));
  state.workflowUnsubscribe?.();
  state.workflowUnsubscribe = subscribeWorkflowStates((rows) => {
    state.workflows = new Map(rows.map((row) => [row.eventId || row.id, row])); renderAllCollaboration();
  }, (error) => toast("Le cycle de validation n’est pas accessible : " + error.message, true));
  state.opportunityUnsubscribe?.();
  state.opportunityUnsubscribe = subscribeOpportunityStates((rows) => {
    state.opportunities = new Map(rows.map((row) => [row.opportunityId || row.id, row]));
    renderOpportunityStates();
  }, (error) => toast("Le suivi des occasions n’est pas accessible : " + error.message, true));
}

function start() {
  document.body.classList.add("cockpit-locked");
  buildLogin();
  enhanceCardEvents();
  enhanceFeedbackListEvents();
  let enhanceFrame = 0;
  const observer = new MutationObserver((mutations) => {
    const needsEnhancement = mutations.some(({ addedNodes }) => [...addedNodes].some((node) =>
      node.nodeType === Node.ELEMENT_NODE
      && (node.matches?.(".post") || node.querySelector?.(".post"))
    ));
    if (!needsEnhancement || enhanceFrame) return;
    enhanceFrame = requestAnimationFrame(() => {
      enhanceFrame = 0;
      enhanceCards();
    });
  });

  document.addEventListener("submit", (event) => {
    const form = event.target.closest("form[data-media-form]");
    if (!form) return;
    event.preventDefault();
    saveMediaForm(form);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  if (demoMode) {
    applySignedOut();
    return;
  }

  observeAuth((user, profile, error) => {
    if (error) {
      applySignedOut(error.message || "Le service de connexion est temporairement indisponible.");
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
