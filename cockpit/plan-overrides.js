import { SPECS as ALTERNATIVE_SPECS } from "./alternatives.js";

const OPEN_HOUSE_MAP_URL = "https://www.google.com/maps/search/?api=1&query=Eglise+Saint-Barthelemy%2C+911+rue+Clough%2C+Ayer%27s+Cliff%2C+QC+J0B+1C0";

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
  coordinationLabel: "Préparation requise · personne bénévole, entrevue, consentement et photo",
  role: "Humaniser l’action en donnant la parole à une personne bénévole, après une préparation réaliste de l’entrevue, des autorisations et du visuel.",
  task: "Préparer la personne, l’entrevue, le consentement et le portrait avant de finaliser la publication.",
  tasksValentin: [
    "Préparer une courte grille d’entrevue chaleureuse : motivation, geste concret, souvenir du lac et invitation à participer.",
    "Proposer deux ou trois profils possibles avec la direction, puis préparer le courriel ou l’appel de prise de contact.",
    "Planifier une entrevue de 20 à 30 minutes et une prise de photo; prévoir une solution de rechange sans visage identifiable.",
    "Obtenir et classer le consentement de diffusion pour le texte, la citation, le nom et l’image avant toute publication.",
    "À partir de l’entrevue, adapter l’ébauche FR / EN, produire le portrait ou la capsule et soumettre le tout aux deux validations."
  ],
  tasksAnnie: [
    "Identifier une ou plusieurs personnes bénévoles crédibles, disponibles et à l’aise de témoigner publiquement.",
    "Faire l’introduction institutionnelle ou autoriser la prise de contact par les communications.",
    "Confirmer que la participation, le contexte raconté et les informations institutionnelles sont exacts et appropriés.",
    "Aider à fixer le rendez-vous si la relation avec la personne bénévole passe par la direction générale."
  ],
  taskOwnersVersion: "event-task-owners-2026-07-11-volunteer-interview-v2"
};

function buildAlternative(spec) {
  const nature = spec.t === "Nature";
  return {
    ...spec,
    tier: "Passerelle",
    source: nature ? "Illustration originale à valider avec une référence naturaliste fiable avant diffusion; elle ne prouve pas une présence locale." : "Contenu institutionnel; vérifier tout fait ou consigne auprès d’une source primaire avant diffusion.",
    fallback: "Visuel typographique sobre ou photo réelle autorisée correspondant exactement au sujet.",
    kpi: "Commentaires utiles / enregistrements / partages",
    task: "Finaliser le texte bilingue, vérifier les faits et produire le visuel avant les deux validations.",
    copy: `FR — ${spec.fr}\n\n#BleuMassawippi #LacMassawippi #Estrie\n\n=========================================\n\nEN — ${spec.en}\n\n#BleuMassawippi #LakeMassawippi #EasternTownships`,
    optionGroup: spec.id.replace("alt-", ""),
    optionLabel: "Option B — " + spec.title,
    choiceRequired: true,
    isAlternative: true,
    tasksValentin: ["Vérifier la source primaire et les limites du propos.", `Produire le format « ${spec.format} » avec texte alternatif et lisibilité mobile.`, "Finaliser la légende FR / EN, soumettre les validations et programmer seulement après décision."],
    tasksAnnie: spec.t === "Communauté" || spec.t === "Patrimoine" ? ["Confirmer le contexte institutionnel, les droits et les renseignements sensibles avant diffusion."] : ["Signaler toute limite institutionnelle ou locale nécessitant une correction."],
    taskOwnersVersion: "event-task-owners-2026-07-11-alternatives-v1"
  };
}

export function applyPlanOverridesToPosts(posts) {
  if (!Array.isArray(posts)) return posts;
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
  const fixedContest = posts.find((post) => post.id === "s3d3");
  if (fixedContest) fixedContest.decisionLocked = true;
  for (const spec of ALTERNATIVE_SPECS) {
    const group = spec.id.replace("alt-", "");
    const originals = posts.filter((post) => post.date === spec.date && !String(post.id).startsWith("alt-"));
    originals.forEach((post, index) => Object.assign(post, { choiceRequired: true, optionGroup: group, optionLabel: `Option ${String.fromCharCode(65 + index)} — ${post.title}` }));
    if (!posts.some((post) => post.id === spec.id)) posts.push(buildAlternative(spec));
  }
  return posts;
}

export function preparePlanScript(script, posts) {
  const updatedPosts = applyPlanOverridesToPosts(posts);
  let output = String(script || "").replace(
    /var posts=\[[\s\S]*?\];\s*var meta=/,
    `var posts=${JSON.stringify(updatedPosts)};var meta=`
  );
  output = output.replace("[1,2,3,4].forEach", "[1,2,3,4,5].forEach");
  output = output.replace(
    /(var meta=\{[\s\S]*?\};)/,
    "$1meta[5]=[\"Semaine 5 · Réserve éditoriale\",\"10 au 16 août\"];"
  );
  return output;
}

export { OPEN_HOUSE_MAP_URL };
