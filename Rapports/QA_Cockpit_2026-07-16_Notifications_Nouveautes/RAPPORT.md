# Rapport de validation — Notifications de nouveautés et file personnelle

**Date locale :** 16 juillet 2026

**Branche de travail :** `agent/content-notices-sticky-queue-20260716`

**Base et retour arrière applicatif :** `6ff96450da9b54fb1d07a330d43bcc02f74e3918`

## Résultat

Le cockpit dispose maintenant d'un mécanisme durable pour signaler à la direction les nouveautés du contexte stratégique, des projets internes et des candidatures ou occasions. Ces avis sont des actions personnelles légères, sans estimation de durée, qui n'évincent pas une validation de publication réellement urgente.

- Le bouton **Voir la nouveauté** ouvre la bonne section, le bon projet interne ou la bonne occasion.
- La cible est dépliée, amenée dans la zone visible et mise en évidence pendant 1,8 seconde.
- L'avis n'est marqué comme vu qu'après 2,2 secondes de visibilité réelle dans un onglet actif.
- Une erreur réseau conserve l'avis dans la file et permet un nouvel essai.
- La version vue n'est jamais rouverte; une modification ultérieure exige une nouvelle version du manifeste.
- Seul le compte Direction reçoit et lit ces avis.

Sur ordinateur, la même file personnelle devient un panneau flottant à gauche après le passage du tableau initial. Elle revient à son emplacement normal lorsque l'on remonte, peut être réduite, mémorise cette préférence sur l'appareil et ne crée aucun abonnement Firestore supplémentaire. Sous 1 180 px, elle reste dans la mise en page normale.

## Nouveautés préparées pour la direction

1. Plan de partenariat 2026-2027 dans le contexte stratégique.
2. Projet interne « Fonds environnemental partenarial ».
3. Projet interne « Collaborations entre organismes de lacs ».

Chaque avis possède un identifiant versionné et une cible exacte. Leur initialisation est bornée, idempotente et n'effectue aucune réouverture d'un avis déjà vu.

## Consignes éditoriales traitées

- `s1d4` : nouvelle proposition « Mon Massawippi » sans ruban, avec une seule punaise centrale et le texte manuscrit déplacé au bas de l'image.
- `alt-20260719` : estampe de 1859 conservée fidèlement, sans bordure rouge ni réinvention de son texte imprimé.
- `s1d6` : ouverture française corrigée en « Prendre un instant… » et photographie réelle de la soirée d'automne préparée comme proposition.
- Enregistrement des commentaires média rendu plus robuste : le commentaire reste sauvegardé même si la création de la tâche de suivi échoue ensuite.

Les originaux et les versions précédentes sont conservés. Les trois nouveaux médias ont été copiés dans SharePoint, leurs permissions anonymes de consultation ont été vérifiées et leur téléchargement retourne un JPEG réel en HTTP 200.

## Coût de lecture observé avant publication

- Première synchronisation incrémentale : 41 lectures documentaires estimées.
- Vérifications média ciblées : 17 lectures.
- Deuxième synchronisation incrémentale : 14 lectures, zéro document nouveau.
- Ultime synchronisation juste avant publication : 14 lectures, zéro document nouveau.
- Total de préparation : 86 lectures documentaires estimées.
- Aucun balayage complet et aucun listener supplémentaire ajouté.

## Vérifications automatisées

`npm --prefix cockpit test` : réussi.

- 484 contrôles métier.
- 81 contrôles qualité réussis.
- 0 échec critique.
- 3 vigilances générales non bloquantes déjà connues : protection explicite du débordement, taille du module UI et taille de la source privée.
- Contrats dédiés réussis : rôle, pagination, navigation « Ouvrir », notifications vues, mode mobile, PWA, cache, hors-ligne, médias, commentaires, idempotence et service worker `20260716-b18` / cache `v56`.

## Recette visuelle locale

- Session Direction authentifiée.
- Ordinateur : file flottante visible à gauche après défilement, réductible et sans chevauchement avec la boîte à idées.
- Mobile : panneau flottant désactivé, file normale conservée, aucun débordement horizontal.
- Modes clair et sombre inspectés.
- Aucune erreur ni alerte dans la console du navigateur.

Captures :

- `Rapports/Preuves/2026-07-16-notifications-annie-desktop-sombre.png`
- `Rapports/Preuves/2026-07-16-notifications-annie-desktop-clair.png`
- `Rapports/Preuves/2026-07-16-notifications-annie-mobile.png`

## Déploiement et synchronisation

À compléter après la publication contrôlée et la vérification de la production. La synchronisation Firestore doit rester ciblée : contenu privé, trois médias, trois avis versionnés, puis résolution atomique des quatre commentaires déjà traités.
