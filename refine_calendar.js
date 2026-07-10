import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const planPath = path.join(directory, "index.html");
const markdownPath = path.join(directory, "TEXTES_COMPLETS_PUBLICATIONS_13_JUILLET_9_AOUT_2026.md");
const separator = "=========================================";
const reportPage = "https://bleumassawippi.com/rapports-et-memoires";
const homeFr = "https://bleumassawippi.com/accueil-1";
const homeEn = "https://bleumassawippi.com/home-1";
const volunteerPage = "https://bleumassawippi.com/benevolat";
const boatGuidance = "https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/gestion-faune-habitats-fauniques/gestion-especes-exotiques-envahissantes-animales/lutte/nettoyage-embarcations-nautiques";

function bilingual(fr, en) {
  return `FR — ${fr}\n\n${separator}\n\nEN — ${en}`;
}

function readPosts(html) {
  const match = html.match(/var posts=(\[[\s\S]*?\]);\nvar meta=/);
  if (!match) throw new Error("Calendrier introuvable dans index.html");
  return JSON.parse(match[1]);
}

function replacePosts(html, posts) {
  return html.replace(/var posts=(\[[\s\S]*?\]);\nvar meta=/, `var posts=${JSON.stringify(posts)};\nvar meta=`);
}

function applyEditorialAdjustments(posts) {
  const adjustments = {
    s1d2: {
      t: "Humanité",
      title: "Le lac en cinq sons",
      format: "Reel sonore 12–15 s · écoute du terrain",
      role: "Créer une respiration sensorielle qui fait aimer le lac avant d’expliquer une notion.",
      cta: "Écouter jusqu’à la fin",
      visual: "Reel vertical composé de cinq sons réels : eau, vent, oiseaux, pas sur la rive, carnet qui se ferme; sous-titres FR/EN.",
      source: "Documentation interne — captation sonore autorisée",
      fallback: "Carrousel de cinq photos avec une courte phrase sensorielle par carte.",
      kpi: "Vues complètes / partages",
      task: "Enregistrer des sons réels sans identifier une personne ni un lieu sensible; laisser une seconde de silence entre les plans.",
      copy: bilingual(
        "Fermez les yeux une seconde. Que reste-t-il? Le clapotis, le vent dans les herbes, les oiseaux, les pas sur le sentier, puis le calme.\n\nLe Massawippi se découvre aussi par ce qu’on entend. Prenons le temps de l’écouter avant de parler de lui.\n\n#MinuteBleue #BleuMassawippi #LacMassawippi #Estrie",
        "Close your eyes for a second. What remains? The water, wind in the grasses, birds, footsteps on the trail, then quiet.\n\nMassawippi can also be discovered through what we hear. Let’s take time to listen before we speak about it.\n\n#BlueMinute #BleuMassawippi #LakeMassawippi #EasternTownships"
      )
    }
  };
  for (const post of posts) {
    if (adjustments[post.id]) Object.assign(post, adjustments[post.id]);
  }
  return posts;
}

function reassignDates(posts) {
  const schedule = [
    ["s1d1", 1, "Lundi 13 juillet"], ["s1d3", 1, "Mardi 14 juillet"], ["s1d4", 1, "Mercredi 15 juillet"],
    ["s1d5", 1, "Jeudi 16 juillet"], ["s1d6", 1, "Vendredi 17 juillet"], ["s1d7", 1, "Samedi 18 juillet"], ["s1d2", 1, "Dimanche 19 juillet"],
    ["s2d1", 2, "Lundi 20 juillet"], ["s2d7", 2, "Mardi 21 juillet"], ["s2d3", 2, "Mercredi 22 juillet"],
    ["s2d2", 2, "Jeudi 23 juillet"], ["s2d4", 2, "Vendredi 24 juillet"], ["s2d5", 2, "Samedi 25 juillet"], ["s2d6", 2, "Dimanche 26 juillet"],
    ["s3d1", 3, "Lundi 27 juillet"], ["s3d2", 3, "Mardi 28 juillet"], ["s3d4", 3, "Mercredi 29 juillet"],
    ["s3d3", 3, "Jeudi 30 juillet"], ["s3d5", 3, "Vendredi 31 juillet"], ["s3d6", 3, "Samedi 1er août"], ["s3d7", 3, "Dimanche 2 août"],
    ["s4d1", 4, "Lundi 3 août"], ["s4d3", 4, "Mardi 4 août"], ["s4d4", 4, "Mercredi 5 août"],
    ["s4d2", 4, "Jeudi 6 août"], ["s4d5", 4, "Vendredi 7 août"], ["s4d6", 4, "Samedi 8 août"], ["s4d7", 4, "Dimanche 9 août"]
  ];
  const byId = new Map(posts.map((post) => [post.id, post]));
  for (const [id, week, date] of schedule) {
    const post = byId.get(id);
    if (!post) throw new Error(`Publication absente du calendrier : ${id}`);
    post.w = week;
    post.date = date;
  }
  return posts;
}

function alternative(base, overrides) {
  return {
    ...base,
    ...overrides,
    id: overrides.id,
    isAlternative: true,
    choiceRequired: true,
    optionGroup: overrides.optionGroup,
    optionLabel: overrides.optionLabel
  };
}

function addChoiceGroups(posts) {
  const choices = [
    {
      primaryId: "s1d1", group: "2026-07-13", primaryLabel: "Option A — Lire le lac dans le temps",
      alt: {
        id: "s1d1b", optionGroup: "2026-07-13", optionLabel: "Option B — La rive qui travaille en silence", t: "Nature", tier: "Passerelle",
        title: "La rive qui travaille en silence", format: "Photo terrain + légende en trois gestes",
        role: "Montrer le rôle d’une rive végétalisée avant de parler de chiffres ou d’analyses.", cta: "Observer sa rive",
        visual: "Photo réelle d’une rive végétalisée, sans terrain privé identifiable; trois repères discrets : racines, ombre, sol.", source: homeFr,
        fallback: "Gros plan de végétation indigène avec texte alternatif descriptif.", kpi: "Partages / enregistrements",
        task: "Choisir une image autorisée et décrire les fonctions visibles sans promettre de résultat chiffré.",
        copy: bilingual(
          "Une rive vivante travaille en silence. Ses racines retiennent le sol, ses plantes ralentissent l’eau et son ombre crée un refuge pour le vivant.\n\nAvant de regarder le large, regardons ce qui protège le lac au bord de l’eau.\n\n#BandesRiveraines #BleuMassawippi #LacMassawippi #BassinVersant",
          "A living shoreline works quietly. Its roots hold soil, its plants slow water and its shade creates shelter for life.\n\nBefore looking out across the lake, let’s notice what protects it at the water’s edge.\n\n#ShorelineProtection #BleuMassawippi #LakeMassawippi #Watershed"
        )
      }
    },
    {
      primaryId: "s1d3", group: "2026-07-14", primaryLabel: "Option A — Un geste bénévole",
      alt: {
        id: "s1d3b", optionGroup: "2026-07-14", optionLabel: "Option B — Une sortie qui commence bien", t: "Prévention", tier: "Passerelle",
        title: "Une sortie qui commence bien", format: "Checklist photo · avant de partir",
        role: "Remplacer l’explication scientifique par un rappel pratique, calme et immédiatement utile.", cta: "Enregistrer la checklist",
        visual: "Photo réelle d’une embarcation à quai avec trois éléments vérifiables : débris retirés, eau vidée, équipement prêt.", source: boatGuidance,
        fallback: "Visuel typographique en trois verbes : Inspecter. Nettoyer. Vider.", kpi: "Enregistrements / clics source",
        task: "Relier vers la page gouvernementale à jour et ne pas présenter le visuel comme un règlement local.",
        copy: bilingual(
          "Avant de profiter du lac, prenons trente secondes pour regarder l’embarcation et la remorque. Retirer les débris visibles et vider l’eau retenue aide à limiter les déplacements indésirables d’un plan d’eau à l’autre.\n\nLa checklist officielle : " + boatGuidance + "\n\n#Prévention #BleuMassawippi #NautismeResponsable #LacMassawippi",
          "Before enjoying the lake, take thirty seconds to check the boat and trailer. Removing visible debris and draining retained water helps reduce unwanted movement from one body of water to another.\n\nOfficial guidance: " + boatGuidance + "\n\n#Prevention #BleuMassawippi #ResponsibleBoating #LakeMassawippi"
        )
      }
    },
    {
      primaryId: "s2d1", group: "2026-07-20", primaryLabel: "Option A — Zoom nature",
      alt: {
        id: "s2d1b", optionGroup: "2026-07-20", optionLabel: "Option B — Le quiz des milieux humides", t: "Interaction", tier: "Passerelle",
        title: "Le quiz des milieux humides", format: "Story quiz · trois réponses",
        role: "Faire observer le bassin versant par une question simple plutôt que par une fiche descriptive.", cta: "Choisir la bonne réponse",
        visual: "Story avec photo réelle d’un milieu humide et question : Que fait-il pour le bassin versant? A, B ou C.", source: reportPage,
        fallback: "Carrousel avec la question en carte 1 et l’explication en carte 2.", kpi: "Votes / réponses complètes",
        task: "Valider la formulation scientifique avant diffusion et expliquer la réponse sans exagérer le rôle d’un seul milieu.",
        copy: bilingual(
          "Question du jour : un milieu humide peut-il aider le lac?\n\nA — Oui, il peut ralentir l’eau et offrir un habitat.\nB — Non, il ne sert qu’à retenir la boue.\nC — Seulement quand il pleut.\n\nRéponse : A. Les milieux humides rendent plusieurs services à la fois.\n\n#QuizDuLac #BleuMassawippi #MilieuxHumides #LacMassawippi",
          "Today’s question: can a wetland help the lake?\n\nA — Yes, it can slow water and provide habitat.\nB — No, it only holds back mud.\nC — Only when it rains.\n\nAnswer: A. Wetlands provide several services at once.\n\n#LakeQuiz #BleuMassawippi #Wetlands #LakeMassawippi"
        )
      }
    },
    {
      primaryId: "s3d1", group: "2026-07-27", primaryLabel: "Option A — Ce que l’on suit",
      alt: {
        id: "s3d1b", optionGroup: "2026-07-27", optionLabel: "Option B — La question qui ouvre la semaine", t: "Communauté", tier: "Passerelle",
        title: "La question qui ouvre la semaine", format: "Photo du lac + question courte",
        role: "Commencer la semaine par l’écoute de la communauté plutôt que par un indicateur.", cta: "Répondre en une phrase",
        visual: "Photo réelle du lac ou d’un sentier; question en surimpression : Qu’aimeriez-vous mieux comprendre cet été?", source: "Banque photo de l’association — droits documentés",
        fallback: "Question seule sur fond uni avec un rappel du contexte.", kpi: "Commentaires utiles / questions récurrentes",
        task: "Classer les réponses par thème et ne pas transformer une réponse individuelle en position officielle.",
        copy: bilingual(
          "Pour mieux parler du lac, il faut aussi savoir ce que vous cherchez à comprendre.\n\nQuelle question sur le Massawippi aimeriez-vous voir expliquée cet été? Une question simple suffit.\n\n#VoixDuLac #BleuMassawippi #LacMassawippi #Communauté",
          "To speak about the lake better, we also need to know what you want to understand.\n\nWhat question about Massawippi would you like to see explained this summer? One simple question is enough.\n\n#LakeVoices #BleuMassawippi #LakeMassawippi #Community"
        )
      }
    },
    {
      primaryId: "s4d1", group: "2026-08-03", primaryLabel: "Option A — Mini-BD",
      alt: {
        id: "s4d1b", optionGroup: "2026-08-03", optionLabel: "Option B — Le terrain en un détail", t: "Coulisses", tier: "Passerelle",
        title: "Le terrain en un détail", format: "Photo coulisses + légende très courte",
        role: "Montrer une preuve concrète de travail sans reprendre le ton humoristique de la mini-BD.", cta: "Regarder le détail",
        visual: "Photo rapprochée d’un carnet, d’une botte ou d’un instrument réellement utilisé; aucun visage ni résultat non validé.", source: reportPage,
        fallback: "Photo de rive avec une phrase sur l’observation de terrain.", kpi: "Vues / enregistrements",
        task: "Identifier l’objet et son rôle sans révéler un lieu sensible ni afficher de donnée non approuvée.",
        copy: bilingual(
          "Dans les coulisses, un détail compte : un carnet ouvert, une mesure notée, un outil rangé avec soin.\n\nLe suivi du lac avance par ces gestes modestes, répétés et vérifiables.\n\n#Coulisses #BleuMassawippi #LacMassawippi #ScienceDuLac",
          "Behind the scenes, one detail matters: an open notebook, a recorded measurement, a carefully stored tool.\n\nLake monitoring moves forward through these modest, repeated and verifiable actions.\n\n#BehindTheScenes #BleuMassawippi #LakeMassawippi #LakeScience"
        )
      }
    },
    {
      primaryId: "s4d7", group: "2026-08-09", primaryLabel: "Option A — Le bilan à choisir",
      alt: {
        id: "s4d7b", optionGroup: "2026-08-09", optionLabel: "Option B — Merci pour vos regards", t: "Humanité", tier: "Passerelle",
        title: "Merci pour vos regards", format: "Carrousel de remerciement · quatre images réelles",
        role: "Clore le mois par la gratitude et l’écoute, sans transformer le bilan en tableau de performance.", cta: "Partager ce qui vous a marqué",
        visual: "Quatre images réelles du mois : terrain, rive, geste et communauté; une phrase de remerciement par carte.", source: "Archives de la campagne — droits documentés",
        fallback: "Photo unique du lac et message de remerciement sobre.", kpi: "Partages / réponses qualitatives",
        task: "Choisir les images les plus représentatives et ne publier aucun chiffre interne sans contexte et validation.",
        copy: bilingual(
          "Merci d’avoir regardé, questionné, partagé et pris le temps de penser au Massawippi avec nous.\n\nQuel moment ou quel sujet aimeriez-vous retrouver dans la suite? Votre regard aidera à choisir les prochains angles.\n\n#BleuMassawippi #LacMassawippi #Merci #Communauté",
          "Thank you for watching, asking questions, sharing and taking time to think about Massawippi with us.\n\nWhich moment or topic would you like to see again? Your perspective will help shape the next angles.\n\n#BleuMassawippi #LakeMassawippi #ThankYou #Community"
        )
      }
    }
  ];
  const byId = new Map(posts.map((post) => [post.id, post]));
  const additions = [];
  for (const choice of choices) {
    const primary = byId.get(choice.primaryId);
    if (!primary) throw new Error(`Choix sans publication principale : ${choice.primaryId}`);
    primary.choiceRequired = true;
    primary.optionGroup = choice.group;
    primary.optionLabel = choice.primaryLabel;
    primary.isAlternative = false;
    additions.push(alternative(primary, choice.alt));
  }
  return posts.concat(additions);
}

function sortPosts(posts) {
  const dateOrder = new Map([
    ["Lundi 13 juillet", 1], ["Mardi 14 juillet", 2], ["Mercredi 15 juillet", 3], ["Jeudi 16 juillet", 4], ["Vendredi 17 juillet", 5], ["Samedi 18 juillet", 6], ["Dimanche 19 juillet", 7],
    ["Lundi 20 juillet", 8], ["Mardi 21 juillet", 9], ["Mercredi 22 juillet", 10], ["Jeudi 23 juillet", 11], ["Vendredi 24 juillet", 12], ["Samedi 25 juillet", 13], ["Dimanche 26 juillet", 14],
    ["Lundi 27 juillet", 15], ["Mardi 28 juillet", 16], ["Mercredi 29 juillet", 17], ["Jeudi 30 juillet", 18], ["Vendredi 31 juillet", 19], ["Samedi 1er août", 20], ["Dimanche 2 août", 21],
    ["Lundi 3 août", 22], ["Mardi 4 août", 23], ["Mercredi 5 août", 24], ["Jeudi 6 août", 25], ["Vendredi 7 août", 26], ["Samedi 8 août", 27], ["Dimanche 9 août", 28]
  ]);
  return posts.sort((a, b) => (dateOrder.get(a.date) - dateOrder.get(b.date)) || Number(Boolean(a.isAlternative)) - Number(Boolean(b.isAlternative)));
}

function updateStaticCalendarCopy(html) {
  const calendarIntro = "Les angles sont bilingues et prêts à être finalisés une fois la preuve, le visuel et l’approbation confirmés. Certaines journées proposent deux options exclusives : la direction en choisit une seule. Toutes les publications FB/IG doivent rester sous 2 200 caractères au total; les heures sont des créneaux à tester dans Insights.";
  return html
    .replace("28 jours, 28 raisons de revenir vers le lac.", "28 jours, avec des choix éditoriaux quand deux angles se défendent.")
    .replace(/<p>Les angles sont bilingues[\s\S]*?créneaux à tester dans Insights\.<\/p>/, `<p>${calendarIntro}</p>`)
    .replace('<span><b id="done">0</b> / 28 prêts ou publiés</span>', '<span><b id="done">0</b> / 28 journées prêtes ou publiées</span>');
}

function renderMarkdown(posts) {
  const lines = [
    "# Textes complets — Plan d’attaque été 2026 V2 stratégique (version arbitrable)", "",
    "**Période :** lundi 13 juillet au dimanche 9 août 2026  ",
    "**Usage :** une publication par jour; les journées marquées d’un choix proposent deux angles complets et exclusifs.  ",
    "**Règle :** une seule option est cochée par journée à choix; chaque légende bilingue demeure sous 2 200 caractères au total.", "",
    "Les alternatives ont été ajoutées pour éviter la répétition de deux journées voisines. Elles ne constituent pas des publications supplémentaires : une seule option est retenue par date.", ""
  ];
  for (const post of posts) {
    lines.push(
      `## ${post.date} — ${post.title}`,
      "",
      `**Choix :** ${post.optionLabel || "Publication unique"}  `,
      `**Thème :** ${post.t}  `,
      `**Format :** ${post.format}  `,
      `**Objectif :** ${post.role}  `,
      `**CTA :** ${post.cta}  `,
      `**Visuel final :** ${post.visual}  `,
      `**Source de référence :** ${post.source}  `,
      `**Préparation :** ${post.task}`,
      "",
      "### Légende prête à programmer",
      "",
      "```text",
      post.copy,
      "```",
      ""
    );
  }
  return lines.join("\n");
}

let html = await fs.readFile(planPath, "utf8");
let posts = readPosts(html).filter((post) => post.isAlternative !== true).map((post) => {
  delete post.isAlternative;
  delete post.choiceRequired;
  delete post.optionGroup;
  delete post.optionLabel;
  return post;
});
posts = applyEditorialAdjustments(posts);
posts = reassignDates(posts);
posts = addChoiceGroups(posts);
posts = sortPosts(posts);
const mainPosts = posts.filter((post) => !post.isAlternative);
if (mainPosts.length !== 28 || posts.length !== 34 || new Set(posts.map((post) => post.id)).size !== posts.length) {
  throw new Error(`Le calendrier doit contenir 28 publications principales et 6 alternatives uniques (obtenu : ${mainPosts.length}/${posts.length}).`);
}
if (posts.some((post) => post.copy.length > 2200 || /\[(?:CITATION|PRÉNOM|LIEN|APPROVED|NAME|VERIFIED|ANNÉE|CANAL)/i.test(post.copy))) {
  throw new Error("Un texte est incomplet ou dépasse 2 200 caractères.");
}
html = updateStaticCalendarCopy(replacePosts(html, posts));
await fs.writeFile(planPath, html, "utf8");
await fs.writeFile(markdownPath, renderMarkdown(posts), "utf8");
console.log(JSON.stringify({ updated: planPath, markdownPath, mainPosts: mainPosts.length, totalCards: posts.length, choiceDays: 6, longestCaption: Math.max(...posts.map((post) => post.copy.length)) }, null, 2));
