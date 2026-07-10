# Journal de continuité — cockpit Bleu Massawippi

Ce journal est un point de reprise local. Il ne contient aucun mot de passe, jeton ni clé privée. Les versions précédentes restent accessibles dans Git et dans `privateContentVersions`.

## État de la séquence en cours

- Le cockpit public est publié par GitHub Pages; le contenu stratégique est chargé après authentification depuis Firestore.
- Le registre est permanent. Les 28 premières journées sont une séquence de lancement, pas une limite du système.
- Le lundi 13 juillet devient une publication unique : **Portes ouvertes : venez nous rencontrer**.
- Le contenu nature retiré de ce lundi est conservé et repositionné au lundi 10 août comme réserve éditoriale de la semaine 5.
- L’adresse publique vérifiée pour le local est : 3115, chemin Capelton, North Hatley, Québec J0B 2C0.

## Visuels et pièces jointes

- Les photos ajoutées depuis un événement sont converties dans le navigateur en JPEG 4:5, jusqu’à 1080 × 1350, sous 1 Mo.
- Le frontend refuse les types non image et Firebase Storage refuse tout ce qui n’est pas un JPEG sous 1 Mo.
- Les métadonnées sont dans `attachments/{attachmentId}`; les versions ne sont pas supprimées depuis le frontend.
- Les deux dérivations de référence du premier post sont conservées localement dans `C:\Users\Vhaloo\Documents\Bleu Massawippi\media\portes-ouvertes\` : la source recadrée et le visuel proposé avec correction légère. Aucune génération ayant inventé l’architecture n’est utilisée.
- `admin_sync.js` télécharge désormais les pièces jointes non marquées `downloadedLocally` dans `sync-output/attachments` et conserve leur trace dans Firestore.

## Dictée et diagnostic

- La dictée demande explicitement l’accès au microphone, utilise `SpeechRecognition` ou `webkitSpeechRecognition`, retente les langues françaises disponibles et relance les sessions interrompues.
- Un repli vers la dictée du système est affiché quand l’API ou le service vocal du navigateur est indisponible.
- Le compte administrateur dispose d’un widget **Diagnostic** minimisable qui recueille erreurs JavaScript, promesses non gérées, avertissements Firebase et erreurs affichées par le cockpit.

## Tests à refaire après chaque évolution importante

1. `npm --prefix cockpit run check`
2. `npm --prefix cockpit run seed -- --dry-run`
3. Vérifier la connexion administrateur et direction générale.
4. Ouvrir le premier événement, confirmer qu’il n’y a qu’une option le 13 juillet.
5. Tester un commentaire tapé, un badge rapide, une rétroaction de section et la boîte à idées.
6. Tester l’ajout d’une photo lourde puis vérifier la conversion JPEG 4:5 sous 1 Mo.
7. Ouvrir une vignette en nouvel onglet et vérifier la génération du fichier calendrier.
8. Vérifier le widget Diagnostic et le contenu de `sync-output` après `npm run sync`.

## Points de vigilance

- La reconnaissance vocale dépend toujours du service et des permissions du navigateur; aucun site ne peut garantir la transcription si le navigateur ou le réseau la bloque.
- Le volume affiché dans le cockpit est une estimation interne des fichiers connus, pas un relevé de facturation Firebase.
- Ne jamais ajouter de compte de service, mot de passe ou clé API privée au dépôt public.
- Ne jamais remplacer une photo fournie par une image générée si l’architecture ou l’identité du lieu n’est pas strictement préservée.
