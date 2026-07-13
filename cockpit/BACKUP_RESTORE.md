# Export d’audit Firestore du cockpit

Le script `admin_sync.js` offre deux modes distincts et non destructifs :

- `node admin_sync.js --days=14` produit le résumé opérationnel habituel dans `sync-output/sync-summary.json`;
- `node admin_sync.js --audit-export` crée un export logique assaini dans un **nouveau dossier horodaté** sous `sync-output/` (`--full` est conservé comme alias historique).

Cet export n’est **pas** une sauvegarde de reprise après sinistre : il ne parcourt pas les sous-collections et retire les champs qui ressemblent à des secrets. La conservation du code et la restauration Firestore sont donc deux sujets distincts.

La commande `node admin_sync.js --help` fonctionne sans clé Firebase et rappelle les options disponibles.

## Créer un export d’audit

Dans PowerShell, depuis le dossier `cockpit` :

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\chemin\local\compte-de-service.json"
node admin_sync.js --audit-export
```

La clé doit rester dans un emplacement local privé, idéalement `cockpit/secrets/`, déjà exclu de Git. Elle n'est ni copiée dans l’export ni affichée par le script. Les sorties peuvent néanmoins contenir des renseignements personnels : ne lancez la commande que vers un disque privé, protégé par le compte Windows et BitLocker, puis déplacez l’export hors du dossier de projet.

Chaque exécution crée un dossier du type :

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

Le script exporte les collections métier connues et toute autre collection de premier niveau découverte. Il ne parcourt pas les sous-collections. Les dates, références, coordonnées géographiques et données binaires sont encodées avec un marqueur `__firestoreType`. Les champs dont le nom indique explicitement un mot de passe, une clé privée ou un jeton sont remplacés par `[REDACTED]` et recensés dans le résumé.

## Vérifier l'intégrité

`manifest.json` contient le chemin relatif, la taille et l'empreinte SHA-256 de chaque fichier de données et du résumé. `manifest.sha256` contient l'empreinte du manifeste lui-même.

Exemple de vérification du manifeste dans PowerShell :

```powershell
$backup = "sync-output\backup-20260712T203000Z"
$expected = (Get-Content "$backup\manifest.sha256" -Raw).Split()[0]
$actual = (Get-FileHash "$backup\manifest.json" -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actual -ne $expected) { throw "Le manifeste ne correspond pas à son empreinte." }
```

Avant d'utiliser un export, vérifier aussi chaque fichier listé dans `manifest.json` avec `Get-FileHash`. La présence de `EXPORT_COMPLETE.json` et l’absence de `EXPORT_IN_PROGRESS.json` sont obligatoires; un arrêt brutal laisse volontairement le marqueur « en cours » en place.

## Politique de restauration

La restauration est volontairement **absente du script courant**. Cet export assaini n’est pas restaurable tel quel et ne doit pas être présenté comme tel.

Procédure recommandée :

1. Copier le dossier d’export hors de `sync-output` vers un emplacement privé et durable.
2. Vérifier `manifest.sha256`, puis toutes les empreintes de `manifest.json`.
3. Lire `backup-summary.json`, confirmer le bon `projectId`, la présence de `EXPORT_COMPLETE.json` et l’absence de marqueur « en cours » ou « incomplet ».
4. Pour une vraie reprise, utiliser une sauvegarde Firestore gérée qui inclut sous-collections et types natifs, stockée dans un emplacement privé chiffré.
5. Tester toute procédure de restauration dans un projet Firebase de préproduction distinct.

Les dossiers d’export sont ignorés par Git. Ils peuvent contenir des données privées du cockpit et ne doivent jamais être publiés sur GitHub Pages.
