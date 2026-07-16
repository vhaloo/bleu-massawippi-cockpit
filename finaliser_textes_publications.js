import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyPlanOverridesToPosts, planDateIsoFromLabel } from "./cockpit/plan-overrides.js";

const directory = path.dirname(fileURLToPath(import.meta.url));
const separator = "=========================================";
const quebecBoatCleaning = "https://www.quebec.ca/agriculture-environnement-et-ressources-naturelles/faune/gestion-faune-habitats-fauniques/gestion-especes-exotiques-envahissantes-animales/lutte/nettoyage-embarcations-nautiques";
const reportPage = "https://bleumassawippi.com/rapports-et-memoires";
const homeFr = "https://bleumassawippi.com/accueil-1";
const homeEn = "https://bleumassawippi.com/home-1";
const volunteerPage = "https://bleumassawippi.com/benevolat";
const boatingSafety = "https://tc.canada.ca/en/marine-transportation/preparing-operate-your-vessel/maintaining-safe-pleasure-craft";
const laccessible = "https://bleumassawippi.com/laccessible/en";

function bilingual(frOriginal, enAdaptation) {
  return `FR — ${frOriginal}\n\n${separator}\n\nEN — ${enAdaptation}`;
}

const final = [
  {
    id: "s1d1",
    visual: "Photo authentique d’un prélèvement, d’un carnet de terrain ou d’un disque de Secchi; titre sur image : Lire le lac dans le temps.",
    alt: "FR — Matériel de suivi de la qualité de l’eau au bord du lac. / EN — Water-quality monitoring equipment beside the lake.",
    source: reportPage,
    task: "Exporter un carrousel 4:5 avec une seule idée par carte et le lien vers les rapports dans la légende.",
    copy: bilingual(
      "Un lac ne se résume pas à une impression d’un jour. Pour le comprendre, il faut suivre ses signes dans le temps : la transparence, les nutriments, les conditions observées sur le terrain et bien d’autres repères. C’est cette lecture patiente qui aide à choisir des actions utiles pour le Massawippi.\n\nConsultez les rapports et mémoires : " + reportPage + "\n\n#BleuMassawippi #LacMassawippi #QualitéDeLEau #Estrie",
      "A lake cannot be understood through a single day’s impression. To understand it, we follow signs over time: transparency, nutrients, field conditions and many other indicators. This patient reading helps guide useful action for Massawippi.\n\nRead the reports and briefs: " + reportPage + "\n\n#BleuMassawippi #LakeMassawippi #WaterQuality #EasternTownships"
    )
  },
  {
    id: "s1d2",
    visual: "Reel vertical réel : mains qui étiquettent un échantillon, outil de mesure, carnet puis surface du lac; sous-titres intégrés FR/EN.",
    alt: "FR — Des mains étiquettent un échantillon d’eau et notent une observation de terrain. / EN — Hands label a water sample and record a field observation.",
    source: "Documentation interne — captation de terrain autorisée",
    task: "Monter 12 à 15 secondes, sans visage identifiable, avec son naturel ou musique sous licence.",
    copy: bilingual(
      "Avant un graphique, il y a un geste. Observer. Prélever. Noter. Revenir. Comparer.\n\nUne donnée utile ne tombe pas du ciel : elle se construit avec une méthode, des repères et du temps. C’est ainsi que le suivi du lac devient une base pour mieux le protéger.\n\n#BleuMassawippi #LacMassawippi #ScienceDuLac #Estrie",
      "Before a chart, there is a gesture. Observe. Sample. Record. Return. Compare.\n\nUseful data does not appear out of nowhere: it is built through method, reference points and time. That is how lake monitoring becomes a foundation for better protection.\n\n#BleuMassawippi #LakeMassawippi #LakeScience #EasternTownships"
    )
  },
  {
    id: "s1d3",
    visual: "Portrait autorisé d’une personne bénévole de dos ou mains en action; aucun nom affiché; titre sur image : Un geste pour le lac.",
    alt: "FR — Des mains participent à une activité bénévole près du lac. / EN — Hands take part in a volunteer activity near the lake.",
    source: volunteerPage,
    task: "Utiliser une photo avec consentement de diffusion documenté; publier sans nom ni citation personnelle si l’identification n’est pas souhaitée.",
    copy: bilingual(
      "Protéger le Massawippi repose aussi sur des personnes qui donnent du temps, selon leurs disponibilités et leurs intérêts. La banque de bénévoles permet de recevoir des occasions ciblées, sans obligation de participer à chacune d’elles.\n\nDécouvrez les possibilités d’implication : " + volunteerPage + "\n\n#BleuMassawippi #Bénévolat #LacMassawippi #Estrie",
      "Protecting Massawippi also relies on people who give their time according to their availability and interests. The volunteer bank shares targeted opportunities, with no obligation to take part in every one of them.\n\nDiscover ways to get involved: " + volunteerPage + "\n\n#BleuMassawippi #Volunteer #LakeMassawippi #EasternTownships"
    )
  },
  {
    id: "s1d4",
    title: "Le moment où le lac vous appelle",
    cta: "Racontez-nous ce moment",
    visual: "Photo paysage réelle du lac, sans personne identifiable; question unique en surimpression : Le Massawippi, pour vous, c’est…",
    alt: "FR — Vue calme du lac Massawippi et de ses rives. / EN — A calm view of Lake Massawippi and its shoreline.",
    source: "Banque photo de l’association — droits documentés",
    task: "Publier aussi une story avec une boîte de réponse; relever les mots récurrents sans reproduire les réponses comme citations sans autorisation.",
    copy: bilingual(
      "Parfois, il suffit d’une couleur, d’un parfum, d’un son ou d’un souvenir pour avoir envie de retrouver le lac.\n\nQuel moment vous donne le plus envie de retrouver le Massawippi : le calme du matin, une baignade, une sortie en famille ou la lumière du soir? Racontez-le-nous en un mot ou en quelques mots. Nous avons hâte de vous lire.\n\n#BleuMassawippi #LacMassawippi #NotreLac #Estrie",
      "Sometimes a colour, a familiar scent, a sound or a memory is all it takes to make us long for the lake.\n\nWhat makes you want to return to Massawippi most: a quiet morning, a swim, time with family or the evening light? Tell us in a word or two. We would love to hear from you.\n\n#BleuMassawippi #LakeMassawippi #OurLake #EasternTownships"
    )
  },
  {
    id: "s1d5",
    visual: "Carrousel de deux cartes : 1. Vrai ou faux? 2. La réponse avec illustration d’un disque de Secchi.",
    alt: "FR — Un disque de Secchi est utilisé pour observer la transparence de l’eau. / EN — A Secchi disk is used to observe water transparency.",
    source: reportPage,
    task: "Conserver la question sur la première carte et la réponse sur la seconde; ajouter un texte alternatif descriptif aux deux images.",
    copy: bilingual(
      "Vrai ou faux? Une mesure de transparence suffit à dire si un lac est en santé.\n\nFaux. La transparence est un repère utile, mais elle ne raconte jamais toute l’histoire à elle seule. Pour comprendre un lac, on la lit avec d’autres indicateurs et on la compare dans le temps.\n\n#QuizDuLac #BleuMassawippi #LacMassawippi #QualitéDeLEau",
      "True or false? One transparency measurement is enough to tell whether a lake is healthy.\n\nFalse. Transparency is a useful indicator, but it never tells the whole story on its own. To understand a lake, it must be read alongside other indicators and compared over time.\n\n#LakeQuiz #BleuMassawippi #LakeMassawippi #WaterQuality"
    )
  },
  {
    id: "s1d6",
    title: "Juste un instant",
    cta: "Prendre un instant",
    visual: "Reel de 10 à 15 secondes : eau, rive et lumière réelle; aucun texte durant les trois premières secondes, puis Un instant bleu.",
    alt: "FR — La lumière se reflète sur la surface calme du lac. / EN — Light reflects on the lake’s calm surface.",
    source: "Banque vidéo de l’association — droits documentés",
    task: "Choisir une captation réelle du Massawippi, sans filtre qui modifie la couleur de l’eau ni image générée.",
    copy: bilingual(
      "Prendre un instant pour regarder ce que nous avons la chance de protéger : le lac, ses rives, les habitats qu’il abrite et les souvenirs qui nous y rattachent.\n\n#InstantBleu #BleuMassawippi #LacMassawippi #Estrie",
      "Take a moment to appreciate what we are fortunate to protect: the lake, its shorelines, the habitats it supports and the memories that connect us to this place.\n\n#BlueMoment #BleuMassawippi #LakeMassawippi #EasternTownships"
    )
  },
  {
    id: "s1d7",
    visual: "Photo d’archive dont le crédit et les droits sont documentés, ou vue actuelle du même secteur; mentionner le crédit dans le visuel.",
    alt: "FR — Une vue du lac Massawippi qui invite à partager un souvenir. / EN — A view of Lake Massawippi that invites people to share a memory.",
    source: "Archives Bleu Massawippi — droits documentés",
    task: "Afficher le crédit et le contexte disponibles; ne reprendre aucun commentaire en publication future sans accord explicite.",
    copy: bilingual(
      "Un lac vit aussi dans les souvenirs.\n\nQuel moment au Massawippi aimeriez-vous transmettre à quelqu’un qui ne le connaît pas encore? Une première baignade, une sortie en famille, un matin brumeux, un sentier, un silence?\n\nPartagez votre souvenir en commentaire.\n\n#BleuMassawippi #MémoireDuLac #LacMassawippi #Estrie",
      "A lake also lives in memory.\n\nWhat Massawippi moment would you want to pass on to someone who has not discovered it yet? A first swim, a family outing, a misty morning, a trail, a quiet moment?\n\nShare your memory in the comments.\n\n#BleuMassawippi #LakeMemories #LakeMassawippi #EasternTownships"
    )
  },
  {
    id: "s2d1",
    visual: "Photo réelle d’iris versicolore dans un milieu humide du bassin versant, sans géolocalisation précise; titre : Un éclat du bassin versant.",
    alt: "FR — Un iris versicolore fleurit dans un milieu humide. / EN — A blue flag iris blooms in a wetland.",
    source: homeFr,
    task: "Confirmer l’identification de l’espèce et éviter de révéler un emplacement sensible.",
    copy: bilingual(
      "L’iris versicolore apporte une touche de couleur aux milieux humides du bassin versant.\n\nLe lac ne s’arrête pas à sa rive. Les milieux qui l’entourent ralentissent l’eau, abritent le vivant et participent à l’équilibre du territoire.\n\n#ZoomNature #BleuMassawippi #IrisVersicolore #LacMassawippi",
      "Blue flag iris brings colour to wetlands across the watershed.\n\nThe lake does not end at its shoreline. The environments around it slow water, support life and contribute to the balance of the territory.\n\n#NatureZoom #BleuMassawippi #BlueFlagIris #LakeMassawippi"
    )
  },
  {
    id: "s2d2",
    visual: "Photo d’une rive végétalisée réelle : herbes, arbustes et sol stabilisé; titre : Une rive vivante travaille pour le lac.",
    alt: "FR — Une rive végétalisée borde l’eau et protège le sol. / EN — A vegetated shoreline borders the water and protects the soil.",
    source: homeFr,
    task: "Choisir une rive continue et naturelle; éviter toute image de terrain privé sans autorisation.",
    copy: bilingual(
      "Une rive végétalisée fait plus qu’être belle. Ses racines aident à retenir le sol, sa végétation ralentit le ruissellement et son ombre crée des conditions plus accueillantes pour le vivant.\n\nChaque rive protégée est un geste concret pour le lac.\n\n#BandesRiveraines #BleuMassawippi #LacMassawippi #BassinVersant",
      "A vegetated shoreline does more than look beautiful. Its roots help hold soil in place, its vegetation slows runoff and its shade creates more welcoming conditions for life.\n\nEvery protected shoreline is a practical action for the lake.\n\n#ShorelineProtection #BleuMassawippi #LakeMassawippi #Watershed"
    )
  },
  {
    id: "s2d3",
    visual: "Carrousel photo réelle : remorque, coque et bouchon de vidange; trois mots sur image : Inspecter. Nettoyer. Vider.",
    alt: "FR — Une embarcation et sa remorque sont inspectées avant une mise à l’eau. / EN — A boat and trailer are inspected before launch.",
    source: quebecBoatCleaning,
    task: "Ne pas présenter le visuel comme un règlement local; rediriger vers la page gouvernementale pour les consignes à jour.",
    copy: bilingual(
      "Le bon départ commence avant la mise à l’eau.\n\nInspectez l’embarcation et la remorque. Retirez les débris visibles. Videz l’eau qui peut être retenue à bord. Ces quelques gestes réduisent le risque de transporter des organismes ou des fragments d’un plan d’eau à l’autre.\n\nConsignes détaillées : " + quebecBoatCleaning + "\n\n#Prévention #BleuMassawippi #NautismeResponsable #LacMassawippi",
      "The right start happens before launch.\n\nInspect the boat and trailer. Remove visible debris. Drain any water that may be held on board. These simple steps help reduce the risk of carrying organisms or fragments from one body of water to another.\n\nDetailed guidance: " + quebecBoatCleaning + "\n\n#Prevention #BleuMassawippi #ResponsibleBoating #LakeMassawippi"
    )
  },
  {
    id: "s2d4",
    visual: "Photo réelle d’un jardin de pluie ou d’une zone végétalisée qui reçoit l’eau de ruissellement; titre : Garder l’eau là où elle tombe.",
    alt: "FR — Un jardin de pluie végétalisé recueille l’eau de ruissellement. / EN — A planted rain garden receives runoff water.",
    source: homeFr,
    task: "Privilégier une photo du projet ou un visuel explicatif sobre, sans promettre un résultat chiffré non documenté.",
    copy: bilingual(
      "Après la pluie, l’eau choisit toujours un chemin. Sur une surface imperméable, elle peut entraîner rapidement des sédiments et des polluants vers les fossés, les tributaires et le lac.\n\nUn jardin de pluie aide à ralentir, retenir et infiltrer une partie de cette eau à la source.\n\n#JardinsDePluie #BleuMassawippi #BassinVersant #LacMassawippi",
      "After the rain, water always finds a path. On impermeable surfaces, it can quickly carry sediment and pollutants toward ditches, tributaries and the lake.\n\nA rain garden helps slow, hold and infiltrate some of that water at its source.\n\n#RainGardens #BleuMassawippi #Watershed #LakeMassawippi"
    )
  },
  {
    id: "s2d5",
    visual: "Photo large d’un bateau en déplacement à distance des rives et des autres usagers; titre : Le respect se voit aussi dans le sillage.",
    alt: "FR — Une embarcation se déplace sur le lac en laissant un sillage modéré. / EN — A boat moves across the lake with a moderate wake.",
    source: laccessible,
    task: "Utiliser une image qui montre une navigation calme et dégagée; éviter les chiffres ou règles locales non validés pour le jour de publication.",
    copy: bilingual(
      "Le plaisir sur l’eau se partage.\n\nAdapter sa vitesse, garder de l’espace autour des rives et des autres usagers, puis rester attentif à son sillage : ce sont des choix simples qui rendent chaque sortie plus agréable pour tout le monde.\n\n#NautismeResponsable #BleuMassawippi #LacMassawippi #CivismeNautique",
      "Enjoyment on the water is shared.\n\nAdjusting speed, leaving space around shorelines and other users, and staying aware of your wake are simple choices that make every outing more enjoyable for everyone.\n\n#ResponsibleBoating #BleuMassawippi #LakeMassawippi #BoatingCourtesy"
    )
  },
  {
    id: "s2d6",
    visual: "Photo de départ au quai : gilets de sauvetage accessibles, météo consultée et équipement rangé; titre : La sécurité fait partie du plaisir.",
    alt: "FR — Des gilets de sauvetage sont prêts avant une sortie sur l’eau. / EN — Lifejackets are ready before heading out on the water.",
    source: boatingSafety,
    task: "Utiliser un visuel réel qui montre l’équipement sans faire croire à une inspection officielle.",
    copy: bilingual(
      "La sécurité fait partie du plaisir. Avant de partir, prenez un moment pour vérifier la météo, l’état de l’embarcation et l’équipement de sécurité. Assurez-vous aussi que chaque personne à bord a un gilet de sauvetage ou un VFI de la bonne taille.\n\nUn bon départ laisse plus de place aux beaux souvenirs.\n\n#SécuritéNautique #BleuMassawippi #LacMassawippi #Prévention",
      "Safety is part of the fun. Before leaving, take a moment to check the weather, the condition of the vessel and the safety equipment. Also make sure that every person on board has a properly sized lifejacket or PFD.\n\nA good start leaves more room for great memories.\n\n#BoatingSafety #BleuMassawippi #LakeMassawippi #Prevention"
    )
  },
  {
    id: "s2d7",
    visual: "Photo d’archive avec crédit visible, accompagnée d’une photo actuelle du même angle si les droits le permettent; titre : Une image, une époque, le même lac.",
    alt: "FR — Une image d’archive du lac Massawippi invite à comparer les époques. / EN — An archival image of Lake Massawippi invites a comparison across time.",
    source: "Archives Bleu Massawippi — droits documentés",
    task: "Conserver le crédit de l’image dans la publication et dans les métadonnées; ne pas dater l’image si la date n’est pas confirmée.",
    copy: bilingual(
      "Cette image nous ramène à une autre époque du Massawippi. Le paysage change, les usages évoluent, mais l’attachement au lac traverse les générations.\n\nQue remarquez-vous en premier?\n\n#Patrimoine #BleuMassawippi #LacMassawippi #MémoireDuLac",
      "This image takes us back to another time at Massawippi. The landscape changes and our uses evolve, yet attachment to the lake crosses generations.\n\nWhat do you notice first?\n\n#Heritage #BleuMassawippi #LakeMassawippi #LakeMemories"
    )
  },
  {
    id: "s3d1",
    visual: "Carrousel de suivi réel : prélèvement, disque de Secchi, rive et carnet; titre : Ce que nous suivons cet été.",
    alt: "FR — Des outils et observations utilisés pour suivre l’état du lac. / EN — Tools and observations used to monitor the lake’s condition.",
    source: reportPage,
    task: "Montrer des gestes réels de suivi sans publier de donnée récente avant la validation scientifique prévue.",
    copy: bilingual(
      "Cet été, le suivi du lac se poursuit sur le terrain. On observe, on échantillonne, on mesure et on consigne les conditions qui aideront à comprendre l’évolution du Massawippi.\n\nLe suivi n’est pas une alarme; c’est une façon rigoureuse de rester attentifs et de mieux orienter les décisions.\n\n#BilanDeSanté #BleuMassawippi #LacMassawippi #ScienceDuLac",
      "This summer, lake monitoring continues in the field. We observe, sample, measure and record conditions that help us understand Massawippi’s evolution.\n\nMonitoring is not an alarm; it is a rigorous way to stay attentive and better guide decisions.\n\n#LakeHealth #BleuMassawippi #LakeMassawippi #LakeScience"
    )
  },
  {
    id: "s3d2",
    visual: "Infographie sobre de trois indicateurs : phosphore total, chlorophylle a et transparence; aucune valeur non approuvée dans le visuel.",
    alt: "FR — Une infographie explique que plusieurs indicateurs sont lus ensemble pour suivre le lac. / EN — An infographic explains that several indicators are read together to monitor the lake.",
    source: reportPage,
    task: "Lier la page officielle des rapports; conserver les données chiffrées détaillées dans le rapport plutôt que dans la légende.",
    copy: bilingual(
      "Un chiffre seul peut attirer l’attention. Trois indicateurs lus ensemble permettent de mieux comprendre.\n\nLe phosphore total, la chlorophylle a et la transparence éclairent chacun une partie différente de l’état du lac. C’est leur évolution, leur contexte et leur lecture conjointe qui comptent.\n\nLire le rapport annuel 2025 : " + reportPage + "\n\n#QualitéDeLEau #BleuMassawippi #LacMassawippi #ScienceDuLac",
      "One number can draw attention. Three indicators read together provide a better understanding.\n\nTotal phosphorus, chlorophyll a and transparency each illuminate a different part of the lake’s condition. What matters is their evolution, their context and their combined reading.\n\nRead the 2025 annual report: " + reportPage + "\n\n#WaterQuality #BleuMassawippi #LakeMassawippi #LakeScience"
    )
  },
  {
    id: "s3d3",
    visual: "Visuel texte sur fond de photo autorisée du lac : Un regard. Une histoire. Un lac.",
    alt: "FR — Le lac Massawippi est photographié au coucher du soleil avec un appel à partager une image. / EN — Lake Massawippi is photographed at sunset with an invitation to share an image.",
    source: "info@bleumassawippi.com",
    task: "Traiter chaque envoi comme confidentiel; demander une autorisation explicite distincte avant toute republication ou adaptation.",
    copy: bilingual(
      "Le Massawippi se raconte aussi par celles et ceux qui le regardent chaque jour.\n\nPartagez une photo prise par vous et une phrase sur ce qu’elle représente à info@bleumassawippi.com, objet : Photo Massawippi. Indiquez simplement si l’image peut être publiée. Nous confirmerons toujours avant toute diffusion.\n\n#VosRegards #BleuMassawippi #LacMassawippi #Communauté",
      "Massawippi is also told through the people who see it every day.\n\nShare a photo you took and one sentence about what it means to you at info@bleumassawippi.com, subject: Massawippi Photo. Please indicate whether the image may be published. We will always confirm before sharing it.\n\n#YourView #BleuMassawippi #LakeMassawippi #Community"
    )
  },
  {
    id: "s3d4",
    visual: "Photo réelle d’une rive après la pluie, sans présenter l’image comme un avis sanitaire; titre : Observer sans paniquer.",
    alt: "FR — Une rive du lac après une averse. / EN — A lakeshore after rainfall.",
    source: homeFr,
    task: "Ne pas publier d’avis de baignade ou de cause présumée sans validation scientifique et administrative; orienter les questions vers le contact officiel.",
    copy: bilingual(
      "Après une forte pluie, le bon réflexe est d’observer sans tirer de conclusion trop vite. L’eau, les rives et les tributaires réagissent à des conditions qui demandent du contexte et, parfois, des analyses.\n\nSi une situation vous inquiète, notez le lieu et le moment, puis communiquez avec l’association : info@bleumassawippi.com.\n\n#Vigilance #BleuMassawippi #LacMassawippi #BassinVersant",
      "After heavy rain, the right reflex is to observe without jumping to conclusions. Water, shorelines and tributaries respond to conditions that require context and sometimes analysis.\n\nIf a situation concerns you, note the location and time, then contact the association: info@bleumassawippi.com.\n\n#Awareness #BleuMassawippi #LakeMassawippi #Watershed"
    )
  },
  {
    id: "s3d5",
    visual: "Infographie de trois questions : Qu’est-ce qui est mesuré? Où et quand? Avec quoi compare-t-on?", 
    alt: "FR — Trois questions simples aident à lire une donnée sur le lac. / EN — Three simple questions help interpret a lake data point.",
    source: reportPage,
    task: "Garder le visuel à trois questions et renvoyer vers le rapport officiel pour les détails méthodologiques.",
    copy: bilingual(
      "Une donnée ne vit jamais seule. Avant de la partager ou de l’interpréter, posons trois questions :\n\n1. Qu’est-ce qui a été mesuré?\n2. Où et quand?\n3. Avec quoi compare-t-on ce résultat?\n\nCes trois repères transforment un chiffre isolé en information utile.\n\n#ScienceDuLac #BleuMassawippi #QualitéDeLEau #LacMassawippi",
      "A data point never lives alone. Before sharing or interpreting it, ask three questions:\n\n1. What was measured?\n2. Where and when?\n3. What is this result being compared with?\n\nThese three reference points turn an isolated number into useful information.\n\n#LakeScience #BleuMassawippi #WaterQuality #LakeMassawippi"
    )
  },
  {
    id: "s3d6",
    visual: "Vidéo verticale ou photo de lieu avec une phrase générale sur l’attachement au lac; aucune identité affichée sans autorisation écrite.",
    alt: "FR — Une vue paisible du lac accompagne une invitation à partager une pensée. / EN — A peaceful lake view accompanies an invitation to share a thought.",
    source: "Contenu communautaire — consentement requis avant diffusion",
    task: "Si aucun témoignage autorisé n’est reçu, utiliser la photo de lieu et cette légende telle quelle.",
    copy: bilingual(
      "Le lac est un milieu vivant, mais aussi un lieu de liens. Il rassemble des habitudes, des paysages et des moments que chacun porte à sa façon.\n\nQuelle place le Massawippi occupe-t-il dans votre été? Laissez une pensée en commentaire.\n\n#VoixDuLac #BleuMassawippi #LacMassawippi #Communauté",
      "The lake is a living environment, but it is also a place of connection. It brings together routines, landscapes and moments that each person carries in their own way.\n\nWhat place does Massawippi hold in your summer? Leave a thought in the comments.\n\n#LakeVoices #BleuMassawippi #LakeMassawippi #Community"
    )
  },
  {
    id: "s3d7",
    visual: "Visuel typographique A, B, C sur fond de lac : A nettoyer son embarcation, B protéger la rive, C préparer sa sortie.",
    alt: "FR — Trois gestes simples sont proposés pour protéger le lac. / EN — Three simple actions are suggested to protect the lake.",
    source: homeFr,
    task: "Utiliser un seul sondage en story et inviter aux commentaires sans organiser de concours ni promettre de prix.",
    copy: bilingual(
      "La question du dimanche : quel geste vous paraît le plus facile à adopter dès maintenant?\n\nA — Inspecter, nettoyer et vider son embarcation avant la mise à l’eau.\nB — Laisser la végétation protéger la rive.\nC — Préparer sa sortie pour profiter du lac en sécurité.\n\nRépondez A, B ou C en commentaire.\n\n#ChaqueGesteCompte #BleuMassawippi #LacMassawippi #Prévention",
      "Sunday question: which action feels easiest to adopt right now?\n\nA — Inspect, clean and drain your boat before launch.\nB — Let vegetation protect the shoreline.\nC — Prepare your outing so you can enjoy the lake safely.\n\nReply A, B or C in the comments.\n\n#EveryActionCounts #BleuMassawippi #LakeMassawippi #Prevention"
    )
  },
  {
    id: "s4d1",
    visual: "Mini-BD 4:5 en deux scènes : avant, remorque et embarcation à vérifier; après, débris retirés, eau vidée, équipement nettoyé puis laissé à sécher. Titre manuscrit blanc : Le rituel complet.",
    alt: "FR — Une mini-BD présente les étapes complètes à suivre avant de changer de plan d’eau. / EN — A mini-comic shows the complete routine before moving between bodies of water.",
    source: quebecBoatCleaning,
    task: "Dessiner une BD originale, sans reprendre de personnage ou d’illustration tiers; montrer retirer, vider, nettoyer et sécher dans deux scènes très lisibles sur mobile.",
    copy: bilingual(
      "Une sortie sur l’eau commence bien avant la mise à l’eau. Quand une embarcation change de plan d’eau, prenons le temps de retirer les débris visibles, vider l’eau retenue, nettoyer l’embarcation, la remorque et l’équipement, puis laisser sécher selon les recommandations officielles.\n\nCes gestes forment un seul rituel, simple à garder en tête et utile d’un lac à l’autre. Ensuite, toute la place revient au plaisir d’être sur l’eau.\n\n#MiniBD #BleuMassawippi #Prévention #NautismeResponsable #LacMassawippi",
      "A day on the water begins well before launch. When a boat moves between bodies of water, take time to remove visible debris, drain retained water, clean the boat, trailer and equipment, then let everything dry according to official guidance.\n\nTogether, these actions form one simple routine worth remembering from one lake to the next. Then all the attention can return to enjoying the water.\n\n#MiniComic #BleuMassawippi #Prevention #ResponsibleBoating #LakeMassawippi"
    )
  },
  {
    id: "s4d2",
    visual: "Photo réelle d’un lac partagé par plusieurs usages, avec une discrète icône radar; titre : Le plaisir partagé a son radar.",
    alt: "FR — Des usagers profitent du lac en gardant de l’espace entre eux. / EN — Lake users enjoy the water while keeping space between one another.",
    source: laccessible,
    task: "Employer un ton léger sans caricaturer les usagers; privilégier une image calme, dégagée et crédible.",
    copy: bilingual(
      "Le plaisir partagé a son radar.\n\nIl détecte les rives, les baigneurs, les embarcations plus lentes, les pêcheurs, les paddles et les moments où lever le pied rend tout le monde plus heureux.\n\nLe meilleur sillage? Celui qui laisse de la place aux autres.\n\n#HumourDuLac #BleuMassawippi #NautismeResponsable #LacMassawippi",
      "Shared enjoyment has its own radar.\n\nIt notices shorelines, swimmers, slower boats, anglers, paddlers and the moments when easing off makes everyone happier.\n\nThe best wake? The one that leaves room for others.\n\n#LakeHumour #BleuMassawippi #ResponsibleBoating #LakeMassawippi"
    )
  },
  {
    id: "s4d3",
    visual: "Carrousel de coulisses réel : bottes, carnet, outil de prélèvement et rive; titre : Les décisions solides commencent dehors.",
    alt: "FR — Du matériel de terrain est préparé pour une journée de suivi du lac. / EN — Field equipment is prepared for a lake-monitoring day.",
    source: homeFr,
    task: "Utiliser uniquement des photos de terrain autorisées; limiter l’appel au soutien à cette publication de la quinzaine.",
    copy: bilingual(
      "Une décision solide commence rarement derrière un écran. Elle commence sur le terrain : observer, mesurer, comparer, revenir.\n\nCe travail patient permet de mieux comprendre le lac et d’agir avec plus de justesse. Votre soutien aide à maintenir ce suivi.\n\nSoutenir Bleu Massawippi : " + homeFr + "\n\n#Coulisses #BleuMassawippi #LacMassawippi #SoutenirLeLac",
      "A sound decision rarely starts behind a screen. It starts in the field: observe, measure, compare, return.\n\nThis patient work helps us understand the lake better and act with greater care. Your support helps sustain that monitoring.\n\nSupport Bleu Massawippi: " + homeEn + "\n\n#BehindTheScenes #BleuMassawippi #LakeMassawippi #SupportTheLake"
    )
  },
  {
    id: "s4d4",
    visual: "Carrousel jeu d’observation : rive végétalisée, eau sans déchet visible et embarcation préparée; titre : Cherchez les trois détails.",
    alt: "FR — Une scène du lac invite à trouver trois détails qui contribuent à sa protection. / EN — A lake scene invites people to find three details that support protection.",
    source: homeFr,
    task: "Composer le visuel avec les trois détails réellement présents; révéler les réponses sur la seconde carte.",
    copy: bilingual(
      "Cherchez les trois détails qui protègent le lac.\n\nIndice 1 : une rive qui garde sa végétation.\nIndice 2 : une embarcation préparée avant la mise à l’eau.\nIndice 3 : un usager qui pense à ce qui se passe aussi en amont.\n\nLes avez-vous trouvés?\n\n#JeuDuLac #BleuMassawippi #ChaqueGesteCompte #LacMassawippi",
      "Find the three details that help protect the lake.\n\nClue 1: a shoreline that keeps its vegetation.\nClue 2: a boat prepared before launch.\nClue 3: a lake user who also thinks upstream.\n\nDid you find them?\n\n#LakeGame #BleuMassawippi #EveryActionCounts #LakeMassawippi"
    )
  },
  {
    id: "s4d5",
    visual: "Photo réelle d’un tributaire ou d’une rive végétalisée en amont; titre : Tout ce qui arrive au lac vient de quelque part.",
    alt: "FR — Un cours d’eau et sa végétation rejoignent le bassin versant du lac. / EN — A watercourse and its vegetation flow into the lake’s watershed.",
    source: homeFr,
    task: "Ne pas identifier un terrain privé ni présenter un tributaire comme une source de problème sans données confirmées.",
    copy: bilingual(
      "Tout ce qui arrive au lac vient de quelque part. Une goutte tombée sur un toit, un chemin, une pelouse ou une rive peut suivre un parcours vers un fossé, un tributaire puis le Massawippi.\n\nPenser en amont, c’est protéger le lac à la source.\n\n#BassinVersant #BleuMassawippi #LacMassawippi #AgirEnAmont",
      "Everything that reaches the lake comes from somewhere. A drop falling on a roof, road, lawn or shoreline can travel toward a ditch, a tributary and then Massawippi.\n\nThinking upstream means protecting the lake at its source.\n\n#Watershed #BleuMassawippi #LakeMassawippi #ThinkUpstream"
    )
  },
  {
    id: "s4d6",
    visual: "Reel vertical réel de 15 secondes : préparation, observation, mesure, note et rangement; sous-titres FR/EN.",
    alt: "FR — Une courte séquence montre les étapes d’une journée de terrain au lac. / EN — A short sequence shows the steps of a lake field day.",
    source: reportPage,
    task: "Monter cinq plans réels, garder les instruments lisibles et ne pas afficher de résultat non validé à l’écran.",
    copy: bilingual(
      "Une journée de terrain en 15 secondes : préparer, observer, mesurer, noter, recommencer.\n\nLe suivi du lac est fait de gestes simples répétés avec rigueur. C’est cette continuité qui transforme les observations en connaissance utile.\n\n#Terrain #BleuMassawippi #LacMassawippi #ScienceDuLac",
      "A field day in 15 seconds: prepare, observe, measure, record, repeat.\n\nLake monitoring is made of simple actions repeated with care. That continuity is what turns observations into useful knowledge.\n\n#Fieldwork #BleuMassawippi #LakeMassawippi #LakeScience"
    )
  },
  {
    id: "s4d7",
    visual: "Carrousel récapitulatif des quatre formats du mois : données, nature, gestes et terrain; titre : Le lac a parlé. Que gardons-nous?",
    alt: "FR — Un récapitulatif visuel des formats de contenu du mois. / EN — A visual recap of the month’s content formats.",
    source: "Résultats du mois dans Meta Business Suite — lecture interne",
    task: "Après publication, comparer portée, enregistrements, commentaires utiles et clics sans publier de donnée interne non contextualisée.",
    copy: bilingual(
      "Le lac a parlé tout le mois : par les données, les images, les gestes et vos commentaires.\n\nQuel format aimeriez-vous revoir?\nA — Une capsule science\nB — Un zoom nature\nC — Un quiz\nD — Une coulisse terrain\n\nRépondez A, B, C ou D. Votre retour aidera à préparer la suite.\n\n#BleuMassawippi #LacMassawippi #Communauté #BilanDuMois",
      "The lake has spoken all month long: through data, images, actions and your comments.\n\nWhich format would you like to see again?\nA — A science feature\nB — A nature zoom\nC — A quiz\nD — A fieldwork behind-the-scenes post\n\nReply A, B, C or D. Your feedback will help shape what comes next.\n\n#BleuMassawippi #LakeMassawippi #Community #MonthlyRecap"
    )
  }
];

if (final.length !== 28 || new Set(final.map((item) => item.id)).size !== 28) {
  throw new Error("Les 28 publications finales doivent avoir des identifiants uniques.");
}

function readPosts(file) {
  const html = fs.readFileSync(file, "utf8");
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0]?.[1];
  const match = script?.match(/var posts=(\[[\s\S]*?\]);\s*var meta=/);
  if (!match) throw new Error("Calendrier introuvable dans " + file);
  return JSON.parse(match[1]);
}

function replaceField(objectText, key, value) {
  const expression = new RegExp('"' + key + '":"(?:[^"\\\\]|\\\\.)*"');
  const replacement = '"' + key + '":' + JSON.stringify(value);
  if (!expression.test(objectText)) throw new Error("Champ introuvable : " + key);
  return objectText.replace(expression, replacement);
}

function synchronizeHtml(file) {
  let html = fs.readFileSync(file, "utf8");
  const currentPosts = readPosts(file);
  const finalById = new Map(final.map((item) => [item.id, item]));
  const mergedPosts = currentPosts.map((post) => {
    const item = finalById.get(post.id);
    const merged = item ? {
      ...post,
      ...(item.title ? { title: item.title } : {}),
      ...(item.cta ? { cta: item.cta } : {}),
      visual: item.visual,
      source: item.source,
      task: item.task,
      copy: item.copy
    } : post;
    const dateIso = planDateIsoFromLabel(merged.date);
    return dateIso ? { ...merged, dateIso } : merged;
  });
  const expression = /var posts=(\[[\s\S]*?\]);\s*var meta=/;
  if (!expression.test(html)) throw new Error("Calendrier introuvable dans " + file);
  html = html.replace(expression, `var posts=${JSON.stringify(mergedPosts)};\nvar meta=`);
  html = html.replace(/\[1,2,3,4\]\.forEach\(function\(n\)\{/, "[1,2,3,4,5,6,7,8].forEach(function(n){");
  html = html.replace(
    /Object\.keys\(days\)\.forEach\(function\(day\)\{/,
    "Object.keys(days).sort(function(a,b){return postDate(days[a][0])-postDate(days[b][0])}).forEach(function(day){"
  );
  fs.writeFileSync(file, html, "utf8");
}

function renderMarkdown(posts) {
  const orderedPosts = [...posts].sort((left, right) => {
    const leftKey = left.dateIso || planDateIsoFromLabel(left.date) || "9999-12-31";
    const rightKey = right.dateIso || planDateIsoFromLabel(right.date) || "9999-12-31";
    return leftKey.localeCompare(rightKey) || String(left.title || "").localeCompare(String(right.title || ""), "fr-CA");
  });
  const headings = [
    "# Textes complets finalisés — Cockpit Communication Bleu Massawippi",
    "",
    "**Calendrier actif :** à partir du lundi 13 juillet 2026; la réserve éditoriale est actuellement planifiée jusqu’au mardi 1er septembre 2026.",
    "**Usage :** textes bilingues prêts à programmer sur Facebook et Instagram, séparés par la ligne réglementaire du plan.",
    "**Voix :** chaleureuse, invitante et curieuse; les précautions techniques demeurent dans les notes de préparation plutôt que dans le message public.",
    "**Langues :** le français est rédigé d’abord avec naturel; l’anglais en est une adaptation fidèle au sens et au ton, jamais une traduction mot à mot.",
    "**Règle :** chaque légende demeure sous 2 200 caractères au total; les visuels doivent être authentiques, autorisés et accompagnés d’un texte alternatif descriptif.",
    "",
    "Les contenus V1 ont servi d’inspiration pour les formats éprouvés — quiz, preuve d’action, conseil, humour et appel à l’action — sans reprendre les sujets désormais exclus ni les faits non revalidés.",
    ""
  ];
  for (const post of orderedPosts) {
    const item = post;
    headings.push(
      "## " + post.date + " — " + post.title,
      "",
      "**Thème :** " + post.t,
      "**Format :** " + post.format,
      "**Objectif :** " + post.role,
      "**CTA :** " + post.cta,
      "**Visuel final :** " + item.visual,
      "**Texte alternatif :** " + (item.alt || "Décrire précisément le visuel retenu et son contexte."),
      "**Source de référence :** " + item.source,
      "**Préparation :** " + item.task,
      "",
      "### Légende prête à programmer",
      "",
      "```text",
      item.copy,
      "```",
      ""
    );
  }
  return headings.join("\n");
}

const planHtml = path.join(directory, "index.html");
const originalPosts = readPosts(planHtml);
const ids = new Set(originalPosts.map((post) => post.id));
for (const item of final) if (!ids.has(item.id)) throw new Error("Identifiant inconnu : " + item.id);

synchronizeHtml(planHtml);
const updatedPosts = applyPlanOverridesToPosts(readPosts(planHtml));
const markdownPath = path.join(directory, "TEXTES_COMPLETS_PUBLICATIONS_13_JUILLET_9_AOUT_2026.md");
fs.writeFileSync(markdownPath, renderMarkdown(updatedPosts), "utf8");

const invalid = updatedPosts.filter((post) => post.copy.length > 2200 || /\[(?:CITATION|PRÉNOM|LIEN|APPROVED|NAME|VERIFIED|ANNÉE|CANAL)/i.test(post.copy));
if (invalid.length) throw new Error("Texte final incomplet ou trop long : " + invalid.map((post) => post.id).join(", "));
console.log(JSON.stringify({
  synchronized: [planHtml],
  markdownPath,
  posts: updatedPosts.length,
  longestCaption: Math.max(...updatedPosts.map((post) => post.copy.length))
}, null, 2));
