# Plan d’attaque 2026 — cockpit permanent

**Séquence initiale :** lundi 13 juillet au dimanche 9 août 2026, extensible sans limite fixe
**Statut :** proposition opérationnelle prête à présenter et à ajuster avec la direction générale  
**Livrable principal :** ouvrir `index.html` dans un navigateur.

**Cockpit de collaboration :** le sous-dossier `cockpit/` contient la version sécurisée et connectable à Firebase. Il ne contient aucun texte stratégique avant une connexion autorisée; consulter `cockpit/README_FIREBASE.md` avant toute mise en ligne.

**Textes finaux à programmer :** `TEXTES_COMPLETS_PUBLICATIONS_13_JUILLET_9_AOUT_2026.md` contient les 28 publications principales et six alternatives complètes. Les six journées à choix demandent une seule option cochée par la direction; le plan source `index.html` est synchronisé avec ce document, puis chargé de façon privée dans Firebase par `cockpit/seed_private_content.js`.

La synthèse `SYNTHESE_TRANSCRIPT_COORDINATION_DG_COMMUNICATIONS_2026-07-10.md` distingue les orientations claires du transcript vocal et les éléments qui doivent encore être vérifiés. Le cockpit intègre désormais le mode de collaboration, la priorité aux formats soutenables, la stratégie d’alliés et les garde-fous renforcés pour les sujets scientifiques, historiques, autochtones, environnementaux et financiers.

Le haut du cockpit commence par un « Lire-moi » repliable et un schéma du flux asynchrone. Le contexte stratégique peut être minimisé pour accéder directement au calendrier; chaque événement affiche maintenant les tâches respectives de Valentin et de la direction générale, avec un bouton d’ajout au calendrier qui adapte sa description au rôle connecté.

Le chemin de production est volontairement textuel et stable : aucun téléversement de fichier ou d’image n’est actif. Le thème clair/sombre est réglable à la volée et conservé uniquement sur l’appareil.

## Ce qui est nouveau

Ce dossier est une nouvelle itération autonome. Il ne remplace, ne modifie ni ne supprime les plans V1/V2, les calendriers, les rapports ou les visuels existants.

Le plan retient une cadence d’une publication principale par jour, mais l’encadre par une règle simple : **chaque publication doit être originale, utile, vérifiable et associée à une seule action mesurable.** La fréquence est évaluée chaque semaine à partir des résultats propres à Bleu Massawippi; elle n’est jamais une fin en soi.

## Pour l’utiliser lundi

1. Ouvrir `index.html`.
2. Présenter d’abord la section « Cap stratégique », puis le calendrier de la semaine 1.
3. Confirmer les contenus qui demandent une personne, une photo, une donnée ou une validation scientifique.
4. Utiliser les cases « prêt » et, lorsqu’elles existent, les cases « option choisie » pour piloter la production sans modifier le plan source.
5. Déposer un avis dans la boîte de rétroaction de la section ou dans la boîte à idées flottante; ces notes servent à préparer une nouvelle mouture sans modifier immédiatement le contenu institutionnel.
6. Pour préserver l’historique, considérer les suppressions comme virtuelles et utiliser les archives Firestore / Git avant toute réécriture; aucune action du cockpit ne supprime une ancienne version.

## Garde-fous essentiels

- Ne publier aucune donnée de suivi récente, aucun avis de vigilance, ni aucune affirmation réglementaire sans source et validation scientifique.
- Ne montrer une personne identifiable qu’avec son consentement de diffusion documenté; consentement parental requis pour les moins de 14 ans.
- Privilégier les photos/vidéos réelles de l’association et les licences explicitement vérifiées.
- Pour une éventuelle opération de concours photo : ne pas lancer avant règlement, budget, responsabilités, droits de réutilisation et validation de la direction. L’appel éditorial sans prix est l’option de départ recommandée.
- Conserver le ton : factuel, chaleureux, orienté solutions et jamais moralisateur.
- Rédiger le français comme un texte original, naturel et idiomatique pour le public québécois, puis adapter l’anglais de façon autonome. Les deux versions conservent les mêmes faits, la même promesse, le même appel à l’action, les mêmes nuances et les mêmes obligations, mais leur rythme, l’ordre des idées et leurs images peuvent différer. Ne jamais traduire phrase par phrase; relire chaque version séparément avant de vérifier leur équivalence.

Consulter `SOURCES_ET_GARDES_FOUS.md` pour les sources, les décisions de méthode et les références utiles.
