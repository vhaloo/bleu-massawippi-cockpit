# Registre des membres dans Philanthropie

`#/philanthropie?vue=membres` affiche le registre central après la connexion, dans le même ensemble d’onglets que les autres volets. Les fiches, versements, coordonnées, rapprochements et historiques sont exclusivement dans `privateContent/philanthropie-membres` et ses lots privés. Le code public ne contient que les règles de présentation. Les fixtures et exports privés ne font pas partie de l’artefact Pages.

Le classeur SharePoint **Registre des membres et donateurs.xlsx** est la source modifiable. La vue Cockpit est un instantané tracé, non une synchronisation Graph instantanée. Une lecture serveur du manifeste puis de ses lots s’effectue à l’ouverture; naviguer, filtrer et ouvrir une fiche n’ajoute aucune lecture. « Actualiser le registre » relit le serveur. Aucune souscription par fiche ni copie supplémentaire dans le stockage du navigateur n’est ajoutée. L’application reste soumise aux règles existantes de lecture des contenus privés pour les utilisateurs actifs.

## Définitions

- Un don monétaire documenté établit le lien de membre selon la définition de la direction; les appuis en nature sont identifiés à part.
- Les compteurs désignent des **fiches**, jamais des personnes uniques déduites de coordonnées. Un téléphone ou courriel commun déclenche un rapprochement, sans fusion automatique ni modification du classeur.
- Les paiements sont uniques par la clé conservée dans `Versements`. Les sommes sont en centimes entiers, par année civile et catégorie; les remboursements figurent dans la fiche de paiement. Les totaux du registre ne sont pas les revenus comptables de l’organisme.
- Une cellule vide reste absente. Elle ne devient pas un zéro ni la preuve que quelqu’un n’a jamais donné. L’historique des anciennes listes est conservé comme historique, sans création de paiement.
- Les statistiques et exports portent sur toute la sélection filtrée, au-delà de la page visible. La table principale montre les trois dernières années disponibles; la fiche et l’export gardent toutes les années.

## Actualiser pendant un cycle

1. Relire les métadonnées exactes du classeur avec le connecteur SharePoint. Comparer son `e_tag` avec le manifeste en ligne. S’il est inchangé, ne pas réimporter les lots pour un simple changement d’heure. Un changement de source impose un nouveau téléchargement et un contrôle de son contenu.
2. Garder les fichiers XLSX, métadonnées JSON avec `checkedAt`, instantanés et reçus **hors du dépôt public**, dans le dossier privé `Livrables` de Bleu Massawippi. Ne jamais mettre de jeton ou URL temporaire dans les métadonnées sauvegardées.
3. Produire l’instantané local en lecture seule. Python avec `openpyxl` est nécessaire; il ne sert qu’à lire le XLSX, jamais à réécrire la source :

       python cockpit/build_member_registry.py --workbook PRIVATE.xlsx --metadata PRIVATE_METADATA.json --output PRIVATE_SNAPSHOT.json

4. Vérifier le rapprochement contact/versements, la source, les anciennes fiches et la granularité. Le générateur refuse une clé de paiement dupliquée, un ID inconnu ou des montants divergents. Le modèle valide aussi les compteurs et bilans annuels. Le schéma courant attend les colonnes revues du classeur; toute évolution de schéma nécessite une revue de l’importeur.
5. Créer et vérifier le point de retour approprié; terminer la seconde lecture bornée des demandes d’Annie et des mails pertinents. Les preuves de sauvegarde, de métadonnées fraîches et de contrôle éditorial sont requises avant application.
6. Prévisualiser avec Node et les dépendances verrouillées du Cockpit. `GOOGLE_APPLICATION_CREDENTIALS` doit être fourni extérieurement pour la lecture ciblée; aucune clé ne doit être recherchée ou copiée :

       node cockpit/sync_member_registry.mjs --snapshot PRIVATE_SNAPSHOT.json --receipts PRIVATE_RECEIPTS_DIR --actor-uid EXISTING_ADMIN_UID --project EXISTING_PROJECT_ID

7. Relire le résultat. L’application exige `--apply --expected-digest DIGEST --backup-proof PRIVATE_BACKUP_PROOF.json --source-proof PRIVATE_FRESH_METADATA.json --cycle-proof PRIVATE_CYCLE_PROOF.json`. La preuve de sauvegarde contient `verified: true` et `status: complete`; le contrôle éditorial `complete: true` et `at`. L’authentification normale Firebase CLI doit être disponible; son jeton reste uniquement en mémoire du processus. Aucun identifiant de connexion n’est journalisé. Chaque document bénéficie d’une précondition de version ou d’inexistence, d’une archive et des versions avant/après, dans un seul commit atomique. Les rôles, permissions, avis et classeur ne sont pas modifiés.
8. Relire et valider les documents enregistrés; contrôler l’affichage pour les rôles concernés puis journaliser. Le manifeste et tous les lots doivent partager le même `snapshotId`. Une lecture concurrente incohérente échoue avec un message de reprise, sans mélanger les versions.

## Retour arrière

Conserver le commit de code d’avant changement et le reçu typé `AVANT_PRIVE.ndjson` avec toutes les archives. Revenir d’abord à l’interface précédente si nécessaire. Restaurer ensuite les seuls documents concernés avec des préconditions sur leurs versions courantes; les créations n’ont pas de version antérieure et doivent être distinguées des remplacements. Ne pas rejouer une ancienne simulation ni restaurer la base entière par-dessus des changements humains récents. Les documents privés devenus inutilisés restent conservés jusqu’à un nettoyage explicitement autorisé.

## Vérification

`npm --prefix cockpit run test:members`, `test:philanthropy`, `test:workspace-v2`, puis l’audit complet avant une livraison qui change la navigation et le chargement des données. Le déploiement public contient seulement `members-model.mjs` et `members-ui.mjs`, jamais les jeux de tests, le XLSX ou les instantanés privés.
