# Cycle éditorial du cockpit — 28 juillet 2026

## Portée

Cycle borné réalisé à partir des commentaires, rétroactions et tâches actives du cockpit. Les lectures Firestore ont été incrémentales; aucune collection métier n’a été balayée intégralement et aucune donnée n’a été supprimée.

## Éléments intégrés

- Correction de la fiche sur les cyanobactéries : le protocole source ne demande ni sept sites ni deux visites quotidiennes. Le guide de reconnaissance, le guide terrain 2025, la synthèse partageable et les ressources officielles sont désormais distingués.
- Préparation d’une structure d’offre de service pour North Hatley et Ayer’s Cliff : niveaux de service, variables de prix, limites, responsabilités et décisions encore requises.
- Refonte de la fiche « Bilan de santé du lac » à partir des faits transmis par la direction : cadence réelle à confirmer, contrat et rapport final, répartition lac/tributaires, payeurs, livrables et trois scénarios d’équipe 2027.
- Veille scientifique sur les lésions cancéreuses chez la barbotte brune : aucune source primaire examinée ne documente le lac Massawippi, sans pour autant permettre d’affirmer qu’il est exempt. Les sources et la prochaine vérification sont consignées séparément.
- Explication Zeffy exacte et réutilisable en français et en anglais : la contribution suggérée par Zeffy est distincte du don, volontaire, modifiable et peut être ramenée à 0 $.
- Correction d’un débordement horizontal global de 5 px sur téléphone, sans retirer le balayage horizontal volontaire du menu.
- Ajout d’un outil de clôture des rétroactions de section : simulation obligatoire, validation de la section locale, contrôle de concurrence, transaction atomique et archive déterministe; aucune suppression.

## Deuxième lecture avant publication

La lecture incrémentale de sécurité a été menée jusqu’à une frontière complète le 28 juillet 2026. Aucun nouveau commentaire, aucune nouvelle rétroaction et aucune nouvelle tâche ne sont apparus depuis la première lecture. Les trois commentaires et les deux rétroactions déjà recensés correspondent exactement aux éléments traités ci-dessus.

## Vérifications

- Suite complète `npm test` : réussie.
- Contrat éditorial et fonctionnel : 100 contrôles réussis, 0 échec critique, 2 avertissements de taille déjà connus.
- Contrat de contenu : 62 publications bilingues, 494 contrôles réussis.
- Simulation de semis du contenu privé : 62 publications, état prêt, aucune écriture.
- Simulation de clôture : trois commentaires et deux rétroactions validés sans écriture.
- Inspection visuelle : bureau et téléphone 390 × 844 px; fiches lisibles, liens visibles et débordement horizontal global supprimé.

## Retour arrière

Point de départ : `2b170baf81e0e8a5dfee60f61096e4d3ef21f563`. Les corrections sont isolées dans la branche `agent/editorial-cycle-20260728`. Le contenu historique et les anciennes tâches demeurent conservés dans Firestore et dans les archives de changements.
