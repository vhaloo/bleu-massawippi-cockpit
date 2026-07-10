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
  updateCockpitFeedbackStatus
} from "./firebase-client.js";

const { configured } = getClientState();
const demoMode = new URLSearchParams(location.search).get("demo") === "1";
const state = { user: null, profile: null, rows: new Map(), auditUnsubscribe: null, feedbackUnsubscribe: null, scheduleUnsubscribe: null, contentLoaded: false };
let activeRecognition = null;
let activeTextarea = null;
let recognitionRestart = false;

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
  sidebar.innerHTML = "<h2>Journal de modifications</h2><p class=\"cockpit-sidebar-note\">Lecture technique des changements synchronisés.</p><div id=\"cockpit-log-list\"></div><h2 style=\"margin-top:24px\">Rétroactions du cockpit</h2><p class=\"cockpit-sidebar-note\">Les avis déposés dans les sections et la boîte à idées.</p><div id=\"cockpit-feedback-list\"></div>";
  document.body.appendChild(sidebar);
  const toggle = document.createElement("button");
  toggle.id = "cockpit-sidebar-toggle";
  toggle.type = "button";
  toggle.textContent = "Ouvrir le journal";
  toggle.addEventListener("click", () => sidebar.classList.toggle("open"));
  document.body.appendChild(toggle);
}

const feedbackSectionLabels = {
  cap: "Le cap",
  cadence: "La cadence choisie",
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
    .then(() => writeAuditLog("cockpit:" + sectionId, "rétroaction déposée", state.profile))
    .then(() => {
      messageField.value = "";
      toast("Rétroaction enregistrée pour la prochaine mouture.");
    })
    .catch((error) => toast(error.message, true))
    .finally(() => { submitButton.disabled = false; });
}

function enhanceSectionFeedback() {
  document.querySelectorAll("#cockpit-content main > section[id]").forEach((section) => {
    if (section.querySelector("[data-section-feedback]")) return;
    const heading = section.querySelector(".heading");
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
        <textarea data-comment maxlength="5000" placeholder="Ajouter une consigne ou un commentaire…" aria-label="Commentaire de pilotage"></textarea>
        <button type="button" data-dictate aria-label="Dicter un commentaire" title="Dicter un commentaire">🎙️</button>
        <button class="save" type="button" data-save-comment>Enregistrer</button>
        <div class="cockpit-voice-status" data-voice-status aria-live="polite">La dictée utilise la reconnaissance vocale native disponible.</div>
      </div>
      <div class="cockpit-quick-row" aria-label="Badges rapides">
        <button type="button" data-tag="cancel">🔴 À annuler</button>
        <button type="button" data-tag="delay">🟡 À décaler</button>
        <button type="button" data-tag="perfect">🟢 Parfait</button>
      </div>`;
    card.appendChild(controls);
  });
  applyRemoteRows();
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

function setVoiceStatus(textarea, message, kind = "") {
  const status = textarea?.closest(".cockpit-comment-row")?.querySelector("[data-voice-status]");
  if (!status) return;
  status.textContent = message;
  status.className = "cockpit-voice-status" + (kind ? " " + kind : "");
}

function stopDictation(message = "Dictée arrêtée.") {
  recognitionRestart = false;
  const recognition = activeRecognition;
  const textarea = activeTextarea;
  activeRecognition = null;
  activeTextarea = null;
  if (recognition) {
    try { recognition.stop(); } catch {}
  }
  if (textarea) setVoiceStatus(textarea, message);
}

function startDictation(textarea) {
  if (activeRecognition && activeTextarea === textarea) {
    stopDictation();
    return;
  }
  if (activeRecognition) stopDictation();
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    textarea.focus();
    setVoiceStatus(textarea, "Ce navigateur ne propose pas l’API vocale. Utilisez la dictée intégrée au clavier ou au système.", "error");
    toast("La dictée native n’est pas exposée par ce navigateur; le champ reste utilisable avec la dictée du système.", true);
    return;
  }
  if (!window.isSecureContext && !["localhost", "127.0.0.1"].includes(location.hostname)) {
    setVoiceStatus(textarea, "La dictée exige une connexion HTTPS.", "error");
    return;
  }
  const recognition = new Recognition();
  const webkitOnly = !window.SpeechRecognition && Boolean(window.webkitSpeechRecognition);
  activeRecognition = recognition;
  activeTextarea = textarea;
  recognitionRestart = true;
  recognition.lang = "fr-CA";
  recognition.continuous = !webkitOnly;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;
  recognition.onstart = () => setVoiceStatus(textarea, "Écoute en cours… cliquez de nouveau sur le micro pour arrêter.", "live");
  recognition.onresult = (event) => {
    let interim = "";
    let finalText = "";
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      const transcript = event.results[index][0]?.transcript || "";
      if (event.results[index].isFinal) finalText += transcript;
      else interim += transcript;
    }
    if (finalText.trim()) {
      textarea.value = (textarea.value ? textarea.value.trimEnd() + " " : "") + finalText.trim();
      textarea.dataset.dictated = "true";
      textarea.focus();
    }
    setVoiceStatus(textarea, interim ? `Écoute… ${interim}` : "Écoute en cours…", "live");
  };
  recognition.onerror = (event) => {
    const permissionError = ["not-allowed", "service-not-allowed"].includes(event.error);
    if (permissionError) recognitionRestart = false;
    setVoiceStatus(textarea, permissionError ? "Autorisation du microphone refusée. Autorisez le micro pour ce site puis réessayez." : `Dictée interrompue (${event.error || "erreur inconnue"}).`, "error");
  };
  recognition.onnomatch = () => setVoiceStatus(textarea, "Aucun mot reconnu; continuez à parler.", "error");
  recognition.onend = () => {
    if (!recognitionRestart || activeRecognition !== recognition) return;
    setVoiceStatus(textarea, "Reprise de l’écoute…", "live");
    window.setTimeout(() => {
      if (!recognitionRestart || activeRecognition !== recognition) return;
      try { recognition.start(); } catch { setVoiceStatus(textarea, "Le navigateur a interrompu la dictée. Cliquez sur le micro pour reprendre.", "error"); }
    }, 180);
  };
  try {
    recognition.start();
  } catch {
    recognitionRestart = false;
    activeRecognition = null;
    activeTextarea = null;
    setVoiceStatus(textarea, "Le microphone est occupé. Fermez une autre dictée puis réessayez.", "error");
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
    await addComment(card.dataset.itemId, text || quickTag, state.profile, quickTag, textarea.dataset.dictated === "true");
    await recordAudit(card, quickTag ? "badge : " + quickTag : (textarea.dataset.dictated === "true" ? "commentaire dicté" : "commentaire ajouté"));
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
    state.auditUnsubscribe?.();
    state.feedbackUnsubscribe?.();
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
    }
  } else {
    document.body.classList.remove("cockpit-admin");
    state.feedbackUnsubscribe?.();
    state.feedbackUnsubscribe = null;
  }
  addFooterCredit();
  enhanceCards();
  enhanceSectionFeedback();
  buildFeedbackWidget();
  syncCardAccess();
}

function applySignedOut(message = "") {
  state.profile = null;
  state.user = null;
  state.rows = new Map();
  state.scheduleUnsubscribe?.();
  state.auditUnsubscribe?.();
  state.feedbackUnsubscribe?.();
  state.scheduleUnsubscribe = null;
  state.auditUnsubscribe = null;
  state.feedbackUnsubscribe = null;
  clearPrivateContent();
  document.body.classList.add("cockpit-locked");
  document.querySelector("#cockpit-session")?.remove();
  document.querySelector("#cockpit-sidebar")?.remove();
  document.querySelector("#cockpit-sidebar-toggle")?.remove();
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
}

function start() {
  document.body.classList.add("cockpit-locked");
  buildLogin();
  enhanceCardEvents();
  enhanceFeedbackListEvents();
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
