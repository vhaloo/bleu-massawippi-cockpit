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

Ce n’est pas une activité programmée ni un horaire fixe : ce sont simplement les moments où nous sommes là si vous avez envie de passer nous parler. Les disponibilités changeront chaque semaine; consultez toujours l’horaire le plus récent avant de vous déplacer.

#BleuMassawippi #LacMassawippi #Communauté #AyersCliff #NousSommesLà

=========================================

EN — Do you have a question about the lake, our projects or the association? This week, someone from our team will be at the local office at the following times:

Monday, July 13: 8:30 a.m. to 4 p.m.
Wednesday, July 15: 8:30 a.m. to 3 p.m.
Thursday, July 16: 8:30 a.m. to 4 p.m.

📍 Saint-Barthélemy Church, 911 Clough Street, Ayer’s Cliff, Quebec J0B 1C0
Directions: ${OPEN_HOUSE_MAP_URL}

This is not a scheduled event or a permanent office schedule. These are simply the times when we are here if you would like to stop by and talk. Availability will change from week to week, so please check the latest schedule before coming.

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

export function applyPlanOverridesToPosts(posts) {
  if (!Array.isArray(posts)) return posts;
  const first = posts.find((post) => post.id === "s1d1");
  if (first) Object.assign(first, OPEN_HOUSE_POST);
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
