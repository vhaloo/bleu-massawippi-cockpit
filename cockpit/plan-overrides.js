const OPEN_HOUSE_MAP_URL = "https://www.google.com/maps/search/?api=1&query=Eglise+Saint-Barthelemy%2C+911+rue+Clough%2C+Ayer%27s+Cliff%2C+QC+J0B+1C0";

const OPEN_HOUSE_POST = {
  w: 1,
  date: "Lundi 13 juillet",
  t: "Communauté",
  tier: "Pilier",
  title: "Portes ouvertes : venez nous rencontrer",
  format: "Visuel photo 4:5 · horaires + lien Google Maps",
  role: "Rendre le point de contact de l’association visible et accessible, avec des heures précises et un itinéraire simple.",
  cta: "Trouver le local sur Google Maps",
  visual: "Photo authentique du local fournie par l’association, recadrée en 4:5; titre discret : Portes ouvertes · Venez nous rencontrer.",
  source: `Photo fournie par l’association; adresse publique vérifiée auprès de la Municipalité d’Ayer’s Cliff : église Saint-Barthélemy, 911, rue Clough, Ayer’s Cliff, Québec J0B 1C0 · ${OPEN_HOUSE_MAP_URL}`,
  fallback: "Visuel typographique sobre avec les trois plages horaires et le lien Google Maps, si la photo ne peut pas être publiée.",
  kpi: "Clics Google Maps / messages reçus / visites au local",
  task: "Préparer le visuel photo 4:5, vérifier une dernière fois les horaires et rendre le lien Google Maps cliquable dans la légende.",
  copy: `FR — Vous souhaitez venir nous rencontrer ou en apprendre davantage sur les actions de Bleu Massawippi? Les portes du local sont ouvertes cette semaine :

Lundi 13 juillet : 8 h 30 à 16 h
Mercredi 15 juillet : 8 h 30 à 15 h
Jeudi 16 juillet : 8 h 30 à 16 h

📍 Église Saint-Barthélemy, 911, rue Clough, Ayer’s Cliff (Québec) J0B 1C0
Itinéraire : ${OPEN_HOUSE_MAP_URL}

Passez nous voir pour poser une question, découvrir le travail de l’association ou simplement venir échanger au sujet du lac Massawippi. Au plaisir de vous accueillir!

#BleuMassawippi #LacMassawippi #Communauté #NorthHatley #PortesOuvertes

=========================================

EN — Would you like to meet us or learn more about Bleu Massawippi’s work? Our local office is open this week:

Monday, July 13: 8:30 a.m. to 4 p.m.
Wednesday, July 15: 8:30 a.m. to 3 p.m.
Thursday, July 16: 8:30 a.m. to 4 p.m.

📍 Saint-Barthélemy Church, 911 Clough Street, Ayer’s Cliff, Quebec J0B 1C0
Directions: ${OPEN_HOUSE_MAP_URL}

Stop by to ask a question, learn about the association’s work or simply talk about Lake Massawippi. We look forward to welcoming you!

#BleuMassawippi #LakeMassawippi #Community #NorthHatley #OpenDoors`,
  choiceRequired: false,
  optionGroup: null,
  optionLabel: null,
  isAlternative: false,
  tasksValentin: [
    "Transformer la photo fournie en visuel 4:5 optimisé pour Facebook et Instagram, avec un texte lisible sur mobile et un texte alternatif.",
    "Vérifier les dates, heures, adresse et lien Google Maps; finaliser la légende FR / EN puis programmer uniquement après validation.",
    "Surveiller les messages et commentaires liés aux heures d’accueil et consigner les demandes nécessitant un suivi."
  ],
  tasksAnnie: [
    "Confirmer les heures d’accueil, la disponibilité réelle du local et la personne qui peut recevoir les visiteurs.",
    "Préparer l’accueil et signaler rapidement tout changement d’horaire ou toute demande qui exige une réponse de la direction générale."
  ],
  taskOwnersVersion: "event-task-owners-2026-07-10-open-house-v1"
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
