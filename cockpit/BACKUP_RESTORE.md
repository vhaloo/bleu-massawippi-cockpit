# Synchronisation incrémentale et export d’audit Firestore

`admin_sync.js` est un outil local, en lecture seule sur Firestore. Il offre trois chemins séparés :

- le **mode quotidien incrémental** (défaut), qui lit seulement les changements après un checkpoint local;
- le **mode ciblé**, pour inspecter quelques identifiants sans modifier le checkpoint;
- `--audit-export`, le seul mode qui parcourt volontairement toutes les collections de premier niveau.

La commande `node admin_sync.js --help` fonctionne sans clé Firebase.

## 1. Mode quotidien : deltas bornés

Depuis `cockpit` :

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\chemin\local\compte-de-service.json"
node admin_sync.js
```

Le premier passage utilise les 14 derniers jours comme fenêtre initiale. Les passages suivants reprennent le couple déterministe `timestamp + identifiant` propre à chaque collection. Un chevauchement de deux minutes protège contre un léger retard d’arrivée; les empreintes conservées dans le checkpoint empêchent que les documents inchangés réapparaissent dans le delta.

Options prudentes :

```powershell
node admin_sync.js --days=7 --read-cap=300 --page-size=100 --overlap-seconds=120
```

- `--days` : fenêtre du **premier passage seulement**, de 1 à 366 jours;
- `--read-cap` : plafond dur estimé des lectures de documents, 500 par défaut;
- `--page-size` : page Firestore de 1 à 200 documents, 100 par défaut;
- `--overlap-seconds` : chevauchement de 0 à 900 secondes;
- `--output=nom` : sortie isolée sous `cockpit/sync-output/nom`.

Le script réserve au moins une requête à chacune des quatorze collections avant de consommer le reste du budget. Une base sans changement produit quatorze requêtes vides, soit une estimation de quatorze lectures de documents : la cible de moins de 25 est donc vérifiable dans `metrics.estimatedDocumentReads`. Les nouvelles projections `actionItems` et `mediaDecisions` sont incluses sans listener ou balayage supplémentaire hors de ce passage unique.

Cette métrique est un **compteur local prudent**, pas la valeur officielle de la console Firebase. Elle compte au minimum une lecture par requête vide et tous les documents reçus. Elle ne mesure pas la facturation éventuelle des entrées d’index; la console Firebase reste la source officielle.

## 2. Checkpoint, miroir et atomicité

Sorties stables :

```text
sync-output/
  sync-summary.json       delta du dernier passage, format compatible avec l’ancien résumé
  sync-mirror.json        tâches, actions personnelles, commentaires et rétroactions actifs
  sync-manifest.json      tailles et empreintes SHA-256 de la dernière exécution
  latest-run.json         pointeur vers l’exécution immuable
  .admin-sync/
    checkpoint.json       curseurs par collection; écrit en dernier
    runs/
      run-.../
        RUN_COMPLETE.json
        sync-summary.json
        sync-mirror.json
        checkpoint.next.json
        manifest.json
```

La séquence de validation est volontairement stricte :

1. écrire tous les fichiers dans un dossier temporaire unique;
2. générer les empreintes et `RUN_COMPLETE.json`;
3. renommer le dossier d’exécution;
4. remplacer atomiquement les sorties stables;
5. avancer `checkpoint.json` **en dernier**.

Une interruption avant l’étape 5 peut donc relire un petit delta au passage suivant, mais ne peut pas sauter des changements. La déduplication rend cette reprise sûre. Les dossiers `.tmp-*` renommés `.incomplete` constituent une preuve d’interruption et peuvent être examinés; ils ne doivent pas être pris pour une exécution complète.

Le miroir actif est compact et ne supprime rien de Firestore. Quand une tâche ou un commentaire est clos, il sort seulement de `sync-mirror.json`; la mutation source et son historique demeurent dans Firestore et dans les deltas concernés. Le miroir construit depuis un premier passage borné ne prétend pas fournir une couverture historique complète.

## 3. Verrou de concurrence

Le fichier `sync-output/.admin-sync.lock` empêche deux processus de lire et d’écrire les mêmes checkpoints en parallèle.

- ne jamais effacer manuellement ce verrou pendant qu’un processus est actif;
- un verrou du même ordinateur n’est récupéré qu’après six heures **et** seulement si son PID n’existe plus;
- le verrou récupéré est renommé `.stale-*` et conservé comme preuve;
- le verrou courant est retiré uniquement par le processus qui possède son jeton.

## 4. Lecture ciblée sans écriture

Documents connus :

```powershell
node admin_sync.js --target="scheduleItems/alt-20260715,mediaLinks/nature-alt-20260715-libellule-manuscript-v5-scientific-bilingual" --read-cap=10
```

Réconciliation média ciblée :

```powershell
node admin_sync.js --media-reconcile="alt-20260715,nature-alt-20260715-libellule-manuscript-v5-scientific-bilingual" --read-cap=25
```

Ce second mode lit directement l’événement, le média, l’état du workflow et la décision éditoriale, puis effectue deux petites requêtes bornées sur `tasks` et `actionItems`. Il produit `target-summary.json`, mais :

- n’écrit rien dans Firestore;
- n’attribue aucune approbation à un acteur;
- n’avance pas le checkpoint quotidien;
- refuse plus de vingt cibles directes;
- applique la même suppression des champs de type secret que l’export d’audit.

## 5. Documents dépourvus d’horodatage

Le chemin quotidien utilise un champ canonique par collection : `updatedAt` pour les données modifiables et `createdAt` pour les journaux append-only. Firestore exclut d’une requête ordonnée les documents qui ne possèdent pas ce champ.

Le script ne lance donc **aucun balayage de secours silencieux**. Pour des documents historiques sans horodatage :

1. les identifier lors d’un `--audit-export` explicitement autorisé;
2. préparer une migration unique, idempotente et testée dans l’Emulator;
3. ne l’exécuter en production qu’avec un plafond et un rollback distincts.

Cette limite est préférable à douze balayages complets à chaque passage quotidien.

## 6. Export d’audit explicite

```powershell
node admin_sync.js --audit-export
```

`--full` demeure un alias historique. L’export crée toujours un nouveau dossier horodaté :

```text
sync-output/
  backup-20260712T203000Z/
    EXPORT_COMPLETE.json
    collections/
      scheduleItems.json
      users.json
      privateContent.json
      ...
    backup-summary.json
    manifest.json
    manifest.sha256
```

Ce mode découvre puis lit toutes les collections de premier niveau. Il est volontairement exclu du chemin quotidien, ne possède pas le plafond de lecture du mode incrémental et ne doit être lancé qu’après estimation et confirmation du besoin.

L’export reste **un audit logique assaini, pas une sauvegarde de reprise après sinistre** : il ne parcourt pas les sous-collections et remplace les champs ressemblant à un mot de passe, une clé privée ou un jeton par `[REDACTED]`. Les dates, références, coordonnées géographiques et données binaires utilisent un marqueur `__firestoreType`.

## 7. Vérifier l’intégrité d’un export d’audit

```powershell
$backup = "sync-output\backup-20260712T203000Z"
$expected = (Get-Content "$backup\manifest.sha256" -Raw).Split()[0]
$actual = (Get-FileHash "$backup\manifest.json" -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw "Le manifeste ne correspond pas à son empreinte." }
```

Vérifier aussi chaque fichier de `manifest.json`. `EXPORT_COMPLETE.json` doit être présent et `EXPORT_IN_PROGRESS.json` absent.

## 8. Sauvegarde restaurable de reprise

L’export d’audit précédent est volontairement assaini. Pour une reprise complète, utiliser l’outil distinct :

```powershell
npm run backup:firestore
```

Cette commande :

- lit chaque document une fois, y compris les sous-collections;
- conserve les types Firestore dans une enveloppe JSON portable;
- produit `documents.ndjson`, un résumé, un manifeste et leurs SHA-256;
- écrit d’abord `BACKUP_IN_PROGRESS.json`, puis `BACKUP_COMPLETE.json` seulement après succès;
- n’inclut jamais le fichier d’identifiants ni les variables d’environnement;
- crée toujours un nouveau dossier `sync-output/disaster-backup-...`, ignoré par Git.

Comme cette opération est un balayage complet facturable, elle doit être lancée délibérément, idéalement une fois par jour en période calme, jamais dans le cycle d’interface ou la synchronisation ordinaire.

## 9. Vérification et restauration

Une vérification locale sans écriture est le comportement par défaut :

```powershell
npm run restore:firestore -- --backup="sync-output\disaster-backup-..."
```

Le script refuse un fichier modifié, un manifeste incohérent, un nombre de documents différent ou un chemin Firestore invalide.

Pour un exercice dans l’Emulator :

```powershell
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
npm run restore:firestore -- --backup="sync-output\disaster-backup-..." --apply
npm run verify:restore -- --backup="sync-output\disaster-backup-..."
```

La seconde commande relit la cible Emulator et compare chaque document encodé à sa sauvegarde. Elle refuse de fonctionner contre la production.

Hors Emulator, l’écriture est refusée à moins de fournir simultanément `--apply`, `--allow-production`, le `--expected-project-id` exact et `--confirm-document-count` exact. Même avec ces confirmations, la restauration ne supprime aucun document absent de la sauvegarde. Elle est donc idempotente et adaptée d’abord à un projet vide de préproduction ou à une reprise contrôlée.

## 10. Politique de restauration

La restauration est volontairement absente de `admin_sync.js`. L’export assaini n’est pas restaurable tel quel.

1. Copier l’export hors de `sync-output` vers un emplacement privé et durable.
2. Vérifier `manifest.sha256` puis toutes les empreintes du manifeste.
3. Confirmer le `projectId`, `EXPORT_COMPLETE.json` et l’absence de marqueur incomplet.
4. Utiliser `backup_firestore.mjs`, qui conserve les sous-collections et les types, pour une vraie reprise.
5. Tester toute restauration dans l’Emulator ou un projet de préproduction distinct avant la production.
6. Après restauration, comparer les comptes de documents, les identifiants, les horodatages et un échantillon de commentaires, médias, décisions, tâches et archives.

Les sorties sont ignorées par Git, peuvent contenir des renseignements personnels et ne doivent jamais être publiées sur GitHub Pages. La clé de compte de service doit rester dans un emplacement local privé déjà exclu du dépôt.
