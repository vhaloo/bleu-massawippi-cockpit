import {
  getClientState,
  observeAuth,
  signIn,
  sendPasswordReset,
  logOut,
  subscribeScheduleItems,
  upsertScheduleItem,
  addComment,
  uploadAttachment,
  writeAuditLog,
  subscribeAuditLogs
} from "./firebase-client.js";

const { configured } = getClientState();
const demoMode = new URLSearchParams(location.search).get("demo") === "1";
const state = { user: null, profile: null, rows: new Map(), auditUnsubscribe: null, scheduleUnsubscribe: null };

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
  .cockpit-drop { margin-top: 8px; padding: 8px; border: 1px dashed #a6cdd2; border-radius: 9px; color: #587680; background: #fbfefe; font-size: .73rem; text-align: center; }
  .cockpit-drop.dragging { border-color: #0b7895; background: #eaf7f8; }
  .cockpit-drop input { display: none; }
  .cockpit-drop label { cursor: pointer; text-decoration: underline; }
  .post.is-deleted { display: none; }
  body.cockpit-admin .post.is-deleted { display: block; opacity: .45; }
  .cockpit-admin .post.is-deleted h4 { text-decoration: line-through; }
  #cockpit-sidebar { position: fixed; top: 45px; right: 0; bottom: 0; z-index: 30; width: min(390px, 94vw); padding: 18px; overflow: auto; border-left: 1px solid #cbe1e4; background: #f8fcfc; box-shadow: -15px 0 35px rgba(7,58,82,.13); transform: translateX(100%); transition: transform .22s ease; }
  #cockpit-sidebar.open { transform: translateX(0); }
  #cockpit-sidebar h2 { margin: 0; color: #073a52; font-size: 1.2rem; }
  #cockpit-sidebar .cockpit-log { padding: 10px 0; border-bottom: 1px solid #d6e8ea; color: #4f6c77; font-size: .76rem; }
  #cockpit-sidebar .cockpit-log b { display: block; color: #073a52; }
  #cockpit-sidebar-toggle { position: fixed; right: 15px; bottom: 15px; z-index: 31; display: none; min-height: 42px; padding: 0 13px; border: 1px solid #073a52; border-radius: 999px; color: #fff; background: #073a52; font-weight: 850; cursor: pointer; }
  body.cockpit-admin #cockpit-sidebar-toggle { display: block; }
  #cockpit-credit { margin-top: 12px; color: #587680; font-size: .78rem; }
  @media (max-width: 700px) {
    #cockpit-session { padding: 8px 12px; }
    .cockpit-status-row button[data-status="deleted"] { margin-left: 0; }
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
    error.textContent = "";
    try {
      await signIn(login.querySelector("#cockpit-email").value.trim(), login.querySelector("#cockpit-password").value);
    } catch (reason) {
      error.textContent = "Connexion refusée. Vérifiez les identifiants ou la configuration Firebase.";
      console.error(reason);
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
  session.querySelector("#cockpit-logout").addEventListener("click", () => {
    if (demoMode) {
      toast("Aperçu local : aucune session à fermer.");
      return;
    }
    logOut().catch((error) => toast(error.message, true));
  });
  return session;
}

function buildAdminSidebar() {
  if (document.querySelector("#cockpit-sidebar")) return;
  const sidebar = document.createElement("aside");
  sidebar.id = "cockpit-sidebar";
  sidebar.innerHTML = "<h2>Journal de modifications</h2><p class=\"cockpit-sidebar-note\">Lecture technique des changements synchronisés.</p><div id=\"cockpit-log-list\"></div>";
  document.body.appendChild(sidebar);
  const toggle = document.createElement("button");
  toggle.id = "cockpit-sidebar-toggle";
  toggle.type = "button";
  toggle.textContent = "Ouvrir le journal";
  toggle.addEventListener("click", () => sidebar.classList.toggle("open"));
  document.body.appendChild(toggle);
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
    if (card.querySelector(".cockpit-controls")) return;
    const controls = document.createElement("div");
    controls.className = "cockpit-controls";
    controls.innerHTML = `
      <div class="cockpit-status-row" aria-label="Statut de la publication">
        <button type="button" data-status="approved" aria-pressed="false">🟢 Approuvé</button>
        <button type="button" data-status="needs_work" aria-pressed="false">🟡 À retravailler</button>
        <button type="button" data-status="pending" aria-pressed="false">⚪ En attente</button>
        <button type="button" data-status="deleted" aria-label="Masquer virtuellement cette ligne" title="Masquer virtuellement cette ligne">✕</button>
      </div>
      <div class="cockpit-comment-row">
        <textarea data-comment maxlength="5000" placeholder="Ajouter une consigne ou un commentaire…" aria-label="Commentaire de pilotage"></textarea>
        <button type="button" data-dictate aria-label="Dicter un commentaire" title="Dicter un commentaire">🎙️</button>
        <button class="save" type="button" data-save-comment>Enregistrer</button>
      </div>
      <div class="cockpit-quick-row" aria-label="Badges rapides">
        <button type="button" data-tag="cancel">🔴 À annuler</button>
        <button type="button" data-tag="delay">🟡 À décaler</button>
        <button type="button" data-tag="perfect">🟢 Parfait</button>
      </div>
      <div class="cockpit-drop" data-drop>Glisser une pièce jointe ici ou <label>la choisir<input type="file" data-file accept="image/*,video/*,application/pdf"></label></div>`;
    card.appendChild(controls);
  });
  applyRemoteRows();
  syncCardAccess();
}

function applyRemoteRows() {
  document.querySelectorAll(".post[data-item-id]").forEach((card) => {
    const row = state.rows.get(card.dataset.itemId);
    const status = row?.status || "pending";
    card.dataset.status = status;
    card.classList.toggle("is-deleted", Boolean(row?.deleted || status === "deleted"));
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
    toast("Statut enregistré.");
  } catch (error) {
    toast(error.message, true);
  }
}

function startDictation(textarea) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    toast("La dictée vocale n’est pas disponible dans ce navigateur.", true);
    return;
  }
  const recognition = new Recognition();
  recognition.lang = "fr-CA";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.onresult = (event) => {
    textarea.value = (textarea.value ? textarea.value + " " : "") + event.results[0][0].transcript;
    textarea.dataset.dictated = "true";
    textarea.focus();
  };
  recognition.onerror = () => toast("La dictée n’a pas pu être enregistrée.", true);
  recognition.start();
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
    await addComment(card.dataset.itemId, text || quickTag, state.profile, quickTag, textarea.dataset.dictated === "true");
    await recordAudit(card, quickTag ? "badge : " + quickTag : (textarea.dataset.dictated === "true" ? "commentaire dicté" : "commentaire ajouté"));
    textarea.value = "";
    delete textarea.dataset.dictated;
    toast("Commentaire enregistré.");
  } catch (error) {
    toast(error.message, true);
  }
}

async function uploadCardFile(card, file) {
  if (!state.profile || !["director", "admin"].includes(state.profile.role)) {
    toast("Votre session est en lecture seule.", true);
    return;
  }
  try {
    await uploadAttachment(card.dataset.itemId, file, state.profile);
    await recordAudit(card, "pièce jointe ajoutée");
    toast("Pièce jointe transférée; elle sera récupérée par la synchronisation locale.");
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
    const card = event.target.closest(".post[data-item-id]");
    if (!card || !event.target.matches("[data-file]")) return;
    const file = event.target.files?.[0];
    if (file) uploadCardFile(card, file);
  });

  document.addEventListener("dragover", (event) => {
    const drop = event.target.closest("[data-drop]");
    if (!drop) return;
    event.preventDefault();
    drop.classList.add("dragging");
  });
  document.addEventListener("dragleave", (event) => event.target.closest("[data-drop]")?.classList.remove("dragging"));
  document.addEventListener("drop", (event) => {
    const drop = event.target.closest("[data-drop]");
    if (!drop) return;
    event.preventDefault();
    drop.classList.remove("dragging");
    const card = drop.closest(".post[data-item-id]");
    const file = event.dataTransfer.files?.[0];
    if (card && file) uploadCardFile(card, file);
  });
}

function applyProfile(profile) {
  state.profile = profile;
  document.body.classList.remove("cockpit-locked");
  document.body.classList.remove("cockpit-readonly");
  document.querySelector("#cockpit-login")?.setAttribute("hidden", "");
  const session = buildSession();
  session.querySelector("#cockpit-session-label").innerHTML = "Connecté : <strong>" + esc(profile.displayLabel) + "</strong> · rôle " + esc(profile.role);
  if (profile.role === "admin") {
    document.body.classList.add("cockpit-admin");
    buildAdminSidebar();
    state.auditUnsubscribe?.();
    if (configured) {
      state.auditUnsubscribe = subscribeAuditLogs((logs) => {
        const list = document.querySelector("#cockpit-log-list");
        if (!list) return;
        list.innerHTML = logs.length ? logs.map((log) => {
          const when = log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString("fr-CA") : "date en attente";
          return `<div class="cockpit-log"><b>${esc(when)} · ${esc(log.action || "modification")}</b><span>section: ${esc(log.sectionId || "—")} · utilisateur: ${esc(log.userLabel || log.userUid || "—")}</span></div>`;
        }).join("") : "<p>Aucun journal accessible pour le moment.</p>";
      }, (error) => toast("Le journal n’est pas accessible : " + error.message, true));
    }
  } else {
    document.body.classList.remove("cockpit-admin");
  }
  addFooterCredit();
  enhanceCards();
  syncCardAccess();
}

function applySignedOut(message = "") {
  state.profile = null;
  state.user = null;
  state.rows = new Map();
  state.scheduleUnsubscribe?.();
  state.auditUnsubscribe?.();
  document.body.classList.add("cockpit-locked");
  document.querySelector("#cockpit-session")?.remove();
  document.body.classList.remove("cockpit-admin");
  document.body.classList.add("cockpit-readonly");
  const login = document.querySelector("#cockpit-login") || buildLogin();
  login.removeAttribute("hidden");
  const note = login.querySelector("#cockpit-login-note");
  if (demoMode) {
    note.textContent = "Aperçu local activé : les modifications ne sont pas synchronisées.";
    login.setAttribute("hidden", "");
    document.body.classList.remove("cockpit-locked");
    buildSession().querySelector("#cockpit-session-label").innerHTML = "Aperçu local · lecture seule";
    addFooterCredit();
    enhanceCards();
    syncCardAccess();
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
    applyProfile(profile);
    subscribeRemoteData();
  });
}

start();
