import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const client = fs.readFileSync(new URL("./firebase-client.js", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("./cockpit-ui.js", import.meta.url), "utf8");
const mediaUi = fs.readFileSync(new URL("./media-choice-ui.js", import.meta.url), "utf8");
const rules = fs.readFileSync(new URL("./firestore.rules", import.meta.url), "utf8");

const pureStart = client.indexOf("function sameOrderedMedia");
const pureEnd = client.indexOf("\nfunction normalizeMediaDecision", pureStart);
assert.ok(pureStart >= 0 && pureEnd > pureStart, "Le dérivé d’accord doit rester isolable et testable sans Firebase.");
const sandbox = {};
vm.runInNewContext(
  `${client.slice(pureStart, pureEnd).replace("export function deriveMediaAgreement", "function deriveMediaAgreement")}\nthis.deriveMediaAgreement = deriveMediaAgreement;`,
  sandbox
);

const selected = (id, role) => ({ status: "selected", mediaIds: [id], actorRole: role });
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
assert.equal(sandbox.deriveMediaAgreement(selected("media-a", "admin"), selected("media-b", "director"), { active: true, mediaIds: ["media-b"], reason: "Aval confirmé" }, true).status, "overridden");
assert.equal(sandbox.deriveMediaAgreement(selected("media-a", "admin"), revoked("director"), { active: true, mediaIds: ["media-a"], reason: "Décision communications" }, true).status, "overridden", "Les communications doivent pouvoir finaliser un visuel sans fabriquer un choix de la direction.");

assert.match(client, /const sideName = profile\.role === "admin" \? "communications" : "direction"/);
assert.doesNotMatch(client, /profile\.role === "director" && selected && !textApproved/,
  "La direction doit pouvoir indiquer son choix visuel avant l’approbation du texte.");
assert.match(client, /publicationBlocked === true \|\| media\.archived === true/);
assert.match(client, /setMediaDecision[\s\S]*?runTransaction\(db[\s\S]*?transaction\.set\(archiveReference/);
assert.match(client, /archiveReference = doc\(db, "changeArchive"/);
assert.match(client, /sameExistingChoice[\s\S]*?return before/);
assert.match(client, /wantsOverride && !\["director", "admin"\]\.includes\(profile\.role\)/,
  "Les deux rôles de coordination peuvent appliquer un override motivé.");
assert.match(client, /override: profile\.role === "admin"[\s\S]*?before\.override/,
  "Les communications doivent préserver un override de la direction.");
assert.match(client, /stage === "final_approved" && !\(profile\.role === "admin" && \["scheduled", "published"\]\.includes\(before\.stage\)\)/);
assert.match(client, /adminOverrideApprovesText[\s\S]{0,260}effectiveTextApproved/,
  "Les communications doivent pouvoir valider en une transaction le texte et le visuel avec un motif explicite.");
assert.match(client, /subscribeMediaDecisions[\s\S]*?limit\(80\)/);
assert.doesNotMatch(client + ui, /alt-20260715|nature-alt-20260715-libellule/, "Le code générique ne doit pas fabriquer une approbation spéciale pour la libellule.");

assert.match(mediaUi, /hasStructuredChoice \? agreementIds\.includes\(row\.id\) : legacySelected/);
assert.match(ui, /Recommandé par les communications/);
assert.match(ui, /Choisi par la direction générale/);
assert.match(ui, /directionMediaReady/);
assert.match(ui, /const publicationReady = contentDone && mediaDone/,
  "Un choix visuel anticipé ne doit jamais suffire à autoriser la publication sans le texte.");
assert.match(ui, /Accord communications \+ direction/);
assert.match(ui, /cockpit-media-image-choice/, "Le choix média doit aussi être accessible directement sur l’image.");
assert.match(ui, /details class="cockpit-media-info" open/, "Les actions média doivent être ouvertes par défaut.");
assert.match(mediaUi, /synchronizeMediaInfoPanels/, "Les panneaux média d’un même événement doivent rester synchronisés.");
assert.match(ui, /state\.profile\?\.role === "admin"\)/, "La porte Terminer doit être autorisée seulement aux communications.");
assert.doesNotMatch(ui, /data-select-final-media=/, "Le contrôle global hérité ne doit plus être rendu par le nouveau client.");
assert.match(ui, /Votre session demeure connectée/);
assert.doesNotMatch(ui.slice(ui.indexOf("observeAuth")), /applyProfile\(profile\)[\s\S]{0,300}logOut\(/, "Une panne de données après authentification ne doit pas fermer la session.");

assert.match(rules, /data\.stage in \['source', 'proposal', 'draft', 'approved', 'published', 'reference'\]/, "proposal doit être un stade valide distinct d’approved.");
assert.match(rules, /match \/mediaDecisions\/\{eventId\}/);
assert.match(rules, /isAdmin\(\)[\s\S]*?affectedKeys\(\)\.hasOnly\(\['communications'/);
assert.match(rules, /request\.resource\.data\.override == resource\.data\.override[\s\S]*request\.resource\.data\.override\.actorRole == 'admin'/,
  "Les communications peuvent appliquer un override motivé sans modifier le choix de la direction.");
assert.match(rules, /isDirector\(\)[\s\S]*?affectedKeys\(\)\.hasOnly\(\['direction'/);
assert.match(rules, /data\.override\.actorRole == 'admin'[\s\S]{0,220}data\.override\.mediaIds == data\.communications\.mediaIds/,
  "Un override des communications doit s’appuyer sur son propre choix, jamais usurper celui de la direction.");
assert.doesNotMatch(rules, /request\.resource\.data\.direction\.status != 'selected' \|\| workflowTextApproved/,
  "La règle doit accepter une préférence direction avant la porte texte.");
assert.match(rules, /publicationBlocked[\s\S]*?== false/);
assert.match(rules, /request\.resource\.data\.stage in \['scheduled', 'published'\][\s\S]*?isAdmin\(\)/, "Terminer doit être réservé aux communications dans les règles.");
assert.match(rules, /function validMediaDecision\(data\)[\s\S]*validMediaAgreement\(data\)[\s\S]*mediaWorkflowMatchesAgreement\(data\)/,
  "Toute décision média doit imposer le même état dérivé dans workflowStates au sein de la mutation atomique.");
assert.match(rules, /match \/mediaDecisions\/\{eventId\}[\s\S]*allow update: if isEditor\(\)[\s\S]*validMediaDecisionEnvelope\(request\.resource\.data\)[\s\S]*mediaWorkflowMatchesAgreement\(request\.resource\.data\)/,
  "Les mises à jour par les deux rôles doivent aussi imposer l’atomicité décision-workflow.");
assert.doesNotMatch(rules, /allow delete: if true/);

console.log("Contrat média par rôle : OK (accord, divergence, réversibilité, héritage, rôles et blocage). ");
