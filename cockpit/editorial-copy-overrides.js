import { EDITORIAL_OVERRIDES_JUL14_26 } from "./editorial-overrides-jul14-26.js";
import { EDITORIAL_OVERRIDES_JUL27_AUG09 } from "./editorial-overrides-jul27-aug09.js";

const SEPARATOR = "=========================================";
const TONE_VERSION = "warm-neighbourly-v2-2026-07-13";
const BILINGUAL_POLICY_VERSION = "fr-original-en-adaptation-v1";
const QUIZ_URL = "https://bleumassawippi.com/quiz";
const QUIZ_FORMAT_PATTERN = /\b(?:quiz|devinette|deviner|devinez|vrai\s*\/?\s*faux|true\s*or\s*false|guess|myst[eè]re)\b/i;

function bilingual(frOriginal, enAdaptation) {
  return `FR — ${frOriginal}\n\n${SEPARATOR}\n\nEN — ${enAdaptation}`;
}

function insertBeforeHashtags(segment, invitation) {
  const hashtagIndex = segment.search(/\n\n(?=#)/);
  if (hashtagIndex < 0) return `${segment}\n\n${invitation}`;
  return `${segment.slice(0, hashtagIndex)}\n\n${invitation}${segment.slice(hashtagIndex)}`;
}

function appendQuizInvitation(post) {
  const descriptor = [post.title, post.format, post.role, post.cta].filter(Boolean).join(" ");
  if (post.contentVariant !== "quiz" && !QUIZ_FORMAT_PATTERN.test(descriptor)) return;
  if (!post.copy || post.copy.includes(QUIZ_URL)) return;
  const halves = post.copy.split(`\n\n${SEPARATOR}\n\n`);
  if (halves.length !== 2) return;
  post.copy = [
    insertBeforeHashtags(halves[0], `Envie de continuer à jouer? Testez vos connaissances du lac avec notre quiz bilingue de plus de 500 questions : ${QUIZ_URL}`),
    insertBeforeHashtags(halves[1], `Want to keep playing? Test your knowledge of the lake with our bilingual quiz featuring more than 500 questions: ${QUIZ_URL}`)
  ].join(`\n\n${SEPARATOR}\n\n`);
  post.quizDestinationVersion = "bleumassawippi-quiz-v1-2026-07-17";
}

const RESERVE_OVERRIDES = {
  s1d1b: {
    title: "Au bord du lac, une rive pleine de vie",
    cta: "Découvrir trois détails vivants",
    visual: "Photo réelle et lumineuse d’une rive végétalisée du Massawippi, cadrée à hauteur humaine; trois détails doux à découvrir — racines, ombre et petites formes de vie — avec le titre « Une rive pleine de vie ».",
    copy: bilingual(
      "Au bord du Massawippi, une rive végétalisée est bien plus qu’un décor. Ses racines aident à retenir le sol, ses plantes ralentissent une partie de l’eau et son ombre crée des refuges pour le vivant.\n\nUne racine, une feuille, une libellule ou un reflet : ces petits détails racontent ensemble une rive pleine de vie.\n\n#BleuMassawippi #LacMassawippi #RiveVivante #NatureDuLac",
      "Along Massawippi, a vegetated shoreline is much more than scenery. Its roots help hold soil, its plants slow some of the water and its shade creates shelter for living things.\n\nA root, a leaf, a dragonfly or a reflection: together, these small details tell the story of a living shoreline.\n\n#BleuMassawippi #LakeMassawippi #LivingShoreline #LakeNature"
    )
  },
  "alt-20260810": {
    title: "North Hatley, un été d’autrefois",
    cta: "Partager un souvenir du lac",
    visual: "Carte postale panoramique historique présentée au complet dans un album ouvert que des mains consultent; texture, bordure, date approximative et crédit préservés, avec la question « Quel souvenir vous revient? ».",
    copy: bilingual(
      "Cette carte ancienne nous invite à retrouver un été d’autrefois à North Hatley. Elle est datée dans une large fourchette, entre environ 1905 et 1940, et nous offre un point de départ pour regarder, comparer et nous souvenir ensemble.\n\nQuel lieu, quelle habitude de vacances ou quelle histoire de famille cette image vous rappelle-t-elle?\n\n#BleuMassawippi #LacMassawippi #NorthHatley #MémoireDuLac",
      "This historical card invites us into a summer from another time in North Hatley. Dated within a broad range, roughly 1905 to 1940, it offers a starting point for observing, comparing and remembering together.\n\nWhat place, summer tradition or family story does this image bring to mind?\n\n#BleuMassawippi #LakeMassawippi #NorthHatley #LakeMemories"
    )
  },
  s1d3: {
    title: "Pourquoi nous nous impliquons pour le Massawippi",
    format: "Carrousel humain · une courte phrase par membre du conseil d’administration",
    cta: "Rencontrer les personnes derrière la mission",
    visual: "Carrousel chaleureux avec une couverture manuscrite « Pourquoi nous nous impliquons », puis un portrait autorisé et une seule courte citation par personne; possibilité d’une carte typographique sans visage; aucun montage ne doit laisser croire que les personnes ont été photographiées ensemble.",
    copy: bilingual(
      "Derrière les orientations de Bleu Massawippi, il y a des personnes qui donnent du temps, de l’expérience et une attention sincère au lac. Nous leur avons posé une seule question : pourquoi avez-vous choisi de vous impliquer pour le Massawippi?\n\nCe carrousel rassemble leurs réponses, dans leurs mots, avec leur accord. Une façon simple de rencontrer le conseil d’administration et de comprendre les raisons humaines qui font avancer la mission.\n\n#BleuMassawippi #ConseilDAdministration #LacMassawippi #Communauté",
      "Behind Bleu Massawippi’s direction are people who contribute time, experience and genuine care for the lake. We asked them one question: why did you choose to get involved for Massawippi?\n\nThis carousel brings together their answers, in their own words and with their consent. It is a simple way to meet the board of directors and understand the human reasons that move the mission forward.\n\n#BleuMassawippi #BoardOfDirectors #LakeMassawippi #Community"
    )
  }
};

export const EDITORIAL_COPY_OVERRIDES = Object.freeze({
  ...EDITORIAL_OVERRIDES_JUL14_26,
  ...EDITORIAL_OVERRIDES_JUL27_AUG09,
  ...RESERVE_OVERRIDES
});

export const FUTURE_EDITORIAL_IDS = Object.freeze(Object.keys(EDITORIAL_COPY_OVERRIDES));

export function applyEditorialCopyOverrides(posts) {
  if (!Array.isArray(posts)) return posts;
  for (const post of posts) {
    const override = EDITORIAL_COPY_OVERRIDES[post.id];
    if (override) {
      Object.assign(post, override, {
        editorialToneVersion: TONE_VERSION,
        bilingualPolicyVersion: BILINGUAL_POLICY_VERSION
      });
      if (post.optionLabel) {
        post.optionLabel = post.optionLabel.replace(/^(Option\s+[A-Z]+\s+—\s+).*$/u, `$1${post.title}`);
      }
    }
    appendQuizInvitation(post);
  }
  return posts;
}

export { BILINGUAL_POLICY_VERSION, TONE_VERSION };
