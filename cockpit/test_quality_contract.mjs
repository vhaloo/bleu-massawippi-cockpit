import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const exists = (relative) => fs.existsSync(path.join(root, relative));

const files = {
  shell: read("cockpit/index.html"),
  source: read("index.html"),
  ui: read("cockpit/cockpit-ui.js"),
  mediaChoice: read("cockpit/media-choice-ui.js"),
  client: read("cockpit/firebase-client.js"),
  theme: read("cockpit/theme.js"),
  sw: read("cockpit/sw.js"),
  manifest: read("cockpit/manifest.webmanifest"),
  rules: read("cockpit/firestore.rules"),
  indexes: read("cockpit/firestore.indexes.json"),
  adminSync: read("cockpit/admin_sync.js"),
  internalProjectSeed: read("cockpit/seed_internal_project_states.js"),
  editorialMediaManifest: read("cockpit/editorial_media_manifest.json"),
  workflow: read(".github/workflows/deploy-pages.yml"),
  viewMode: exists("cockpit/view-mode.js") ? read("cockpit/view-mode.js") : "",
  viewStyle: exists("cockpit/view-mode.css") ? read("cockpit/view-mode.css") : ""
};
const combined = Object.values(files).join("\n");
const results = [];

function check(severity, id, label, pass, detail = "") {
  results.push({ severity, id, label, pass: Boolean(pass), detail });
}
const critical = (id, label, pass, detail) => check("CRITIQUE", id, label, pass, detail);
const warning = (id, label, pass, detail) => check("AVERTISSEMENT", id, label, pass, detail);
const has = (text, pattern) => pattern instanceof RegExp ? pattern.test(text) : text.includes(pattern);

// Coque publique et dépendances déclarées.
for (const relative of [
  "cockpit/index.html", "cockpit/cockpit-ui.js", "cockpit/action-items-ui.js", "cockpit/firebase-client.js", "cockpit/theme.js",
  "cockpit/sw.js", "cockpit/manifest.webmanifest", "cockpit/icon.svg", "cockpit/firestore.rules"
]) {
  critical("PUB-001", `Fichier public requis : ${relative}`, exists(relative), "Le déploiement ne doit pas produire une coque partielle.");
}

const scriptSources = [...files.shell.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map((match) => match[1].split("?")[0]);
for (const expected of ["./firebase-config.js", "./theme.js", "./cockpit-ui.js"]) {
  critical("PUB-002", `Entrée publique déclarée : ${expected}`, scriptSources.includes(expected), `Scripts trouvés : ${scriptSources.join(", ") || "aucun"}`);
}
for (const source of scriptSources.filter((item) => item.startsWith("./"))) {
  critical("PUB-003", `Script référencé présent : ${source}`, exists(path.posix.join("cockpit", source.slice(2))), "Toute référence HTML locale doit résoudre vers un fichier suivi.");
}

const localImports = [...(files.ui + "\n" + files.mediaChoice + "\n" + files.client + "\n" + files.theme + "\n" + files.viewMode).matchAll(/(?:from\s+|import\s*)["'](\.\/[^"'?]+)(?:\?[^"']*)?["']/g)].map((match) => match[1]);
for (const source of new Set(localImports)) {
  critical("PUB-004", `Module importé présent : ${source}`, exists(path.posix.join("cockpit", source.slice(2))), "Un import cassé provoque un écran vide après connexion.");
}

// Secrets à haute confiance dans tous les fichiers suivis par Git.
let tracked = [];
try {
  tracked = execFileSync("git", ["ls-files", "-z"], { cwd: root }).toString("utf8").split("\0").filter(Boolean);
} catch {
  warning("SEC-000", "Liste des fichiers suivis disponible", false, "Git est indisponible; le scan de secrets est limité.");
}
const textExtensions = new Set([".cjs", ".css", ".html", ".js", ".json", ".md", ".mjs", ".rules", ".svg", ".txt", ".webmanifest", ".yml", ".yaml"]);
const secretPatterns = [
  ["clé privée PEM", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["clé privée de compte de service", /["']private_key["']\s*:\s*["']-----BEGIN/],
  ["jeton OpenAI", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/],
  ["jeton GitHub", /\b(?:ghp|github_pat)_[A-Za-z0-9_]{20,}\b/],
  ["secret client codé en dur", /["']client_secret["']\s*[:=]\s*["'][^"'\s]{12,}["']/i],
  ["mot de passe par défaut interdit", new RegExp(`\\b${["bleu", "2026"].join("")}\\b`, "i")],
  ["clé IA nommée", /(?:GEMINI|OPENAI)_API_KEY\s*[:=]\s*["'][^"']{12,}["']/i]
];
const secretHits = [];
const extraGoogleKeys = [];
for (const relative of tracked) {
  const full = path.join(root, relative);
  if (!textExtensions.has(path.extname(relative).toLowerCase()) || !fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, "utf8");
  for (const [kind, pattern] of secretPatterns) if (pattern.test(text)) secretHits.push(`${relative} (${kind})`);
  if (relative.replaceAll("\\", "/") !== "cockpit/firebase-config.js" && /AIza[0-9A-Za-z_-]{20,}/.test(text)) extraGoogleKeys.push(relative);
}
critical("SEC-001", "Aucun secret privé à haute confiance dans Git", secretHits.length === 0, secretHits.join(", ") || "Aucun motif détecté.");
critical("SEC-002", "Clé Google/Firebase publique limitée au fichier client autorisé", extraGoogleKeys.length === 0, extraGoogleKeys.join(", ") || "Aucune autre clé Google détectée.");
critical("SEC-003", "Le workflow bloque les secrets avant déploiement", has(files.workflow, /PRIVATE KEY|private_key_id/) && has(files.workflow, /GEMINI_API_KEY/) && has(files.workflow, /AIza/), "Le contrôle local complète, mais ne remplace pas, le garde-fou CI.");
critical("SEC-006", "Le job de validation ne possède aucun droit de déploiement", /validate:\s*[\s\S]{0,160}permissions:\s*\n\s*contents:\s*read/.test(files.workflow) && /deploy:\s*[\s\S]{0,260}pages:\s*write[\s\S]{0,100}id-token:\s*write/.test(files.workflow), "Les PR exécutent du code non fusionné avec contents:read seulement.");
critical("SEC-004", "Aucun dossier de secrets référencé par la coque", !/secrets\/|secrets\\|service-account/i.test(files.shell + files.source + files.ui + files.sw), "Le navigateur ne doit connaître aucun chemin d’administration locale.");
critical("SEC-005", "Liens médias externes protégés", has(files.ui, /target="_blank"[^>]*rel="noopener noreferrer"/), "Toute nouvelle fenêtre doit neutraliser window.opener.");

// Permissions et conservation.
critical("RULE-001", "Profils actifs et rôles vérifiés côté Firestore", has(files.rules, /function activeUser\(\)/) && has(files.rules, /function isEditor\(\)/) && has(files.rules, /function isAdmin\(\)/), "Les contrôles d’interface ne sont jamais une autorisation.");
critical("RULE-002", "Suppressions physiques refusées", (files.rules.match(/allow delete:\s*if false/g) || []).length >= 8 && !/allow delete:\s*if (?!false)/.test(files.rules), "Commentaires, tâches, médias et décisions restent récupérables.");
critical("RULE-003", "Archive de changements protégée", has(files.rules, /match \/changeArchive\//) && has(files.client, /appendChangeArchive/), "Les retours arrière reposent sur un historique avant/après.");
critical("RULE-004", "Viewer sans écriture métier", has(files.rules, /userRole\(\) in \['director', 'admin'\]/), "Seuls director et admin sont éditeurs.");
critical("RULE-005", "États des projets internes stricts et non destructifs", has(files.rules, /function validInternalProjectState\(data\)/) && has(files.rules, /match \/internalProjectStates\/\{projectId\}/) && /match \/internalProjectStates\/\{projectId\}[\s\S]{0,360}allow delete:\s*if false/.test(files.rules), "Les étapes doivent être bornées, réservées aux éditeurs et impossibles à supprimer physiquement.");

// Authentification et modes d’affichage.
critical("UX-001", "Connexion accessible et réinitialisation disponibles", has(files.ui, /type="email"/) && has(files.ui, /type="password"/) && has(files.ui, /cockpit-reset-password/) && has(files.ui, /role="alert"/), "Les erreurs doivent rester lisibles sans dépendre d’une couleur.");
critical("UX-002", "Délais réseau bornés", has(files.client, /REQUEST_TIMEOUT_MS/) && has(files.client, /withTimeout/), "Une panne Firebase ne doit pas créer une attente infinie.");
const viewModePresent = /data-(?:view-mode|cockpit-view)|dataset\.(?:viewMode|cockpitView)/i.test(combined);
const viewLabelsPresent = /Vue essentielle|Essentielle/i.test(combined) && /Vue complète|Complète/i.test(combined);
const viewPreferencePresent = /(?:view-mode|mode-vue|vue-mode)/i.test(files.viewMode + files.ui) && /localStorage\.(?:getItem|setItem)/.test(files.viewMode + files.ui);
const viewModuleWired = scriptSources.includes("./view-mode.js") || localImports.includes("./view-mode.js") || /import\(["']\.\/view-mode\.js/.test(files.ui);
critical("UX-003", "Bascule Vue essentielle / Vue complète intégrée", viewModuleWired && viewModePresent && viewLabelsPresent, "Le module doit être chargé par la coque ou cockpit-ui.js; le contrôle change la présentation, jamais les permissions.");
critical("UX-004", "Préférence de vue mémorisée", viewPreferencePresent, "Le choix est mémorisé par profil/appareil et ne perd aucune saisie.");
warning("UX-005", "Vue par défaut pilotée par le rôle", /(?:identity\.)?role\s*===\s*["']director["'][\s\S]{0,100}(?:essential|essentiel)/i.test(files.viewMode + files.ui) && /return\s+["']complete["']/.test(files.viewMode + files.ui), "DG : essentielle; communications : complète.");
critical("UX-006", "File personnelle triée par rôle, échéance et récence",
  /roleDecisionForEvent/.test(files.viewMode)
    && /role === "admin" && latestTask/.test(files.viewMode)
    && /left\.urgency\.rank - right\.urgency\.rank/.test(files.viewMode)
    && /right\.updatedAt - left\.updatedAt/.test(files.viewMode)
    && /media\.latestUpdate > event\.workflowUpdatedAt/.test(files.viewMode),
  "La direction et les communications ne doivent voir que leurs propres actions; un média modifié doit remonter pour nouvelle validation.");

// Accessibilité statique.
critical("A11Y-001", "Langue et viewport définis", /<html\s+lang="fr(?:-CA)?"/i.test(files.shell) && /name="viewport"/i.test(files.shell), "Préserve lecture d’écran et reflow mobile.");
critical("A11Y-002", "Le contenu principal est identifiable", /<main\b[^>]*id="cockpit-content"/i.test(files.shell), "Une seule région principale doit recevoir le contenu.");
critical("A11Y-003", "aria-live ciblé plutôt que sur tout le main", !/<main\b[^>]*aria-live=/i.test(files.shell) && /aria-live="(?:polite|assertive)"|role="(?:status|alert)"/i.test(files.ui + files.source), "Annoncer les statuts brefs, pas chaque rerendu du calendrier.");
warning("A11Y-004", "Lien Aller au contenu présent", /href="#cockpit-content"[^>]*>\s*(?:Aller|Passer) au contenu/i.test(files.shell + files.ui), "Le premier focus doit permettre de sauter navigation et session.");
critical("A11Y-005", "Focus clavier visible", /:focus-visible/.test(files.ui + files.theme + files.source), "Boutons, liens et champs doivent tous avoir un focus perceptible.");
warning("A11Y-006", "Animations réduites selon la préférence système", /prefers-reduced-motion/.test(files.ui + files.theme + files.source), "Neutraliser pulsations et smooth scroll non essentiels.");
critical("A11Y-007", "Dictée accompagnée d’un champ texte et d’un état vocal", has(files.ui, /data-dictate/) && has(files.ui, /aria-label="Dicter un commentaire"/) && has(files.ui, /data-voice-status aria-live="polite"/), "La dictée reste facultative et son état est annoncé.");
critical("A11Y-008", "Contrôles de panneaux exposent aria-expanded", (files.ui.match(/aria-expanded/g) || []).length >= 4, "Les widgets repliables doivent annoncer leur état.");
warning("A11Y-009", "Cibles mobiles essentielles d’au moins 44 px", /@media\s*\(max-width:\s*700px\)[\s\S]*min-height:\s*44px/.test(files.ui + files.theme), "Vérifier également les boutons injectés après connexion.");
critical("A11Y-010", "Dictée disponible dans toutes les zones de commentaire non techniques",
  /data-feedback-message[\s\S]{0,900}aria-label="Dicter une recommandation"/.test(files.ui)
    && /data-internal-project-comment[\s\S]{0,500}aria-label="Dicter un commentaire de projet"/.test(files.ui)
    && /data-media-comment[\s\S]{0,500}aria-label="Dicter un commentaire sur ce média"/.test(files.ui)
    && /name="media-note"[\s\S]{0,500}aria-label="Dicter une note sur le média"/.test(files.ui),
  "Les avis de section, projets internes, commentaires et notes média ont tous un micro; les champs URL, nom de média et recherche restent techniques.");

// Thème et responsive.
critical("VIS-001", "Modes clair/sombre présents et mémorisés", has(files.theme, /data-theme/) && has(files.theme, /bleu-massawippi-theme/) && has(files.theme, /prefers-color-scheme/), "Le mode sombre ne doit pas être un filtre visuel.");
critical("VIS-002", "Breakpoints mobile et tablette présents", /@media\s*\(max-width:\s*700px\)/.test(files.ui + files.theme + files.source) && /@media\s*\(max-width:\s*(?:900|980|1000|1100)px\)/.test(files.ui + files.theme + files.source), "Recette obligatoire à 320, 390, 768 et 1440 px.");
warning("VIS-003", "Protection explicite contre débordement horizontal", /overflow-x:\s*(?:hidden|clip)/.test(files.ui + files.theme + files.source), "Ne jamais masquer un débordement qui rend une commande inaccessible.");
critical("VIS-004", "Bascule de thème compacte dans l’en-tête mobile", /#cockpit-session \.cockpit-theme-toggle\.in-session[^}]*font-size:\s*0/.test(files.theme), "Le libellé du thème ne doit pas déborder sur l’identité de session.");

// PWA et service worker.
critical("PWA-001", "Manifest relié et application standalone", /rel="manifest"/.test(files.shell) && /"display"\s*:\s*"standalone"/.test(files.manifest), "Le nom, le scope, les couleurs et l’icône restent valides.");
critical("PWA-002", "Service worker enregistré avec portée locale", /serviceWorker\.register\("\.\/sw\.js"/.test(files.shell), "GitHub Pages doit conserver le sous-chemin du dépôt.");
critical("PWA-003", "Cycle SW versionné et activation immédiate", /const CACHE\s*=\s*["'][^"']+v\d+/i.test(files.sw) && /skipWaiting\(\)/.test(files.sw) && /clients\.claim\(\)/.test(files.sw), "Incrémenter le cache à chaque modification publique.");
critical("PWA-004", "Anciens caches purgés", /caches\.keys\(\)/.test(files.sw) && /caches\.delete/.test(files.sw), "Évite le mélange de versions de modules.");
critical("PWA-008", "Purge limitée aux caches du cockpit", /CACHE_PREFIX/.test(files.sw) && /key\.startsWith\(CACHE_PREFIX\)/.test(files.sw), "GitHub Pages partage Cache Storage entre les projets d’une même origine.");
critical("PWA-005", "Seules les requêtes GET et même origine sont mises en cache", /request\.method\s*!==\s*["']GET["']/.test(files.sw) && /origin\s*===\s*self\.location\.origin/.test(files.sw), "Ne jamais mettre en cache une écriture Firestore ou une ressource externe privée.");
warning("PWA-006", "Entrées JavaScript essentielles préchargées", ["cockpit-ui.js", "action-items-ui.js", "firebase-client.js", "theme.js"].every((name) => files.sw.includes(name)), "Le réseau-d’abord peut les ajouter à l’usage, mais une PWA fraîche hors ligne doit être prévisible.");
warning("PWA-007", "Repli index réservé aux navigations", /request\.mode\s*===\s*["']navigate["']|destination\s*===\s*["']document["']/.test(files.sw), "Un module JS manquant ne doit jamais recevoir du HTML en guise de réponse.");

// Performance et contrats métier structurants.
const uiBytes = Buffer.byteLength(files.ui);
const sourceBytes = Buffer.byteLength(files.source);
critical("PERF-001", "Module UI sous 200 Kio", uiBytes < 200 * 1024, `${Math.round(uiBytes / 1024)} Kio détectés.`);
warning("PERF-002", "Module UI sous le seuil de vigilance de 120 Kio", uiBytes < 120 * 1024, `${Math.round(uiBytes / 1024)} Kio; poursuivre le découpage modulaire sans réécriture globale.`);
warning("PERF-003", "Source privée initiale sous 180 Kio", sourceBytes < 180 * 1024, `${Math.round(sourceBytes / 1024)} Kio détectés.`);
critical("PERF-004", "Requêtes collaboratives bornées", /limit\(\d+\)/.test(files.client), "Les historiques volumineux devront ensuite être paginés par fenêtre.");
warning("PERF-005", "Chargement par fenêtre de dates détecté", /startAt|startAfter|where\([^\n]*(?:date|dateKey)|IntersectionObserver/i.test(files.client + files.ui), "Éviter de monter toutes les années du calendrier au démarrage.");
critical("PERF-006", "Index contextuels versionnés", has(files.indexes, /"collectionGroup":\s*"comments"/) && has(files.indexes, /"fieldPath":\s*"sectionId"/) && has(files.indexes, /"collectionGroup":\s*"mediaLinks"/) && has(files.indexes, /"fieldPath":\s*"eventId"/), "Les commentaires et médias ouverts doivent utiliser leurs requêtes contextuelles bornées sans repli global.");
critical("DATA-001", "Commentaires, tâches, médias et workflows sous écoute temps réel", ["subscribeComments", "subscribeActionTasks", "subscribeMediaLinks", "subscribeWorkflowStates"].every((token) => files.client.includes(token) && files.ui.includes(token)), "Chaque abonnement doit aussi être désabonné à la déconnexion.");
critical("DATA-002", "Médias externes sans Firebase Storage", !/firebase-storage|uploadBytes|getDownloadURL/.test(files.client + files.ui), "OneDrive/SharePoint reste la source des médias volumineux.");
critical("DATA-003", "Aperçu média visible et informations repliables", /cockpit-media-preview/.test(files.ui) && /<details class="cockpit-media-info"/.test(files.ui) && /Informations et actions/.test(files.ui), "Le volet externe peut replier l’ensemble; l’aperçu reste visible par défaut.");
critical("DATA-004", "Feux verts et décisions sont réversibles", /Feu vert retiré|retiré du choix final|decision.*undecided/is.test(files.ui + files.client), "Chaque retour arrière doit créer une trace.");
critical("DATA-005", "Un choix média structuré faux surclasse l’ancien marqueur", /(?:hasOwnProperty\.call\(row,\s*["']selectedFinal["']\)|["']selectedFinal["'] in row)/.test(files.mediaChoice) && /!hasStructuredChoice/.test(files.mediaChoice), "Une ancienne note ne doit pas empêcher de retirer le média final.");
critical("DATA-006", "Choix média et archive enregistrés atomiquement", /setMediaFinalChoice[\s\S]{0,2200}writeBatch\(db\)[\s\S]{0,1000}batch\.commit\(\)/.test(files.client), "L’interface ne doit pas confirmer un choix si son historique échoue.");
critical("DATA-010", "Références non diffusables impossibles à retenir", /publicationBlocked === true/.test(files.ui) && /Référence non diffusable/.test(files.ui) && /cockpit-media-final-action[\s\S]{0,800}disabled/.test(files.ui) && /selected && \(before\.publicationBlocked === true \|\| before\.archived === true\)/.test(files.client) && /publicationBlocked' in resource\.data/.test(files.rules), "Une référence de style anatomiquement invalide doit rester consultable sans pouvoir devenir le média final.");
critical("DATA-011", "Métadonnées des médias initialisés acceptées par les règles", ["publicationBlocked", "altText", "rightsStatus"].every((field) => files.rules.includes(`'${field}'`)), "Une sélection ne doit pas échouer parce que le média contient ses métadonnées de sécurité et d’accessibilité.");
const editorialMedia = JSON.parse(files.editorialMediaManifest);
const archivedSecchiIds = new Set([
  "editorial-s1d5-secchi-v1",
  "editorial-s1d5-secchi-answer-v1",
  "editorial-s1d5-secchi-manuscript-v2",
  "editorial-s1d5-secchi-answer-manuscript-v2"
]);
const secchiV4 = editorialMedia.find((item) => item.id === "editorial-s1d5-secchi-real-manuscript-v4");
const secchiSource = editorialMedia.find((item) => item.id === "editorial-s1d5-secchi-real-photo-v3");
critical("DATA-012", "Le visuel Secchi réel remplace les illustrations sans détruire l’historique",
  Boolean(secchiV4)
    && secchiV4.eventId === "s1d5"
    && secchiV4.stage === "proposal"
    && /bilingue-v4\.png$/.test(secchiV4.fileName || "")
    && /photographie du domaine public/i.test(secchiV4.rightsStatus || "")
    && secchiSource?.stage === "source"
    && [...archivedSecchiIds].every((id) => editorialMedia.find((item) => item.id === id)?.stage === "archived")
    && editorialMedia.filter((item) => item.eventId === "s1d5" && !["source", "archived"].includes(item.stage || "proposal")).length === 1,
  "La v4 doit être la seule proposition active; la photo brute reste une source et les quatre cartes précédentes restent consultables comme archives.");
critical("DATA-007", "Projets internes suivis, bornés et synchronisés localement", /setInternalProjectStage/.test(files.client) && /subscribeInternalProjectStates/.test(files.client) && /internalProjectStates[\s\S]{0,220}limit\((?:50|100)\)/.test(files.client) && /readRecent\("opportunityStates"\)/.test(files.adminSync) && /readRecent\("internalProjectStates"\)/.test(files.adminSync), "Les deux registres doivent apparaître dans le résumé local et le nouvel abonnement ne doit pas croître sans borne.");
critical("DATA-008", "Initialisation des projets internes idempotente", /if \(existing\.exists\)[\s\S]{0,160}preserved \+= 1[\s\S]{0,100}continue/.test(files.internalProjectSeed), "Un nouveau déploiement ne doit jamais écraser une étape déjà choisie.");
critical("DATA-009", "Interface des projets internes branchée et nettoyée", /setupInternalProjectEvents/.test(files.ui) && /renderInternalProjectStates/.test(files.ui) && /subscribeInternalProjectStates/.test(files.ui) && /internalProjectUnsubscribe\?\.\(\)/.test(files.ui), "Le registre doit écouter les états en direct et désabonner sa lecture à la déconnexion.");

const failedCritical = results.filter((item) => item.severity === "CRITIQUE" && !item.pass);
const failedWarnings = results.filter((item) => item.severity === "AVERTISSEMENT" && !item.pass);
const passed = results.filter((item) => item.pass);

console.log("\nContrat qualité statique — Cockpit Communication Bleu Massawippi\n");
for (const item of results) {
  const symbol = item.pass ? "✓" : item.severity === "CRITIQUE" ? "✗" : "!";
  console.log(`${symbol} [${item.severity}] ${item.id} — ${item.label}`);
  if (!item.pass && item.detail) console.log(`    ${item.detail}`);
}
console.log(`\nRésumé : ${passed.length} réussites, ${failedCritical.length} échec(s) critique(s), ${failedWarnings.length} avertissement(s).`);
if (failedCritical.length) {
  console.error("Publication bloquée : corriger les échecs critiques ou ajuster explicitement le contrat documenté.");
  process.exitCode = 1;
} else {
  console.log(failedWarnings.length ? "Contrat critique respecté; avertissements à trier avant publication." : "Contrat qualité entièrement respecté.");
}
