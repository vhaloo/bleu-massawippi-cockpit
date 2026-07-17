# Référence d’expérience du cockpit

Mise à jour : 17 juillet 2026.

## Principe de continuité

La direction apprécie l’application dans son état actuel. Toute évolution doit donc préserver une interface immédiatement reconnaissable, les mêmes parcours essentiels et la stabilité de l’application installée. Les ajouts restent discrets, tactiles, réversibles et compatibles avec le mode sans animation.

## Appareils de référence

- **Direction — ordinateur :** Surface Laptop de moins de trois ans, cockpit installé comme application Windows, écran tactile. La capture de référence montre une fenêtre d’environ 1 533 × 1 018 px avec une mise à l’échelle Windows généreuse; il ne faut pas déduire un pourcentage de zoom exact.
- **Communications — ordinateur :** écran 16:9 en 2 560 × 1 440 px.
- **Direction — mobile :** iPhone, application web installée ou Safari mobile.
- **Communications — mobile :** Android, application web installée ou Chrome mobile.

## Garde-fous d’interface

- Conserver des cibles tactiles d’au moins 44 × 44 px pour les actions courantes.
- Ne jamais faire dépendre une fonction d’un survol de souris.
- Éviter tout chevauchement des languettes et widgets avec le contenu à largeur réduite.
- Vérifier au minimum les largeurs 390 px, 768 px, 1 366 px et 2 560 px, en mode clair et sombre.
- Respecter `prefers-reduced-motion` et le bouton local « Sans animation ».
- Les confirmations visuelles doivent être brèves et douces : une ondulation légère après un feu vert ou un choix média, sans déplacement de la mise en page.
- La notification de nouveauté doit rester un point, jamais un compteur, et ne doit déclencher aucune requête Firebase supplémentaire.
