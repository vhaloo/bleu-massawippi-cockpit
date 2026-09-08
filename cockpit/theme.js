const STORAGE_KEY = "bleu-massawippi-theme";
const root = document.documentElement;
const media = matchMedia("(prefers-color-scheme: dark)");
const THEMES = { light: "Clair", dark: "Sombre", paper: "Crème–terracotta" };

function savedTheme() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return Object.hasOwn(THEMES, value) ? value : null;
  } catch {
    return null;
  }
}

function setTheme(theme, persist = false) {
  if (!Object.hasOwn(THEMES, theme)) return;
  root.dataset.theme = theme;
  root.style.colorScheme = theme === "dark" ? "dark" : "light";
  if (persist) {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* stockage facultatif */ }
  }
  const button = document.querySelector("[data-theme-toggle]");
  if (!button) return;
  button.setAttribute("aria-label", `Choisir le thème — ${THEMES[theme]}`);
  button.title = `Thème : ${THEMES[theme]}`;
  button.textContent = `◐ ${THEMES[theme]}`;
  button.dataset.currentTheme = theme;
  document.querySelectorAll('[name="cockpit-display-theme"]').forEach(input => { input.checked = input.value === theme; });
}

const style = document.createElement("style");
style.id = "cockpit-theme-style";
style.textContent = `
  .cockpit-theme-toggle { position:fixed; top:98px; right:12px; z-index:2400; border:1px solid rgba(7,58,82,.25); border-radius:999px; padding:8px 12px; background:#fff; color:#073a52; box-shadow:0 5px 18px rgba(0,0,0,.15); font:700 .78rem/1 system-ui,sans-serif; cursor:pointer; }
  #cockpit-session .cockpit-theme-toggle.in-session { position:static; display:grid; width:40px; min-width:40px; height:40px; padding:0; place-items:center; overflow:hidden; box-shadow:none; font-size:0; }
  .cockpit-theme-toggle.in-session:before { content:"◐"; font-size:1rem; }
  .cockpit-task-item.workflow-ready { border-color:#8ec8b5; background:#e3f5ee; box-shadow:0 0 0 2px rgba(33,134,109,.13); }
  .cockpit-task-ready { display:inline-flex; margin-bottom:7px; padding:4px 8px; border-radius:999px; color:#155c4e; background:#ccebdc; font-size:.65rem; font-weight:900; }
  .cockpit-task-progress { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:5px; margin:7px 0; }
  .cockpit-task-progress span { padding:5px 4px; border:1px solid #cbdcdf; border-radius:8px; color:#607b85; background:rgba(255,255,255,.66); font-size:.62rem; font-weight:800; text-align:center; }
  .cockpit-task-progress span.done { color:#155c4e; border-color:#8ec8b5; background:#d8f0e5; }
  .cockpit-task-item.workflow-ready .cockpit-task-actions button[data-complete-task] { color:#fff; border-color:#21866d; background:#21866d; }
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
  [data-theme="dark"] .cockpit-task-item.workflow-ready { color:#dffff3 !important; background:#1e5144 !important; border-color:#76c8aa !important; box-shadow:0 0 0 2px rgba(118,200,170,.16); }
  [data-theme="dark"] .cockpit-task-ready { color:#dffff3 !important; background:#276b57 !important; }
  [data-theme="dark"] .cockpit-task-progress span { color:#c8dadd !important; background:#284750 !important; border-color:#62828c !important; }
  [data-theme="dark"] .cockpit-task-progress span.done { color:#dffff3 !important; background:#27614f !important; border-color:#76c8aa !important; }
  [data-theme="dark"] .cockpit-task-item.workflow-ready .cockpit-task-actions button[data-complete-task] { color:#071b15 !important; background:#79d6b6 !important; border-color:#79d6b6 !important; }
  [data-theme="dark"] .cockpit-task-source { color:#fff !important; background:#bd654b !important; }
  [data-theme="dark"] .cockpit-task-priority { color:#ffe8ad !important; background:#493c24 !important; border:1px solid #8b7344 !important; }
  [data-theme="dark"] .cockpit-media-blocked { color:#ffe9b8 !important; background:#483a20 !important; border-color:#9e7c3d !important; }
  [data-theme="dark"] .cockpit-media-final-action:disabled { color:#d5dadd !important; background:#3c464a !important; border-color:#66777d !important; }
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
  [data-theme="dark"] .cockpit-monthly-legend { color:#d0e2e6 !important; }
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
style.textContent += `
  #cockpit-theme-picker{width:min(530px,calc(100% - 28px));max-height:85dvh;padding:26px;border:1px solid #d5cbb9;border-radius:20px;color:#303a30;background:#fffaf1;box-shadow:0 20px 70px #352b3040;font:15px/1.5 system-ui,sans-serif}
  #cockpit-theme-picker::backdrop{background:#18251cd0;backdrop-filter:blur(4px)}
  #cockpit-theme-picker h2{margin:0;font:normal 29px/1.2 Georgia,serif;color:inherit}
  #cockpit-theme-picker>p{color:#626759;margin:12px 0 20px}
  #cockpit-theme-picker fieldset{border:0;padding:0;margin:0;display:grid;gap:10px}
  #cockpit-theme-picker legend{font-weight:700;margin-bottom:10px}
  #cockpit-theme-picker label{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid #d5cbb9;border-radius:12px;cursor:pointer}
  #cockpit-theme-picker label:has(input:checked){border-color:#9a4b30;background:#f5e8da;box-shadow:inset 3px 0 #9a4b30}
  #cockpit-theme-picker input{accent-color:#9a4b30;width:18px;height:18px;flex-shrink:0}
  #cockpit-theme-picker small{display:block;color:#626759;font-size:12px;margin-top:4px}
  #cockpit-theme-picker .theme-swatch{width:35px;height:44px;border:1px solid #b2b7ab;border-radius:8px;flex-shrink:0;background:linear-gradient(135deg,#fff 55%,#146c70 56%)}
  #cockpit-theme-picker [data-swatch="dark"]{background:linear-gradient(135deg,#19343b 55%,#7ed9cd 56%)}
  #cockpit-theme-picker [data-swatch="paper"]{background:linear-gradient(135deg,#f4efe5 50%,#9a4b30 51%,#9a4b30 75%,#3f624b 76%)}
  #cockpit-theme-picker form{display:flex;justify-content:flex-end;margin-top:20px}
  #cockpit-theme-picker button{min-height:44px;border:0;border-radius:10px;background:#9a4b30;color:#fffaf1;padding:10px 22px;font:700 15px system-ui;cursor:pointer}
  #cockpit-theme-picker :is(input,button):focus-visible{outline:3px solid #3f624b;outline-offset:4px}
  [data-theme="dark"] #cockpit-theme-picker{color:#edf5ef;background:#19343b;border-color:#698185}
  [data-theme="dark"] #cockpit-theme-picker :is(p,small){color:#ccdedb}
  [data-theme="dark"] #cockpit-theme-picker label:has(input:checked){background:#23464a;border-color:#7ed9cd;box-shadow:inset 3px 0 #7ed9cd}
  [data-theme="paper"]{color-scheme:light;background:#f4efe5;--v2-bg:#f4efe5;--v2-paper:#fffaf1;--v2-ink:#303a30;--v2-muted:#626759;--v2-line:#d5cbb9;--v2-accent:#9a4b30;--v2-soft:#e9e3d6;--v2-glass:#fffaf1f2;--v2-glass-ink:#303a30;--v2-glass-muted:#626759;--v2-glass-line:#a49a85;--v2-past-bg:#e9e3d6}
  html[data-workspace="v2"][data-theme="paper"]{--v2-bg:#f4efe5;--v2-paper:#fffaf1;--v2-ink:#303a30;--v2-muted:#626759;--v2-line:#d5cbb9;--v2-accent:#9a4b30;--v2-soft:#e9e3d6;--v2-glass:#fffaf1f2;--v2-glass-ink:#303a30;--v2-glass-muted:#626759;--v2-glass-line:#a49a85;--v2-past-bg:#e9e3d6}
  [data-theme="paper"] body{--ink:#303a30;--navy:#3f624b;--blue:#9a4b30;--aqua:#3f624b;--mist:#e9e3d6;--paper:#fffaf1;--soft:#626759;--line:#d5cbb9;--gold:#945a29;--coral:#9a4b30;color:#303a30!important;background:#f4efe5!important}
  [data-theme="paper"] :is(.cockpit-theme-toggle,.stats,.panel,.post,.gate,.toolbar,.table,.metric,.source,.context-fold,.readme-fold,.readme-step,.day-group,.section-feedback,.cockpit-controls,.cockpit-media,.cockpit-media-card,.cockpit-workflow,.cockpit-message,.cockpit-login-card,#cockpit-sidebar,#cockpit-feedback-panel,#cockpit-task-panel,.feedback-form,.task-owner,.collab-mode,.readme-card,.vm-panel){color:#303a30!important;background:#fffaf1!important;border-color:#d5cbb9!important;box-shadow:0 6px 22px #594a300b}
  [data-theme="paper"] :is(.copy,.cockpit-media-info,.cockpit-choice-row,.cockpit-media-preview,.cockpit-task-item,.cockpit-thread,.cockpit-comment-row,.vm-card-summary,.cockpit-monthly-snapshot,.cockpit-editorial-decision,.cockpit-media-approved-copy){color:#303a30!important;background:#f4efe5!important;border-color:#d5cbb9!important}
  [data-theme="paper"] :is(h1,h2,h3,h4,.post h4,.stat b,.box b,.source h3,.cockpit-login-card label,.cockpit-login-card h2){color:#303a30}
  [data-theme="paper"] :is(.lead,.post-head p,.cockpit-login-card p,.cockpit-media-meta p,.cockpit-media-empty,.cockpit-thread-empty,.cockpit-message header,.vm-card-next small){color:#626759!important}
  [data-theme="paper"] :is(input,textarea,select){color:#303a30!important;background:#fffaf1!important;border-color:#a49a85!important;caret-color:#303a30}
  [data-theme="paper"] :is(input,textarea)::placeholder{color:#626759!important;opacity:1}
  [data-theme="paper"] :is(a,.readme-kicker,.eyebrow,.cockpit-media-folder){color:#9a4b30}
  [data-theme="paper"] :is(.cockpit-status-row button,.cockpit-quick-row button,.cockpit-comment-row button,.cockpit-feedback-item button,.cockpit-task-actions button,.copy button,.cockpit-workflow-actions button,.cockpit-editorial-buttons button){color:#3f624b!important;background:#fffaf1!important;border-color:#a49a85!important}
  [data-theme="paper"] :is(.button.primary,.cockpit-comment-row button.save,.cockpit-media-form button,.cockpit-workflow-actions button.primary,.cockpit-login-card button[type="submit"]){color:#fffaf1!important;background:#9a4b30!important;border-color:#9a4b30!important}
  [data-theme="paper"] :is(.context-fold>summary,.readme-fold>summary,.cockpit-media>summary,.section-feedback>summary,.table th,.vm-panel-header){color:#303a30!important;background:#e9e3d6!important;border-color:#d5cbb9!important}
  [data-theme="paper"] :is(.cockpit-task-item.workflow-ready,.cockpit-task-ready,.cockpit-task-progress span.done,.vm-all-clear){color:#304b39!important;background:#dedfcf!important;border-color:#8a9d7d!important}
  [data-theme="paper"] :is(.cockpit-media-blocked,.coordination-alert,.note){color:#78501f!important;background:#f7e3c6!important;border-color:#cba16c!important}
  [data-theme="paper"] .cockpit-media-final-action:disabled{color:#626759!important;background:#e9e3d6!important;border-color:#a49a85!important}
  [data-theme="paper"] :is(button,a,input,textarea,select,summary):focus-visible{outline:3px solid #9a4b30;outline-offset:3px}
  html[data-workspace="v2"][data-theme="paper"] #cockpit-session{background:#3f624b;color:#fffaf1}
  [data-theme="paper"] .v2-brand-mark{background:#9a4b30;box-shadow:0 4px 0 #d5cbb9}
  [data-theme="paper"] :is(.v2-sidebar nav a[aria-current="page"],.v2-side-bottom p){color:#3f624b!important}
  [data-theme="paper"] .v2-sidebar{background:linear-gradient(#fffaf1,#f4efe5)}
  @media (max-width:420px){#cockpit-theme-picker{padding:20px 16px}#cockpit-theme-picker label{padding:12px 9px;gap:9px}#cockpit-theme-picker .theme-swatch{width:26px}}
`;
document.head.appendChild(style);

const button = document.createElement("button");
button.type = "button";
button.className = "cockpit-theme-toggle";
button.dataset.themeToggle = "";
button.setAttribute("aria-haspopup", "dialog");
button.setAttribute("aria-controls", "cockpit-theme-picker");
button.addEventListener("click", () => {
  picker.showModal();
  picker.querySelector('input:checked')?.focus();
});
document.body.appendChild(button);

const picker = document.createElement("dialog");
picker.id = "cockpit-theme-picker";
picker.setAttribute("aria-labelledby", "cockpit-theme-title");
picker.innerHTML = `<h2 id="cockpit-theme-title">Votre espace, vos couleurs</h2>
  <p>Choisissez l’ambiance de votre Cockpit.</p>
  <fieldset><legend>Thème d’écran</legend>
    <label><input type="radio" name="cockpit-display-theme" value="light"><span class="theme-swatch" data-swatch="light"></span><span><b>Clair</b><small>Blanc lumineux et bleu du lac.</small></span></label>
    <label><input type="radio" name="cockpit-display-theme" value="dark"><span class="theme-swatch" data-swatch="dark"></span><span><b>Sombre</b><small>Bleu profond et accents d’eau.</small></span></label>
    <label><input type="radio" name="cockpit-display-theme" value="paper"><span class="theme-swatch" data-swatch="paper"></span><span><b>Crème–terracotta</b><small>Papier chaud, terre cuite et verts de forêt, comme l’Atlas Bleu.</small></span></label>
  </fieldset><form method="dialog"><button type="submit">Terminé</button></form>`;
picker.addEventListener("change", event => {
  if (event.target.name === "cockpit-display-theme") setTheme(event.target.value, true);
});
picker.addEventListener("close", () => button.focus());
document.body.appendChild(picker);

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
