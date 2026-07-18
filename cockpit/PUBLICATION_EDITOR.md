# Studio de publications du Cockpit

Le Studio est une couche d’édition structurée réservée au compte des communications. Il permet de créer, modifier, dupliquer, reprogrammer et classer une publication sans modifier le code du site et sans effacer l’historique.

## Principes de sécurité

- Le rôle `admin` voit le bouton **✎ Studio**; la direction ne le voit pas et les règles Firestore lui interdisent toute modification éditoriale structurée.
- Une publication classée reste dans Firestore avec `archivedEditorial: true`. Il n’existe aucune fonction de suppression.
- Chaque enregistrement produit une nouvelle révision et une entrée `changeArchive` dans la même transaction.
- Une révision périmée est refusée : il faut recharger avant d’écrire.
- Le calendrier utilise son listener existant. Le Studio n’ajoute aucun listener permanent et ne change le rendu que lorsque la signature éditoriale change.
- Les champs opérationnels déjà utilisés par le cockpit — commentaires, médias, validations, tâches et trois feux verts — restent dans leurs collections actuelles.

## Utiliser le Studio dans le Cockpit

1. Se connecter avec le compte des communications.
2. Cliquer sur **✎ Studio** dans la barre de session.
3. Choisir une publication ou un modèle.
4. Saisir la date et le titre : l’identifiant unique se construit automatiquement sous la forme `pub-AAAAMMJJ-titre`, avec un suffixe (`-2`, `-3`, etc.) seulement si nécessaire.
5. Vérifier le texte bilingue, le visuel prévu et les responsabilités.
6. Cliquer sur **✓ Enregistrer dans le cockpit**.

Après le premier enregistrement, l’identifiant reste stable même si le titre ou la date change. **Dupliquer** conserve la publication source comme origine et crée automatiquement un nouvel identifiant disponible. **Classer** masque éditorialement le contenu sans supprimer ses données. **Historique** permet de restaurer une ancienne version en créant une révision supplémentaire.

## Utiliser l’outil local

Le fichier `publication_editor_cli.mjs` donne au flux local les mêmes validations et le même historique que le Studio.

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\chemin\hors-du-depot\service-account.json"
$env:COCKPIT_ADMIN_UID = "UID_DU_COMPTE_COMMUNICATIONS"
node .\publication_editor_cli.mjs list --limit 20
node .\publication_editor_cli.mjs show --id alt-20260722
node .\publication_editor_cli.mjs update --file .\publication-template.example.json
```

Les commandes d’écriture sont toujours des simulations tant que `--apply` n’est pas fourni. Relire la sortie avant de relancer la même commande avec `--apply`.

```powershell
node .\publication_editor_cli.mjs update --file .\publication-template.example.json --expected-revision 3 --apply
```

Commandes disponibles :

- `list`, `show`, `history` : lectures bornées;
- `create`, `update` : objet JSON complet;
- `duplicate --id SOURCE --date AAAA-MM-JJ` : copie non destructive;
- `reschedule --id ID --date AAAA-MM-JJ` : nouvelle date et nouvelle révision;
- `restore --id ID --archive-id ARCHIVE_ID` : restauration sous forme d’une nouvelle révision.

## Ce que le Studio ne fait pas

Il ne modifie ni les règles de sécurité, ni le code, ni la structure libre de la page. Ces changements restent versionnés dans Git et passent par les tests et le déploiement contrôlé. Cette limite protège le cockpit contre une modification accidentelle de son architecture tout en couvrant le travail éditorial quotidien.

## Retour arrière

- Contenu : ouvrir **Historique** et restaurer la version voulue.
- Application : revenir au commit Git précédent ou au bundle de sauvegarde vérifié.
- Base complète : utiliser les outils de restauration seulement à partir d’une sauvegarde dont le manifeste a été vérifié, d’abord en simulation ou dans l’émulateur.
