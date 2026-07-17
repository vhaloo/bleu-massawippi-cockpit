const SEPARATOR = "=========================================";

function bilingual(frOriginal, enAdaptation) {
  return `FR — ${frOriginal}\n\n${SEPARATOR}\n\nEN — ${enAdaptation}`;
}

const OFFICIAL_BOAT_CLEANING_URL = "https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/gestion-faune-habitats-fauniques/gestion-especes-exotiques-envahissantes-animales/lutte/nettoyage-embarcations-nautiques";
const BOATING_SAFETY_URL = "https://tc.canada.ca/en/marine-transportation/preparing-operate-your-vessel/maintaining-safe-pleasure-craft";
const MASSAWIPPI_SPEED_LIMIT_FR_URL = "https://tc.canada.ca/fr/transport-maritime/securite-maritime/securite-nautique/annexes-reglement-restrictions-visant-utilisation-batiments-2ieme-edition-avril-2026";
const MASSAWIPPI_SPEED_LIMIT_EN_URL = "https://tc.canada.ca/en/marine-transportation/marine-safety/boating-safety/schedules-vessel-operation-restriction-regulations-2nd-edition-april-2026";

export const EDITORIAL_OVERRIDES_JUL14_26 = Object.freeze({
  s1d3b: {
    title: "Une sortie qui commence bien",
    cta: "Consulter le guide pratique",
    copy: bilingual(
      `Avant de profiter du lac, prenons le temps de vérifier notre embarcation et notre remorque. Retirer les débris, vider l’eau et laver le tout en suivant les étapes recommandées : trois gestes simples qui empêchent les espèces envahissantes de voyager d’un plan d’eau à l’autre.

Merci à toutes les personnes qui intègrent déjà ces gestes à leur routine. Retrouvez les étapes recommandées ici : ${OFFICIAL_BOAT_CLEANING_URL}

#BleuMassawippi #NautismeResponsable #LacMassawippi #Prévention`,
      `Before heading out, take a moment to check the boat and trailer. Removing debris, draining water and washing everything according to the recommended steps are three simple actions that help keep invasive species from travelling between bodies of water.

Thank you to everyone who already makes these steps part of their routine. Follow the official steps here: ${OFFICIAL_BOAT_CLEANING_URL}

#BleuMassawippi #ResponsibleBoating #LakeMassawippi #Prevention`
    ),
    visual: "Photo matinale chaleureuse de mains qui préparent une embarcation au quai; montrer naturellement les trois gestes — débris retirés, eau vidée et lavage — avec le titre discret « Une sortie qui commence bien » et la formule manuscrite au pluriel « Des petits gestes ». Présenter un rituel humain, jamais une inspection punitive."
  },
  "alt-20260714": {
    title: "Votre essentiel avant de partir",
    cta: "Partager votre essentiel",
    copy: bilingual(
      `Les belles sorties ont souvent un petit secret de préparation. Avant de partir sur le Massawippi, quel objet ou quelle habitude vous accompagne toujours : un vêtement de flottaison bien ajusté, une gourde, un sac pour rapporter vos déchets… ou autre chose?

Partagez votre essentiel en commentaire. Votre idée pourrait rendre la prochaine sortie de quelqu’un encore plus agréable.

#BleuMassawippi #LacMassawippi #PlaisirSurLeau #Communauté`,
      `Great outings often begin with one small preparation habit. Before heading onto Massawippi, what item or routine always comes with you: a properly fitted PFD, a water bottle, a bag to carry your waste home—or something else?

Share your essential in the comments. Your idea might make someone else’s next outing even better.

#BleuMassawippi #LakeMassawippi #EnjoyTheLake #Community`
    ),
    visual: "Nature morte vivante près du quai : VFI, gourde, chapeau et petit sac réutilisable, avec une main qui ajoute son propre essentiel. Garder un espace clair pour la question « Et vous, qu’apportez-vous? »."
  },
  s1d4: {
    title: "Le moment où le lac vous appelle",
    cta: "Racontez-nous ce moment",
    calendarTime: "10:00",
    source: "Meta — privilégier une conversation authentique et éviter les appels artificiels à commenter : https://about.fb.com/news/2017/12/news-feed-fyi-fighting-engagement-bait-on-facebook/ · Banque photo de l’association — droits à documenter.",
    task: "Publier le samedi et compléter par une story avec boîte de réponse. Accueillir chaque réponse sans relance insistante, puis évaluer ce format après au moins trois essais comparables dans Meta Business Suite; un premier silence ne justifie ni appât à l’engagement ni répétition immédiate.",
    copy: bilingual(
      `Parfois, il suffit d’une couleur, d’un parfum, d’un son ou d’un souvenir pour avoir envie de retrouver le lac.

Quel moment vous donne le plus envie de retrouver le Massawippi : le calme du matin, une baignade, une sortie en famille ou la lumière du soir? Racontez-le-nous en un mot ou en quelques mots. Nous avons hâte de vous lire.

#BleuMassawippi #LacMassawippi #NotreLac #Estrie`,
      `Sometimes a colour, a familiar scent, a sound or a memory is all it takes to make us long for the lake.

What makes you want to return to Massawippi most: a quiet morning, a swim, time with family or the evening light? Tell us in a word or two. We would love to hear from you.

#BleuMassawippi #LakeMassawippi #OurLake #EasternTownships`
    ),
    visual: "Portrait-paysage réel du lac avec une personne de dos qui contemple l’eau; ajouter la question manuscrite douce « Quand le lac vous appelle-t-il? » et préserver beaucoup d’espace visuel."
  },
  "alt-20260715": {
    title: "La libellule, éclat du rivage",
    cta: "Prendre un moment pour observer",
    source: "Parcs Canada — cycle aquatique des libellules : https://parcs.canada.ca/pn-np/pe/pei-ipe/nature/decouvrir-discover/science/zoneshumides-wetlands · Gouvernement du Canada — rôle écologique : https://www.canada.ca/fr/environnement-changement-climatique/services/registre-public-especes-peril/programmes-retablissement/gomphe-olive-proposition-2021.html",
    copy: bilingual(
      `Une libellule se pose, repart, puis revient danser près de l’eau. Ces petits instants nous rappellent que les rives du Massawippi accueillent une vie aussi discrète que fascinante.

Avant de prendre son envol, la libellule vit sous l’eau au stade larvaire. Larves et adultes sont à la fois prédateurs et proies : ils participent au réseau alimentaire et relient le milieu aquatique aux rives.

Si vous en croisez une, accordez-lui simplement un peu d’espace et profitez du spectacle. Quel petit être vivant avez-vous remarqué près du lac dernièrement?

#BleuMassawippi #LacMassawippi #NatureDuLac #Libellule`,
      `A dragonfly lands, takes off and returns to dance near the water. Encounters like this reveal the remarkable wildlife found along Massawippi’s shores.

Before taking flight, a dragonfly lives underwater as a larva. Both larvae and adults are predators as well as prey: they take part in the food web and connect aquatic habitats with the shoreline.

If you spot one, simply give it a little space and enjoy the show. What small living creature have you noticed near the lake lately?

#BleuMassawippi #LakeMassawippi #LakeNature #Dragonfly`
    ),
    visual: "Affiche naturaliste vintage : libellule crédible sur une tige, petite vignette d’une personne tenant un carnet d’observation et trois détails agrandis — ailes, yeux, tige. Créer une atmosphère de découverte sans pictogramme d’interdiction."
  },
  s1d5: {
    contentVariant: "quiz",
    title: "Le disque blanc qui nous aide à lire le lac",
    cta: "Deviner, puis découvrir",
    copy: bilingual(
      `Quiz du lac : à quoi peut bien servir ce disque blanc que l’on descend dans l’eau?

Il s’agit d’un disque de Secchi. On note la profondeur à laquelle il cesse d’être visible afin d’obtenir un repère sur la transparence de l’eau. Cette mesure ne donne pas, à elle seule, un verdict sur la santé du lac : elle ajoute une pièce au portrait, que l’on compare aux autres indicateurs et aux observations des années précédentes.

Aviez-vous déjà vu cet outil en action?

#QuizDuLac #BleuMassawippi #LacMassawippi #QualitéDeLEau`,
      `Lake quiz: what is the white disk that researchers lower into the water used for?

It is a Secchi disk. We record the depth at which it is no longer visible to obtain an indicator of water clarity. This measurement does not, on its own, determine the lake’s health: it adds one piece to the picture, which is compared with other indicators and observations from previous years.

Have you ever seen this tool in action?

#LakeQuiz #BleuMassawippi #LakeMassawippi #WaterQuality`
    ),
    visual: "Carrousel de trois cartes : vraies mains tenant un disque de Secchi au bord de l’eau; disque descendant sous la surface; schéma simple « visible / moins visible = repère de transparence ». Montrer la personne et le travail de terrain."
  },
  "alt-20260716": {
    title: "Trois regards pour mieux connaître le lac",
    cta: "Garder ce repère",
    copy: bilingual(
      `Connaître un lac, c’est un peu comme apprendre à connaître un voisin : une seule rencontre ne raconte pas toute son histoire.

Observer montre ce qui est visible aujourd’hui. Mesurer donne un repère précis. Comparer les résultats au fil du temps aide à voir comment ce repère évolue. Réunis, ces trois regards construisent un portrait plus juste du Massawippi et nous aident à choisir des actions utiles.

#BleuMassawippi #LacMassawippi #ScienceAccessible #QualitéDeLEau`,
      `Getting to know a lake is a little like getting to know a neighbour: one meeting cannot tell the whole story.

Observation shows what is visible today. Measurement provides a precise reference point. Comparing results over time helps reveal how that reference point changes. Together, these three perspectives build a more accurate picture of Massawippi and help us choose useful actions.

#BleuMassawippi #LakeMassawippi #AccessibleScience #WaterQuality`
    ),
    visual: "Carrousel façon carnet de terrain : une personne observe le lac, une main note une mesure, puis une petite ligne du temps relie plusieurs observations. Titre chaleureux « Observer · mesurer · comparer », sans esthétique clinique."
  },
  s1d6: {
    title: "Juste un instant",
    cta: "Prendre un instant",
    copy: bilingual(
      `Prendre un instant pour regarder ce que nous avons la chance de protéger : le lac, ses rives, les habitats qu’il abrite et les souvenirs qui nous y rattachent.

#InstantBleu #BleuMassawippi #LacMassawippi #Estrie`,
      `Take a moment to appreciate what we are fortunate to protect: the lake, its shorelines, the habitats it supports and the memories that connect us to this place.

#BlueMoment #BleuMassawippi #LakeMassawippi #EasternTownships`
    ),
    visual: "Reel réel de 10 à 15 secondes : arrivée d’une personne au bord du lac, reflet de lumière, main sur une rambarde, respiration et plan final large. Conserver uniquement l’ambiance naturelle enregistrée depuis la rive — eau, vent léger ou oiseaux — sans bruitage de plongée ni son sous-marin ajouté; afficher « Un instant bleu » seulement à la fin."
  },
  "alt-20260717": {
    title: "Votre journée en bleu",
    cta: "Partager votre regard",
    copy: bilingual(
      `Si vous deviez raconter votre journée près du Massawippi avec une photo, une image, un emoji ou quelques mots, que choisiriez-vous?

Partagez votre regard en commentaire. Une eau calme, un ciel changeant, un moment en famille, un simple 💙 : toutes les façons de raconter le lac sont les bienvenues. Si une personne apparaît sur votre photo, assurez-vous d’avoir son accord avant de la publier.

#RegardBleu #BleuMassawippi #LacMassawippi #Communauté`,
      `If you could tell the story of your day near Massawippi with a photo, an image, an emoji or a few words, what would you choose?

Share your perspective in the comments. Calm water, a changing sky, family time or a simple 💙: every way of telling the lake’s story is welcome. If someone appears in your photo, please make sure you have their permission before posting it.

#BluePerspective #BleuMassawippi #LakeMassawippi #Community`
    ),
    visual: "Conserver la photo réelle déjà appréciée dans OneDrive, avec le mot BLEU dessiné sur l’eau. Ajouter seulement une invitation discrète « Et votre journée? » sans simuler de témoignage."
  },
  s1d7: {
    title: "Vos souvenirs font vivre le lac",
    cta: "Raconter un souvenir",
    copy: bilingual(
      `Le Massawippi vit dans ses paysages, mais aussi dans les souvenirs que nous y créons.

Quelle expérience aimeriez-vous transmettre à une personne qui ne connaît pas encore le lac : une première baignade, un matin brumeux, une sortie en famille, un moment de silence?

Racontez-nous ce souvenir en commentaire. Merci de nous aider à faire entendre la voix de toute la communauté.

#BleuMassawippi #MémoireDuLac #LacMassawippi #Estrie`,
      `Massawippi lives in its landscapes, but also in the memories we create there.

What experience would you share with someone who has not yet discovered the lake: a first swim, a misty morning, a family outing, a quiet moment?

Tell us about it in the comments. Thank you for helping us share the voice of the whole community.

#BleuMassawippi #LakeMemories #LakeMassawippi #EasternTownships`
    ),
    visual: "Photo de mains qui ouvrent un album ou tiennent une image autorisée du lac devant le paysage actuel. Suggérer une chaleur intergénérationnelle sans exiger de visage identifiable; titre « Vos souvenirs font vivre le lac »."
  },
  "alt-20260718": {
    title: "Qu’est-ce qui se cache sous nos pas?",
    cta: "Découvrir ce petit monde",
    source: "Gouvernement du Québec — biodiversité des rives et milieux humides : https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/biodiversite/biodiversite-quebec · Gouvernement du Québec — bandes riveraines, habitats et stabilisation des sols : https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/agriculture/pratiques-agricoles-environnement/gestion-eau-sols · Parcs Canada — salamandres et litière de feuilles : https://parcs.canada.ca/pn-np/ab/waterton/nature/faune-wildlife/reptiles-amphibians/salamandre-salamander",
    copy: bilingual(
      `Qu’est-ce qui se cache sous les feuilles, les racines et les pierres d’une rive vivante?

Ce couvert forme des refuges pour de nombreux invertébrés et, selon le milieu, pour des amphibiens. La végétation riveraine contribue aussi à retenir le sol, à ralentir le ruissellement et à réduire l’érosion. Toute une communauté discrète participe ainsi à la biodiversité du rivage.

Lors de votre prochaine promenade, prenez le temps d’observer ce petit monde en laissant feuilles, pierres et animaux à leur place. Quel détail attire votre curiosité?

#BleuMassawippi #LacMassawippi #RiveVivante #NatureDuLac`,
      `What might be hiding beneath the leaves, roots and stones of a living shoreline?

This cover provides refuge for many invertebrates and, depending on the habitat, amphibians. Shoreline vegetation also helps hold soil in place, slow runoff and reduce erosion. An entire quiet community supports shoreline biodiversity.

On your next walk, take time to notice this small world while leaving leaves, stones and animals where they are. Which detail sparks your curiosity?

#BleuMassawippi #LakeMassawippi #LivingShoreline #LakeNature`
    ),
    visual: "Planche d’exploration façon carnet naturaliste : coupe d’une rive avec feuilles, racines et pierres; invertébrés discrets et petite salamandre abritée sous une roche, sans prétendre identifier une espèce locale. Ajouter deux repères doux « refuge vivant » et « sol protégé »."
  },
  s1d2: {
    title: "Suivre le lac et ses tributaires pour mieux comprendre",
    cta: "Découvrir les coulisses du suivi",
    source: "Gouvernement du Québec — Réseau de surveillance volontaire des lacs et Plan national de l’eau : https://www.quebec.ca/gouvernement/politiques-orientations/plan-national-eau",
    copy: bilingual(
      `Le suivi du lac et de ses tributaires est essentiel pour mieux comprendre le bassin versant et mieux le protéger.

Sur le terrain, chaque observation, prélèvement et mesure ajoute une donnée. Répétés avec une méthode constante et comparés dans le temps, ces gestes nous aident à distinguer une variation ponctuelle d’une tendance, à partager une information plus juste et à orienter les actions utiles.

Merci aux personnes qui rendent ce travail patient possible, saison après saison.

#BleuMassawippi #LacMassawippi #ScienceDuLac #Coulisses`,
      `Monitoring the lake and its tributaries is essential to understanding the watershed better and protecting it more effectively.

In the field, every observation, sample and measurement adds a data point. Repeated with a consistent method and compared over time, these actions help distinguish a short-term variation from a trend, support clearer information and guide useful action.

Thank you to everyone who makes this patient work possible, season after season.

#BleuMassawippi #LakeMassawippi #LakeScience #BehindTheScenes`
    ),
    visual: "Reel de 12 à 15 secondes centré sur le suivi réel : mains qui préparent un flacon, prélèvent, inscrivent une mesure et comparent le carnet. Sous-titre : « Suivre · comparer · mieux protéger »."
  },
  "alt-20260719": {
    title: "Le Massawippi vu en 1859",
    cta: "Explorer l’image avec nous",
    copy: bilingual(
      `Avant que la photographie devienne courante, des artistes représentaient déjà le Massawippi.

Cette estampe publiée en 1859 par Samuel Bradshaw, d’après une œuvre de William Henry Bartlett, illustre le paysage à travers le regard d’un artiste de son époque. Ce n’est pas une photographie, mais une interprétation historique qui nous invite à observer, à comparer et à nous souvenir.

Quel détail vous attire en premier?

#BleuMassawippi #LacMassawippi #Patrimoine #MémoireDuLac`,
      `Before photography became commonplace, artists were already depicting Massawippi.

This 1859 print by Samuel Bradshaw, after a work by William Henry Bartlett, illustrates the landscape through the eyes of an artist of that era. It is not a photograph, but a historical interpretation that invites us to observe, compare and remember.

Which detail catches your eye first?

#BleuMassawippi #LakeMassawippi #Heritage #LakeMemories`
    ),
    visual: "Estampe de 1859 complète et non colorisée, présentée comme une page que deux mains consultent sur une table claire; seconde carte avec un détail agrandi et le crédit lisible. Donner l’impression d’ouvrir ensemble une fenêtre sur le passé."
  },
  s2d1: {
    title: "Iris versicolore : la beauté d’un milieu essentiel",
    cta: "Regarder la fleur et tout son milieu",
    source: "Gouvernement du Québec — emblème floral et importance de l’eau et des milieux humides : https://www.quebec.ca/gouvernement/portrait-quebec/drapeau-symboles-nationaux/emblemes/iris-versicolore · Gouvernement du Québec — fonctions écologiques des milieux humides : https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/forets/protection-forets/territoires-forestiers-proteges/milieux-humides-interet",
    copy: bilingual(
      `Difficile de détourner le regard de l’iris versicolore. Ses nuances de violet, de bleu et de jaune en font une présence saisissante — et l’emblème floral du Québec.

Mais cette fleur nous invite surtout à voir plus grand qu’elle. Elle pousse dans des milieux humides et riverains dont l’équilibre contribue à la qualité de l’eau, à la stabilisation des rives et à une biodiversité riche. Admirer l’iris, c’est aussi reconnaître la valeur du milieu vivant qui l’accueille.

Si vous en observez un, profitez-en avec les yeux et la caméra, sans le cueillir ni révéler un emplacement sensible.

#ZoomNature #BleuMassawippi #IrisVersicolore #LacMassawippi`,
      `It is hard to look away from a blue flag iris. Its violet, blue and yellow colours make it a striking presence—and Quebec’s floral emblem.

Yet this flower mainly invites us to see beyond the bloom itself. It grows in wetlands and shoreline habitats whose balance supports water quality, shoreline stability and rich biodiversity. Admiring the iris also means recognizing the value of the living habitat around it.

If you spot one, enjoy it with your eyes and camera, without picking it or revealing a sensitive location.

#NatureZoom #BleuMassawippi #BlueFlagIris #LakeMassawippi`
    ),
    visual: "Visuel phare 4:5 à fort impact : macro réaliste et correctement identifiée d’un iris versicolore, fleur très présente mais milieu humide encore lisible. Seconde carte éducative vintage : plante entière, fleur agrandie et trois repères — « eau · rive · biodiversité ». Aucun emplacement précis."
  },
  s2d1b: {
    contentVariant: "quiz",
    title: "Le petit quiz des milieux humides",
    cta: "Choisir une réponse",
    copy: bilingual(
      `Question du jour : quels rôles un milieu humide peut-il jouer autour d’un lac?

A — Ralentir l’eau et favoriser le dépôt de certains sédiments.
B — Offrir des habitats à de nombreuses espèces.
C — Contribuer à filtrer l’eau et à stabiliser les milieux riverains.

Réponse : toutes ces réponses! Un même milieu humide peut remplir plusieurs fonctions à la fois. La façon précise dont il le fait dépend de son type, de son état et de son emplacement.

Laquelle de ces fonctions aimeriez-vous explorer dans une prochaine capsule?

#QuizDuLac #BleuMassawippi #MilieuxHumides #LacMassawippi`,
      `Today’s question: what roles can a wetland play around a lake?

A — Slow water and encourage some sediment to settle.
B — Provide habitat for many species.
C — Help filter water and stabilize shorelines.

Answer: all of the above! One wetland can perform several functions at the same time. Exactly how it does so depends on its type, condition and location.

Which of these functions would you like us to explore in a future post?

#LakeQuiz #BleuMassawippi #Wetlands #LakeMassawippi`
    ),
    visual: "Illustration ludique en coupe d’un milieu humide : eau ralentie, plantes, oiseaux et insectes; deux personnes sur une passerelle observent. Trois choix A/B/C clairs, puis réponse sur une seconde carte."
  },
  s2d7: {
    title: "Une image, une époque, le même amour du lac",
    cta: "Regarder les détails",
    copy: bilingual(
      `Datée de 1900, cette carte postale montre l’ancienne bibliothèque de North Hatley. Regardons-la sans montage ni comparaison : sa façade, son toit, ses fenêtres et la neige racontent à leur manière une époque du village.

Les bâtiments et les habitudes changent, mais l’amour du lac et des lieux qui l’entourent se transmet. Cette image est un fragment de la mémoire locale qui nous relie encore aujourd’hui au Massawippi et à sa communauté.

Crédit : Jean B. Le Baron — domaine public.

#Patrimoine #BleuMassawippi #LacMassawippi #MémoireDuLac`,
      `Dated 1900, this postcard shows North Hatley’s former library. Its facade, steep roof, windows and snow-covered setting offer a glimpse of village life at the turn of the century.

Buildings and daily habits change, but love for the places surrounding Massawippi is passed on. This image is a fragment of local memory that still connects us to the lake and its community today.

Credit: Jean B. Le Baron — public domain.

#Heritage #BleuMassawippi #LakeMassawippi #LakeMemories`
    ),
    source: "Domaine public · 1900 · Jean B. Le Baron / Wikimedia Commons : https://commons.wikimedia.org/wiki/File:Old_North_Hatley_Library.png",
    visual: "Utiliser uniquement la carte postale historique complète 1900_ancienne-bibliotheque-north-hatley.png, non colorisée et sans photo récente, maison actuelle ni montage avant/après. Préserver l’inscription d’origine; si une note manuscrite est ajoutée, la limiter à « Le même amour du lac » dans une marge qui ne masque aucun détail.",
    fallback: "Publier la carte postale complète sans surimpression, avec son crédit dans la légende.",
    task: "Mettre en valeur uniquement la carte postale de 1900, conserver son inscription et son crédit, puis vérifier l’aperçu mobile avant programmation.",
    tasksValentin: [
      "Utiliser uniquement la carte postale 1900_ancienne-bibliotheque-north-hatley.png; ne pas ajouter de maison ni de photographie récente.",
      "Préserver l’image complète, son inscription d’origine et le crédit Jean B. Le Baron — domaine public; vérifier l’aperçu mobile.",
      "Finaliser la légende FR / EN, soumettre le média unique à la validation, puis programmer seulement après le feu vert final."
    ],
    tasksAnnie: [
      "Confirmer que la carte postale historique unique et sa présentation sobre conviennent avant la programmation."
    ]
  },
  "alt-20260721": {
    title: "Le plongeon huard (Gavia immer), voix du lac",
    cta: "Écouter et observer à bonne distance",
    copy: bilingual(
      `Un appel traverse l’eau, puis une silhouette noire et blanche glisse à la surface : le plongeon huard (Gavia immer) sait rendre un instant au lac inoubliable.

Profitons de la rencontre sans la bousculer. Ralentir, lui laisser de l’espace et observer à bonne distance permet d’admirer l’oiseau tout en respectant son rythme. Avez-vous déjà reconnu l’un de ses chants?

#BleuMassawippi #LacMassawippi #PlongeonHuard #ObservationRespectueuse`,
      `A call travels across the water, then a black-and-white silhouette glides into view: the common loon (Gavia immer) can make a moment on the lake unforgettable.

Let’s enjoy the encounter without crowding it. Slowing down, leaving space and watching from a respectful distance lets us admire the bird while respecting its rhythm. Have you ever recognized one of its calls?

#BleuMassawippi #LakeMassawippi #CommonLoon #RespectfulWildlifeViewing`
    ),
    visual: "Photographie réelle forte, verticale 4:5, d’un plongeon huard adulte sur l’eau, nette et lumineuse, avec beaucoup d’espace respirant. Afficher sobrement « Plongeon huard · Gavia immer ». Aucun rendu aquarelle, aucun décor inventé; crédit et droit d’utilisation documentés."
  },
  s2d3: {
    title: "Quelques minutes qui voyagent loin",
    cta: "Voir les étapes recommandées",
    copy: bilingual(
      `Chaque changement de plan d’eau est une belle occasion de prendre soin du prochain.

Avant la mise à l’eau, quelques minutes pour inspecter l’embarcation et la remorque, retirer les débris, vider l’eau et suivre les étapes de nettoyage recommandées peuvent faire une réelle différence. Merci à toutes les personnes qui font déjà de ce passage une habitude.

Guide officiel : ${OFFICIAL_BOAT_CLEANING_URL}

#Prévention #BleuMassawippi #NautismeResponsable #LacMassawippi`,
      `Every move from one body of water to another is an opportunity to care for the next one.

Before launch, a few minutes to inspect the boat and trailer, remove debris, drain water and follow the recommended cleaning steps can make a real difference. Thank you to everyone who already makes this part of their routine.

Official guidance: ${OFFICIAL_BOAT_CLEANING_URL}

#Prevention #BleuMassawippi #ResponsibleBoating #LakeMassawippi`
    ),
    visual: "Carrousel photo documentaire en trois gestes réalisés par une même personne, souriante ou montrée par les mains : regarder coque et remorque, retirer un fragment, puis vider et nettoyer selon le guide. Finir par « Merci d’en faire une habitude »."
  },
  "alt-20260722": {
    contentVariant: "quiz",
    title: "Ça semble propre… mais l’est-ce vraiment?",
    cta: "Faire défiler pour vérifier les étapes",
    copy: bilingual(
      `Vrai ou faux? Une embarcation sans débris visible peut passer directement d’un plan d’eau à un autre.

Faux. Ne rien voir ne veut pas dire qu’aucun organisme n’est présent. Pour réduire le risque de transporter des espèces exotiques envahissantes (EEE), le lavage de tout ce qui a touché l’eau est essentiel. Il faut aussi vider l’eau retenue et sécher selon les consignes officielles : un simple coup d’œil ne remplace pas ces étapes.

Le guide à garder sous la main : ${OFFICIAL_BOAT_CLEANING_URL}

#QuizDuLac #BleuMassawippi #EspècesEnvahissantes #NautismeResponsable`,
      `True or false? A boat with no visible debris can move directly from one body of water to another.

False. Seeing nothing does not mean no organisms are present. To reduce the risk of transporting invasive alien species, washing everything that has touched the water is essential. Retained water must also be drained and equipment dried according to official guidance: a visual check cannot replace those steps.

Keep the official guide handy: ${OFFICIAL_BOAT_CLEANING_URL}

#LakeQuiz #BleuMassawippi #InvasiveSpecies #ResponsibleBoating`
    ),
    visual: "Planche scolaire chaleureuse : une embarcation qui semble propre, un détail grossi des organismes invisibles à l’œil nu, puis les trois gestes « Nettoyer · Vider · Sécher ». Question manuscrite bilingue : « Ça semble propre… mais l’est-ce vraiment? / It looks clean… but is it really? »."
  },
  s2d2: {
    title: "Une rive vivante protège et accueille",
    cta: "Regarder la rive en action",
    copy: bilingual(
      `Une rive végétalisée ne fait pas que border le lac : elle le protège et elle accueille la vie.

Ses racines aident à garder le sol en place. Ses plantes ralentissent une partie du ruissellement. Son ombre et sa diversité offrent nourriture, abri et passages à une foule d’insectes, d’amphibiens, d’oiseaux et d’autres animaux riverains.

Quelle présence animale avez-vous déjà remarquée près d’une rive végétalisée du Massawippi?

#BandesRiveraines #BleuMassawippi #LacMassawippi #BassinVersant`,
      `A vegetated shoreline does more than border the lake: it helps protect it and welcomes life.

Its roots help hold soil in place. Its plants slow some runoff. Its shade and diversity provide food, shelter and passage for many insects, amphibians, birds and other shoreline animals.

What wildlife have you noticed near a vegetated shoreline at Massawippi?

#ShorelineProtection #BleuMassawippi #LakeMassawippi #Watershed`
    ),
    visual: "Diptyque réel : large rive végétalisée et gros plan où la faune est réellement visible ou discrètement suggérée par ses habitats. Ajouter trois repères doux — « sol retenu · eau ralentie · faune accueillie » — sans inventer une espèce locale."
  },
  "alt-20260723": {
    title: "Retenir. Ralentir. Accueillir.",
    cta: "Voir la rive autrement",
    copy: bilingual(
      `Retenir le sol. Ralentir l’eau. Accueillir la faune.

Trois gestes, une même rive vivante. Ses racines stabilisent le sol, sa végétation freine une partie du ruissellement et ses différentes hauteurs créent des abris pour de nombreuses espèces.

La prochaine fois que vous longez le lac, lequel de ces rôles remarquerez-vous en premier?

#BleuMassawippi #LacMassawippi #RiveVivante #NatureDuLac`,
      `Hold the soil. Slow the water. Welcome wildlife.

Three actions, one living shoreline. Its roots stabilize soil, its vegetation slows some runoff and its different layers create shelter for many species.

Next time you travel along the lake, which of these roles will you notice first?

#BleuMassawippi #LakeMassawippi #LivingShoreline #LakeNature`
    ),
    visual: "Triptyque illustré vintage relié par une même rive : « Retenir » sur les racines, « Ralentir » sur l’eau, « Accueillir » près d’un refuge faunique. Des verbes grands et très lisibles, une scène chaleureuse, aucun ton de leçon."
  },
  s2d4: {
    title: "Cet automne, découvrons les jardins de pluie",
    cta: "Manifester votre intérêt",
    copy: bilingual(
      `Après une averse, l’eau se met en route vers les fossés, les ruisseaux et parfois jusqu’au lac. Sur son chemin, elle peut emporter de la terre, des débris végétaux, des fertilisants et d’autres polluants présents au sol.

Un jardin de pluie lui offre un endroit où ralentir et pénétrer doucement dans le sol. Cet automne, Bleu Massawippi prépare un atelier pour découvrir le principe, voir des exemples et poser vos questions. La date sera annoncée dès qu’elle sera confirmée.

Vous aimeriez recevoir les détails? Écrivez-nous en message privé et nous vous tiendrons au courant.

#JardinsDePluie #BleuMassawippi #BassinVersant #LacMassawippi`,
      `After a downpour, runoff flows toward ditches and streams—and sometimes all the way to the lake. Along the way, it can pick up soil, plant debris, fertilizers and other pollutants found on the ground.

A rain garden gives that water a place to slow down and gently soak into the ground. This fall, Bleu Massawippi is preparing a workshop to explore the idea, see examples and answer questions. The date will be shared as soon as it is confirmed.

Would you like to receive the details? Send us a private message and we will keep you informed.

#RainGardens #BleuMassawippi #Watershed #LakeMassawippi`
    ),
    visual: "Visuel semi-promotionnel chaleureux d’un jardin de pluie après l’averse, avec les mentions « Atelier cet automne » et « Détails à venir ». Montrer l’eau qui ralentit et entre dans le sol; ne pas afficher de date, d’adresse ou de promesse non confirmée."
  },
  "alt-20260724": {
    title: "Un atelier jardins de pluie cet automne",
    cta: "Nous dire si cela vous intéresse",
    copy: bilingual(
      `Et si l’on aidait l’eau de pluie à ralentir avant qu’elle poursuive son chemin vers les fossés, les ruisseaux et le lac?

Bleu Massawippi prépare pour cet automne un atelier accessible sur les jardins de pluie : comment ils fonctionnent, ce qu’ils peuvent apporter et par où commencer. La date et les modalités seront annoncées lorsqu’elles seront confirmées.

Cette rencontre vous intéresserait? Dites-le-nous en commentaire ou écrivez-nous en message privé.

#JardinsDePluie #BleuMassawippi #BassinVersant #CetAutomne`,
      `What if we helped rainwater slow down before it continued toward ditches, streams and the lake?

This fall, Bleu Massawippi is preparing a practical, beginner-friendly workshop on rain gardens: how they work, what they can offer and where to begin. The date and details will be announced once they are confirmed.

Would you be interested? Tell us in the comments or send us a private message.

#RainGardens #BleuMassawippi #Watershed #ThisFall`
    ),
    visual: "Semi-promo douce avec photo ou illustration crédible d’un jardin de pluie, titre « Atelier cet automne » et sous-titre « Détails à venir ». Laisser un espace net pour l’appel à manifester son intérêt; aucune date ni adresse inventée."
  },
  s2d5: {
    title: "Près de la rive, ralentir protège le plaisir",
    cta: "Respecter le 10 km/h à moins de 100 m",
    copy: bilingual(
      `Sur le Massawippi, le plaisir prend mille formes : naviguer, pagayer, pêcher, nager ou simplement admirer la rive.

Pour les embarcations à propulsion mécanique ou électrique, la limite officielle est de 10 km/h à 100 mètres ou moins de la rive du lac Massawippi. Respecter cette zone, garder une distance confortable et rester attentif à son sillage aide à protéger les rives et à laisser de l’espace aux autres usages.

Merci de ralentir près du bord : c’est une attention simple qui réduit notre impact sur un écosystème fragile et rend le lac plus agréable pour tout le monde.

Source officielle — Transports Canada : ${MASSAWIPPI_SPEED_LIMIT_FR_URL}

#NautismeResponsable #BleuMassawippi #LacMassawippi #PlaisirPartagé`,
      `On Massawippi, enjoyment takes many forms: boating, paddling, fishing, swimming or simply taking in the shoreline.

For power-driven and electrically propelled vessels, the official limit is 10 km/h within 100 metres of the shore of Lake Massawippi. Respecting this zone, leaving comfortable space and staying aware of your wake helps protect shorelines and leaves room for other lake users.

Thank you for slowing down near shore. It is a simple courtesy that reduces our impact on a fragile ecosystem and makes the lake more enjoyable for everyone.

Official source — Transport Canada: ${MASSAWIPPI_SPEED_LIMIT_EN_URL}

#ResponsibleBoating #BleuMassawippi #LakeMassawippi #SharedEnjoyment`
    ),
    visual: "Planche scolaire vintage très simple : une rive, une embarcation, la limite de 100 m et le repère 10 km/h. Retirer les explications périphériques et ajouter seulement l’accroche manuscrite chaleureuse « Mon lac, j’en prends soin · I care for my lake »."
  },
  "alt-20260725": {
    title: "Partager le lac, c’est aussi se laisser de l’espace",
    cta: "Choisir la courtoisie",
    copy: bilingual(
      `Une belle journée sur l’eau devient encore meilleure quand chacun peut y trouver sa place.

Ralentir au bon moment, regarder autour de soi et laisser de l’espace aux autres embarcations comme aux personnes près des rives : ce sont de petits choix qui font une grande différence dans l’expérience de tous.

Merci de contribuer à cette ambiance accueillante.

#BleuMassawippi #LacMassawippi #CourtoisieNautique #Communauté`,
      `A beautiful day on the water becomes even better when everyone has room to enjoy it.

Slowing down at the right time, looking around and leaving space for other vessels and people near shore are small choices that make a big difference to everyone’s experience.

Thank you for helping create that welcoming atmosphere.

#BleuMassawippi #LakeMassawippi #BoatingCourtesy #Community`
    ),
    visual: "Mini-récit en trois cases : main qui réduit doucement la vitesse, salut amical entre usagers, puis famille ou personne profitant d’une rive calme. Dernière carte : « Merci de partager le lac »."
  },
  s2d6: {
    title: "Bien préparés, pleinement disponibles pour le plaisir",
    cta: "Vérifier avant de partir",
    copy: bilingual(
      `Les meilleurs souvenirs sur l’eau commencent souvent par quelques minutes de préparation.

Avant de partir, prenons le temps de regarder la météo, l’état de l’embarcation et l’équipement de sécurité. Un gilet de sauvetage ou un VFI bien ajusté pour chaque personne à bord permet ensuite de profiter du lac avec l’esprit plus tranquille.

Bonne sortie et soyez prudents!

Référence : ${BOATING_SAFETY_URL}

#SécuritéNautique #BleuMassawippi #LacMassawippi #PlaisirSurLeau`,
      `The best memories on the water often begin with a few minutes of preparation.

Before heading out, take time to check the weather, the condition of the vessel and the safety equipment. A properly fitted lifejacket or PFD for everyone on board helps everyone enjoy the lake with greater peace of mind.

Have a wonderful—and safe—outing!

Reference: ${BOATING_SAFETY_URL}

#BoatingSafety #BleuMassawippi #LakeMassawippi #EnjoyTheLake`
    ),
    visual: "Photo authentique d’une préparation joyeuse : adultes, enfant ou amis ajustent leurs VFI pendant qu’une autre personne consulte la météo, embarcation prête en arrière-plan. Tous les consentements doivent être documentés."
  },
  "alt-20260726": {
    title: "Quand un bateau à vapeur traversait le Massawippi",
    cta: "Partager une histoire de famille",
    copy: bilingual(
      `Vers 1904, un bateau à vapeur traverse le lac Massawippi tandis qu’un voilier apparaît près de la rive. Cette photographie nous ouvre une fenêtre fascinante sur les déplacements et la villégiature d’une autre époque.

Votre famille conserve-t-elle une histoire ou une photo du lac de ces années-là?

#BleuMassawippi #LacMassawippi #Patrimoine #MémoireDuLac`,
      `Around 1904, a steamship crosses Lake Massawippi while a sailboat appears near the shore. This photograph opens a fascinating window onto travel and summer life in another era.

Does your family have stories or photographs of the lake from that era?

#BleuMassawippi #LakeMassawippi #Heritage #LakeMemories`
    ),
    visual: "Photographie de 1904 complète et non colorisée dans un album que des mains feuillettent; seconde carte avec détail du vapeur et du voilier, date approximative et crédit; troisième carte ouverte à la mémoire familiale : « Quelle histoire nous raconteriez-vous? »."
  }
});

export default EDITORIAL_OVERRIDES_JUL14_26;
