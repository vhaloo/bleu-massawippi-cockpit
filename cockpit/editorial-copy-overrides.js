import { EDITORIAL_OVERRIDES_JUL14_26 } from "./editorial-overrides-jul14-26.js";
import { EDITORIAL_OVERRIDES_JUL27_AUG09 } from "./editorial-overrides-jul27-aug09.js";

const SEPARATOR = "=========================================";
const TONE_VERSION = "warm-neighbourly-v1-2026-07-13";

function bilingual(fr, en) {
  return `FR — ${fr}\n\n${SEPARATOR}\n\nEN — ${en}`;
}

const RESERVE_OVERRIDES = {
  s1d1b: {
    title: "Au bord du lac, une rive pleine de vie",
    cta: "Observer et partager un détail",
    visual: "Photo réelle et lumineuse d’une rive végétalisée du Massawippi, cadrée à hauteur humaine; trois détails doux à découvrir — racines, ombre et petites formes de vie — avec le titre « Une rive pleine de vie ».",
    copy: bilingual(
      "Au bord du Massawippi, une rive végétalisée est bien plus qu’un décor. Ses racines aident à retenir le sol, ses plantes ralentissent une partie de l’eau et son ombre crée des refuges pour le vivant.\n\nLors de votre prochaine promenade, quel petit détail attirera votre regard en premier : une racine, une feuille, une libellule ou un reflet? Partagez votre découverte avec nous.\n\n#BleuMassawippi #LacMassawippi #RiveVivante #NatureDuLac",
      "Along Massawippi, a vegetated shoreline is much more than scenery. Its roots help hold soil, its plants slow some of the water and its shade creates shelter for living things.\n\nOn your next walk, what small detail will catch your eye first: a root, a leaf, a dragonfly or a reflection? Share your discovery with us.\n\n#BleuMassawippi #LakeMassawippi #LivingShoreline #LakeNature"
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
    title: "Chaque geste compte autour du Massawippi",
    cta: "Découvrir les façons de participer",
    visual: "Portrait documentaire autorisé d’une personne bénévole en action, ou gros plan chaleureux de mains qui donnent un coup de main près du lac; lumière naturelle et titre discret « Chaque geste compte ».",
    copy: bilingual(
      "Autour du Massawippi, chaque personne peut apporter quelque chose : un peu de temps, une connaissance du territoire, un talent, une idée ou simplement l’envie de donner un coup de main.\n\nNotre banque de bénévoles permet de recevoir des occasions qui correspondent à vos intérêts et à vos disponibilités, sans obligation de participer à chacune. Merci à toutes les personnes qui font déjà vivre cet élan collectif.\n\nDécouvrir les possibilités : https://bleumassawippi.com/benevolat\n\n#BleuMassawippi #Bénévolat #LacMassawippi #Communauté",
      "Around Massawippi, everyone has something to offer: a little time, local knowledge, a skill, an idea or simply the wish to lend a hand.\n\nOur volunteer list shares opportunities that match your interests and availability, with no obligation to take part in every one. Thank you to everyone who already helps this shared momentum grow.\n\nDiscover the possibilities: https://bleumassawippi.com/benevolat\n\n#BleuMassawippi #Volunteer #LakeMassawippi #Community"
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
    if (!override) continue;
    Object.assign(post, override, { editorialToneVersion: TONE_VERSION });
    if (post.optionLabel) {
      post.optionLabel = post.optionLabel.replace(/^(Option\s+[A-Z]+\s+—\s+).*$/u, `$1${post.title}`);
    }
  }
  return posts;
}

export { TONE_VERSION };
