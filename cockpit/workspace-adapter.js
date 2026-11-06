import { parsePlanDate } from "./calendar-export-tools.js?v=20261106-b112";
import { fetchPublicationHistoryPage, subscribeAnnieRequestSource, fetchPhilanthropyDashboard, fetchPhilanthropyMembers, fetchPhilanthropyTrackingState, setOpportunityStage } from "./firebase-client.js?v=20261106-b112";
import { watchAnnieRequests } from "./annie-requests.mjs?v=20261106-v2.31";
import { openPublicationStudio } from "./editor-studio.js?v=20261106-b112";
import { interfaceUrl, preferredInterface } from "./workspace-model.mjs?v=20261106-v2.31";
import { mountAccountMenu } from "./account-menu.mjs?v=20261106-b112";

let accountMenu = null;

export function setupInterfaceSwitch(profile) {
  if (!profile?.uid) return;
  const session = document.querySelector("#cockpit-session");
  if (!session) return;
  let link = session.querySelector("#cockpit-interface-switch");
  if (!link) {
    link = document.createElement("a"); link.id = "cockpit-interface-switch";
    const actions = session.querySelector(".cockpit-session-actions") || session;
    actions.insertBefore(link, actions.querySelector("#cockpit-logout"));
  }
  const isV2 = preferredInterface(location.href) === "v2";
  link.textContent = isV2 ? "Ouvrir la version classique ↗" : "Revenir au Cockpit ↗";
  link.title = isV2 ? "Revenir à la version classique, avec les mêmes textes, médias, commentaires et validations. Enregistrez vos saisies en cours avant de changer d’interface." : "Ouvrir la nouvelle interface. Vous pourrez revenir ici à tout moment; vos dossiers et vos droits restent les mêmes. Enregistrez vos saisies en cours avant de changer d’interface.";
  const update = () => { link.href = interfaceUrl(location.href, isV2 ? "classic" : "v2", (globalThis.posts || []).map(p => p.id)); };
  let philanthropyLink = session.querySelector("#cockpit-philanthropy-link");
  if (!philanthropyLink && !isV2) { philanthropyLink = document.createElement("a"); philanthropyLink.id = "cockpit-philanthropy-link"; philanthropyLink.textContent = "Philanthropie"; philanthropyLink.title = "Résultats, objectifs, pistes, suivi et documents de financement"; const target = new URL(location.href); target.searchParams.set("interface","v2"); target.hash = "#/philanthropie"; philanthropyLink.href = target.href; link.before(philanthropyLink); }
  update(); link.onpointerenter = update; link.onfocus = update; link.onclick = update;
  if (accountMenu?.element?.closest('#cockpit-session') !== session || accountMenu?.profileKey !== `${profile.uid}:${profile.role}`) { accountMenu?.destroy(); accountMenu = null; }
  if (!accountMenu) {
    const instance = mountAccountMenu({ profile, classic: !isV2 });
    accountMenu = instance;
    if (instance) window.addEventListener('cockpit:session-ended', () => { instance.destroy({ sessionEnded: true }); if (accountMenu === instance) accountMenu = null; }, { once: true });
  }
  accountMenu?.refresh();
}

export async function setupWorkspaceV2(profile, { state, enhanceCards, toast, mediaPreview }) {
  if (!profile?.uid || preferredInterface(location.href) !== "v2") return;
  // Existing controls remain the single write path. Failure leaves V1 usable.
  try {
    const entry = interfaceUrl(location.href, "v2", (globalThis.posts || []).map(post => post.id));
    if (entry !== location.href) history.replaceState(history.state, "", entry);
    const { mountWorkspace } = await import("./workspace-v2.js?v=20261106-v2.31");
    return mountWorkspace({
      profile,
      watchAnnieRequests: onUpdate => watchAnnieRequests({ subscribe: subscribeAnnieRequestSource, onUpdate }),
      getProjectState: (id, opportunity) => (opportunity ? state.opportunities : state.internalProjects)?.get(id),
      loadPhilanthropy: fetchPhilanthropyDashboard,
      loadMembers: fetchPhilanthropyMembers,
      savePhilanthropyStage: async (id, stage) => { await setOpportunityStage(id, stage, profile); return fetchPhilanthropyTrackingState(id); },
      getPosts: () => globalThis.posts || [],
      getOriginalPost: id => state.basePosts.find(post => post.id === id),
      getWorkflow: id => state.workflows.get(id),
      getComments: id => state.commentsByEvent?.get(id) || [],
      getDecision: id => state.decisions.get(id),
      getMedia: () => [...state.mediaByEvent.values()].flat(),
      getMediaDecision: id => state.mediaDecisions.get(id),
      mediaPreview,
      dateIso: item => {
        const date = parsePlanDate(item);
        return date ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}` : "";
      },
      contentApproved: id => ["content_approved", "media_in_progress", "media_review", "media_changes_requested", "final_approved", "scheduled", "published"].includes(state.workflows.get(id)?.stage),
      mediaApproved: id => {
        const choice = state.mediaDecisions.get(id);
        return choice ? ["agreed", "overridden", "direction_approved"].includes(choice.agreement?.status) : ["final_approved", "scheduled", "published"].includes(state.workflows.get(id)?.stage);
      },
      ensurePublication: id => {
        let node = [...document.querySelectorAll(".post[data-item-id]")].find(post => post.dataset.itemId === id);
        if (node) return node;
        const item = (globalThis.posts || []).find(post => post.id === id);
        if (!item || typeof globalThis.card !== "function") return null;
        const container = document.createElement("div"); container.innerHTML = globalThis.card(item);
        node = container.firstElementChild;
        document.querySelector("#posts")?.append(node);
        enhanceCards();
        return node;
      },
      readHistory: fetchPublicationHistoryPage,
      openStudio: profile.role === "admin" ? openPublicationStudio : null
    });
  } catch (error) {
    document.documentElement.removeAttribute("data-workspace");
    document.querySelector("#workspace-v2")?.remove();
    history.replaceState(history.state, "", interfaceUrl(location.href, "classic", (globalThis.posts || []).map(post => post.id)));
    setupInterfaceSwitch(profile);
    toast("La V2 n’a pas pu démarrer; la version classique reste disponible.", true);
    console.warn("Démarrage V2 interrompu", error);
  }
}
