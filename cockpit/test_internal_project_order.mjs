import assert from "node:assert/strict";
import fs from "node:fs";
import { parseHTML } from "linkedom";
import { internalProjectUrgencyOrder, setInternalProjectArchiveVisibility, sortInternalProjectsByUrgency } from "./internal-project-order.js";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const ui = fs.readFileSync(new URL("./cockpit-ui.js", import.meta.url), "utf8");
const projectIds = [...page.matchAll(/<details class="internal-project(?:\s[^"]*)?"[^>]*data-internal-project-id="([^"]+)"/g)]
  .map((match) => match[1]);
const renderedByRole = new Map(["director", "admin"].map((role) => {
  const { document } = parseHTML(page);
  document.body.className = role === "admin" ? "cockpit-admin" : "cockpit-director";
  return [role, { document, order: sortInternalProjectsByUrgency(document) }];
}));
const { document, order: renderedOrder } = renderedByRole.get("director");
const applicationProject = document.querySelector('[data-internal-project-id="application-carte-vivante-lac"]');
const ecoActionOpportunity = document.querySelector('[data-opportunity-id="ecoaction-freshwater"]');

assert.equal(new Set(internalProjectUrgencyOrder).size, internalProjectUrgencyOrder.length, "Le classement ne doit contenir aucun doublon.");
assert.deepEqual(new Set(internalProjectUrgencyOrder), new Set(projectIds), "Chaque projet existant doit être classé une seule fois.");
assert.deepEqual(renderedOrder, internalProjectUrgencyOrder, "Le DOM doit suivre exactement le classement déclaré.");
assert.deepEqual(renderedByRole.get("admin").order, internalProjectUrgencyOrder, "Les communications doivent voir le même portefeuille priorisé.");
assert.equal(renderedOrder[0], "nettoyage-berges-2026", "Le nettoyage des berges de septembre doit devenir la première priorité active.");
assert.equal(renderedOrder.at(-3), "lamproie-du-nord", "Lamproie du Nord doit rester près du bas de la liste active.");
assert.equal(renderedOrder.at(-2), "poesie-du-lac", "Au bord du bleu doit rester conservé juste avant les autres archives.");
assert.equal(renderedOrder.at(-1), "jeux-provinciaux-peche", "Le dossier clos doit demeurer en dernière position.");
assert.ok(renderedOrder.indexOf("bilan-sante-lac") < renderedOrder.indexOf("application-carte-vivante-lac"), "Le travail terrain actif doit précéder le cadrage sans échéance.");
assert.ok(renderedOrder.indexOf("application-carte-vivante-lac") < renderedOrder.indexOf("jardins-pluie-2027"), "La maquette d’application déjà engagée doit précéder le nouveau cadrage Jardin de pluie.");
assert.ok(renderedOrder.indexOf("jardins-pluie-2027") < renderedOrder.indexOf("surveillance-cyanobacteries"), "La proposition municipale V7 doit rester visible dans le premier groupe de travail.");
assert.ok(renderedOrder.indexOf("concours-dessin-jeunesse") < renderedOrder.indexOf("lamproie-du-nord"), "Les deux dossiers 2027 doivent rester regroupés près du bas.");
assert.ok(ui.indexOf("sortInternalProjectsByUrgency();") < ui.indexOf("decorateInternalProjectDocuments();"), "Le classement doit être appliqué avant les interactions des fiches.");
assert.equal(document.querySelector(".project-portfolio-links a:nth-of-type(3)")?.getAttribute("href"), "#internal-project-nettoyage-berges-2026", "Le raccourci prioritaire doit mener vers le nettoyage des berges.");
assert.equal(document.querySelector(".project-portfolio-links a:nth-of-type(3) small")?.textContent, "North Hatley et Ayer’s Cliff · coordination en cours", "Le raccourci prioritaire doit afficher le projet actif de septembre.");
assert.equal(document.querySelector("[data-internal-project-register]")?.dataset.layoutVersion, "2026-09-01-archives-v1", "La correction des archives doit être signalée comme une nouveauté de mise en page.");
assert.equal(document.querySelector('[data-internal-project-id="poesie-du-lac"]')?.dataset.initialStage, "completed", "Au bord du bleu doit être archivé même sans Firestore.");
const archiveClosed = setInternalProjectArchiveVisibility(document, false);
assert.deepEqual(archiveClosed, { active: false, archived: 2 }, "Les deux projets terminés doivent être comptés dans les archives.");
assert.equal(document.querySelector("[data-toggle-internal-project-archives]")?.textContent, "Voir les archives (2)", "Le libellé fermé doit conserver son compteur et ses parenthèses.");
const archiveOpened = setInternalProjectArchiveVisibility(document, true);
assert.deepEqual(archiveOpened, { active: true, archived: 2 }, "L’ouverture doit conserver le nombre d’archives.");
assert.equal(document.querySelector("[data-toggle-internal-project-archives]")?.textContent, "Masquer les archives (2)", "Le libellé ouvert ne doit plus perdre sa parenthèse.");
assert.equal(document.querySelector("[data-internal-project-archive-summary]")?.hidden, false, "Un résumé visible doit confirmer que les archives sont ouvertes.");
assert.match(document.querySelector("[data-internal-project-archive-summary]")?.textContent || "", /2 projets archivés affichés en premier/);
assert.equal(applicationProject?.dataset.initialStage, "to_frame", "Le cahier annoncé ne doit pas transformer le cadrage en production active ou terminée.");
assert.equal(applicationProject?.dataset.waitingSource, "functional-spec-pending", "Le dossier doit rester explicitement en attente du cahier des charges annoncé.");
assert.match(applicationProject?.textContent || "", /Décision de préqualification/);
assert.match(applicationProject?.textContent || "", /Aucun fichier ni contenu correspondant n’a été reçu/);
assert.match(applicationProject?.textContent || "", /aucune validation, approbation ou action de production n’est déduite/);
assert.match(applicationProject?.textContent || "", /ÉcoAction volet 2/);
assert.match(applicationProject?.textContent || "", /23 septembre 2026 à 15 h/);
assert.match(applicationProject?.textContent || "", /25 000 \$ à 200 000 \$/);
assert.match(applicationProject?.textContent || "", /contrepartie non fédérale minimale de 50 %/);
assert.match(applicationProject?.textContent || "", /aucune demande, production, dépense ou promesse de partenariat n’est autorisée/);
assert.equal(
  applicationProject?.querySelector('[href="./project-documents/Note_decision_EcoAction_carte_vivante_2026-09-02.md"]')?.textContent,
  "Ouvrir la note ÉcoAction ↗",
  "La note de préqualification datée doit rester accessible depuis le projet."
);
assert.equal(
  applicationProject?.querySelector('[href="./project-documents/Cadrage_application_Massawippi_en_partage_2026-08-17.md"]')?.textContent,
  "Ouvrir le cadrage consolidé ↗",
  "Le cadrage consolidé doit utiliser la copie livrée avec le cockpit plutôt qu’un lien SharePoint 404."
);
assert.equal(
  applicationProject?.querySelector('[href="./project-documents/Inventaire_courriels_Annie_application_2026-09-02.md"]')?.textContent,
  "Ouvrir l’inventaire des courriels ↗",
  "L’inventaire daté des courriels d’Annie doit rester accessible depuis le projet."
);
assert.match(ecoActionOpportunity?.textContent || "", /23 SEPTEMBRE · 15 H/);
assert.match(ecoActionOpportunity?.textContent || "", /25 000 \$ à 200 000 \$/);
assert.match(ecoActionOpportunity?.textContent || "", /nouveau pilote 2027/);
assert.doesNotMatch(ecoActionOpportunity?.textContent || "", /RONDE ACTUELLE FERMÉE|25 000 \$ à 100 000 \$/);
assert.doesNotMatch(applicationProject?.innerHTML || "", /Application%20Massawippi%20en%20partage.*Cadrage_application_Massawippi/);
assert.equal(
  ecoActionOpportunity?.querySelector('a[href*="programme-communautaire-ecoaction/volet2.html"]')?.textContent,
  "Appel officiel — volet 2 ↗",
  "Le registre des occasions doit pointer vers l’appel 2027 actuellement ouvert."
);

console.log("✓ projets internes classés par urgence, sans perte de fiche");
