import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const client = fs.readFileSync(new URL("./firebase-client.js", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("./cockpit-ui.js", import.meta.url), "utf8");
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

assert.match(client, /const sideName = profile\.role === "admin" \? "communications" : "direction"/);
assert.match(client, /profile\.role === "director" && selected && !textApproved/);
assert.match(client, /publicationBlocked === true \|\| media\.archived === true/);
assert.match(client, /setMediaDecision[\s\S]*?runTransaction\(db[\s\S]*?transaction\.set\(archiveReference/);
assert.match(client, /archiveReference = doc\(db, "changeArchive"/);
assert.match(client, /sameExistingChoice[\s\S]*?return before/);
assert.match(client, /wantsOverride && profile\.role !== "director"/);
assert.match(client, /override: profile\.role === "admin"[\s\S]*?before\.override/,
  "Les communications doivent préserver un override de la direction.");
assert.match(client, /stage === "final_approved" && !\(profile\.role === "admin" && \["scheduled", "published"\]\.includes\(before\.stage\)\)/);
assert.match(client, /subscribeMediaDecisions[\s\S]*?limit\(80\)/);
assert.doesNotMatch(client + ui, /alt-20260715|nature-alt-20260715-libellule/, "Le code générique ne doit pas fabriquer une approbation spéciale pour la libellule.");

assert.match(ui, /hasStructuredDecision \? agreementIds\.includes\(row\.id\) : legacySelected/);
assert.match(ui, /Recommandé par les communications/);
assert.match(ui, /Choisi par la direction générale/);
assert.match(ui, /Accord communications \+ direction/);
assert.match(ui, /state\.profile\?\.role === "admin"\)/, "La porte Terminer doit être autorisée seulement aux communications.");
assert.doesNotMatch(ui, /data-select-final-media=/, "Le contrôle global hérité ne doit plus être rendu par le nouveau client.");
assert.match(ui, /Votre session demeure connectée/);
assert.doesNotMatch(ui.slice(ui.indexOf("observeAuth")), /applyProfile\(profile\)[\s\S]{0,300}logOut\(/, "Une panne de données après authentification ne doit pas fermer la session.");

assert.match(rules, /data\.stage in \['source', 'proposal', 'draft', 'approved', 'published', 'reference'\]/, "proposal doit être un stade valide distinct d’approved.");
assert.match(rules, /match \/mediaDecisions\/\{eventId\}/);
assert.match(rules, /isAdmin\(\)[\s\S]*?affectedKeys\(\)\.hasOnly\(\['communications'/);
assert.match(rules, /request\.resource\.data\.override == resource\.data\.override/,
  "Une mutation des communications doit conserver exactement l’override de la direction.");
assert.match(rules, /isDirector\(\)[\s\S]*?affectedKeys\(\)\.hasOnly\(\['direction'/);
assert.match(rules, /publicationBlocked[\s\S]*?== false/);
assert.match(rules, /request\.resource\.data\.stage in \['scheduled', 'published'\][\s\S]*?isAdmin\(\)/, "Terminer doit être réservé aux communications dans les règles.");
assert.match(rules, /function validMediaDecision\(data\)[\s\S]*validMediaAgreement\(data\)[\s\S]*mediaWorkflowMatchesAgreement\(data\)/,
  "Toute décision média doit imposer le même état dérivé dans workflowStates au sein de la mutation atomique.");
assert.match(rules, /match \/mediaDecisions\/\{eventId\}[\s\S]*allow update: if isEditor\(\)[\s\S]*validMediaDecisionEnvelope\(request\.resource\.data\)[\s\S]*mediaWorkflowMatchesAgreement\(request\.resource\.data\)/,
  "Les mises à jour par les deux rôles doivent aussi imposer l’atomicité décision-workflow.");
assert.doesNotMatch(rules, /allow delete: if true/);

console.log("Contrat média par rôle : OK (accord, divergence, réversibilité, héritage, rôles et blocage). ");
