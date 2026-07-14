const MOTION_KEY = "bleu-massawippi-motion";
const INSTALL_DISMISS_KEY = "bleu-massawippi-install-dismissed";
const root = document.documentElement;
const reducedMotion = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)");
let deferredInstallPrompt = null;

function savedPreference() {
  try {
    const value = localStorage.getItem(MOTION_KEY);
    return value === "on" || value === "off" ? value : null;
  } catch {
    return null;
  }
}

function effectivePreference() {
  if (reducedMotion?.matches) return "off";
  return savedPreference() || "on";
}

function applyPreference(value = effectivePreference()) {
  const systemReduced = reducedMotion?.matches === true;
  const effective = systemReduced ? "off" : value;
  root.dataset.motion = effective;
  const button = document.querySelector("#cockpit-motion-toggle");
  if (!button) return;
  const enabled = effective === "on";
  button.disabled = systemReduced;
  button.setAttribute("aria-pressed", String(enabled));
  button.setAttribute("aria-label", systemReduced
    ? "Animations désactivées par le réglage de l’appareil."
    : enabled
    ? "Mouvements discrets activés. Cliquer pour les désactiver."
    : "Animations désactivées. Cliquer pour les activer.");
  button.title = button.getAttribute("aria-label");
  button.querySelector("[data-motion-icon]").textContent = enabled ? "≋" : "○";
  button.querySelector("[data-motion-label]").textContent = systemReduced ? "Réglage système sans animation" : enabled ? "Mouvements activés" : "Sans animation";
}

function buildMotionToggle() {
  if (document.querySelector("#cockpit-motion-toggle")) {
    applyPreference();
    return;
  }
  const button = document.createElement("button");
  button.id = "cockpit-motion-toggle";
  button.type = "button";
  button.innerHTML = `<span data-motion-icon aria-hidden="true">≋</span><span class="cockpit-motion-label" data-motion-label>Mouvements activés</span>`;
  button.addEventListener("click", () => {
    const next = root.dataset.motion === "on" ? "off" : "on";
    try { localStorage.setItem(MOTION_KEY, next); } catch {}
    applyPreference(next);
  });
  document.body.appendChild(button);
  applyPreference();
}

function isStandaloneApp() {
  return globalThis.matchMedia?.("(display-mode: standalone)")?.matches || globalThis.navigator?.standalone === true;
}

function showInstallHelp() {
  document.querySelector("#cockpit-install-help")?.remove();
  const note = document.createElement("div");
  note.id = "cockpit-install-help";
  note.setAttribute("role", "status");
  note.textContent = "Dans le menu du navigateur, choisissez « Installer l’application » ou « Ajouter à l’écran d’accueil ».";
  document.body.appendChild(note);
  window.setTimeout(() => note.remove(), 6500);
}

async function requestAppInstall() {
  if (!deferredInstallPrompt) {
    showInstallHelp();
    return;
  }
  deferredInstallPrompt.prompt();
  const choice = await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  if (choice?.outcome === "accepted") {
    try { localStorage.setItem(INSTALL_DISMISS_KEY, "1"); } catch {}
    document.querySelector("#cockpit-install-launch")?.remove();
    document.querySelector("#cockpit-install-shortcut")?.remove();
  }
}

function buildInstallShortcut() {
  if (isStandaloneApp() || document.querySelector("#cockpit-install-shortcut")) return;
  const footer = document.querySelector("footer");
  if (!footer) return;
  const button = document.createElement("button");
  button.id = "cockpit-install-shortcut";
  button.type = "button";
  button.textContent = "Installer le cockpit comme application";
  button.addEventListener("click", requestAppInstall);
  footer.appendChild(button);
}

function buildInstallAdvice() {
  let dismissed = false;
  try { dismissed = localStorage.getItem(INSTALL_DISMISS_KEY) === "1"; } catch {}
  if (dismissed || isStandaloneApp() || document.querySelector("#cockpit-install-launch")) return;
  const node = document.createElement("aside");
  node.id = "cockpit-install-launch";
  node.setAttribute("aria-label", "Installer le cockpit");
  node.innerHTML = `<p><strong>Accès rapide</strong><br>Ajouter le cockpit comme application sur cet appareil.</p><button type="button" data-install-app>Installer</button><button type="button" data-dismiss-install aria-label="Masquer ce conseil">×</button>`;
  node.querySelector("[data-dismiss-install]").addEventListener("click", () => {
    try { localStorage.setItem(INSTALL_DISMISS_KEY, "1"); } catch {}
    node.remove();
  });
  node.querySelector("[data-install-app]").addEventListener("click", requestAppInstall);
  document.body.appendChild(node);
}

const style = document.createElement("style");
style.textContent = `
  #cockpit-motion-toggle { position:fixed; left:150px; bottom:15px; z-index:30; display:grid; width:42px; height:42px; padding:0; place-items:center; overflow:hidden; border:1px solid rgba(255,255,255,.7); border-radius:50%; color:#fff; background:#073a52; box-shadow:0 7px 20px rgba(7,58,82,.22); cursor:pointer; isolation:isolate; }
  #cockpit-motion-toggle::before { position:absolute; inset:54% -20% -12%; z-index:-2; border-radius:45% 48% 0 0; content:""; background:#20a8bd; transform:rotate(-2deg); }
  #cockpit-motion-toggle::after { position:absolute; left:-12%; right:-12%; top:48%; z-index:-1; height:9px; border-radius:50%; content:""; background:rgba(117,225,231,.7); }
  html[data-motion="on"] #cockpit-motion-toggle::after { animation:cockpit-water-level 3.8s ease-in-out infinite; }
  #cockpit-motion-toggle [data-motion-icon] { position:relative; z-index:1; font-size:1.25rem; font-weight:900; line-height:1; text-shadow:0 1px 3px rgba(0,0,0,.25); }
  #cockpit-motion-toggle:disabled { cursor:default; opacity:.82; }
  .cockpit-motion-label { position:absolute !important; width:1px !important; height:1px !important; padding:0 !important; margin:-1px !important; overflow:hidden !important; clip:rect(0,0,0,0) !important; white-space:nowrap !important; border:0 !important; }
  html[data-motion="off"] #cockpit-motion-toggle::before { inset:72% -20% -12%; background:#6a8189; }
  html[data-motion="off"] #cockpit-motion-toggle::after { display:none; }
  [data-dictate] { position:relative; }
  html[data-motion="on"] [data-dictate][aria-pressed="true"] { animation:cockpit-voice-button 1.4s ease-in-out infinite; }
  html[data-motion="on"] [data-dictate][aria-pressed="true"]::after { position:absolute; inset:-5px; border:2px solid rgba(32,168,189,.48); border-radius:inherit; content:""; pointer-events:none; animation:cockpit-voice-ring 1.4s ease-out infinite; }
  html[data-motion="on"] .cockpit-voice-status.live::before { display:inline-block; width:18px; height:10px; margin-right:6px; content:""; vertical-align:-1px; background:repeating-linear-gradient(90deg,#1692aa 0 2px,transparent 2px 4px); transform-origin:center; animation:cockpit-voice-meter .72s ease-in-out infinite alternate; }
  html[data-motion="on"] :is([data-media-decision],[data-media-override],[data-workflow-stage],[data-comment-action],[data-vm-load-more],.cockpit-workflow-gate):active { transform:translateY(1px) scale(.985); }
  html[data-motion="off"] *, html[data-motion="off"] *::before, html[data-motion="off"] *::after { scroll-behavior:auto !important; animation:none !important; transition-duration:.01ms !important; transition-delay:0ms !important; }
  [data-theme="dark"] #cockpit-motion-toggle { border-color:#7395a0; background:#102e3a; box-shadow:0 7px 20px rgba(0,0,0,.34); }
  #cockpit-install-launch { position:fixed; right:15px; bottom:121px; z-index:31; display:flex; align-items:center; gap:8px; max-width:min(340px,calc(100vw - 30px)); padding:10px 12px; border:1px solid #b9dde2; border-radius:14px; color:#073a52; background:#f8fcfc; box-shadow:0 11px 28px rgba(7,58,82,.16); font-size:.76rem; }
  #cockpit-install-launch p { margin:0; line-height:1.3; }
  #cockpit-install-launch button { padding:6px 8px; border:0; border-radius:8px; color:#fff; background:#0b7895; font-size:.7rem; font-weight:850; cursor:pointer; white-space:nowrap; }
  #cockpit-install-launch button[data-dismiss-install] { padding:2px 4px; color:#55727d; background:transparent; font-size:1rem; }
  #cockpit-install-shortcut { display:block; margin:10px auto 0; padding:7px 10px; border:1px solid #9fc8ce; border-radius:999px; color:#315f6d; background:transparent; font:inherit; font-size:.7rem; font-weight:800; cursor:pointer; }
  #cockpit-install-shortcut:hover { color:#073a52; background:#edf8f8; }
  #cockpit-install-help { position:fixed; right:14px; bottom:70px; z-index:1100; max-width:min(360px,calc(100vw - 28px)); padding:11px 13px; border-radius:12px; color:#fff; background:#073a52; box-shadow:0 9px 24px rgba(0,0,0,.22); font-size:.76rem; }
  [data-theme="dark"] #cockpit-install-shortcut { color:#dff5f7; border-color:#668d96; background:#17333e; }
  [data-theme="dark"] #cockpit-install-shortcut:hover { color:#fff; background:#244b57; }
  @keyframes cockpit-water-level { 0%,100% { transform:translateX(-3%) rotate(-2deg); } 50% { transform:translateX(4%) rotate(2deg); } }
  @keyframes cockpit-voice-button { 0%,100% { box-shadow:0 0 0 0 rgba(32,168,189,.08); } 50% { box-shadow:0 0 0 5px rgba(32,168,189,.16); } }
  @keyframes cockpit-voice-ring { from { opacity:.8; transform:scale(.86); } to { opacity:0; transform:scale(1.28); } }
  @keyframes cockpit-voice-meter { from { transform:scaleY(.45); opacity:.7; } to { transform:scaleY(1); opacity:1; } }
  @media (max-width:700px) {
    #cockpit-motion-toggle { left:8px; bottom:62px; width:40px; height:40px; }
    #cockpit-install-launch { right:8px; bottom:62px; max-width:calc(100vw - 16px); }
  }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { scroll-behavior:auto !important; animation:none !important; transition-duration:.01ms !important; transition-delay:0ms !important; }
  }
`;
document.head.appendChild(style);

applyPreference();
addEventListener("cockpit:session-ready", () => {
  buildMotionToggle();
  queueMicrotask(() => {
    buildInstallShortcut();
    buildInstallAdvice();
  });
});
addEventListener("cockpit:session-ended", () => {
  document.querySelector("#cockpit-motion-toggle")?.remove();
  document.querySelector("#cockpit-install-launch")?.remove();
  document.querySelector("#cockpit-install-shortcut")?.remove();
});
addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  buildInstallAdvice();
});
addEventListener("appinstalled", () => {
  try { localStorage.setItem(INSTALL_DISMISS_KEY, "1"); } catch {}
  document.querySelector("#cockpit-install-launch")?.remove();
  document.querySelector("#cockpit-install-shortcut")?.remove();
});
reducedMotion?.addEventListener?.("change", () => applyPreference());
