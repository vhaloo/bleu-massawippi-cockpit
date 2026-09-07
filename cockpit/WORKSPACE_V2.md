# Cockpit V2 — pilote à interface réversible

## Ouverture et retour

- Version habituelle : URL du cockpit sans paramètre.
- Pilote : ajouter `?interface=v2`.
- Routes : `#/accueil`, `#/publications`, `#/projets`, `#/bibliotheque`.
- Deux calendriers indépendants : `#/publications?vue=calendrier` et `#/projets?vue=calendrier`.
- Le lien « Version classique » retire le paramètre. Il ne restaure pas une ancienne base de données.

Les données sont partagées entre les interfaces. Un choix ou un commentaire fait dans le pilote est un vrai choix ou commentaire. Aucun envoi social ou courriel n’est ajouté.

## Architecture et préservation

La V2 est un adaptateur de présentation opt-in. Elle déplace les contrôles DOM d’origine, sans les cloner, et conserve leurs gestionnaires et identifiants. Les commandes Firestore existantes restent les seuls chemins d’écriture. Aucun registre éditorial n’est réinitialisé ou resynchronisé par cette refonte.

| Fonctions existantes | Où les retrouver |
| --- | --- |
| Tableau des décisions, messages, travail du jour | À faire; mêmes files et contrôles |
| Texte FR/EN, copie et édition | Fiche publication; bouton Studio pour l’administrateur |
| Toutes les propositions de médias | Galerie à vignettes; navigation indépendante du choix |
| Droits, origine, détails, commentaires d’image, retrait/override | Panneau de détails de chaque média |
| Ajout de liens médias et sélection multiple | Panneau Ajouter un média |
| Texte, média, publication : trois validations distinctes | Sous le texte et la galerie |
| Échanges et dictée | Section conversation d’origine |
| Choix d’angle, brief, marqueurs et avis rapides | Informations complémentaires dépliables |
| Publications passées, reportées ou archivées | Vues Passées et archives / À replanifier |
| Projets actifs, occasions, projets archivés | Projets, vues séparées |
| Calendrier des projets, échéances et exports | Calendrier des projets d’origine |
| Documents et liens SharePoint | Dossier d’origine + Bibliothèque |
| Contexte stratégique, production, pilotage et sources | Bibliothèque → Guides |
| Session, Studio, compte, diagnostic, préférences | Commandes de session existantes |
| Version classique et outils historiques | Retour explicite, disponible sur mobile aussi |

Les anciens textes ne sont pas inventés : l’historique montre les versions structurées disponibles dans `changeArchive` et le texte source conservé. Un ajustement ancien effectué avant le journal versionné peut ne pas posséder de trace avant/après. La consultation est paginée par 12; aucun listener historique permanent.

## Garde-fous

- Dates civiles réelles, tri stable, aucune modification automatique du planning par les filtres.
- Les contrôles de rôle restent ceux du cockpit. Le Studio n’est pas ouvert à la direction par cette V2.
- Les règles n’ouvrent à la direction que les archives de type `publicationContent`; les autres journaux administratifs restent privés.
- Une sauvegarde éditoriale est refusée si le workflow est programmé ou terminé, côté transaction et côté règles. Réouvrir explicitement le travail reste un acte distinct.
- Les textes et listes trop longs sont conservés dans le formulaire puis signalés, jamais coupés silencieusement.
- Avertissement avant fermeture/changement de dossier avec un brouillon Studio non enregistré.
- Les objets d’archives et médias de référence ne sont ni supprimés ni automatiquement approuvés.
- Données de test exclusivement synthétiques; les fichiers de démonstration et outils de développement ne sont pas copiés dans Pages.

## Outils et tests

`npm run test:workspace-v2` : modèle, dates, routes, galerie, identité des contrôles, conservation de saisie en navigation, historique, calendriers indépendants, archives, liens et retour classique.

`npm run preview:v2` : aperçu visuel local sur 127.0.0.1:8766, sans Firebase. Serveur avec liste d’assets autorisés; il n’expose ni configuration privée ni dossier de travail. Ce n’est pas un clone connecté de production.

`npm test` : suite complète existante et V2. Les suites de règles `test:editor-rules`, `test:media-rules` et `test:project-calendar-rules` nécessitent Java 21 et utilisent uniquement l’émulateur.

`manage_rules_release.mjs` : lit les règles actives avec une session Firebase CLI déjà autorisée, sauvegarde leur contenu et leur empreinte; compilation séparée, publication avec relecture et détection de changement concurrent. Aucun jeton ne doit être imprimé ni joint à une preuve.

## Limites explicites du pilote

Le pilote restructure l’accès aux fonctions existantes; il ne termine pas la migration de tous les contenus historiques HTML vers un éditeur structuré universel. Le Studio actuel couvre les publications; l’édition structurée intégrale des projets et documents reste un lot distinct de la refonte.

Les fenêtres de lecture Firestore historiques restent celles du cockpit. La bibliothèque des médias indique expressément le caractère partiel de son cache et renvoie aux dossiers pour charger leur contexte complet. Une future pagination globale doit être livrée avec ses propres tests.

La dictée est conservée avec son repli clavier. Elle dépend des capacités du navigateur; une émulation de taille mobile ne certifie ni Safari iOS ni un vrai appareil Android.

La matrice d’audit des 64 capacités reste le registre de suivi. Les tests du pilote prouvent les invariants et parcours couverts, pas une garantie absolue d’absence de tout défaut.

## Rollback

1. Revenir à la version classique : pas de migration, aucun retour en arrière des commentaires ou choix.
2. Pour retirer techniquement le pilote, revert du commit de livraison puis nouvelle version de shell/cache; ne jamais réimporter une vieille base.
3. Les règles antérieures sont sauvegardées avant publication. Si nécessaire, repointer uniquement la release `cloud.firestore` vers le ruleset archivé après vérification du contexte; aucune donnée n’est supprimée.
