# Menu du compte et paramètres

Le Cockpit (présentation V2) est l’entrée par défaut. La présentation classique
est un choix explicite dans **nom d’utilisateur → Paramètres et préférences →
Apparence → Interface du Cockpit**. Aucun choix classique n’est mémorisé à l’insu
de l’utilisateur : seul le paramètre `interface=classic` d’un lien l’ouvre.

## Une seule voie pour chaque action

`workspace-adapter.js` monte `account-menu.mjs` après la création de la session,
pour les deux présentations et les deux rôles. Le module ne dépend d’aucune API
Firebase et ne crée aucun writer, listener de données, contrôle d’approbation
ou appel de notification. Il déplace les **nœuds d’origine**, avec des repères
DOM permettant leur restauration :

| Réglage | Contrôle conservé | Portée existante |
| --- | --- | --- |
| Thèmes | `theme.js`, radios `cockpit-display-theme` | navigateur |
| Animations | `motion.js`, `cockpit-motion-toggle` | navigateur, préférence système prioritaire |
| Notifications | `view-mode.js`, `data-vm-attention-controls` | compte et appareil, autorisation sur clic seulement |
| Détail de la présentation classique | `cockpit-view-mode-toggle` | compte et navigateur |
| Installation | `cockpit-install-shortcut` | appareil compatible |
| Diagnostic | `cockpit-health-launch` | communications uniquement, droit existant |
| Déconnexion | `cockpit-logout` | gestionnaire d’authentification existant |

Le dialogue du sélecteur de thème est réutilisé comme dialogue des paramètres.
Les radios restent dans le même dialogue et gardent leur gestionnaire `change`.
La fonction `ensureAttentionControls` reconnaît l’emplacement du menu pour ne
pas créer de doublon à chaque actualisation. Un observateur DOM filtré adopte
les contrôles arrivant tardivement; il n’observe pas leurs attributs ou leur texte.

Les actions éditoriales (Studio, boîte à idées, tâches, messages actifs) restent
dans l’espace de travail, séparées des préférences. Les états, textes, médias,
versions et confirmations ne sont pas modifiés par ce regroupement.

## Accessibilité et cycle de vie

Menu avec nom, rôle, flèches/Haut/Bas/Début/Fin, Échap et fermeture extérieure.
Dialogue natif avec confinement du focus, onglets au clavier et retour au bouton
du compte. Cibles de 44 px, défilement intérieur, trois thèmes et réduction des
animations. Sur mobile, les catégories passent en rangée et la navigation
principale du bas reste inchangée. Aucun mot de passe ou jeton n’est affiché.

À la fin de session, le dialogue et les contrôles sont restaurés avant le retrait
de la session. Le nom et le rôle de l’ancien compte quittent le DOM. Une nouvelle
session remonte un menu unique. Un échec du démarrage V2 conserve le secours
classique et le lien de retour dans les paramètres.

## Vérification et retour arrière

`npm --prefix cockpit run test:account-menu` vérifie les nœuds, événements,
préférences, noms traités comme texte, arrivées tardives et restauration.
`test:workspace-v2`, `test:theme`, `test:view-mode`, `test:shell` et l’audit complet
vérifient les interactions existantes. La fixture `account-menu-fixture.html`
est strictement synthétique, sans Firebase. Les vérifications visuelles doivent
utiliser un navigateur isolé et les deux rôles, sans signer de décision.

Les fichiers publics sont explicitement copiés par le workflow Pages et inclus
dans le shell du service worker. Retour arrière : revert du commit de cette
fonction, conserver les données partagées et incrémenter de nouveau la version
du shell pour distribuer le retour arrière. Aucune restauration Firestore requise.
