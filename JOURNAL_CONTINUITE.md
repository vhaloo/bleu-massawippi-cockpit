# Journal de continuité — cockpit Bleu Massawippi

Ce journal est un point de reprise local. Il ne contient aucun mot de passe, jeton ni clé privée. Les versions précédentes restent accessibles dans Git et dans `privateContentVersions`.

## État de la séquence en cours

- Le cockpit public est publié par GitHub Pages; le contenu stratégique est chargé après authentification depuis Firestore.
- Le registre est permanent. Les 28 premières journées sont une séquence de lancement, pas une limite du système.
- Le lundi 13 juillet devient une publication unique : **Portes ouvertes : venez nous rencontrer**.
- Le contenu nature retiré de ce lundi est conservé et repositionné au lundi 10 août comme réserve éditoriale de la semaine 5.
- Correction confirmée le 11 juillet 2026 : le local est à l’église Saint-Barthélemy, 911, rue Clough, Ayer’s Cliff, Québec J0B 1C0. Toute mention de Sainte-Élisabeth, de North Hatley ou du chemin Capelton est obsolète.

## Capsules de patrimoine — 11 juillet 2026

Six publications bilingues utilisant des documents du domaine public de la banque `Photos historiques` ont été ajoutées comme choix éditoriaux, sans écraser les publications principales :

- 19 juillet : estampe du Massawippi publiée en 1859;
- 26 juillet : bateau à vapeur sur le lac vers 1904;
- 1er août : vue aérienne de North Hatley entre 1930 et 1950;
- 4 août : chutes de la rivière Massawippi et moulin à scie vers 1865;
- 7 août : carte postale d’Ayer’s Cliff, environ 1914–1940;
- 10 août : carte de villégiature de North Hatley, environ 1905–1940.

Les textes distinguent explicitement photographie, estampe et carte postale; ils n’identifient aucun bâtiment, trajet ou personne sans source. Les six originaux ont été copiés dans le dossier SharePoint synchronisé `Media Cockpit\Photos historiques`, tandis que les fichiers maîtres et le catalogue des droits restent dans le dossier local `Photos historiques`. La synchronisation Firestore a créé l’état du nouvel événement du 10 août et préservé les 56 états déjà présents.

Chaque capsule possède maintenant son propre document `mediaLinks` dans Firestore, relié au fichier SharePoint exact et non à un dossier générique. Les six entrées sont réexécutables sans doublon avec `npm --prefix cockpit run seed:history-media`.

Extension de la banque le 11 juillet 2026 : les **43 images actives** du catalogue local ont été copiées sans écrasement dans `Media Cockpit\Photos historiques`, dotées chacune d’un lien SharePoint anonyme en lecture seule, puis reliées dans Firestore à **22 publications correspondantes**. Les associations regroupent notamment les panoramas avec les publications communautaires, les scènes de pluie et de crue avec la vigilance après la pluie, les vues de rivière avec les tributaires et le bassin versant, les marinas avec la sécurité et le sillage, et les bâtiments ou archives avec les publications patrimoniales. Les deux vues aériennes de 1958–1959 ont aussi été jointes à la publication aérienne, mais portent `rightsStatus: unconfirmed`, `publicationBlocked: true` et un avertissement visible « Droits à confirmer — référence interne seulement ». Le manifeste éditorial réexécutable est `cockpit/historical_media_manifest.json`; il ne contient aucun lien SharePoint. Les 43 liens individuels restent uniquement dans `cockpit/secrets/historical-media-links.json`, exclu de Git, puis sont injectés dans Firestore par le script local.

Mise à jour des permissions : l’ancien lien anonyme modifiable du dossier `Media Cockpit` a été révoqué. Le dossier possède désormais un lien anonyme **lecture seule**, tandis que les groupes internes Membres et Propriétaires conservent respectivement leurs droits d’écriture et d’administration. Les six photos historiques disposent aussi de liens anonymes individuels en lecture seule. Un test dans une session indépendante non connectée a confirmé l’ouverture du dossier comme « Collaborateur invité » et l’ouverture de l’aperçu SharePoint d’une image. Le cockpit transforme maintenant les liens publics d’image SharePoint en URL de rendu direct pour afficher la véritable photo dans la galerie, tout en conservant le lien original pour l’ouverture en pleine page. Un test réel dans Chrome a confirmé le chargement d’un JPEG SharePoint de 1920 × 1413; aucun fichier n’est dupliqué dans Firebase.

Règle éditoriale verrouillée : chaque publication du calendrier doit contenir un texte complet en français (`FR —`) et en anglais (`EN —`). Le test contractuel parcourt désormais toutes les publications et échoue si l’une des deux versions manque.

Navigation du calendrier : un ascenseur de dates fixe apparaît à droite lorsque le calendrier entre dans la fenêtre. Il met automatiquement en évidence la journée courante pendant le défilement et chaque date permet de rejoindre directement sa journée. Sur mobile, il devient un indicateur compact dépliable afin de ne pas masquer les cartes. Il se reconstruit après les filtres ou un nouveau rendu du calendrier et disparaît hors de la section calendrier.

Lisibilité des médias : chaque carte conserve l’aperçu réel immédiatement visible. Toutes les informations et actions placées dessous — avertissement de droits, nom, description, étape, lien OneDrive, choix final, commentaire et archivage — sont regroupées dans un unique volet `Informations et actions`, fermé par défaut. Un média retenu reste identifiable par le badge `✓ Retenu` même lorsque ce volet est fermé. La section générale `Médias OneDrive` permet toujours de replier aussi l’ensemble, aperçu compris. Les cartes mesurent jusqu’à 310 px, suivent un cadre 4:3 et utilisent `object-fit: contain` afin que les images portrait ou paysage apparaissent au complet sans recadrage; un badge `Agrandir ↗` rappelle que l’original s’ouvre en pleine page. Vérification publiée réussie le 12 juillet sur ordinateur et à 390 × 844 px : image chargée, volet secondaire fermé au démarrage, ouverture et fermeture fonctionnelles, aucun débordement horizontal.

Vérification mobile des médias : à 390 × 844 px, le cockpit rend 47 cartes média et 46 véritables images; le test ciblé n’a relevé aucun échec SharePoint. La difficulté provenait surtout des médias supplémentaires placés hors écran dans le carrousel horizontal. Chaque carrousel de deux médias ou plus possède donc maintenant, sur mobile, des flèches tactiles de 42 px, un compteur `1 / n` synchronisé au défilement et une consigne de glissement. Les aperçus restent chargeables à la demande afin de ne pas ralentir l’ouverture initiale.

Optimisation responsive du 12 juillet 2026 : le parcours téléphone conserve l’intégralité des fonctions, mais réorganise leur priorité. La session mesure dynamiquement sa propre hauteur et le sommaire collant se place exactement dessous; le changement clair/sombre devient une icône de 40 px dans la barre de session; les trois widgets administratifs deviennent une barre d’action inférieure; le corps réserve l’espace nécessaire pour que cette barre ne masque pas la fin de la page. Les cartes passent sur une colonne, les briefs gardent des marges compactes, les commentaires utilisent une grille tactile, les badges rapides restent sur une rangée et les trois feux verts sont présentés côte à côte. Les formulaires média, le calendrier, la barre de recherche et les boutons principaux disposent de cibles tactiles d’au moins 44 à 46 px. Tests réels réussis à 320 × 700, 390 × 844 et 768 × 1024 sans débordement horizontal sur téléphone; les panneaux Boîte à idées, À accomplir et Journal s’ouvrent et se referment correctement; le thème passe de sombre à clair puis revient à l’état initial.

Série nature du 12 juillet 2026 : neuf affiches éducatives originales au format 4:5 ont été produites pour chacune des neuf publications de nature. La direction visuelle reprend les qualités générales des anciennes planches scolaires — papier ivoire, dessin naturaliste à l’encre, palette restreinte et détails agrandis — sans copier une affiche existante. Les PNG maîtres sont conservés dans `Images\Plan d'action\Affiches nature vintage`; les JPEG de diffusion mesurent 1080 × 1350, pèsent de 417 à 548 Ko et se trouvent dans le sous-dossier `Prets a publier`. Ces neuf JPEG ont aussi été copiés dans `Media Cockpit\Visuels nature vintage`, dotés de liens SharePoint anonymes en lecture seule et reliés à leurs événements dans Firestore. Le manifeste public `cockpit/nature_media_manifest.json` ne contient aucun lien SharePoint; les liens restent dans `cockpit/secrets/nature-media-links.json`, exclu du dépôt, et sont injectés de façon réexécutable par `npm run seed:nature-media`.

Couverture éditoriale de la première semaine : cinq médias supplémentaires ont été produits pour les dernières propositions sans visuel — essentiel avant une sortie, quiz du disque de Secchi, trois façons de lire un lac, mot bleu de la semaine et couverture du paysage sonore. Les fichiers maîtres et les JPEG optimisés se trouvent dans `Images\Plan d'action\Visuels premiere semaine`; les versions partagées sont dans `Media Cockpit\Visuels premiere semaine`. Les cinq liens SharePoint en lecture seule sont injectés par `npm run seed:editorial-media`, à partir du manifeste public sans URL `cockpit/editorial_media_manifest.json`. Résultat vérifié dans Firestore : les 13 propositions de la première semaine disposent toutes d’au moins un média; les 9 publications de nature disposent toutes de leur affiche; 36 des 57 publications du calendrier ont maintenant au moins un média lié. Les 21 autres exigent encore soit un visuel original, soit une vraie prise de vue ou une séquence terrain correspondant au brief.

## Régression de stabilité — 11 juillet 2026

Le frontend est revenu au dernier socle stable antérieur au module photo (`137525a`). Les fonctions textuelles essentielles sont conservées : authentification, calendrier, choix, statuts, commentaires, dictée, rétroactions, tâches, calendrier personnel et installation PWA. Le rescan global de la page a été remplacé par une observation ciblée des cartes pour éviter les boucles et ralentissements.

- Aucun téléversement ni affichage de pièce jointe n’est présent dans le chemin public.
- Firebase Storage refuse désormais toutes les lectures et écritures; Firestore n’expose plus de collection `attachments` au frontend.
- Les anciens scripts photo restent dans l’historique Git comme référence, mais ne font plus partie des commandes de production ni du déploiement.
- Le thème clair/sombre est un module isolé sans dépendance Firebase. Une panne de thème ne peut donc pas bloquer la connexion.
- Toute future fonction importante doit être livrée comme module isolé, accompagnée d’un test contractuel, puis activée progressivement après validation du parcours de connexion.

## Dictée et diagnostic

Le test du 11 juillet a reproduit l’attente infinie lorsque plusieurs anciens onglets utilisaient simultanément le verrou IndexedDB de Firestore (`Failed to obtain exclusive access to the persistence layer`). Le cockpit utilise maintenant le cache mémoire Firestore par défaut, conserve la persistance locale de la session d’authentification et réserve le cache hors ligne au paramètre explicite `?offline=1`. Les requêtes de profil, de connexion et de contenu disposent aussi d’un délai maximal de 15 secondes avec un message de reprise.

- La dictée demande explicitement l’accès au microphone, utilise `SpeechRecognition` ou `webkitSpeechRecognition`, retente les langues françaises disponibles et relance les sessions interrompues.
- Un repli vers la dictée du système est affiché quand l’API ou le service vocal du navigateur est indisponible.
- Le diagnostic temporaire surchargé a été retiré du chemin stable. Les erreurs utiles restent dans la console du navigateur et les délais de connexion produisent un message visible au lieu d’une attente infinie.

## Tests à refaire après chaque évolution importante

1. `npm --prefix cockpit run check`
2. `npm --prefix cockpit run seed -- --dry-run`
3. Vérifier la connexion administrateur et direction générale.
4. Ouvrir le premier événement, confirmer qu’il n’y a qu’une option le 13 juillet.
5. Tester un commentaire tapé, un badge rapide, une rétroaction de section et la boîte à idées.
6. Vérifier le bouton clair/sombre, puis recharger la page pour confirmer la préférence locale.
7. Vérifier la génération du fichier calendrier selon le rôle connecté.
8. Vérifier le contenu de `sync-output` après `npm run sync`.

## Points de vigilance

- La reconnaissance vocale dépend toujours du service et des permissions du navigateur; aucun site ne peut garantir la transcription si le navigateur ou le réseau la bloque.
- Ne jamais ajouter de compte de service, mot de passe ou clé API privée au dépôt public.
- La configuration Web Firebase est publique par conception; elle ne donne aucun privilège administrateur. La sécurité repose sur Auth et les règles. Toute vraie clé privée ou clé de service exposée doit être révoquée, remplacée et retirée de l’historique.
- Ne jamais remplacer une photo fournie par une image générée si l’architecture ou l’identité du lieu n’est pas strictement préservée.
- Vérification d’authentification du 10 juillet : le compte administrateur Valentin répond correctement via Firebase Auth; le mot de passe local associé à l’adresse de la direction générale est refusé par Firebase et devra être réinitialisé avant un test de parcours Annie.

## Cycle éditorial du 28 juillet 2026

Le cycle a intégré les cinq interventions actives de la direction : correction du protocole cyanobactéries, structure d’offre North Hatley/Ayer’s Cliff, remise à plat du bilan de santé 2026–2027, veille prudente sur les lésions de la barbotte brune et explication publique de la contribution volontaire Zeffy. Les faits transmis par la direction sont identifiés comme tels et les conclusions scientifiques demeurent limitées aux sources primaires consultées.

La seconde lecture Firestore, incrémentale et bornée, n’a trouvé aucune nouvelle intervention avant la préparation du déploiement. Les clôtures sont simulées avant application et produisent une archive déterministe sans suppression. La suite complète réussit, avec 100 contrôles qualité sur 100 et 494 contrôles de contenu. L’inspection à 390 × 844 px a aussi permis de corriger un débordement horizontal global de 5 px. Point de retour : `2b170baf81e0e8a5dfee60f61096e4d3ef21f563`.

## Deuxième passage éditorial du 28 juillet 2026

Deux nouveaux commentaires de la direction ont été intégrés dans un worktree distinct, à partir du point de retour `05e246ded4e2a7a20cf2fae063d6e7675233c2ee`. Le clic « À développer » lié au projet poésie a été reconnu comme accidentel; la tâche était déjà fermée et aucun développement artificiel n’a été créé.

Le projet « Au bord du bleu » comprend désormais un aide-mémoire pour la rencontre du 10 août avec la direction générale de North Hatley. Le projet d’application « Massawippi en partage » distingue clairement l’inspiration LakePulse de l’usage scientifique des données et conditionne toute approche universitaire à un cadrage et à une capacité de suivi réels.

La seconde synchronisation Firestore a produit 14 lectures estimées et aucun nouveau document. La suite complète réussit avec 494 contrôles de contenu et 100 contrôles qualité; l’inspection à 1440 × 900 et 390 × 844 ne montre ni débordement horizontal ni erreur navigateur. Point de retour : `05e246ded4e2a7a20cf2fae063d6e7675233c2ee`.

## Cycle éditorial et coordination du 10 août 2026

Point de départ Git : `74576bb33a88fc57c9bae04dd98bde3486bd8ade`. Une sauvegarde manuelle vérifiable a été créée avant mutation dans `Sauvegardes Cockpit/Outillage/20260810-170707-conversation-annie-precycle-manual`; le SHA-256 du bundle est `53B8F8F0F4C25B2955A58C518387061839491E6C43C61B0F2D101447881F813A`.

Le cycle a intégré les faits confirmés de la discussion du 10 août sans exposer les éléments personnels ou sensibles :

- le report 2027 du projet Lamproie demeure une demande à confirmer par écrit et ne supprime aucune obligation courante;
- le projet d’application attend explicitement la version révisée d’Annie plutôt que de présenter la V1 comme finale;
- « Au bord du bleu » indique 13 inscriptions au point de situation, la clôture des candidatures, l’absence de formule micro ouvert et la confirmation directe encore requise pour la participation de Denis;
- le Guide de sécurité nautique 2026 est présenté comme une référence officielle, avec un langage qui ne lui attribue aucun pouvoir réglementaire à Bleu Massawippi;
- les dossiers Lamproie et poésie ont reçu des cartes documentaires explicites plutôt que des liens isolés;
- trois nouveautés ciblées pour la direction et sept événements du calendrier de projets sont préparés de façon idempotente.

Les accès SharePoint ont été vérifiés et complétés sans envoi de courriel : `dg@bleumassawippi.com` et `communication@bleumassawippi.com` disposent d’un accès nommé en écriture au dossier Media Cockpit et aux dossiers de travail qui exigent une collaboration, ainsi que d’un accès nommé en lecture aux références connexes. Les anciens liens anonymes n’ont pas été révoqués durant ce cycle afin de ne pas casser des liens historiques du cockpit; leur éventuel retrait est consigné comme décision de migration distincte dans `TACHES_EXTERNES_VALENTIN.md`.

Un test persistant des documents et ancres a été ajouté à la suite locale et à la validation GitHub Pages. Résultat : 139 références dans le contenu privé, 52 URL SharePoint, aucun fichier local absent, aucune ancre absente et aucune URL externe invalide. La suite non-émulateur réussit intégralement : 109 contrôles qualité réussis, aucun échec critique, 540 contrôles de contenu, 47 publications sur 47 jours sans trou ni doublon. Les règles Firestore totalisent 49 scénarios ou assertions réussis dans les émulateurs. Les parcours Direction et Communications ouvrent des cibles distinctes; les tests à 1536 × 900 et 390 × 844, en clair et en sombre, ne montrent aucun débordement horizontal.

La coque PWA préparée porte la publication `20260810-b56` et le cache `v90`. Le second cycle éditorial ciblé en production a trouvé 20 rétroactions, toutes traitées, aucune tâche active et aucun nouveau commentaire à intégrer.

Les simulations de synchronisation sont bornées et réussies : contenu privé de 544 693 octets, 15 avis avec un plafond de 17 lectures et 15 écritures, sept événements de projets avec un plafond de huit lectures et quatorze écritures.

Avant l’écriture réelle, 11 documents précisément nommés ont été relus et sauvegardés dans `cockpit/sync-output/pre-sync-20260810-final`. Cette sauvegarde a produit 11 lectures, aucune écriture et aucune avancée de checkpoint; son `target-summary.json` porte le SHA-256 `D84AA9B58145A6DD24C455D0499040E6548C5CA99651D179139381395E28D357`. L’authentification a réutilisé temporairement la session locale Firebase CLI dans un fichier ADC aux permissions restreintes, supprimé automatiquement après chaque commande; aucune clé de compte de service n’a été créée ni conservée.

La synchronisation de production a ensuite été exécutée en trois lots ciblés : deux écritures pour la nouvelle version du contenu privé, six créations d’avis avec neuf avis préservés, puis six écritures atomiques pour trois événements de projets modifiés, quatre autres restant inchangés. Aucun document n’a été supprimé et aucun état quotidien hors portée n’a été réécrit. La contre-lecture `cockpit/sync-output/post-sync-20260810-final` confirme les 11 cibles, le hash de contenu `3ac1349695d379facfe92b7fb5ec90c2a7121b8aea5cbf9da6b1e23815ee85dd`, 11 lectures et zéro écriture; son `target-summary.json` porte le SHA-256 `CCF6A74BFB1B5CE22D630A6F26555B37833AB2348E43227F4C7703FF2B8C7A4E`. Trois réexécutions de contrôle prouvent l’idempotence : contenu inchangé et zéro écriture, 15 avis préservés et zéro écriture, sept événements inchangés et zéro écriture.

Retour arrière : restaurer d’abord le commit de départ `74576bb33a88fc57c9bae04dd98bde3486bd8ade` ou le bundle manuel indiqué plus haut pour le code; pour Firestore, réappliquer exclusivement les documents présents dans la sauvegarde ciblée pré-synchronisation après comparaison, sans scan global ni suppression.

## Suivi médias, droits et second cycle du 10 août 2026

Ce suivi a été préparé dans le worktree isolé `cockpit-audit-annie-complet-20260810`, branche `agent/audit-annie-complet-20260810`, depuis `f545b72`. Le point de retour demeure le bundle `Sauvegardes Cockpit/Outillage/20260810-170707-conversation-annie-precycle-manual`, SHA-256 `53B8F8F0F4C25B2955A58C518387061839491E6C43C61B0F2D101447881F813A`.

Le média sélectionné du 12 août pointe de nouveau vers son fichier SharePoint stable, sans modification de l’image ni des validations. Pendant cette réparation, l’ancien script de semis historique a resynchronisé mécaniquement les 44 entrées historiques déjà connues. Il n’a créé ni supprimé aucune entrée et les associations canoniques ont été conservées; cette réécriture plus large que prévu est consignée ici pour ne pas être confondue avec une intervention éditoriale.

Pour le 15 août, la photographie interne `editorial-s4d1b-field-internal-photo-v3` est maintenant recommandée par Valentin au titre des communications. Le choix de la direction demeure volontairement vide et l’accord reste `pending`; le texte demeure à l’étape `content_approved`. Les droits de diffusion de cette photographie interne sont structurés comme confirmés, avec `publicationBlocked: false`, sans conserver la mention ambiguë « référence seulement ». La première réconciliation a produit trois écritures atomiques, puis la normalisation du libellé de droits deux écritures; les relectures ciblées ont utilisé successivement 4, 3 et 3 lectures, sans écriture supplémentaire.

Un contrôle de droits apparaît désormais près des actions d’un média seulement lorsque ses droits sont réellement suivis comme incertains. Seuls les rôles direction et administration peuvent confirmer ce point. La confirmation et son archive avant/après sont atomiques; une remise en attente re-bloque la publication et est refusée tant que le média demeure dans un choix actif. Les médias dont les droits ne soulèvent aucune question ne reçoivent pas de case superflue.

Les permissions SharePoint du dossier `Media Cockpit` et de deux fichiers représentatifs, dont ceux des 12 et 15 août, confirment un accès nommé en écriture pour `dg@bleumassawippi.com` et `communication@bleumassawippi.com`. Aucun élargissement de permission n’a été nécessaire et les anciens liens anonymes n’ont pas été modifiés. Trois aperçus locaux manquants, mais déjà référencés par les manifestes, ont aussi été restaurés sans changer les originaux ni les choix.

La suite complète réussit : 540 contrôles contractuels, 109 contrôles qualité sans échec critique, 47 publications sur 47 jours sans trou ni doublon, tests de règles et d’archives atomiques, liens et ancres, notifications, historique borné, calendrier de projets et intégrité des aperçus. Les deux avertissements restants portent uniquement sur les seuils de taille du module UI et de la source privée. Les inspections Direction et Communications à 390 × 844 et 1536 × 864, en clair et en sombre, ne montrent aucun débordement de page; la languette du panneau de tâches reste discrète et son ouverture forcée demeure réversible.

Le second cycle éditorial a été limité à une fenêtre d’un jour avec un plafond de 250 lectures. Il a consommé 53 lectures estimées sur 16 requêtes, sans scan complet : aucun nouveau commentaire, aucune dictée et aucune nouvelle rétroaction; une tâche déjà terminée et six avis de contenu destinés à Annie ont été préservés tels quels. Aucune mutation éditoriale additionnelle n’était requise.

Après réussite des tests, les règles Firestore ont été publiées sous le ruleset `f6209f62-207d-432c-acf8-5a2c8ac8b769` avant la coque `20260810-b57`, afin que l’ancienne interface demeure compatible et que le nouveau contrôle de droits ne rencontre aucune fenêtre de permission manquante.
