# Cosmotrap — escape game spatial en 3D

Cosmo Team · Cercle de projets 2026 · Institut G4 Marseille

Un astronaute se réveille seul sur la base lunaire Selene-7, après l'impact d'une micro-météorite. Il doit gérer son oxygène, sa lampe et son eau, résoudre les énigmes de 4 zones et rentrer sur Terre avant la fin du chronomètre (30 min).

Le jeu est en 3D à la première personne. Il se joue dans le navigateur, sans installation, sur ordinateur et sur mobile en mode paysage.

## Lancer le jeu

### En ligne (jury)

Ouvrir l'URL publique : `https://royalblue-wolverine-280146.hostingersite.com`. Créer un compte (pseudo, e-mail, mot de passe), choisir son personnage, puis cliquer sur **Lancer la mission**.

**Parcours.** Connexion (e-mail ou pseudo, mot de passe oublié) → inscription en 3 étapes → menu principal « Poste de commande » (partie en cours, classement Global / Semaine) → Paramètres (Profil, Jeu, Touches, Audio).

**Personnages et capacités** (Paramètres → Profil) :

| Personnage | Capacité |
|---|---|
| Léo | Sprinteur : +20 % de vitesse |
| Nova | Économe : la lampe consomme 35 % de piles en moins |
| Kenji | Décodeur : pénalités d'erreur divisées par 2 |
| Inès | Sang-froid : +3 min au chrono |
| Sam | Endurant : −40 % d'eau, 75 % d'O₂ après un malaise |
| Maya | Souffle long : −25 % d'O₂ |

**Paramètres → Jeu.** Niveau d'aide (Recrue : 1er indice gratuit ; Pilote : 30 s / 60 s ; Commandant : 60 s / 120 s), chronomètre, sous-titres, sauvegarde à chaque énigme, langue FR / EN, qualité, luminosité, sensibilité, champ de vision (70–110°), plein écran et résolution.

### En local (moins de 2 minutes)

Prérequis : Node 20 ou plus, et PHP 8 avec `pdo_sqlite` et `mbstring`.

Sous **Windows / PowerShell**, si PHP n'est pas installé :

```powershell
powershell -ExecutionPolicy Bypass -File scripts/setup-php.ps1
```

Ce script télécharge PHP 8.4 portable depuis le site officiel, vérifie son SHA256,
et active `pdo_sqlite` et `mbstring` dans `.tools/php/` (ignoré par Git).
`npm run local` le détecte automatiquement, sans modifier le PATH de Windows.
Un PHP déjà installé peut aussi être choisi avec la variable `PHP_BINARY`.

```bash
npm install
```

```bash
npm run local
```

Cette commande lance l'API PHP et le jeu, puis affiche deux adresses :
- `http://localhost:5180` sur ton ordinateur ;
- `http://<ton-ip>:5180` pour les collègues connectés au **même Wi-Fi**.

Sous PowerShell, `./scripts/start-local.ps1` lance également les deux serveurs
depuis le bon dossier. Garder cette fenêtre ouverte ; **Ctrl+C** les arrête.

L'API crée seule sa base SQLite dans `cosmotrap-data/` à la racine du projet, hors du dossier web. Sur l'adresse réseau en `http://`, la manette et le verrouillage de la souris peuvent être bloqués par le navigateur (contexte non sécurisé). Tout marche en `https` une fois le site en ligne.

### Vérifier une modification

```powershell
npm run build
npm run test:e2e
```

Playwright lance les serveurs s'ils ne tournent pas déjà. Installer son navigateur
avec `npx playwright install chromium`, ou utiliser Chrome installé :
`$env:PLAYWRIGHT_CHANNEL = 'chrome'` avant la commande de test.
Les tests couvrent le parcours complet, les ressources, les cinématiques passées
et les collisions du mobilier. Les textures PBR sont incluses dans `public/textures/` ;
leurs sources et licences sont dans `LICENCES.md`.

La qualité initiale tient compte du GPU : les Intel UHD démarrent en **Basse**.
Les textures de surface restent présentes dans tous les modes. Les modes
**Haute / Ultra** ajoutent notamment les ombres fines et l'occlusion ambiante,
et demandent une carte graphique plus puissante. Garder la résolution sur
**Automatique** permet d'adapter aussi les effets à la charge de rendu.

## Commandes

| Action | Clavier (modifiable dans Réglages → Touches) | Mobile (paysage) |
|---|---|---|
| Se déplacer | ZQSD / WASD ou flèches (position physique : AZERTY et QWERTY marchent) | Joystick à gauche |
| Regarder | Souris | Glisser à droite |
| Courir | Maj | Pousser le joystick à fond |
| Sauter | Espace | — |
| S’accroupir | Ctrl | — |
| Agir | E | Bouton « Agir » |
| Lampe | F | Bouton « Lampe » |
| Oxygène, piles, boire | O, R, B | Tablette → Inventaire |
| Tablette → Inventaire | I (ou touche personnalisée), I / Échap pour fermer | Bouton Inventaire |
| Sélection d’objet | Molette ou 1 à 9, sans consommer | Toucher une case / flèches de la barre |
| Utiliser la sélection | X, ou bouton dans l’inventaire | Bouton d’utilisation |
| Tablette → Plan | Tab | Bouton « Tablette » |
| Tablette → Journal et indices | H | Onglet « Journal » |
| Pause | P ou Échap | Bouton « Pause » |
| Passer une cinématique | Entrée ou bouton « Passer » | Bouton « Passer » |

**Regard.** Il marche à la souris (clic pour la verrouiller), au glisser-cliquer, et à Alt + glisser à deux doigts sur le pavé tactile (réglage activé par défaut).

**Tablette de poignet.** Le bras gauche se lève avant l'ouverture du terminal.
Ses quatre onglets regroupent le **Plan** (pièces réelles, position et orientation,
choix du niveau, zoom et recentrage), le **Journal** (missions, progression et
indices), les **Messages** (transmissions, alertes et documents reçus, conservés
dans la sauvegarde) et l'**Inventaire** (objets, quantités et utilisation).
La barre d'objets reste accessible à la molette pendant le jeu.

**Chariot de la serre (zone 2).** Avancer contre l'étagère à légumes sur roulettes
pour la pousser et dégager l'entrée. Sa position est conservée dans la sauvegarde.

**Manette Xbox / PlayStation** (branchée en USB ou Bluetooth) :

| Action | Manette |
|---|---|
| Bouger / regarder | Stick gauche / stick droit |
| Sauter · s’accroupir / retour | A (✕) · B (○) |
| Agir · inventaire complet | X (□) · Y (△) |
| Lampe · tablette · indice | LB (L1) · Vue (pavé tactile) · RB (R1) |
| Oxygène · piles · boire | Croix ↓ · clic du stick droit · RT (R2) |
| Courir | LT ou clic du stick gauche |
| Barre d'objets | Croix ← → pour choisir, ↑ pour utiliser |
| Pause · passer une cinématique | Start · Select |
| Menus et énigmes | Croix ou stick pour se déplacer, A pour valider |

Les commandes de jeu sont réaffectables dans Paramètres → Touches. La barre d’inventaire affiche les boutons configurés.

## Règles du jeu

### Difficulté (choisie au lancement)

| | Explorateur | Astronaute | Survie |
|---|---|---|---|
| Chronomètre | 40 min | 30 min | 22 min |
| Consommation O₂ / lampe / eau | ×0,6 | ×1 | ×1,35 |
| Éclairage des pièces | ×1,35 | ×1 | ×0,55 |
| Pénalités | ×0,5 | ×1 | ×1,5 |
| Imprévus | rares | parfois | fréquents |
| Score | ×0,8 | ×1 | ×1,4 |

Le classement est séparé par difficulté.

### Imprévus (zones 1 à 3)

- **Coupure de courant** (32 s) : l’éclairage normal s’éteint et les gyrophares rouges prennent le relais. Les coupures locales des couloirs durent 16 s ; la lampe reste utilisable.
- **Micro-fuite** (28 s) : l'O₂ baisse 2,2 fois plus vite. Le ruban adhésif (objet de survie, Tablette → Inventaire → Colmater) l'arrête tout de suite.

### Succès et réplique fantôme

- **Succès.** Il y en a 10 : partie terminée, sans indice, sans faute, moins de 10 min, 11 objets de survie, sans évanouissement, échantillons gardés, Survie terminée, fuite colmatée, station explorée en entier. Ils sont gardés dans le compte et visibles depuis le menu **Succès**.
- **Réplique fantôme.** Le parcours du meilleur temps de ta difficulté est rejoué en hologramme orange, en même temps que toi. Il se désactive dans Réglages.

- **Chronomètre.** La partie dure au plus 30 minutes, avec le temps restant affiché en haut. À zéro, c'est l'échec : la station est perdue.
- **Erreurs.** Une mauvaise réponse a une conséquence visible : flash rouge et pénalité de temps.
  - Code faux, mauvaise séquence ou programme mal exécuté : −30 s.
  - Tâche lancée trop tôt dans le planning : −20 s.
  - Mauvaise fréquence radio : −20 s.
- **Indices.** Il y a 2 niveaux par étape, dans la tablette, onglet Journal :
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

1. **Prologue** (passable) : 2041, base lunaire Selene-7. Le labo de Maya vient de trouver de l'eau sous le pôle Sud. Une micro-météorite frappe la station.
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
7. Prendre l'**ascenseur** du nœud central, déverrouillé par la pressurisation, pour descendre à l'étage 2. On peut ensuite circuler librement entre les étages 1 et 2.

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
- **Rendu.** Décors procéduraux et matériaux photographiques :
  - textures PBR générées sur canvas (panneaux, tôle striée, rivets, salissures, normal maps) ;
  - textures CC0 locales pour métal, tissu, bois, roche, écorce et terrain ;
  - mobilier à arêtes adoucies, couvertures plissées et volumes de collision ;
  - arbres instanciés avec branches et feuillage découpé, sans couronnes en cônes ;
  - Lune en shader (cratères multi-échelles, photométrie Lommel-Seeliger) ;
  - Terre avec atmosphère, nuages et villes la nuit ;
  - rayons de soleil volumétriques à travers les hublots ;
  - herbe instanciée animée par le vent, rivière en shader.
  - fond 3D de la base lunaire Selene-7 derrière la connexion, le menu et les paramètres.

  Pour régénérer les ressources : `npm run assets` (télécharge dans `asset-src/`, ignoré par git, puis écrit dans `public/assets/`).
- **Cinématiques.** Chaque zone s'ouvre sur une scène découpée en plans (réveil au sol, travellings, plans serrés, plan large sur le personnage) : bandes cinémascope 2,39:1, grain de pellicule, bords d'objectif adoucis. Sur Terre, la capsule Hermès traverse le ciel en feu et s'écrase dans la clairière (traînée, souffle, colonne de fumée), puis le personnage se relève.
- **Post-traitement.** ACES, N8AO, bloom, étalonnage « clair-obscur », aberration chromatique et SMAA.
- **Qualité.** 4 niveaux : Basse, Moyenne, Haute, Ultra. Le niveau est détecté automatiquement selon la carte graphique, et la résolution baisse seule si les images par seconde chutent.
- **Audio.** Tout est synthétisé en Web Audio : bruitages et musique adaptative. Le tempo et le cœur accélèrent quand l'O₂ baisse et quand le chrono s'épuise. Chaque zone a plusieurs morceaux qui changent toutes les 2 à 3 min en fondu, dont des thèmes « orgue cosmique » originaux (orgue à tuyaux, tic-tac d'horloge, ostinato, grande réverbération). Les voix et bruitages sont de vrais enregistrements ElevenLabs (`public/audio`, 87 fichiers) : une voix par rôle (narrateur, commandante, voix intérieure masculine ou féminine selon le personnage), en français et en anglais. La voix de synthèse du navigateur est désactivée par défaut (Paramètres → Audio).

  Pour régénérer après une modification des textes : supprimer les fichiers concernés dans `public/audio` (ou passer `--force`), puis lancer le script ci-dessous (`--voices` : répliques seulement). Il met à jour `manifest.json`. Le forfait gratuit n'autorise via l'API que les voix « premade » d'ElevenLabs, pas celles de la bibliothèque. Si Node échoue avec un délai de connexion, ajouter `NODE_OPTIONS=--dns-result-order=ipv4first`.

  ```bash
  ELEVENLABS_API_KEY=ta_cle npm run audio
  ```

  Les voix utilisées sont définies dans `CAST` (`scripts/generate-audio.ts`). La musique Suno (prompts ci-dessus) se dépose à la main sous la forme `music_orion_calm.mp3`, etc., puis il faut relancer le script pour mettre à jour le manifeste.
- **Back.** API PHP (`public/api`), en PDO SQLite en local et MySQL en production.
  - `auth.php` : inscription, connexion (e-mail ou pseudo), Google, profil (pseudo, e-mail, personnage), changement et réinitialisation du mot de passe. Le lien de réinitialisation part avec la fonction PHP `mail()` (active sur Hostinger) ; en local, il est écrit dans le journal PHP.
  - `save.php` : sauvegarde.
  - `leaderboard.php` : classement global ou de la semaine, rang du joueur, trajectoire du record (réplique fantôme).
  - `achievements.php` : succès.

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

- l'ascenseur reste verrouillé avant la pressurisation ;
- la vapeur bloque l'accès au disjoncteur ;
- le sas reste fermé tant que le terminal n'est pas décodé ;
- la rivière est infranchissable avant le pont.

Il vérifie aussi les ressources à zéro, les pénalités, les indices, la limite de temps et l'inscription au classement, et prend une capture par zone dans `test-results/`.

## Équipe

Clément Volle (chef de projet), Simon Leplat (game design et scénario), Kilian Orsal (lead dev), Hamza Chaibrassou et Ethan Angot-Chabanol (graphisme et UX), Loïc Chauvelot (qualité et passation).

L'usage de l'IA est déclaré dans le registre IA (`livrables/L4_Produit`).
