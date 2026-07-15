import { SPECS as ALTERNATIVE_SPECS } from "./alternatives.js";
import { applyEditorialCopyOverrides } from "./editorial-copy-overrides.js";

const OPEN_HOUSE_MAP_URL = "https://www.google.com/maps/search/?api=1&query=Eglise+Saint-Barthelemy%2C+911+rue+Clough%2C+Ayer%27s+Cliff%2C+QC+J0B+1C0";

const PLAN_YEAR = 2026;
const ARCHIVED_DATE_ISO = new Map([
  ["s2d3", "2026-07-22"],
  ["s2d6", "2026-07-26"],
  ["s3d1b", "2026-07-27"]
]);
const PLAN_MONTHS = new Map([
  ["janvier", 1], ["février", 2], ["fevrier", 2], ["mars", 3], ["avril", 4], ["mai", 5], ["juin", 6],
  ["juillet", 7], ["août", 8], ["aout", 8], ["septembre", 9], ["octobre", 10], ["novembre", 11],
  ["décembre", 12], ["decembre", 12]
]);

function estimateTaskMinutes(task, role) {
  const text = String(task || "").toLocaleLowerCase("fr");
  if (/approuver|valider|choisir|signaler|prendre connaissance/.test(text)) return role === "director" ? 3 : 5;
  if (/confirmer|vérifier|lire|arbitrer/.test(text)) return role === "director" ? 5 : 10;
  if (/contacter|rendez-vous|partenaire|consentement|autorisation/.test(text)) return 15;
  if (/publier|programmer|répondre aux premiers commentaires/.test(text)) return 10;
  if (/produire|rédiger|construire|finaliser|synthétiser|documenter|préparer/.test(text)) return 30;
  return role === "director" ? 5 : 15;
}

export function planDateIsoFromLabel(value, year = PLAN_YEAR) {
  const match = String(value || "").toLocaleLowerCase("fr-CA").match(/(\d{1,2})(?:er)?\s+([a-zéûô]+)/i);
  const month = match ? PLAN_MONTHS.get(match[2]) : null;
  if (!match || !month) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(Number(match[1])).padStart(2, "0")}`;
}

const OPEN_HOUSE_POST = {
  w: 1,
  date: "Lundi 13 juillet",
  t: "Communauté",
  tier: "Pilier",
  title: "Nous sommes là, si vous voulez nous parler",
  format: "Note manuscrite 4:5 · photo réelle + horaire variable",
  role: "Faire savoir simplement quand une personne de l’équipe est présente cette semaine, sans présenter ces disponibilités comme des portes ouvertes ni comme un horaire fixe.",
  cta: "Passer nous parler ou trouver le local",
  visual: "Photo authentique du local en noir et blanc doux; note personnelle façon rappel sur le frigo, écriture blanche en lettres détachées et petit sourire dessiné.",
  source: `Photo fournie par l’association; adresse publique vérifiée auprès de la Municipalité d’Ayer’s Cliff : église Saint-Barthélemy, 911, rue Clough, Ayer’s Cliff, Québec J0B 1C0 · ${OPEN_HOUSE_MAP_URL}`,
  fallback: "Photo réelle légèrement pâlie avec les trois plages horaires en écriture blanche; aucune mention de portes ouvertes.",
  kpi: "Clics Google Maps / messages reçus / visites au local",
  task: "Préparer le visuel photo 4:5, vérifier une dernière fois les horaires et rendre le lien Google Maps cliquable dans la légende.",
  copy: `FR — Vous avez une question sur le lac, nos projets ou l’association? Cette semaine, une personne de l’équipe sera au local aux moments suivants :

Lundi 13 juillet : 8 h 30 à 16 h
Mercredi 15 juillet : 8 h 30 à 15 h
Jeudi 16 juillet : 8 h 30 à 16 h

📍 Église Saint-Barthélemy, 911, rue Clough, Ayer’s Cliff (Québec) J0B 1C0
Itinéraire : ${OPEN_HOUSE_MAP_URL}

#BleuMassawippi #LacMassawippi #Communauté #AyersCliff #NousSommesLà

=========================================

EN — Do you have a question about the lake, our projects or the association? This week, someone from our team will be at the local office at the following times:

Monday, July 13: 8:30 a.m. to 4 p.m.
Wednesday, July 15: 8:30 a.m. to 3 p.m.
Thursday, July 16: 8:30 a.m. to 4 p.m.

📍 Saint-Barthélemy Church, 911 Clough Street, Ayer’s Cliff, Quebec J0B 1C0
Directions: ${OPEN_HOUSE_MAP_URL}

#BleuMassawippi #LakeMassawippi #Community #AyersCliff #WeAreHere`,
  choiceRequired: false,
  optionGroup: null,
  optionLabel: null,
  isAlternative: false,
  tasksValentin: [
    "Transformer la photo fournie en note personnelle 4:5 optimisée pour Facebook et Instagram, avec une écriture manuscrite lisible sur mobile et un texte alternatif.",
    "Vérifier les dates, heures, adresse et lien Google Maps; préciser que l’horaire change chaque semaine; programmer uniquement après validation.",
    "Surveiller les messages et commentaires liés aux heures d’accueil et consigner les demandes nécessitant un suivi."
  ],
  tasksAnnie: [
    "Confirmer les heures d’accueil, la disponibilité réelle du local et la personne qui peut recevoir les visiteurs.",
    "Préparer l’accueil et signaler rapidement tout changement d’horaire ou toute demande qui exige une réponse de la direction générale."
  ],
  taskOwnersVersion: "event-task-owners-2026-07-11-weekly-presence-v2"
};

const VOLUNTEER_INTERVIEW_POST = {
  w: 5,
  date: "Mardi 11 août",
  choiceRequired: false,
  optionGroup: null,
  optionLabel: null,
  isAlternative: false,
  coordinationLevel: "high",
  coordinationLabel: "Préparation requise · conseil d’administration ou bénévolat, courtes entrevues, consentements et portraits",
  role: "Humaniser l’association en donnant la parole aux personnes qui s’impliquent, en commençant par un portrait collectif du conseil d’administration, puis en ouvrant la série au bénévolat.",
  task: "Recueillir une courte phrase authentique et un consentement pour chaque personne avant de finaliser le carrousel ou de scinder la série en plusieurs portraits.",
  tasksValentin: [
    "Préparer une question unique, chaleureuse et facile à répondre : « Pourquoi avez-vous choisi de vous impliquer pour le Massawippi? ».",
    "Proposer un carrousel avec une couverture, puis une carte sobre par membre du conseil; si le carrousel devient trop long, le scinder en une courte série cohérente.",
    "Planifier les courtes réponses écrites ou entrevues et les portraits; prévoir une solution typographique si une personne ne souhaite pas montrer son visage.",
    "Obtenir et classer le consentement de diffusion pour chaque nom, citation et image avant toute publication.",
    "Adapter les citations en FR / EN sans changer leur sens, produire le carrousel et soumettre le texte puis les visuels aux validations."
  ],
  tasksAnnie: [
    "Confirmer la liste actuelle des membres du conseil d’administration, leur titre public et l’ordre de présentation.",
    "Faire l’introduction institutionnelle, transmettre la question et confirmer la disponibilité de chaque personne.",
    "Valider que chaque citation respecte bien la pensée de son auteur et que les informations institutionnelles sont exactes.",
    "Décider si la première publication présente tout le conseil ou si la série commence par deux ou trois portraits, puis se poursuit."
  ],
  taskOwnersVersion: "event-task-owners-2026-07-13-board-portrait-v3"
};

const TRIBUTARY_LEXICON_POST = {
  id: "lexique-20260830-tributaire",
  w: 7,
  date: "Dimanche 30 août",
  calendarTime: "10:00",
  t: "Éducation",
  tier: "Passerelle",
  title: "Le mot du lac : tributaire",
  format: "Carte lexique 4:5 · dessin simple + lettrage manuscrit",
  role: "Ouvrir une série de définitions accessibles qui donnent au public les mots nécessaires pour mieux comprendre le lac et son bassin versant.",
  cta: "Découvrir un mot du bassin versant",
  visual: "Dessin chaleureux et très simple d’un petit cours d’eau qui rejoint le lac; titre manuscrit « Tributaire » et courte note « Un cours d’eau qui en rejoint un autre ou se jette dans un lac »; aucun long paragraphe dans l’image.",
  source: "Gouvernement du Québec — Glossaire de la qualité de l’eau : « Affluent - tributaire : cours d’eau qui se jette dans un autre » · https://www.environnement.gouv.qc.ca/eau/sys-image/contenu1.htm · exemple adapté au bassin versant du lac Massawippi.",
  fallback: "Photo réelle d’un cours d’eau, avec le seul mot manuscrit « Tributaire » et une flèche vers le lac.",
  kpi: "Enregistrements / partages / questions de vocabulaire proposées",
  task: "Vérifier la définition auprès d’une source gouvernementale, produire une carte très lisible et préparer les prochains mots de la série à partir des questions du public.",
  copy: `FR — Le mot du lac : tributaire.

Un tributaire est un cours d’eau qui en rejoint un autre ou qui se jette dans un lac. Autour du Massawippi, les tributaires relient tout le bassin versant : ce qui se passe en amont peut donc voyager jusqu’au lac.

Quel autre mot lié au lac aimeriez-vous que nous expliquions simplement?

#LeMotDuLac #BleuMassawippi #LacMassawippi #Tributaires #BassinVersant

=========================================

EN — Lake word of the day: tributary.

A tributary is a stream or river that flows into another waterway or a lake. Around Massawippi, tributaries connect the whole watershed, so what happens upstream can eventually reach the lake.

Which other lake-related word would you like us to explain in plain language?

#LakeWords #BleuMassawippi #LakeMassawippi #Tributaries #Watershed`,
  choiceRequired: false,
  optionGroup: null,
  optionLabel: null,
  isAlternative: true,
  tasksValentin: [
    "Conserver la définition gouvernementale et vérifier que l’exemple demeure exact pour le bassin versant du Massawippi.",
    "Produire la carte lexique en lettrage manuscrit, avec un texte alternatif bilingue et une lecture immédiate sur mobile.",
    "Finaliser la légende FR / EN, soumettre les validations et préparer une courte liste de prochains mots à partir des questions reçues."
  ],
  tasksAnnie: [
    "Confirmer que le terme choisi répond à un besoin réel de vulgarisation et que l’exemple convient au contexte institutionnel."
  ],
  taskOwnersVersion: "event-task-owners-2026-07-13-lexicon-v1"
};

function buildAlternative(spec) {
  const nature = spec.t === "Nature";
  const heritage = spec.t === "Patrimoine";
  return {
    ...spec,
    tier: "Passerelle",
    source: spec.source || (nature ? "Illustration originale à valider avec une référence naturaliste fiable avant diffusion; elle ne prouve pas une présence locale." : "Contenu institutionnel; vérifier tout fait ou consigne auprès d’une source primaire avant diffusion."),
    fallback: spec.fallback || "Visuel typographique sobre ou photo réelle autorisée correspondant exactement au sujet.",
    kpi: spec.kpi || (heritage ? "Commentaires documentés / partages / nouvelles archives proposées" : "Commentaires utiles / enregistrements / partages"),
    task: spec.task || (heritage ? "Vérifier la légende, le crédit, la licence et les limites historiques avant de préparer l’image et les deux validations." : "Finaliser le texte bilingue, vérifier les faits et produire le visuel avant les deux validations."),
    copy: `FR — ${spec.fr}\n\n#BleuMassawippi #LacMassawippi #Estrie\n\n=========================================\n\nEN — ${spec.en}\n\n#BleuMassawippi #LakeMassawippi #EasternTownships`,
    optionGroup: Object.prototype.hasOwnProperty.call(spec, "optionGroup") ? spec.optionGroup : spec.id.replace("alt-", ""),
    optionLabel: spec.choiceRequired === false ? null : "Option B — " + spec.title,
    choiceRequired: spec.choiceRequired !== false,
    isAlternative: true,
    tasksValentin: heritage ? ["Vérifier la fiche source, la date, l’auteur, le crédit et la licence dans le catalogue local des photos historiques.", `Préparer le format « ${spec.format} » sans colorisation ni transformation trompeuse; ajouter un texte alternatif et garantir la lisibilité mobile.`, "Finaliser la légende FR / EN, conserver les nuances historiques, soumettre les validations et programmer seulement après décision."] : ["Vérifier la source primaire et les limites du propos.", `Produire le format « ${spec.format} » avec texte alternatif et lisibilité mobile.`, "Finaliser la légende FR / EN, soumettre les validations et programmer seulement après décision."],
    tasksAnnie: heritage ? ["Lire l’angle à haut niveau et signaler seulement une identification locale, un enjeu institutionnel ou un repère qui exige une confirmation."] : spec.t === "Communauté" ? ["Confirmer le contexte institutionnel, les droits et les renseignements sensibles avant diffusion."] : ["Signaler toute limite institutionnelle ou locale nécessitant une correction."],
    taskOwnersVersion: "event-task-owners-2026-07-11-alternatives-v1"
  };
}

export function applyPlanOverridesToPosts(posts) {
  if (!Array.isArray(posts)) return posts;
  if (!posts.some((post) => post.id === TRIBUTARY_LEXICON_POST.id)) posts.push({ ...TRIBUTARY_LEXICON_POST });
  const first = posts.find((post) => post.id === "s1d1");
  if (first) Object.assign(first, OPEN_HOUSE_POST, { decisionLocked: true });
  const moved = posts.find((post) => post.id === "s1d1b");
  if (moved) {
    Object.assign(moved, {
      w: 5,
      date: "Lundi 10 août",
      t: "Nature",
      tier: "Passerelle",
      choiceRequired: false,
      optionGroup: null,
      optionLabel: null,
      isAlternative: true,
      role: "Contenu nature déplacé du premier lundi afin de préserver la variété et de maintenir une réserve éditoriale pour la cadence permanente."
    });
  }
  const volunteer = posts.find((post) => post.id === "s1d3");
  if (volunteer) Object.assign(volunteer, VOLUNTEER_INTERVIEW_POST);
  const tuesdayFallback = posts.find((post) => post.id === "s1d3b");
  if (tuesdayFallback) Object.assign(tuesdayFallback, {
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
      role: "Publication pratique retenue pour le premier mardi pendant que le portrait bénévole est préparé pour une semaine ultérieure."
    });
  const contemplativeMinute = posts.find((post) => post.id === "s1d6");
  if (contemplativeMinute) Object.assign(contemplativeMinute, {
    w: 2,
    date: "Mardi 21 juillet",
    calendarTime: "12:00",
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
    role: "Publication contemplative retenue et déplacée au mardi afin d’éviter deux contenus émotionnels consécutifs les 17 et 18 juillet."
  });
  const saturdayCommunity = posts.find((post) => post.id === "s1d4");
  if (saturdayCommunity) Object.assign(saturdayCommunity, {
    w: 1,
    date: "Samedi 18 juillet",
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
    role: "Publication communautaire retenue pour le samedi afin de favoriser une réponse personnelle et chaleureuse, conformément au dernier arbitrage de la direction."
  });
  const deferredMemory = posts.find((post) => post.id === "s1d7");
  if (deferredMemory) Object.assign(deferredMemory, {
    w: 6,
    date: "Jeudi 20 août",
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
    role: "Bonne idée conservée et reprogrammée après l’arbitrage du 13 juillet afin de libérer le samedi pour la publication communautaire retenue."
  });
  const deferredIris = posts.find((post) => post.id === "s2d1");
  if (deferredIris) Object.assign(deferredIris, {
    w: 6,
    date: "Mercredi 19 août",
    calendarTime: "12:30",
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
      role: "Capsule phare reprogrammée dans un créneau visible afin de développer pleinement la beauté de l’iris versicolore et la valeur des milieux humides."
    });
  const chosenHistory = posts.find((post) => post.id === "s2d7");
  if (chosenHistory) Object.assign(chosenHistory, {
    w: 1,
    date: "Vendredi 17 juillet",
    calendarTime: "17:00",
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
    role: "Publication patrimoniale retenue et avancée au vendredi afin de diversifier la séquence avant le contenu communautaire du samedi."
  });
  const deferredBoatWash = posts.find((post) => post.id === "s4d1");
  if (deferredBoatWash) Object.assign(deferredBoatWash, {
    w: 6,
    date: "Vendredi 21 août",
    calendarTime: "17:00",
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
    decisionLocked: true,
    role: "Publication de prévention conservée et espacée de plus de cinq semaines après le rappel du 14 juillet; présenter le rituel complet avant un changement de plan d’eau sans répéter la publication déjà programmée."
  });
  const deferredMonitoring = posts.find((post) => post.id === "s1d2");
  if (deferredMonitoring) Object.assign(deferredMonitoring, {
    w: 5,
    date: "Jeudi 13 août",
    calendarTime: "12:00",
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
    isAlternative: false,
    role: "Publication scientifique conservée et reprogrammée après l’ajustement du début des vacances de la construction; elle présente ensemble le suivi du lac et de ses tributaires."
  });
  ["s2d3", "s2d6", "s3d1b"].forEach((id) => {
    const rejected = posts.find((post) => post.id === id);
    if (rejected) Object.assign(rejected, {
      w: 98,
      date: "Archive éditoriale",
      archivedEditorial: true,
      choiceRequired: false,
      optionGroup: null,
      optionLabel: null,
      role: `${rejected.role || ""} Angle écarté par la direction le 13 juillet 2026; conservé dans l’historique et exclu du calendrier actif.`.trim()
    });
  });
  const fixedContest = posts.find((post) => post.id === "s3d3");
  if (fixedContest) fixedContest.decisionLocked = true;
  for (const spec of ALTERNATIVE_SPECS) {
    const group = spec.id.replace("alt-", "");
    const originals = posts.filter((post) => post.date === spec.date && !String(post.id).startsWith("alt-"));
    if (spec.choiceRequired !== false) {
      originals.forEach((post, index) => Object.assign(post, { choiceRequired: true, optionGroup: group, optionLabel: `Option ${String.fromCharCode(65 + index)} — ${post.title}` }));
    }
    if (!posts.some((post) => post.id === spec.id)) posts.push(buildAlternative(spec));
  }
  const finalPosts = applyEditorialCopyOverrides(posts);
  const reprogrammed = {
    "alt-20260721": { w: 7, date: "Lundi 24 août", role: "Bonne idée conservée et reprogrammée après arbitrage; capsule nature à produire avec une photographie réelle correctement identifiée." },
    "alt-20260723": { w: 7, date: "Mardi 25 août", role: "Bonne idée conservée et reprogrammée après arbitrage; capsule sur les fonctions d’une rive végétalisée à renforcer en français." },
    "alt-20260724": { w: 7, date: "Mercredi 26 août", role: "Bonne idée conservée et reprogrammée après arbitrage; amorce éditoriale de l’atelier d’automne sur les jardins de pluie, sans annoncer de date non confirmée." },
    "alt-20260725": { w: 7, date: "Jeudi 27 août", role: "Sujet récurrent conservé pour un autre mois avec une formulation distincte, afin d’éviter la répétition dans la même séquence." },
    "alt-20260728": { w: 7, date: "Vendredi 28 août", role: "Bonne idée conservée et reprogrammée après arbitrage; expliquer la complémentarité entre suivi scientifique et observations citoyennes sans les confondre." },
    "alt-20260729": { w: 8, date: "Lundi 31 août", role: "Bonne idée nature conservée et reprogrammée après le choix de la publication sur les observations après la pluie pour le 29 juillet." },
    "alt-20260802": { w: 8, date: "Mardi 1er septembre", role: "Bonne idée nature conservée et reprogrammée après le choix de la publication sur les cinq réflexes doux pour le 2 août." }
  };
  Object.entries(reprogrammed).forEach(([id, placement]) => {
    const post = finalPosts.find((item) => item.id === id);
    if (post) Object.assign(post, placement, { choiceRequired: false, optionGroup: null, optionLabel: null });
  });
  ["s1d3b", "alt-20260715", "s1d5", "s1d6", "s1d4", "s1d2", "s2d1b", "s1d7", "s2d1", "s2d2", "alt-20260722", "s2d4", "s2d5", "s2d7", "alt-20260726", "s3d1", "s3d2", "s3d4", "s3d3", "s3d7", "s4d1", "s4d1b", "alt-20260729", "alt-20260802", "lexique-20260830-tributaire"].forEach((id) => {
    const post = finalPosts.find((item) => item.id === id);
    if (post) Object.assign(post, { choiceRequired: false, optionGroup: null, optionLabel: null });
  });
  finalPosts.forEach((post) => {
    const dateIso = planDateIsoFromLabel(post.date) || ARCHIVED_DATE_ISO.get(post.id);
    if (dateIso) post.dateIso = dateIso;
    else delete post.dateIso;
    const communicationsTasks = Array.isArray(post.tasksValentin) ? post.tasksValentin : [post.task].filter(Boolean);
    const directionTasks = Array.isArray(post.tasksAnnie) ? post.tasksAnnie : [];
    post.tasksValentinMinutes = communicationsTasks.map((task) => estimateTaskMinutes(task, "admin"));
    post.tasksAnnieMinutes = directionTasks.map((task) => estimateTaskMinutes(task, "director"));
    post.estimatedMinutesValentin = post.tasksValentinMinutes.reduce((sum, value) => sum + value, 0);
    post.estimatedMinutesAnnie = post.tasksAnnieMinutes.reduce((sum, value) => sum + value, 0);
    post.timeEstimateVersion = "task-time-v1-2026-07-14";
  });
  return finalPosts.sort((left, right) => {
    const leftKey = left.dateIso || "9999-12-31";
    const rightKey = right.dateIso || "9999-12-31";
    return leftKey.localeCompare(rightKey) || Number(left.w || 999) - Number(right.w || 999);
  });
}

export function preparePlanScript(script, posts) {
  const updatedPosts = applyPlanOverridesToPosts(posts);
  let output = String(script || "").replace(
    /var posts=\[[\s\S]*?\];\s*var meta=/,
    `var posts=${JSON.stringify(updatedPosts)};var meta=`
  );
  output = output.replace(/\[[1-8,]+\]\.forEach/, "[1,2,3,4,5,6,7,8].forEach");
  output = output.replace(
    /Object\.keys\(days\)(?:\.sort\([\s\S]*?\))?\.forEach\(function\(day\)\{/,
    "Object.keys(days).sort(function(a,b){return postDate(days[a][0])-postDate(days[b][0])}).forEach(function(day){"
  );
  output = output.replace(
    /(var meta=\{[\s\S]*?\};)/,
    "$1meta[5]=[\"Semaine 5 · Réserve éditoriale\",\"10 au 16 août\"];meta[6]=[\"Semaine 6 · Réserve éditoriale\",\"17 au 23 août\"];meta[7]=[\"Semaine 7 · Réserve éditoriale\",\"24 au 30 août\"];meta[8]=[\"Semaine 8 · Réserve éditoriale\",\"31 août au 6 septembre\"];"
  );
  return output;
}

export { OPEN_HOUSE_MAP_URL };
