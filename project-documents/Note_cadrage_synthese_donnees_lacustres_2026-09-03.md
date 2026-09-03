# Massawippi en partage — réunir les données utiles, sans refaire l’Atlas

**Cadrage au 3 septembre 2026 · aucune production autorisée ou commencée.**

## La différence à démontrer

L’Atlas de l’eau reste une référence provinciale de connaissances et de cartes. Le projet local pourrait apporter une **synthèse bilingue, contextualisée et suivie** : réunir les informations pertinentes pour le lac et son bassin versant, montrer leur date et leurs limites, puis faciliter les vérifications et les actions locales.

La valeur n’est pas le nombre de couches affichées. Elle se mesure à la capacité de répondre plus clairement à quelques questions utiles : que sait-on, où, de quand date l’information et quel suivi convient?

Exemple exploratoire : rapprocher un épisode de pluie, une série de niveaux, une observation datée et une étude locale. Le rapprochement peut orienter une vérification; il ne démontre ni causalité, ni pollution, ni risque sanitaire.

## Sources concrètes à qualifier

| Source | Apport potentiel | Limite à vérifier |
|---|---|---|
| [Atlas de l’eau](https://www.environnement.gouv.qc.ca/eau/atlas/index.htm) et [catalogue Données Québec](https://www.donneesquebec.ca/recherche/showcase/atlas-de-l-eau) | Qualité, quantité, usages, pressions et contexte territorial | Vérifier chaque jeu sous-jacent : licence, couverture, format et date; les catalogues et les mesures n’ont pas une fréquence unique |
| [Exemple de données structurées : prélèvements d’eau](https://www.donneesquebec.ca/recherche/dataset/prelevements-eau) | Formats géographiques, tabulaires et services de données | Un exemple de réutilisation possible, pas la preuve que toutes les couches ou observations sont accessibles |
| [CEHQ — station Massawippi 030241](https://www.cehq.gouv.qc.ca/SUIVIHYDRO/tableau.asp?NoStation=030241&Secteur=nulle) | Niveau du lac et contexte hydrométrique | Données récentes préliminaires; accès automatisé, référentiel vertical, unités, fuseau et fréquence à qualifier |
| [ECCC — services de données](https://api.weather.gc.ca/?f=html) | Météo, climat, hydrométrie, données récentes et archives | Choisir les collections réellement utiles et leur couverture; documenter disponibilité et fréquence |
| Études et observations locales autorisées | Contexte du terrain, résultats historiques et suivi local | Méthode, qualité, consentement, droits de diffusion et responsable de validation |
| [Copernicus Sentinel-2](https://documentation.dataspace.copernicus.eu/Data/SentinelMissions/Sentinel2.html) | Images répétées pour un usage environnemental précisément défini | Résolution de 10, 20 ou 60 m selon les bandes; revisite de quelques jours, nuages et traitement : ce n’est pas une caméra en direct ni un diagnostic automatique |

Un service WMS peut fournir une image de carte sans fournir les observations structurées nécessaires aux calculs. Il faut vérifier les fichiers et interfaces effectivement disponibles, pas seulement l’apparence d’un portail.

## Organisation des données envisagée

**Sources → catalogue commun → contrôles de qualité → rapprochements temporels et géographiques → validation → vues publiques ou internes.**

Pour chaque observation : identifiant, source, licence, géométrie, précision, date observée, date publiée, date récupérée, unité, méthode et statut de validation. Garder la provenance et les versions; ne pas transformer des mesures de méthodes différentes en une série artificiellement comparable.

Les dates doivent être visibles. Une mesure d’aujourd’hui, une étude ancienne et une observation non validée ne doivent jamais avoir le même statut visuel. Une source indisponible ou ancienne n’est pas un signal rassurant. Les seuils de fraîcheur sont propres à chaque type de donnée.

Les rapprochements servent à explorer et à prioriser des vérifications. Une alerte, un diagnostic ou une recommandation sensible exige une méthode validée et un responsable compétent. Les services officiels conservent leur rôle.

## Première portée raisonnable

- Un lac et son bassin versant : Massawippi.
- Deux ou trois besoins précisément décrits.
- Trois à cinq sources fiables et réutilisables.
- Une synthèse bilingue, un historique et les limites visibles.
- Si le signalement est inclus : réception guidée, validation humaine, acheminement et retour de statut; aucune publication brute automatique.
- Les lacs voisins seulement après démonstration de la transférabilité et de la capacité de maintenance.

Le satellite vient plus tard, si un usage concret justifie l’expertise et les coûts de traitement. Tourisme, événements, contenus familiaux et boutiques d’applications restent des idées conservées, pas des fonctions indispensables au premier pilote.

## Ordre des étapes et portes de décision

1. **Définir les usages.** Quel public, quelle question, quelle décision et quelle fréquence?
2. **Qualifier les sources.** Droit de réutilisation, couverture, méthode, format, fraîcheur, disponibilité et coût.
3. **Décrire le modèle commun.** Provenance, temps, géographie, unités, versions et qualité.
4. **Dessiner les parcours.** Lecture publique, suivi interne, validation, correction et gestion d’une source indisponible.
5. **Évaluer un pilote limité.** Valeur mesurable, responsable du service, maintenance, financement et critères d’arrêt.
6. **Décider avant de produire.** Une simple copie de cartes ne justifie pas le développement. Toute production, dépense, prise de contact ou promesse nécessite une décision distincte.
7. **Étendre seulement après preuve.** Autres lacs, nouvelles sources ou télédétection selon les résultats du pilote.

Indicateurs à définir avec une valeur de départ : temps nécessaire pour retrouver une information fiable, compréhension de sa fraîcheur, qualité des dossiers transmis, délai de suivi et charge de maintenance. Les cibles ne sont pas encore fixées.

## Fil des idées conservé

- Carte vivante locale et bilingue : information et participation autour du lac.
- Signalements guidés, validation humaine, acheminement et suivi.
- LakePulse comme référence de parcours et avertissement sur l’ancienneté des données.
- Résumé Alpha du 17 août : sept livrables à inventorier; estimation d’avancement non assimilée à une preuve technique.
- Cahier fonctionnel annoncé les 19–20 août : source encore attendue dans le dossier consulté.
- ÉcoAction transmis le 2 septembre : préqualification d’un nouveau pilote transférable, sans dépôt ni financement acquis.
- Atlas transmis le 3 septembre : frontière claire contre le dédoublement.
- Complément du 3 septembre : synthèse de sources complémentaires, métadonnées communes, rapprochements utiles et fraîcheur explicite.

**Statut final : documentation de découverte.** Cette note précise une direction et sa faisabilité à qualifier; elle ne constitue pas une application, un prototype fonctionnel, un devis ni un engagement de livraison.
