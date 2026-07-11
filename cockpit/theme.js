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
  button.title = dark ? "Passer au mode clair" : "Passer au mode sombre";
  button.textContent = dark ? "☀ Mode clair" : "☾ Mode sombre";
}

const style = document.createElement("style");
style.id = "cockpit-theme-style";
style.textContent = `
  .cockpit-theme-toggle { position:fixed; top:98px; right:12px; z-index:2400; border:1px solid rgba(7,58,82,.25); border-radius:999px; padding:8px 12px; background:#fff; color:#073a52; box-shadow:0 5px 18px rgba(0,0,0,.15); font:700 .78rem/1 system-ui,sans-serif; cursor:pointer; }
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
  [data-theme="dark"] :is(.cockpit-workflow h5,.cockpit-thread h5,.cockpit-message header b,.cockpit-message p) { color:#edf9fa !important; }
  [data-theme="dark"] .cockpit-workflow-gate { color:#d4e6ea !important; background:#203c47 !important; border-color:#62828c !important; }
  [data-theme="dark"] .cockpit-workflow-gate.done { color:#dffff3 !important; background:#1e5144 !important; border-color:#76c8aa !important; }
  [data-theme="dark"] :is(.cockpit-decision-guide,.cockpit-workflow-intro,.cockpit-control-help) { color:#d2e5e9 !important; }
  [data-theme="dark"] .cockpit-decision-guide { background:#1c3944 !important; border-color:#648994 !important; }
  [data-theme="dark"] :is(.cockpit-decision-guide b,.cockpit-control-label,.cockpit-workflow-gate b) { color:#f2fafb !important; }
  [data-theme="dark"] .cockpit-workflow-gate.current { color:#ffe7b5 !important; background:#493b24 !important; border-color:#e2b553 !important; }
  [data-theme="dark"] .cockpit-media-card.is-final { border-color:#79d6b6 !important; }
  [data-theme="dark"] .cockpit-media-final-action { color:#071b15 !important; background:#79d6b6 !important; border-color:#79d6b6 !important; }
  [data-theme="dark"] :is(.project-hub,.project-card) { color:#eef7f8 !important; background:#152c36 !important; border-color:#796e50 !important; }
  [data-theme="dark"] .project-hub>summary { color:#fff1c9 !important; background:#473a21 !important; border-color:#9b7c3c !important; }
  [data-theme="dark"] .project-decision { color:#dff7ed !important; background:#1e463b !important; border-color:#6ab594 !important; }
  [data-theme="dark"] :is(.project-card h3,.project-card strong,.project-timeline b) { color:#fff2d0 !important; }
  [data-theme="dark"] :is(.project-card p,.project-card li,.project-timeline div) { color:#d1e2e6 !important; }
  [data-theme="dark"] .project-timeline div { background:#203c47 !important; }
  [data-theme="dark"] .project-links a { color:#fff1c9 !important; background:#263f48 !important; border-color:#b08b43 !important; }
  [data-theme="dark"] .cockpit-workflow-actions button { color:#dff7fa !important; background:#18343f !important; border-color:#72d9e9 !important; }
  [data-theme="dark"] .cockpit-workflow-actions button.primary { color:#06151b !important; background:#72d9e9 !important; }
  [data-theme="dark"] .cockpit-message header, [data-theme="dark"] .cockpit-thread-empty { color:#bcd0d6 !important; }
  [data-theme="dark"] .workflow-node rect { fill:#1c3944 !important; stroke:#76cfd5 !important; }
  [data-theme="dark"] .workflow-node text { fill:#effbfc !important; }
  [data-theme="dark"] .workflow-return { fill:#c4d8dd !important; }
  [data-theme="dark"] .week { color:#fff !important; }
  @media (max-width:600px) { .cockpit-theme-toggle { top:94px; right:8px; padding:8px 10px; } }
`;
document.head.appendChild(style);

const button = document.createElement("button");
button.type = "button";
button.className = "cockpit-theme-toggle";
button.dataset.themeToggle = "";
button.addEventListener("click", () => setTheme(root.dataset.theme === "dark" ? "light" : "dark", true));
document.body.appendChild(button);
setTheme(savedTheme() || (media.matches ? "dark" : "light"));
media.addEventListener?.("change", (event) => {
  if (!savedTheme()) setTheme(event.matches ? "dark" : "light");
});
