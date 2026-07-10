const fs = require('node:fs');

const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');
const marker = 'data-context-version="transcript-2026-07-10"';
if (html.includes(marker)) {
  console.log(JSON.stringify({ updated: file, marker, alreadyIntegrated: true }, null, 2));
  process.exit(0);
}

function replaceOnce(search, replacement, label) {
  if (!html.includes(search)) throw new Error(`Bloc introuvable : ${label}`);
  html = html.replace(search, replacement);
}

replaceOnce(
  '<b>12</b><span>thèmes d’Annie<br>en quatre semaines</span>',
  '<b>12</b><span>thèmes éditoriaux<br>en quatre semaines</span>',
  'statistique nominative'
);

replaceOnce(
  '<a href="#cadence">Cadence</a><a href="#validation">Validation</a>',
  '<a href="#cadence">Cadence</a><a href="#collaboration">Collaboration</a><a href="#validation">Validation</a>',
  'navigation collaboration'
);

replaceOnce(
  '<div class="principle"><b>Inviter, jamais blâmer</b><span>Un ton de voisin compétent : solutions, fierté collective et gestes possibles.</span></div></div></article>',
  '<div class="principle"><b>Inviter, jamais blâmer</b><span>Un ton de voisin compétent : solutions, fierté collective et gestes possibles.</span></div><div class="principle"><b>Des alliés, pas des adversaires</b><span>Créer de la confiance avec les riverains, usagers, entreprises, bénévoles et partenaires avant de demander un changement de pratique.</span></div></div></article>',
  'promesse alliés'
);

replaceOnce(
  '<section id="validation" class="section">',
  `<section id="collaboration" class="section" ${marker}>
 <div class="heading"><p class="eyebrow">Mode de collaboration</p><h2>Une équipe qui avance avec confiance et des portes ouvertes.</h2><p>Le cockpit organise un travail humain, transparent et réversible : les idées arrivent quand elles sont prêtes, les décisions importantes se parlent, et rien ne part automatiquement sans validation.</p></div>
 <div class="grid2">
  <article class="panel"><h3>Rendez-vous et asynchronie</h3><p>Un point de coordination hebdomadaire est prévu le lundi matin, autour de 10 h, à confirmer dans l’agenda partagé. Entre les points, le cockpit sert de boîte de dépôt : commentaires et idées peuvent être laissés sans notification par défaut. Un échange direct intervient lorsqu’un ton, un risque ou une décision importante le justifie.</p></article>
  <article class="panel"><h3>Prioriser sans épuiser</h3><p>La règle de diffusion reste sept publications par semaine, une par jour. Un format léger — photo authentique, légende courte, source claire — est une solution de production légitime lorsque du temps doit être réservé aux demandes de financement, à la recherche, à l’administration, aux partenariats et au développement de projets. Le volume ne remplace jamais la validation.</p></article>
  <article class="panel"><h3>Des alliés autour du lac</h3><p>La relation publique vise à faire des membres, riverains, usagers, entreprises, partenaires et bénévoles des alliés et des ambassadeurs volontaires. On invite sans culpabiliser, on remercie précisément, on explique les bénéfices collectifs et on garde une porte ouverte pour les questions difficiles.</p></article>
  <article class="panel"><h3>Pistes en incubation</h3><div class="principles"><div class="principle"><b>Présence locale variable</b><span>Annonce hebdomadaire d’une présence confirmée au lieu d’accueil, avec photo, plages horaires réelles et lien cartographique; jamais un horaire fixe si l’équipe n’est pas disponible.</span></div><div class="principle"><b>Légendes locales</b><span>Développer les récits et un éventuel personnage éducatif pour les écoles, avec un ton ludique et une validation culturelle avant diffusion.</span></div><div class="principle"><b>Partenariats et subventions</b><span>Documenter les occasions, les critères et les preuves avant de promettre un projet ou une échéance.</span></div></div></article>
 </div>
 <div class="note"><strong>Règle de décision :</strong> la direction garde un droit de regard sur les faits, le contexte, la sécurité, les partenariats et les sujets sensibles; la création peut être ambitieuse tant qu’elle reste vérifiable, respectueuse et révisable.</div>
</section>
<section id="validation" class="section">`,
  'section collaboration'
);

replaceOnce(
  'Une publication principale chaque jour est le rythme retenu. Il devient réaliste grâce à trois contenus piliers plus exigeants et quatre passerelles légères par semaine. La fréquence est une hypothèse mesurée, jamais une promesse d’algorithme.',
  'La règle opérationnelle est de sept publications par semaine, une par jour, ni plus ni moins dans ce cycle. Trois contenus piliers peuvent être accompagnés de quatre passerelles plus légères. Lorsque la capacité doit être réservée au financement, à l’administration, aux partenariats ou au développement de projets, un format photo simple et validé remplace un format riche : la qualité de la preuve reste non négociable.',
  'cadence opérationnelle'
);

replaceOnce(
  'Le calendrier est précis, mais ne devance jamais une validation nécessaire. C’est particulièrement vrai pour les chiffres, analyses, consignes de sécurité, personnes et partenariats.',
  'Le calendrier est précis, mais ne devance jamais une validation nécessaire. La créativité peut ouvrir des pistes; les faits scientifiques, résultats, espèces, sécurité, histoire, questions autochtones, financement, partenaires et toute allégation environnementale exigent une source primaire et une relecture compétente avant diffusion.',
  'validation élargie'
);

replaceOnce(
  '<div class="flow"><div>1. Brief<span>objectif unique + CTA</span></div><div>2. Preuve<span>source, photo, droits</span></div><div>3. Validation<span>selon le risque</span></div><div>4. Programmation<span>FR / EN + UTM</span></div><div>5. Lecture<span>48 h puis vendredi</span></div></div>',
  '<div class="flow"><div>1. Brief<span>objectif unique + CTA</span></div><div>2. Preuve<span>source, photo, droits</span></div><div>3. Validation<span>selon le risque</span></div><div>4. Programmation<span>FR / EN + UTM</span></div><div>5. Lecture<span>48 h puis vendredi</span></div></div><div class="note"><strong>Garde-fou de contexte :</strong> toute référence à l’histoire locale, aux Premières Nations, aux mines, à la contamination ou à un phénomène environnemental doit rester descriptive et sourcée. Si le contexte n’est pas vérifié, le contenu est mis en attente plutôt que simplifié.</div>',
  'garde-fou contextuel'
);

replaceOnce(
  '<tr><td>Vendredi</td><td>Produire les trois piliers; exporter les formats 4:5 et 9:16; amorcer le bilan. Vérifier les données de financement seulement si prêtes et approuvées.</td></tr>',
  '<tr><td>Vendredi</td><td>Produire le prochain contenu pilier et les formats légers; réserver le créneau Zeffy / impact financier lorsque les chiffres sont confirmés et approuvés. Exporter les formats 4:5 et 9:16.</td></tr>',
  'rituel vendredi'
);

replaceOnce(
  '<tr><td>Lundi matin</td><td>Programmer les passerelles, ouvrir les liens UTM, relire FR/EN et désigner la personne de réponse aux commentaires sensibles.</td></tr>',
  '<tr><td>Lundi matin</td><td>Tenir le point de coordination autour de 10 h, puis programmer les passerelles, ouvrir les liens UTM, relire FR/EN et désigner la personne de réponse aux commentaires sensibles.</td></tr>',
  'rituel lundi'
);

replaceOnce(
  '<tr><td>Vendredi PM</td><td>Comparer aux 28 jours précédents; décider de garder, adapter ou suspendre un format pour la semaine suivante.</td></tr>',
  '<tr><td>Vendredi PM</td><td>Comparer aux 28 jours précédents; décider de garder, adapter ou suspendre un format pour la semaine suivante, puis libérer explicitement du temps pour les demandes de financement et les projets structurants.</td></tr>',
  'temps de pilotage'
);

fs.writeFileSync(file, html, 'utf8');
console.log(JSON.stringify({ updated: file, marker, collaboration: true, cadence: '7 publications / semaine', scientificValidation: true }, null, 2));
