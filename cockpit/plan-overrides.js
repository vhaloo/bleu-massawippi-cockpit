import { SPECS as ALTERNATIVE_SPECS } from "./alternatives.js";
import { applyEditorialCopyOverrides } from "./editorial-copy-overrides.js";

const OPEN_HOUSE_MAP_URL = "https://www.google.com/maps/search/?api=1&query=Eglise+Saint-Barthelemy%2C+911+rue+Clough%2C+Ayer%27s+Cliff%2C+QC+J0B+1C0";

const PLAN_YEAR = 2026;
const ARCHIVED_DATE_ISO = new Map([
  ["s1d1b", "2026-07-13"],
  ["s2d3", "2026-07-22"],
  ["s2d6", "2026-07-26"],
  ["s3d1b", "2026-07-27"],
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
  title: "Avez-vous vu une barbotte dans le lac Massawippi?",
  format: "Affiche naturaliste bilingue 4:5 · appel au signalement",
  role: "Inviter simplement les personnes qui fréquentent le lac à partager une observation de barbotte brune afin de mieux documenter sa présence.",
  cta: "Partager une observation",
  visual: "Affiche naturaliste chaleureuse sur papier ivoire, fondée sur une illustration fidèle de barbotte brune du domaine public; question manuscrite bilingue et trois repères très lisibles : date, secteur, photo.",
  source: "Gouvernement du Québec — Barbotte brune (Ameiurus nebulosus) : https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/animaux-sauvages-quebec/fiches-especes-fauniques/barbotte-brune · illustration de Duane Raver, U.S. Fish and Wildlife Service, domaine public : https://commons.wikimedia.org/wiki/File:Brown_bullhead_fish_ameiurus_nebulosus.jpg",
  fallback: "Illustration fidèle du poisson avec la seule question bilingue et les mots date, secteur et photo; aucune affirmation sur une observation locale précise.",
  kpi: "Observations reçues avec date / secteur documenté / photos exploitables avec permission",
  task: "Vérifier les coordonnées de réception, publier l’appel bilingue après validation et consigner chaque observation sans diffuser d’adresse privée ni de renseignement personnel.",
  copy: `FR — Avez-vous déjà vu ou capturé une barbotte brune dans le lac Massawippi?

Nous aimerions mieux documenter sa présence dans le lac. Si vous en observez une au cours d’une sortie ou d’une prise, écrivez-nous à info@bleumassawippi.com en indiquant, si possible :

• la date;
• le secteur approximatif du lac;
• une photo.

Une courte note suffit. Merci de nous aider à rassembler ces observations autour du Massawippi.

#BleuMassawippi #LacMassawippi #BarbotteBrune #ObservationCitoyenne

=========================================

EN — Have you ever seen or caught a brown bullhead in Lake Massawippi?

We would like to better document its presence in the lake. If you see one during an outing or catch, please write to info@bleumassawippi.com and include, if possible:

• the date;
• the approximate area of the lake;
• a photo.

A short note is all it takes. Thank you for helping us gather observations from around Massawippi.

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
  if (!posts.some((post) => post.id === POETRY_CALL_POST.id)) posts.push({ ...POETRY_CALL_POST });
  if (!posts.some((post) => post.id === POETRY_REMINDER_POST.id)) posts.push({ ...POETRY_REMINDER_POST });
  if (!posts.some((post) => post.id === BROWN_BULLHEAD_REPORT_POST.id)) posts.push({ ...BROWN_BULLHEAD_REPORT_POST });
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
  ["alt-20260804", "alt-20260810"].forEach((id) => {
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
      role: `${rejected.role || ""} Angle écarté par la direction le 29 juillet 2026; conservé dans les archives éditoriales sans suppression.`.trim()
    });
  });
  ["s1d3b", "alt-20260715", "s1d5", "s1d6", "s1d4", "s1d2", "s2d1b", "s1d7", "s2d1", "s2d2", "alt-20260722", "s2d4", "s2d5", "s2d7", "alt-20260726", "s3d1", "s3d2", "s3d4", "s3d3", "s3d7", "s4d1", "s4d1b", "alt-20260729", "alt-20260802", "lexique-20260830-tributaire", "don-20260729-appel-soutien", "don-20260807-merci-bilan", "poesie-20260727-appel-aux-voix"].forEach((id) => {
    const post = finalPosts.find((item) => item.id === id);
    if (post) Object.assign(post, { choiceRequired: false, optionGroup: null, optionLabel: null });
  });
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
    "$1meta[5]=[\"Semaine 5 · Réserve éditoriale\",\"10 au 16 août\"];meta[6]=[\"Semaine 6 · Réserve éditoriale\",\"17 au 23 août\"];meta[7]=[\"Semaine 7 · Réserve éditoriale\",\"24 au 30 août\"];meta[8]=[\"Semaine 8 · Réserve éditoriale\",\"31 août au 6 septembre\"];"
  );
  return output;
}

export { OPEN_HOUSE_MAP_URL };
