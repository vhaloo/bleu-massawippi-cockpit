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
  .cockpit-theme-toggle { position:fixed; top:58px; right:12px; z-index:2400; border:1px solid rgba(7,58,82,.25); border-radius:999px; padding:8px 12px; background:#fff; color:#073a52; box-shadow:0 5px 18px rgba(0,0,0,.15); font:700 .78rem/1 system-ui,sans-serif; cursor:pointer; }
  [data-theme="dark"] body { --ink:#e8f3f5; --navy:#d8f2f7; --soft:#172b34; --line:#36515d; color:#e8f3f5 !important; background:#0b171d !important; }
  [data-theme="dark"] .cockpit-theme-toggle { color:#e8f3f5; background:#17313c; border-color:#52717d; }
  [data-theme="dark"] :is(.panel,.post,.week,.summary-card,.cockpit-login-card,#cockpit-sidebar,#cockpit-feedback-panel,#cockpit-task-panel,.feedback-form,.task-owner,.collab-mode,.readme-card,details) { background-color:#13262f !important; color:#e8f3f5 !important; border-color:#36515d !important; }
  [data-theme="dark"] :is(input,textarea,select) { color:#f3fafb !important; background:#0c1b22 !important; border-color:#52717d !important; }
  [data-theme="dark"] :is(p,li,td,th,label,small,.muted,.feedback-note,.cockpit-login-note) { color:inherit; }
  [data-theme="dark"] :is(table,td,th) { border-color:#36515d !important; }
  [data-theme="dark"] a { color:#7fd8ee; }
  @media (max-width:600px) { .cockpit-theme-toggle { top:52px; right:8px; padding:8px 10px; } }
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
