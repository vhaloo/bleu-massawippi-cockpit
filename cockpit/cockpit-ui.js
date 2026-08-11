import {
  getClientState,
  waitForClientReady,
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
  addCockpitFeedback,
  updateCockpitFeedbackStatus,
  upsertActionTask,
  completeActionTask,
  subscribeActionTasks,
  setPersonalActionItemState,
  addMediaLink,
  archiveMediaLink,
  setMediaDecision,
  setMediaRightsConfirmation,
  subscribeMediaDecisions,
  subscribeMediaLinks,
  subscribeComments,
  updateOwnComment,
  archiveOwnComment,
  resolveComment,
  setWorkflowStage,
  subscribeWorkflowStates,
  setOpportunityStage,
  subscribeOpportunityStates,
  setInternalProjectStage,
  subscribeInternalProjectStates,
  setEditorialDecision,
  subscribeEditorialDecisions
} from "./firebase-client.js?v=20260811-b60";
import { createEventContextController } from "./event-context-data.js?v=20260811-b60";
import { clearPersonalActionItems, setupPersonalActionItems } from "./action-items-ui.js?v=20260811-b60";
import { buildHealthWidget, clearHealthWidget } from "./client-health-ui.js?v=20260811-b60";
import { startAdminLazyData, scheduleAdminLazyDataStop, clearAdminLazyData } from "./admin-lazy-data.js?v=20260811-b60";
import { buildMediaChoiceModel, mediaAgreementPresentation, mediaImageChoicePresentation, mediaRightsNeedsConfirmation, synchronizeMediaInfoPanels } from "./media-choice-ui.js?v=20260811-b60";
import { actionTaskEmptyMarkup, actionTaskEstimate, actionTaskPriority, actionTaskShouldRemain, renderActionTaskCard, visibleActionTaskTarget, workflowSyncIsUsable } from "./task-progress-ui.js?v=20260811-b60";
import { clearCompletedTaskHistory, completedTaskHistoryMarkup, invalidateCompletedTaskHistory, setupCompletedTaskHistory } from "./completed-task-history.js?v=20260811-b60";
import { setupSectionNavigation } from "./section-navigation.js?v=20260811-b60";
import { editorialRowsSignature, mergePostsWithScheduleRows } from "./publication-editor-schema.mjs?v=20260811-b60";
import { destroyPublicationStudio, initPublicationStudio, refreshPublicationStudio } from "./editor-studio.js?v=20260811-b60";
import { setupControlHints } from "./control-hints.js?v=20260811-b60";
import { classifyMonthlyPostState, monthlyPostStates } from "./monthly-snapshot-state.js?v=20260811-b60";
import { sortInternalProjectsByUrgency } from "./internal-project-order.js?v=20260811-b60";
import { clearProjectCalendar, setupProjectCalendar } from "./project-calendar.js?v=20260811-b60";
import { buildPostCalendarIcs, buildWeeklyCoordinationIcs, downloadCalendarFile, parsePlanDate, profileTaskLabel } from "./calendar-export-tools.js?v=20260811-b60";

const { configured, safeMode } = getClientState();
const demoMode = new URLSearchParams(location.search).get("demo") === "1";
const DATE_ELEVATOR_COMPACT_MAX = 1599;
const state = { user: null, profile: null, rows: new Map(), basePosts: [], editorialSignature: "[]", mediaByEvent: new Map(), mediaContextLoading: new Set(), mediaDecisions: new Map(), commentsByEvent: new Map(), workflows: new Map(), opportunities: new Map(), internalProjects: new Map(), decisions: new Map(), mediaConfig: null, tasks: [], tasksUnsubscribe: null, scheduleUnsubscribe: null, mediaUnsubscribe: null, mediaDecisionUnsubscribe: null, commentsUnsubscribe: null, workflowUnsubscribe: null, opportunityUnsubscribe: null, internalProjectUnsubscribe: null, decisionUnsubscribe: null, contentLoaded: false };
let eventContextController = null;
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
const internalProjectCollapsedKey = "bleu-massawippi-internal-projects-collapsed";
const internalProjectSeenVersionKey = "bleu-massawippi-internal-projects-seen-version";
const monthlySnapshotCollapsedKey = "bleu-massawippi-monthly-snapshot-collapsed";
let dateElevatorFrame = 0;
let dateElevatorScrollBound = false;

function notifyViewUpdate(reason="data"){dispatchEvent(new CustomEvent("cockpit:data-updated",{detail:{reason}}))}

const ripple=target=>target&&dispatchEvent(new CustomEvent("cockpit:soft-ripple",{detail:{target}}));

function announce(message){const node=document.querySelector("#cockpit-announcer");if(!node)return;node.textContent="";requestAnimationFrame(()=>{node.textContent=message})}

const style = document.createElement("style");
style.textContent = `
  .cockpit-skip-link{position:fixed;top:8px;left:8px;z-index:2000;padding:10px 14px;border-radius:10px;color:#fff;background:#073a52;font-weight:850;transform:translateY(-160%);transition:transform .15s}
  .cockpit-skip-link:focus{transform:translateY(0)}
  .cockpit-visually-hidden{position:absolute!important;width:1px!important;height:1px!important;padding:0!important;margin:-1px!important;overflow:hidden!important;clip:rect(0,0,0,0)!important;white-space:nowrap!important;border:0!important}
  body.cockpit-locked>*:not(#cockpit-login){filter:blur(5px);pointer-events:none;user-select:none}
  #cockpit-login{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:24px;background:rgba(5,35,51,.72);backdrop-filter:blur(14px)}
  #cockpit-login[hidden]{display:none}
  button:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,a:focus-visible{outline:3px solid #2ab6bb;outline-offset:3px}
  .cockpit-login-card { width: min(450px, 100%); padding: 30px; border: 1px solid rgba(255,255,255,.35); border-radius: 24px; color: #102f3f; background: #f8fcfc; box-shadow: 0 30px 70px rgba(0,0,0,.25); }
  .cockpit-login-card h2 { margin: 0 0 7px; color: #073a52; font-size: 2rem; letter-spacing: -.04em; }
  .cockpit-login-product { display:block; width:min(100%,360px); height:auto; margin:0 auto 18px; padding:12px 14px; border:1px solid #d6e8ea; border-radius:18px; background:#f8fcfc; }
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
  .cockpit-comment-row { margin-top: 0; padding:10px; align-items: stretch; border:2px solid #8dcfd4; border-top:0; border-radius:0 0 14px 14px; background:#f3fbfb; }
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
  @media (min-width:701px) { .posts.single-post { grid-template-columns:minmax(0,1fr); } }
  .cockpit-monthly-snapshot { margin:0 0 18px; overflow:hidden; border:1px solid #c8dfe3; border-radius:16px; background:#f8fcfc; box-shadow:0 8px 24px rgba(7,58,82,.07); }
  .cockpit-monthly-snapshot > summary { display:flex; min-height:54px; align-items:center; gap:10px; padding:12px 15px; color:#073a52; background:#eaf7f7; cursor:pointer; list-style:none; }
  .cockpit-monthly-snapshot > summary::-webkit-details-marker { display:none; }
  .cockpit-monthly-snapshot > summary::after { margin-left:auto; content:"⌄"; color:#0b7895; font-size:1.15rem; font-weight:900; transition:transform .16s ease; }
  .cockpit-monthly-snapshot[open] > summary::after { transform:rotate(180deg); }
  .cockpit-monthly-snapshot-title { display:grid; gap:2px; min-width:0; }
  .cockpit-monthly-snapshot-title b { color:#073a52; font-size:.88rem; }
  .cockpit-monthly-snapshot-title small { color:#587680; font-size:.67rem; line-height:1.35; }
  .cockpit-monthly-snapshot-count { display:inline-grid; min-width:27px; min-height:27px; padding:0 7px; place-items:center; border-radius:999px; color:#fff; background:#0b7895; font-size:.68rem; font-weight:900; }
  .cockpit-monthly-legend { display:flex; flex-wrap:wrap; gap:7px 13px; padding:11px 14px 0; color:#496b76; font-size:.64rem; font-weight:800; }
  .cockpit-monthly-legend-item { display:inline-flex; align-items:center; gap:5px; white-space:nowrap; }
  .cockpit-monthly-snapshot-body { display:grid; gap:14px; padding:12px 14px 14px; }
  .cockpit-monthly-month { display:grid; gap:8px; }
  .cockpit-monthly-month h3 { margin:0; color:#174e62; font-size:.78rem; letter-spacing:.045em; text-transform:uppercase; }
  .cockpit-monthly-list { display:grid; grid-template-columns:repeat(auto-fit,minmax(210px,1fr)); gap:7px; margin:0; padding:0; list-style:none; }
  .cockpit-monthly-item { min-width:0; }
  .cockpit-monthly-item button { display:grid; width:100%; min-height:68px; grid-template-columns:auto minmax(0,1fr) 24px; grid-template-areas:"date title state" "theme title state"; gap:3px 9px; align-items:start; padding:9px 10px; border:1px solid color-mix(in srgb,var(--snapshot-color,#0b7895) 38%,#d6e6e8); border-left:5px solid var(--snapshot-color,#0b7895); border-radius:11px; color:#173f4e; background:#fff; font:inherit; text-align:left; cursor:pointer; }
  .cockpit-monthly-item button:hover { background:color-mix(in srgb,var(--snapshot-color,#0b7895) 8%,#fff); }
  .cockpit-monthly-date { grid-area:date; color:#486c78; font-size:.64rem; font-weight:900; white-space:nowrap; }
  .cockpit-monthly-theme { grid-area:theme; display:inline-flex; width:max-content; max-width:100%; align-items:center; gap:4px; padding:2px 6px; border-radius:999px; color:#163d49; background:color-mix(in srgb,var(--snapshot-color,#0b7895) 19%,#fff); font-size:.6rem; font-weight:900; }
  .cockpit-monthly-post-title { grid-area:title; align-self:center; overflow:hidden; font-size:.73rem; font-weight:850; line-height:1.35; }
  .cockpit-monthly-state { display:inline-grid; width:24px; height:24px; grid-area:state; place-items:center; align-self:center; border:2px solid rgba(255,255,255,.9); border-radius:50%; color:#fff; font-size:.72rem; font-weight:950; line-height:1; box-shadow:0 1px 5px rgba(7,58,82,.22); }
  .cockpit-monthly-state.is-new { background:#b6404e; }
  .cockpit-monthly-state.is-editing { background:#a95a00; }
  .cockpit-monthly-state.is-ready { background:#1e775b; }
  .cockpit-monthly-legend .cockpit-monthly-state { width:18px; height:18px; grid-area:auto; border-width:1px; font-size:.58rem; box-shadow:none; }
  .cockpit-monthly-empty { margin:0; padding:16px; color:#5f7881; font-size:.76rem; text-align:center; }
  .post.monthly-snapshot-focus { animation:monthly-snapshot-focus 1.8s ease; }
  @keyframes monthly-snapshot-focus { 0%,100% { box-shadow:inherit; } 25%,70% { box-shadow:0 0 0 4px rgba(42,182,187,.35); } }
  @media (max-width:700px) {
    .cockpit-monthly-snapshot { margin-bottom:13px; border-radius:13px; }
    .cockpit-monthly-snapshot > summary { min-height:58px; padding:11px 12px; }
    .cockpit-monthly-snapshot-title b { font-size:.82rem; }
    .cockpit-monthly-snapshot-title small { font-size:.64rem; }
    .cockpit-monthly-legend { gap:6px 10px; padding:9px 10px 0; font-size:.61rem; }
    .cockpit-monthly-snapshot-body { padding:9px 10px 10px; }
    .cockpit-monthly-list { grid-template-columns:1fr; gap:6px; }
    .cockpit-monthly-item button { min-height:62px; grid-template-columns:78px minmax(0,1fr) 24px; padding:8px 9px; }
    .cockpit-monthly-post-title { font-size:.74rem; }
  }
  .cockpit-voice-status { min-height: 18px; margin-top: 4px; color: #54717d; font-size: .7rem; }
  .cockpit-voice-status.live { color: #0b7895; font-weight: 800; }
  .cockpit-voice-status.error { color: #9a4035; }
  .cockpit-voice-help { flex-basis: 100%; color: #6b858d; font-size: .68rem; line-height: 1.35; }
  .cockpit-media { margin-top: 10px; overflow: hidden; border: 1px solid #cfe3e6; border-radius: 12px; background: #fff; }
  .cockpit-media > summary { display: flex; align-items: center; gap: 7px; padding: 9px 11px; color: #174e62; font-size: .76rem; }
  .cockpit-media > summary:after { margin-left: auto; }
  .cockpit-media-count { display: inline-grid; min-width: 21px; min-height: 21px; padding: 0 6px; place-items: center; border-radius: 999px; color: #fff; background: #0b7895; font-size: .66rem; }
  .cockpit-media-body { padding: 0 10px 10px; }
  .cockpit-media-selection-note { display:flex; align-items:center; gap:7px; margin:4px 2px 8px; padding:8px 10px; border:1px solid #9fcbd1; border-radius:10px; color:#174e62; background:#edf8f8; font-size:.69rem; font-weight:800; line-height:1.35; }
  .cockpit-media-selection-note[hidden] { display:none; }
  .cockpit-media-selection-note.is-complete { border-color:#6db89f; color:#155c4e; background:#e4f6ef; }
  .cockpit-media-gallery { display: flex; gap: 12px; overflow-x: auto; padding: 4px 2px 12px; scroll-snap-type: x mandatory; scrollbar-width:thin; }
  .cockpit-media-nav { display:none; align-items:center; justify-content:center; gap:8px; margin:0 0 10px; }
  .cockpit-media-nav button { display:grid; width:42px; height:42px; place-items:center; border:1px solid #8cb9c1; border-radius:50%; color:#0b6077; background:#fff; font:inherit; font-size:1rem; font-weight:900; cursor:pointer; }
  .cockpit-media-nav button:disabled { opacity:.35; cursor:default; }
  .cockpit-media-position { min-width:54px; color:#345f6c; font-size:.7rem; font-weight:900; text-align:center; }
  .cockpit-media-swipe-hint { margin:0 0 8px; color:#66838c; font-size:.65rem; text-align:center; }
  .cockpit-media-empty { margin: 4px 0 9px; color: #67828d; font-size: .72rem; }
  .cockpit-media-card { position: relative; flex: 0 0 min(310px, 86vw); overflow: hidden; scroll-snap-align: start; border: 1px solid #d3e6e8; border-radius: 11px; background: #f7fbfb; }
  .cockpit-media-card.is-final { border:3px solid #21866d; box-shadow:0 0 0 3px rgba(33,134,109,.14); }
  .cockpit-media-card.is-recommended:not(.is-final) { border:2px solid #0b7895; box-shadow:0 0 0 2px rgba(11,120,149,.1); }
  .cockpit-media-card.is-direction-selected:not(.is-final) { border:2px solid #8f6a18; box-shadow:0 0 0 2px rgba(143,106,24,.1); }
  .cockpit-media-card.is-divergent { border-color:#b26724; background:#fffaf1; }
  .cockpit-media-preview { position:relative; display: grid; width:100%; aspect-ratio:4 / 3; min-height:190px; place-items: center; overflow: hidden; color: #0b6077; background:#e5eff1; text-decoration: none; }
  .cockpit-media-preview:focus-visible { outline:3px solid #0b7895; outline-offset:-3px; }
  .cockpit-media-preview img { display: block; width: 100%; height: 100%; object-fit: contain; object-position:center; }
  .cockpit-media-enlarge { position:absolute; right:8px; bottom:8px; padding:5px 8px; border:1px solid rgba(255,255,255,.75); border-radius:999px; color:#fff; background:rgba(5,42,55,.82); box-shadow:0 2px 8px rgba(0,0,0,.2); font-size:.62rem; font-weight:900; }
  .cockpit-media-icon { font-size: 2rem; }
  .cockpit-media-open-label { display:block; margin-top:5px; color:#0b6077; font-size:.7rem; font-weight:900; }
  #cockpit-date-elevator { position:fixed; top:116px; right:10px; bottom:176px; z-index:19; display:flex; width:112px; flex-direction:column; overflow:hidden; border:1px solid #bad9dd; border-radius:16px; background:rgba(248,252,252,.96); box-shadow:0 12px 30px rgba(7,58,82,.16); backdrop-filter:blur(12px); }
  #cockpit-date-elevator[hidden] { display:none; }
  .cockpit-date-current { display:flex; min-height:44px; align-items:center; justify-content:center; gap:5px; padding:7px; border:0; border-bottom:1px solid #d4e7e9; color:#073a52; background:#eaf7f7; font:inherit; font-size:.68rem; font-weight:900; line-height:1.2; cursor:pointer; }
  .cockpit-date-current i { font-style:normal; }
  .cockpit-date-nav { display:flex; min-height:0; flex:1; flex-direction:column; gap:4px; overflow-y:auto; padding:7px 6px; scrollbar-width:thin; }
  .cockpit-date-nav button { position:relative; min-height:31px; padding:5px 5px 5px 12px; border:0; border-radius:8px; color:#577580; background:transparent; font:inherit; font-size:.61rem; font-weight:750; line-height:1.15; text-align:left; cursor:pointer; }
  .cockpit-date-nav button:before { position:absolute; left:4px; top:50%; width:4px; height:4px; border-radius:50%; content:""; background:#9bbdc2; transform:translateY(-50%); }
  .cockpit-date-nav button:hover { color:#073a52; background:#edf7f7; }
  .cockpit-date-nav button.active { color:#fff; background:#0b7895; box-shadow:0 4px 10px rgba(11,120,149,.2); }
  .cockpit-date-nav button.active:before { background:#fff; }
  [data-theme="dark"] #cockpit-date-elevator { border-color:#496873; background:rgba(18,45,56,.97); box-shadow:0 14px 34px rgba(0,0,0,.35); }
  [data-theme="dark"] .cockpit-date-current { color:#f4fbfc; border-color:#496873; background:#173f4d; }
  [data-theme="dark"] .cockpit-date-nav button { color:#c7dce1; }
  [data-theme="dark"] .cockpit-date-nav button:hover { color:#fff; background:#244d5a; }
  [data-theme="dark"] .cockpit-date-nav button.active { color:#fff; background:#1688a3; }
  @media (max-width:1599px) {
    #cockpit-date-elevator { top:calc(var(--cockpit-session-height,52px) + var(--cockpit-nav-height,44px) + 6px); right:8px; bottom:auto; width:min(178px,calc(100vw - 16px)); border-radius:13px; }
    .cockpit-date-current { min-height:39px; border-bottom:0; font-size:.68rem; }
    .cockpit-date-nav { display:none; max-height:48vh; border-top:1px solid #d4e7e9; }
    #cockpit-date-elevator.open .cockpit-date-nav { display:flex; }
    [data-theme="dark"] .cockpit-date-nav { border-color:#496873; }
  }
  [data-theme="dark"] .cockpit-media-selection-note { border-color:#4f8490; color:#e8f7f8; background:#173f4d; }
  [data-theme="dark"] .cockpit-media-selection-note.is-complete { border-color:#4f9f85; color:#e8fff6; background:#174b40; }
  .cockpit-media-info { border-top:1px solid #d8e8ea; background:#fbfdfd; }
  .cockpit-media-info > summary { display:flex; min-height:42px; align-items:center; gap:6px; padding:8px 10px; color:#245866; font-size:.7rem; font-weight:900; cursor:pointer; list-style:none; }
  .cockpit-media-info > summary::-webkit-details-marker { display:none; }
  .cockpit-media-info > summary:after { margin-left:0; content:"⌄"; color:#0b7895; font-size:.9rem; transition:transform .16s ease; }
  .cockpit-media-info[open] > summary:after { transform:rotate(180deg); }
  .cockpit-media-info[open] > summary { background:#f0f8f8; }
  .cockpit-media-info-status { margin-left:auto; padding:2px 6px; border-radius:999px; color:#58717a; background:#eaf2f3; font-size:.58rem; }
  .cockpit-media-info-status.is-final { color:#155c4e; background:#dff4ea; }
  .cockpit-media-info-body { padding:1px 0 9px; border-top:1px solid #e3edef; }
  .cockpit-media-meta { padding: 8px 9px 10px; }
  .cockpit-media-meta b { display: block; overflow: hidden; color: #174e62; font-size: .73rem; text-overflow: ellipsis; white-space: nowrap; }
  .cockpit-media-meta p { margin: 3px 0 0; color: #64808a; font-size: .66rem; line-height: 1.35; }
  .cockpit-media-source-link { display:inline-flex; margin-top:7px; align-items:center; gap:4px; color:#0b6077; font-size:.65rem; font-weight:900; text-decoration:underline; text-underline-offset:2px; }
  .cockpit-media-stage { display: inline-block; margin-top: 5px; padding: 2px 6px; border-radius: 999px; color: #0b6077; background: #dff3f3; font-size: .61rem; font-weight: 850; }
  .cockpit-media-rights-warning { display:block; margin:7px 8px 0; padding:6px 7px; border:1px solid #d9a441; border-radius:7px; color:#6b4300; background:#fff4d6; font-size:.63rem; font-weight:900; line-height:1.35; }
  .cockpit-media-final-badge { display:block; margin:8px 9px 6px; color:#155c4e; font-size:.66rem; font-weight:900; }
  .cockpit-media-role-badges { display:grid; gap:5px; margin:8px 9px; }
  .cockpit-media-role-badge { display:block; padding:5px 7px; border-radius:7px; color:#315564; background:#eaf3f5; font-size:.64rem; font-weight:850; line-height:1.35; }
  .cockpit-media-role-badge.communications { color:#075c73; background:#e1f4f7; }
  .cockpit-media-role-badge.direction { color:#735815; background:#fff2cf; }
  .cockpit-media-role-badge.agreement { color:#155c4e; background:#dff4ea; }
  .cockpit-media-role-badge.divergence { color:#8a4815; background:#ffead8; }
  .cockpit-media-blocked { display:block; margin:7px 8px 0; padding:6px 7px; border:1px solid #d9b76b; border-radius:7px; color:#75521b; background:#fff4d7; font-size:.63rem; font-weight:900; line-height:1.35; }
  .cockpit-media-final-action { width:calc(100% - 16px); margin:0 8px 9px; padding:7px; border:1px solid #21866d; border-radius:8px; color:#155c4e; background:#e3f5ee; font-size:.66rem; font-weight:900; cursor:pointer; }
  .cockpit-media-override-action { width:calc(100% - 16px); margin:0 8px 9px; padding:7px; border:1px solid #b67b2b; border-radius:8px; color:#714809; background:#fff5df; font-size:.66rem; font-weight:900; cursor:pointer; }
  .cockpit-media-final-action:disabled { cursor:not-allowed; color:#6f7476; background:#edf0f1; border-color:#c7ced0; opacity:1; }
  .cockpit-media-comment { display:grid; grid-template-columns:minmax(0,1fr) auto auto; gap:6px; margin:0 8px 9px; }
  .cockpit-media-comment input { min-width:0; padding:7px; border:1px solid #c9dde0; border-radius:8px; color:#294d59; background:#fff; font-size:.66rem; }
  .cockpit-media-comment button { padding:7px 9px; border:1px solid #0b7895; border-radius:8px; color:#fff; background:#0b7895; font-size:.66rem; font-weight:900; cursor:pointer; }
  .cockpit-media-comment button[data-dictate] { min-width:38px; color:#0b6077; background:#fff; }
  .cockpit-media-comment [data-voice-status] { grid-column:1 / -1; margin:0; }
  .cockpit-media-card button[data-archive-media] { display:block; width:calc(100% - 16px); min-height:36px; margin:0 8px; padding:7px 9px; border:1px solid #d8b5b1; border-radius:8px; color:#8b4037; background:#fff6f4; font-size:.65rem; font-weight:850; cursor:pointer; }
  .cockpit-media-form { display: grid; grid-template-columns: minmax(0,1.5fr) minmax(120px,.8fr) auto; gap: 6px; padding-top: 9px; border-top: 1px solid #d8e8ea; }
  .cockpit-media-form input, .cockpit-media-form select { min-width: 0; padding: 7px; border: 1px solid #d1e3e6; border-radius: 8px; color: #264a58; background: #fff; font: inherit; font-size: .7rem; }
  .cockpit-media-form-note { display:grid; grid-column:1 / 3; grid-template-columns:minmax(0,1fr) auto; gap:6px; }
  .cockpit-media-form-note [name="media-note"] { width:100%; }
  .cockpit-media-form-note button[data-dictate] { min-width:38px; padding:7px; border:1px solid #0b7895; border-radius:8px; color:#0b6077; background:#fff; cursor:pointer; }
  .cockpit-media-form-note [data-voice-status] { grid-column:1 / -1; margin:0; }
  .cockpit-media-form > button[type="submit"] { grid-column: 3; grid-row: 1 / 3; padding: 7px 10px; border: 0; border-radius: 8px; color: #fff; background: #0b7895; font-size: .7rem; font-weight: 850; cursor: pointer; }
  .cockpit-media-tools { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; margin-top: 8px; }
  .cockpit-media-folder { display: inline-block; padding: 6px 9px; border: 1px solid #0b7895; border-radius: 999px; color: #0b6077; font-size: .68rem; font-weight: 850; text-decoration: none; }
  .cockpit-media-note { margin: 0; color: #6b858d; font-size: .65rem; }
  .post.workflow-complete { box-shadow:0 0 0 2px rgba(33,134,109,.18); }
  .post.workflow-complete:after { position:absolute; top:10px; right:10px; z-index:2; padding:3px 7px; border-radius:999px; content:"✓ Terminé"; color:#155c4e; background:#dff4ea; font-size:.62rem; font-weight:900; }
  .ready { display:none !important; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { scroll-behavior:auto !important; animation-duration:.01ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important; }
  }
  .cockpit-thread { margin-top:12px; padding:10px; border:2px solid #8dcfd4; border-bottom:1px solid #c8e3e5; border-radius:14px 14px 0 0; background:linear-gradient(180deg,#effafa,#fff); }
  .cockpit-thread-heading { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:8px; }
  .cockpit-thread h5 { margin:0; color:#073a52; font-size:.82rem; }
  .cockpit-thread-heading span { color:#587680; font-size:.64rem; font-weight:750; }
  [data-comment-thread] { display:flex; max-height:340px; flex-direction:column; gap:8px; overflow-y:auto; padding:2px; scroll-behavior:smooth; }
  .cockpit-thread-empty { margin:4px 0; padding:12px; color:#718993; border:1px dashed #bdd8dc; border-radius:10px; background:#fff; font-size:.7rem; text-align:center; }
  .cockpit-message { position:relative; width:min(88%,620px); padding:10px 11px; border:2px solid #d1e4e7; border-radius:7px 16px 16px 16px; background:#fff; box-shadow:0 7px 18px rgba(7,58,82,.09); }
  .cockpit-message.mine { align-self:flex-end; border-color:#77cdd2; border-radius:16px 7px 16px 16px; background:#eaf9f9; }
  .cockpit-message.other { align-self:flex-start; border-color:#e1b55c; background:#fff9eb; }
  .cockpit-message header { display:flex; justify-content:space-between; gap:7px; color:#607b85; font-size:.64rem; }
  .cockpit-message header b { color:#073a52; font-size:.72rem; }
  .cockpit-message p { margin:7px 0 0; color:#234c5a; font-size:.78rem; font-weight:650; line-height:1.48; white-space:pre-wrap; }
  .cockpit-message-actions { display:flex; flex-wrap:wrap; gap:6px; margin-top:9px; }
  .cockpit-message-actions button { padding:6px 9px; border:1px solid #8ebfc5; border-radius:8px; color:#0b6077; background:#fff; font-size:.65rem; font-weight:850; cursor:pointer; }
  .cockpit-message-actions button[data-resolve-comment] { color:#fff; border-color:#21866d; background:#21866d; }
  .opportunity-note-box { margin-top:12px; padding:11px; border:2px solid #d8bc78; border-radius:12px; background:#fffbef; }
  .opportunity-note-box h5 { margin:0 0 3px; color:#624b17; font-size:.78rem; }
  .opportunity-note-box > p { margin:0 0 8px; color:#75653b; font-size:.67rem; line-height:1.4; }
  .opportunity-note-box .cockpit-thread { margin-top:0; border-color:#e2ce9e; background:linear-gradient(180deg,#fff8e5,#fff); }
  .opportunity-note-box .cockpit-comment-row { border-color:#e2ce9e; background:#fff8e5; }
  [data-theme="dark"] .opportunity-note-box { border-color:#8a713a; background:#2c2a20; }
  [data-theme="dark"] .opportunity-note-box h5 { color:#ffe6a6; }
  [data-theme="dark"] .opportunity-note-box > p { color:#e0d2ab; }
  [data-theme="dark"] .opportunity-note-box .cockpit-thread { border-color:#75633b; background:linear-gradient(180deg,#353124,#202a2e); }
  [data-theme="dark"] .opportunity-note-box .cockpit-comment-row { border-color:#75633b; background:#2a2d2c; }
  .internal-project-note-box { margin-top:12px; padding:11px; border:2px solid #8acbc2; border-radius:12px; background:#f0faf8; }
  .internal-project-note-box h5 { margin:0 0 3px; color:#164f4f; font-size:.78rem; }
  .internal-project-note-box > p { margin:0 0 8px; color:#496d68; font-size:.67rem; line-height:1.4; }
  .internal-project-note-box .cockpit-thread { margin-top:0; border-color:#a7d8d1; background:linear-gradient(180deg,#eaf8f5,#fff); }
  .internal-project-note-box .cockpit-comment-row { border-color:#a7d8d1; background:#eff9f7; }
  .develop-next-cycle { display:inline-flex; min-height:42px; align-items:center; gap:7px; margin:9px 0 0; padding:8px 11px; border:1px solid #2a9692; border-radius:10px; color:#155953; background:#e7f6f3; font-size:.7rem; font-weight:900; cursor:pointer; }
  .develop-next-cycle:hover,.develop-next-cycle:focus-visible { color:#fff; background:#207d79; }
  [data-theme="dark"] .internal-project-note-box { border-color:#5f9991; background:#193530; }
  [data-theme="dark"] .internal-project-note-box h5 { color:#b8f1e8; }
  [data-theme="dark"] .internal-project-note-box > p { color:#c3ddd8; }
  [data-theme="dark"] .internal-project-note-box .cockpit-thread { border-color:#527f79; background:linear-gradient(180deg,#213e39,#202a2e); }
  [data-theme="dark"] .internal-project-note-box .cockpit-comment-row { border-color:#527f79; background:#203833; }
  .cockpit-thread-resolved { order:-1; margin-bottom:2px; border:1px solid #c9dadd; border-radius:9px; background:#f4f7f7; }
  .cockpit-thread-resolved>summary { padding:7px 9px; color:#58717a; font-size:.67rem; font-weight:850; }
  .cockpit-thread-resolved-list { display:flex; flex-direction:column; gap:7px; padding:0 8px 8px; opacity:.82; }
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
  .feedback-form .cockpit-comment-row { margin-top:8px; border:1px solid #c7e0e3; border-radius:11px; }
  .feedback-form .cockpit-comment-row textarea { width:auto; }
  #cockpit-feedback-panel .feedback-form .cockpit-comment-row textarea { width:auto; }
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
  .cockpit-task-item.comment-task { padding:13px; border:3px solid #d38a65; background:#fff6ef; box-shadow:0 9px 22px rgba(154,64,53,.16); }
  .cockpit-task-source { display:inline-block; margin-bottom:7px; padding:4px 8px; border-radius:999px; color:#fff; background:#b75842; font-size:.66rem; font-weight:900; letter-spacing:.02em; }
  .cockpit-editorial-decision { margin:10px 0; padding:11px; border:2px solid #c7dfe3; border-radius:13px; background:#f8fcfc; }
  .cockpit-editorial-decision b { display:block; margin-bottom:6px; color:#073a52; font-size:.76rem; }
  .cockpit-editorial-buttons { display:flex; flex-wrap:wrap; gap:6px; }
  .cockpit-editorial-buttons button { min-height:40px; padding:8px 10px; border:1px solid #9cbfc5; border-radius:9px; color:#174e62; background:#fff; font-size:.68rem; font-weight:900; cursor:pointer; }
  .cockpit-editorial-buttons button[data-editorial-decision="chosen"].active { color:#fff; border-color:#21866d; background:#21866d; }
  .cockpit-editorial-buttons button[data-editorial-decision="deferred"].active { color:#57390a; border-color:#d7a33f; background:#ffe9b8; }
  .cockpit-editorial-buttons button[data-editorial-decision="rejected"].active { color:#fff; border-color:#9a4035; background:#9a4035; }
  .cockpit-editorial-help { margin:7px 0 0; color:#617d86; font-size:.65rem; line-height:1.4; }
  .cockpit-editorial-meta { display:block; margin-top:6px; color:#6d858d; font-size:.62rem; }
  .post.editorial-deferred,.post.editorial-rejected { opacity:.64; filter:grayscale(.42); }
  .post.editorial-deferred:hover,.post.editorial-rejected:hover,.post.editorial-deferred:focus-within,.post.editorial-rejected:focus-within { opacity:1; filter:none; }
  .post.editorial-chosen { box-shadow:0 0 0 3px rgba(33,134,109,.22); }
  .cockpit-task-item b { display: block; color: #073a52; font-size: .78rem; }
  .cockpit-task-item p { margin: 4px 0 7px; color: #587680; font-size: .72rem; line-height: 1.38; white-space: pre-wrap; }
  .cockpit-task-item small { display: block; margin-bottom: 7px; color: #78919a; font-size: .66rem; }
  .cockpit-task-priority { display:inline-flex; margin:0 0 5px; padding:3px 7px; border-radius:999px; color:#765116; background:#fff0c7; font-size:.62rem; font-weight:900; }
  .cockpit-task-estimate { display:inline-flex; margin:0 0 5px 5px; padding:3px 7px; border-radius:999px; color:#315f67; background:#e2f0f1; font-size:.62rem; font-weight:900; }
  .cockpit-task-actions { display: flex; gap: 6px; }
  .cockpit-task-actions button { padding: 5px 7px; border: 1px solid #cbe1e4; border-radius: 7px; color: #315564; background: #fff; font-size: .68rem; font-weight: 800; cursor: pointer; }
  .cockpit-task-actions button[data-complete-task] { border-color: #0b7895; color: #fff; background: #0b7895; }
  #cockpit-task-launch { position: fixed; right: 15px; bottom: 68px; z-index: 31; min-height: 42px; padding: 0 13px; border: 1px solid #073a52; border-radius: 999px; color: #fff; background: #073a52; box-shadow: 0 8px 22px rgba(7,58,82,.2); font-weight: 850; cursor: pointer; }
  #cockpit-task-launch[data-has-tasks="true"] { background: #c26b50; }
  .task-focus { outline: 3px solid #2ab6bb; outline-offset: 5px; animation: cockpit-task-pulse 1.4s ease; }
  @keyframes cockpit-task-pulse { 0%,100% { box-shadow: 0 0 0 0 rgba(42,182,187,0); } 35% { box-shadow: 0 0 0 8px rgba(42,182,187,.23); } }
  #cockpit-sidebar .cockpit-log { padding: 10px 0; border-bottom: 1px solid #d6e8ea; color: #4f6c77; font-size: .76rem; }
  #cockpit-sidebar .cockpit-log b { display: block; color: #073a52; }
  #cockpit-sidebar-toggle { position: fixed; right: 15px; bottom: 15px; z-index: 31; display: none; min-height: 42px; padding: 0 13px; border: 1px solid #073a52; border-radius: 999px; color: #fff; background: #073a52; font-weight: 850; cursor: pointer; }
  body.cockpit-admin #cockpit-sidebar-toggle { display: block; }
  #cockpit-credit { display:flex; flex-wrap:wrap; align-items:center; justify-content:center; gap:7px 14px; margin-top:12px; color:#587680; font-size:.78rem; }
  #cockpit-credit a { display:inline-flex; min-height:40px; align-items:center; padding:6px 10px; border:1px solid #b8d5d9; border-radius:9px; color:#0b6476; background:#f2fbfb; font-weight:850; text-decoration:none; }
  #cockpit-credit a:hover,#cockpit-credit a:focus-visible { border-color:#168496; background:#e2f4f5; }
  @media (max-width: 700px) {
    body { padding-bottom: 68px; }
    #cockpit-session { display:grid; min-height:52px; grid-template-columns:minmax(0,1fr) auto auto; gap:6px; padding:6px 10px; font-size:.72rem; line-height:1.25; }
    #cockpit-session-label { min-width:0; }
    #cockpit-logout { min-height:40px; padding:6px 11px; border-radius:10px; }
    .nav { top:var(--cockpit-session-height,52px); z-index:19; margin-top:0; }
    .nav .wrap { width:100%; padding:0 6px; scrollbar-width:none; }
    .nav .wrap::-webkit-scrollbar { display:none; }
    .nav a { display:inline-flex; min-height:44px; align-items:center; padding:8px 10px; font-size:.74rem; white-space:nowrap; }
    section { scroll-margin-top:calc(var(--cockpit-session-height,52px) + var(--cockpit-nav-height,44px) + 10px); }
    .mast { display:none; }
    .hero { padding:22px 0 20px; gap:18px; }
    .hero h1 { margin-bottom:14px; font-size:clamp(2.55rem,12.6vw,3.45rem); line-height:.92; }
    .hero .lead { margin-bottom:18px; font-size:.96rem; line-height:1.5; }
    .hero .buttons { gap:8px; }
    .hero .button { min-height:44px; padding:10px 15px; }
    .section { padding-top:48px; }
    .heading { margin-bottom:17px; }
    .heading h2 { font-size:clamp(1.8rem,8.8vw,2.35rem); line-height:1; }
    .heading p { font-size:.94rem; }
    .posts { gap:14px; }
    .post-head { padding:14px 13px 10px 17px; }
    .post h4 { font-size:1.16rem; line-height:1.16; }
    .post-head p { font-size:.88rem; line-height:1.48; }
    .post-foot { padding:0 13px 12px 17px; }
    .post > details > summary { display:flex; min-height:48px; align-items:center; gap:8px; padding:10px 14px 10px 17px; font-size:.86rem; }
    .post > details > summary:after { margin-left:auto; }
    .detail { padding:1px 12px 16px; }
    .detail .copy { font-size:.86rem; line-height:1.58; }
    .cockpit-controls { margin:2px 8px 12px; padding:10px; }
    .cockpit-status-row { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
    .cockpit-status-row :is(.cockpit-control-label,.cockpit-control-help) { grid-column:1 / -1; }
    .cockpit-status-row button { min-height:44px; justify-content:center; padding:8px; border-radius:10px; font-size:.73rem; }
    .cockpit-status-row button[data-status="deleted"] { margin-left: 0; }
    .cockpit-status-row button[data-status="deleted"] { width:44px; justify-self:end; }
    .cockpit-comment-row { display:grid; grid-template-columns:46px minmax(0,1fr); gap:7px; padding:9px; }
    .cockpit-comment-row textarea { grid-column:1 / -1; min-width:0; min-height:82px; font-size:.9rem; }
    .cockpit-comment-row button { min-height:44px; }
    .cockpit-comment-row [data-dictate] { grid-column:1; min-width:0; }
    .cockpit-comment-row button.save { grid-column:2; min-width:0; }
    .cockpit-comment-row [data-voice-status] { grid-column:1 / -1; }
    .cockpit-quick-row { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:7px; }
    .cockpit-quick-row :is(.cockpit-control-label,.cockpit-control-help) { grid-column:1 / -1; }
    .cockpit-quick-row button { min-height:44px; padding:7px 4px; border-radius:10px; white-space:normal; }
    .cockpit-editorial-buttons { display:grid; grid-template-columns:1fr; gap:7px; }
    .cockpit-editorial-buttons button { min-height:44px; }
    #cockpit-feedback-launch, #cockpit-task-launch, #cockpit-sidebar-toggle { bottom:8px; min-width:0; min-height:46px; padding:0 6px; border-radius:12px; font-size:.67rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    body.cockpit-admin #cockpit-feedback-launch { left:8px; width:calc((100vw - 32px) / 3); }
    body.cockpit-admin #cockpit-task-launch { left:calc(16px + (100vw - 32px) / 3); right:auto; width:calc((100vw - 32px) / 3); }
    body.cockpit-admin #cockpit-sidebar-toggle { right:8px; width:calc((100vw - 32px) / 3); }
    body:not(.cockpit-admin) #cockpit-feedback-launch { left:8px; width:calc(50vw - 12px); }
    body:not(.cockpit-admin) #cockpit-task-launch { right:8px; width:calc(50vw - 12px); }
    #cockpit-feedback-panel { left:8px; bottom:62px; width:calc(100vw - 16px); max-height:72vh; overflow:auto; padding:13px; border-radius:15px; }
    #cockpit-sidebar { top:0; width:100vw; padding:72px 14px 80px; border-left:0; }
    #cockpit-sidebar.open + #cockpit-sidebar-toggle { z-index:42; }
    .cockpit-media-form { grid-template-columns: 1fr; }
    .cockpit-media-form-note, .cockpit-media-form > button[type="submit"] { grid-column: 1; grid-row: auto; }
    .cockpit-media-form-note { grid-template-columns:46px minmax(0,1fr); }
    .cockpit-media-form-note [name="media-note"] { grid-column:1 / -1; min-height:44px; }
    .cockpit-media-form-note button[data-dictate] { grid-column:1; min-height:44px; }
    .cockpit-media-nav:not([hidden]) { display:flex; }
    .cockpit-media-card { flex-basis:min(310px,calc(100vw - 58px)); }
    .cockpit-media-preview { min-height:210px; }
    .cockpit-media-final-action { min-height:44px; font-size:.72rem; }
    .cockpit-media-info > summary { min-height:46px; font-size:.74rem; }
    .cockpit-media-comment { grid-template-columns:46px minmax(0,1fr); }
    .cockpit-media-comment input { grid-column:1 / -1; }
    .cockpit-media-comment :is(input,button) { min-height:44px; font-size:.75rem; }
    .cockpit-media-comment button[data-dictate] { grid-column:1; }
    .cockpit-media-comment button[data-save-media-comment] { grid-column:2; }
    .cockpit-media-card button[data-archive-media] { min-height:44px; font-size:.72rem; }
    .toolbar { gap:7px; padding:8px; }
    .toolbar :is(input,select,button) { min-height:46px; min-width:0; font-size:.78rem; }
    body .toolbar :is(select,button) { min-height:46px; }
    .status { display:grid; grid-template-columns:auto 1fr; gap:7px 10px; font-size:.78rem; }
    .status .bar { grid-column:1 / -1; grid-row:2; }
  }
  .internal-project-docs a.internal-project-proposal {
    display:flex; align-items:center; gap:8px; width:fit-content; margin:4px 10px 9px 0;
    padding:9px 11px; border:1px solid #82b8ad; border-radius:9px;
    background:#e8f6f2; color:#0b514a; box-shadow:0 2px 8px rgba(18,82,75,.08);
    font-weight:900; text-decoration:none;
  }
  .internal-project-docs a.internal-project-proposal::before {
    content:"PDF"; display:inline-grid; place-items:center; min-width:31px; height:22px;
    border-radius:6px; background:#17675e; color:#fff; font-size:.62rem; letter-spacing:.06em;
  }
  [data-theme="dark"] .internal-project-docs a.internal-project-proposal {
    border-color:#4f998f; background:#173e3b; color:#d8fff9; box-shadow:none;
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

function updateDateElevator() {
  const elevator = document.querySelector("#cockpit-date-elevator");
  const calendar = document.querySelector("#calendrier");
  if (!elevator || !calendar) return;
  const groups = [...document.querySelectorAll("#posts .day-group")];
  if (!groups.length) {
    elevator.hidden = true;
    return;
  }
  const calendarRect = calendar.getBoundingClientRect();
  elevator.hidden = calendarRect.top > innerHeight * .78 || calendarRect.bottom < 72;
  if (elevator.hidden) return;
  const threshold = Math.min(innerHeight * .4, 330);
  const nextIndex = groups.findIndex((group) => group.getBoundingClientRect().top > threshold);
  const activeIndex = nextIndex === -1 ? groups.length - 1 : Math.max(0, nextIndex - 1);
  const activeGroup = groups[activeIndex];
  const activeLabel = activeGroup?.querySelector(".day-heading strong")?.textContent?.trim() || "Calendrier";
  const current = elevator.querySelector("[data-date-current-label]");
  if (current) current.textContent = activeLabel;
  const buttons = [...elevator.querySelectorAll("[data-date-target]")];
  buttons.forEach((button, index) => {
    const active = index === activeIndex;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "date");
    else button.removeAttribute("aria-current");
  });
  const activeButton = buttons[activeIndex];
  const nav = elevator.querySelector(".cockpit-date-nav");
  if (activeButton && nav && innerWidth > DATE_ELEVATOR_COMPACT_MAX) {
    const top = activeButton.offsetTop;
    if (top < nav.scrollTop + 8 || top + activeButton.offsetHeight > nav.scrollTop + nav.clientHeight - 8) {
      nav.scrollTo({ top: Math.max(0, top - nav.clientHeight / 2), behavior: "smooth" });
    }
  }
}

function requestDateElevatorUpdate() {
  if (dateElevatorFrame) return;
  dateElevatorFrame = requestAnimationFrame(() => {
    dateElevatorFrame = 0;
    updateDateElevator();
  });
}

function setupDateElevator() {
  const calendar = document.querySelector("#calendrier");
  const groups = [...document.querySelectorAll("#posts .day-group")];
  document.querySelector("#cockpit-date-elevator")?.remove();
  if (!calendar || !groups.length) return;
  const elevator = document.createElement("aside");
  elevator.id = "cockpit-date-elevator";
  elevator.hidden = true;
  elevator.setAttribute("aria-label", "Repère rapide des dates du calendrier");
  const dates = groups.map((group, index) => {
    const label = group.querySelector(".day-heading strong")?.textContent?.trim() || `Journée ${index + 1}`;
    const targetId = `cockpit-calendar-day-${index + 1}`;
    group.id = targetId;
    group.style.scrollMarginTop = "calc(var(--cockpit-session-height, 52px) + var(--cockpit-nav-height, 44px) + 10px)";
    return { label, targetId };
  });
  elevator.innerHTML = `<button type="button" class="cockpit-date-current" data-date-toggle aria-expanded="false"><span aria-hidden="true">🗓️</span><span data-date-current-label>${esc(dates[0].label)}</span><i aria-hidden="true">⌄</i></button><nav class="cockpit-date-nav" aria-label="Aller directement à une date">${dates.map(({ label, targetId }) => `<button type="button" data-date-target="${esc(targetId)}">${esc(label)}</button>`).join("")}</nav>`;
  document.body.appendChild(elevator);
  elevator.addEventListener("click", (event) => {
    const targetButton = event.target.closest("[data-date-target]");
    if (targetButton) {
      document.getElementById(targetButton.dataset.dateTarget)?.scrollIntoView({ behavior: "smooth", block: "start" });
      elevator.classList.remove("open");
      elevator.querySelector("[data-date-toggle]")?.setAttribute("aria-expanded", "false");
      return;
    }
    const toggle = event.target.closest("[data-date-toggle]");
    if (!toggle || innerWidth > DATE_ELEVATOR_COMPACT_MAX) return;
    const open = elevator.classList.toggle("open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  if (!dateElevatorScrollBound) {
    addEventListener("scroll", requestDateElevatorUpdate, { passive: true });
    addEventListener("resize", requestDateElevatorUpdate, { passive: true });
    dateElevatorScrollBound = true;
  }
  requestDateElevatorUpdate();
}

function buildLogin() {
  const login = document.createElement("div");
  login.id = "cockpit-login";
  login.setAttribute("role", "dialog");
  login.setAttribute("aria-modal", "true");
  login.setAttribute("aria-labelledby", "cockpit-login-title");
  login.setAttribute("aria-describedby", "cockpit-login-description");
  login.innerHTML = `
    <form class="cockpit-login-card" id="cockpit-login-form">
      <img class="cockpit-login-product" src="./assets/brand/cockpit-bleu-massawippi-lockup.svg" alt="Cockpit Bleu Massawippi">
      <p class="eyebrow">Bleu Massawippi · espace sécurisé</p>
      <h2 id="cockpit-login-title">Connexion</h2>
      <p id="cockpit-login-description">Accédez au cockpit de collaboration avec votre compte Firebase autorisé.</p>
      <label>Adresse courriel<input id="cockpit-email" type="email" autocomplete="username" required></label>
      <label>Mot de passe<input id="cockpit-password" type="password" autocomplete="current-password" required></label>
      <button type="submit">Ouvrir la session</button>
      <button class="cockpit-login-reset" id="cockpit-reset-password" type="button">Réinitialiser le mot de passe</button>
      <button class="cockpit-login-reset" id="cockpit-retry-content" type="button" hidden>Réessayer le chargement</button>
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

let responsiveOffsetObserver = null;
function syncResponsiveOffsets() {
  const sessionHeight = Math.ceil(document.querySelector("#cockpit-session")?.getBoundingClientRect().height || 0);
  const navHeight = Math.ceil(document.querySelector(".nav")?.getBoundingClientRect().height || 0);
  document.documentElement.style.setProperty("--cockpit-session-height", `${sessionHeight}px`);
  document.documentElement.style.setProperty("--cockpit-nav-height", `${navHeight}px`);
}

function setupResponsiveOffsets() {
  responsiveOffsetObserver?.disconnect();
  responsiveOffsetObserver = typeof ResizeObserver === "function" ? new ResizeObserver(syncResponsiveOffsets) : null;
  const session = document.querySelector("#cockpit-session");
  const nav = document.querySelector(".nav");
  if (session) responsiveOffsetObserver?.observe(session);
  if (nav) responsiveOffsetObserver?.observe(nav);
  if (document.body.dataset.responsiveOffsetsReady !== "true") {
    addEventListener("resize", syncResponsiveOffsets, { passive: true });
    document.body.dataset.responsiveOffsetsReady = "true";
  }
  requestAnimationFrame(syncResponsiveOffsets);
}

function setAdminSidebarOpen(open) {
  const sidebar = document.querySelector("#cockpit-sidebar");
  const toggle = document.querySelector("#cockpit-sidebar-toggle");
  if (!sidebar) return;
  if (open) {
    startAdminLazyData({ enabled: configured && !safeMode && state.profile?.role === "admin", onFeedback: renderFeedbackList, onError: (label, error) => toast(`Les ${label} ne sont pas accessibles : ${error.message}`, true) });
    sidebar.hidden = false;
    sidebar.removeAttribute("inert");
    sidebar.setAttribute("aria-hidden", "false");
    void sidebar.offsetWidth;
    sidebar.classList.add("open");
  } else {
    scheduleAdminLazyDataStop();
    if (sidebar.contains(document.activeElement)) toggle?.focus();
    sidebar.classList.remove("open");
    sidebar.setAttribute("inert", "");
    sidebar.setAttribute("aria-hidden", "true");
    window.setTimeout(() => {
      if (!sidebar.classList.contains("open")) sidebar.hidden = true;
    }, 260);
  }
  toggle?.setAttribute("aria-expanded", String(open));
  if (toggle) toggle.textContent = open ? "Fermer" : "Journal";
}

function buildAdminSidebar() {
  if (document.querySelector("#cockpit-sidebar")) return;
  const sidebar = document.createElement("aside");
  sidebar.id = "cockpit-sidebar";
  sidebar.hidden = true;
  sidebar.setAttribute("inert", "");
  sidebar.setAttribute("aria-hidden", "true");
  sidebar.innerHTML = `<section id="cockpit-director-activity"></section><div id="cockpit-task-heading"><h2>À accomplir</h2><span id="cockpit-task-count" data-task-count>0</span></div><p class="cockpit-sidebar-note">Les décisions et recommandations reçues de la direction restent ici jusqu’à leur validation ou leur achèvement forcé.</p><div id="cockpit-task-list"></div>${completedTaskHistoryMarkup()}<h2>Journal de modifications</h2><p class="cockpit-sidebar-note">Lecture technique des changements synchronisés.</p><div id="cockpit-log-list"></div><h2 style="margin-top:24px">Rétroactions du cockpit</h2><p class="cockpit-sidebar-note">Les avis déposés dans les sections et la boîte à idées.</p><div id="cockpit-feedback-list"></div>`;
  document.body.appendChild(sidebar);
  setupCompletedTaskHistory(sidebar, state.profile);
  const toggle = document.createElement("button");
  toggle.id = "cockpit-sidebar-toggle";
  toggle.type = "button";
  toggle.textContent = "Journal";
  toggle.setAttribute("aria-controls", "cockpit-sidebar");
  toggle.setAttribute("aria-expanded", "false");
  toggle.addEventListener("click", () => setAdminSidebarOpen(!sidebar.classList.contains("open")));
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
    setAdminSidebarOpen(true);
    document.querySelector("#cockpit-task-heading")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  document.body.appendChild(button);
}

function stateTimestampMillis(value) {
  if (value?.toMillis) return value.toMillis();
  if (value instanceof Date) return value.valueOf();
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function taskWhen(task) {
  return task.createdAt?.toDate ? task.createdAt.toDate().toLocaleString("fr-CA") : "date en attente";
}

function renderActionTasks(tasks) {
  state.tasks = Array.isArray(tasks) ? tasks : [];
  const current = workflowSyncIsUsable(document.body.dataset.workflowSync, { safeMode, offline:globalThis.navigator?.onLine === false });
  const pending = state.tasks.filter((task) => actionTaskShouldRemain(
    task,
    state.workflows.get(task.targetId),
    state.commentsByEvent.get(task.targetId) || []
  ) && (task.targetType !== "schedule" || current)).sort((left, right) => {
    const leftPriority = actionTaskPriority(left);
    const rightPriority = actionTaskPriority(right);
    return leftPriority.bucket - rightPriority.bucket
      || leftPriority.dateValue - rightPriority.dateValue
      || stateTimestampMillis(right.updatedAt || right.createdAt) - stateTimestampMillis(left.updatedAt || left.createdAt)
      || String(left.title || "").localeCompare(String(right.title || ""), "fr");
  });
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
    list.innerHTML = actionTaskEmptyMarkup(current);
    return;
  }
  list.innerHTML = pending.map((task) => {
    const priority = actionTaskPriority(task);
    const updatedAt = stateTimestampMillis(task.updatedAt || task.createdAt);
    const estimate = actionTaskEstimate(task);
    return renderActionTaskCard({ task, priorityLabel:priority.label, estimate, when:taskWhen(task), updatedAt, workflow:state.workflows.get(task.targetId), mediaDecision:state.mediaDecisions.get(task.targetId) });
  }).join("");
}

function findTaskTarget(type, id) {
  const visibleId = visibleActionTaskTarget(type, id);
  if (!visibleId) return null;
  if (type === "section") return document.getElementById(visibleId);
  return [...document.querySelectorAll("[data-item-id]")].find((node) => node.dataset.itemId === visibleId) || document.getElementById(visibleId);
}

function requestCalendarItemVisibility(itemId) {
  const item = Array.isArray(globalThis.posts) ? globalThis.posts.find((post) => post.id === itemId) : null;
  if (!item || item.archivedEditorial === true) return false;
  const search = document.querySelector("#search");
  const week = document.querySelector("#week");
  const theme = document.querySelector("#theme");
  if (search) search.value = "";
  if (week) week.value = "all";
  if (theme) theme.value = "all";
  const pastToggle = document.querySelector("#past-toggle");
  if (isPlanItemPast(item) && pastToggle?.dataset.active !== "true") {
    pastToggle.click();
  } else if (search) {
    search.dispatchEvent(new Event("input", { bubbles:true }));
  } else {
    week?.dispatchEvent(new Event("change", { bubbles:true }));
  }
  return true;
}

function requestCardExpansion(card, expanded = true) {
  if (!card?.dataset?.itemId) return;
  const handledByViewMode = !window.dispatchEvent(new CustomEvent("cockpit:card-expansion-request", {
    cancelable: true,
    detail: { itemId: card.dataset.itemId, expanded: Boolean(expanded) }
  }));
  if (handledByViewMode) return;
  // Repli sûr si le module de vue n'est pas encore chargé.
  card.classList.toggle("vm-expanded", Boolean(expanded));
  card.querySelectorAll("details").forEach((details) => {
    if (expanded) details.setAttribute("open", "");
    else details.removeAttribute("open");
  });
  const toggle = card.querySelector(":scope > .vm-card-summary [data-vm-card-toggle]");
  if (toggle) {
    toggle.setAttribute("aria-expanded", String(Boolean(expanded)));
    toggle.textContent = expanded ? "− Réduire" : "+ Ouvrir";
  }
}

function revealTaskTarget(type, id, allowRetry = true) {
  const target = findTaskTarget(type, id);
  if (!target) {
    if (allowRetry && type !== "section" && requestCalendarItemVisibility(id)) {
      requestAnimationFrame(() => revealTaskTarget(type, id, false));
      return;
    }
    toast("La cible de cette tâche n’est plus visible dans le cockpit.", true);
    return;
  }
  let ancestor = target;
  while (ancestor) {
    if (ancestor.matches?.("details")) ancestor.open = true;
    ancestor = ancestor.parentElement;
  }
  const card = target.matches?.(".post[data-item-id]") ? target : target.closest?.(".post[data-item-id]");
  if (card) requestCardExpansion(card, true);
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("task-focus");
  window.setTimeout(() => target.classList.remove("task-focus"), 1800);
}

function enhanceTaskEvents() {
  if (document.body.dataset.taskEventsReady === "true") return;
  document.body.dataset.taskEventsReady = "true";
  document.addEventListener("click", (event) => {
    const openButton = event.target.closest("[data-open-task]");
    if (openButton) {
      revealTaskTarget(openButton.dataset.taskTargetType, openButton.dataset.taskTarget);
      return;
    }
    const completeButton = event.target.closest("[data-complete-task]");
    if (!completeButton || !state.profile || !["director", "admin"].includes(state.profile.role)) return;
    completeButton.disabled = true;
    const taskId = completeButton.dataset.completeTask;
    completeActionTask(taskId, state.profile)
      .then(() => {
        state.tasks = state.tasks.map((task) => task.id === taskId ? { ...task, status: "done" } : task);
        renderActionTasks(state.tasks);
        invalidateCompletedTaskHistory({ reloadIfOpen:true });
        notifyViewUpdate("task-completed");
        toast("Tâche marquée comme complétée.");
      })
      .catch((error) => toast(error.message, true))
      .finally(() => { completeButton.disabled = false; });
  });
}

const feedbackSectionLabels = {
  cockpit: "Boîte à idées du cockpit",
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
  return `<form class="feedback-form" data-feedback-form data-section-id="${esc(sectionId)}"><div class="cockpit-comment-row" data-voice-container><textarea data-feedback-message maxlength="5000" spellcheck="true" autocapitalize="sentences" inputmode="text" aria-label="Avis, recommandation ou idée de mise à jour" placeholder="Ajoutez un avis, une recommandation ou une idée de mise à jour. Cette case sert à préparer la prochaine mouture; elle ne modifie pas le texte immédiatement."></textarea><button type="button" data-dictate aria-pressed="false" aria-label="Dicter une recommandation" title="Dicter une recommandation">🎙️</button><div class="cockpit-voice-status" data-voice-status aria-live="polite">Cliquez sur le micro pour dicter, ou écrivez votre recommandation.</div></div><div class="feedback-actions"><select data-feedback-category aria-label="Type de rétroaction"><option value="recommandation">Recommandation</option><option value="avis">Avis</option><option value="a_verifier">À vérifier</option><option value="idee">Idée de mise à jour</option></select><button type="submit">Envoyer</button></div><p class="feedback-note">Votre note sera enregistrée dans le journal du cockpit pour suivi et arbitrage.</p></form>`;
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
        targetId: visibleActionTaskTarget("section", sectionId),
        targetLabel: feedbackSectionLabels[sectionId] || sectionId,
        message: `${message}\n\nLa rétroaction concerne une prochaine mouture; elle ne modifie pas le texte immédiatement.`
      });
    })
    .then(() => {
      messageField.value = "";
      delete messageField.dataset.dictated;
      toast("Rétroaction enregistrée pour la prochaine mouture.");
    })
    .catch((error) => toast(error.message, true))
    .finally(() => { submitButton.disabled = false; });
}

function enhanceSectionFeedback() {
  document.querySelectorAll("#cockpit-content [data-cockpit-private-root] section[id]").forEach((section) => {
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

function setupFeedbackDictationEvents() {
  if (document.body.dataset.feedbackDictationReady === "true") return;
  document.body.dataset.feedbackDictationReady = "true";
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-feedback-form] button[data-dictate]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    startDictation(button.closest("[data-feedback-form]")?.querySelector("[data-feedback-message]"));
  });
}

function isPlanItemPast(item, now = new Date()) {
  const date = parsePlanDate(item);
  if (!date) return false;
  date.setHours(23, 59, 59, 999);
  return date < now;
}

const monthlySnapshotThemes = {
  education: { symbol:"▣", color:"#227c9d" },
  humanite: { symbol:"♥", color:"#d46a57" },
  interaction: { symbol:"◆", color:"#7a67ad" },
  nature: { symbol:"❧", color:"#3d8b66" },
  prevention: { symbol:"✓", color:"#c47a24" },
  patrimoine: { symbol:"⌛", color:"#8b6a45" },
  actualite: { symbol:"●", color:"#b95353" },
  science: { symbol:"✦", color:"#268a91" },
  communaute: { symbol:"◎", color:"#b85d83" },
  creatif: { symbol:"✎", color:"#8466a8" },
  coulisses: { symbol:"◫", color:"#537384" },
  humour: { symbol:"☀", color:"#aa7a16" }
};

function monthlySnapshotTheme(value) {
  const key = String(value || "Thème")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("fr-CA")
    .replace(/[^a-z]/g, "");
  return monthlySnapshotThemes[key] || { symbol:"●", color:"#527783" };
}

function monthlySnapshotActivePosts() {
  const posts = Array.isArray(globalThis.posts) ? globalThis.posts : [];
  const candidates = posts.filter((item) => {
    const schedule = state.rows.get(item.id);
    const decision = state.decisions.get(item.id)?.decision || "undecided";
    return schedule?.deleted !== true
      && schedule?.status !== "deleted"
      && item.archivedEditorial !== true
      && !isPlanItemPast(item)
      && !["deferred", "rejected"].includes(decision);
  });
  const chosenByGroup = new Map();
  const selectedByGroup = new Map();
  candidates.forEach((item) => {
    if (!item.optionGroup) return;
    if ((state.decisions.get(item.id)?.decision || "") === "chosen") {
      if (!chosenByGroup.has(item.optionGroup)) chosenByGroup.set(item.optionGroup, new Set());
      chosenByGroup.get(item.optionGroup).add(item.id);
    }
    if (state.rows.get(item.id)?.selected === true) {
      if (!selectedByGroup.has(item.optionGroup)) selectedByGroup.set(item.optionGroup, new Set());
      selectedByGroup.get(item.optionGroup).add(item.id);
    }
  });
  return candidates.filter((item) => {
    if (!item.optionGroup) return true;
    const retained = chosenByGroup.get(item.optionGroup) || selectedByGroup.get(item.optionGroup);
    return !retained || retained.has(item.id);
  });
}

function monthlySnapshotState(item) {
  const schedule = state.rows.get(item.id) || {};
  const workflow = state.workflows.get(item.id) || {};
  const editorialDecision = state.decisions.get(item.id) || {};
  return classifyMonthlyPostState({
    workflowStage: workflow.stage,
    comments: state.commentsByEvent.get(item.id) || [],
    scheduleStatus: schedule.status,
    editorialDecision: editorialDecision.decision,
    mediaDecision: state.mediaDecisions.get(item.id) || null
  });
}

function renderMonthlyEditorialSnapshot() {
  const snapshot = document.querySelector("#cockpit-monthly-snapshot");
  if (!snapshot) return;
  const body = snapshot.querySelector("[data-monthly-snapshot-body]");
  const count = snapshot.querySelector("[data-monthly-snapshot-count]");
  if (!body || !count) return;
  const posts = monthlySnapshotActivePosts()
    .map((item) => ({ item, date: parsePlanDate(item) }))
    .sort((a, b) => (a.date?.valueOf() ?? Number.MAX_SAFE_INTEGER) - (b.date?.valueOf() ?? Number.MAX_SAFE_INTEGER)
      || String(a.item.title || "").localeCompare(String(b.item.title || ""), "fr-CA"));
  count.textContent = String(posts.length);
  count.setAttribute("aria-label", `${posts.length} publication${posts.length > 1 ? "s" : ""} active${posts.length > 1 ? "s" : ""}`);
  if (!posts.length) {
    body.innerHTML = `<p class="cockpit-monthly-empty">Aucune publication active à afficher pour le moment.</p>`;
    return;
  }
  const months = new Map();
  posts.forEach((entry) => {
    const key = entry.date ? `${entry.date.getFullYear()}-${String(entry.date.getMonth() + 1).padStart(2, "0")}` : "undated";
    if (!months.has(key)) months.set(key, []);
    months.get(key).push(entry);
  });
  body.innerHTML = [...months.entries()].map(([key, entries]) => {
    const monthLabel = entries[0].date
      ? entries[0].date.toLocaleDateString("fr-CA", { month:"long", year:"numeric" })
      : "Date à confirmer";
    const items = entries.map(({ item, date }) => {
      const theme = monthlySnapshotTheme(item.t);
      const readiness = monthlySnapshotState(item);
      const dateLabel = date ? date.toLocaleDateString("fr-CA", { weekday:"short", day:"numeric" }) : String(item.date || "À dater");
      return `<li class="cockpit-monthly-item" data-monthly-post-state="${readiness.key}" style="--snapshot-color:${theme.color}"><button type="button" data-monthly-snapshot-event="${esc(item.id)}" aria-label="${esc(`${dateLabel}, ${item.t || "Thème"} : ${item.title || "Publication"}. État : ${readiness.label}`)}"><time class="cockpit-monthly-date"${date ? ` datetime="${date.toISOString().slice(0, 10)}"` : ""}>${esc(dateLabel)}</time><span class="cockpit-monthly-theme"><span aria-hidden="true">${theme.symbol}</span>${esc(item.t || "Thème")}</span><span class="cockpit-monthly-post-title">${esc(item.title || "Publication sans titre")}</span><span class="cockpit-monthly-state ${readiness.className}" title="${esc(readiness.label)}" aria-hidden="true">${readiness.symbol}</span></button></li>`;
    }).join("");
    return `<section class="cockpit-monthly-month" data-month="${esc(key)}"><h3>${esc(monthLabel)}</h3><ol class="cockpit-monthly-list">${items}</ol></section>`;
  }).join("");
}

function focusMonthlySnapshotEvent(itemId, allowRetry = true) {
  const findCard = () => [...document.querySelectorAll(".post[data-item-id]")].find((card) => card.dataset.itemId === itemId);
  const card = findCard();
  if (!card) {
    const item = Array.isArray(globalThis.posts) ? globalThis.posts.find((post) => post.id === itemId) : null;
    if (allowRetry && item && item.archivedEditorial !== true && requestCalendarItemVisibility(itemId)) {
      requestAnimationFrame(() => focusMonthlySnapshotEvent(itemId, false));
      return;
    }
    toast("Cette publication n’est plus visible dans le calendrier actif.", true);
    return;
  }
  requestCardExpansion(card, true);
  card.scrollIntoView({ behavior:"smooth", block:"center" });
  card.classList.remove("monthly-snapshot-focus");
  requestAnimationFrame(() => card.classList.add("monthly-snapshot-focus"));
  window.setTimeout(() => card?.classList.remove("monthly-snapshot-focus"), 1900);
}

function setupMonthlyEditorialSnapshot() {
  const calendar = document.querySelector("#calendrier");
  if (!calendar) return;
  let snapshot = calendar.querySelector("#cockpit-monthly-snapshot");
  if (!snapshot) {
    snapshot = document.createElement("details");
    snapshot.id = "cockpit-monthly-snapshot";
    snapshot.className = "cockpit-monthly-snapshot";
    snapshot.setAttribute("aria-labelledby", "cockpit-monthly-snapshot-title");
    try { snapshot.open = localStorage.getItem(monthlySnapshotCollapsedKey) !== "true"; }
    catch { snapshot.open = true; }
    const legend = Object.values(monthlyPostStates).map((item) => `<span class="cockpit-monthly-legend-item"><span class="cockpit-monthly-state ${item.className}" aria-hidden="true">${item.symbol}</span>${esc(item.label)}</span>`).join("");
    snapshot.innerHTML = `<summary><span class="cockpit-monthly-snapshot-title"><b id="cockpit-monthly-snapshot-title">Aperçu mensuel</b><small>Dates, thèmes, titres et état de préparation d’un coup d’œil</small></span><span class="cockpit-monthly-snapshot-count" data-monthly-snapshot-count>0</span></summary><div class="cockpit-monthly-legend" role="group" aria-label="Légende de l’état des publications">${legend}</div><div class="cockpit-monthly-snapshot-body" data-monthly-snapshot-body></div>`;
    const heading = calendar.querySelector(":scope > .heading");
    if (heading) heading.after(snapshot); else calendar.prepend(snapshot);
    snapshot.addEventListener("toggle", () => {
      try { localStorage.setItem(monthlySnapshotCollapsedKey, String(!snapshot.open)); } catch {}
    });
    snapshot.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-monthly-snapshot-event]");
      if (button) focusMonthlySnapshotEvent(button.dataset.monthlySnapshotEvent);
    });
  }
  renderMonthlyEditorialSnapshot();
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
    const calendar = buildPostCalendarIcs(planItem, { schedule: state.rows.get(planItem?.id) || {}, role: state.profile?.role || "" });
    downloadCalendarFile(calendar.filename, calendar.content);
    const feedback = button.parentElement?.querySelector("[data-post-calendar-feedback]");
    if (feedback) feedback.textContent = `Fichier prêt pour ${profileTaskLabel(state.profile?.role)}.`;
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
      const calendar = buildWeeklyCoordinationIcs({ weekday, hour, minute, duration, role: state.profile?.role || "" });
      downloadCalendarFile(calendar.filename, calendar.content);
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
  credit.innerHTML = `<span>Conçu, programmé et designé par Valentin Wittwe — Directeur des Communications © Bleu Massawippi</span><a href="./actualiser.html" data-refresh-cockpit>Actualiser l’application</a>`;
  document.querySelector("footer")?.appendChild(credit);
}

function getPlanItem(card) {
  const title = card.querySelector("h4")?.textContent?.trim();
  const rows = Array.isArray(globalThis.posts) ? globalThis.posts : [];
  return rows.find((item) => item.title === title) || null;
}

function canEdit() {
  return Boolean(!safeMode && state.profile && ["director", "admin"].includes(state.profile.role));
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

function setupCollapsibleNavigation() {
  if (document.body.dataset.collapsibleNavigationReady === "true") return;
  document.body.dataset.collapsibleNavigationReady = "true";
  setupSectionNavigation();
}

function setupGuidePreference() {
  const guide = document.querySelector("#context-collapsible");
  const summary = guide?.querySelector(":scope > summary");
  if (!guide || !summary || guide.dataset.preferenceReady === "true") return;
  guide.dataset.preferenceReady = "true";

  const readmeVersion = guide.querySelector("[data-readme-version]")?.dataset.readmeVersion || "";
  const contextVersion = guide.querySelector("[data-context-version]")?.dataset.contextVersion || "";
  const version = [guide.dataset.layoutVersion || "1", readmeVersion, contextVersion].filter(Boolean).join("|");
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

const internalProjectStageLabels = {
  to_frame: "À cadrer",
  planned: "Plan prêt",
  active: "En cours",
  blocked: "Décision ou ressource requise",
  completed: "Terminé · archivé"
};

const internalProjectDocuments = {
  "lamproie-du-nord": "https://bleumassawippi.sharepoint.com/:b:/g/IQCTFvLyX6jASbAvhxiNBV24AecNyeSIKocEE4rugzpUwMg",
  "application-carte-vivante-lac": "./project-documents/Proposition_assainie_application-carte-vivante-lac_v1.pdf",
  "parc-lobadanaki": "https://bleumassawippi.sharepoint.com/:b:/g/IQDoNKmVAwRiS6zoxpdBGKG9AcPqhdAixzzaNF-UciMEU48",
  "bilan-sante-lac": "https://bleumassawippi.sharepoint.com/:b:/g/IQAPfrI-SyafSJp2pIEkUvklAXkVc-8K91CfggeQG9-nlgM",
  "jeux-provinciaux-peche": "https://bleumassawippi.sharepoint.com/:b:/g/IQCAYpT7T1UfT7yHeonaWBSQAaRfSBVh-5lf3oyWyZyxB2Y",
  "caracterisation-benthos": "https://bleumassawippi.sharepoint.com/:b:/g/IQDNIBBaNQiWSb4w3vHvRKVNAdkDSFqFT1s-8wcg-raBuR0",
  "surveillance-cyanobacteries": "https://bleumassawippi.sharepoint.com/:b:/g/IQBUsJN5RZ4dQZQtJpBsDs8zATQAoMGye2-zC2p1LSG7ZZI",
  "technicien-un-jour": "https://bleumassawippi.sharepoint.com/:b:/g/IQAWTUj50-q4RI2MsqXhguoGAR40CPIUOobrXXGW8_unqTU",
  "moules-zebrees-continuite": "https://bleumassawippi.sharepoint.com/:b:/g/IQBXwzZegi8BSY5DuP3rDttyAWsDf-gFyjhakqJlog2d3N4",
  "concours-dessin-jeunesse": "https://bleumassawippi.sharepoint.com/:b:/g/IQDsIFjEf4YETIVG-18XQcJ1AV-jafuAp-KN29rbC1UceDc",
  "poesie-du-lac": "https://bleumassawippi.sharepoint.com/:b:/g/IQCyOfzcvrESQoKnMtA767ptAX07rnuuy0bafL63zPN5Vh4",
  "fonds-environnemental-partenarial": "https://bleumassawippi.sharepoint.com/:b:/g/IQCwoXOdfzAlR4BnifeACG_nARNJ6BS_1-i03fDgVFKr3Ts",
  "colloque-reseautage-associations": "https://bleumassawippi.sharepoint.com/:b:/g/IQDGFMjv3vqAS7ktHZ7FGOTbARBUv1Jtba2bRKI0ipemg60",
  "concours-universitaire-bourse": "https://bleumassawippi.sharepoint.com/:b:/g/IQAD0jc2nS2CRIQh3EbkQYQrAanhl2vno8sqQ0U06PkDjgc"
};

function decorateInternalProjectDocuments() {
  Object.entries(internalProjectDocuments).forEach(([projectId, url]) => {
    const card = document.querySelector(`.internal-project[data-internal-project-id="${projectId}"]`);
    const body = card?.querySelector(".internal-project-docs-body");
    if (!body || body.querySelector(".internal-project-proposal")) return;
    body.insertAdjacentHTML("afterbegin", `<a class="internal-project-proposal" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Ouvrir le dossier de proposition assaini</a>`);
  });
}

function setupInternalProjectPreference() {
  const register = document.querySelector("[data-internal-project-register]");
  const summary = register?.querySelector(":scope > summary");
  if (!register || !summary || register.dataset.preferenceReady === "true") return;
  register.dataset.preferenceReady = "true";
  const version = register.dataset.layoutVersion || "1";
  const storedPreference = localStorage.getItem(internalProjectCollapsedKey);
  const lastSeenVersion = localStorage.getItem(internalProjectSeenVersionKey);
  const firstVisit = storedPreference === null && lastSeenVersion === null;
  const collapseAtStartup = storedPreference === null ? true : storedPreference === "1";
  const hasUpdate = !firstVisit && lastSeenVersion !== version;
  if (storedPreference === null) localStorage.setItem(internalProjectCollapsedKey, "1");

  const oldHint = summary.querySelector("small");
  const actions = document.createElement("span");
  actions.className = "internal-project-summary-actions";
  if (oldHint) actions.appendChild(oldHint);
  actions.insertAdjacentHTML("beforeend", `<label class="guide-startup-control" title="Conserver les projets internes repliés lors des prochaines visites"><input type="checkbox" data-internal-project-collapse-default ${collapseAtStartup ? "checked" : ""}><span>Masquer au démarrage</span></label><b class="internal-project-new-badge" data-internal-project-new-badge ${hasUpdate ? "" : "hidden"}>✨ Nouveau</b>`);
  summary.appendChild(actions);
  const checkbox = actions.querySelector("[data-internal-project-collapse-default]");
  const badge = actions.querySelector("[data-internal-project-new-badge]");
  const updateHint = () => { if (oldHint) oldHint.textContent = register.open ? "Réduire" : "Afficher"; };
  const markSeen = () => {
    localStorage.setItem(internalProjectSeenVersionKey, version);
    badge.hidden = true;
    register.classList.remove("has-internal-project-update");
  };
  register.open = firstVisit ? true : !collapseAtStartup;
  if (firstVisit) localStorage.setItem(internalProjectSeenVersionKey, version);
  if (hasUpdate) register.classList.add("has-internal-project-update");
  updateHint();
  actions.addEventListener("click", (event) => event.stopPropagation());
  checkbox.addEventListener("change", () => {
    localStorage.setItem(internalProjectCollapsedKey, checkbox.checked ? "1" : "0");
    register.open = !checkbox.checked;
    if (register.open) markSeen();
    updateHint();
  });
  badge.addEventListener("click", () => { register.open = true; markSeen(); updateHint(); });
  register.addEventListener("toggle", () => { updateHint(); if (register.open && hasUpdate) markSeen(); });
}

function internalProjectWhen(row) {
  return row?.updatedAt?.toDate ? row.updatedAt.toDate().toLocaleString("fr-CA", { dateStyle:"short", timeStyle:"short" }) : "état initial du registre";
}

function internalProjectCommentSectionId(projectId) {
  return `internal-project-${projectId}`;
}

function renderInternalProjectNotes() {
  document.querySelectorAll(".internal-project[data-internal-project-id]").forEach((card) => {
    const sectionId = internalProjectCommentSectionId(card.dataset.internalProjectId);
    let box = card.querySelector("[data-internal-project-note-box]");
    if (!box) {
      box = document.createElement("section");
      box.className = "internal-project-note-box";
      box.dataset.internalProjectNoteBox = "true";
      box.innerHTML = `
        <h5>💬 Commentaires et décisions sur ce projet</h5>
        <p>Déposez ici une recommandation, une décision, une information à vérifier ou une prochaine action. Le fil est partagé, historisé et reste attaché à ce projet.</p>
        <section class="cockpit-thread"><div class="cockpit-thread-heading"><h5>Fil de suivi</h5><span>Le message le plus récent apparaît en bas.</span></div><div data-comment-thread aria-live="polite"></div></section>
        <div class="cockpit-comment-row">
          <textarea data-internal-project-comment maxlength="5000" spellcheck="true" autocapitalize="sentences" inputmode="text" placeholder="Ajouter un commentaire ou une consigne sur ce projet…" aria-label="Commentaire partagé sur ce projet"></textarea>
          <button type="button" data-dictate aria-pressed="false" aria-label="Dicter un commentaire de projet" title="Dicter un commentaire de projet">🎙️</button>
          <button class="save" type="button" data-save-internal-project-comment>Enregistrer</button>
          <div class="cockpit-voice-status" data-voice-status aria-live="polite">Cliquez sur le micro pour dicter, ou écrivez votre commentaire.</div>
        </div>
        <button type="button" class="develop-next-cycle" data-develop-next-cycle="internalProject">📌 À développer au prochain cycle</button>`;
      card.querySelector(".internal-project-body")?.appendChild(box);
    }
    box.dataset.commentSection = sectionId;
    renderCommentThread(box, sectionId);
  });
}

function renderInternalProjectStates() {
  const register = document.querySelector("[data-internal-project-register]");
  if (!register) return;
  let archived = 0;
  register.querySelectorAll(".internal-project[data-internal-project-id]").forEach((card) => {
    const row = state.internalProjects.get(card.dataset.internalProjectId);
    const stage = row?.stage || card.dataset.initialStage || "to_frame";
    const completed = stage === "completed";
    if (completed) archived += 1;
    card.classList.toggle("is-archived", completed);
    const label = card.querySelector("[data-internal-project-stage-label]");
    const deferredUntil = String(card.dataset.deferredUntil || "").trim();
    const deferredStatus = String(card.dataset.deferredStatus || "").trim();
    const waitingSource = String(card.dataset.waitingSource || "").trim();
    const requestedDeferred = stage === "planned" && Boolean(deferredUntil) && deferredStatus === "requested";
    if (label) {
      label.textContent = requestedDeferred
        ? `Report ${deferredUntil} demandé`
        : (stage === "planned" && deferredUntil
          ? `Reporté à ${deferredUntil}`
          : (waitingSource && stage !== "completed" ? "Source révisée attendue" : (internalProjectStageLabels[stage] || "À cadrer")));
    }
    const host = card.querySelector("[data-internal-project-controls]");
    if (!host) return;
    const buttons = Object.entries(internalProjectStageLabels).map(([value, text]) => `<button type="button" data-internal-project-stage="${value}" class="${stage === value ? "active" : ""}" aria-pressed="${stage === value}">${text}</button>`).join("");
    host.innerHTML = `<div class="internal-project-stage-controls"><b>Où en sommes-nous? Cette étape est partagée, réversible et conservée dans l’historique.</b><div class="internal-project-stage-buttons">${buttons}</div><span class="internal-project-stage-meta">${row ? `Mis à jour par ${esc(row.updatedByLabel || "un utilisateur")} · ${esc(internalProjectWhen(row))}` : "État proposé à confirmer dans le cockpit."}</span></div>`;
  });
  const count = register.querySelector("[data-internal-project-archive-count]");
  if (count) count.textContent = String(archived);
  renderInternalProjectNotes();
}

function setupInternalProjectEvents() {
  if (document.body.dataset.internalProjectEventsReady === "true") return;
  document.body.dataset.internalProjectEventsReady = "true";
  document.addEventListener("click", (event) => {
    const archiveToggle = event.target.closest("[data-toggle-internal-project-archives]");
    if (archiveToggle) {
      const register = document.querySelector("[data-internal-project-register]");
      if (!register) return;
      const active = !register.classList.contains("show-internal-project-archives");
      register.classList.toggle("show-internal-project-archives", active);
      archiveToggle.setAttribute("aria-pressed", String(active));
      archiveToggle.firstChild.textContent = active ? "Masquer les archives " : "Voir les archives ";
      return;
    }
    const card = event.target.closest(".internal-project[data-internal-project-id]");
    const noteBox = event.target.closest("[data-internal-project-note-box]");
    const sectionId = noteBox?.dataset.commentSection || (card ? internalProjectCommentSectionId(card.dataset.internalProjectId) : "");
    const developButton = event.target.closest("button[data-develop-next-cycle]");
    if (card && developButton && state.profile && ["director", "admin"].includes(state.profile.role)) {
      const title = card.querySelector(":scope > summary strong")?.textContent?.trim() || card.dataset.internalProjectId;
      developButton.disabled = true;
      upsertActionTask(`develop-internal-${card.dataset.internalProjectId}`, { status:"pending", title:`À développer — ${title}`, targetType:"section", targetId:card.id, targetLabel:title, message:"Développer cette fiche au prochain cycle de travail : vérifier les sources, préciser les prochaines actions et préparer les éléments utiles à la décision." }, state.profile)
        .then(() => toast("Sujet ajouté au prochain cycle de développement."))
        .catch((error) => toast(error.message, true))
        .finally(() => { developButton.disabled = false; });
      return;
    }
    const resolveCommentButton = event.target.closest("button[data-resolve-comment]");
    if (card && noteBox && resolveCommentButton) {
      resolveCommentButton.disabled = true;
      resolveComment(resolveCommentButton.dataset.resolveComment, state.profile)
        .then(async () => {
          try { await completeActionTask(`comment-internal-project-${resolveCommentButton.dataset.resolveComment}`, state.profile); } catch {}
          toast("Commentaire marqué comme traité et conservé dans l’historique.");
        })
        .catch((error) => toast(error.message, true))
        .finally(() => { resolveCommentButton.disabled = false; });
      return;
    }
    const editCommentButton = event.target.closest("button[data-edit-comment]");
    if (card && noteBox && editCommentButton) {
      const row = (state.commentsByEvent.get(sectionId) || []).find((item) => item.id === editCommentButton.dataset.editComment);
      const next = prompt("Modifier votre commentaire :", row?.comment || "");
      if (next !== null) updateOwnComment(editCommentButton.dataset.editComment, next, state.profile).then(() => toast("Commentaire modifié.")).catch((error) => toast(error.message, true));
      return;
    }
    const archiveCommentButton = event.target.closest("button[data-archive-comment]");
    if (card && noteBox && archiveCommentButton) {
      if (!confirm("Archiver ce commentaire? Son historique sera conservé.")) return;
      archiveOwnComment(archiveCommentButton.dataset.archiveComment, state.profile).then(() => toast("Commentaire archivé.")).catch((error) => toast(error.message, true));
      return;
    }
    const dictateButton = event.target.closest("button[data-dictate]");
    if (card && noteBox && dictateButton) {
      event.preventDefault();
      event.stopPropagation();
      startDictation(noteBox.querySelector("[data-internal-project-comment]"));
      return;
    }
    const saveCommentButton = event.target.closest("button[data-save-internal-project-comment]");
    if (card && noteBox && saveCommentButton) {
      const textarea = noteBox.querySelector("[data-internal-project-comment]");
      const text = textarea?.value.trim() || "";
      if (!text) { toast("Écrivez d’abord un commentaire.", true); return; }
      saveCommentButton.disabled = true;
      addComment(sectionId, text, state.profile, null, textarea.dataset.dictated === "true")
        .then(async (commentId) => {
          const title = card.querySelector(":scope > summary strong")?.textContent?.trim() || card.dataset.internalProjectId;
          await writeAuditLog(sectionId, textarea.dataset.dictated === "true" ? "commentaire de projet dicté" : "commentaire de projet ajouté", state.profile);
          await recordActionTask(`comment-internal-project-${commentId}`, { status:"pending", title:`Commentaire de projet à traiter — ${title}`, targetType:"section", targetId:card.id, targetLabel:title, message:text });
          textarea.value = "";
          delete textarea.dataset.dictated;
          toast("Commentaire de projet enregistré.");
        })
        .catch((error) => toast(error.message, true))
        .finally(() => { saveCommentButton.disabled = false; });
      return;
    }
    const button = event.target.closest("button[data-internal-project-stage]");
    if (!button || !state.profile || !["director", "admin"].includes(state.profile.role)) return;
    const stageCard = button.closest(".internal-project[data-internal-project-id]");
    if (!stageCard) return;
    const stage = button.dataset.internalProjectStage;
    const title = stageCard.querySelector(":scope > summary strong")?.textContent?.trim() || stageCard.dataset.internalProjectId;
    button.disabled = true;
    setInternalProjectStage(stageCard.dataset.internalProjectId, stage, state.profile)
      .then(async () => {
        const deferredUntil = String(stageCard.dataset.deferredUntil || "").trim();
        const deferredStatus = String(stageCard.dataset.deferredStatus || "").trim();
        const isDeferred = stage === "planned" && Boolean(deferredUntil);
        const requestedDeferred = isDeferred && deferredStatus === "requested";
        const deferredAudit = requestedDeferred ? `étape : planned · report ${deferredUntil} demandé` : `étape : planned · reporté à ${deferredUntil}`;
        await writeAuditLog("internal-project:" + stageCard.dataset.internalProjectId, isDeferred ? deferredAudit : "étape : " + stage, state.profile);
        await recordActionTask("internal-project-" + stageCard.dataset.internalProjectId, {
          status: stage === "completed" || (isDeferred && !requestedDeferred) ? "done" : "pending",
          title: `${requestedDeferred ? `Confirmation du report ${deferredUntil}` : (isDeferred ? `Reporté à ${deferredUntil}` : (internalProjectStageLabels[stage] || "Suivi"))} — ${title}`,
          targetType: "section",
          targetId: stageCard.id,
          targetLabel: title,
          message: requestedDeferred
            ? `Le report à ${deferredUntil} a été demandé; classer la confirmation écrite avant de le présenter comme accordé.`
            : (isDeferred ? `Projet reporté à ${deferredUntil}; aucune action active avant la revue de reprise.` : (stage === "blocked" ? "Une décision ou une ressource est requise. Ouvrir la fiche et traiter la prochaine action prioritaire." : "Ouvrir la fiche, vérifier la prochaine action et faire avancer le projet selon l’étape choisie."))
        });
        toast(requestedDeferred ? `Demande de report ${deferredUntil} enregistrée; confirmation écrite encore attendue.` : (isDeferred ? `Projet reporté à ${deferredUntil}; son historique reste accessible.` : (stage === "completed" ? "Projet terminé et classé; son historique reste accessible." : "Étape du projet interne enregistrée.")));
      })
      .catch((error) => toast(error.message, true))
      .finally(() => { button.disabled = false; });
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

function opportunityCommentSectionId(opportunityId) {
  return `opportunity-${opportunityId}`;
}

function renderOpportunityNotes() {
  document.querySelectorAll(".opportunity[data-opportunity-id]").forEach((card) => {
    const sectionId = opportunityCommentSectionId(card.dataset.opportunityId);
    let box = card.querySelector("[data-opportunity-note-box]");
    if (!box) {
      box = document.createElement("section");
      box.className = "opportunity-note-box";
      box.dataset.opportunityNoteBox = "true";
      box.innerHTML = `
        <h5>📝 Notes partagées sur cette occasion</h5>
        <p>Consignez ici un contact à garder, une idée de projet, une date de veille ou une condition à vérifier. Les notes restent liées à cette fiche et sont historisées.</p>
        <section class="cockpit-thread"><div class="cockpit-thread-heading"><h5>Fil de suivi</h5><span>Le message le plus récent apparaît en bas.</span></div><div data-comment-thread aria-live="polite"></div></section>
        <div class="cockpit-comment-row">
          <textarea data-opportunity-comment maxlength="5000" spellcheck="true" autocapitalize="sentences" inputmode="text" placeholder="Ex. Garder le contact et préparer une piste pour la prochaine ronde…" aria-label="Note partagée sur cette occasion"></textarea>
          <button type="button" data-dictate aria-pressed="false" aria-label="Dicter une note" title="Dicter une note">🎙️</button>
          <button class="save" type="button" data-save-opportunity-comment>Enregistrer</button>
          <div class="cockpit-voice-status" data-voice-status aria-live="polite">Cliquez sur le micro pour dicter, ou écrivez votre note.</div>
        </div>
        <button type="button" class="develop-next-cycle" data-develop-next-cycle="opportunity">📌 À développer au prochain cycle</button>`;
      card.querySelector(".opportunity-body")?.appendChild(box);
    }
    box.dataset.commentSection = sectionId;
    renderCommentThread(box, sectionId);
  });
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
  renderOpportunityNotes();
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
    const card = event.target.closest(".opportunity[data-opportunity-id]");
    const noteBox = event.target.closest("[data-opportunity-note-box]");
    const sectionId = noteBox?.dataset.commentSection || (card ? opportunityCommentSectionId(card.dataset.opportunityId) : "");
    const developButton = event.target.closest("button[data-develop-next-cycle]");
    if (card && developButton && state.profile && ["director", "admin"].includes(state.profile.role)) {
      const title = card.querySelector(":scope > summary strong")?.textContent?.trim() || card.dataset.opportunityId;
      developButton.disabled = true;
      upsertActionTask(`develop-opportunity-${card.dataset.opportunityId}`, { status:"pending", title:`À développer — ${title}`, targetType:"section", targetId:card.id, targetLabel:title, message:"Développer cette occasion au prochain cycle : actualiser l’éligibilité, les sources, les documents requis et l’ordre des prochaines actions." }, state.profile)
        .then(() => toast("Occasion ajoutée au prochain cycle de développement."))
        .catch((error) => toast(error.message, true))
        .finally(() => { developButton.disabled = false; });
      return;
    }
    const resolveCommentButton = event.target.closest("button[data-resolve-comment]");
    if (card && resolveCommentButton) {
      resolveCommentButton.disabled = true;
      resolveComment(resolveCommentButton.dataset.resolveComment, state.profile)
        .then(async () => {
          try { await completeActionTask(`comment-opportunity-${resolveCommentButton.dataset.resolveComment}`, state.profile); } catch {}
          toast("Note marquée comme traitée et conservée dans l’historique.");
        })
        .catch((error) => toast(error.message, true))
        .finally(() => { resolveCommentButton.disabled = false; });
      return;
    }
    const editCommentButton = event.target.closest("button[data-edit-comment]");
    if (card && editCommentButton) {
      const row = (state.commentsByEvent.get(sectionId) || []).find((item) => item.id === editCommentButton.dataset.editComment);
      const next = prompt("Modifier votre note :", row?.comment || "");
      if (next !== null) updateOwnComment(editCommentButton.dataset.editComment, next, state.profile).then(() => toast("Note modifiée.")).catch((error) => toast(error.message, true));
      return;
    }
    const archiveCommentButton = event.target.closest("button[data-archive-comment]");
    if (card && archiveCommentButton) {
      if (!confirm("Archiver cette note? Son historique sera conservé.")) return;
      archiveOwnComment(archiveCommentButton.dataset.archiveComment, state.profile).then(() => toast("Note archivée.")).catch((error) => toast(error.message, true));
      return;
    }
    const dictateButton = event.target.closest("button[data-dictate]");
    if (card && noteBox && dictateButton) {
      event.preventDefault();
      startDictation(noteBox.querySelector("[data-opportunity-comment]"));
      return;
    }
    const saveCommentButton = event.target.closest("button[data-save-opportunity-comment]");
    if (card && noteBox && saveCommentButton) {
      const textarea = noteBox.querySelector("[data-opportunity-comment]");
      const text = textarea?.value.trim() || "";
      if (!text) { toast("Écrivez d’abord une note.", true); return; }
      saveCommentButton.disabled = true;
      addComment(sectionId, text, state.profile, null, textarea.dataset.dictated === "true")
        .then(async (commentId) => {
          const title = card.querySelector(":scope > summary strong")?.textContent?.trim() || card.dataset.opportunityId;
          await writeAuditLog(sectionId, textarea.dataset.dictated === "true" ? "note dictée" : "note ajoutée", state.profile);
          await recordActionTask(`comment-opportunity-${commentId}`, { status:"pending", title:`Note à traiter — ${title}`, targetType:"section", targetId:card.id, targetLabel:title, message:text });
          textarea.value = "";
          delete textarea.dataset.dictated;
          toast("Note partagée enregistrée.");
        })
        .catch((error) => toast(error.message, true))
        .finally(() => { saveCommentButton.disabled = false; });
      return;
    }
    const button = event.target.closest("button[data-opportunity-stage]");
    if (!button || !state.profile || !["director", "admin"].includes(state.profile.role)) return;
    const stageCard = button.closest(".opportunity[data-opportunity-id]");
    if (!stageCard) return;
    button.disabled = true;
    setOpportunityStage(stageCard.dataset.opportunityId, button.dataset.opportunityStage, state.profile)
      .then(async () => {
        await writeAuditLog("opportunity:" + stageCard.dataset.opportunityId, "étape : " + button.dataset.opportunityStage, state.profile);
        toast(button.dataset.opportunityStage === "completed" ? "Occasion finalisée et classée dans les archives." : "Étape de l’occasion enregistrée.");
      })
      .catch((error) => toast(error.message, true))
      .finally(() => { button.disabled = false; });
  });
}

const mediaStageLabels = {
  source: "Source",
  proposal: "Proposition à examiner",
  draft: "En révision",
  approved: "Approuvé",
  published: "Publié",
  reference: "Référence"
};

const workflowTextApprovedStages = new Set(["content_approved", "media_in_progress", "media_review", "media_changes_requested", "final_approved", "scheduled", "published"]);

function showAuthenticatedLoadError(message, retryAction = null) {
  const login = document.querySelector("#cockpit-login") || buildLogin();
  document.body.classList.add("cockpit-locked", "cockpit-readonly");
  login.removeAttribute("hidden");
  const error = login.querySelector("#cockpit-login-error");
  const note = login.querySelector("#cockpit-login-note");
  const retry = login.querySelector("#cockpit-retry-content");
  if (error) error.textContent = message || "Les données du cockpit sont temporairement indisponibles.";
  if (note) note.textContent = "Votre session demeure connectée. Aucun changement n’a été perdu; réessayez lorsque le service répond.";
  if (!retry) return;
  retry.hidden = false;
  retry.onclick = async () => {
    retry.disabled = true;
    retry.textContent = "Nouvel essai…";
    if (error) error.textContent = "";
    try {
      if (typeof retryAction === "function") await retryAction();
      else location.reload();
    } catch (reason) {
      if (error) error.textContent = reason?.message || "Le cockpit demeure temporairement indisponible.";
      if (note) note.textContent = "Votre session est toujours conservée. Vous pourrez réessayer sans vous reconnecter.";
    } finally {
      retry.disabled = false;
      retry.textContent = "Réessayer le chargement";
    }
  };
}

const mediaKindIcons = {
  image: "🖼️",
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

function safeMediaPreviewUrl(value) {
  try {
    const p = new URL(value);
    if (p.protocol === "https:" && p.hostname.toLowerCase() === "vhaloo.github.io" && p.pathname.startsWith("/bleu-massawippi-cockpit/media-previews/")) return p.href;
    return safeMediaUrl(p.href);
  } catch { return ""; }
}

function mediaPreviewUrl(row) {
  const url = safeMediaUrl(row.url);
  if (!url || row.kind !== "image") return "";
  const dedicatedPreview = safeMediaPreviewUrl(row.previewUrl || "");
  if (/\.(?:jpe?g|png|webp|gif)(?:$|\?)/i.test(dedicatedPreview)) return dedicatedPreview;
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
  const navigation = card.querySelector("[data-media-nav]");
  const selectionNote = card.querySelector("[data-media-selection-note]");
  if (!gallery || !count || !navigation) return;
  const planItem = getPlanItem(card);
  const allowsMultiple = planItem?.mediaSelectionMode === "multiple";
  const requiredSelectionCount = allowsMultiple ? 2 : 1;
  const rows = (state.mediaByEvent.get(card.dataset.itemId) || []).filter((row) => row.archived !== true && safeMediaUrl(row.url));
  const decisions = (state.commentsByEvent.get(card.dataset.itemId) || []).filter((row) => row.deleted !== true && /^\[MÉDIA RETENU:/.test(row.comment || ""));
  const latestDecision = decisions.at(-1)?.comment || "";
  count.textContent = String(rows.length);
  const structuredDecision = state.mediaDecisions.get(card.dataset.itemId) || null;
  const roleSide = state.profile?.role === "director" ? "direction" : "communications";
  const mySelectionCount = structuredDecision?.[roleSide]?.status === "selected" && Array.isArray(structuredDecision[roleSide].mediaIds)
    ? structuredDecision[roleSide].mediaIds.length
    : 0;
  if (selectionNote) {
    selectionNote.hidden = !allowsMultiple;
    selectionNote.classList.toggle("is-complete", allowsMultiple && mySelectionCount >= requiredSelectionCount);
    selectionNote.textContent = allowsMultiple
      ? `${mySelectionCount >= requiredSelectionCount ? "✓" : "🖼️"} ${planItem.mediaSelectionLabel || "Carrousel"} · choisissez les ${requiredSelectionCount} cartes (${Math.min(mySelectionCount, requiredSelectionCount)}/${requiredSelectionCount}). Elles seront publiées ensemble dans l’ordre indiqué.`
      : "";
  }
  if (!rows.length) {
    const contextLoading = state.mediaContextLoading.has(card.dataset.itemId);
    gallery.innerHTML = contextLoading
      ? `<p class="cockpit-media-empty cockpit-media-loading" role="status">Chargement des médias liés…</p>`
      : `<p class="cockpit-media-empty">Aucun média lié. Déposez le fichier dans OneDrive, créez un lien de consultation, puis ajoutez-le ici.</p>`;
    navigation.hidden = true;
    return;
  }
  gallery.innerHTML = rows.map((row) => {
    const url = safeMediaUrl(row.url);
    const preview = mediaPreviewUrl(row);
    const visual = preview
      ? `<img data-media-preview src="${esc(preview)}" alt="${esc(row.label || "Aperçu du média")}" loading="lazy" decoding="async" referrerpolicy="no-referrer"><span class="cockpit-media-enlarge" aria-hidden="true">Agrandir ↗</span>`
      : `<span><span class="cockpit-media-icon" aria-hidden="true">${mediaKindIcons[row.kind] || "🔗"}</span><span class="cockpit-media-open-label">Ouvrir ${row.kind === "image" ? "l’image" : "le média"}</span></span>`;
    const choice = buildMediaChoiceModel(state.mediaDecisions.has(card.dataset.itemId), state.mediaDecisions.get(card.dataset.itemId) || null, row, latestDecision);
    const isFinal = choice.finalSelected;
    const isBlocked = row.publicationBlocked === true;
    const rightsNeedConfirmation = mediaRightsNeedsConfirmation(row);
    const rightsConfirmed = row.rightsConfirmed === true;
    const workflowStage = state.workflows.get(card.dataset.itemId)?.stage || "proposal";
    const textApproved = workflowTextApprovedStages.has(workflowStage);
    const role = state.profile?.role;
    const myChoiceSelected = role === "admin" ? choice.communicationsSelected : role === "director" ? choice.directionSelected : false;
    const chooseLabel = allowsMultiple
      ? (myChoiceSelected ? "Retirer cette carte du carrousel" : "Ajouter cette carte au carrousel")
      : role === "admin"
        ? (myChoiceSelected ? "Retirer mon choix" : "Choisir ce visuel")
        : (myChoiceSelected ? "Retirer mon choix" : textApproved ? "Approuver ce visuel" : "Choisir ce visuel");
    const choiceDisabled = isBlocked;
    const agreementPresentation = mediaAgreementPresentation(choice);
    const infoStatus = isFinal
      ? agreementPresentation.info
      : choice.sameRoleChoice ? "✓ Même choix" : choice.communicationsSelected ? "Recommandé" : choice.directionSelected ? "Choix direction" : choice.legacySelected ? "Hérité" : "Ouvrir";
    const defaultImageChoice = mediaImageChoicePresentation(choice, role, myChoiceSelected);
    const imageChoiceLabel = allowsMultiple
      ? (myChoiceSelected ? "✓ Carte choisie — retirer" : "Ajouter au carrousel")
      : defaultImageChoice.label;
    const imageChoiceClass = defaultImageChoice.className;
    const roleBadges = [
      choice.communicationsSelected ? `<span class="cockpit-media-role-badge communications">✓ Recommandé par les communications</span>` : "",
      choice.directionSelected ? `<span class="cockpit-media-role-badge direction">✓ Choisi par la direction générale · visuel prêt</span>` : "",
      choice.agreementSelected ? `<span class="cockpit-media-role-badge agreement">${agreementPresentation.badge}</span>` : choice.sameRoleChoice ? `<span class="cockpit-media-role-badge agreement">✓ Même visuel choisi par les deux rôles</span>` : "",
      choice.divergent && choice.directionSelected ? `<span class="cockpit-media-role-badge direction">Préférence des communications différente · décision de la direction retenue</span>` : "",
      choice.legacySelected ? `<span class="cockpit-media-role-badge">Choix hérité à confirmer — acteur non attribué</span>` : ""
    ].join("");
    const canOverride = !isBlocked && myChoiceSelected && !choice.agreementSelected && (role === "admin" || (role === "director" && textApproved));
    const mediaUpdatedAt = stateTimestampMillis(row.updatedAt || row.createdAt);
    return `<article class="cockpit-media-card ${isFinal ? "is-final" : ""}${choice.communicationsSelected ? " is-recommended" : ""}${choice.directionSelected ? " is-direction-selected" : ""}${choice.divergent && !choice.directionSelected ? " is-divergent" : ""}${isBlocked ? " is-blocked" : ""}" data-media-id="${esc(row.id)}" data-media-stage="${esc(row.stage || "reference")}" data-media-updated-at="${mediaUpdatedAt}" data-media-selected-final="${String(isFinal)}" data-media-communications-selected="${String(choice.communicationsSelected)}" data-media-direction-selected="${String(choice.directionSelected)}">
      <a class="cockpit-media-preview" href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="Ouvrir ${esc(row.label || "le média")} dans une nouvelle fenêtre">${visual}</a>
      ${["director","admin"].includes(role) && !isBlocked ? `<button type="button" class="cockpit-media-image-choice${imageChoiceClass}" data-media-decision="${esc(row.id)}" data-media-label="${esc(row.label || "Média OneDrive")}" aria-pressed="${myChoiceSelected}" aria-label="${esc(imageChoiceLabel)} — ${esc(row.label || "média")}">${esc(imageChoiceLabel)}</button>` : isBlocked ? `<span class="cockpit-media-image-status">Référence seulement</span>` : ""}
      <details class="cockpit-media-info" open><summary><span>Informations et actions</span><small class="cockpit-media-info-status ${isFinal ? "is-final" : ""}">${infoStatus}</small></summary><div class="cockpit-media-info-body">
        ${rightsNeedConfirmation && ["director","admin"].includes(role) ? `<label class="cockpit-media-rights-control${rightsConfirmed ? " is-confirmed" : ""}"><input type="checkbox" data-media-rights-confirmation="${esc(row.id)}"${rightsConfirmed ? " checked" : ""}><span><b>${rightsConfirmed ? "✓ Droits confirmés" : "Droits de diffusion à confirmer"}</b><small>${rightsConfirmed ? `Confirmés par ${esc(row.rightsConfirmedByLabel || "un membre de l’équipe")}. Décochez pour remettre ce point en attente.` : "Cochez seulement après avoir vérifié la source, le crédit et les autorisations nécessaires."}</small></span></label>` : ""}
        ${isBlocked && rightsNeedConfirmation ? `<span class="cockpit-media-rights-warning">⚠ Ce média reste une référence interne tant que les droits ne sont pas confirmés.</span>` : ""}
        ${isBlocked && !rightsNeedConfirmation ? `<span class="cockpit-media-blocked">Référence conservée pour comparaison — ne pas choisir pour diffusion.</span>` : ""}
        <div class="cockpit-media-meta"><b title="${esc(row.label || "Média OneDrive")}">${esc(row.label || "Média OneDrive")}</b>${row.note ? `<p>${esc(row.note)}</p>` : ""}<span class="cockpit-media-stage">${esc(mediaStageLabels[row.stage] || "Référence")}</span><br><a class="cockpit-media-source-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">Ouvrir l’original dans OneDrive ↗</a></div>
        ${roleBadges ? `<div class="cockpit-media-role-badges">${roleBadges}</div>` : ""}
        ${["director","admin"].includes(role) ? `<button type="button" class="cockpit-media-final-action" data-media-decision="${esc(row.id)}" data-media-label="${esc(row.label || "Média OneDrive")}" aria-pressed="${myChoiceSelected}"${choiceDisabled ? " disabled" : ""}>${isBlocked ? "Référence non diffusable" : chooseLabel}</button>${canOverride ? `<button type="button" class="cockpit-media-override-action" data-media-override="${esc(row.id)}" data-media-label="${esc(row.label || "Média OneDrive")}">${role === "admin" && !textApproved ? "Valider le texte et retenir ce visuel…" : "Retenir comme décision finale…"}</button>` : ""}<div class="cockpit-media-comment" data-voice-container><input type="text" maxlength="1000" data-media-comment="${esc(row.id)}" placeholder="Dire quelque chose sur ce média…" aria-label="Commentaire sur ${esc(row.label || "ce média")}"><button type="button" data-dictate aria-pressed="false" aria-label="Dicter un commentaire sur ce média" title="Dicter un commentaire sur ce média">🎙️</button><button type="button" data-save-media-comment="${esc(row.id)}" data-media-label="${esc(row.label || "Média OneDrive")}">Envoyer</button><div class="cockpit-voice-status" data-voice-status aria-live="polite">Cliquez sur le micro pour dicter, ou écrivez votre commentaire.</div></div>` : ""}
        ${canEdit() ? `<button type="button" data-archive-media="${esc(row.id)}" aria-label="Archiver ce lien média" title="Archiver sans supprimer">Archiver ce lien</button>` : ""}
      </div></details>
    </article>`;
  }).join("");
  synchronizeMediaInfoPanels(gallery);
  gallery.querySelectorAll("img[data-media-preview]").forEach((image) => {
    image.addEventListener("error", () => {
      const replacement = document.createElement("span");
      replacement.className = "cockpit-media-icon";
      replacement.textContent = "🖼️";
      image.replaceWith(replacement);
    }, { once: true });
  });
  setupMediaNavigation(gallery, navigation, rows.length);
}

function setupMediaNavigation(gallery, navigation, total) {
  if (total < 2) {
    navigation.hidden = true;
    navigation.innerHTML = "";
    return;
  }
  navigation.hidden = false;
  navigation.innerHTML = `<button type="button" data-media-previous aria-label="Média précédent">←</button><span class="cockpit-media-position" data-media-position>1 / ${total}</span><button type="button" data-media-next aria-label="Média suivant">→</button>`;
  const cards = [...gallery.querySelectorAll(".cockpit-media-card")];
  const previous = navigation.querySelector("[data-media-previous]");
  const next = navigation.querySelector("[data-media-next]");
  const position = navigation.querySelector("[data-media-position]");
  let frame = 0;
  const currentIndex = () => {
    const center = gallery.scrollLeft + gallery.clientWidth / 2;
    let selected = 0;
    let distance = Number.POSITIVE_INFINITY;
    cards.forEach((mediaCard, index) => {
      const candidate = Math.abs(mediaCard.offsetLeft + mediaCard.offsetWidth / 2 - center);
      if (candidate < distance) { distance = candidate; selected = index; }
    });
    return selected;
  };
  const update = () => {
    frame = 0;
    const index = currentIndex();
    position.textContent = `${index + 1} / ${total}`;
    previous.disabled = index === 0;
    next.disabled = index === total - 1;
  };
  const move = (direction) => {
    const target = Math.max(0, Math.min(total - 1, currentIndex() + direction));
    gallery.scrollTo({ left: cards[target].offsetLeft - gallery.offsetLeft, behavior: "smooth" });
  };
  previous.onclick = () => move(-1);
  next.onclick = () => move(1);
  gallery.onscroll = () => { if (!frame) frame = requestAnimationFrame(update); };
  update();
}

function renderAllMedia() {
  document.querySelectorAll(".post[data-item-id]").forEach(renderMediaForCard);
}

function mediaControlsMarkup(planItem) {
  const folderUrl = safeMediaUrl(state.mediaConfig?.folderUrl || state.mediaConfig?.folderViewUrl || "");
  return `<details class="cockpit-media" open>
    <summary>Médias OneDrive <span class="cockpit-media-count" data-media-count>0</span></summary>
    <div class="cockpit-media-body">
      <p class="cockpit-media-selection-note" data-media-selection-note hidden></p>
      <div class="cockpit-media-gallery" data-media-gallery></div>
      <div class="cockpit-media-nav" data-media-nav hidden></div>
      <p class="cockpit-media-swipe-hint">Sur mobile, glissez les images ou utilisez les flèches pour toutes les voir.</p>
      <form class="cockpit-media-form" data-media-form data-event-id="${esc(planItem.id)}">
        <input type="url" name="media-url" maxlength="2048" required placeholder="Lien de consultation OneDrive / SharePoint" aria-label="Lien OneDrive ou SharePoint">
        <input type="text" name="media-label" maxlength="180" required placeholder="Nom du média" aria-label="Nom du média">
        <select name="media-kind" aria-label="Type de média"><option value="image">Image</option><option value="video">Vidéo</option><option value="pdf">PDF</option><option value="document">Document</option><option value="folder">Dossier</option><option value="other">Autre lien</option></select>
        <div class="cockpit-media-form-note" data-voice-container><input type="text" name="media-note" maxlength="1000" placeholder="Note facultative : source, droits, correction demandée…" aria-label="Note sur le média"><button type="button" data-dictate aria-pressed="false" aria-label="Dicter une note sur le média" title="Dicter une note sur le média">🎙️</button><div class="cockpit-voice-status" data-voice-status aria-live="polite">Cliquez sur le micro pour dicter la note facultative.</div></div>
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
  return `<section class="cockpit-workflow" data-workflow><h5><span>Les 3 feux verts</span><small class="cockpit-workflow-path">📝 Texte → 🖼️ Visuel → ✓ Publication</small></h5><details class="cockpit-workflow-help"><summary>Comment ça marche ?</summary><p>Le texte et le visuel peuvent avancer en parallèle. Chacun peut choisir un visuel; le choix de la direction le marque prêt et un même choix des deux rôles affiche leur accord. Cliquez de nouveau pour retirer votre choix : l’historique est conservé. La publication demeure réservée aux communications et exige les deux feux verts.</p></details><div class="cockpit-workflow-gates"><button type="button" class="cockpit-workflow-gate" data-gate="content" aria-pressed="false"><b>📝 1 · Texte</b><span data-gate-label>À valider</span></button><button type="button" class="cockpit-workflow-gate" data-gate="media" aria-pressed="false"><b>🖼️ 2 · Visuel</b><span data-gate-label>Choix en attente</span></button><button type="button" class="cockpit-workflow-gate" data-gate="publication" aria-pressed="false"><b>✓ 3 · Terminé</b><span data-gate-label>Publié ou programmé</span></button></div><div class="cockpit-workflow-actions" data-workflow-actions data-event-id="${esc(planItem.id)}"></div><p class="cockpit-workflow-complete" data-workflow-complete hidden>Tout est terminé. Cet événement reste conservé et consultable.</p></section>`;
}

function editorialDecisionMarkup(planItem) {
  if (planItem.decisionLocked === true) return `<section class="cockpit-editorial-decision locked"><b>✓ Publication déjà confirmée pour cette journée</b><p class="cockpit-editorial-help">L’arbitrage rapide est masqué pour cet événement certain. Les validations du texte et du visuel restent disponibles ci-dessous.</p></section>`;
  return `<section class="cockpit-editorial-decision" data-editorial-controls><b>Choix éditorial pour cette proposition</b><div class="cockpit-editorial-buttons"><button type="button" data-editorial-decision="chosen">★ Retenir pour ce jour</button><button type="button" data-editorial-decision="deferred">↪ Bonne idée — autre jour</button><button type="button" data-editorial-decision="rejected">✕ Ne pas retenir cet angle</button><button type="button" data-editorial-decision="undecided">Réinitialiser</button></div><p class="cockpit-editorial-help"><b>Autre jour</b> conserve l’idée pour un prochain remaniement. <b>Ne pas retenir</b> signale que cet angle ne doit pas être reproposé sans nouvelle discussion.</p><span class="cockpit-editorial-meta" data-editorial-meta>Décision en attente.</span></section>`;
}

function renderEditorialDecision(card) {
  const row = state.decisions.get(card.dataset.itemId) || { decision: "undecided" };
  const decision = row.decision || "undecided";
  card.dataset.editorialUpdatedAt = String(stateTimestampMillis(row.updatedAt));
  card.classList.toggle("editorial-chosen", decision === "chosen");
  card.classList.toggle("editorial-deferred", decision === "deferred");
  card.classList.toggle("editorial-rejected", decision === "rejected");
  card.querySelectorAll("[data-editorial-decision]").forEach((button) => {
    const active = button.dataset.editorialDecision === decision;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  const meta = card.querySelector("[data-editorial-meta]");
  if (meta) {
    const labels = { undecided:"Décision en attente.", chosen:"Retenu pour cette journée.", deferred:"Mis de côté pour être reprogrammé.", rejected:"Angle écarté; ne pas le reproposer sans nouvelle discussion." };
    meta.textContent = `${labels[decision] || labels.undecided}${row.updatedByLabel ? ` · ${row.updatedByLabel}` : ""}`;
  }
}

function renderWorkflow(card) {
  const row = state.workflows.get(card.dataset.itemId) || { stage: "proposal" };
  const stage = row.stage || "proposal";
  const planItem = getPlanItem(card);
  const requiredMediaCount = planItem?.mediaSelectionMode === "multiple"
    ? 2
    : 1;
  const structuredMediaDecision = state.mediaDecisions.get(card.dataset.itemId) || null;
  const structuredMediaAgreement = ["agreed", "overridden"].includes(structuredMediaDecision?.agreement?.status);
  const directionMediaReady = structuredMediaDecision?.direction?.status === "selected"
    && Array.isArray(structuredMediaDecision.direction.mediaIds)
    && structuredMediaDecision.direction.mediaIds.length >= requiredMediaCount;
  card.dataset.workflowStage = stage;
  card.dataset.workflowUpdatedAt = String(stateTimestampMillis(row.updatedAt));
  const contentDone = ["content_approved","media_in_progress","media_review","media_changes_requested","final_approved","scheduled","published"].includes(stage);
  const mediaDone = structuredMediaDecision
    ? directionMediaReady || structuredMediaAgreement
    : ["final_approved","scheduled","published"].includes(stage);
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
  if (mediaLabel) mediaLabel.textContent = mediaDone
    ? (structuredMediaDecision?.agreement?.status === "overridden" ? "Validé par override motivé" : structuredMediaAgreement ? "Accord des deux rôles" : "Choisi par la direction")
    : structuredMediaDecision?.agreement?.status === "divergent"
      ? "Choix à harmoniser"
      : (stage === "media_review" ? "Prêt pour validation" : "Choix en attente");
  const publicationReady = contentDone && mediaDone;
  if (publicationLabel) publicationLabel.textContent = publicationDone ? "Publié ou programmé" : publicationReady ? "Prêt à publier" : "Attend les 2 validations";
  const configureGate = (gate, done, canCheck, checkStage, uncheckStage, checkedName, roleAllowed = true) => {
    if (!gate) return;
    gate.setAttribute("aria-pressed", String(done));
    gate.disabled = !roleAllowed || (!done && !canCheck);
    if (roleAllowed) {
      gate.dataset.workflowStage = done ? uncheckStage : checkStage;
      gate.dataset.workflowDirection = done ? "back" : "forward";
    } else {
      delete gate.dataset.workflowStage;
      delete gate.dataset.workflowDirection;
    }
    gate.title = !roleAllowed
      ? checkedName === "Terminé" ? "Seules les communications confirment la programmation ou la publication" : "Choisissez ou retirez le média depuis la galerie"
      : done ? `Retirer le feu vert « ${checkedName} » et revenir à l’étape précédente` : canCheck ? `Donner le feu vert « ${checkedName} »` : "Terminez d’abord l’étape précédente";
  };
  configureGate(contentGate, contentDone, true, "content_approved", "content_review", "Texte", !(state.profile?.role === "director" && ["scheduled", "published"].includes(stage)));
  configureGate(mediaGate, mediaDone, false, "final_approved", "media_review", "Visuel", false);
  configureGate(publicationGate, publicationDone, publicationReady, "published", "final_approved", "Terminé", state.profile?.role === "admin");
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
    if (["final_approved","scheduled"].includes(stage)) buttons.push(["published","✓ Terminer — publié ou programmé","primary"]);
  }
  if (state.profile?.role === "director") {
    if (["content_review","proposal","changes_requested"].includes(stage)) buttons.push(["content_approved","✓ Approuver le texte et le concept","primary"]);
    if (stage === "content_review") buttons.push(["changes_requested","Correction demandée au texte","correction"]);
    if (stage === "media_review" && !structuredMediaAgreement) buttons.push(["","Choisir et approuver un média ci-dessus","disabled"]);
    if (stage === "media_review") buttons.push(["changes_requested","Correction demandée au visuel","correction"]);
  }
  const waiting = state.profile?.role === "director" && stage === "content_approved" ? "Le texte est approuvé. Les communications produisent maintenant le visuel." : state.profile?.role === "director" && mediaDone ? "Le visuel est approuvé. Les communications peuvent programmer ou publier." : publicationDone ? "Événement terminé; rien ne disparaît de la base de données." : `Étape actuelle : ${stage.replaceAll("_", " ")}`;
  actions.innerHTML = buttons.map(([value,label,kind]) => `<button type="button" class="${kind}" ${value ? `data-workflow-stage="${value}"` : "disabled"}>${label}</button>`).join("") || `<span class="cockpit-media-note">${esc(waiting)}</span>`;
}

function renderCommentThread(card, sectionId = card.dataset.itemId) {
  const host = card.querySelector("[data-comment-thread]");
  if (!host) return;
  const rows = (state.commentsByEvent.get(sectionId) || []).filter((row) => row.deleted !== true);
  const messageMarkup = (row, handled = false) => {
    const mine = row.authorUid === state.profile?.uid;
    const when = row.createdAt?.toDate ? row.createdAt.toDate().toLocaleString("fr-CA", { dateStyle:"short", timeStyle:"short" }) : "à l’instant";
    const edited = row.updatedAt?.toMillis && row.createdAt?.toMillis && row.updatedAt.toMillis() > row.createdAt.toMillis() + 1000;
    const handledLabel = handled && row.resolvedByLabel ? ` · traité par ${esc(row.resolvedByLabel)}` : "";
    const createdAt = row.createdAt?.toMillis ? row.createdAt.toMillis() : row.createdAt instanceof Date ? row.createdAt.valueOf() : 0;
    const updatedAt = row.updatedAt?.toMillis ? row.updatedAt.toMillis() : row.updatedAt instanceof Date ? row.updatedAt.valueOf() : createdAt;
    return `<article class="cockpit-message ${mine ? "mine" : "other"}${handled ? " handled" : ""}" data-comment-id="${esc(row.id)}" data-created-at="${Number.isFinite(createdAt) ? createdAt : 0}" data-updated-at="${Number.isFinite(updatedAt) ? updatedAt : 0}"><header><b>💬 ${esc(row.authorLabel || "Utilisateur")}${mine ? " · vous" : ""}</b><span>${esc(when)}${edited ? " · modifié" : ""}${handledLabel}</span></header><p>${esc(row.comment || "")}</p><div class="cockpit-message-actions">${handled ? "" : `<button type="button" data-resolve-comment="${esc(row.id)}">✓ Marquer traité</button>`}${mine && !handled ? `<button type="button" data-edit-comment="${esc(row.id)}">Modifier</button><button type="button" data-archive-comment="${esc(row.id)}">Archiver</button>` : ""}</div></article>`;
  };
  const active = rows.filter((row) => row.resolved !== true);
  const handled = rows.filter((row) => row.resolved === true);
  const handledBlock = handled.length ? `<details class="cockpit-thread-resolved"><summary>Voir les messages traités (${handled.length})</summary><div class="cockpit-thread-resolved-list">${handled.map((row) => messageMarkup(row, true)).join("")}</div></details>` : "";
  host.innerHTML = handledBlock + (active.length ? active.map((row) => messageMarkup(row)).join("") : `<p class="cockpit-thread-empty">Aucun commentaire actif. Écrivez une consigne ci-dessous pour démarrer le mini-chat.</p>`);
  host.scrollTop = host.scrollHeight;
}

function renderAllCollaboration() {
  document.querySelectorAll(".post[data-item-id]").forEach((card) => { renderWorkflow(card); renderCommentThread(card); renderEditorialDecision(card); });
  renderActionTasks(state.tasks);
}

function stopEventContext() {
  eventContextController?.stop();
  eventContextController = null;
  state.mediaContextLoading.clear();
}

function activateEventContext(eventId) {
  const id = String(eventId || "").trim();
  const contextEnabled = configured && !safeMode && Boolean(state.profile);
  if (!id || !contextEnabled) return;
  eventContextController ||= createEventContextController({
    enabled: contextEnabled,
    onRows: (kind,id,rows) => { if(kind==="media") state.mediaContextLoading.delete(id); (kind==="comments"?state.commentsByEvent:state.mediaByEvent).set(id,rows); const card=document.querySelector(`.post[data-item-id="${CSS.escape(id)}"]`); if(card){renderCommentThread(card);renderMediaForCard(card);renderWorkflow(card);} renderMonthlyEditorialSnapshot(); notifyViewUpdate(`event-${kind}`); },
    onError: (error) => { const currentId=eventContextController?.current?.() || ""; if(currentId){state.mediaContextLoading.delete(currentId); const card=document.querySelector(`.post[data-item-id="${CSS.escape(currentId)}"]`); if(card) renderMediaForCard(card);} console.warn("Contexte temps réel de l’événement indisponible", error); }
  });
  const previousId = eventContextController.current();
  if (previousId && previousId !== id && state.mediaContextLoading.delete(previousId)) {
    const previousCard = document.querySelector(`.post[data-item-id="${CSS.escape(previousId)}"]`);
    if (previousCard) renderMediaForCard(previousCard);
  }
  if (!state.mediaByEvent.has(id)) {
    state.mediaContextLoading.add(id);
    const card = document.querySelector(`.post[data-item-id="${CSS.escape(id)}"]`);
    if (card) renderMediaForCard(card);
  }
  eventContextController.activate(id);
}

function updateSinglePostLayouts() {
  const plan = Array.isArray(globalThis.posts) ? globalThis.posts : [];
  document.querySelectorAll(".day-group .posts").forEach((grid) => {
    const cards = [...grid.querySelectorAll(":scope > .post")];
    const item = cards.length === 1 ? getPlanItem(cards[0]) : null;
    const sameDay = item ? plan.filter((candidate) => candidate.w === item.w && candidate.date === item.date && candidate.archivedEditorial !== true) : [];
    const isConfirmedSingle = Boolean(item && sameDay.length === 1 && item.choiceRequired !== true && !item.optionGroup);
    grid.classList.toggle("single-post", isConfirmedSingle);
  });
}

function syncCalendarFilterOptions(plan = []) {
  const weekSelect = document.querySelector("#week");
  const themeSelect = document.querySelector("#theme");
  if (weekSelect) {
    const current = weekSelect.value || "all";
    const existing = new Set([...weekSelect.options].map((option) => option.value));
    [...new Set(plan.map((item) => Number(item.w)).filter((value) => Number.isInteger(value) && value > 0))]
      .sort((left, right) => left - right)
      .forEach((week) => {
        if (existing.has(String(week))) return;
        const option = document.createElement("option");
        option.value = String(week);
        option.textContent = `Semaine ${week}`;
        weekSelect.appendChild(option);
      });
    weekSelect.value = [...weekSelect.options].some((option) => option.value === current) ? current : "all";
  }
  if (themeSelect) {
    const current = themeSelect.value || "all";
    const existing = new Set([...themeSelect.options].map((option) => option.value));
    [...new Set(plan.map((item) => String(item.t || "").trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right, "fr"))
      .forEach((theme) => {
        if (existing.has(theme)) return;
        const option = document.createElement("option");
        option.value = theme;
        option.textContent = theme;
        themeSelect.appendChild(option);
      });
    themeSelect.value = [...themeSelect.options].some((option) => option.value === current) ? current : "all";
  }
}

function applyEditorialScheduleRows() {
  const rows = [...state.rows.entries()].map(([id, row]) => ({ id, ...row }));
  const signature = editorialRowsSignature(rows);
  if (signature === state.editorialSignature) return false;
  state.editorialSignature = signature;
  globalThis.posts = mergePostsWithScheduleRows(state.basePosts, rows);
  syncCalendarFilterOptions(globalThis.posts);
  if (typeof globalThis.render === "function") globalThis.render();
  enhanceCards();
  refreshPublicationStudio();
  notifyViewUpdate("publication-content");
  return true;
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
      ${editorialDecisionMarkup(planItem)}
      <div class="cockpit-decision-guide"><b>${state.profile?.role === "director" ? "Pour la direction : deux validations seulement" : "Lecture rapide de l’événement"}</b>${state.profile?.role === "director" ? "1. Approuver le texte. 2. Plus tard, approuver le visuel. Les boutons ci-dessous servent aux avis rapides; les deux vrais feux verts sont dans le bloc « Les 3 feux verts »." : "Les avis rapides alimentent le fil. Le bloc « Les 3 feux verts » indique exactement la prochaine action à accomplir."}</div>
      <div class="cockpit-status-row" aria-label="Statut de la publication">
        <p class="cockpit-control-label">Avis rapide sur la proposition</p>
        <button type="button" data-status="approved" aria-pressed="false">🟢 Approuvé</button>
        <button type="button" data-status="needs_work" aria-pressed="false">🟡 À retravailler</button>
        <button type="button" data-status="pending" aria-pressed="false">⚪ En attente</button>
        <button type="button" data-status="deleted" aria-label="Masquer virtuellement cette ligne" title="Masquer virtuellement cette ligne">✕</button>
        <p class="cockpit-control-help"><b>Approuvé</b> : l’idée est retenue. <b>À retravailler</b> : une correction est nécessaire. <b>En attente</b> : aucune décision pour le moment. Ces avis ne remplacent pas l’approbation officielle du texte et du visuel.</p>
      </div>
      <section class="cockpit-thread"><div class="cockpit-thread-heading"><h5>💬 Mini-chat de l’événement</h5><span>Le message le plus récent apparaît en bas.</span></div><div data-comment-thread aria-live="polite"></div></section>
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
      ${mediaControlsMarkup(planItem)}`;
    card.appendChild(controls);
  });
  updateSinglePostLayouts();
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

function voiceContainer(textarea) {
  return textarea?.closest("[data-voice-container], .cockpit-comment-row");
}

function setVoiceStatus(textarea, message, kind = "") {
  const status = voiceContainer(textarea)?.querySelector("[data-voice-status]");
  if (!status) return;
  status.textContent = message;
  status.className = "cockpit-voice-status" + (kind ? " " + kind : "");
}

function setVoiceButtonState(textarea, active) {
  const button = voiceContainer(textarea)?.querySelector("[data-dictate]");
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
  const row = voiceContainer(textarea);
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
    setVoiceButtonState(textarea, false);
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
  window.addEventListener("cockpit:event-context-request", (event) => {
    activateEventContext(event.detail?.eventId);
  });
  document.addEventListener("click", (event) => {
    const card = event.target.closest(".post[data-item-id]");
    if (!card) return;
    activateEventContext(card.dataset.itemId);
    const editorialButton = event.target.closest("button[data-editorial-decision]");
    if (editorialButton) {
      editorialButton.disabled = true;
      const decision = editorialButton.dataset.editorialDecision;
      setEditorialDecision(card.dataset.itemId, decision, state.profile)
        .then(async () => {
          const planItem = getPlanItem(card);
          if (state.profile.role === "director" && ["chosen", "deferred", "rejected"].includes(decision)) {
            const titles = { chosen:"Proposition retenue", deferred:"Proposition à reprogrammer", rejected:"Angle éditorial à écarter" };
            const messages = { chosen:"Poursuivre les validations du texte et du visuel.", deferred:"Déplacer cette bonne idée vers une date cohérente lors du prochain remaniement du calendrier.", rejected:"Conserver la décision dans l’historique et éviter de reproposer cet angle sans nouvelle discussion." };
            await recordActionTask(`editorial-${card.dataset.itemId}`, { status:"pending", title:`${titles[decision]} — ${planItem?.title || card.dataset.itemId}`, targetType:"schedule", targetId:card.dataset.itemId, targetLabel:`${planItem?.date || ""} · ${planItem?.title || ""}`, message:`${messages[decision]}\n\n${responsibilitySummary(planItem)}` });
          }
          toast(decision === "deferred" ? "Idée mise de côté pour un autre jour." : decision === "rejected" ? "Angle écarté et conservé dans l’historique." : decision === "chosen" ? "Proposition retenue pour cette journée." : "Décision éditoriale réinitialisée.");
        })
        .catch((error) => toast(error.message, true))
        .finally(() => { editorialButton.disabled = false; });
      return;
    }
    const workflowButton = event.target.closest("button[data-workflow-stage]");
    if (workflowButton) {
      setWorkflowStage(card.dataset.itemId, workflowButton.dataset.workflowStage, state.profile)
        .then(async () => {
          const planItem = getPlanItem(card);
          ripple(workflowButton);
          if (state.profile.role === "director" && ["content_approved","final_approved","changes_requested"].includes(workflowButton.dataset.workflowStage)) {
            await recordActionTask(`workflow-${card.dataset.itemId}`, { status: "pending", title: workflowButton.dataset.workflowStage === "final_approved" ? `Prêt à publier — ${planItem?.title}` : `Cycle de validation — ${planItem?.title}`, targetType:"schedule", targetId:card.dataset.itemId, targetLabel:`${planItem?.date || ""} · ${planItem?.title || ""}`, message:`Nouvelle étape : ${workflowButton.textContent.trim()}.\n\n${responsibilitySummary(planItem)}` });
          }
          toast(workflowButton.dataset.workflowDirection === "back" ? "Feu vert retiré; l’historique est conservé." : "Étape de validation enregistrée.");
        }).catch((error) => toast(error.message, true));
      return;
    }
    const resolveCommentButton = event.target.closest("button[data-resolve-comment]");
    if (resolveCommentButton) {
      resolveCommentButton.disabled = true;
      resolveComment(resolveCommentButton.dataset.resolveComment, state.profile)
        .then(async () => {
          try {
            await completeActionTask(`comment-${resolveCommentButton.dataset.resolveComment}`, state.profile);
          } catch (error) {
            if (!/n’existe plus/i.test(error.message || "")) console.warn("Tâche associée non classée", error);
          }
          toast("Commentaire marqué comme traité et conservé dans l’historique.");
        })
        .catch((error) => toast(error.message, true))
        .finally(() => { resolveCommentButton.disabled = false; });
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
      const dictatedField = dictateButton.closest("[data-voice-container]")?.querySelector("input, textarea") || card.querySelector("[data-comment]");
      startDictation(dictatedField);
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
    const mediaRightsInput = event.target.closest("input[data-media-rights-confirmation]");
    if (mediaRightsInput) {
      event.preventDefault();
      event.stopPropagation();
      const confirmed = mediaRightsInput.checked;
      mediaRightsInput.disabled = true;
      setMediaRightsConfirmation(mediaRightsInput.dataset.mediaRightsConfirmation, confirmed, state.profile)
        .then(() => toast(confirmed ? "Droits de diffusion confirmés; le média peut maintenant être choisi." : "Droits remis en attente; le média redevient une référence interne."))
        .catch((error) => {
          mediaRightsInput.checked = !confirmed;
          toast(error.message, true);
        })
        .finally(() => { mediaRightsInput.disabled = false; });
      return;
    }
    const mediaDecisionButton = event.target.closest("button[data-media-decision]");
    if (mediaDecisionButton) {
      event.preventDefault();
      event.stopPropagation();
      const mediaId = mediaDecisionButton.dataset.mediaDecision;
      const label = mediaDecisionButton.dataset.mediaLabel || "Média OneDrive";
      const selected = mediaDecisionButton.getAttribute("aria-pressed") !== "true";
      const planItem = getPlanItem(card);
      const allowsMultiple = planItem?.mediaSelectionMode === "multiple";
      mediaDecisionButton.disabled = true;
      setMediaDecision(card.dataset.itemId, mediaId, selected, state.profile, { multiple: allowsMultiple })
        .then(async (decision) => {
          ripple(mediaDecisionButton);
          if (state.profile.role === "director") {
            const actionItem = [...document.querySelectorAll("#cockpit-action-item-source [data-action-item-id]")]
              .find((item) => item.dataset.actionTarget === card.dataset.itemId && (!item.dataset.actionMedia || item.dataset.actionMedia === mediaId));
            const actionItemId = actionItem?.dataset.actionItemId || `media-direction-approval-${card.dataset.itemId}`;
            const requiredSelectionCount = allowsMultiple ? 2 : 1;
            const resolved = selected && (decision?.direction?.mediaIds?.length || 0) >= requiredSelectionCount;
            try {
              await setPersonalActionItemState(actionItemId, resolved ? "done" : "pending", state.profile);
            } catch (error) {
              console.warn("La décision média est conservée, mais la file personnelle sera réconciliée au prochain cycle.", error);
            }
            await recordActionTask(`media-choice-${card.dataset.itemId}`, {
              status: selected ? "pending" : "done",
              title: `${selected ? "Choix média de la direction" : "Choix média retiré"} — ${planItem?.title || card.dataset.itemId}`,
              targetType: "schedule",
              targetId: card.dataset.itemId,
              targetLabel: `${planItem?.date || ""} · ${label}`,
              message: selected ? `La direction a choisi « ${label} ». Vérifier l’accord des deux rôles puis programmer ou publier seulement après les feux verts.` : `La direction a retiré son choix de « ${label} »; l’historique demeure conservé.`
            });
          }
          const selectedCount = decision?.[state.profile.role === "director" ? "direction" : "communications"]?.mediaIds?.length || 0;
          toast(selected
            ? allowsMultiple ? `Carte ajoutée au carrousel (${selectedCount}/${Math.max(2, Number(planItem?.mediaSelectionRequired) || 2)}).` : state.profile.role === "admin" ? "Visuel recommandé par les communications." : "Choix de la direction enregistré."
            : "Votre choix a été retiré; l’historique est conservé.");
        })
        .catch((error) => toast(error.message, true))
        .finally(() => { mediaDecisionButton.disabled = false; });
      return;
    }
    const mediaOverrideButton = event.target.closest("button[data-media-override]");
    if (mediaOverrideButton) {
      event.preventDefault();
      event.stopPropagation();
      const mediaId = mediaOverrideButton.dataset.mediaOverride;
      const label = mediaOverrideButton.dataset.mediaLabel || "Média OneDrive";
      const planItem = getPlanItem(card);
      const allowsMultiple = planItem?.mediaSelectionMode === "multiple";
      const textApproved = workflowTextApprovedStages.has(state.workflows.get(card.dataset.itemId)?.stage || "proposal");
      const promptLabel = state.profile?.role === "director"
        ? "Pourquoi retenir ce visuel comme décision finale?"
        : textApproved ? "Quel motif autorise cette validation finale par les communications?" : "Pourquoi les communications valident-elles maintenant le texte et ce visuel?";
      const reason = prompt(promptLabel, "");
      if (reason === null) return;
      if (!reason.trim()) { toast("Ajoutez un motif clair afin de préserver la trace de décision.", true); return; }
      mediaOverrideButton.disabled = true;
      setMediaDecision(card.dataset.itemId, mediaId, true, state.profile, { override: true, reason, multiple: allowsMultiple })
        .then(async (decision) => {
          ripple(mediaOverrideButton);
          if (state.profile.role === "director" && ["agreed", "overridden"].includes(decision?.agreement?.status)) {
            const actionItem = [...document.querySelectorAll("#cockpit-action-item-source [data-action-item-id]")]
              .find((item) => item.dataset.actionTarget === card.dataset.itemId && (!item.dataset.actionMedia || item.dataset.actionMedia === mediaId));
            const actionItemId = actionItem?.dataset.actionItemId || `media-direction-approval-${card.dataset.itemId}`;
            try { await setPersonalActionItemState(actionItemId, "done", state.profile); }
            catch (error) { console.warn("La décision finale est conservée; la file sera réconciliée au prochain cycle.", error); }
          }
          toast(state.profile.role === "director" ? "Décision finale de la direction enregistrée." : "Validation des communications enregistrée avec son motif, sans usurper l’identité de la direction.");
        })
        .catch((error) => toast(error.message, true))
        .finally(() => { mediaOverrideButton.disabled = false; });
      return;
    }
    const mediaCommentButton = event.target.closest("button[data-save-media-comment]");
    if (mediaCommentButton) {
      event.preventDefault();
      event.stopPropagation();
      const mediaId = mediaCommentButton.dataset.saveMediaComment;
      const mediaCard = mediaCommentButton.closest(".cockpit-media-card");
      const input = mediaCard?.querySelector("input[data-media-comment]");
      if (!input || input.dataset.mediaComment !== mediaId) {
        toast("Le champ de commentaire de ce média est introuvable. Rechargez le cockpit puis réessayez.", true);
        return;
      }
      const note = input.value.trim();
      if (!note) { toast("Écrivez d’abord votre commentaire sur ce média.", true); return; }
      const label = mediaCommentButton.dataset.mediaLabel || "Média OneDrive";
      mediaCommentButton.disabled = true;
      (async () => {
        try {
          const commentId = await addComment(card.dataset.itemId, `🎨 Média « ${label} » : ${note}`, state.profile, null, input.dataset.dictated === "true");
          input.value = "";
          delete input.dataset.dictated;
          toast("Commentaire sur le média enregistré.");
          const planItem = getPlanItem(card);
          try {
            await recordActionTask(`media-comment-${commentId}`, { status:"pending", title:`Commentaire média — ${planItem?.title || card.dataset.itemId}`, targetType:"schedule", targetId:card.dataset.itemId, targetLabel:`${planItem?.date || ""} · ${label}`, message:note });
          } catch (taskError) {
            console.warn("Le commentaire média est enregistré; la tâche de suivi sera réconciliée au prochain cycle.", taskError);
          }
        } catch (error) {
          toast(error.message, true);
        } finally {
          mediaCommentButton.disabled = false;
        }
      })();
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
  state.basePosts = typeof structuredClone === "function"
    ? structuredClone(Array.isArray(globalThis.posts) ? globalThis.posts : [])
    : JSON.parse(JSON.stringify(Array.isArray(globalThis.posts) ? globalThis.posts : []));
  state.editorialSignature = "[]";
  sortInternalProjectsByUrgency();
  decorateInternalProjectDocuments();
  setupCollapsibleNavigation();
  setupGuidePreference();
  setupProjectPreference();
  setupInternalProjectPreference();
  setupDateElevator();
  setupMonthlyEditorialSnapshot();
  state.contentLoaded = true;
  dispatchEvent(new CustomEvent("cockpit:content-ready"));
}

function clearPrivateContent() {
  document.querySelector("#cockpit-content")?.replaceChildren();
  document.querySelector("#cockpit-private-style")?.remove();
  document.querySelector("#cockpit-date-elevator")?.remove();
  state.contentLoaded = false;
  state.basePosts = [];
  state.editorialSignature = "[]";
  globalThis.posts = [];
}

async function applyProfile(profile) {
  state.profile = profile;
  document.body.dataset.workflowSync = "pending";
  await waitForClientReady();
  const loginNote = document.querySelector("#cockpit-login-note");
  if (loginNote) loginNote.textContent = "Identifiants vérifiés. Chargement du cockpit…";
  state.mediaConfig = await fetchMediaConfig().catch((error) => {
    console.warn("Configuration OneDrive indisponible", error);
    return { folderUrl: "", folderViewUrl: "" };
  });
  await loadPrivateContent();
  document.body.classList.remove("cockpit-locked");
  document.body.classList.remove("cockpit-readonly");
  document.body.classList.toggle("cockpit-safe-mode", safeMode);
  if (safeMode) document.body.classList.add("cockpit-readonly");
  document.querySelector("#cockpit-login")?.setAttribute("hidden", "");
  const retry = document.querySelector("#cockpit-retry-content");
  if (retry) { retry.hidden = true; retry.onclick = null; }
  const session = buildSession();
  // La vue des décisions peut se recalculer après le chargement initial
  // (listener Firestore, retour de cache, redimensionnement). Conserver
  // l'identité sur la coque évite alors de perdre le ciblage personnel.
  session.dataset.uid = profile.uid || "";
  session.dataset.role = profile.role || "";
  session.querySelector("#cockpit-session-label").innerHTML = "Connecté : <strong>" + esc(profile.displayLabel) + "</strong> · rôle " + esc(profile.role) + (safeMode ? " · mode secours" : "");
  dispatchEvent(new CustomEvent("cockpit:session-ready", { detail: { profile } }));
  setupResponsiveOffsets();
  setupPersonalActionItems(profile, configured);
  destroyPublicationStudio();
  if (profile.role === "admin") {
    document.body.classList.add("cockpit-admin");
    buildAdminSidebar();
    buildTaskWidget();
    buildHealthWidget(profile);
    if (!safeMode) initPublicationStudio({ profile, getPosts: () => globalThis.posts || [], getRows: () => state.rows });
    enhanceTaskEvents();
    clearAdminLazyData();
    state.tasksUnsubscribe?.();
    if (configured) {
      if (!safeMode) state.tasksUnsubscribe = subscribeActionTasks(renderActionTasks, (error) => toast("La liste des tâches n’est pas accessible : " + error.message, true));
    }
  } else {
    document.body.classList.remove("cockpit-admin");
    clearAdminLazyData();
    state.tasksUnsubscribe?.();
    state.tasksUnsubscribe = null;
    document.querySelector("#cockpit-task-launch")?.remove();
  }
  addFooterCredit();
  enhanceCards();
  enhanceSectionFeedback();
  setupFeedbackDictationEvents();
  enhanceCalendarButtons();
  buildFeedbackWidget();
  setupOpportunityEvents();
  setupInternalProjectEvents();
  renderOpportunityStates();
  renderInternalProjectStates();
  setupProjectCalendar({
    profile,
    mediaFolderUrl: state.mediaConfig?.folderViewUrl || state.mediaConfig?.folderUrl || "",
    safeMode,
    onDictate: startDictation,
    toast
  });
  syncCardAccess();
}

function applySignedOut(message = "") {
  if (activeRecognition) stopDictation("Session fermée.");
  stopEventContext();
  state.profile = null;
  state.user = null;
  state.rows = new Map();
  state.mediaByEvent = new Map();
  state.mediaContextLoading = new Set();
  state.mediaDecisions = new Map();
  state.commentsByEvent = new Map();
  state.workflows = new Map();
  state.opportunities = new Map();
  state.internalProjects = new Map();
  state.decisions = new Map();
  state.mediaConfig = null;
  state.scheduleUnsubscribe?.();
  clearAdminLazyData();
  state.tasksUnsubscribe?.();
  clearPersonalActionItems();
  state.mediaUnsubscribe?.();
  state.mediaDecisionUnsubscribe?.();
  state.commentsUnsubscribe?.();
  state.workflowUnsubscribe?.();
  state.opportunityUnsubscribe?.();
  state.internalProjectUnsubscribe?.();
  state.decisionUnsubscribe?.();
  state.scheduleUnsubscribe = null;
  state.tasksUnsubscribe = null;
  state.mediaUnsubscribe = null;
  state.mediaDecisionUnsubscribe = null;
  state.commentsUnsubscribe = null;
  state.workflowUnsubscribe = null;
  state.opportunityUnsubscribe = null;
  state.internalProjectUnsubscribe = null;
  state.decisionUnsubscribe = null;
  state.tasks = [];
  clearCompletedTaskHistory();
  clearProjectCalendar();
  clearPrivateContent();
  dispatchEvent(new CustomEvent("cockpit:session-ended"));
  document.body.classList.add("cockpit-locked");
  document.querySelector("#cockpit-session")?.remove();
  document.querySelector("#cockpit-sidebar")?.remove();
  document.querySelector("#cockpit-sidebar-toggle")?.remove();
  document.querySelector("#cockpit-task-launch")?.remove();
  document.querySelector("#cockpit-feedback-launch")?.remove();
  document.querySelector("#cockpit-feedback-panel")?.remove();
  clearHealthWidget();
  destroyPublicationStudio();
  document.body.classList.remove("cockpit-admin");
  document.body.classList.remove("cockpit-safe-mode");
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
  const retry = login.querySelector("#cockpit-retry-content");
  if (retry) { retry.hidden = true; retry.onclick = null; }
}

function syncWorkflow(rows, meta) {
  state.workflows = new Map(rows.map((row) => [row.eventId || row.id, row]));
  document.body.dataset.workflowSync = meta.fromCache ? "cache" : "server";
  renderAllCollaboration();
  renderMonthlyEditorialSnapshot();
  notifyViewUpdate(meta.fromCache ? "workflow-cache" : "workflow-server");
}

function subscribeRemoteData() {
  if (!configured || !state.profile) return;
  state.scheduleUnsubscribe?.();
  state.scheduleUnsubscribe = subscribeScheduleItems((rows) => {
    state.rows = new Map(rows.map((row) => [row.id, row]));
    if (!applyEditorialScheduleRows()) applyRemoteRows();
    refreshPublicationStudio();
    renderMonthlyEditorialSnapshot();
    notifyViewUpdate("schedule");
  }, (error) => toast("Le calendrier n’est pas accessible : " + error.message, true));
  if (safeMode) {
    state.mediaDecisionUnsubscribe?.();
    state.mediaDecisionUnsubscribe = subscribeMediaDecisions((rows) => {
      state.mediaDecisions = new Map(rows.map((row) => [row.eventId || row.id, row]));
      renderAllMedia();
      renderAllCollaboration();
      renderMonthlyEditorialSnapshot();
      notifyViewUpdate("media-decisions-cache");
    }, (error) => console.warn("Décisions média absentes du cache", error));
    state.workflowUnsubscribe?.();
    state.workflowUnsubscribe = subscribeWorkflowStates(syncWorkflow, (error) => console.warn("Workflows absents du cache", error));
    state.decisionUnsubscribe?.();
    state.decisionUnsubscribe = subscribeEditorialDecisions((rows) => {
      state.decisions = new Map(rows.map((row) => [row.eventId || row.id, row]));
      document.querySelectorAll(".post[data-item-id]").forEach(renderEditorialDecision);
      renderMonthlyEditorialSnapshot();
      notifyViewUpdate("decisions-cache");
    }, (error) => console.warn("Décisions éditoriales absentes du cache", error));
    return;
  }
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
    notifyViewUpdate("media");
  }, (error) => toast("Les liens médias ne sont pas accessibles : " + error.message, true));
  state.mediaDecisionUnsubscribe?.();
  state.mediaDecisionUnsubscribe = subscribeMediaDecisions((rows) => {
    state.mediaDecisions = new Map(rows.map((row) => [row.eventId || row.id, row]));
    renderAllMedia();
    renderAllCollaboration();
    renderMonthlyEditorialSnapshot();
    notifyViewUpdate("media-decisions");
  }, (error) => toast("Les décisions média ne sont pas accessibles : " + error.message, true));
  state.commentsUnsubscribe?.();
  state.commentsUnsubscribe = subscribeComments((rows) => {
    const grouped = new Map();
    rows.forEach((row) => { const id=String(row.sectionId||""); if(!grouped.has(id)) grouped.set(id,[]); grouped.get(id).push(row); });
    state.commentsByEvent = grouped; renderAllCollaboration(); renderOpportunityNotes(); renderInternalProjectNotes(); renderAllMedia(); renderMonthlyEditorialSnapshot(); notifyViewUpdate("comments");
  }, (error) => toast("Le fil de commentaires n’est pas accessible : " + error.message, true));
  state.workflowUnsubscribe?.();
  state.workflowUnsubscribe = subscribeWorkflowStates(syncWorkflow, (error) => toast("Le cycle de validation n’est pas accessible : " + error.message, true));
  state.opportunityUnsubscribe?.();
  state.opportunityUnsubscribe = subscribeOpportunityStates((rows) => {
    state.opportunities = new Map(rows.map((row) => [row.opportunityId || row.id, row]));
    renderOpportunityStates();
    notifyViewUpdate("opportunities");
  }, (error) => toast("Le suivi des occasions n’est pas accessible : " + error.message, true));
  state.internalProjectUnsubscribe?.();
  state.internalProjectUnsubscribe = subscribeInternalProjectStates((rows) => {
    state.internalProjects = new Map(rows.map((row) => [row.projectId || row.id, row]));
    renderInternalProjectStates();
    notifyViewUpdate("internal-projects");
  }, (error) => toast("Le suivi des projets internes n’est pas accessible : " + error.message, true));
  state.decisionUnsubscribe?.();
  state.decisionUnsubscribe = subscribeEditorialDecisions((rows) => {
    state.decisions = new Map(rows.map((row) => [row.eventId || row.id, row]));
    document.querySelectorAll(".post[data-item-id]").forEach(renderEditorialDecision);
    renderMonthlyEditorialSnapshot();
    notifyViewUpdate("decisions");
  }, (error) => toast("Les décisions éditoriales ne sont pas accessibles : " + error.message, true));
}

function start() {
  document.body.classList.add("cockpit-locked");
  buildLogin();
  setupControlHints(document);
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
      setupDateElevator();
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
      if (user) {
        state.user = user;
        showAuthenticatedLoadError(error.message || "Le profil sécurisé est temporairement indisponible.");
      } else {
        applySignedOut(error.message || "Le service de connexion est temporairement indisponible.");
      }
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
        showAuthenticatedLoadError(reason.message || "Le contenu sécurisé est indisponible.", async () => {
          await applyProfile(profile);
          subscribeRemoteData();
        });
      });
  });
}

start();
