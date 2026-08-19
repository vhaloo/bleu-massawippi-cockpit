import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const client = fs.readFileSync(new URL("./firebase-client.js", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("./cockpit-ui.js", import.meta.url), "utf8");
const mediaUi = fs.readFileSync(new URL("./media-choice-ui.js", import.meta.url), "utf8");
const rules = fs.readFileSync(new URL("./firestore.rules", import.meta.url), "utf8");
const editorialCycle = fs.readFileSync(new URL("./reconcile_editorial_cycle_20260804.js", import.meta.url), "utf8");

const pureStart = client.indexOf("const MAX_MEDIA_CHOICES");
const pureEnd = client.indexOf("\nfunction normalizeMediaDecision", pureStart);
assert.ok(pureStart >= 0 && pureEnd > pureStart, "Le dérivé d’accord doit rester isolable et testable sans Firebase.");
const sandbox = {};
vm.runInNewContext(
  `${client.slice(pureStart, pureEnd).replace("export function deriveMediaAgreement", "function deriveMediaAgreement")}\nthis.deriveMediaAgreement = deriveMediaAgreement; this.nextMediaSelection = nextMediaSelection;`,
  sandbox
);

const selected = (id, role) => ({ status: "selected", mediaIds: [id], actorRole: role });
const selectedSet = (ids, role) => ({ status: "selected", mediaIds: ids, actorRole: role });
const revoked = (role) => ({ status: "revoked", mediaIds: [], actorRole: role });
const noOverride = { active: false, mediaIds: [], reason: "" };

assert.equal(sandbox.deriveMediaAgreement(selected("media-a", "admin"), revoked("director"), noOverride, true).status, "pending");
assert.equal(sandbox.deriveMediaAgreement(revoked("admin"), selected("media-a", "director"), noOverride, true).status, "pending");
assert.equal(sandbox.deriveMediaAgreement(selected("media-a", "admin"), selected("media-a", "director"), noOverride, false).status, "pending", "Un même choix ne signe rien avant le texte.");
assert.equal(
  JSON.stringify(sandbox.deriveMediaAgreement(selected("media-a", "admin"), selected("media-a", "director"), noOverride, true)),
  JSON.stringify({ status: "agreed", mediaIds: ["media-a"], divergent: false })
);
assert.equal(sandbox.deriveMediaAgreement(selected("media-a", "admin"), selected("media-b", "director"), noOverride, true).status, "divergent");
assert.equal(JSON.stringify(sandbox.nextMediaSelection(["media-a"], "media-b", true, true)), JSON.stringify(["media-a", "media-b"]));
assert.equal(JSON.stringify(sandbox.nextMediaSelection(["media-a", "media-b"], "media-a", false, true)), JSON.stringify(["media-b"]));
assert.equal(JSON.stringify(sandbox.nextMediaSelection(["media-a"], "media-b", true, false)), JSON.stringify(["media-b"]),
  "Le comportement historique doit continuer de remplacer un choix simple.");
assert.equal(
  JSON.stringify(sandbox.deriveMediaAgreement(selectedSet(["media-b", "media-a"], "admin"), selectedSet(["media-a", "media-b"], "director"), noOverride, true)),
  JSON.stringify({ status: "agreed", mediaIds: ["media-a", "media-b"], divergent: false }),
  "Le même carrousel doit produire un accord même si les cartes ont été cochées dans un ordre différent."
);
assert.equal(sandbox.deriveMediaAgreement(selected("media-a", "admin"), selected("media-b", "director"), { active: true, mediaIds: ["media-b"], reason: "Aval confirmé" }, true).status, "overridden");
assert.equal(sandbox.deriveMediaAgreement(selected("media-a", "admin"), revoked("director"), { active: true, mediaIds: ["media-a"], reason: "Décision communications" }, true).status, "overridden", "Les communications doivent pouvoir finaliser un visuel sans fabriquer un choix de la direction.");

assert.match(client, /const sideName = profile\.role === "admin" \? "communications" : "direction"/);
assert.doesNotMatch(client, /profile\.role === "director" && selected && !textApproved/,
  "La direction doit pouvoir indiquer son choix visuel avant l’approbation du texte.");
assert.match(client, /publicationBlocked === true \|\| media\.archived === true/);
assert.match(client, /setMediaDecision[\s\S]*?runTransaction\(db[\s\S]*?transaction\.set\(archiveReference/);
assert.match(client, /archiveReference = doc\(db, "changeArchive"/);
assert.match(client, /sameExistingChoice[\s\S]*?return before/);
assert.match(client, /const allowsMultiple = options\.multiple === true/,
  "La mutation média doit explicitement distinguer un choix simple d’un carrousel.");
assert.match(client, /nextMediaSelection\(previousSideIds, mediaId, selected, allowsMultiple\)/,
  "Un carrousel doit ajouter ou retirer une carte sans effacer les autres cartes choisies.");
assert.match(client, /wantsOverride && !\["director", "admin"\]\.includes\(profile\.role\)/,
  "Les deux rôles de coordination peuvent appliquer un override motivé.");
assert.match(client, /override: profile\.role === "admin"[\s\S]*?before\.override/,
  "Les communications doivent préserver un override de la direction.");
assert.match(client, /stage === "final_approved" && !\(profile\.role === "admin" && \["scheduled", "published"\]\.includes\(before\.stage\)\)/);
assert.match(client, /setWorkflowStage[\s\S]*?runTransaction\(db[\s\S]*?transaction\.get\(mediaReference\)/,
  "Une réouverture du texte doit mettre à jour le cycle et la décision média dans la même transaction.");
assert.match(client, /setWorkflowStage[\s\S]*?deriveMediaAgreement\(mediaBefore\.communications, mediaBefore\.direction, mediaBefore\.override, textApproved\)/,
  "Le feu visuel doit être recalculé quand le texte est approuvé ou rouvert.");
assert.match(client, /stage === "content_approved" && \["agreed", "overridden"\]\.includes\(agreement\.status\)[\s\S]{0,80}nextStage = "final_approved"/,
  "Après une nouvelle approbation du texte, un accord média conservé doit redevenir final sans double manipulation.");
assert.match(client, /adminOverrideApprovesText[\s\S]{0,260}effectiveTextApproved/,
  "Les communications doivent pouvoir valider en une transaction le texte et le visuel avec un motif explicite.");
assert.match(client, /subscribeMediaDecisions[\s\S]*?limit\(80\)/);
assert.doesNotMatch(client + ui, /alt-20260715|nature-alt-20260715-libellule/, "Le code générique ne doit pas fabriquer une approbation spéciale pour la libellule.");

assert.match(mediaUi, /hasStructuredChoice \? \(directionSelected \|\| agreementIds\.includes\(row\.id\)\) : legacySelected/,
  "Le choix de la direction doit être présenté comme le visuel final sans effacer le choix des communications.");
assert.match(ui, /Recommandé par les communications/);
assert.match(ui, /Choisi par la direction générale/);
assert.match(ui, /Préférence des communications différente · décision de la direction retenue/);
assert.doesNotMatch(ui, /Choix différents — harmonisation requise/);
assert.match(ui, /directionMediaReady/);
assert.match(ui, /const publicationReady = contentDone && mediaDone/,
  "Un choix visuel anticipé ne doit jamais suffire à autoriser la publication sans le texte.");
assert.match(mediaUi, /Accord communications \+ direction/);
assert.match(mediaUi, /Décision finale par \$\{actor\}/,
  "Un override des communications ne doit jamais être présenté comme un accord de la direction.");
assert.match(ui, /Validé par override motivé/);
assert.doesNotMatch(ui, /Validé avec aval/,
  "Le libellé générique ne doit pas inventer un aval externe non structuré.");
assert.match(ui, /cockpit-media-image-choice/, "Le choix média doit aussi être accessible directement sur l’image.");
assert.match(mediaUi, /export function mediaRightsNeedsConfirmation/,
  "La visibilité du contrôle de droits doit reposer sur un modèle testable.");
assert.match(mediaUi, /hasOwnProperty\.call\(row, "rightsConfirmed"\)/,
  "Un média déjà confirmé doit garder un contrôle réversible.");
assert.match(ui, /data-media-rights-confirmation/,
  "Un média aux droits incertains doit offrir un contrôle explicite près de ses actions.");
assert.match(ui, /Cochez seulement après avoir vérifié la source, le crédit et les autorisations nécessaires/,
  "Le contrôle ne doit jamais présenter la confirmation des droits comme automatique.");
assert.match(client, /export async function setMediaRightsConfirmation[\s\S]*?runTransaction\(db/,
  "La confirmation des droits doit être atomique et réversible.");
assert.match(client, /Retirez d’abord ce média des choix actifs/,
  "La remise en attente des droits ne doit pas laisser un choix média incohérent.");
assert.match(ui, /myChoiceSelected \? "Retirer mon choix" : "Choisir ce visuel"/,
  "Les communications doivent pouvoir retirer puis reprendre leur propre choix média.");
assert.match(ui, /const canOverride = !isBlocked[\s\S]{0,180}role === "admin"/,
  "Valentin doit voir l’override motivé sur tout média diffusable, même avant son premier choix.");
assert.match(ui, /Forcer ce visuel et le texte/,
  "L’action de forçage doit être nommée explicitement dans la vue des communications.");
assert.match(ui, /const canOverride = !isBlocked/,
  "Une référence bloquée ne doit jamais devenir forçable par le changement d’interface.");
assert.match(ui, /const selected = mediaDecisionButton\.getAttribute\("aria-pressed"\) !== "true"/,
  "Le même contrôle média doit alterner choix et retrait sans suppression d’historique.");
assert.match(ui, /mediaSelectionMode === "multiple"/,
  "Le mode carrousel doit rester limité aux publications qui le demandent explicitement.");
assert.match(ui, /Ajouter cette carte au carrousel/,
  "Le libellé du geste multiple doit être clair pour une personne non technique.");
assert.match(ui, /details class="cockpit-media-info" open/, "Les actions média doivent être ouvertes par défaut.");
assert.match(mediaUi, /synchronizeMediaInfoPanels/, "Les panneaux média d’un même événement doivent rester synchronisés.");
assert.match(ui, /state\.profile\?\.role === "admin"\)/, "La porte Terminer doit être autorisée seulement aux communications.");
assert.match(ui, /configureGate\(contentGate, contentDone, true, "content_approved", "content_review", "Texte"/,
  "Le feu texte doit pouvoir être coché puis décoché vers la révision.");
assert.match(ui, /configureGate\(publicationGate, publicationDone, publicationReady, "published", "final_approved", "Terminé", state\.profile\?\.role === "admin"\)/,
  "Les communications doivent pouvoir terminer puis rouvrir une publication.");
assert.match(ui, /"media_in_progress","media_review","media_changes_requested"/,
  "Le feu texte doit rester vert pendant toutes les étapes média postérieures à son approbation.");
assert.match(client, /workflowStage === "final_approved"[\s\S]{0,90}nextWorkflowStage = "media_review"/,
  "Retirer un accord média final doit rouvrir l’étape visuelle.");
assert.match(client, /\["scheduled", "published"\]\.includes\(workflowStage\)[\s\S]{0,220}profile\.role !== "admin"[\s\S]{0,220}nextWorkflowStage = "media_changes_requested"/,
  "Les communications doivent pouvoir rouvrir un visuel après programmation tout en conservant l’historique.");
assert.doesNotMatch(ui, /data-select-final-media=/, "Le contrôle global hérité ne doit plus être rendu par le nouveau client.");
assert.match(ui, /Votre session demeure connectée/);
assert.doesNotMatch(ui.slice(ui.indexOf("observeAuth")), /applyProfile\(profile\)[\s\S]{0,300}logOut\(/, "Une panne de données après authentification ne doit pas fermer la session.");

assert.match(rules, /data\.stage in \['source', 'proposal', 'draft', 'approved', 'published', 'reference'\]/, "proposal doit être un stade valide distinct d’approved.");
assert.match(rules, /match \/mediaDecisions\/\{eventId\}/);
assert.match(rules, /function validAdminMediaDecisionUpdate[\s\S]*?affectedKeys\(\)\.hasOnly\(\['communications'/);
assert.match(rules, /data\.override == before\.override[\s\S]*data\.override\.actorRole == 'admin'/,
  "Les communications peuvent appliquer un override motivé sans modifier le choix de la direction.");
assert.match(rules, /before\.override\.active == false[\s\S]{0,120}data\.override\.active == false/,
  "Un choix des communications doit pouvoir normaliser un ancien override inactif sans toucher à un override actif.");
assert.match(rules, /function validDirectorMediaDecisionUpdate[\s\S]*?affectedKeys\(\)\.hasOnly\(\['direction'/);
assert.match(rules, /data\.override\.actorRole == 'admin'[\s\S]{0,220}data\.override\.mediaIds == data\.communications\.mediaIds/,
  "Un override des communications doit s’appuyer sur son propre choix, jamais usurper celui de la direction.");
assert.doesNotMatch(rules, /request\.resource\.data\.direction\.status != 'selected' \|\| workflowTextApproved/,
  "La règle doit accepter une préférence direction avant la porte texte.");
assert.match(rules, /publicationBlocked[\s\S]*?== false/);
assert.match(rules, /rightsConfirmedAt[\s\S]*rightsConfirmedBy[\s\S]*rightsConfirmedByLabel/,
  "Les règles doivent exiger une trace structurée de la confirmation des droits.");
assert.match(rules, /resource\.data\.rightsStatus is string[\s\S]{0,360}request\.resource\.data\.rightsConfirmed == true[\s\S]{0,120}request\.resource\.data\.publicationBlocked == false/,
  "Le contrôle de droits doit confirmer un média suivi et lever explicitement son blocage.");
assert.doesNotMatch(rules, /resource\.data\.rightsStatus is string[\s\S]{0,160}resource\.data\.publicationBlocked == true/,
  "Un média historique déjà non bloqué doit aussi pouvoir recevoir sa confirmation structurée.");
assert.match(rules, /side\.mediaIds\.size\(\) <= 2/,
  "Les règles doivent borner le carrousel à deux médias.");
assert.match(rules, /side\.mediaIds\.size\(\) < 2 \|\| validSelectableMedia\(eventId, side\.mediaIds\[1\]\)/,
  "Les règles doivent valider chaque carte supplémentaire du carrousel.");
assert.match(rules, /request\.resource\.data\.stage in \['scheduled', 'published'\][\s\S]*?isAdmin\(\)/, "Terminer doit être réservé aux communications dans les règles.");
assert.match(rules, /allow update: if isEditor\(\)[\s\S]{0,420}\(isAdmin\(\)[\s\S]{0,240}resource\.data\.stage in \['scheduled', 'published'\]/,
  "Les règles doivent autoriser les communications à rouvrir un événement terminé.");
assert.match(rules, /function validMediaDecision\(data\)[\s\S]*validMediaAgreement\(data\)[\s\S]*mediaWorkflowMatchesAgreement\(data\)/,
  "Toute décision média doit imposer le même état dérivé dans workflowStates au sein de la mutation atomique.");
assert.match(rules, /match \/mediaDecisions\/\{eventId\}[\s\S]*allow update: if isEditor\(\)[\s\S]*validMediaDecisionEnvelope\(request\.resource\.data\)[\s\S]*mediaWorkflowMatchesAgreement\(request\.resource\.data\)/,
  "Les mises à jour par les deux rôles doivent aussi imposer l’atomicité décision-workflow.");
assert.doesNotMatch(rules, /allow delete: if true/);

assert.match(editorialCycle, /--confirm-editorial-cycle-20260804/,
  "Le cycle éditorial du 4 août doit rester en dry-run sans confirmation explicite.");
assert.match(editorialCycle, /sameVersion[\s\S]*?état modifié depuis le dry-run/,
  "Le cycle éditorial doit refuser d’écraser une interaction arrivée après sa lecture.");
assert.match(editorialCycle, /agreement: \{ status: "pending", mediaIds: \[\], divergent: false \}[\s\S]{0,180}textGateStage: "content_review"/,
  "Les textes Radio-Canada révisés doivent rouvrir la porte texte sans perdre les choix média.");
assert.match(editorialCycle, /Le visuel choisi est conservé; le texte révisé sans URL Meta doit maintenant être relu par la direction/,
  "La file doit expliquer clairement pourquoi une nouvelle validation de texte est demandée.");
assert.doesNotMatch(editorialCycle, /stage:\s*["']published["']/,
  "Le cycle éditorial ne doit jamais marquer une publication comme terminée à la place des communications.");

console.log("Contrat média par rôle : OK (accord, divergence, réversibilité, héritage, rôles et blocage). ");
