const SEPARATOR = "=========================================";

function bilingual(fr, en) {
  return `FR — ${fr}\n\n${SEPARATOR}\n\nEN — ${en}`;
}

const OFFICIAL_BOAT_CLEANING_URL = "https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/gestion-faune-habitats-fauniques/gestion-especes-exotiques-envahissantes-animales/lutte/nettoyage-embarcations-nautiques";
const BOATING_SAFETY_URL = "https://tc.canada.ca/en/marine-transportation/preparing-operate-your-vessel/maintaining-safe-pleasure-craft";

export const EDITORIAL_OVERRIDES_JUL14_26 = Object.freeze({
  s1d3b: {
    title: "Une sortie qui commence bien",
    cta: "Consulter le guide pratique",
    copy: bilingual(
      `Le plaisir commence avant même la mise à l’eau. En prenant un petit moment pour regarder l’embarcation et la remorque, retirer les débris visibles et vider l’eau retenue, nous aidons ensemble à prendre soin des lacs que nous aimons.

Merci à toutes les personnes qui intègrent déjà ces gestes à leur routine. Retrouvez les étapes recommandées ici : ${OFFICIAL_BOAT_CLEANING_URL}

#BleuMassawippi #NautismeResponsable #LacMassawippi #Prévention`,
      `Enjoyment begins even before launch. By taking a moment to check the boat and trailer, remove visible debris and drain retained water, we can all help care for the lakes we love.

Thank you to everyone who already makes these steps part of their routine. Find the recommended guidance here: ${OFFICIAL_BOAT_CLEANING_URL}

#BleuMassawippi #ResponsibleBoating #LakeMassawippi #Prevention`
    ),
    visual: "Photo matinale chaleureuse de mains qui préparent une embarcation au quai; montrer trois détails naturels — coque regardée, débris retiré et eau vidée — avec le titre discret « Une sortie qui commence bien ». Présenter un rituel humain, jamais une inspection punitive."
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
    title: "Le Massawippi, en un mot",
    cta: "Nous dire votre mot",
    copy: bilingual(
      `Une couleur, un parfum, un son, un souvenir… Le Massawippi occupe une place différente dans le cœur de chacun.

Quel est le premier mot qui vous vient quand vous pensez au lac? Écrivez-le en commentaire. Nous avons vraiment envie de découvrir ce que ce lieu évoque pour vous — et de faire vivre tous ces regards dans nos prochaines publications.

#BleuMassawippi #LacMassawippi #NotreLac #Estrie`,
      `A colour, a scent, a sound, a memory… Massawippi holds a different place in every heart.

What is the first word that comes to mind when you think of the lake? Share it in the comments. We would truly love to learn what this place means to you—and carry those perspectives into future posts.

#BleuMassawippi #LakeMassawippi #OurLake #EasternTownships`
    ),
    visual: "Portrait-paysage réel du lac avec une personne de dos qui contemple l’eau; ajouter la question manuscrite douce « Le Massawippi, en un mot? » et préserver beaucoup d’espace visuel."
  },
  "alt-20260715": {
    title: "La libellule, éclat du rivage",
    cta: "Prendre un moment pour observer",
    copy: bilingual(
      `Une libellule se pose, repart, puis revient danser près de l’eau. Ces petits instants nous rappellent que les rives du Massawippi accueillent une vie aussi discrète que fascinante.

Si vous en croisez une, accordez-lui simplement un peu d’espace et profitez du spectacle. Quel petit être vivant avez-vous remarqué près du lac dernièrement?

#BleuMassawippi #LacMassawippi #NatureDuLac #Libellule`,
      `A dragonfly lands, takes off and returns to dance near the water. These small moments remind us that Massawippi’s shores welcome life that is both quiet and fascinating.

If you spot one, simply give it a little space and enjoy the show. What small living creature have you noticed near the lake lately?

#BleuMassawippi #LakeMassawippi #LakeNature #Dragonfly`
    ),
    visual: "Affiche naturaliste vintage : libellule crédible sur une tige, petite vignette d’une personne tenant un carnet d’observation et trois détails agrandis — ailes, yeux, tige. Créer une atmosphère de découverte sans pictogramme d’interdiction."
  },
  s1d5: {
    title: "Le disque blanc qui nous aide à lire le lac",
    cta: "Deviner, puis découvrir",
    copy: bilingual(
      `Quiz du lac : à quoi peut bien servir ce disque blanc que l’on descend dans l’eau?

Il s’agit d’un disque de Secchi. On note la profondeur à laquelle il cesse d’être visible afin d’obtenir un repère sur la transparence de l’eau. C’est un indice précieux — parmi plusieurs autres — pour suivre le lac dans le temps.

Aviez-vous déjà vu cet outil en action?

#QuizDuLac #BleuMassawippi #LacMassawippi #QualitéDeLEau`,
      `Lake quiz: what is the white disk that researchers lower into the water used for?

It is a Secchi disk. We record the depth at which it is no longer visible to obtain an indicator of water clarity. It is one valuable clue—among several others—that helps us follow the lake over time.

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

On observe ce qui se passe aujourd’hui, on mesure certains repères, puis on compare les résultats au fil du temps. Ensemble, ces trois regards nous aident à mieux comprendre le Massawippi et à choisir des actions utiles.

#BleuMassawippi #LacMassawippi #ScienceAccessible #QualitéDeLEau`,
      `Getting to know a lake is a little like getting to know a neighbour: one meeting cannot tell the whole story.

We observe what is happening today, measure selected indicators, and compare results over time. Together, these three perspectives help us understand Massawippi and choose useful actions.

#BleuMassawippi #LakeMassawippi #AccessibleScience #WaterQuality`
    ),
    visual: "Carrousel façon carnet de terrain : une personne observe le lac, une main note une mesure, puis une petite ligne du temps relie plusieurs observations. Titre chaleureux « Observer · mesurer · comparer », sans esthétique clinique."
  },
  s1d6: {
    title: "Une minute bleue au Massawippi",
    cta: "Faire une pause avec nous",
    copy: bilingual(
      `Aujourd’hui, nous vous invitons simplement à faire une pause.

Une minute pour regarder la lumière sur l’eau, écouter la rive et apprécier ce lieu qui rassemble tant de souvenirs. Prendre soin du Massawippi commence aussi par le bonheur de le connaître et de l’aimer.

Respirez, profitez… et racontez-nous ce que vous remarquez.

#MinuteBleue #BleuMassawippi #LacMassawippi #Estrie`,
      `Today, we simply invite you to pause with us.

One minute to watch the light on the water, listen to the shoreline and appreciate a place that holds so many memories. Caring for Massawippi also begins with the joy of knowing and loving it.

Take a breath, enjoy the moment… and tell us what you notice.

#BlueMinute #BleuMassawippi #LakeMassawippi #EasternTownships`
    ),
    visual: "Reel réel de 10 à 15 secondes : arrivée d’une personne au bord du lac, reflet de lumière, main sur une rambarde, respiration et plan final large. Son naturel; afficher « Une minute bleue » seulement à la fin."
  },
  "alt-20260717": {
    title: "Le mot bleu de la semaine",
    cta: "Partager un mot",
    copy: bilingual(
      `La semaine se termine près du Massawippi. Si vous deviez la résumer en un seul mot, lequel choisiriez-vous?

Calme, découverte, famille, vent, baignade… tous les mots sont les bienvenus. Laissez le vôtre en commentaire : nous avons hâte de vous lire.

#MotBleu #BleuMassawippi #LacMassawippi #Communauté`,
      `The week is winding down near Massawippi. If you could sum it up in one word, what would it be?

Calm, discovery, family, wind, swimming… every word is welcome. Share yours in the comments—we look forward to reading it.

#BlueWord #BleuMassawippi #LakeMassawippi #Community`
    ),
    visual: "Photo réelle de la surface du lac avec un petit carton manuscrit « Mon mot bleu : ____ » tenu par une main. Quelques mots de communauté peuvent flotter très légèrement, sans simuler de vrais témoignages attribués."
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
    title: "Sous les feuilles, un petit monde vivant",
    cta: "Regarder de plus près",
    copy: bilingual(
      `Au ras du sol, les feuilles, les racines et les pierres composent un petit monde. Elles gardent l’humidité et offrent des abris à une foule de formes de vie discrètes.

Lors de votre prochaine promenade près du lac, prenez un instant pour regarder ces détails sans les déplacer. Qu’est-ce qui attire votre œil en premier?

#BleuMassawippi #LacMassawippi #RiveVivante #NatureDuLac`,
      `Close to the ground, leaves, roots and stones create a small world of their own. They retain moisture and offer shelter to many quiet forms of life.

On your next walk near the lake, take a moment to notice these details while leaving them in place. What catches your eye first?

#BleuMassawippi #LakeMassawippi #LivingShoreline #LakeNature`
    ),
    visual: "Planche d’exploration façon carnet naturaliste : tapis de feuilles, racines, pierre humide et petites traces de vie; loupe graphique et silhouette de bottes au bord du cadre pour traduire la curiosité humaine sans prélèvement."
  },
  s1d2: {
    title: "Derrière chaque donnée, des gestes patients",
    cta: "Découvrir les coulisses du suivi",
    copy: bilingual(
      `Avant qu’un résultat apparaisse dans un rapport, il y a des personnes sur le terrain : elles observent, prélèvent, notent, reviennent et comparent.

Ces gestes patients, répétés au fil du temps, nous aident à mieux comprendre le Massawippi et à partager une information plus juste avec la communauté. Merci à toutes les personnes qui contribuent à ce travail attentif.

#BleuMassawippi #LacMassawippi #ScienceDuLac #Coulisses`,
      `Before a result appears in a report, people are at work in the field: observing, sampling, recording, returning and comparing.

These patient actions, repeated over time, help us understand Massawippi and share clearer information with the community. Thank you to everyone who contributes to this careful work.

#BleuMassawippi #LakeMassawippi #LakeScience #BehindTheScenes`
    ),
    visual: "Reel de 12 à 15 secondes centré sur les personnes : mains qui préparent un flacon, prélèvent, inscrivent une note et comparent le carnet, puis signe satisfait. Sous-titre : « Derrière chaque donnée, des gestes patients »."
  },
  "alt-20260719": {
    title: "Le Massawippi vu en 1859",
    cta: "Explorer l’image avec nous",
    copy: bilingual(
      `Bien avant les photos prises sur téléphone, le Massawippi voyageait déjà par l’image.

Cette estampe publiée en 1859 par Samuel Bradshaw, d’après une œuvre de William Henry Bartlett, nous offre le regard d’un artiste sur le paysage de son époque. Prenons-la comme une invitation à observer, à comparer et à nous souvenir.

Quel détail vous attire en premier?

#BleuMassawippi #LacMassawippi #Patrimoine #MémoireDuLac`,
      `Long before phone photography, images of Massawippi were already travelling.

This 1859 print by Samuel Bradshaw, after a work by William Henry Bartlett, offers an artist’s view of the landscape in his time. Let it invite us to observe, compare and remember.

Which detail catches your eye first?

#BleuMassawippi #LakeMassawippi #Heritage #LakeMemories`
    ),
    visual: "Estampe de 1859 complète et non colorisée, présentée comme une page que deux mains consultent sur une table claire; seconde carte avec un détail agrandi et le crédit lisible. Donner l’impression d’ouvrir ensemble une fenêtre sur le passé."
  },
  s2d1: {
    title: "Une touche de couleur au bord de l’eau",
    cta: "Découvrir l’iris versicolore",
    copy: bilingual(
      `Au cœur des milieux humides, l’iris versicolore ajoute une éclaboussure de violet et de bleu au paysage.

Sa présence nous invite à regarder au-delà de la surface du lac : les milieux qui l’entourent ralentissent l’eau et accueillent une grande diversité de vie. La prochaine fois que vous en apercevez un, prenez le temps d’admirer tout ce qui l’entoure.

#ZoomNature #BleuMassawippi #IrisVersicolore #LacMassawippi`,
      `In the heart of a wetland, blue flag iris adds a splash of violet and blue to the landscape.

It invites us to look beyond the lake’s surface: surrounding wetlands slow water and welcome a wide variety of life. The next time you spot one, take a moment to notice everything around it.

#NatureZoom #BleuMassawippi #BlueFlagIris #LakeMassawippi`
    ),
    visual: "Affiche éducative vintage de l’iris versicolore : plante entière, fleur agrandie et petite vue de milieu humide, accompagnées d’une silhouette qui croque la plante dans un carnet. Mention sobre « Iris versicolore »."
  },
  s2d1b: {
    title: "Le petit quiz des milieux humides",
    cta: "Choisir une réponse",
    copy: bilingual(
      `Question du jour : comment un milieu humide peut-il aider le lac?

A — En ralentissant une partie de l’eau.
B — En offrant un habitat à plusieurs espèces.
C — De ces deux façons — et de bien d’autres encore.

La réponse est C. Les milieux humides rendent plusieurs services à la fois. Lequel aimeriez-vous découvrir dans une prochaine capsule?

#QuizDuLac #BleuMassawippi #MilieuxHumides #LacMassawippi`,
      `Today’s question: how can a wetland help the lake?

A — By slowing some of the water.
B — By providing habitat for many species.
C — In both of these ways—and many more.

The answer is C. Wetlands provide several services at once. Which one would you like us to explore in a future post?

#LakeQuiz #BleuMassawippi #Wetlands #LakeMassawippi`
    ),
    visual: "Illustration ludique en coupe d’un milieu humide : eau ralentie, plantes, oiseaux et insectes; deux personnes sur une passerelle observent. Trois choix A/B/C clairs, puis réponse sur une seconde carte."
  },
  s2d7: {
    title: "Une image, une époque, un attachement partagé",
    cta: "Observer avec nous",
    copy: bilingual(
      `Cette image nous ramène à une autre époque du Massawippi. Le paysage et les habitudes ont changé, mais l’attachement au lac continue de relier les générations.

Prenez le temps d’en explorer les détails. Qu’est-ce qui vous semble familier? Qu’est-ce qui vous surprend? Vos souvenirs et vos connaissances peuvent nous aider à enrichir cette histoire commune.

#Patrimoine #BleuMassawippi #LacMassawippi #MémoireDuLac`,
      `This image takes us back to another time at Massawippi. The landscape and daily habits have changed, but affection for the lake continues to connect generations.

Take a moment to explore the details. What feels familiar? What surprises you? Your memories and knowledge can help enrich this shared story.

#Heritage #BleuMassawippi #LakeMassawippi #LakeMemories`
    ),
    visual: "Visuel « regarder ensemble » : photographie historique complète posée devant une vue actuelle sans prétendre qu’il s’agit du même cadrage, avec une main qui pointe un détail; crédit, date et question « Que remarquez-vous? » lisibles."
  },
  "alt-20260721": {
    title: "Le plongeon huard, un voisin à admirer de loin",
    cta: "Partager une observation respectueuse",
    copy: bilingual(
      `Le chant du plongeon huard fait partie des grands souvenirs d’été sur de nombreux lacs. Quand l’un d’eux se présente, ralentir et lui laisser de l’espace permet de profiter du moment sans changer son comportement.

Avez-vous déjà eu la chance d’en observer un? Racontez-nous ce que vous avez entendu ou vu — à bonne distance.

#BleuMassawippi #LacMassawippi #PlongeonHuard #ObservationRespectueuse`,
      `The call of the common loon is part of treasured summer memories on many lakes. When one appears, slowing down and giving it space lets us enjoy the moment without changing its behaviour.

Have you ever had the chance to observe one? Tell us what you heard or saw—from a respectful distance.

#BleuMassawippi #LakeMassawippi #CommonLoon #RespectfulWildlifeViewing`
    ),
    visual: "Affiche naturaliste vintage : plongeon huard crédible sur une eau calme, observateur aux jumelles très loin en arrière-plan et encart sur le chant et la silhouette. Inviter à l’émerveillement sans symbole d’interdiction."
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
    title: "Propre à l’œil… prêt à repartir?",
    cta: "Faire défiler pour la réponse",
    copy: bilingual(
      `Vrai ou faux? Une embarcation sans débris visible est automatiquement prête à changer de plan d’eau.

La réponse est non : une inspection attentive est un excellent début, puis les autres étapes recommandées complètent le travail. Retirer, vider, nettoyer et laisser sécher selon les consignes aide à prendre soin de tous les plans d’eau visités.

Merci d’ajouter ces gestes à vos préparatifs.

#QuizDuLac #BleuMassawippi #NautismeResponsable #Prévention`,
      `True or false? A boat with no visible debris is automatically ready to move to another body of water.

The answer is no: a careful inspection is a great start, and the other recommended steps complete the process. Removing, draining, cleaning and allowing equipment to dry as directed helps care for every body of water we visit.

Thank you for making these steps part of your preparation.

#LakeQuiz #BleuMassawippi #ResponsibleBoating #Prevention`
    ),
    visual: "Deux cartes : coque qui paraît propre, cadrée comme une énigme avec loupe graphique; puis personne qui complète les étapes recommandées avec quatre verbes positifs. Éviter rouge, croix ou esthétique de faute."
  },
  s2d2: {
    title: "Une rive vivante, une alliée du lac",
    cta: "Découvrir ce qu’elle fait",
    copy: bilingual(
      `Une rive végétalisée est belle à regarder — et elle travaille aussi pour le lac. Ses racines aident à garder le sol en place, ses plantes ralentissent une partie du ruissellement et son ombre offre des conditions accueillantes au vivant.

Chaque espace de rive que l’on apprend à mieux connaître peut inspirer un prochain petit geste. Quelle plante riveraine aimez-vous voir près du Massawippi?

#BandesRiveraines #BleuMassawippi #LacMassawippi #BassinVersant`,
      `A vegetated shoreline is beautiful to see—and it also works for the lake. Its roots help hold soil in place, its plants slow some runoff and its shade offers welcoming conditions for life.

Every shoreline we learn more about can inspire one small next step. Which shoreline plant do you enjoy seeing near Massawippi?

#ShorelineProtection #BleuMassawippi #LakeMassawippi #Watershed`
    ),
    visual: "Diptyque réel : large rive végétalisée et gros plan de racines et d’ombre; une personne avec carnet observe depuis un accès approprié. Ajouter de petites étiquettes « racines · eau ralentie · refuge »."
  },
  "alt-20260723": {
    title: "Racines, ombre, refuge",
    cta: "Garder ces trois mots",
    copy: bilingual(
      `Racines, ombre, refuge : trois mots simples pour découvrir tout ce qu’une rive végétalisée peut offrir.

Sous nos yeux, les racines retiennent le sol, les feuillages tempèrent la lumière et la végétation crée des abris. Ce n’est qu’un début, mais c’est déjà une belle façon de regarder la rive autrement.

Quel détail aimeriez-vous voir expliqué ensuite?

#BleuMassawippi #LacMassawippi #RiveVivante #NatureDuLac`,
      `Roots, shade, shelter: three simple words that reveal what a vegetated shoreline can offer.

Right before us, roots hold soil, leaves soften the light and vegetation creates places of refuge. It is only a beginning, but it is a beautiful way to see the shoreline differently.

Which detail would you like us to explain next?

#BleuMassawippi #LakeMassawippi #LivingShoreline #LakeNature`
    ),
    visual: "Triptyque illustré vintage « Racines / Ombre / Refuge » relié par une même rive, avec une petite main dessinée prenant des notes afin d’humaniser l’apprentissage."
  },
  s2d4: {
    title: "Après la pluie, aidons l’eau à prendre son temps",
    cta: "Découvrir le jardin de pluie",
    copy: bilingual(
      `Après une averse, l’eau se met en route vers les fossés, les ruisseaux et parfois jusqu’au lac. Sur son chemin, elle peut aussi entraîner de la terre et d’autres matières.

Un jardin de pluie lui offre un endroit où ralentir et pénétrer doucement dans le sol. Même un petit aménagement bien situé peut faire partie de la solution. Aimeriez-vous que nous montrions comment cela fonctionne?

#JardinsDePluie #BleuMassawippi #BassinVersant #LacMassawippi`,
      `After a rainfall, water begins travelling toward ditches, streams and sometimes the lake. Along the way, it can also carry soil and other material.

A rain garden gives that water a place to slow down and gently soak into the ground. Even a small, well-placed feature can be part of the solution. Would you like us to show how one works?

#RainGardens #BleuMassawippi #Watershed #LakeMassawippi`
    ),
    visual: "Illustration ou photo explicative chaleureuse d’un jardin de pluie après l’averse : une personne observe l’eau entrer dans la plantation; flèches douces « ralentir » et « entrer dans le sol ». Si le lieu n’est pas local, indiquer « Exemple illustré »."
  },
  "alt-20260724": {
    title: "Après l’averse, qu’avez-vous remarqué?",
    cta: "Partager une observation",
    copy: bilingual(
      `Une forte pluie transforme parfois le paysage en quelques minutes : l’eau circule plus vite, une flaque apparaît, un peu de sol se déplace ou des débris s’accumulent.

Depuis un endroit public et sécuritaire, qu’avez-vous remarqué près de chez vous? Partagez simplement votre observation, avec le lieu général et le moment si vous le souhaitez. Chaque regard peut nous aider à mieux comprendre le territoire.

#BleuMassawippi #LacMassawippi #AprèsLaPluie #Communauté`,
      `Heavy rain can transform the landscape in minutes: water moves faster, a pool forms, some soil shifts or debris gathers.

From a safe public place, what have you noticed near you? Simply share your observation, along with the general area and time if you wish. Every perspective can help us better understand the territory.

#BleuMassawippi #LakeMassawippi #AfterTheRain #Community`
    ),
    visual: "Photo réelle d’une personne en bottes photographiant calmement un écoulement depuis un chemin public; trois bulles d’observation — « où va l’eau? », « que transporte-t-elle? », « qu’est-ce qui change? » — sans ton d’alerte."
  },
  s2d5: {
    title: "Plus d’espace, plus de plaisir pour tout le monde",
    cta: "Partager l’eau avec attention",
    copy: bilingual(
      `Sur le Massawippi, le plaisir prend mille formes : naviguer, pagayer, pêcher, nager ou simplement admirer la rive.

Adapter sa vitesse, garder une distance confortable et rester attentif à son sillage aide chaque personne à profiter du lac à sa façon. Merci à toutes celles et ceux qui font de la courtoisie une partie naturelle de leur sortie.

#NautismeResponsable #BleuMassawippi #LacMassawippi #PlaisirPartagé`,
      `On Massawippi, enjoyment takes many forms: boating, paddling, fishing, swimming or simply taking in the shoreline.

Adjusting speed, leaving comfortable space and staying aware of your wake helps everyone enjoy the lake in their own way. Thank you to all who make courtesy a natural part of every outing.

#ResponsibleBoating #BleuMassawippi #LakeMassawippi #SharedEnjoyment`
    ),
    visual: "Grand plan réel et paisible montrant plusieurs usages avec beaucoup d’espace : embarcation lente, kayak ou planche à pagaie, rive et personne à la baignade si sécuritaire. Titre « Plus d’espace, plus de plaisir »."
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

Nous ne connaissons pas encore le trajet exact ni les personnes à bord — et c’est aussi ce qui rend la mémoire collective si précieuse. Votre famille conserve-t-elle une histoire ou une photo du lac de ces années-là?

#BleuMassawippi #LacMassawippi #Patrimoine #MémoireDuLac`,
      `Around 1904, a steamship crosses Lake Massawippi while a sailboat appears near the shore. This photograph opens a fascinating window onto travel and summer life in another era.

We do not yet know the exact route or the people aboard—and that is part of what makes shared memory so valuable. Does your family preserve a story or photograph of the lake from those years?

#BleuMassawippi #LakeMassawippi #Heritage #LakeMemories`
    ),
    visual: "Photographie de 1904 complète et non colorisée dans un album que des mains feuillettent; seconde carte avec détail du vapeur et du voilier, date approximative et crédit; troisième carte ouverte à la mémoire familiale : « Quelle histoire nous raconteriez-vous? »."
  }
});

export default EDITORIAL_OVERRIDES_JUL14_26;
