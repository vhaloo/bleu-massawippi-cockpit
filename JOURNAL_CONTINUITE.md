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

Lisibilité des médias : chaque carte conserve l’aperçu réel, l’avertissement de droits éventuel, le choix final et le commentaire immédiatement visibles. Le nom du fichier, la note complète, l’étape et le lien vers l’original OneDrive sont regroupés dans un menu `Détails du média`, fermé par défaut.

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
