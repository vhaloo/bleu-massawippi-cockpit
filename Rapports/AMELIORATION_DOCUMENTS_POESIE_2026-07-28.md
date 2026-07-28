# Projet « Au bord du bleu » — bibliothèque documentaire

Date : 28 juillet 2026

Portée : présentation des documents du projet interne de poésie

Point de retour avant intervention : `3f12ce0f714e7ac09f207b76f690a2f8b45766e1`

## Résultat

- L’ancien aide-mémoire détaillé intégré dans la fiche du projet a été remplacé par un PDF autonome d’une page.
- Les dix ressources du projet sont maintenant présentées sous forme de cartes homogènes.
- Chaque carte indique le type de ressource, son utilité, puis une action d’ouverture explicite.
- Le lien profond historique `poesie-rencontre-north-hatley-2026-08-10` est conservé sur la nouvelle carte afin d’éviter une cible orpheline.
- Les documents SharePoint demeurent à leur emplacement versionné; aucune ressource existante n’a été supprimée.

## Nouveau document

`cockpit/project-documents/Aide_memoire_rencontre_North_Hatley_Au_bord_du_bleu_2026-08-10.pdf`

- Format : lettre US, portrait, une page.
- Taille vérifiée : 92 568 octets.
- Contenu : objectif, lieu et autorité, horaire et logistique, météo et décision, collaboration et visibilité, puis décisions à consigner avant de quitter la rencontre.
- Génération reproductible : deux exécutions successives ont produit le même SHA-256.

## Vérifications

- PDF : une page, contenu textuel extractible, aucune section manquante, inspection visuelle sans chevauchement ni coupe.
- Contrat de contenu : 499 contrôles réussis.
- Suite complète : 100 contrôles qualité réussis, aucun échec critique.
- Ordinateur (1 440 × 900) : grille de deux colonnes, dix cartes, aucune image cassée, aucun débordement horizontal.
- Téléphone (390 × 844) : grille d’une colonne, boutons d’au moins 44 px, aucun débordement horizontal.
- Console du navigateur : aucune erreur ni alerte pendant le contrôle ciblé.

Les deux avertissements non bloquants de la suite complète concernent la taille déjà connue du module d’interface et de la source privée. Ils ne sont pas causés par cette modification.

## Retour arrière

Avant fusion, abandonner la branche `agent/poetry-documents-20260728`. Après fusion, revenir au point `3f12ce0f714e7ac09f207b76f690a2f8b45766e1` par un revert Git non destructif; ne supprimer ni document SharePoint ni donnée Firestore.
