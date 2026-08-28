import { SPECS as ALTERNATIVE_SPECS } from "./alternatives.js";
import { applyEditorialCopyOverrides } from "./editorial-copy-overrides.js";

const OPEN_HOUSE_MAP_URL = "https://www.google.com/maps/search/?api=1&query=Eglise+Saint-Barthelemy%2C+911+rue+Clough%2C+Ayer%27s+Cliff%2C+QC+J0B+1C0";

const PLAN_YEAR = 2026;
export const CADENCE_5_POLICY = Object.freeze({
  version: "cadence5-variable-2026-08-17-v1",
  effectiveFrom: "2026-08-17",
  postsPerCompleteWeek: 5,
  distribution: "Créneaux variés fixés une seule fois; aucune redistribution aléatoire au chargement.",
  fundingCadence: "Un point de soutien le vendredi toutes les deux semaines, avec montant et date confirmés avant diffusion."
});
const ARCHIVED_DATE_ISO = new Map([
  ["s1d1b", "2026-07-13"],
  ["s2d3", "2026-07-22"],
  ["s2d6", "2026-07-26"],
  ["s3d1b", "2026-07-27"],
  ["alt-20260725", "2026-08-27"],
  ["alt-20260804", "2026-08-04"],
  ["alt-20260810", "2026-08-10"]
]);
const PLAN_MONTHS = new Map([
  ["janvier", 1], ["février", 2], ["fevrier", 2], ["mars", 3], ["avril", 4], ["mai", 5], ["juin", 6],
  ["juillet", 7], ["août", 8], ["aout", 8], ["septembre", 9], ["octobre", 10], ["novembre", 11],
  ["décembre", 12], ["decembre", 12]
]);

function estimateTaskMinutes(task, role) {
  const text = String(task || "").toLocaleLowerCase("fr");
  if (/approuver|valider|choisir|signaler|prendre connaissance/.test(text)) return role === "director" ? 3 : 5;
  if (/rencontrer|réunion|reunion|entretien institutionnel/.test(text)) return role === "director" ? 45 : 30;
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
  title: "Denis Petitclerc — une voix du conseil",
  format: "Portrait documentaire · citation authentique + deux photographies réelles",
  cta: "Rencontrer une personne derrière la mission",
  visual: "À finaliser seulement après réception d’une courte citation authentique de Denis Petitclerc et de son consentement : citation en lettrage manuscrit avec sa signature, portrait réel à droite et seconde photographie réelle en action sous le portrait. Aucun visage, propos ni signature généré.",
  role: "Ouvrir la série de portraits du conseil d’administration par une présentation humaine de Denis Petitclerc, dans ses propres mots et avec des photographies authentiques.",
  task: "Obtenir de Denis une courte citation, son accord sur le texte, le choix des deux photographies et son consentement de diffusion avant de finaliser le visuel et la publication.",
  publicationBlocked: true,
  blockedReason: "En attente de la citation authentique, du choix des photographies et du consentement de Denis Petitclerc.",
  tasksValentin: [
    "Préparer une question unique, chaleureuse et facile à répondre : « Pourquoi avez-vous choisi de vous impliquer pour le Massawippi? ».",
    "Présélectionner dans les archives deux photographies réelles de Denis — un portrait et une image en action — sans les publier avant confirmation.",
    "Préparer la mise en page demandée : courte citation manuscrite et signature, portrait à droite, seconde photographie en dessous.",
    "Obtenir et classer le consentement de diffusion pour le nom, la citation, la signature et les deux images.",
    "Adapter la citation en FR / EN sans changer son sens, produire le visuel et soumettre le texte puis le média aux validations."
  ],
  tasksAnnie: [
    "Confirmer le rôle public de Denis Petitclerc et que ce portrait ouvre bien la série.",
    "Confirmer qui prend le premier contact avec Denis et coordonne la citation, les photographies et les relances.",
    "Transmettre la question, obtenir la courte réponse de Denis et confirmer sa disponibilité.",
    "Valider que la citation respecte sa pensée et que les informations institutionnelles sont exactes.",
    "Confirmer explicitement son accord pour la citation, la signature et les deux photographies avant diffusion."
  ],
  taskOwnersVersion: "event-task-owners-2026-07-17-board-portrait-v4"
};

const HUMAN_INTERVIEW_COORDINATION_LABEL = "Préparation requise · personne réelle, premier contact, coordination et consentement";
const HUMAN_INTERVIEW_DIRECTION_TASKS = [
  "Décider qui prend le premier contact avec chaque personne — direction générale ou communications.",
  "Confirmer qui coordonne les réponses, les disponibilités, le portrait et les relances jusqu’à la validation.",
  "Valider l’identité publique, le rôle, la citation et le consentement de chaque personne avant diffusion."
];

function isHumanInterviewPost(post) {
  const text = [post?.title, post?.format, post?.role, post?.task, post?.visual, post?.coordinationLabel]
    .filter(Boolean)
    .join(" ")
    .toLocaleLowerCase("fr");
  if (/\b(?:entrevue|interview)\b/.test(text)) return true;
  return /\bportraits?\b/.test(text) && /\b(?:bénévol|membre|conseil|personne|équipe|témoignage|citation)\b/.test(text);
}

function ensureHumanInterviewCoordination(post) {
  if (!isHumanInterviewPost(post)) return;
  post.requiresHumanConsent = true;
  post.requiresContactOwnership = true;
  post.coordinationLevel = "high";
  post.coordinationLabel ||= HUMAN_INTERVIEW_COORDINATION_LABEL;
  post.coordinationDecisionMinutesAnnie = Math.max(Number(post.coordinationDecisionMinutesAnnie) || 0, 15);
  const directionTasks = Array.isArray(post.tasksAnnie) ? post.tasksAnnie : [];
  HUMAN_INTERVIEW_DIRECTION_TASKS.forEach((task) => {
    const marker = task.includes("premier contact") ? /premier contact/i
      : task.includes("coordonne") ? /coordonn/i
      : /consentement/i;
    if (!directionTasks.some((current) => marker.test(String(current)))) directionTasks.push(task);
  });
  post.tasksAnnie = directionTasks;
  post.taskOwnersVersion = "event-task-owners-2026-07-17-human-interview-v1";
}

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

#LeMotDuLac #BleuMassawippi #LacMassawippi #Tributaires #BassinVersant

=========================================

EN — Lake word of the day: tributary.

A tributary is a stream or river that flows into another waterway or a lake. Around Massawippi, tributaries connect the whole watershed, so what happens upstream can eventually reach the lake.

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

const DONATION_CADENCE_POSTS = [
  {
    id: "don-20260729-appel-soutien",
    w: 2,
    date: "Mercredi 22 juillet",
    calendarTime: "12:00",
    t: "Soutien",
    tier: "Pilier",
    title: "Doublez votre impact pour le lac",
    format: "Photo réelle + note manuscrite 4:5 · appel bilingue",
    role: "Inviter chaleureusement à devenir membre ou à faire un don, en précisant que le doublement par le fonds spécial vise uniquement la nouvelle adhésion de 100 $.",
    cta: "Devenir membre ou faire un don",
    visual: "Photographie réelle du lac fournie par l’association, conservée reconnaissable; carnet ivoire au premier plan avec le titre manuscrit bilingue « Doublez votre impact / Double your impact » et la précision « Nouvelle adhésion : 100 $ → 200 $ pour le lac ».",
    source: "Documents internes SharePoint vérifiés le 21 juillet 2026 : Passation communication; Campagne 2026 FR; 20260304 - Campagne 2026 EN. Ces documents limitent le doublement à la contribution des nouveaux membres grâce à un fonds spécial. Liens Zeffy vérifiés : https://www.zeffy.com/fr-CA/ticketing/42ba0194-3043-44a6-a194-b6e7e6b43007 · https://www.zeffy.com/en-CA/ticketing/42ba0194-3043-44a6-a194-b6e7e6b43007",
    fallback: "Photographie réelle du lac avec un appel sobre à devenir membre ou à faire un don; ne jamais laisser entendre que tous les dons libres sont doublés.",
    kpi: "Nouvelles adhésions confirmées / dons libres / montant net reçu / clics vers les formulaires FR et EN",
    task: "Confirmer que le fonds spécial 2026 est toujours disponible, vérifier les deux formulaires Zeffy et programmer seulement après les validations du texte, du média et des liens.",
    copy: `FR — 💙 Doublez votre impact pour le lac.

Cet été, chaque geste aide Bleu Massawippi à mieux suivre le lac et ses tributaires, à sensibiliser la communauté et à préparer les prochaines actions sur le terrain.

Vous devenez membre pour la première fois? En choisissant l’option « Adhésion — Doublez votre impact » à 100 $, un fonds spécial porte cette nouvelle adhésion à 200 $ pour le lac.

Vous préférez simplement faire un don? Le même formulaire permet aussi de contribuer librement, au montant qui vous convient. Merci d’avancer avec nous.

Adhésion et don : https://www.zeffy.com/fr-CA/ticketing/42ba0194-3043-44a6-a194-b6e7e6b43007

#BleuMassawippi #LacMassawippi #DoublezVotreImpact #SoutenirLeLac

=========================================

EN — 💙 Double your impact for the lake.

This summer, every contribution helps Bleu Massawippi monitor the lake and its tributaries, engage the community and prepare the next actions in the field.

Are you becoming a member for the first time? When you choose the $100 “Membership — Double Your Impact” option, a special fund brings that new membership contribution to $200 for the lake.

Would you rather make a donation? The same form also lets you contribute freely, in the amount that is right for you. Thank you for moving forward with us.

Membership and donation: https://www.zeffy.com/en-CA/ticketing/42ba0194-3043-44a6-a194-b6e7e6b43007

#BleuMassawippi #LakeMassawippi #DoubleYourImpact #SupportTheLake`,
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
    isAlternative: false,
    decisionLocked: true,
    parallelOperationalItem: false,
    calendarPriority: "donation-cadence",
    replacesDailySlot: true,
    donationCadence: "biweekly-wednesday",
    rescheduledFrom: "2026-07-29",
    rescheduledReason: "Appel avancé au mercredi 22 juillet à la demande des communications; l’identifiant est conservé pour préserver le feu vert texte et l’historique Firestore existants.",
    tasksValentin: [
      "Ouvrir et vérifier séparément les formulaires Zeffy français et anglais, puis confirmer que les deux mènent à la même campagne officielle.",
      "Conserver la distinction entre nouvelle adhésion doublée et don libre, finaliser le visuel réel 4:5 et soumettre le média aux validations prévues.",
      "Programmer sur Facebook et Instagram, puis relever séparément les nouvelles adhésions et les dons confirmés dans le rapport Paiements de Zeffy pour préparer le bilan."
    ],
    tasksAnnie: [
      "Confirmer que le fonds spécial 2026 peut encore doubler les nouvelles adhésions de 100 $, puis approuver le texte et le média."
    ],
    taskOwnersVersion: "event-task-owners-2026-07-21-donation-match-v2"
  },
  {
    id: "don-20260807-merci-bilan",
    w: 4,
    date: "Vendredi 7 août",
    calendarTime: "12:00",
    t: "Gratitude",
    tier: "Pilier",
    title: "Merci de faire grandir l’élan autour du lac",
    format: "Photo réelle + bilan de dons bilingue",
    role: "Remercier avec précision et transparence le vendredi de la semaine suivant l’appel, en utilisant uniquement le montant net réellement confirmé.",
    cta: "Remercier et montrer la suite",
    visual: "Photographie réelle et autorisée du lac ou d’une action concrète; courte mention manuscrite « Merci d’être là pour le lac ».",
    source: "Zeffy — rapport Paiements filtré par date de paiement, statut Réussi et formulaire; exclure remboursements, litiges et paiements hors ligne non reçus.",
    fallback: "Si aucun montant n’est prêt, reporter cette publication; ne jamais afficher un chiffre estimé ni un champ temporaire.",
    kpi: "Montant net confirmé / donateurs remerciés / partages",
    task: "Remplacer les deux champs entre crochets par des données Zeffy vérifiées, faire relire le contexte et ne programmer qu’après disparition complète des champs temporaires.",
    copy: `FR — Merci d’être là pour le lac.

Depuis notre appel du [DATE DE L’APPEL], votre générosité a permis de réunir [MONTANT NET CONFIRMÉ] pour soutenir le travail de Bleu Massawippi.

Derrière ce résultat, il y a des personnes qui choisissent d’agir à leur mesure. Chaque contribution nourrit un effort collectif : mieux suivre le lac, mieux partager les connaissances et mieux préparer les actions à venir.

Merci pour votre confiance.

#BleuMassawippi #LacMassawippi #Merci #SoutenirLeLac

=========================================

EN — Thank you for being there for the lake.

Since our appeal on [APPEAL DATE], your generosity has raised [CONFIRMED NET AMOUNT] to support Bleu Massawippi’s work.

Behind this result are people choosing to act in ways that are right for them. Every contribution strengthens a shared effort: monitoring the lake, sharing knowledge and preparing the actions ahead.

Thank you for your trust.

#BleuMassawippi #LakeMassawippi #ThankYou #SupportTheLake`,
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
    isAlternative: false,
    decisionLocked: true,
    parallelOperationalItem: false,
    calendarPriority: "donation-cadence",
    replacesDailySlot: true,
    donationCadence: "following-week-friday",
    publicationBlocked: true,
    requiresConfirmedDonationAmount: true,
    requiredPlaceholders: ["[DATE DE L’APPEL]", "[MONTANT NET CONFIRMÉ]", "[APPEAL DATE]", "[CONFIRMED NET AMOUNT]"],
    tasksValentin: [
      "Dans Zeffy, filtrer le rapport Paiements depuis l’appel et conserver seulement les transactions réussies réellement reçues.",
      "Remplacer les quatre champs temporaires, documenter la période et le montant net, puis vérifier que le texte ne laisse aucun champ entre crochets.",
      "Choisir une photographie réelle autorisée, soumettre le texte et le média, puis programmer seulement lorsque le blocage de données est levé."
    ],
    tasksAnnie: [
      "Confirmer le montant net et la période de référence, puis approuver le texte et le média avant diffusion."
    ],
    taskOwnersVersion: "event-task-owners-2026-07-20-donation-cycle-v1"
  }
];

const CONTINUITY_POSTS = [
  {
    id: "poesie-20260821-invitation-public",
    w: 6,
    date: "Vendredi 21 août",
    calendarTime: "12:00",
    t: "Événement",
    tier: "Pilier",
    title: "Au bord du bleu — 13 voix au rendez-vous",
    format: "Affiche bilingue événementielle V8 · invitation publique",
    role: "Inviter le public à Au bord du bleu, annoncer le décompte consolidé de 13 contributions et rappeler uniquement la plage publique de 13 h à 16 h.",
    cta: "Venir écouter au bord du lac",
    visual: "Dernière affiche événementielle bilingue Au bord du bleu, version V8, déjà conservée dans l’encart interne du projet; aucun appel aux candidatures.",
    source: "Registre canonique interne Au bord du bleu du 20 août 2026 : 15 réponses Forms, 14 personnes uniques, 13 contributions actives, dont 12 personnes sur place et le texte d’une poète absente lu sur place. Affiche V8 du projet interne.",
    fallback: "Utiliser exclusivement l’affiche événementielle V8 courante; ne pas réutiliser l’affiche V7 de recrutement et ne pas annoncer le déroulé interne de 13 h 20 dans la publication publique.",
    kpi: "Portée locale / partages / réponses d’intention / présence du public",
    task: "Relire la légende et l’affiche V8, puis publier manuellement le 21 août seulement après la vérification finale; aucune programmation automatique.",
    copy: `FR — 🌊 Au bord du bleu approche!

Le dimanche 30 août, 13 poètes et artistes de la parole feront résonner le lac Massawippi. Douze seront parmi nous au parc Lôbadanaki, tandis que le texte d’une treizième poète, absente ce jour-là, sera lu sur place. Poésie, prose, slam et parole vivante se rencontreront au bord de l’eau.

Le public est accueilli librement de 13 h à 16 h. Venez écouter, découvrir des voix d’ici et d’ailleurs, et partager un après-midi simple et chaleureux au bord du lac.

📍 Parc Lôbadanaki, North Hatley
📅 Dimanche 30 août 2026
🕐 13 h à 16 h
🎟 Entrée libre

#AuBordDuBleu #BleuMassawippi #Poésie #LacMassawippi

=========================================

EN — 🌊 Au bord du bleu is almost here!

On Sunday, August 30, 13 poets and spoken-word artists will bring their voices to Lake Massawippi. Twelve will join us at parc Lôbadanaki, while a thirteenth poet’s text will be read on site in her absence. Poetry, prose, spoken word and living voices will meet by the water.

The public is welcome anytime from 1 to 4 p.m. Come listen, discover voices from near and far, and share a simple, warm afternoon by the lake.

📍 Parc Lôbadanaki, North Hatley
📅 Sunday, August 30, 2026
🕐 1–4 p.m.
🎟 Free admission

#AuBordDuBleu #BleuMassawippi #Poetry #LakeMassawippi`,
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
    isAlternative: false,
    publicationBlocked: false,
    tasksValentin: [
      "Relire la légende bilingue et vérifier qu’elle annonce 13 contributions sans nommer la personne absente.",
      "Vérifier l’aperçu mobile de l’affiche V8 et publier manuellement le 21 août; ne pas programmer automatiquement."
    ],
    tasksAnnie: [],
    taskOwnersVersion: "event-task-owners-2026-08-20-poetry-invitation-v1"
  },
  {
    id: "poesie-20260829-rappel-demain",
    w: 7,
    date: "Samedi 29 août",
    calendarTime: "10:00",
    t: "Événement",
    tier: "Pilier",
    title: "Au bord du bleu, c’est demain!",
    format: "Affiche bilingue événementielle V8 · rappel de la veille",
    role: "Rappeler chaleureusement la tenue d’Au bord du bleu le lendemain, avec les informations publiques confirmées et sans rouvrir l’appel aux voix.",
    cta: "Venir nous rejoindre demain au bord du lac",
    visual: "Réutiliser exclusivement l’affiche événementielle bilingue V8 confirmée pour Au bord du bleu; aucun appel aux candidatures.",
    source: "Projet interne Au bord du bleu : événement public confirmé le dimanche 30 août 2026, de 13 h à 16 h, au parc Lôbadanaki à North Hatley; affiche bilingue V8 déjà utilisée pour l’invitation publique.",
    fallback: "Si l’affiche V8 n’est pas accessible, ne pas substituer une ancienne affiche de recrutement; corriger d’abord l’accès au média confirmé.",
    kpi: "Portée locale / partages / réponses d’intention / présence du public",
    task: "Relire les informations pratiques, vérifier l’aperçu mobile de l’affiche V8 et publier manuellement le 29 août après validation; ne pas marquer terminé avant la diffusion réelle.",
    copy: `FR — 🌊 Au bord du bleu, c’est demain!

Ce dimanche 30 août, poésie, prose et slam se rencontrent au bord du lac Massawippi. Venez écouter les voix réunies pour l’occasion et partager un après-midi simple, libre et chaleureux au parc Lôbadanaki.

Le public est accueilli de 13 h à 16 h et l’entrée est libre. Si vous le souhaitez, apportez une chaise ou une couverture pour vous installer dans l’herbe. Venez nombreux!

📍 Parc Lôbadanaki, North Hatley
📅 Dimanche 30 août 2026
🕐 13 h à 16 h
🎟 Entrée libre

#AuBordDuBleu #BleuMassawippi #Poésie #LacMassawippi

=========================================

EN — 🌊 Au bord du bleu is tomorrow!

This Sunday, August 30, poetry, prose and spoken word will meet by Lake Massawippi. Come hear the voices gathered for the occasion and share a simple, welcoming afternoon at parc Lôbadanaki.

The public is welcome from 1 to 4 p.m. and admission is free. Bring a chair or blanket if you would like to settle on the grass. We hope to see you there!

📍 Parc Lôbadanaki, North Hatley
📅 Sunday, August 30, 2026
🕐 1–4 p.m.
🎟 Free admission

#AuBordDuBleu #BleuMassawippi #Poetry #LakeMassawippi`,
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
    isAlternative: false,
    publicationBlocked: false,
    tasksValentin: [
      "Vérifier une dernière fois la date, l’heure, le lieu et l’aperçu mobile de l’affiche V8.",
      "Publier ou programmer manuellement le 29 août après les validations; ne pas marquer terminé avant la diffusion réelle."
    ],
    tasksAnnie: [
      "Confirmer la légende bilingue et l’affiche V8 du rappel de la veille."
    ],
    taskOwnersVersion: "event-task-owners-2026-08-27-poetry-reminder-v1"
  },
  {
    id: "poesie-20260830-rappel-aujourdhui",
    w: 7,
    date: "Dimanche 30 août",
    calendarTime: "09:00",
    t: "Événement",
    tier: "Pilier",
    title: "Au bord du bleu, c’est aujourd’hui!",
    format: "Affiche bilingue événementielle V8 · rappel du jour",
    role: "Inviter une dernière fois le public à rejoindre Au bord du bleu le jour même, avec un message immédiat, pratique et accueillant.",
    cta: "Nous rejoindre aujourd’hui au parc Lôbadanaki",
    visual: "Réutiliser exclusivement l’affiche événementielle bilingue V8 confirmée pour Au bord du bleu; aucun appel aux candidatures.",
    source: "Projet interne Au bord du bleu : événement public confirmé le dimanche 30 août 2026, de 13 h à 16 h, au parc Lôbadanaki à North Hatley; affiche bilingue V8 déjà utilisée pour l’invitation publique.",
    fallback: "Si l’affiche V8 n’est pas accessible, ne pas substituer une ancienne affiche de recrutement; corriger d’abord l’accès au média confirmé.",
    kpi: "Portée locale le jour même / partages / présence du public",
    task: "Relire les informations pratiques, vérifier l’aperçu mobile de l’affiche V8 et publier manuellement le 30 août après validation; ne pas marquer terminé avant la diffusion réelle.",
    copy: `FR — 🌊 Au bord du bleu, c’est aujourd’hui!

On vous accueille cet après-midi au parc Lôbadanaki pour faire entendre poésie, prose et slam au bord du lac Massawippi.

Venez quand vous le souhaitez entre 13 h et 16 h pour écouter les voix réunies pour l’occasion, découvrir des textes d’ici et d’ailleurs et partager un moment chaleureux au bord de l’eau. L’entrée est libre. Une chaise ou une couverture peut être pratique pour vous installer dans l’herbe.

📍 Parc Lôbadanaki, North Hatley
🕐 Aujourd’hui, de 13 h à 16 h
🎟 Entrée libre

#AuBordDuBleu #BleuMassawippi #Poésie #LacMassawippi

=========================================

EN — 🌊 Au bord du bleu is today!

Join us this afternoon at parc Lôbadanaki for poetry, prose and spoken word by Lake Massawippi.

Come anytime between 1 and 4 p.m. to hear the voices gathered for the occasion, discover writing from near and far, and share a warm moment by the water. Admission is free. A chair or blanket may be useful if you would like to sit on the grass.

📍 Parc Lôbadanaki, North Hatley
🕐 Today, 1–4 p.m.
🎟 Free admission

#AuBordDuBleu #BleuMassawippi #Poetry #LakeMassawippi`,
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
    isAlternative: false,
    publicationBlocked: false,
    tasksValentin: [
      "Vérifier une dernière fois l’heure, le lieu et l’aperçu mobile de l’affiche V8.",
      "Publier manuellement le 30 août après les validations; ne pas marquer terminé avant la diffusion réelle."
    ],
    tasksAnnie: [
      "Confirmer la légende bilingue et l’affiche V8 du rappel du jour."
    ],
    taskOwnersVersion: "event-task-owners-2026-08-27-poetry-reminder-v1"
  },
  {
    id: "don-20260909-appel-soutien",
    w: 9,
    date: "Mercredi 9 septembre",
    calendarTime: "12:00",
    t: "Soutien",
    tier: "Pilier",
    title: "Le point soutien — merci d’avancer avec nous",
    format: "Souvenir sur le frigo + photographie réelle · point bilingue",
    role: "Présenter le total de campagne et sa date de vérification, remercier puis rappeler doucement qu’il est toujours possible de soutenir Bleu Massawippi.",
    cta: "Voir le point et soutenir la mission",
    visual: "Photographie réelle du lac présentée comme un souvenir familier sur un réfrigérateur, avec le remerciement bilingue Merci pour vos dons / Thank you for your donation en lettres aimantées colorées. Aucun chiffre dans l’image.",
    source: "Campagne Zeffy officielle de Bleu Massawippi : https://www.zeffy.com/fr-CA/ticketing/42ba0194-3043-44a6-a194-b6e7e6b43007 · https://www.zeffy.com/en-CA/ticketing/42ba0194-3043-44a6-a194-b6e7e6b43007",
    fallback: "Si le total ou sa date ne sont pas confirmés, reporter ce point de soutien; ne jamais diffuser un chiffre estimé ni un champ temporaire.",
    kpi: "Total confirmé / date de vérification / clics vers Zeffy / adhésions et dons confirmés",
    task: "Vérifier le total de campagne et sa date dans Zeffy, remplacer les quatre champs temporaires, vérifier les deux liens et programmer seulement après les validations du texte et du média.",
    copy: `FR — 💙 Le point soutien.

Au [DATE DE VÉRIFICATION], le total confirmé de notre campagne s’élève à [MONTANT TOTAL CONFIRMÉ]. Merci à toutes les personnes qui font avancer la mission de Bleu Massawippi, à leur mesure.

Ces contributions nous aident à mieux connaître le lac et ses tributaires, à partager des repères accessibles et à préparer des actions concrètes avec la communauté.

Vous souhaitez ajouter votre geste? Adhésion ou don : https://www.zeffy.com/fr-CA/ticketing/42ba0194-3043-44a6-a194-b6e7e6b43007

#BleuMassawippi #LacMassawippi #SoutenirLeLac

=========================================

EN — 💙 Support update.

As of [VERIFICATION DATE], the confirmed campaign total is [CONFIRMED CAMPAIGN TOTAL]. Thank you to everyone helping Bleu Massawippi move its mission forward, in the way that is right for them.

These contributions help us better understand the lake and its tributaries, share accessible knowledge and prepare practical action with the community.

Would you like to add your support? Membership or donation: https://www.zeffy.com/en-CA/ticketing/42ba0194-3043-44a6-a194-b6e7e6b43007

#BleuMassawippi #LakeMassawippi #SupportTheLake`,
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
    isAlternative: false,
    publicationBlocked: true,
    requiresConfirmedDonationAmount: true,
    donationCadence: "biweekly-friday-update",
    requiredPlaceholders: ["[DATE DE VÉRIFICATION]", "[MONTANT TOTAL CONFIRMÉ]", "[VERIFICATION DATE]", "[CONFIRMED CAMPAIGN TOTAL]"],
    tasksValentin: [
      "Vérifier dans Zeffy le total confirmé et la date exacte du relevé, puis remplacer les quatre champs temporaires.",
      "Vérifier séparément les formulaires Zeffy français et anglais et confirmer qu’ils sont toujours actifs.",
      "Vérifier le crédit de la photographie réelle, soumettre les validations et programmer seulement après la levée du blocage."
    ],
    tasksAnnie: [
      "Confirmer le total, la date et le ton du rappel, puis approuver le texte et le média."
    ],
    taskOwnersVersion: "event-task-owners-2026-07-29-continuity-v1"
  },
  {
    id: "nature-20260910-feuille-surface",
    w: 9,
    date: "Jeudi 10 septembre",
    calendarTime: "12:00",
    t: "Nature",
    tier: "Passerelle",
    title: "Le castor, architecte des milieux humides",
    format: "Photographie réelle naturaliste",
    role: "Offrir une pause d’observation autour d’un mammifère aquatique et de ses traces, sans présenter la photographie comme une observation locale.",
    cta: "Repérer les traces",
    visual: "Photographie réelle d’un castor du Canada nageant dans un étang; aucun ajout à la scène et aucune affirmation que la photo vient du lac Massawippi.",
    source: "Gouvernement du Québec — fiche Castor du Canada; photographie NPS / Mary Lewandowski, parc national de Denali, domaine public.",
    fallback: "Photographie réelle d’un mammifère aquatique dont l’espèce, le crédit, la licence et le lieu sont confirmés.",
    kpi: "Enregistrements / commentaires d’observation",
    task: "Conserver la provenance exacte de la photographie, vérifier les repères naturalistes et préparer un texte alternatif bilingue.",
    copy: `FR — Un castor ne se remarque pas toujours par sa silhouette. Une branche fraîchement rongée, une hutte ou un changement dans l’écoulement peuvent aussi révéler son passage.

En régulant l’eau avec ses barrages, le castor transforme son milieu et peut créer des habitats dont profitent d’autres espèces. Son rôle varie selon l’endroit : l’observation attentive vient avant toute intervention.

Cette photo documentaire a été prise au parc national de Denali, en Alaska; elle n’est pas présentée comme une observation au lac Massawippi.

Quel mammifère du bassin versant aimeriez-vous mieux connaître?

#BleuMassawippi #LacMassawippi #CuriositéNature

=========================================

EN — A beaver is not always noticed by its silhouette. A freshly gnawed branch, a lodge or a change in water flow can also reveal its passage.

By regulating water with its dams, a beaver transforms its surroundings and can create habitat used by other species. Its role varies from place to place: careful observation comes before any intervention.

This documentary photograph was taken in Denali National Park, Alaska; it is not presented as an observation from Lake Massawippi.

Which mammal from the watershed would you like to learn more about?

#BleuMassawippi #LakeMassawippi #NatureCuriosity`,
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
    isAlternative: false,
    tasksValentin: [
      "Conserver le crédit du domaine public et vérifier que la légende ne suggère aucune observation locale.",
      "Préparer le texte alternatif bilingue et vérifier la lisibilité mobile de la photographie réelle.",
      "Soumettre les validations puis programmer la publication."
    ],
    tasksAnnie: [
      "Valider l’angle de découverte et signaler seulement un enjeu institutionnel ou naturaliste à corriger."
    ],
    taskOwnersVersion: "event-task-owners-2026-07-29-continuity-v1"
  },
  {
    id: "don-20260911-merci-bilan",
    w: 9,
    date: "Vendredi 11 septembre",
    calendarTime: "12:00",
    t: "Gratitude",
    tier: "Pilier",
    title: "Le point soutien — chaque geste compte",
    format: "Photographie réelle + point de campagne bilingue",
    role: "Présenter le total de campagne et sa date de vérification, remercier puis rappeler doucement qu’il est toujours possible de soutenir Bleu Massawippi.",
    cta: "Voir le point et soutenir la mission",
    visual: "Roue de progression simple et très lisible, associée à une photographie réelle du lac Massawippi. Afficher seulement le total confirmé, sa date de vérification et l’objectif de campagne confirmé. Ne jamais déduire ni afficher un pourcentage sans dénominateur vérifié.",
    source: "Zeffy — rapport Paiements de la campagne, statut Réussi; exclure remboursements, litiges et paiements non reçus. Liens : https://www.zeffy.com/fr-CA/ticketing/42ba0194-3043-44a6-a194-b6e7e6b43007 · https://www.zeffy.com/en-CA/ticketing/42ba0194-3043-44a6-a194-b6e7e6b43007",
    fallback: "Si le total ou sa date ne sont pas confirmés, reporter ce point de soutien et utiliser une publication de réserve; ne jamais diffuser les champs temporaires.",
    kpi: "Total confirmé / date de vérification / clics vers Zeffy / adhésions et dons confirmés",
    task: "Vérifier le total de campagne, l’objectif qui sert de dénominateur et la date du relevé dans Zeffy; produire ensuite la roue de progression, remplacer les quatre champs temporaires, vérifier les deux liens et lever le blocage seulement après double vérification.",
    copy: `FR — 💙 Chaque geste compte.

Au [DATE DE VÉRIFICATION], le total confirmé de notre campagne s’élève à [MONTANT TOTAL CONFIRMÉ]. Merci à toutes les personnes qui choisissent de soutenir le lac et la mission de Bleu Massawippi.

Cet élan nous aide à mieux suivre le territoire, à rendre les connaissances accessibles et à préparer la suite avec soin.

Vous souhaitez participer? Adhésion ou don : https://www.zeffy.com/fr-CA/ticketing/42ba0194-3043-44a6-a194-b6e7e6b43007

#BleuMassawippi #LacMassawippi #Merci

=========================================

EN — 💙 Every contribution matters.

As of [VERIFICATION DATE], the confirmed campaign total is [CONFIRMED CAMPAIGN TOTAL]. Thank you to everyone choosing to support the lake and Bleu Massawippi’s mission.

This momentum helps us monitor the region, make knowledge accessible and prepare the next steps with care.

Would you like to take part? Membership or donation: https://www.zeffy.com/en-CA/ticketing/42ba0194-3043-44a6-a194-b6e7e6b43007

#BleuMassawippi #LakeMassawippi #ThankYou`,
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
    isAlternative: false,
    publicationBlocked: true,
    requiresConfirmedDonationAmount: true,
    donationCadence: "biweekly-friday-update",
    requiredPlaceholders: ["[DATE DE VÉRIFICATION]", "[MONTANT TOTAL CONFIRMÉ]", "[VERIFICATION DATE]", "[CONFIRMED CAMPAIGN TOTAL]"],
    tasksValentin: [
      "Vérifier dans Zeffy le total confirmé, la date exacte du relevé et l’objectif de campagne qui sert de dénominateur.",
      "Produire la roue de progression demandée par la direction seulement après validation de ces trois données; conserver la photographie réelle comme base ou référence visuelle.",
      "Remplacer les quatre champs temporaires dans le texte.",
      "Vérifier les deux formulaires Zeffy et documenter le relevé utilisé.",
      "Finaliser le média, soumettre les validations et programmer seulement après la levée du blocage."
    ],
    tasksAnnie: [
      "Confirmer le total, la date et le ton du rappel, puis approuver le texte et le média avant diffusion."
    ],
    taskOwnersVersion: "event-task-owners-2026-07-29-continuity-v1"
  },
  {
    id: "don-20260918-point-soutien",
    w: 10,
    date: "Vendredi 18 septembre",
    calendarTime: "12:00",
    t: "Soutien",
    tier: "Pilier",
    title: "Le point soutien — ensemble, près du lac",
    format: "Photographie réelle + point de campagne bilingue",
    role: "Présenter le total de campagne et sa date de vérification, remercier puis rappeler doucement qu’il est toujours possible de soutenir Bleu Massawippi.",
    cta: "Voir le point et soutenir la mission",
    visual: "Photographie aérienne réelle du lac Massawippi, sobre et familière; aucun montant n’est inscrit dans l’image afin que la donnée reste vérifiable dans la légende.",
    source: "Zeffy — rapport Paiements de la campagne, statut Réussi; exclure remboursements, litiges et paiements non reçus. Liens : https://www.zeffy.com/fr-CA/ticketing/42ba0194-3043-44a6-a194-b6e7e6b43007 · https://www.zeffy.com/en-CA/ticketing/42ba0194-3043-44a6-a194-b6e7e6b43007",
    fallback: "Si le total ou sa date ne sont pas confirmés, reporter ce point de soutien; ne jamais diffuser un chiffre estimé ni un champ temporaire.",
    kpi: "Total confirmé / date de vérification / clics vers Zeffy / adhésions et dons confirmés",
    task: "Vérifier le total de campagne et sa date dans Zeffy, remplacer les quatre champs temporaires, vérifier les deux liens et programmer seulement après les validations du texte et du média.",
    copy: `FR — 💙 Ensemble, près du lac.

Au [DATE DE VÉRIFICATION], le total confirmé de notre campagne s’élève à [MONTANT TOTAL CONFIRMÉ]. Merci à toutes les personnes qui donnent à Bleu Massawippi les moyens de mieux comprendre le lac, de partager l’information et d’agir avec la communauté.

Chaque geste compte, à la mesure de chacun.

Adhésion ou don : https://www.zeffy.com/fr-CA/ticketing/42ba0194-3043-44a6-a194-b6e7e6b43007

#BleuMassawippi #LacMassawippi #SoutenirLeLac

=========================================

EN — 💙 Together, close to the lake.

As of [VERIFICATION DATE], the confirmed campaign total is [CONFIRMED CAMPAIGN TOTAL]. Thank you to everyone giving Bleu Massawippi the means to better understand the lake, share information and act with the community.

Every contribution matters, in the way that is right for each person.

Membership or donation: https://www.zeffy.com/en-CA/ticketing/42ba0194-3043-44a6-a194-b6e7e6b43007

#BleuMassawippi #LakeMassawippi #SupportTheLake`,
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
    isAlternative: false,
    publicationBlocked: true,
    requiresConfirmedDonationAmount: true,
    donationCadence: "biweekly-friday-update",
    requiredPlaceholders: ["[DATE DE VÉRIFICATION]", "[MONTANT TOTAL CONFIRMÉ]", "[VERIFICATION DATE]", "[CONFIRMED CAMPAIGN TOTAL]"],
    tasksValentin: [
      "Vérifier dans Zeffy le total confirmé et la date exacte du relevé, puis remplacer les quatre champs temporaires.",
      "Vérifier séparément les formulaires Zeffy français et anglais et conserver la preuve du relevé.",
      "Vérifier le crédit de la photographie réelle, soumettre les validations et programmer seulement après la levée du blocage."
    ],
    tasksAnnie: [
      "Confirmer le total, la date et le ton du rappel, puis approuver le texte et le média."
    ],
    taskOwnersVersion: "event-task-owners-2026-08-17-donation-cycle-v1"
  },
  {
    id: "archives-20260912-vos-images",
    w: 9,
    date: "Samedi 12 septembre",
    calendarTime: "11:00",
    t: "Patrimoine",
    tier: "Passerelle",
    title: "Une photo peut réveiller toute une histoire",
    format: "Photographie d’archive + invitation bilingue",
    role: "Inviter la communauté à signaler des archives familiales sans réclamer de cession publique ni reproduire un témoignage sans accord.",
    cta: "Nous écrire avant de partager",
    visual: "Photographie réelle nocturne du Pub Pilsen éclairé, avec ses reflets sur la rivière Massawippi; aucun ajout ni transformation de la scène.",
    source: "Guerinf — 55, rue Main, North Hatley, Pub Pilsen, 26 juillet 2025, Wikimedia Commons, CC0; crédit recommandé.",
    fallback: "Photographie réelle d’un lieu familier autour du lac, créditée au complet et sans détail inventé.",
    kpi: "Messages reçus / archives proposées / renseignements vérifiables",
    task: "Conserver le crédit recommandé de l’image et préparer une méthode simple pour recevoir une copie et ses renseignements sans publier automatiquement.",
    copy: `FR — Une photo de soir peut déjà raconter un lieu autrement. Ici, les lumières du Pub Pilsen se reflètent dans la rivière Massawippi, à North Hatley.

Les images de lieux familiers deviennent peu à peu des repères de mémoire. Votre famille conserve-t-elle une image du lac Massawippi, de ses villages, de ses rives ou de la rivière? Écrivez-nous avant de la partager publiquement. Nous pourrons prendre le temps de noter la date, le lieu, les personnes, le crédit et les conditions d’utilisation.

Chaque détail vérifiable aide à garder la mémoire du territoire bien vivante.

Photo : Guerinf, CC0.

#BleuMassawippi #LacMassawippi #MémoireDuLac

=========================================

EN — An evening photograph can already tell the story of a place differently. Here, the lights of Pub Pilsen are reflected in the Massawippi River in North Hatley.

Images of familiar places gradually become markers of memory. Does your family have an image of Lake Massawippi, its villages, shorelines or river? Write to us before sharing it publicly. Together, we can record the date, place, people, credit and conditions of use.

Every verifiable detail helps keep the region’s memory alive.

Photo: Guerinf, CC0.

#BleuMassawippi #LakeMassawippi #LakeMemories`,
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
    isAlternative: false,
    tasksValentin: [
      "Conserver le crédit recommandé, la date et la légende de la photographie CC0 utilisée.",
      "Préparer un texte alternatif bilingue et une réponse-type privée pour recueillir les renseignements d’une archive proposée.",
      "Soumettre les validations puis programmer sans reprendre une archive ou un témoignage sans accord."
    ],
    tasksAnnie: [
      "Confirmer que la méthode de collecte protège les personnes, les droits et les renseignements sensibles."
    ],
    taskOwnersVersion: "event-task-owners-2026-07-29-continuity-v1"
  },
  {
    id: "quiz-20260913-trois-gestes",
    w: 9,
    date: "Dimanche 13 septembre",
    calendarTime: "11:00",
    t: "Interaction",
    tier: "Passerelle",
    title: "Quiz du lac : les trois gestes qui voyagent bien",
    format: "Photographie réelle + quiz bilingue",
    role: "Réactiver un repère de prévention sous forme de jeu bref et orienter vers le quiz bilingue de Bleu Massawippi.",
    cta: "Répondre puis continuer le quiz",
    visual: "Photographie réelle en plan rapproché d’une personne en kayak sur une eau libre; aucun texte incrusté ni affirmation que la scène vient du lac Massawippi.",
    source: "NPS / Andrew Cattoir — Kayaking Near Boulder Harbor, 19 juin 2020, domaine public; Gouvernement du Québec — nettoyage des embarcations; quiz bilingue Bleu Massawippi : https://bleumassawippi.com/quiz",
    fallback: "Autre photographie réelle de kayak dont le crédit, la licence et le lieu sont confirmés; la question et la réponse restent dans la légende.",
    kpi: "Réponses / clics vers le quiz / enregistrements",
    task: "Vérifier le lien du quiz et la formulation des trois gestes, puis programmer après validation.",
    copy: `FR — Petit quiz du dimanche. 👀

Après une sortie, quels gestes doivent aussi s’appliquer aux pagaies, cordes, vestes de flottaison et autres équipements qui ont touché l’eau?

A — Nettoyer
B — Vider
C — Sécher
D — Les trois

Réponse : D. Les petits équipements voyagent eux aussi d’un plan d’eau à l’autre.

Envie de continuer? Plus de 500 questions bilingues vous attendent : https://bleumassawippi.com/quiz

#BleuMassawippi #LacMassawippi #QuizDuLac

=========================================

EN — A little Sunday quiz. 👀

After an outing, which actions should also apply to paddles, ropes, life jackets and other equipment that touched the water?

A — Clean
B — Drain
C — Dry
D — All three

Answer: D. Small equipment also travels from one body of water to another.

Want to keep playing? More than 500 bilingual questions await: https://bleumassawippi.com/quiz

#BleuMassawippi #LakeMassawippi #LakeQuiz`,
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
    isAlternative: false,
    contentVariant: "quiz",
    tasksValentin: [
      "Vérifier la source gouvernementale et le lien du quiz bilingue.",
      "Conserver le crédit NPS, vérifier la réponse, le texte alternatif et la lisibilité mobile.",
      "Soumettre les validations puis programmer la publication."
    ],
    tasksAnnie: [
      "Valider que le rappel est exact, accueillant et adapté au contexte institutionnel."
    ],
    taskOwnersVersion: "event-task-owners-2026-07-29-continuity-v1"
  },
  {
    id: "photo-20260915-soir-automne",
    w: 10,
    date: "Mardi 15 septembre",
    calendarTime: "12:00",
    t: "Contemplation",
    tier: "Passerelle",
    title: "Le soir change notre regard",
    format: "Photographie d’archive réelle + légende bilingue",
    role: "Terminer la séquence par une pause contemplative distincte, fondée sur une photographie authentique du lac et clairement datée comme archive.",
    cta: "Observer un détail",
    visual: "Photographie réelle du lac Massawippi au crépuscule, recadrée mécaniquement en 4:5 sans ajout ni modification de la scène.",
    source: "Philzzz77 — Lac Massawippi soirée automne 2024, 4 septembre 2024, Wikimedia Commons, CC BY-SA 4.0.",
    fallback: "Photographie réelle du lac dont la date, le crédit et la licence sont explicitement conservés.",
    kpi: "Enregistrements / commentaires d’observation",
    task: "Vérifier le crédit CC BY-SA 4.0, le texte alternatif et la cohérence bilingue avant programmation.",
    copy: `FR — À la fin du jour, le lac semble se faire plus silencieux. La lumière glisse sur l’eau, les rives deviennent des silhouettes et un paysage familier se révèle autrement.

Cette photographie d’archive, prise en septembre 2024, ne montre pas l’état du lac aujourd’hui. Elle nous rappelle qu’un lieu n’est jamais identique : il se transforme avec le temps, les saisons et nos yeux.

Quel détail attire votre regard en premier?

Photo : Philzzz77, CC BY-SA 4.0.

#BleuMassawippi #LacMassawippi #AuFilDuLac

=========================================

EN — At the end of the day, the lake seems to grow quieter. Light moves across the water, the shorelines become silhouettes and a familiar landscape reveals itself differently.

This archival photograph, taken in September 2024, does not show the lake’s current condition. It simply reminds us that the same place never looks quite the same twice.

What detail catches your eye first?

Photo: Philzzz77, CC BY-SA 4.0.

#BleuMassawippi #LakeMassawippi #AlongTheLake`,
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
    isAlternative: false,
    tasksValentin: [
      "Conserver le crédit, la date d’archive et la licence CC BY-SA 4.0 dans la légende.",
      "Vérifier le recadrage 4:5, le texte alternatif bilingue et la lisibilité mobile.",
      "Soumettre les validations puis programmer la publication."
    ],
    tasksAnnie: [
      "Valider que la pause contemplative demeure claire, sobre et cohérente avec la mission."
    ],
    taskOwnersVersion: "event-task-owners-2026-08-12-continuity-v1"
  }
];

const CONTINUITY_CALENDAR_ASSIGNMENTS = [
  ["s3d1", 3, "Mercredi 29 juillet", "2026-07-29"],
  ["s4d7", 3, "Jeudi 30 juillet", "2026-07-30"],
  ["s3d3", 3, "Vendredi 31 juillet", "2026-07-31"],
  ["alt-20260722", 3, "Samedi 1er août", "2026-08-01"],
  ["s3d5", 3, "Dimanche 2 août", "2026-08-02"],
  ["poesie-20260803-rappel-candidatures", 4, "Lundi 3 août", "2026-08-03"],
  ["alt-20260731", 4, "Mardi 4 août", "2026-08-04"],
  ["alt-20260801", 4, "Mercredi 5 août", "2026-08-05"],
  ["barbotte-20260730-signalement", 4, "Jeudi 6 août", "2026-08-06"],
  ["don-20260807-merci-bilan", 4, "Vendredi 7 août", "2026-08-07"],
  ["actualite-20260808-denis-radio-canada-moules-zebrees", 4, "Samedi 8 août", "2026-08-08"],
  ["actualite-20260804-article-radio-canada-moules-zebrees", 4, "Dimanche 9 août", "2026-08-09"],
  ["alt-20260717", 5, "Lundi 10 août", "2026-08-10"],
  ["s4d1", 5, "Mardi 11 août", "2026-08-11"],
  ["s3d4", 5, "Mercredi 12 août", "2026-08-12"],
  ["alt-20260807", 5, "Jeudi 13 août", "2026-08-13"],
  ["s3d6", 5, "Vendredi 14 août", "2026-08-14"],
  ["s4d1b", 5, "Samedi 15 août", "2026-08-15"],
  ["s2d1", 5, "Dimanche 16 août", "2026-08-16"],
  ["alt-20260716", 6, "Lundi 17 août", "2026-08-17"],
  ["s3d7", 6, "Mardi 18 août", "2026-08-18"],
  ["s4d5", 6, "Jeudi 20 août", "2026-08-20"],
  ["poesie-20260821-invitation-public", 6, "Vendredi 21 août", "2026-08-21"],
  ["s4d4", 6, "Dimanche 23 août", "2026-08-23"],
  ["s4d3", 7, "Lundi 24 août", "2026-08-24"],
  ["lavage-20260903-sans-moteur", 7, "Mercredi 26 août", "2026-08-26"],
  ["s4d2", 7, "Jeudi 27 août", "2026-08-27"],
  ["don-20260909-appel-soutien", 7, "Vendredi 28 août", "2026-08-28"],
  ["poesie-20260829-rappel-demain", 7, "Samedi 29 août", "2026-08-29"],
  ["poesie-20260830-rappel-aujourdhui", 7, "Dimanche 30 août", "2026-08-30"],
  ["alt-20260724", 8, "Mardi 1er septembre", "2026-09-01"],
  ["alt-20260805", 8, "Mercredi 2 septembre", "2026-09-02"],
  ["don-20260911-merci-bilan", 8, "Vendredi 4 septembre", "2026-09-04"],
  ["alt-20260728", 8, "Samedi 5 septembre", "2026-09-05"],
  ["s1d7", 8, "Dimanche 6 septembre", "2026-09-06"],
  ["lexique-20260830-tributaire", 9, "Lundi 7 septembre", "2026-09-07"],
  ["alt-20260729", 9, "Mardi 8 septembre", "2026-09-08"],
  ["s4d6", 9, "Jeudi 10 septembre", "2026-09-10"],
  ["alt-20260802", 9, "Samedi 12 septembre", "2026-09-12"],
  ["alt-20260718", 9, "Dimanche 13 septembre", "2026-09-13"],
  ["alt-20260721", 10, "Lundi 14 septembre", "2026-09-14"],
  ["s4d7b", 10, "Mercredi 16 septembre", "2026-09-16"],
  ["alt-20260806", 10, "Jeudi 17 septembre", "2026-09-17"],
  ["don-20260918-point-soutien", 10, "Vendredi 18 septembre", "2026-09-18"],
  ["alt-20260808", 10, "Dimanche 20 septembre", "2026-09-20"],
  ["s1d3", 11, "Mardi 22 septembre", "2026-09-22"],
  ["nature-20260910-feuille-surface", 11, "Mercredi 23 septembre", "2026-09-23"],
  ["archives-20260912-vos-images", 11, "Vendredi 25 septembre", "2026-09-25"],
  ["quiz-20260913-trois-gestes", 11, "Samedi 26 septembre", "2026-09-26"],
  ["s1d2", 11, "Dimanche 27 septembre", "2026-09-27"],
  ["alt-20260714", 12, "Lundi 28 septembre", "2026-09-28"],
  ["photo-20260915-soir-automne", 12, "Mardi 29 septembre", "2026-09-29"],
  ["alt-20260723", 12, "Mercredi 30 septembre", "2026-09-30"]
];

const USER_DIRECTED_RESCHEDULES = new Map([
  ["don-20260909-appel-soutien", {
    from: "2026-08-21",
    to: "2026-08-28",
    reason: "Demande des communications du 20 août 2026 : céder le créneau du vendredi 21 août à l’invitation Au bord du bleu et reporter intégralement le point de soutien Zeffy au vendredi suivant."
  }],
  ["alt-20260723", {
    from: "2026-08-30",
    to: "2026-09-30",
    reason: "Rééquilibrage du 20 août 2026 : préserver le dimanche 30 août pour Au bord du bleu, conserver la capsule sur la rive sans concurrence le jour de l’événement et la reporter au 30 septembre."
  }],
  ["lavage-20260903-sans-moteur", {
    from: "2026-09-13",
    to: "2026-08-26",
    reason: "Demande de la direction du 24 août 2026 : avancer la capsule sur le lavage des embarcations non motorisées pendant que la fréquentation estivale du lac demeure forte."
  }],
  ["alt-20260718", {
    from: "2026-08-26",
    to: "2026-09-13",
    reason: "Rééquilibrage du 24 août 2026 : conserver intégralement la capsule sur la vie sous les feuilles au créneau libéré par l’avancement du rappel de lavage."
  }],
  ["alt-20260714", {
    from: "2026-08-29",
    to: "2026-09-28",
    reason: "Demande des communications du 27 août 2026 : réserver le samedi 29 août au rappel Au bord du bleu, tout en conservant intégralement la capsule pratique au prochain créneau libre sans collision.",
    priorHistory: [{
      from: "2026-09-14",
      to: "2026-08-29",
      reason: "Demande de la direction du 24 août 2026 : avancer à la fin août la capsule pratique sur l’essentiel à emporter afin qu’elle reste saisonnière et utile."
    }]
  }],
  ["alt-20260721", {
    from: "2026-08-29",
    to: "2026-09-14",
    reason: "Rééquilibrage du 24 août 2026 : conserver intégralement la capsule nature au créneau libéré par l’avancement de la publication saisonnière."
  }]
]);

const COMPLETED_POST_REPAIR_ROTATIONS = new Map([
  ["alt-20260731", {
    from: "2026-09-15",
    to: "2026-08-04",
    calendarTime: "12:00",
    displacedBy: null,
    reason: "Correction autorisée : restaurer au 4 août la publication déjà programmée; une publication terminée demeure à son créneau et ne peut pas être remplacée silencieusement."
  }],
  ["actualite-20260804-article-radio-canada-moules-zebrees", {
    from: "2026-08-04",
    to: "2026-08-09",
    calendarTime: "09:00",
    displacedBy: null,
    reason: "Relais Radio-Canada déplacé au dimanche 9 août afin de restaurer sans altération la publication du 4 août déjà programmée."
  }],
  ["s4d5", {
    from: "2026-09-15",
    to: "2026-08-20",
    calendarTime: "12:00",
    displacedBy: null,
    reason: "Le voyage d’une goutte de pluie est conservé au 20 août dans la nouvelle cadence variée de cinq publications par semaine, sans réutiliser l’angle éditorial refusé."
  }]
]);

const POETRY_CALL_POST = {
  id: "poesie-20260727-appel-aux-voix",
  w: 3,
  date: "Lundi 27 juillet",
  calendarTime: "12:00",
  t: "Communauté",
  tier: "Pilier",
  title: "Au bord du bleu — appel aux voix",
  format: "Affiche 4:5 + appel bilingue aux candidatures",
  role: "Inviter chaleureusement des voix expérimentées ou nouvelles à proposer une lecture pour la première rencontre de poésie, prose et slam de Bleu Massawippi.",
  cta: "Proposer une lecture avant le 9 août",
  visual: "Affiche bilingue unique Au bord du bleu, version 7 : vue du lac Massawippi, carnet réaliste, lettrage manuscrit, français et anglais réunis, date, horaire, parc prévu et échéance de candidature.",
  source: "Formulaire public bilingue autonome : https://forms.office.com/r/4A2xsMh7st · projet interne Au bord du bleu · affiche bilingue unique version 7.",
  fallback: "Carrousel sobre composé de l’affiche, des informations essentielles et du lien vers le formulaire; ne jamais remplacer le formulaire par une candidature en commentaire public.",
  kpi: "Candidatures admissibles / diversité des formes et des langues / clics vers le formulaire",
  task: "Vérifier une dernière fois le formulaire public et l’affiche, confirmer les modalités municipales connues, puis programmer l’appel bilingue et répondre aux questions sans collecter de renseignements personnels dans les commentaires publics.",
  copy: `FR — 🌊 APPEL AUX VOIX — AU BORD DU BLEU

Le dimanche 30 août, de 13 h à 16 h, Bleu Massawippi vous invite au parc Lôbadanaki, au bord du lac Massawippi, pour une première rencontre de poésie, de prose et de slam.

Protéger un lac, c’est aussi apprendre à l’aimer, à l’écouter et à lui faire une place dans nos imaginaires. Nous cherchons des voix inspirées par le Massawippi ou, plus largement, par les lacs, l’eau, les rives, le vivant, les mémoires et ce que ces paysages éveillent en nous.

Votre texte peut déjà exister, être en cours ou être créé pour l’occasion. Chaque passage durera de 5 à 15 minutes. Les voix expérimentées comme les premières participations sont les bienvenues. Le programme public durera environ une à deux heures; les détails pratiques seront transmis aux personnes retenues.

📝 Candidatures avant le dimanche 9 août à 23 h 59 : https://forms.office.com/r/4A2xsMh7st

#AuBordDuBleu #BleuMassawippi #LacMassawippi #Poésie #Slam

=========================================

EN — 🌊 CALL FOR VOICES — AU BORD DU BLEU

On Sunday, August 30, from 1 to 4 p.m., Bleu Massawippi invites you to Lôbadanaki Park, by Lake Massawippi, for a first gathering of poetry, prose and spoken word.

Protecting a lake also means learning to love it, listen to it and make room for it in our imagination. We welcome voices inspired by Massawippi or, more broadly, by lakes, water, shores, living systems, memory and what these landscapes awaken in us.

Your text may already exist, be in progress or be created for the occasion. Each passage will last 5 to 15 minutes. Experienced voices and first-time participants are equally welcome. The public program will last about one to two hours; practical details will be shared with selected participants.

📝 Apply by Sunday, August 9 at 11:59 p.m.: https://forms.office.com/r/4A2xsMh7st

#AuBordDuBleu #BleuMassawippi #LakeMassawippi #Poetry #SpokenWord`,
  choiceRequired: false,
  optionGroup: null,
  optionLabel: null,
  isAlternative: false,
  decisionLocked: true,
  parallelOperationalItem: false,
  calendarPriority: "confirmed-project-launch",
  replacesDailySlot: true,
  tasksValentin: [
    "Vérifier le formulaire public, l’affiche, le texte alternatif et les liens sur mobile et sur ordinateur.",
    "Programmer la publication bilingue sur Facebook et Instagram, puis orienter les candidatures uniquement vers le formulaire.",
    "Suivre les questions, préparer l’analyse des candidatures et proposer un plateau équilibré après la fermeture du 9 août."
  ],
  tasksAnnie: [
    "Rencontrer la municipalité pour confirmer les exigences d’utilisation du parc Lôbadanaki, la zone autorisée, l’assurance, le son et le plan météo.",
    "Valider les modalités finales qui seront transmises aux personnes retenues."
  ],
  taskOwnersVersion: "event-task-owners-2026-07-22-poetry-call-v1"
};

const POETRY_REMINDER_POST = {
  ...POETRY_CALL_POST,
  id: "poesie-20260803-rappel-candidatures",
  w: 4,
  date: "Lundi 3 août",
  calendarTime: "12:00",
  title: "Au bord du bleu — il est encore temps de proposer votre voix",
  format: "Affiche bilingue unique + rappel court",
  role: "Rappeler chaleureusement l’appel aux voix pendant qu’il reste assez de temps pour proposer un texte déjà écrit ou en préparation.",
  cta: "Proposer une lecture avant le 9 août",
  task: "Vérifier que le formulaire demeure ouvert et que les renseignements de l’affiche n’ont pas changé, puis programmer ce rappel sans modifier la publication principale.",
  copy: `FR — Un poème déjà écrit, un texte en chantier ou quelques pages que vous aimeriez faire entendre au bord du lac? Il est encore temps de proposer votre voix pour Au bord du bleu.\n\nLe dimanche 30 août, de 13 h à 16 h, Bleu Massawippi réunira poésie, prose et slam au parc Lôbadanaki, au bord du lac Massawippi. Chaque passage durera de 5 à 15 minutes; les voix expérimentées comme les premières participations sont les bienvenues.\n\n📝 Candidatures avant le dimanche 9 août à 23 h 59 : https://forms.office.com/r/4A2xsMh7st\n\n#AuBordDuBleu #BleuMassawippi #LacMassawippi #Poésie #Slam\n\n=========================================\n\nEN — A finished poem, a work in progress or a few pages you would love to share by the lake? There is still time to offer your voice for Au bord du bleu.\n\nOn Sunday, August 30, from 1 to 4 p.m., Bleu Massawippi will bring together poetry, prose and spoken word at Lôbadanaki Park, by Lake Massawippi. Each reading will last 5 to 15 minutes; experienced voices and first-time participants are equally welcome.\n\n📝 Apply by Sunday, August 9 at 11:59 p.m.: https://forms.office.com/r/4A2xsMh7st\n\n#AuBordDuBleu #BleuMassawippi #LakeMassawippi #Poetry #SpokenWord`,
  parallelOperationalItem: true,
  replacesDailySlot: false,
  calendarPriority: "confirmed-project-reminder",
  doNotShiftForBrownBullhead: true,
  tasksValentin: [
    "Vérifier que le formulaire est ouvert, que l’affiche et son texte alternatif sont toujours exacts et que le lien fonctionne sur mobile.",
    "Programmer le rappel bilingue sur Facebook et Instagram, puis suivre les questions jusqu’à la fermeture du 9 août."
  ],
  tasksAnnie: [
    "Signaler seulement si une modalité municipale confirmée exige de corriger le rappel avant sa programmation."
  ],
  taskOwnersVersion: "event-task-owners-2026-07-29-poetry-reminder-v1"
};

const BROWN_BULLHEAD_REPORT_POST = {
  id: "barbotte-20260730-signalement",
  w: 3,
  date: "Jeudi 30 juillet",
  calendarTime: "12:00",
  t: "Communauté",
  tier: "Pilier",
  title: "Avez-vous vu ou capturé une barbotte avec ce type de lésion?",
  format: "Photo documentaire bilingue 4:5 · appel au signalement",
  role: "Inviter sans alarmisme les personnes qui fréquentent le lac à signaler une barbotte présentant des lésions ou des masses noires visibles, avec une date, un secteur approximatif et une photo.",
  cta: "Nous transmettre une observation",
  visual: "Poster documentaire sur papier ivoire montrant une photographie USGS de barbotte brune avec des masses noires visibles, trois flèches sobres et les repères bilingues date, secteur et photo.",
  source: "USGS — barbotte du lac Memphrémagog, photographie du domaine public : https://www.usgs.gov/media/images/raised-black-external-tumors-adult-brown-bullhead-fish · Réseau canadien pour la santé de la faune — observations au lac Magog : https://healthywildlife.ca/melanomas-in-brown-bullhead-from-the-lake-memphremagog-quebec/",
  fallback: "Photographie documentaire avec une question bilingue et les mots date, secteur et photo; ne poser aucun diagnostic et ne pas affirmer que le poisson photographié provient du lac Massawippi.",
  kpi: "Observations reçues avec date / secteur documenté / photos exploitables avec permission",
  task: "Publier l’appel bilingue après validation, puis consigner chaque observation sans diffuser d’adresse privée ni de renseignement personnel; ne tirer aucune conclusion à partir d’une photo seule.",
  copy: `FR — Avez-vous déjà vu ou capturé une barbotte brune dans le lac Massawippi avec ce type de lésion sur le corps?

Des lésions semblables ont déjà été documentées chez des barbottes des lacs Memphrémagog et Magog.

Si oui, écrivez-nous à info@bleumassawippi.com en indiquant, si possible :

• la date;
• le secteur approximatif du lac;
• une photo.

Nous rassemblons simplement les signalements. Une photo ne permet pas, à elle seule, d’en déterminer la cause. Merci aux pêcheuses, pêcheurs et personnes qui fréquentent le lac pour votre aide.

#BleuMassawippi #LacMassawippi #BarbotteBrune #ObservationCitoyenne

=========================================

EN — Have you ever seen or caught a brown bullhead in Lake Massawippi with this type of lesion on its body?

Similar lesions have already been documented in brown bullhead from lakes Memphremagog and Magog.

If so, please write to info@bleumassawippi.com and include, if possible:

• the date;
• the approximate area of the lake;
• a photo.

We are simply gathering reports. A photo alone cannot determine their cause. Thank you to anglers and everyone who spends time on the lake for your help.

#BleuMassawippi #LakeMassawippi #BrownBullhead #CommunityObservation`,
  choiceRequired: false,
  optionGroup: null,
  optionLabel: null,
  isAlternative: false,
  decisionLocked: true,
  calendarPriority: "direction-feedback",
  replacesDailySlot: true,
  tasksValentin: [
    "Vérifier l’adresse de réception, le crédit du visuel, le texte alternatif et la lisibilité mobile.",
    "Programmer la publication bilingue sur Facebook et Instagram après les deux validations.",
    "Consigner les observations reçues avec leur date, leur secteur approximatif et leur photo, sans publier de renseignement personnel."
  ],
  tasksAnnie: [
    "Approuver le texte et le visuel, puis confirmer l’adresse à utiliser pour recevoir les observations.",
    "Si plusieurs signalements concordants sont reçus, déterminer avec les communications s’il convient de les transmettre aux interlocuteurs scientifiques ou ministériels appropriés."
  ],
  taskOwnersVersion: "event-task-owners-2026-07-29-brown-bullhead-v1"
};

const RADIO_CANADA_DENIS_POST = {
  id: "actualite-20260808-denis-radio-canada-moules-zebrees",
  w: 4,
  date: "Samedi 8 août",
  calendarTime: "09:00",
  t: "Actualité",
  tier: "Pilier",
  title: "Denis Petitclerc à Radio-Canada Estrie — les moules zébrées au lac Massawippi",
  format: "Publication native sans lien Meta + photographie éditoriale imprimée · publication bilingue",
  role: "Relayer rapidement l’entrevue accordée par le président de Bleu Massawippi à Radio-Canada Estrie dans un format natif compatible avec Facebook et Instagram, sans résumer ni citer un contenu qui n’a pas encore été transcrit dans le dossier éditorial.",
  cta: "Retrouver l’entrevue sur Radio-Canada OHdio",
  visual: "Composition 4:5 fondée sur l’image de Par ici l’info fournie avec le lien : tirage photographique posé sur une table, carte du lac et note manuscrite Denis à Radio-Canada · À écouter.",
  source: "Radio-Canada OHdio — Par ici l’info — « Les moules zébrées se multiplient au Lac Massawippi, avec Denis Petitclerc » : https://ici.radio-canada.ca/ohdio/premiere/emissions/par-ici-l-info/segments/rattrapage/2442552/entrevue",
  fallback: "Sur Facebook et Instagram, publier le visuel et le texte nativement, sans URL de Radio-Canada. Conserver le lien direct pour le site de Bleu Massawippi et les canaux qui l’acceptent; ne pas inventer de citation ni de résumé détaillé.",
  kpi: "Portée native / recherches de l’entrevue / partages / commentaires utiles",
  task: "Vérifier le titre exact et la lisibilité du visuel, préparer une page ou un encart sur le site de Bleu Massawippi avec le lien OHdio, puis programmer sur Facebook et Instagram la version native sans URL de média.",
  copy: `FR — Denis Petitclerc, président de Bleu Massawippi, était au micro de Radio-Canada Estrie pour parler de la multiplication des moules zébrées au lac Massawippi.

Cette entrevue de Par ici l’info est maintenant disponible sur Radio-Canada OHdio. Pour la retrouver, cherchez le titre « Les moules zébrées se multiplient au lac Massawippi, avec Denis Petitclerc ».

🎧 Le lien direct sera aussi regroupé sur le site de Bleu Massawippi.

Merci à Radio-Canada Estrie de donner de l’espace aux enjeux environnementaux du Massawippi.

#BleuMassawippi #LacMassawippi #RadioCanadaEstrie #MoulesZébrées

=========================================

EN — Denis Petitclerc, president of Bleu Massawippi, spoke with Radio-Canada Estrie about the growing zebra mussel presence in Lake Massawippi.

The Par ici l’info interview is now available on Radio-Canada OHdio. To find it, search for “Les moules zébrées se multiplient au lac Massawippi, avec Denis Petitclerc.” The interview is in French.

🎧 The direct link will also be gathered on the Bleu Massawippi website.

Thank you to Radio-Canada Estrie for making space for environmental issues affecting Massawippi.

#BleuMassawippi #LakeMassawippi #RadioCanadaEstrie #ZebraMussels`,
  choiceRequired: false,
  optionGroup: null,
  optionLabel: null,
  isAlternative: false,
  decisionLocked: true,
  calendarPriority: "timely-media-coverage",
  replacesDailySlot: true,
  doNotShiftForBrownBullhead: true,
  tasksValentin: [
    "Vérifier le lien OHdio, le titre de l’entrevue, le visuel, son texte alternatif et la lisibilité mobile.",
    "Préparer sur le site de Bleu Massawippi un encart qui mène au lien OHdio; ne pas annoncer cet encart avant sa mise en ligne.",
    "Programmer la publication bilingue native sur Facebook et Instagram après les validations, sans URL de média, citation inventée ni résumé non vérifié."
  ],
  tasksAnnie: [
    "Confirmer rapidement que le ton du relais et la présentation de Denis conviennent à la direction."
  ],
  taskOwnersVersion: "event-task-owners-2026-08-04-radio-canada-meta-native-v2"
};

const RADIO_CANADA_ARTICLE_POST = {
  id: "actualite-20260804-article-radio-canada-moules-zebrees",
  w: 4,
  date: "Dimanche 9 août",
  calendarTime: "09:00",
  t: "Actualité",
  tier: "Pilier",
  title: "À lire sur Radio-Canada — la moule zébrée au lac Massawippi",
  format: "Publication native sans lien Meta + portrait réel en tirage imprimé et citation manuscrite · publication bilingue",
  role: "Relayer rapidement le nouvel article écrit de Radio-Canada sur la moule zébrée au lac Massawippi dans un format natif compatible avec Facebook et Instagram, distinct de l’entrevue audio prévue le 8 août.",
  cta: "Retrouver l’article sur Radio-Canada",
  visual: "Le portrait réel de Denis Petitclerc fourni par les communications, présenté comme un tirage photographique chaleureux sur une table en bois. Une carte manuscrite porte exactement la citation : « Ce n’est pas parce que la solution à un problème n’a pas été trouvée que la solution n’existe pas. La science évolue. »",
  source: "Photo et citation de Denis Petitclerc transmises par Valentin Wittwe le 4 août 2026. Courriel de Denis reçu le 3 août 2026 : il estime que l’article reflète fidèlement les discussions avec la journaliste Elyse. Article Radio-Canada : https://ici.radio-canada.ca/nouvelle/2273213/moule-zebree-espece-envahissante-lac-massawippi",
  fallback: "Sur Facebook et Instagram, publier le visuel et le texte nativement, sans URL de Radio-Canada. Conserver le lien direct pour le site de Bleu Massawippi et les canaux qui l’acceptent. Si la citation ou son attribution doit être corrigée, garder le post en brouillon et repartir de la photographie source archivée.",
  kpi: "Portée native / recherches de l’article / partages / commentaires utiles",
  task: "Vérifier la citation, son attribution et la lisibilité mobile du visuel, préparer une page ou un encart sur le site de Bleu Massawippi avec le lien de l’article, puis programmer sur Facebook et Instagram la version native sans URL de média.",
  copy: `FR — 📰 À LIRE SUR RADIO-CANADA

Dans un article signé Laurence Frappier et Élyse Tessier, Radio-Canada fait le point sur la progression des moules zébrées au lac Massawippi, l’arrêt des opérations de contrôle faute de financement et la recherche de solutions viables.

Denis Petitclerc estime que l’article reflète fidèlement la discussion. Le reportage explique aussi pourquoi la prévention, la recherche et un financement durable doivent avancer ensemble.

📰 Pour le retrouver sur Radio-Canada, cherchez « Les moules zébrées se multiplient au lac Massawippi ». Le lien direct sera aussi regroupé sur le site de Bleu Massawippi.

Merci à Radio-Canada Estrie de porter cet enjeu à l’attention du public.

#BleuMassawippi #LacMassawippi #RadioCanadaEstrie #MouleZébrée

=========================================

EN — 📰 A NEW RADIO-CANADA ARTICLE

In a French-language article by Laurence Frappier and Élyse Tessier, Radio-Canada reports on the spread of zebra mussels in Lake Massawippi, the suspension of control operations due to a lack of funding, and the search for viable solutions.

Denis Petitclerc believes the article faithfully reflects the discussion. It also explains why prevention, research, and sustainable funding must move forward together.

📰 To find the French-language story on Radio-Canada, search for “Les moules zébrées se multiplient au lac Massawippi.” The direct link will also be gathered on the Bleu Massawippi website.

Thank you to Radio-Canada Estrie for bringing this issue to the public’s attention.

#BleuMassawippi #LakeMassawippi #RadioCanadaEstrie #ZebraMussels`,
  choiceRequired: false,
  optionGroup: null,
  optionLabel: null,
  isAlternative: false,
  decisionLocked: true,
  calendarPriority: "timely-media-coverage",
  replacesDailySlot: true,
  doNotShiftForBrownBullhead: true,
  tasksValentin: [
    "Vérifier que la citation de Denis est reproduite exactement et que son attribution est visible.",
    "Vérifier le portrait imprimé, le texte alternatif, le titre de l’article et la lisibilité mobile.",
    "Préparer sur le site de Bleu Massawippi un encart qui mène à l’article; ne pas annoncer cet encart avant sa mise en ligne.",
    "Programmer la publication bilingue native sur Facebook et Instagram après les validations, sans URL de média."
  ],
  tasksAnnie: [
    "Confirmer rapidement que le ton du relais et la présentation de l’enjeu conviennent à la direction."
  ],
  taskOwnersVersion: "event-task-owners-2026-08-04-radio-canada-article-meta-native-v2"
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
  DONATION_CADENCE_POSTS.forEach((post) => {
    if (!posts.some((item) => item.id === post.id)) posts.push({ ...post });
  });
  CONTINUITY_POSTS.forEach((post) => {
    if (!posts.some((item) => item.id === post.id)) posts.push({ ...post });
  });
  if (!posts.some((post) => post.id === POETRY_CALL_POST.id)) posts.push({ ...POETRY_CALL_POST });
  if (!posts.some((post) => post.id === POETRY_REMINDER_POST.id)) posts.push({ ...POETRY_REMINDER_POST });
  if (!posts.some((post) => post.id === BROWN_BULLHEAD_REPORT_POST.id)) posts.push({ ...BROWN_BULLHEAD_REPORT_POST });
  if (!posts.some((post) => post.id === RADIO_CANADA_DENIS_POST.id)) posts.push({ ...RADIO_CANADA_DENIS_POST });
  if (!posts.some((post) => post.id === RADIO_CANADA_ARTICLE_POST.id)) posts.push({ ...RADIO_CANADA_ARTICLE_POST });
  const first = posts.find((post) => post.id === "s1d1");
  if (first) Object.assign(first, OPEN_HOUSE_POST, { decisionLocked: true });
  const moved = posts.find((post) => post.id === "s1d1b");
  if (moved) {
    Object.assign(moved, {
      w: 98,
      date: "Archive éditoriale",
      archivedEditorial: true,
      archived: true,
      t: "Nature",
      tier: "Passerelle",
      choiceRequired: false,
      optionGroup: null,
      optionLabel: null,
      isAlternative: true,
      role: "Sujet déjà traité selon la direction le 29 juillet 2026; conservé dans l’historique et retiré du calendrier actif sans suppression."
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
    w: 5,
    date: "Dimanche 16 août",
    calendarTime: "12:30",
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
      role: "Capsule phare avancée au dimanche 16 août à la demande de la direction; elle ouvre la séquence nature, tandis que le nénuphar est reporté pour éviter deux sujets de flore aquatique dans la même semaine.",
      editorialFamily: "flore-aquatique",
      topicSignature: "plante-aquatique,flore-riveraine"
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
  const deferredJuly27Monitoring = posts.find((post) => post.id === "s3d1");
  if (deferredJuly27Monitoring) Object.assign(deferredJuly27Monitoring, {
    w: 3,
    date: "Mercredi 29 juillet",
    calendarTime: "12:00",
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
    originalDateIso: "2026-07-27",
    rescheduledFrom: "2026-08-15",
    rescheduledReason: "Publication avancée au mercredi 29 juillet à la demande des communications; son déplacement temporaire du 27 juillet au 15 août demeure consigné dans l’historique de replanification.",
    rescheduleHistory: [
      {
        from: "2026-07-27",
        to: "2026-08-15",
        reason: "Réserver le lundi 27 juillet à l’appel confirmé pour Au bord du bleu."
      },
      {
        from: "2026-08-15",
        to: "2026-07-29",
        reason: "Placer le suivi du lac et de ses tributaires au mercredi 29 juillet selon la décision éditoriale du 26 juillet."
      }
    ],
    displacedBy: null,
    role: "Publication scientifique retenue pour le mercredi 29 juillet : présenter avec exactitude les gestes de suivi du lac et de ses tributaires, sans diffuser de résultat récent non validé."
  });
  const displacedRainPost = posts.find((post) => post.id === "s3d4");
  if (displacedRainPost) Object.assign(displacedRainPost, {
    w: 5,
    date: "Samedi 15 août",
    calendarTime: "11:00",
    choiceRequired: false,
    optionGroup: null,
    optionLabel: null,
    rescheduledFrom: "2026-07-29",
    rescheduledReason: "Publication conservée et déplacée au créneau libéré du samedi 15 août afin de réserver le mercredi 29 juillet au suivi du lac et de ses tributaires.",
    displacedBy: deferredJuly27Monitoring?.id || "s3d1",
    role: "Publication citoyenne conservée et reprogrammée : inviter à documenter calmement une observation après la pluie, sans simuler une alerte."
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
  const shiftedForBrownBullhead = new Map([
    ["2026-07-30", { date: "Vendredi 31 juillet", w: 3, to: "2026-07-31" }],
    ["2026-07-31", { date: "Samedi 1er août", w: 3, to: "2026-08-01" }],
    ["2026-08-01", { date: "Dimanche 2 août", w: 3, to: "2026-08-02" }],
    ["2026-08-02", { date: "Lundi 3 août", w: 4, to: "2026-08-03" }],
    ["2026-08-03", { date: "Mardi 4 août", w: 4, to: "2026-08-04" }],
    ["2026-08-04", { date: "Mercredi 5 août", w: 4, to: "2026-08-05" }],
    ["2026-08-05", { date: "Jeudi 6 août", w: 4, to: "2026-08-06" }],
    ["2026-08-06", { date: "Samedi 8 août", w: 4, to: "2026-08-08" }],
    ["2026-08-07", { date: "Samedi 8 août", w: 4, to: "2026-08-08" }],
    ["2026-08-08", { date: "Dimanche 9 août", w: 4, to: "2026-08-09" }],
    ["2026-08-09", { date: "Lundi 10 août", w: 5, to: "2026-08-10" }],
    ["2026-08-10", { date: "Mardi 11 août", w: 5, to: "2026-08-11" }],
    ["2026-08-11", { date: "Mercredi 12 août", w: 5, to: "2026-08-12" }]
  ]);
  finalPosts.forEach((post) => {
    if (post.id === BROWN_BULLHEAD_REPORT_POST.id || post.archivedEditorial || post.doNotShiftForBrownBullhead || post.calendarPriority === "donation-cadence") return;
    const from = planDateIsoFromLabel(post.date);
    const placement = shiftedForBrownBullhead.get(from);
    if (!placement) return;
    const reason = "Créneau décalé d’une journée pour intégrer l’appel au signalement de la barbotte demandé par la direction, sans retirer la publication déjà prévue.";
    const history = Array.isArray(post.rescheduleHistory) ? [...post.rescheduleHistory] : [];
    if (!history.some((entry) => entry?.from === from && entry?.to === placement.to && entry?.reason === reason)) {
      history.push({ from, to: placement.to, reason });
    }
    Object.assign(post, {
      date: placement.date,
      w: placement.w,
      rescheduledFrom: from,
      rescheduledReason: reason,
      displacedBy: BROWN_BULLHEAD_REPORT_POST.id,
      rescheduleHistory: history
    });
  });
  const reprogrammed = {
    "alt-20260722": { w: 6, date: "Dimanche 23 août", rescheduledFrom: "2026-07-22", rescheduledReason: "Bonne idée conservée et déplacée pour réserver le mercredi 22 juillet à l’appel Zeffy; la publication de prévention garde son texte, ses commentaires, ses médias et ses validations existants.", displacedBy: "don-20260729-appel-soutien", role: "Bonne idée interactive conservée et reprogrammée : rappeler avec chaleur que l’absence de débris visibles ne remplace pas le lavage, la vidange et le séchage recommandés." },
    "alt-20260721": { w: 7, date: "Lundi 24 août", role: "Bonne idée conservée et reprogrammée après arbitrage; capsule nature à produire avec une photographie réelle correctement identifiée." },
    "alt-20260723": { w: 7, date: "Mardi 25 août", role: "Bonne idée conservée et reprogrammée après arbitrage; capsule sur les fonctions d’une rive végétalisée à renforcer en français." },
    "alt-20260724": { w: 7, date: "Mercredi 26 août", role: "Publication de remplacement préparée après le report de l’atelier : montrer avec une photographie réelle que le lac, les collines, les sols, les fossés, les milieux humides et les cours d’eau appartiennent à un même bassin versant." },
    "alt-20260725": { w: 7, date: "Jeudi 27 août", role: "Sujet récurrent conservé pour un autre mois avec une formulation distincte, afin d’éviter la répétition dans la même séquence." },
    "alt-20260728": { w: 7, date: "Vendredi 28 août", role: "Bonne idée conservée et reprogrammée après arbitrage; expliquer la complémentarité entre suivi scientifique et observations citoyennes sans les confondre." },
    "alt-20260729": { w: 8, date: "Lundi 31 août", role: "Bonne idée nature conservée et reprogrammée après le choix de la publication sur les observations après la pluie pour le 29 juillet." },
    "alt-20260802": { w: 8, date: "Mardi 1er septembre", role: "Bonne idée nature conservée et reprogrammée après le choix de la publication sur les cinq réflexes doux pour le 2 août." }
  };
  Object.entries(reprogrammed).forEach(([id, placement]) => {
    const post = finalPosts.find((item) => item.id === id);
    if (post) Object.assign(post, placement, { choiceRequired: false, optionGroup: null, optionLabel: null });
  });
  const donationDisplacements = {
    "s4d5": {
      w: 5,
      date: "Vendredi 14 août",
      choiceRequired: false,
      optionGroup: null,
      optionLabel: null,
      rescheduledFrom: "2026-08-07",
      rescheduledReason: "Créneau libéré en priorité pour le bilan de dons Zeffy du 7 août.",
      displacedBy: "don-20260807-merci-bilan"
    },
    "alt-20260807": {
      w: 8,
      date: "Mercredi 2 septembre",
      choiceRequired: false,
      optionGroup: null,
      optionLabel: null,
      rescheduledFrom: "2026-08-07",
      rescheduledReason: "Bonne idée conservée et reportée après le choix du voyage d’une goutte de pluie pour le 14 août.",
      displacedBy: "don-20260807-merci-bilan"
    }
  };
  Object.entries(donationDisplacements).forEach(([id, placement]) => {
    const post = finalPosts.find((item) => item.id === id);
    if (post) Object.assign(post, placement);
  });
  ["alt-20260725", "alt-20260804", "alt-20260810"].forEach((id) => {
    const rejected = finalPosts.find((item) => item.id === id);
    if (!rejected) return;
    Object.assign(rejected, {
      w: 98,
      date: "Archive éditoriale",
      archivedEditorial: true,
      archived: true,
      choiceRequired: false,
      optionGroup: null,
      optionLabel: null,
      role: `${rejected.role || ""} Angle écarté par la direction; conservé dans les archives éditoriales sans suppression.`.trim()
    });
  });
  ["s1d3b", "alt-20260715", "s1d5", "s1d6", "s1d4", "s1d2", "s2d1b", "s1d7", "s2d1", "s2d2", "alt-20260722", "s2d4", "s2d5", "s2d7", "alt-20260726", "s3d1", "s3d2", "s3d4", "s3d3", "s3d7", "s4d1", "s4d1b", "alt-20260729", "alt-20260802", "lexique-20260830-tributaire", "don-20260729-appel-soutien", "don-20260807-merci-bilan", "poesie-20260727-appel-aux-voix"].forEach((id) => {
    const post = finalPosts.find((item) => item.id === id);
    if (post) Object.assign(post, { choiceRequired: false, optionGroup: null, optionLabel: null });
  });
  const continuityReason = "Cadence de cinq publications par semaine à compter du 17 août 2026 : créneaux variés fixés une seule fois, contenus prêts rapprochés sans déplacer les publications terminées, et respiration volontaire entre les jours de diffusion.";
  CONTINUITY_CALENDAR_ASSIGNMENTS.forEach(([id, w, date, dateIso]) => {
    const post = finalPosts.find((item) => item.id === id);
    if (!post) return;
    const from = planDateIsoFromLabel(post.date);
    const repairRotation = COMPLETED_POST_REPAIR_ROTATIONS.get(id);
    const userDirectedRotation = USER_DIRECTED_RESCHEDULES.get(id);
    const historyFrom = repairRotation?.from || userDirectedRotation?.from || from;
    const assignmentReason = repairRotation?.reason || userDirectedRotation?.reason || continuityReason;
    const history = Array.isArray(post.rescheduleHistory) ? [...post.rescheduleHistory] : [];
    for (const previous of userDirectedRotation?.priorHistory || []) {
      if (previous?.from && previous?.to && previous?.reason
        && !history.some((entry) => entry?.from === previous.from && entry?.to === previous.to && entry?.reason === previous.reason)) {
        history.push({ from: previous.from, to: previous.to, reason: previous.reason });
      }
    }
    if (userDirectedRotation && from && from !== historyFrom && !history.some((entry) => entry?.from === from && entry?.to === historyFrom && entry?.reason === continuityReason)) {
      history.push({ from, to: historyFrom, reason: continuityReason });
    }
    if (historyFrom && historyFrom !== dateIso && !history.some((entry) => entry?.from === historyFrom && entry?.to === dateIso && entry?.reason === assignmentReason)) {
      history.push({ from: historyFrom, to: dateIso, reason: assignmentReason });
    }
    Object.assign(post, {
      w,
      date,
      choiceRequired: false,
      optionGroup: null,
      optionLabel: null,
      ...(repairRotation?.calendarTime ? { calendarTime: repairRotation.calendarTime } : {}),
      ...(repairRotation ? { displacedBy: repairRotation.displacedBy } : {}),
      ...(historyFrom && historyFrom !== dateIso ? {
        rescheduledFrom: historyFrom,
        rescheduledReason: assignmentReason,
        rescheduleHistory: history
      } : {})
    });
  });
  const deferredWaterLily = finalPosts.find((post) => post.id === "alt-20260805");
  if (deferredWaterLily) Object.assign(deferredWaterLily, {
    editorialFamily: "flore-aquatique",
    topicSignature: "plante-aquatique,flore-riveraine",
    role: "Sujet nature conservé et reporté au 2 septembre afin de laisser respirer l’iris du 16 août et de maintenir une séquence éditoriale variée."
  });
  const monitoringDeferredForRadioCanada = finalPosts.find((post) => post.id === "s1d2");
  if (monitoringDeferredForRadioCanada) {
    const from = planDateIsoFromLabel(monitoringDeferredForRadioCanada.date);
    const history = Array.isArray(monitoringDeferredForRadioCanada.rescheduleHistory) ? [...monitoringDeferredForRadioCanada.rescheduleHistory] : [];
    if (from && from !== "2026-09-27") history.push({
      from,
      to: "2026-09-27",
      reason: "Créneau du 8 août réservé au relais d’actualité de l’entrevue de Denis Petitclerc à Radio-Canada Estrie; la publication scientifique est conservée intégralement dans la nouvelle cadence de cinq publications par semaine."
    });
    Object.assign(monitoringDeferredForRadioCanada, {
      w: 11,
      date: "Dimanche 27 septembre",
      calendarTime: "12:00",
      rescheduledFrom: from || "2026-08-08",
      rescheduledReason: "Créneau du 8 août réservé au relais d’actualité de l’entrevue de Denis Petitclerc à Radio-Canada Estrie; la publication scientifique est conservée intégralement dans la nouvelle cadence de cinq publications par semaine.",
      rescheduleHistory: history,
      displacedBy: RADIO_CANADA_DENIS_POST.id
    });
  }
  finalPosts.forEach((post) => {
    ensureHumanInterviewCoordination(post);
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
  output = output.replace(
    /\[[1-8,]+\]\.forEach/,
    "Array.from(new Set(list.map(function(p){return Number(p.w)}))).filter(function(n){return Number.isFinite(n)&&n>0}).sort(function(a,b){return a-b}).forEach"
  );
  output = output.replace(
    /if\(!a\.length\)return;var days=/,
    'if(!a.length)return;var weekInfo=meta[n]||["Semaine "+n,"Calendrier évolutif"];var days='
  );
  output = output.replace(/meta\[n\]\[0\]/g, "weekInfo[0]").replace(/meta\[n\]\[1\]/g, "weekInfo[1]");
  output = output.replace(
    /Object\.keys\(days\)(?:\.sort\([\s\S]*?\))?\.forEach\(function\(day\)\{/,
    "Object.keys(days).sort(function(a,b){return postDate(days[a][0])-postDate(days[b][0])}).forEach(function(day){"
  );
  output = output.replace(
    /(var meta=\{[\s\S]*?\};)/,
    "$1meta[5]=[\"Semaine 5 · Historique protégé\",\"10 au 16 août\"];meta[6]=[\"Semaine 6 · 5 publications variées\",\"17 au 23 août\"];meta[7]=[\"Semaine 7 · 5 publications variées\",\"24 au 30 août\"];meta[8]=[\"Semaine 8 · 5 publications variées\",\"31 août au 6 septembre\"];meta[9]=[\"Semaine 9 · 5 publications variées\",\"7 au 13 septembre\"];meta[10]=[\"Semaine 10 · 5 publications variées\",\"14 au 20 septembre\"];meta[11]=[\"Semaine 11 · 5 publications variées\",\"21 au 27 septembre\"];meta[12]=[\"Banque préparée\",\"À partir du 28 septembre\"];"
  );
  return output;
}

export { OPEN_HOUSE_MAP_URL };
