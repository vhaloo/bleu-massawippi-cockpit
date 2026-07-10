# Cockpit de collaboration stratégique — configuration Firebase

Le dossier contient une nouvelle copie interactive du plan. Le HTML de présentation situé au niveau supérieur n’est pas modifié par le cockpit.

## État livré

- index.html : plan institutionnel avec barrière de connexion, barre de session, statuts Firestore, suppression virtuelle, commentaires, dictée vocale, dépôt de fichiers et journal administrateur.
- firebase-client.js : SDK Web Firebase modulaire, version CDN 12.15.0, persistance IndexedDB, Auth, Firestore et Storage.
- cockpit-ui.js : couche d’interface et de pilotage.
- admin_sync.js : pont local Firebase Admin pour lire les modifications et télécharger les pièces jointes.
- firestore.rules et storage.rules : règles d’accès strictes, à publier et tester dans la console avant production.
- firebase-config.example.js : modèle de configuration publique.
- firebase-config.js : configuration publique de l’application Web, nécessaire au site GitHub Pages. Cette configuration identifie le projet; elle n’est pas une clé d’administration.
- firebase-config.local.js : ancien fichier local de compatibilité, ignoré par Git.
- SOURCES_ET_GARDES_FOUS.md : registre de sources et décisions éditoriales.

Pour un aperçu local, servez le dossier parent avec un serveur HTTP (un module JavaScript ne fonctionne pas de façon fiable en ouvrant directement le fichier `file://`). Exemple : depuis `Plan_d_attaque_Ete_2026_V2_strategique`, lancez `python -m http.server 8765`, puis ouvrez `http://127.0.0.1:8765/cockpit/index.html?demo=1`. Le paramètre `demo=1` garde l’interface en lecture seule.

## 1. Créer ou sélectionner le projet Firebase

Dans la console Firebase (https://console.firebase.google.com/), sélectionnez le projet de l’association ou créez-en un dédié au cockpit.

Activez ensuite :

1. Authentication → Sign-in method → Email/Password.
2. Firestore Database en mode production.
3. Storage avec les règles du fichier storage.rules.
4. Ajoutez votre domaine GitHub Pages dans Authentication → Settings → Authorized domains. Un domaine *.github.io doit utiliser HTTPS.

Enregistrez une application Web et copiez sa configuration dans firebase-config.js. La configuration Web est nécessairement visible côté navigateur; elle ne remplace pas les règles Firestore/Storage, qui constituent la barrière réelle.

## 2. Créer les comptes et les rôles

Créez les utilisateurs dans Authentication → Users avec les adresses professionnelles gérées par l’association. Ne codez pas le nom ni le mot de passe dans le HTML.

Dans Firestore, créez un document users/{uid} pour chaque compte :

    {
      "role": "director",
      "displayLabel": "Libellé d’affichage vérifié",
      "active": true
    }

Rôles acceptés :

- director : arbitrage du calendrier, commentaires et pièces jointes.
- admin : mêmes droits + panneau de journal technique.
- viewer : lecture seule.

Le mot de passe générique proposé dans la directive n’est pas utilisé : un secret partagé serait trop facile à deviner et à réutiliser. Utilisez un mot de passe unique par compte et le mécanisme de réinitialisation Firebase. Seuls les comptes dont le document users/{uid} contient active: true peuvent accéder au cockpit.

## 3. Générer la clé de synchronisation locale

La clé de compte de service ne doit pas être déposée dans le dossier du projet ni dans GitHub.

Dans Firebase :

1. Project settings → Service accounts.
2. Cliquez Generate new private key, puis confirmez.
3. Placez le JSON dans un emplacement privé, par exemple C:\Users\Vhaloo\Documents\Firebase\bleu-massawippi-service-account.json.
4. Dans PowerShell, avant une session de synchronisation :

    $env:GOOGLE_APPLICATION_CREDENTIALS="C:\Users\Vhaloo\Documents\Firebase\bleu-massawippi-service-account.json"
    $env:GOOGLE_CLOUD_PROJECT="identifiant-du-projet"
    $env:FIREBASE_STORAGE_BUCKET="identifiant-du-projet.firebasestorage.app"

Cette procédure suit la documentation officielle Firebase Admin (https://firebase.google.com/docs/admin/setup). La clé donne des privilèges élevés : ne la transmettez pas dans le chat et ne la commitez jamais.

## 4. Installer et exécuter la synchronisation

Dans le dossier cockpit :

    npm install
    npm run sync -- --days=14

Options :

- --days=14 : fenêtre de changements à lire.
- --output=sync-output : destination locale du résumé et des fichiers, obligatoirement dans le dossier cockpit.
- --no-download=true : lire les pièces jointes sans les télécharger.

Le script lit :

- scheduleItems : statuts et suppressions virtuelles.
- comments : commentaires, badges et dictées.
- auditLogs : journal technique.
- attachments : pièces dont downloaded_locally vaut false.

Après un téléchargement réussi, il marque la pièce jointe downloaded_locally: true. Le résumé est écrit dans sync-output/sync-summary.json, dossier ignoré par Git.

## 5. Déployer sur GitHub Pages

Aucun dépôt GitHub ni identifiant de projet n’a été fourni, donc aucun déploiement externe n’est lancé automatiquement.

Pour publier le cockpit :

1. Copiez le contenu du dossier cockpit dans le dépôt GitHub Pages approuvé.
2. Ajoutez la configuration Web Firebase dans firebase-config.js; ne publiez jamais le compte de service.
3. Publiez la branche/dossier configuré par GitHub Pages.
4. Ajoutez l’URL https://<organisation>.github.io/<depot>/ aux domaines autorisés Firebase.
5. Testez la connexion, les règles Firestore, la dictée, le dépôt de fichier et la synchronisation locale avant de diffuser le lien.

Le fichier firebase.json est inclus pour publier uniquement les règles Firebase avec la CLI, sans héberger le site chez Firebase :

    npm install --global firebase-tools
    firebase login
    firebase use identifiant-du-projet
    firebase deploy --only firestore:rules,storage

## Modèle de données Firestore

- users/{uid} : rôle et libellé d’affichage.
- scheduleItems/{sectionId} : title, dateKey, status, deleted, updatedAt, updatedBy.
- comments/{commentId} : sectionId, comment, quickTag, dictated, authorUid, createdAt.
- attachments/{attachmentId} : sectionId, storagePath, fileName, contentType, size, downloaded_locally, authorUid, createdAt; le script local ajoute downloadedAt et downloadedBy après une récupération réussie.
- auditLogs/{logId} : action, sectionId, userUid, userLabel, createdAt.

Le frontend crée un journal opérationnel append-only pour chaque statut, commentaire, badge ou pièce jointe. Seuls les rôles director et admin peuvent l’écrire; seul admin peut le lire. Ce journal sert au pilotage humain, pas à fournir une preuve médico-légale : un journal infalsifiable nécessiterait une fonction serveur de confiance.

## Limites assumées

- Tant que firebase-config.js conserve REMPLACER, le cockpit reste bloqué sur la connexion et n’effectue aucune lecture distante.
- Le mode local ?demo=1 permet seulement de vérifier l’interface; aucune modification n’est envoyée à Firebase.
- La dictée repose sur webkitSpeechRecognition/SpeechRecognition; Chrome est le navigateur recommandé.
- Les règles Firebase doivent être publiées puis testées avec les comptes director, admin et viewer avant une mise en ligne réelle.
