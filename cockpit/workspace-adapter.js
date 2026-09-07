import { parsePlanDate } from "./calendar-export-tools.js?v=20260907-b78";
import { fetchPublicationHistoryPage } from "./firebase-client.js?v=20260907-b78";
import { openPublicationStudio } from "./editor-studio.js?v=20260907-b78";
import { interfaceUrl } from "./workspace-model.mjs";

export function setupInterfaceSwitch(profile) {
  if (!profile?.uid) return;
  const session = document.querySelector("#cockpit-session");
  if (!session) return;
  let link = session.querySelector("#cockpit-interface-switch");
  if (!link) { link = document.createElement("a"); link.id = "cockpit-interface-switch"; session.append(link); }
  const isV2 = new URLSearchParams(location.search).get("interface") === "v2";
  link.textContent = isV2 ? "↔ Version classique" : "↔ Essayer la nouvelle interface";
  link.title = isV2 ? "Revenir à la version classique, avec les mêmes textes, médias, commentaires et validations. Enregistrez vos saisies en cours avant de changer d’interface." : "Ouvrir la nouvelle interface. Vous pourrez revenir ici à tout moment; vos dossiers et vos droits restent les mêmes. Enregistrez vos saisies en cours avant de changer d’interface.";
  const update = () => { link.href = interfaceUrl(location.href, isV2 ? "classic" : "v2", (globalThis.posts || []).map(p => p.id)); };
  update(); link.onpointerenter = update; link.onfocus = update; link.onclick = update;
}

export async function setupWorkspaceV2(profile, { state, enhanceCards, toast, mediaPreview }) {
  if (new URLSearchParams(location.search).get("interface") !== "v2") return;
  // Existing controls remain the single write path. Failure leaves V1 usable.
  try {
    const { mountWorkspace } = await import("./workspace-v2.js?v=20260907-v2.8");
    return mountWorkspace({
      profile,
      getPosts: () => globalThis.posts || [],
      getOriginalPost: id => state.basePosts.find(post => post.id === id),
      getWorkflow: id => state.workflows.get(id),
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
        const item = (globalThis.posts || []).find(post => post.id === id);
        return choice ? ["agreed", "overridden"].includes(choice.agreement?.status) || (choice.direction?.status === "selected" && choice.direction.mediaIds?.length >= (item?.mediaSelectionMode === "multiple" ? 2 : 1)) : ["final_approved", "scheduled", "published"].includes(state.workflows.get(id)?.stage);
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
    toast("La V2 n’a pas pu démarrer; la version classique reste disponible.", true);
    console.warn("Démarrage V2 interrompu", error);
  }
}
