# Séléné-7 — mission lunaire

Dans le menu, choisir **Base lunaire** puis lancer une **nouvelle partie**. La station spatiale conserve son parcours à quatre zones. Les anciennes sauvegardes, créées quand les deux cartes lançaient la station spatiale, restent associées à cette dernière.

## Parcours

Un hub circulaire relie cinq modules : chambre à l’ouest, centrale au nord, sécurité au nord-est, combinaisons au sud-est et sas au sud. Les deux branches orientales sont des couloirs diagonaux. Une passerelle extérieure conduit du sas à la fusée LV-1, au sud-ouest. La tablette utilise les mêmes positions et rotations que le monde 3D.

Douze épreuves, neuf mécaniques : codes déduits de documents, réseau à orienter, répartition de charges, réglages couplés, logique d’ordre, triangulation, transferts de volumes, programmation d’itinéraire et équations de ravitaillement. L’autorisation finale réutilise les résultats précédents. Les notes et les résultats sont archivés dans la tablette.

| Module | Épreuves | Accès |
| --- | --- | --- |
| Chambre | Coffre de relève | Départ ; la sortie se déverrouille après le coffre |
| Centrale | Liaison solaire, trois bus, échangeurs | Coffre validé ; fusible requis pour la liaison |
| Sécurité | Habilitations, radio | Bus rétablis ; antenne requise pour la radio |
| Combinaisons | Filtration, pression, certification EVA | Habilitations validées ; radio nécessaire à la filtration ; clé pour le banc de pression |
| Sas | Rover, cartouches | Certification EVA et échangeurs validés ; cellule pour les cartouches |
| Fusée | Autorisation de décollage | Ravitaillement terminé ; départ normal ou cinématique passée |

La cible de conception est d’environ **20 minutes en première découverte** : environ 18–19 minutes de recherche/résolution estimées, plus les déplacements. Ce n’est pas une moyenne mesurée : il faut un panel de nouveaux joueurs pour l’étalonner. Il n’y a aucun délai artificiel imposé. Le mode Astronaute laisse 30 minutes ; les pénalités, capacités des personnages, consommables et indices restent actifs. Les indices forts permettent de sortir d’un blocage, contre la pénalité du réglage d’aide choisi.

## Technique et rendu

- `src/game/lunar/map.ts` est la source commune des positions, portes, objets et plan de tablette.
- `puzzles.ts` contient les règles pures, contraintes, valeurs déterministes par partie et consignes ; `logic.ts` gère progression et sauvegarde ; `LunarPuzzle.tsx` affiche les postes.
- `src/world/LunarWorld.tsx` réutilise matériaux PBR, meubles, roches photoscannées, éclairage, fenêtres, portes et effets de la station. Aucune diminution des réglages graphiques.
- Décors fixes regroupés par module, géométries et textures partagées, roches instanciées par le système de regroupement existant, colliders simples pour les bâtiments. Les ressources graphiques sont préparées pendant le chargement.
- Gravité lunaire de 1,62 m/s² ; impulsion du saut ajustée pour conserver une hauteur praticable dans les modules.
- L’alimentation principale revient après les bus. Les coupures temporaires de 20–30 secondes utilisent les mêmes gyrophares rouges que la station.
- Le stockage conserve le fonctionnement existant : une partie active par compte/appareil, pas deux emplacements de sauvegarde simultanés.

## Vérification reproductible

```powershell
npm ci
npm run typecheck
npm run build
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:e2e -- --config playwright.lunar.config.ts
```

Chrome doit être installé ; sinon installer Chromium avec Playwright et omettre `PLAYWRIGHT_CHANNEL`. Les tests lunaires isolent les appels API : aucun compte ni score réel n’est modifié. Le port de test est 5184. Le jeu normal se lance avec `npm run local`.

La suite vérifie 300 tirages des énigmes, les contraintes et solutions, les sauvegardes, les ressources sur 20 minutes simulées, les collisions des cinq portes et jonctions, chaque interaction avec E, la passerelle, la tablette et la victoire après rechargement avant décollage. Elle produit captures et mesures de rendu haute qualité 1280×720 dans `test-results/`.

Les essais automatisés résolvent volontairement les systèmes rapidement ; leur durée n’est pas une mesure du temps d’un nouveau joueur.

<details>
<summary>Solutions pour la recette — spoilers</summary>

- Coffre : chiffres du manifeste dans l’ordre Shackleton, Copernic, Tycho, Kepler.
- Liaison : chemin numéroté 1→2→6→5→9→10→11→7→8→12→16. Les segments hors du circuit alimenté peuvent rester isolés.
- Bus : A = 2+7, B = 4+6, C = 3+5. Une autre partition satisfaisant toutes les contraintes est aussi acceptée.
- Échangeurs : résoudre I=A+2B, II=B+2C, III=C+2A avec les cibles de la fiche de sécurité.
- Habilitations : Maya, Kenji, Sam, Inès.
- Radio : A=((A+B)+(A+C)−(B+C))/2, puis B et C par soustraction.
- Filtres : Grille, Cyclone, Ioniseur, Tamis, Carbone.
- Pression : depuis 8/0/0, A→B, B→C, C→A, B→C, A→B, B→C, C→A donne 4/4/0.
- Certification : Balise, Clapet, Pompe, Test, Visière, Purge.
- Rover : E, N, N, E, N, N, E, E.
- Cartouches : résoudre les trois compteurs indiqués sur la consigne du sas.
- Départ : troisième chiffre du coffre, commande C des échangeurs, canal B de la radio, puis 4.

</details>
