const STORAGE_KEY = "bleu-massawippi-theme";
const root = document.documentElement;
const media = matchMedia("(prefers-color-scheme: dark)");

function savedTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

function setTheme(theme, persist = false) {
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  if (persist) {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* stockage facultatif */ }
  }
  const button = document.querySelector("[data-theme-toggle]");
  if (!button) return;
  const dark = theme === "dark";
  button.setAttribute("aria-pressed", String(dark));
  button.setAttribute("aria-label", dark ? "Passer au mode clair" : "Passer au mode sombre");
  button.title = dark ? "Passer au mode clair" : "Passer au mode sombre";
  button.textContent = dark ? "☀ Mode clair" : "☾ Mode sombre";
}

const style = document.createElement("style");
style.id = "cockpit-theme-style";
style.textContent = `
  .cockpit-theme-toggle { position:fixed; top:98px; right:12px; z-index:2400; border:1px solid rgba(7,58,82,.25); border-radius:999px; padding:8px 12px; background:#fff; color:#073a52; box-shadow:0 5px 18px rgba(0,0,0,.15); font:700 .78rem/1 system-ui,sans-serif; cursor:pointer; }
  .cockpit-theme-toggle.in-session { position:static; display:grid; width:40px; min-width:40px; height:40px; padding:0; place-items:center; box-shadow:none; font-size:0; }
  .cockpit-theme-toggle.in-session:before { content:"☾"; font-size:1rem; }
  .cockpit-theme-toggle.in-session[aria-pressed="true"]:before { content:"☀"; }
  [data-theme="dark"] body {
    --ink:#eef7f8; --navy:#dff6fa; --blue:#72d9ed; --aqua:#61d9d2; --mist:#10252e;
    --paper:#12262f; --soft:#bfd1d7; --line:#496873; --gold:#f2c66d; --coral:#ff9b89;
    color:#eef7f8 !important;
    background:radial-gradient(circle at 10% 0,rgba(42,182,187,.13),transparent 28rem),linear-gradient(#09171d 0,#10232b 31rem) !important;
  }
  [data-theme="dark"] .cockpit-theme-toggle { color:#f1fbfc; background:#1c3a46; border-color:#6a8994; }
  [data-theme="dark"] :is(.lead,.heading p,.panel p,.panel li,.principle span,.ev span,.week-title span,.post-head p,.tier,.box span,.check,.table td,.channel span,.metric p,.source p,.readme-body>p:not(.readme-kicker),.readme-step span,.readme-note,.responsibility ul,[data-calendar-feedback],[data-post-calendar-feedback],#cockpit-credit,.cockpit-media-note) { color:#bfd1d7 !important; }
  [data-theme="dark"] :is(h1,h2,h3,h4,.mast strong,.stat b,.panel h3,.principle b,.ev strong,.week-title h3,.post h4,.ready,.box b,.table td:first-child,.channel b,.source h3,footer strong,.readme-body h2,.workflow-label,.responsibility b,.cockpit-feedback-item b,.cockpit-task-item b,#cockpit-sidebar h2,#cockpit-feedback-panel h2) { color:#e9f8fa !important; }
  [data-theme="dark"] a { color:#8ce5f3; }
  [data-theme="dark"] .button.primary, [data-theme="dark"] .toolbar button { color:#07151b !important; background:#75d9e6 !important; border-color:#75d9e6 !important; }
  [data-theme="dark"] :is(.stats,.panel,.post,.gate,.toolbar,.table,.metric,.source,.context-fold,.readme-fold,.readme-step,.workflow-svg,.day-group,.section-feedback,.cockpit-controls,.cockpit-media,.cockpit-media-card,.cockpit-workflow,.cockpit-message,.cockpit-login-card,#cockpit-sidebar,#cockpit-feedback-panel,#cockpit-task-panel,.feedback-form,.task-owner,.collab-mode,.readme-card) { color:#eef7f8 !important; background:#152c36 !important; border-color:#587984 !important; box-shadow:none; }
  [data-theme="dark"] .cockpit-login-card :is(h2,p,label,.eyebrow) { color:#eef7f8 !important; }
  [data-theme="dark"] .cockpit-login-card input { color:#f4fbfc !important; background:#0f2630 !important; border-color:#6f939e !important; }
  [data-theme="dark"] .cockpit-login-card input::placeholder { color:#b9cdd2 !important; }
  [data-theme="dark"] .cockpit-login-reset { color:#84e3ee !important; background:transparent !important; }
  [data-theme="dark"] .cockpit-login-error { color:#ffb9ae !important; }
  [data-theme="dark"] :is(.principle,.ev,.flow div,.box,.channel,.responsibility,.readme-note,.status,.day-heading,.cockpit-login-note,.cockpit-task-item,.cockpit-media-preview) { color:#e7f5f7 !important; background:#1c3944 !important; border-color:#52727d !important; }
  [data-theme="dark"] .principle:nth-child(n), [data-theme="dark"] .responsibility.annie, [data-theme="dark"] .responsibility.valentin { background:#1c3944 !important; border-color:#52727d !important; }
  [data-theme="dark"] .note { color:#ffd9cf !important; background:#402c2a !important; }
  [data-theme="dark"] .nav { border-color:#496873 !important; background:rgba(11,29,36,.94) !important; }
  [data-theme="dark"] .nav a { color:#c3d8de !important; }
  [data-theme="dark"] .tag, [data-theme="dark"] .option-label { color:#f2f8fa !important; background:color-mix(in srgb,var(--accent,#61d9d2) 32%,#132a34) !important; }
  [data-theme="dark"] :is(input,textarea,select,.search,.toolbar select,.toolbar input) { color:#f4fbfc !important; background:#0b1c23 !important; border-color:#607e88 !important; caret-color:#fff; }
  [data-theme="dark"] :is(input,textarea)::placeholder { color:#9db6bf !important; opacity:1; }
  [data-theme="dark"] :is(.cockpit-status-row button,.cockpit-quick-row button,.cockpit-comment-row button,.cockpit-feedback-item button,.cockpit-task-actions button,.copy button) { color:#eaf7f9 !important; background:#203e49 !important; border-color:#607e88 !important; }
  [data-theme="dark"] .cockpit-comment-row button.save, [data-theme="dark"] .cockpit-media-form button { color:#06151b !important; background:#72d9e9 !important; }
  [data-theme="dark"] .cockpit-choice-row { color:#dff7f8 !important; background:#1b3b46 !important; border-color:#5d8490 !important; }
  [data-theme="dark"] .copy { color:#d8eaee !important; background:#10262f !important; border-color:#496873 !important; }
  [data-theme="dark"] :is(table,td,th,details,.week-title,.post-calendar-actions,.cockpit-media-form) { border-color:#496873 !important; }
  [data-theme="dark"] .table th { color:#e9f8fa !important; background:#1b3944 !important; }
  [data-theme="dark"] .cockpit-media-stage { color:#07202a !important; background:#79d9df !important; }
  [data-theme="dark"] .cockpit-media-folder { color:#bdeff5 !important; border-color:#6bc9d8 !important; }
  [data-theme="dark"] :is(.context-fold>summary,.readme-fold>summary,.cockpit-media>summary,.section-feedback>summary) { color:#f3fbfc !important; background:#203e49 !important; border-color:#6d909a !important; }
  [data-theme="dark"] :is(.context-fold>summary small,.readme-fold>summary small) { color:#fff !important; }
  [data-theme="dark"] :is(.context-fold>summary span,.readme-fold>summary span) { color:#fff !important; background:#126f87 !important; }
  [data-theme="dark"] .guide-startup-control { color:#f1fafb !important; background:#254854 !important; border-color:#7395a0 !important; }
  [data-theme="dark"] .guide-new-badge { color:#382600 !important; background:#ffd96a !important; border-color:#ffd96a !important; }
  [data-theme="dark"] :is(.readme-kicker,.eyebrow,.workflow-label) { color:#82e2ef !important; }
  [data-theme="dark"] .readme-step span { color:#d7e7ea !important; }
  [data-theme="dark"] .readme-step b { color:#f4fbfc !important; }
  [data-theme="dark"] .cockpit-media-count { color:#07181e !important; background:#82e2ef !important; }
  [data-theme="dark"] .cockpit-media-folder { color:#07181e !important; background:#82e2ef !important; border-color:#82e2ef !important; }
  [data-theme="dark"] :is(.cockpit-media-meta b,.cockpit-media-meta p,.cockpit-media-empty) { color:#d9eaed !important; }
  [data-theme="dark"] .cockpit-media-info { color:#e5f2f4 !important; background:#17313b !important; border-color:#496873 !important; }
  [data-theme="dark"] .cockpit-media-info > summary { color:#eef9fa !important; background:#1c3944 !important; }
  [data-theme="dark"] .cockpit-media-info[open] > summary { background:#244853 !important; }
  [data-theme="dark"] .cockpit-media-info-body { border-color:#496873 !important; }
  [data-theme="dark"] .cockpit-media-info-status { color:#d9eaed !important; background:#31515b !important; }
  [data-theme="dark"] .cockpit-media-info-status.is-final { color:#dffff3 !important; background:#27614f !important; }
  [data-theme="dark"] .cockpit-media-source-link { color:#8be4ef !important; }
  [data-theme="dark"] .cockpit-media-enlarge { color:#fff !important; background:rgba(0,20,28,.9) !important; border-color:#8ab0ba !important; }
  [data-theme="dark"] .cockpit-media-nav button { color:#dff7fa !important; background:#234752 !important; border-color:#77a6b0 !important; }
  [data-theme="dark"] :is(.cockpit-media-position,.cockpit-media-swipe-hint) { color:#c9dfe3 !important; }
  [data-theme="dark"] :is(.cockpit-workflow h5,.cockpit-thread h5,.cockpit-message header b,.cockpit-message p) { color:#edf9fa !important; }
  [data-theme="dark"] .cockpit-workflow-gate { color:#d4e6ea !important; background:#203c47 !important; border-color:#62828c !important; }
  [data-theme="dark"] .cockpit-workflow-gate.done { color:#dffff3 !important; background:#1e5144 !important; border-color:#76c8aa !important; }
  [data-theme="dark"] :is(.cockpit-decision-guide,.cockpit-workflow-intro,.cockpit-control-help) { color:#d2e5e9 !important; }
  [data-theme="dark"] .cockpit-decision-guide { background:#1c3944 !important; border-color:#648994 !important; }
  [data-theme="dark"] :is(.cockpit-decision-guide b,.cockpit-control-label,.cockpit-workflow-gate b) { color:#f2fafb !important; }
  [data-theme="dark"] .cockpit-workflow-gate.current { color:#ffe7b5 !important; background:#493b24 !important; border-color:#e2b553 !important; }
  [data-theme="dark"] .cockpit-media-card.is-final { border-color:#79d6b6 !important; }
  [data-theme="dark"] .cockpit-media-final-action { color:#071b15 !important; background:#79d6b6 !important; border-color:#79d6b6 !important; }
  [data-theme="dark"] .cockpit-media-rights-warning { color:#ffe4a3 !important; background:#4a3515 !important; border-color:#d9a441 !important; }
  [data-theme="dark"] :is(.project-hub,.project-card) { color:#eef7f8 !important; background:#152c36 !important; border-color:#796e50 !important; }
  [data-theme="dark"] .project-hub>summary { color:#fff1c9 !important; background:#473a21 !important; border-color:#9b7c3c !important; }
  [data-theme="dark"] .project-decision { color:#dff7ed !important; background:#1e463b !important; border-color:#6ab594 !important; }
  [data-theme="dark"] .project-decision strong { color:#f1fff8 !important; }
  [data-theme="dark"] :is(.project-card h3,.project-card strong,.project-timeline b) { color:#fff2d0 !important; }
  [data-theme="dark"] :is(.project-card p,.project-card li,.project-timeline div) { color:#d1e2e6 !important; }
  [data-theme="dark"] :is(.project-dossier,.project-doc,.opportunity) { color:#e9f3f4 !important; background:#152c36 !important; border-color:#70684f !important; }
  [data-theme="dark"] .opportunity>summary { color:#eef7f8 !important; background:#203c47 !important; border-color:#5f7d82 !important; }
  [data-theme="dark"] :is(.opportunity-body,.opportunity-detail-grid section,.opportunity-stage-controls) { color:#e9f3f4 !important; background:#18323c !important; border-color:#5f7d82 !important; }
  [data-theme="dark"] :is(.opportunity-verdict,.opportunity-next) { color:#e4f5ed !important; background:#21443a !important; border-color:#79c3a2 !important; }
  [data-theme="dark"] :is(.opportunity-detail-grid h5,.opportunity-stage-controls>b,.opportunity>summary strong) { color:#fff2d0 !important; }
  [data-theme="dark"] :is(.opportunity-stage-buttons button,.opportunity-heading button) { color:#eaf7f1 !important; background:#25454a !important; border-color:#6e9890 !important; }
  [data-theme="dark"] .opportunity-stage-buttons button.active { color:#071b15 !important; background:#79d6b6 !important; border-color:#79d6b6 !important; }
  [data-theme="dark"] :is(.opportunity-heading p,.opportunity-stage-meta,.opportunity>summary small) { color:#c8dadd !important; }
  [data-theme="dark"] .eligibility.high { color:#dff9ec !important; background:#255643 !important; }
  [data-theme="dark"] .eligibility.medium { color:#ffecc0 !important; background:#5a4721 !important; }
  [data-theme="dark"] .eligibility.low { color:#ffdcd7 !important; background:#5a3330 !important; }
  [data-theme="dark"] .project-new-badge { color:#382600 !important; background:#ffd96a !important; }
  [data-theme="dark"] .project-dossier>summary { color:#fff1c9 !important; background:#473a21 !important; }
  [data-theme="dark"] :is(.project-doc b,.opportunity h4,.opportunity-title) { color:#fff2d0 !important; }
  [data-theme="dark"] :is(.project-doc,.opportunity p,.project-dossier-body p) { color:#d1e2e6 !important; }
  [data-theme="dark"] .project-alert { color:#ffd9d5 !important; background:#4a2929 !important; border-color:#dc7871 !important; }
  [data-theme="dark"] .opportunity a { color:#83e1c5 !important; }
  [data-theme="dark"] .project-timeline div { background:#203c47 !important; }
  [data-theme="dark"] .project-links a { color:#fff1c9 !important; background:#263f48 !important; border-color:#b08b43 !important; }
  [data-theme="dark"] :is(.internal-project-hub,.internal-project,.internal-project-intro,.internal-project-grid section,.internal-project-role,.internal-project-docs) { color:#eef8f7 !important; background:#152f35 !important; border-color:#5d8581 !important; }
  [data-theme="dark"] .internal-project-hub>summary { color:#e8fffb !important; background:#214945 !important; border-color:#68a9a1 !important; }
  [data-theme="dark"] .internal-project>summary { color:#eef8f7 !important; background:#1c3b40 !important; border-color:#5d8581 !important; }
  [data-theme="dark"] .internal-project[open]>summary { background:#244a4d !important; }
  [data-theme="dark"] :is(.internal-project>summary strong,.internal-project-grid h5,.internal-project-role h5,.internal-project-docs>summary,.internal-project-milestones b,.internal-project-stage-controls>b,.internal-project-intro strong) { color:#effffc !important; }
  [data-theme="dark"] :is(.internal-project-body p,.internal-project-body li,.internal-project>summary small,.internal-project-stage-meta,.internal-project-intro span) { color:#d1e7e4 !important; }
  [data-theme="dark"] :is(.internal-project-next,.internal-project-stage-controls,.internal-project-milestones div) { color:#dff5f1 !important; background:#1e4542 !important; border-color:#69a79f !important; }
  [data-theme="dark"] .internal-project.urgent .internal-project-next { color:#ffe2dd !important; background:#4a2d2b !important; border-color:#dc7871 !important; }
  [data-theme="dark"] .internal-project-stage-buttons button { color:#e8f8f5 !important; background:#25494a !important; border-color:#71a8a2 !important; }
  [data-theme="dark"] .internal-project-stage-buttons button.active { color:#071b18 !important; background:#79d6c8 !important; border-color:#79d6c8 !important; }
  [data-theme="dark"] .internal-project-docs a { color:#8ce5d8 !important; }
  [data-theme="dark"] .internal-project-confidential { color:#ffe1dc !important; background:#4a2d2b !important; }
  [data-theme="dark"] .internal-project-new-badge { color:#09211d !important; background:#79d6c8 !important; }
  [data-theme="dark"] .cockpit-workflow-actions button { color:#dff7fa !important; background:#18343f !important; border-color:#72d9e9 !important; }
  [data-theme="dark"] .cockpit-workflow-actions button.primary { color:#06151b !important; background:#72d9e9 !important; }
  [data-theme="dark"] .cockpit-message header, [data-theme="dark"] .cockpit-thread-empty { color:#bcd0d6 !important; }
  [data-theme="dark"] .cockpit-thread { color:#eef7f8 !important; background:#152f38 !important; border-color:#69a9b0 !important; }
  [data-theme="dark"] .cockpit-comment-row { color:#eef7f8 !important; background:#18343f !important; border-color:#69a9b0 !important; }
  [data-theme="dark"] .cockpit-message.mine { background:#1d4b50 !important; border-color:#75cbd0 !important; }
  [data-theme="dark"] .cockpit-message.other { background:#4a3c23 !important; border-color:#d5ad5d !important; }
  [data-theme="dark"] .cockpit-thread-resolved { background:#20373f !important; border-color:#58747d !important; }
  [data-theme="dark"] .cockpit-thread-resolved>summary { color:#d5e5e8 !important; }
  [data-theme="dark"] .cockpit-task-item.comment-task { color:#fff4e7 !important; background:#4a3027 !important; border-color:#e19a73 !important; }
  [data-theme="dark"] .cockpit-task-source { color:#fff !important; background:#bd654b !important; }
  [data-theme="dark"] .coordination-alert { color:#ffe9c3 !important; background:#4b3820 !important; border-color:#d9a15b !important; }
  [data-theme="dark"] .coordination-alert b { color:#fff4de !important; }
  [data-theme="dark"] .cockpit-editorial-decision { color:#e9f6f7 !important; background:#1b3741 !important; border-color:#668790 !important; }
  [data-theme="dark"] :is(.cockpit-editorial-decision b,.cockpit-editorial-help,.cockpit-editorial-meta) { color:#e8f6f8 !important; }
  [data-theme="dark"] .cockpit-editorial-buttons button { color:#e8f6f8 !important; background:#24434e !important; border-color:#7498a1 !important; }
  [data-theme="dark"] .cockpit-monthly-snapshot { color:#eef8fa !important; background:#152f38 !important; border-color:#5c7d87 !important; box-shadow:none; }
  [data-theme="dark"] .cockpit-monthly-snapshot > summary { color:#f1fbfc !important; background:#1d424e !important; border-color:#668b95 !important; }
  [data-theme="dark"] :is(.cockpit-monthly-snapshot-title b,.cockpit-monthly-month h3) { color:#f2fbfc !important; }
  [data-theme="dark"] .cockpit-monthly-snapshot-title small { color:#c8dde2 !important; }
  [data-theme="dark"] .cockpit-monthly-snapshot-count { color:#06181e !important; background:#82e2ef !important; }
  [data-theme="dark"] .cockpit-monthly-item button { color:#eef9fa !important; background:#193640 !important; border-color:color-mix(in srgb,var(--snapshot-color,#72d9ed) 68%,#66808a) !important; border-left-color:var(--snapshot-color,#72d9ed) !important; }
  [data-theme="dark"] .cockpit-monthly-item button:hover { background:#234853 !important; }
  [data-theme="dark"] .cockpit-monthly-date { color:#d2e5e9 !important; }
  [data-theme="dark"] .cockpit-monthly-theme { color:#fff !important; background:color-mix(in srgb,var(--snapshot-color,#72d9ed) 48%,#142c35) !important; }
  [data-theme="dark"] .cockpit-monthly-post-title { color:#f3fbfc !important; }
  [data-theme="dark"] .cockpit-monthly-empty { color:#c6dce1 !important; }
  [data-theme="dark"] .workflow-node rect { fill:#1c3944 !important; stroke:#76cfd5 !important; }
  [data-theme="dark"] .workflow-node text { fill:#effbfc !important; }
  [data-theme="dark"] .workflow-return { fill:#c4d8dd !important; }
  [data-theme="dark"] .week { color:#fff !important; }
  @media (max-width:700px) { .cockpit-theme-toggle:not(.in-nav) { top:calc(var(--cockpit-session-height,52px) + 6px); right:8px; padding:8px 10px; } }
`;
document.head.appendChild(style);

const button = document.createElement("button");
button.type = "button";
button.className = "cockpit-theme-toggle";
button.dataset.themeToggle = "";
button.addEventListener("click", () => setTheme(root.dataset.theme === "dark" ? "light" : "dark", true));
document.body.appendChild(button);

const compactLayout = matchMedia("(max-width:700px)");
function placeThemeToggle() {
  const session = document.querySelector("#cockpit-session");
  const logout = document.querySelector("#cockpit-logout");
  if (compactLayout.matches && session && logout) {
    if (button.parentElement !== session) session.insertBefore(button, logout);
    button.classList.add("in-session");
  } else {
    if (button.parentElement !== document.body) document.body.appendChild(button);
    button.classList.remove("in-session");
  }
}
compactLayout.addEventListener?.("change", placeThemeToggle);
addEventListener("cockpit:content-ready", placeThemeToggle);
addEventListener("cockpit:session-ready", placeThemeToggle);
placeThemeToggle();
setTheme(savedTheme() || (media.matches ? "dark" : "light"));
media.addEventListener?.("change", (event) => {
  if (!savedTheme()) setTheme(event.matches ? "dark" : "light");
});
