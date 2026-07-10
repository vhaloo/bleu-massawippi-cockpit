# Cockpit de collaboration stratégique — configuration Firebase

Le dossier contient une nouvelle copie interactive du plan. Le HTML de présentation situé au niveau supérieur n’est pas modifié par le cockpit.

## État livré

- index.html : coque publique sans contenu stratégique; elle affiche la barrière de connexion et ne charge le plan qu’après autorisation Firebase.
- firebase-client.js : SDK Web Firebase modulaire, version CDN 12.15.0, persistance IndexedDB, Auth et Firestore.
- cockpit-ui.js : couche d’interface et de pilotage, choix d’option par journée, rétroaction par section, boîte à idées flottante, dictée progressive Chrome / Edge / Safari et retour sur le mode de collaboration.
- admin_sync.js : pont local Firebase Admin pour lire les modifications du calendrier, les commentaires et les rétroactions du cockpit.
- seed_private_content.js : charge localement le plan, les 28 publications principales, les six alternatives et leurs états dans Firestore, après configuration du compte de service.
- ../refine_calendar.js : réorganise les dates pour éviter les répétitions voisines et génère les six journées à choix exclusif.
- provision_users.js : crée ou raccorde les deux comptes autorisés et leurs rôles, en lisant les adresses et mots de passe uniquement depuis des variables de session.
- firestore.rules : règles d’accès strictes, à publier et tester dans la console avant production.
- firebase-config.example.js : modèle de configuration publique.
- firebase-config.js : configuration publique de l’application Web, nécessaire au site GitHub Pages. Cette configuration identifie le projet; elle n’est pas une clé d’administration.
- firebase-config.local.js : ancien fichier local de compatibilité, ignoré par Git.
- SOURCES_ET_GARDES_FOUS.md : registre de sources et décisions éditoriales.

Pour vérifier la barrière locale, servez le dossier parent avec un serveur HTTP (un module JavaScript ne fonctionne pas de façon fiable en ouvrant directement le fichier `file://`). Exemple : depuis `Plan_d_attaque_Ete_2026_V2_strategique`, lancez `python -m http.server 8765`, puis ouvrez `http://127.0.0.1:8765/cockpit/index.html`. Le plan ne peut apparaître qu’après connexion Firebase autorisée.

## 1. Créer ou sélectionner le projet Firebase

Dans la console Firebase (https://console.firebase.google.com/), sélectionnez le projet de l’association ou créez-en un dédié au cockpit.

Activez ensuite :

1. Authentication → Sign-in method → Email/Password.
2. Firestore Database en mode production.
3. Les ressources statiques sont ajoutées et versionnées dans le dépôt GitHub Pages; aucune pièce jointe dynamique n’est téléversée depuis le navigateur.
4. Ajoutez votre domaine GitHub Pages dans Authentication → Settings → Authorized domains. Un domaine *.github.io doit utiliser HTTPS.

Enregistrez une application Web et copiez sa configuration dans firebase-config.js. La configuration Web est nécessairement visible côté navigateur; elle ne remplace pas les règles Firestore, qui constituent la barrière réelle.

## 2. Créer les comptes et les rôles

Créez les utilisateurs dans Authentication → Users avec les adresses professionnelles gérées par l’association. Ne codez pas le nom ni le mot de passe dans le HTML.

Dans Firestore, créez un document users/{uid} pour chaque compte :

    {
      "role": "director",
      "displayLabel": "Libellé d’affichage vérifié",
      "active": true
    }

Rôles acceptés :

- director : arbitrage du calendrier et commentaires.
- admin : mêmes droits + panneau de journal technique.
- viewer : lecture seule.

Le mot de passe générique proposé dans la directive n’est pas utilisé : un secret partagé serait trop facile à deviner et à réutiliser. Utilisez un mot de passe unique par compte et le mécanisme de réinitialisation Firebase. Seuls les comptes dont le document users/{uid} contient active: true peuvent accéder au cockpit.

Après avoir défini les variables de compte de service, le script de provisionnement peut créer les deux accès et leurs profils Firestore sans enregistrer les mots de passe dans un fichier :

    $env:COCKPIT_ADMIN_EMAIL="adresse du compte administrateur"
    $env:COCKPIT_ADMIN_PASSWORD="mot de passe unique de 16 caractères ou plus"
    $env:COCKPIT_DIRECTOR_EMAIL="adresse du compte direction"
    $env:COCKPIT_DIRECTOR_PASSWORD="mot de passe unique de 16 caractères ou plus"
    npm run provision-users

## 3. Générer la clé de synchronisation locale

La clé de compte de service ne doit pas être déposée dans le dossier du projet ni dans GitHub.

Dans Firebase :

1. Project settings → Service accounts.
2. Cliquez Generate new private key, puis confirmez.
3. Placez le JSON dans un emplacement privé, par exemple C:\Users\Vhaloo\Documents\Firebase\bleu-massawippi-service-account.json.
4. Dans PowerShell, avant une session de synchronisation :

    $env:GOOGLE_APPLICATION_CREDENTIALS="C:\Users\Vhaloo\Documents\Firebase\bleu-massawippi-service-account.json"
    $env:GOOGLE_CLOUD_PROJECT="identifiant-du-projet"

Cette procédure suit la documentation officielle Firebase Admin (https://firebase.google.com/docs/admin/setup). La clé donne des privilèges élevés : ne la transmettez pas dans le chat et ne la commitez jamais.

## 4. Installer et exécuter la synchronisation

Dans le dossier cockpit :

    npm install
    npm run sync -- --days=14

Options :

- --days=14 : fenêtre de changements à lire.
- --output=sync-output : destination locale du résumé et des fichiers, obligatoirement dans le dossier cockpit.

Le script lit :

- scheduleItems : statuts et suppressions virtuelles.
- comments : commentaires, badges et dictées.
- auditLogs : journal technique.
- cockpitFeedback : avis, recommandations et idées déposés depuis les sections ou la boîte à idées.

Le résumé de synchronisation est écrit dans sync-output/sync-summary.json, dossier ignoré par Git.

## 4.1 Charger le contenu sécurisé initial

Le plan détaillé n’est pas envoyé dans GitHub Pages. Après la publication des règles et la préparation du compte de service, chargez-le une fois dans Firestore :

    npm run seed -- --dry-run
    npm run seed

Le premier appel vérifie localement les 28 publications principales, les alternatives et la taille du document; le second écrit le contenu privé et met à jour les choix éditoriaux sans écraser les statuts déjà arbitrés.

## 5. Déployer sur GitHub Pages

Aucun dépôt GitHub ni identifiant de projet n’a été fourni, donc aucun déploiement externe n’est lancé automatiquement.

Pour publier le cockpit :

1. Copiez le contenu du dossier cockpit dans le dépôt GitHub Pages approuvé.
2. Ajoutez la configuration Web Firebase dans firebase-config.js; ne publiez jamais le compte de service.
3. Publiez la branche/dossier configuré par GitHub Pages.
4. Ajoutez l’URL https://<organisation>.github.io/<depot>/ aux domaines autorisés Firebase.
5. Testez la connexion, les règles Firestore, la dictée, les boîtes de rétroaction et la synchronisation locale avant de diffuser le lien.

Le fichier firebase.json est inclus pour publier uniquement les règles Firebase avec la CLI, sans héberger le site chez Firebase :

    npm install --global firebase-tools
    firebase login
    firebase use identifiant-du-projet
    firebase deploy --only firestore:rules

## Modèle de données Firestore

- users/{uid} : rôle et libellé d’affichage.
- privateContent/plan : HTML, styles et données du plan; lecture réservée aux comptes actifs.
- scheduleItems/{sectionId} : title, dateKey, status, deleted, selected, updatedAt, updatedBy. Les journées à choix partagent un groupe côté plan; une seule option est sélectionnée à la fois.
- comments/{commentId} : sectionId, comment, quickTag, dictated, authorUid, createdAt.
- auditLogs/{logId} : action, sectionId, userUid, userLabel, createdAt.
- cockpitFeedback/{feedbackId} : sectionId, message, category, page, authorUid, authorLabel, status, createdAt, updatedAt, updatedBy. La direction peut déposer une note; l’administration la classe dans le journal.

Le frontend crée un journal opérationnel append-only pour chaque statut, commentaire ou badge. Seuls les rôles director et admin peuvent l’écrire; seul admin peut le lire. Ce journal sert au pilotage humain, pas à fournir une preuve médico-légale : un journal infalsifiable nécessiterait une fonction serveur de confiance.

## Limites assumées

- Tant que firebase-config.js conserve REMPLACER, le cockpit reste bloqué sur la connexion et n’effectue aucune lecture distante.
- GitHub Pages ne protège jamais les fichiers statiques à elle seule : le plan détaillé est donc stocké dans privateContent/plan, dont les règles n’autorisent la lecture qu’aux comptes actifs.
- Le mode local ?demo=1 vérifie uniquement la barrière de connexion; aucun contenu stratégique ni aucune modification ne sont disponibles sans Firebase.
- La dictée utilise SpeechRecognition ou webkitSpeechRecognition quand le navigateur les expose, redémarre les sessions interrompues et affiche un repli explicite vers la dictée native du système lorsque Safari ou un autre navigateur ne fournit pas l’API. Aucun site web ne peut garantir une reconnaissance vocale programmatique si le navigateur la bloque.
- Les règles Firebase doivent être publiées puis testées avec les comptes director, admin et viewer avant une mise en ligne réelle.
