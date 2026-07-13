# Matrice de non-régression — Cockpit Communication Bleu Massawippi

Version de référence : 2026-07-12

Portée : application GitHub Pages, Firebase Auth/Firestore, médias OneDrive/SharePoint et PWA.
Règle : **aucune fonction existante ne disparaît**. La Vue essentielle réduit le bruit; la Vue complète conserve toute la profondeur. Les deux vues manipulent les mêmes données et respectent les mêmes permissions Firebase.

## 1. Rôles, vues et appareils

| Code | Profil | Droits attendus |
|---|---|---|
| DG | Direction générale (`director`) | Lire, commenter, arbitrer, approuver/retirer une approbation, choisir un média, suivre les projets et déposer une rétroaction. Aucun journal technique. |
| COM | Communications (`admin`) | Tous les droits éditoriaux, les trois feux verts avec aval, tâches, journal, rétroactions, outils de diagnostic et restauration logique. |
| LEC | Lecture (`viewer`) | Lire le contenu autorisé; tous les contrôles de mutation sont absents ou désactivés. |

| Code | Vue | Contrat |
|---|---|---|
| ESS | Essentielle | Défaut DG. Montre Aujourd’hui, mes décisions, les sept prochains jours, messages et une seule action principale par carte. |
| CPL | Complète | Défaut COM. Ajoute métadonnées, sources, responsabilités des deux rôles, médias détaillés, archives et outils administratifs. |

| Code | Appareil | Largeur de recette | Attente principale |
|---|---|---:|---|
| MOB-S | Petit téléphone | 320 × 568 | Aucun défilement horizontal; cibles tactiles confortables; commandes essentielles visibles. |
| MOB | Téléphone | 390 × 844 | Barre mobile, cartes en une colonne, médias lisibles et clavier logiciel sans perte de saisie. |
| TAB | Tablette | 768 × 1024 | Mise en page intermédiaire sans chevauchement ni commandes microscopiques. |
| DESK | Ordinateur | 1440 × 900 | Navigation fixe, contenu centré, panneaux latéraux sans masquer le travail. |
| PWA | Application installée | MOB + DESK | Démarrage autonome, mise à jour sûre du service worker, retour réseau explicite. |

## 2. Parcours critiques avant chaque publication

Exécuter au minimum ce noyau sur le **projet Firebase de test**, jamais en improvisant des données de recette dans la production.

| ID | Parcours | Profil / vue / appareil | Étapes minimales | Résultat attendu |
|---|---|---|---|---|
| P-01 | Connexion DG | DG / ESS / MOB | Se connecter, attendre le profil, fermer puis rouvrir l’app | Session restaurée; vue essentielle mémorisée; aucune attente infinie. |
| P-02 | Connexion COM | COM / CPL / DESK | Se connecter puis ouvrir le panneau admin | Tâches, journal et rétroactions visibles uniquement à COM. |
| P-03 | Compte inactif | LEC inactif / DESK | Authentification valide mais profil `active:false` | Aucun contenu privé; message clair; déconnexion possible. |
| P-04 | Arbitrage | DG / ESS / MOB | Retenir l’option A, passer B à « autre jour », actualiser | Décisions persistées, historisées et identiques dans CPL. |
| P-05 | Texte | DG puis COM / ESS / MOB | Approuver le texte, retirer l’approbation, demander une correction | Chaque transition est réversible; auteur et heure restent auditables. |
| P-06 | Média | COM puis DG / CPL→ESS / MOB | Ajouter un lien, ouvrir l’aperçu, choisir le média, retirer le choix | Aperçu visible; détails repliés; choix persistant et réversible; aucun fichier envoyé à Firebase Storage. |
| P-07 | Publication | COM / ESS / MOB | Valider texte, média, puis programmer/publier | Les étapes restent ordonnées; l’événement du jour ne disparaît pas. |
| P-08 | Mini-chat | DG puis COM / ESS / MOB | Dicter/écrire, modifier, traiter, rouvrir et archiver son message | Temps réel, attribution claire, historique conservé; un auteur ne modifie que son message. |
| P-09 | Tâche | DG puis COM / ESS / DESK | Créer une consigne; COM l’ouvre et la complète | Compteur mis à jour; lien vers la cible; disparition seulement après traitement autorisé. |
| P-10 | Occasion | DG / ESS / MOB | Passer de Repéré à Recherche puis revenir | Étape persistée, réversible et historisée; dossier détaillé toujours disponible en CPL. |
| P-11 | Hors ligne | DG / ESS / PWA | Couper le réseau après chargement, naviguer, le rétablir | Coque lisible; aucune fausse confirmation d’écriture; resynchronisation explicite. |
| P-12 | Mise à jour PWA | DG / ESS / PWA | Ouvrir une ancienne version puis publier un nouveau cache | Activation sans écran blanc; anciens caches purgés; nouvelle version après rechargement contrôlé. |

## 3. Matrice fonctionnelle exhaustive

Légende : **E** = directement exposé en Vue essentielle; **C** = Vue complète; **A** = réservé aux communications; **L** = lecture seule; **—** = volontairement absent. Toute ligne doit être testée au moins sur MOB et DESK, sauf précision.

| ID | Fonction à préserver | DG ESS | DG CPL | COM ESS | COM CPL | LEC | Appareils / points de contrôle |
|---|---|:---:|:---:|:---:|:---:|:---:|---|
| F-001 | Barrière Firebase, état Connexion…, erreur et délai maximal | E | E | E | E | E | MOB-S/MOB/DESK; aucun spinner infini |
| F-002 | Réinitialisation du mot de passe et déconnexion | E | E | E | E | E | Clavier, tactile et souris |
| F-003 | Nom de session, rôle et état actif | E | E | E | E | E | Aucun nom dans le corps institutionnel |
| F-004 | Choix ESS/CPL mémorisé par utilisateur | E | E | E | E | E | Changement instantané sans perte de saisie |
| F-005 | Défaut ESS pour DG et CPL pour COM | E | C | E | C | L | Nouvelle session et appareil déjà connu |
| F-006 | Mode clair/sombre et préférence système | E | E | E | E | E | Contraste AA, logo, boutons, formulaires |
| F-007 | Installation PWA et conseil masquable | E | E | E | E | E | Chrome/Edge; repli élégant sur Safari |
| F-008 | Navigation principale et retour au contenu | E | E | E | E | E | Navigation clavier; sommaire mobile compact |
| F-009 | Lire-moi/collaboration repliable, préférence et badge Nouveauté | E | C | E | C | L | Badge réapparaît au changement de version |
| F-010 | Cap, cadence, validation, production, pilotage et sources | Résumé | C | Résumé | C | L | Tous les contenus restent accessibles |
| F-011 | Rétroaction de section avec dictée lorsque pertinente | E | E | E | E | — | Message non vide, attribution et confirmation |
| F-012 | Boîte à idées globale | E | E | E | E | — | Widget n’obstrue pas les actions mobiles |
| F-013 | Accueil Aujourd’hui et « Tout est à jour » | E | C | E | C | L | Calculé selon rôle; aucune fausse urgence |
| F-014 | Inbox « Mes décisions / Ma production » | E | C | E | C | — | Compteur, tri, lien profond, non-lu |
| F-015 | Calendrier aujourd’hui + futur par défaut | E | E | E | E | L | Dates `America/Toronto`; jour courant conservé |
| F-016 | Consultation des publications passées | E | E | E | E | L | Rien n’est supprimé; chargement/pagination |
| F-017 | Recherche, filtres semaine/thème et réinitialisation | E | E | E | E | L | Libellés accessibles; état cohérent |
| F-018 | Ascenseur de dates et navigation directe | E | E | E | E | L | Repli mobile; date active correcte |
| F-019 | Cartes fermées : titre, progression, responsable, prochaine action | E | E | E | E | L | Une action principale; pas de surcharge |
| F-020 | Brief complet bilingue FR/EN et copie | Sur demande | C | Sur demande | C | L | Pas de texte tronqué; presse-papiers et repli |
| F-021 | Responsabilités DG/COM séparées | Mes tâches | C | Mes tâches | C | L | Aucune tâche attribuée à la mauvaise personne |
| F-022 | Ajout ICS individuel adapté au rôle | E | E | E | E | L | Date, heure, lieu, coût, description, tâches |
| F-023 | Choix unique, multiple ou contenu confirmé par jour | E | E | E | E | L | Aucun choix concurrent involontaire |
| F-024 | Décision Retenue / À reprogrammer / Angle écarté | E | E | E | E | L | Motif conservé; réserve consultable |
| F-025 | Statut Approuvé / À retravailler / En attente | E | E | E | E | L | Revenir en arrière; audit écrit |
| F-026 | Suppression virtuelle / restauration | Sur demande | E | Sur demande | E | L | Jamais de suppression physique frontend |
| F-027 | Feu vert texte réversible | E | E | E avec aval | E avec aval | L | Auteur/heure visibles; correction possible |
| F-028 | Feu vert média réversible | E | E | E avec aval | E avec aval | L | Bloqué ou averti si droits non confirmés |
| F-029 | Programmé / Publié / Annulé / terminé | E | E | E | E | L | L’événement futur reste affiché |
| F-030 | Facebook et Instagram par défaut; LinkedIn facultatif | E | E | E | E | L | Canaux persistés séparément |
| F-031 | Mini-chat temps réel | E | E | E | E | — | Ordre chronologique et dernier message près du champ |
| F-032 | Dictée Web Speech + repli clavier | E | E | E | E | — | Chrome/Edge; Safari affiche une alternative claire |
| F-033 | Modification/archivage de son commentaire | E | E | E | E | — | Refus d’éditer le commentaire d’autrui |
| F-034 | Traiter/réouvrir et afficher les messages traités | E | E | E | E | — | Archives accessibles; tâche synchronisée |
| F-035 | Aperçus médias réels et ouverture nouvelle fenêtre | E | E | E | E | L | MOB/MOB-S; `object-fit:contain`; texte alternatif |
| F-036 | Galerie, flèches, glissement et position | E | E | E | E | L | 1, 2 et 5 médias; tactile et clavier |
| F-037 | Informations/actions média repliées sous l’aperçu | E | E | E | E | L | Aperçu reste visible; état « Retenu » visible fermé |
| F-038 | Lien source OneDrive/SharePoint | E | E | E | E | L | `noopener noreferrer`; panne externe tolérée |
| F-039 | Ajouter un lien média | — | E | — | E | — | URL validée; type, étape, note; aucun upload Firebase |
| F-040 | Choisir/retirer un média final | E | E | E | E | L | Plus récent lisible; sélection persistée |
| F-041 | Commenter un média et archiver son lien | E | E | E | E | — | Archivage logique; média source non supprimé |
| F-042 | Avertissement droits/consentement | E | E | E | E | L | Feu final protégé; dérogation explicite si prévue |
| F-043 | Registre projets repliable, préférence et badge Nouveauté | E | C | E | C | L | Masqué au démarrage après lecture |
| F-044 | Huit occasions existantes et leurs sources officielles | Résumé | C | Résumé | C | L | Aucun dossier ni lien perdu |
| F-045 | Pipeline Repéré → Recherche → Préparation → Déposé → Archivé | E | E | E | E | L | Étape réversible et historisée |
| F-046 | Participation photo, règles, décisions et tâches | Résumé | C | Résumé | C | L | Consentement, droits, bilinguisme |
| F-047 | Panneau tâches COM, compteur et lien vers la cible | — | — | E | A | — | Fixe sans masquer contenu; état vide explicite |
| F-048 | Forçage « complétée » autorisé | — | — | E | A | — | Audit et restauration logique |
| F-049 | Journal chronologique et diagnostic | — | — | — | A | — | Aucune donnée secrète; panneau minimisable |
| F-050 | Traitement des rétroactions cockpit | — | — | — | A | — | Ouvert → En cours → Traité |
| F-051 | Synchronisation Firestore en temps réel | E | E | E | E | L | Deux navigateurs; pas de double écoute après reconnexion |
| F-052 | Historique `changeArchive` avant/après | L | L | L | A | — | Toute mutation métier importante est retrouvable |
| F-053 | États d’erreur Firebase/OneDrive/microphone/réseau | E | E | E | E | E | Message humain, action de reprise, aucune donnée perdue |
| F-054 | Aucun secret privé ni mot de passe dans GitHub Pages | E | E | E | E | E | Scan dépôt + historique avant publication |
| F-055 | Règles Firestore par rôle et absence de suppression physique | E | E | E | E | E | Tests Emulator Suite positifs et négatifs |
| F-056 | Registre distinct des projets internes | E | C | E | C | L | Aucun mélange avec les huit occasions externes |
| F-057 | Pipeline À cadrer → Plan prêt → En cours → Bloqué → Terminé | E | E | E | E | L | Étape réversible, temps réel et historisée |
| F-058 | Projet interne terminé classé sans suppression | E | E | E | E | L | Archives consultables; retour à une étape active possible |
| F-059 | Documents de projet reliés à SharePoint | E | E | E | E | L | Liens HTTPS, `noopener noreferrer`, aucun fichier dans Firestore |
| F-060 | Résumé local des occasions et projets internes | — | — | — | A | — | `admin_sync.js` restitue les deux collections et leurs auteurs/dates |

## 4. Tests transversaux obligatoires

### Accessibilité

- Navigation complète au clavier, ordre de focus logique et focus visible.
- Lien « Aller au contenu », titres hiérarchisés, régions nommées et champs avec libellé accessible.
- `aria-live` limité aux statuts brefs : connexion, dictée, sauvegarde et erreurs. Ne jamais annoncer tout le `<main>` lors d’un rendu.
- Zoom navigateur 200 %, reflow 320 px et aucune information transmise uniquement par couleur.
- Cibles tactiles de 44 × 44 px visées; minimum absolu 24 × 24 px avec espacement.
- `prefers-reduced-motion` neutralise pulsations et défilements animés non essentiels.
- Chaque image informative a un texte alternatif utile; les décorations ont `alt=""` ou `aria-hidden="true"`.

### Sécurité et confidentialité

- Aucun compte de service, clé privée, jeton, mot de passe ou clé Gemini/OpenAI dans un fichier suivi.
- La clé Web Firebase publique est limitée au fichier de configuration client et restreinte côté Google Cloud.
- Les comptes inactifs ne lisent aucun contenu privé; `viewer` ne peut écrire nulle part.
- Les règles refusent toutes les suppressions physiques et n’acceptent que les champs attendus.
- Les liens externes ouverts dans un nouvel onglet utilisent `noopener noreferrer`.
- Les commentaires, tâches, médias et décisions valident longueur, type, auteur et rôle côté règles, pas seulement dans l’interface.

### Performance et robustesse

- Ne rendre initialement qu’Aujourd’hui et la fenêtre utile; monter le brief détaillé à l’ouverture.
- Requêtes Firestore bornées, paginées et désabonnées lorsque la vue disparaît.
- Aucun rafraîchissement complet pour une modification isolée; aucune multiplication de listeners après rerendu.
- Service worker versionné, réseau d’abord, ancien cache purgé et repli vers la coque seulement pour une navigation.
- Budget cible : INP < 200 ms, aucune erreur console sur parcours critique, aucun écran blanc après mise à jour.
- Les saisies non envoyées survivent à un changement ESS/CPL et à la fermeture accidentelle d’un volet.

## 5. Protocole de recette

1. Lancer les contrôles statiques : `node cockpit/test_quality_contract.mjs` depuis la racine.
2. Lancer le contrat métier existant : `cd cockpit && npm run check && npm run test:contract`.
3. Tester les règles dans Firebase Emulator Suite avec DG, COM, LEC actif et compte inactif.
4. Exécuter P-01 à P-12 dans l’environnement de préproduction.
5. Vérifier MOB-S, MOB, TAB et DESK en modes clair et sombre.
6. Vérifier Chrome et Edge; vérifier Safari pour lecture, authentification, commentaires et repli sans dictée.
7. Sauvegarder Firestore et taguer la version précédente avant la promotion.
8. Publier, surveiller console et connexion, puis conserver un chemin de retour documenté.

## 6. Conditions de blocage d’un déploiement

Le déploiement est bloqué si : authentification inaccessible; perte ou mutation silencieuse de données; permission plus large que la matrice; secret privé détecté; suppression physique possible; approbation irréversible; écran blanc hors ligne/après mise à jour; impossibilité de réaliser P-04 à P-10 sur mobile; ou échec critique de `test_quality_contract.mjs`.

Les avertissements du test qualité doivent être triés, documentés et planifiés. Ils ne bloquent pas automatiquement la publication s’ils ne dégradent ni sécurité, ni données, ni parcours essentiel.
