export function buildMediaChoiceModel(hasStructuredChoice, decision, row, latestLegacyDecision = "") {
  const communicationsIds = decision?.communications?.status === "selected" && Array.isArray(decision.communications.mediaIds) ? decision.communications.mediaIds : [];
  const directionIds = decision?.direction?.status === "selected" && Array.isArray(decision.direction.mediaIds) ? decision.direction.mediaIds : [];
  const agreementIds = ["agreed", "overridden"].includes(decision?.agreement?.status) && Array.isArray(decision.agreement.mediaIds) ? decision.agreement.mediaIds : [];
  const legacySelected = !hasStructuredChoice && (row.selectedFinal === true || (!("selectedFinal" in row) && latestLegacyDecision.startsWith(`[MÉDIA RETENU:${row.id}]`)));
  const communicationsSelected = hasStructuredChoice && communicationsIds.includes(row.id);
  const directionSelected = hasStructuredChoice && directionIds.includes(row.id);
  return {
    communicationsSelected, directionSelected,
    agreementSelected: hasStructuredChoice && agreementIds.includes(row.id),
    agreementStatus: hasStructuredChoice ? (decision?.agreement?.status || "pending") : "legacy",
    overrideActorRole: hasStructuredChoice ? (decision?.override?.actorRole || "") : "",
    sameRoleChoice: communicationsSelected && directionSelected,
    divergent: decision?.agreement?.status === "divergent",
    directionFinal: directionSelected,
    legacySelected,
    // La direction garde le dernier mot éditorial. Son choix devient donc le
    // visuel final affiché, sans effacer ni réécrire la recommandation distincte
    // des communications. L'accord structuré reste disponible dans l'historique.
    finalSelected: hasStructuredChoice ? (decision?.agreement?.status === "overridden" ? agreementIds.includes(row.id) : (directionSelected || agreementIds.includes(row.id))) : legacySelected
  };
}

export function mediaImageChoicePresentation(choice, role, myChoiceSelected) {
  if (myChoiceSelected) return { label: "✓ Mon choix — retirer", className: choice.agreementSelected || choice.sameRoleChoice ? " is-agreed" : " is-selected" };
  if (choice.agreementSelected) return { label: "✓ Visuel retenu", className: " is-agreed" };
  if (choice.sameRoleChoice) return { label: "✓ Choix commun", className: " is-agreed" };
  if (choice.directionSelected && choice.finalSelected && role === "admin") return { label: "✓ Retenu par la direction", className: " is-agreed" };
  if (role === "director" && choice.communicationsSelected) return { label: "Recommandé · choisir ce visuel", className: " is-role-choice" };
  return { label: "Choisir ce visuel", className: "" };
}

// Preserve unsent words and focus across real-time gallery replacement.
export function captureMediaDrafts(gallery) {
  return [...gallery.querySelectorAll('[data-media-comment]')].map(input => ({
    id: input.dataset.mediaComment, value: input.value, dictated: input.dataset.dictated,
    focused: input === input.ownerDocument.activeElement,
    start: input.selectionStart, end: input.selectionEnd,
    sending: input.closest('.cockpit-media-comment')?.querySelector('[data-save-media-comment]')?.disabled === true
  }));
}

export function restoreMediaDrafts(gallery, drafts) {
  for (const input of gallery.querySelectorAll('[data-media-comment]')) {
    const draft = drafts.find(item => item.id === input.dataset.mediaComment);
    if (!draft) continue;
    input.value = draft.value;
    if (draft.dictated) input.dataset.dictated = draft.dictated;
    const button = input.closest('.cockpit-media-comment')?.querySelector('[data-save-media-comment]');
    if (button) button.disabled = draft.sending;
    if (draft.focused) { input.focus({ preventScroll: true }); try { input.setSelectionRange(draft.start, draft.end); } catch {} }
  }
}

export function mediaAgreementPresentation(choice) {
  if (choice.agreementStatus !== "overridden") return { info: "✓ Accord final", badge: "✓ Accord communications + direction · décision finale" };
  const actor = choice.overrideActorRole === "admin"
    ? "les communications"
    : choice.overrideActorRole === "director" ? "la direction" : "override motivé";
  return { info: "✓ Décision finale par override", badge: `✓ Décision finale par ${actor}${actor === "override motivé" ? "" : " · motif consigné"}` };
}

export function mediaRightsNeedsConfirmation(row) {
  if (!row || row.archived === true) return false;
  if (Object.prototype.hasOwnProperty.call(row, "rightsConfirmed")) return true;
  const status = String(row.rightsStatus || "").toLocaleLowerCase("fr-CA");
  return status.includes("à confirmer")
    || status.includes("a confirmer")
    || status.includes("unconfirmed")
    || status.includes("incertain");
}

export function mediaSelectionBlocked(row) {
  return row?.archived === true || (row?.publicationBlocked === true && !mediaRightsNeedsConfirmation(row));
}

export function synchronizeMediaInfoPanels(gallery) {
  const panels = [...gallery.querySelectorAll("details.cockpit-media-info")];
  let synchronizing = false;
  panels.forEach((panel) => panel.addEventListener("toggle", () => {
    if (synchronizing) return;
    synchronizing = true;
    panels.forEach((peer) => { if (peer !== panel) peer.open = panel.open; });
    queueMicrotask(() => { synchronizing = false; });
  }));
}
