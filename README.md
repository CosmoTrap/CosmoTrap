# Cosmotrap — escape game spatial en 3D

Cosmo Team · Cercle de projets 2026 · Institut G4 Marseille

Un astronaute se réveille seul sur la station Orion, en orbite basse autour de la Lune, après l'impact d'une micro-météorite. Il doit gérer son oxygène, sa lampe et son eau, résoudre les énigmes de 4 zones et rentrer sur Terre avant la fin du chronomètre (30 min).

Le jeu est en 3D à la première personne. Il se joue dans le navigateur, sans installation, sur ordinateur et sur mobile en mode paysage.

## Lancer le jeu

### En ligne (jury)

Ouvrir l'URL publique : `https://royalblue-wolverine-280146.hostingersite.com`. Créer un compte (pseudo, e-mail, mot de passe), puis cliquer sur **Nouvelle partie**.

### En local (moins de 2 minutes)

Prérequis : Node 20 ou plus, et PHP 8 avec `pdo_sqlite` (installé par défaut sur macOS avec Homebrew et sur la plupart des Linux).

```bash
npm install
```

```bash
php -S 127.0.0.1:8787 -t public &
```

```bash
npm run dev
```

Ouvrir ensuite `http://localhost:5180`. L'API PHP crée seule sa base SQLite dans `../cosmotrap-data/`, hors du dossier web.

## Commandes

| Action | Clavier (modifiable dans Réglages → Touches) | Mobile (paysage) |
|---|---|---|
| Se déplacer | ZQSD / WASD ou flèches (position physique : AZERTY et QWERTY marchent) | Joystick à gauche |
| Regarder | Souris | Glisser à droite |
| Courir | Maj | Pousser le joystick à fond |
| Agir | E ou Espace | Bouton « Agir » |
| Lampe | F | Bouton « Lampe » |
| Oxygène, piles, boire | O, R, B | Tablette → Sac |
| Barre d'inventaire | 1 à 9 : un consommable est utilisé, un objet clé est mis en main | Touche sur l'emplacement |
| Tablette | Tab | Bouton « Tablette » |
| Pause | P ou Échap | Bouton « Pause » |
| Passer une cinématique | Entrée ou bouton « Passer » | Bouton « Passer » |

## Règles du jeu

- **Chronomètre.** La partie dure au plus 30 minutes, avec le temps restant affiché en haut. À zéro, c'est l'échec : la station est perdue.
- **Erreurs.** Une mauvaise réponse a une conséquence visible : flash rouge et pénalité de temps.
  - Code faux, mauvaise séquence ou programme mal exécuté : −30 s.
  - Tâche lancée trop tôt dans le planning : −20 s.
  - Mauvaise fréquence radio : −20 s.
- **Indices.** Il y a 2 niveaux par étape, dans la tablette, onglet Mission :
  - indice léger : −30 s ;
  - indice fort : −60 s.

  Leur nombre est compté et affiché à la fin.
- **Ressources.**
  - Oxygène : −0,42 %/s, ×1,5 en zone 2 tant que la vapeur fuit. À 0, la bouteille d'O₂ se branche seule ; sans bouteille, tu t'évanouis et reviens au départ de la zone avec 50 %.
  - Lampe : −0,75 %/s quand elle est allumée. À 0, elle s'éteint, et on ne peut plus lire ni ramasser dans le noir.
  - Eau : −0,11 %/s. À 0, la vue devient floue et tu avances 45 % moins vite.
- **Score.** `6000 + 3 × (secondes restantes) − 150 × indices − 100 × erreurs + 60 × objets de survie (+300 si les échantillons sont gardés)`.
- **Classement.** Il garde le meilleur temps de chaque joueur, pénalités comprises.
- **Sauvegarde.** Elle a lieu toutes les 30 s et à chaque changement de zone, en local et dans le compte. **Continuer** reprend la sauvegarde la plus récente, même depuis un autre ordinateur.

## Scénario

1. **Prologue** (passable) : 2041, station Orion. Le labo de Maya vient de trouver de l'eau sous le pôle Sud. Une micro-météorite frappe la station.
2. **Zone 1 · Quartiers d'équipage.** Visite cinématique de la zone. Briefing holographique de la commandante. Il faut sortir du dortoir et pressuriser le sas.
3. **Zone 2 · Labo & machinerie.** Il faut couper la fuite de vapeur, réparer le disjoncteur, faire un choix d'énergie, puis décoder le programme de lancement.
4. **Zone 3 · Fusée Hermès.** Il faut trouver la cellule, planifier le pré-vol, prendre une décision sur les échantillons et lancer la séquence. Suivent le décollage et la rentrée atmosphérique.
5. **Zone 4 · Terre.** Dans la vallée au coucher du soleil, il faut fouiller la capsule, réparer le pont, émettre un signal radio et tirer la fusée de détresse. L'hélicoptère arrive : fin.

**Embranchements**, avec des conséquences sur la suite et sur la fin :

- **Énergie (zone 2).** Choisir la lumière (la lampe ne se vide pas en machinerie, mais l'O₂ baisse) ou l'oxygène (O₂ stable, mais la machinerie reste dans le noir).
- **Échantillons (zone 3).** Les garder (−60 s, +300 au score, fin « La découverte ») ou les larguer (fin « Tout le monde est rentré »).
- **Fins.** Le sauvetage a 4 épilogues selon les choix. L'échec arrive si le temps est écoulé.

## Solution complète

### Zone 1 — Quartiers d'équipage

1. Prendre la **lampe frontale** sur l'étagère du dortoir, puis l'allumer (F).
2. Lire le **tableau du réfectoire** : le code du casier est l'année de mise en service de la station.
3. Aller dans la **réserve** (sombre, au sud-ouest) et lire la plaque à la lampe : **2041**.
4. **Énigme 1, observation visuelle.** Taper **2041** sur le casier du dortoir pour récupérer le badge.
5. Badger la porte du **sas**, à l'est du couloir.
6. **Énigme 2, logique (Lights Out 3×3).** Appuyer sur les vannes de la diagonale : haut-gauche, centre, bas-droite.
7. Descendre par la **trappe**.

### Zone 2 — Labo & machinerie

1. Prendre le **fusible** dans le labo (nord-ouest) et la **clé à molette** dans la serre (nord).
2. Fermer la **vanne de vapeur** dans le couloir, à l'est. La vapeur bloque l'accès au disjoncteur.
3. **Disjoncteur** (nord-est) : y poser le fusible.
4. **Choix stratégique (gestion de projet).** Le réseau fournit 3 unités pour 4 systèmes. Activer **Sas** et **Terminal**, puis **Recyclage O₂** ou **Lumières de la machinerie**.
5. **Énigme 3, algorithmique.** Le terminal de la machinerie affiche :

   ```
   couleurs ← [ROUGE, JAUNE, BLEU, VERT]
   pour i allant de 0 à 3 :
       j ← (3 × i + 2) mod 4
       émettre couleurs[j]
   ```

   j vaut 2, 1, 0 puis 3. Il faut donc charger **BLEU · JAUNE · ROUGE · VERT**.
6. Le **sas d'amarrage** s'ouvre (il faut le courant et le programme chargé). Prendre l'écoutille de l'Hermès.

### Zone 3 — Fusée Hermès

1. Trouver la **cellule d'énergie** dans la soute (sombre, sud-ouest) et l'insérer dans le **moteur** (sud-est).
2. **Énigme 4, gestion de projet (planning pré-vol).** Respecter les dépendances. Un ordre valide :
   1. Fermer l'écoutille.
   2. Charger la trajectoire.
   3. Pressuriser la cabine.
   4. Désamarrer.
   5. Contrôler l'O₂ des combinaisons.
   6. Autoriser l'allumage.
3. **Dilemme** : garder ou larguer les échantillons.
4. **Énigme 5, logique** (réutilise l'énigme 3) : entrer la séquence **BLEU · JAUNE · ROUGE · VERT**. Suivent le décollage et la rentrée atmosphérique.

### Zone 4 — Terre

1. **Fouiller la capsule** (derrière le joueur) : batterie, corde et manuel. Le manuel indique 121,5 MHz.
2. Ramasser l'**antenne** près des arbres, à l'ouest.
3. **Réparer le pont** au nord avec la corde. La rivière est infranchissable sans lui.
4. **Énigme 6, logique.** Régler la **balise** (sur le rocher, de l'autre côté) sur **121,5 MHz** et émettre.
5. Prendre le **pistolet de détresse** dans la caisse du refuge, au nord-ouest.
6. **Tirer la fusée à l'hélisurface**, au nord. L'hélicoptère arrive : fin.

Une partie parfaite, sans erreur ni indice et en passant les cinématiques, dure environ 10 à 13 minutes.

## Technique

- **Front.** Vite, React 18, TypeScript, React Three Fiber, drei, postprocessing et Rapier (collisions, contrôleur de personnage), zustand et howler.
- **Rendu.** Tout est procédural :
  - textures PBR générées sur canvas (panneaux, tôle striée, rivets, salissures, normal maps) ;
  - Lune en shader (cratères multi-échelles, photométrie Lommel-Seeliger) ;
  - Terre avec atmosphère, nuages et villes la nuit ;
  - rayons de soleil volumétriques à travers les hublots ;
  - herbe instanciée animée par le vent, rivière en shader.
- **Post-traitement.** ACES, N8AO, bloom, étalonnage « clair-obscur », aberration chromatique et SMAA.
- **Qualité.** 4 niveaux : Basse, Moyenne, Haute, Ultra. Le niveau est détecté automatiquement selon la carte graphique, et la résolution baisse seule si les images par seconde chutent.
- **Audio.** Tout est synthétisé en Web Audio : bruitages, musique adaptative calme ou tension, voix en synthèse vocale. Les fichiers Suno et ElevenLabs déposés dans `public/audio` (listés dans `manifest.json`) remplacent automatiquement la synthèse.
- **Back.** API PHP (`public/api`), en PDO SQLite en local et MySQL en production.
  - `auth.php` : inscription, connexion, Google.
  - `save.php` : sauvegarde.
  - `leaderboard.php` : classement.

  Les mots de passe sont hachés avec `password_hash`, la session passe par un jeton porteur.

### Déploiement sur Hostinger

1. Lancer `npm run build`, puis envoyer **le contenu de `dist/`** dans `public_html/`. Il contient `api/` et ses `.htaccess`.
2. Créer une base MySQL dans hPanel, puis `public_html/api/config.local.php` :

   ```php
   <?php return ['driver' => 'mysql', 'host' => 'localhost', 'name' => 'u123_cosmo', 'user' => 'u123_cosmo', 'pass' => 'mot-de-passe'];
   ```

   Les tables sont créées au premier appel.
3. **Optionnel, connexion Google.** Créer un identifiant OAuth « Application Web » dans Google Cloud. Le mettre dans `config.local.php` (`'google_client_id' => '…'`) et dans `.env` (`VITE_GOOGLE_CLIENT_ID=…`) avant le build. Sans cette configuration, le bouton Google affiche un message et la connexion par e-mail reste disponible.

### Tests

```bash
npx playwright test
```

`tests/playthrough.spec.ts` crée un compte et joue toute la partie en se téléportant devant chaque objectif. Il résout les énigmes par l'interface et vérifie les verrous :

- la trappe reste fermée avant la pressurisation ;
- la vapeur bloque l'accès au disjoncteur ;
- le sas reste fermé tant que le terminal n'est pas décodé ;
- la rivière est infranchissable avant le pont.

Il vérifie aussi les ressources à zéro, les pénalités, les indices, la limite de temps et l'inscription au classement, et prend une capture par zone dans `test-results/`.

## Équipe

Clément Volle (chef de projet), Simon Leplat (game design et scénario), Kilian Orsal (lead dev), Hamza Chaibrassou et Ethan Angot-Chabanol (graphisme et UX), Loïc Chauvelot (qualité et passation).

L'usage de l'IA est déclaré dans le registre IA (`livrables/L4_Produit`).
