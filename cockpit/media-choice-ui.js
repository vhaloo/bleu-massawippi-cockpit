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

const escapeMarkup = value => String(value || '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

// These controls use the same delegated actions as the gallery. No parallel writer.
export function renderMediaValidationPanel(card, {profile, rows = [], decision, textApproved, multiple = false, loading = false}) {
  const host = card.querySelector('.cockpit-workflow');
  if (!host || !['admin', 'director'].includes(profile?.role)) return;
  let panel = host.querySelector('[data-media-validation-panel]');
  if (!panel) {
    panel = card.ownerDocument.createElement('details');
    panel.className = 'cockpit-media-validation';
    panel.dataset.mediaValidationPanel = '';
    panel.open = true;
    host.append(panel);
  }
  const available = rows.filter(row => !mediaSelectionBlocked(row) && row.stage !== 'archived');
  const side = profile.role === 'admin' ? 'communications' : 'direction';
  const selectedIds = decision?.[side]?.status === 'selected' ? decision[side].mediaIds || [] : [];
  const signature = JSON.stringify({profile:profile.role,available:available.map(row=>[row.id,row.label,row.rightsConfirmed,row.rightsStatus]),decision,textApproved,multiple,loading});
  if (panel.dataset.signature === signature) return;
  const previousId = panel.querySelector('select')?.value;
  const previousReason = panel.querySelector('[data-media-override-reason]')?.value || '';
  const focused = panel.contains(card.ownerDocument.activeElement) ? card.ownerDocument.activeElement?.getAttribute('data-media-override-reason') !== null ? 'reason' : 'select' : '';
  panel.dataset.signature = signature;
  const currentId = [previousId, ...selectedIds, ...(decision?.agreement?.mediaIds || []), ...(decision?.communications?.mediaIds || []), available[0]?.id].find(id => available.some(row => row.id === id));
  const sideLabel = name => decision?.[name]?.status === 'selected' ? 'Choix enregistré' : 'En attente';
  panel.innerHTML = `<summary>Choix et validation du visuel</summary><div class="cockpit-media-validation-body"><p class="cockpit-media-role-summary"><span><b>Communications</b> · ${sideLabel('communications')}</span><span><b>Direction</b> · ${sideLabel('direction')}</span></p>${available.length ? `<label>Visuel concerné<select data-media-validation-choice aria-label="Visuel à valider">${available.map(row=>`<option value="${escapeMarkup(row.id)}">${escapeMarkup(row.label || row.id)}</option>`).join('')}</select></label><p data-media-validation-rights class="cockpit-media-note"></p><div class="cockpit-media-validation-buttons"><button type="button" data-media-decision aria-pressed="false"></button><button type="button" data-media-validation-force-open>Forcer la validation du visuel…</button></div><div data-media-validation-force hidden><label>Motif de la décision<input type="text" maxlength="500" data-media-override-reason aria-label="Motif de la validation forcée" placeholder="${profile.role === 'admin' ? 'Précisez l’aval reçu de la direction' : 'Précisez la décision à conserver'}"></label><p class="cockpit-media-note">${profile.role === 'admin' ? 'La décision sera enregistrée à votre nom, avec l’aval indiqué. Le choix d’Annie restera distinct.' : 'Votre décision finale sera conservée avec son motif.'}</p><button type="button" data-media-override>Confirmer la validation forcée</button></div><p data-media-validation-help class="cockpit-media-note"></p>` : `<p role="status">${loading ? 'Chargement des visuels…' : 'Ajoutez un visuel dans la galerie pour le proposer à la validation.'}</p>`}</div>`;
  const select = panel.querySelector('select');
  const refresh = () => {
    const row = available.find(item => item.id === select?.value);
    if (!row) return;
    const selected = selectedIds.includes(row.id);
    const choiceButton = panel.querySelector('[data-media-decision]');
    choiceButton.dataset.mediaDecision = row.id;
    choiceButton.dataset.mediaLabel = row.label || 'Visuel';
    choiceButton.setAttribute('aria-pressed', String(selected));
    choiceButton.textContent = selected ? 'Retirer mon choix' : multiple ? 'Ajouter cette carte au carrousel' : profile.role === 'admin' ? 'Recommander ce visuel' : textApproved ? 'Approuver ce visuel' : 'Choisir ce visuel';
    const overrideButton = panel.querySelector('[data-media-override]');
    overrideButton.dataset.mediaOverride = row.id;
    overrideButton.dataset.mediaLabel = row.label || 'Visuel';
    const count = new Set([...selectedIds, row.id]).size;
    const canForce = textApproved && (!multiple || count >= 2);
    panel.querySelector('[data-media-validation-force-open]').disabled = !canForce;
    overrideButton.disabled = !canForce;
      panel.querySelector('[data-media-validation-help]').textContent = !textApproved ? 'Vous pouvez choisir le visuel maintenant. Validez le texte avant de confirmer la validation finale du visuel.' : multiple && count < 2 ? 'Choisissez deux cartes du carrousel avant de confirmer la validation finale.' : decision?.agreement?.status === 'agreed' && decision.agreement.mediaIds.includes(row.id) ? 'Le visuel est validé par les deux rôles. Vous pouvez modifier votre choix ici.' : decision?.agreement?.status === 'overridden' && decision.agreement.mediaIds.includes(row.id) ? 'La validation forcée est enregistrée avec son motif. Vous pouvez modifier votre décision ici.' : selected && decision?.[profile.role === 'admin' ? 'direction' : 'communications']?.status !== 'selected' ? 'Votre choix est enregistré. L’autre rôle doit encore vérifier le visuel; vous n’avez pas besoin de forcer la validation.' : decision?.agreement?.status === 'divergent' ? 'Les deux rôles ont choisi des visuels différents. Modifiez votre choix ou précisez le motif d’une validation forcée.' : 'Choisissez ce visuel pour enregistrer votre décision. La validation forcée reste disponible si nécessaire.';
    panel.querySelector('[data-media-validation-rights]').textContent = mediaRightsNeedsConfirmation(row) && row.rightsConfirmed !== true ? 'Droits à vérifier · information à confirmer, sans bloquer votre choix.' : row.rightsConfirmed === true ? 'Droits confirmés.' : 'Crédit et informations du média disponibles dans la galerie.';
  };
  if (select) { for (const option of select.options) option.selected = false; [...select.options].find(option=>option.value === currentId).selected = true; select.addEventListener('change', refresh); refresh(); }
  const reason = panel.querySelector('[data-media-override-reason]');
  if (reason) reason.value = previousReason;
  if (previousReason || focused === 'reason') panel.querySelector('[data-media-validation-force]')?.removeAttribute('hidden');
  if (focused) (focused === 'reason' ? reason : select)?.focus({preventScroll:true});
}

export function openMediaValidationPanel(card, mediaId = '', force = false) {
  const panel = card.querySelector('[data-media-validation-panel]');
  if (!panel) return false;
  panel.open = true;
  const select = panel.querySelector('select');
  if (mediaId && select && [...select.options].some(option=>option.value === mediaId)) {
    for (const option of select.options) option.selected = false;
    [...select.options].find(option=>option.value === mediaId).selected = true;
    select.dispatchEvent(new card.ownerDocument.defaultView.Event('change', {bubbles:true}));
  }
  if (force) panel.querySelector('[data-media-validation-force]')?.removeAttribute('hidden');
  panel.scrollIntoView?.({behavior:'smooth',block:'center'});
  (force ? panel.querySelector('[data-media-override-reason]') : select || panel.querySelector('summary'))?.focus({preventScroll:true});
  return true;
}
