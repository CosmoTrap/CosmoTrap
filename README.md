# Cosmotrap — escape game spatial en 3D

Cosmo Team · Cercle de projets 2026 · Institut G4 Marseille

Deux missions indépendantes sont sélectionnables dans le menu : **Station spatiale** (quatre zones, jusqu’au retour sur Terre) et **Base lunaire Séléné-7** (cinq modules autour d’un nœud central, douze épreuves et une évacuation en fusée). Il faut gérer son oxygène, sa lampe et son eau, et s’échapper avant la fin du chronomètre, dont la durée dépend de la difficulté.

Guides : [solution de la station spatiale](#solution-station) · [plan et repères de la base lunaire](#base-lunaire) · [solution des douze épreuves lunaires](#solution-lunaire).

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
| Sam | Endurant : −40 % d'eau, trousses de secours à +30 % de vie |
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

**Regard.** La souris reste verrouillée dans la vue pendant le jeu. Elle se libère pour les interfaces (tablette, documents, énigmes, pause), puis est reprise à leur fermeture. Si le navigateur exige une nouvelle interaction, cliquer dans la vue pour la reprendre. Échap permet toujours de mettre en pause. Le geste Alt + glisser à deux doigts sur le pavé tactile reste disponible (réglage activé par défaut).

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

- **Coupure de courant** : tout le niveau 2 est sans courant dès l'arrivée, jusqu'à la réparation du disjoncteur. Une coupure imprévue de 32 s peut aussi survenir. Les lampes s'éteignent, seuls les gyrophares rouges restent allumés, et l'ascenseur reste utilisable. La lampe torche devient indispensable.
- **Extérieur** : par les vitres, on voit la station inspirée de l'ISS : l'autre niveau, relié par l'ascenseur (le niveau 1 est au-dessus du niveau 2), les panneaux solaires du plan de la tablette, la poutre, les radiateurs et la fusée amarrée.
- **Alarme** : les gyrophares tournent, lumières allumées, tant que le sas n'est pas pressurisé (niveau 1), tant que le gaz fuit (niveau 2), pendant une micro-fuite et dans les 5 dernières minutes avant l'impact des météorites. Pendant une alarme ou une coupure, l'ascenseur passe au rouge ; sinon il reste blanc.
- **Micro-fuite** (28 s) : l'O₂ baisse 2,2 fois plus vite. Le ruban adhésif (objet de survie, Tablette → Inventaire → Colmater) l'arrête tout de suite.

### Succès et réplique fantôme

- **Succès.** Il y en a 10 : partie terminée, sans indice, sans faute, moins de 10 min, 10 objets de survie, O₂ jamais sous 15 %, échantillons gardés, Survie terminée, fuite colmatée, station explorée en entier. Ils sont gardés dans le compte et visibles depuis le menu **Succès**.
- **Réplique fantôme.** Le parcours du meilleur temps de ta difficulté est rejoué en hologramme orange, en même temps que toi. Désactivée par défaut, elle s'active dans Réglages.

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
  - Oxygène : −0,21 %/s, ×1,5 en zone 2 tant que le gaz fuit. Une bouteille d'O₂ ajoute 55 % : on ne peut la brancher qu'à 45 % ou moins, et elle se branche seule à 15 %. À 0, la partie est perdue.
  - Lampe : −0,20 %/s quand elle est allumée. À 0, elle s'éteint, et on ne peut plus lire ni ramasser dans le noir.
  - Eau : −0,11 %/s. Une poche ajoute 50 % et se boit seule à 15 %. À 0, la partie est perdue.
  - Vie : le gaz de la conduite cassée (zone 2) enlève 40 % à chaque passage. Une trousse de secours rend 20 % (30 % avec Sam) et se déclenche seule à 15 %. À 0, la partie est perdue.
  - Couverture de survie : sur Terre, sans elle, tu perds 0,1 % de vie par seconde et tu avances 20 % moins vite.
- **Score.** `6000 + 3 × (secondes restantes) − 150 × indices − 100 × erreurs + 60 × objets de survie (+300 si les échantillons sont gardés)`.
- **Classement.** Il garde le meilleur temps de chaque joueur, pénalités comprises.
- **Sauvegarde.** Elle a lieu toutes les 30 s et à chaque changement de zone, en local et dans le compte. **Continuer** reprend la sauvegarde la plus récente, même depuis un autre ordinateur.

## Scénario de la station spatiale

1. **Prologue** (passable) : 2041, base lunaire Selene-7. Le labo de Maya vient de trouver de l'eau sous le pôle Sud. Une micro-météorite frappe la station.
2. **Zone 1 · Quartiers d'équipage.** Visite cinématique de la zone. Briefing holographique de la commandante. Il faut sortir du dortoir et pressuriser le sas.
3. **Zone 2 · Labo & machinerie.** Il faut couper la fuite de gaz, réparer le disjoncteur, faire un choix d'énergie, puis décoder le programme de lancement.
4. **Zone 3 · Fusée Hermès.** Il faut trouver la cellule, planifier le pré-vol, prendre une décision sur les échantillons et lancer la séquence. Suivent le décollage et la rentrée atmosphérique.
5. **Zone 4 · Terre.** Dans la vallée au coucher du soleil, il faut fouiller la capsule, réparer le pont, émettre un signal radio et tirer la fusée de détresse. L'hélicoptère arrive : fin.

**Embranchements**, avec des conséquences sur la suite et sur la fin :

- **Énergie (zone 2).** Choisir la lumière (la lampe ne se vide pas en machinerie, mais l'O₂ baisse) ou l'oxygène (O₂ stable, mais la machinerie reste dans le noir).
- **Échantillons (zone 3).** Les garder (−60 s, +300 au score, fin « La découverte ») ou les larguer (fin « Tout le monde est rentré »).
- **Fins.** Le sauvetage a 4 épilogues selon les choix. L'échec arrive si le temps est écoulé.

<a id="solution-station"></a>

## Solution complète de la station spatiale

### Zone 1 — Quartiers d'équipage

1. Prendre la **lampe torche** sur l'étagère du dortoir, puis l'allumer (F).
2. Lire le **tableau du réfectoire** : le code du casier est l'année de mise en service de la station.
3. Aller dans la **réserve** (sombre, au sud-ouest) et lire la plaque à la lampe : **2041**.
4. **Énigme 1, observation visuelle.** Taper **2041** sur le casier du dortoir pour récupérer le badge. Les touches sont mélangées à chaque ouverture ; le clavier physique du PC saisit les vrais chiffres. Le code ne change pas.
5. Badger la porte du **sas**, à l'est du couloir.
6. **Énigme 2, logique (Lights Out 3×3).** Chaque vanne inverse son état et celui de ses voisines directes (haut, bas, gauche, droite). L'ordre ne compte pas, et appuyer deux fois annule. La grille de départ est tirée au sort à chaque partie, toujours soluble, avec une solution minimale de 4 à 7 appuis. Elle est enregistrée dans la sauvegarde. Le bouton Réinitialiser revient à ce départ, sans en tirer un nouveau. L'indice fort donne les cases exactes de la grille en cours, au format « ligne, colonne » (L1 C1 en haut à gauche). Méthode : corriger une ligne après l'autre en partant du haut, comme l'indique le post-it du casier.
7. Prendre l'**ascenseur** du nœud central, déverrouillé par la pressurisation, pour descendre à l'étage 2. On peut ensuite circuler librement entre les étages 1 et 2.

### Zone 2 — Labo & machinerie

À l’arrivée, tout l’étage fonctionne sur les alarmes rouges : plafonniers, écrans de décor et éclairage normal sont coupés. La lampe torche reste utilisable. La réparation du disjoncteur rétablit le réseau ; l’éclairage de la machinerie dépend ensuite du choix d’énergie ci-dessous.

1. Prendre le **fusible** dans le labo (nord-ouest) et la **clé à molette** dans la serre (nord).
2. Traverser la fuite de gaz dans le couloir, à l'est (−40 % de vie à chaque passage), puis fermer la **vanne de gaz**, de l'autre côté. Prends la clé avant de passer. Le disjoncteur reste inutilisable tant que la vanne n'est pas fermée.
3. **Disjoncteur** (nord-est) : y poser le fusible.
4. **Choix stratégique (gestion de projet).** Le réseau fournit 3 unités pour 4 systèmes. Démarrer le **sas** d'abord, puis le **terminal**. Lancer le terminal avant le sas fait sauter le disjoncteur : les quatre systèmes s'éteignent (−20 s). Ensuite, choisir **Recyclage O₂** ou **Lumières de la machinerie**.
5. **Énigme 3, algorithmique.** Le terminal de la machinerie affiche :

   ```
   couleurs ← [ROUGE, JAUNE, BLEU, VERT]   (indices 0 à 3)
   pour i allant de 0 à 3 :
       j ← (3 × i + 2) mod 4
       émettre couleurs[j]
   ```

   j vaut 2, 1, 0 puis 3, donc couleurs[2], [1], [0], [3] : **BLEU · JAUNE · ROUGE · VERT**. Les boutons sont mélangés à chaque partie ; la séquence correcte ne change pas.
6. Le **sas d'amarrage** s'ouvre (il faut le courant, le sas alimenté et le programme chargé). Prendre l'écoutille de l'Hermès.

### Zone 3 — Fusée Hermès

1. Trouver la **cellule d'énergie** dans la soute (sombre, sud-ouest) et l'insérer dans le **moteur** (sud-est).
2. **Énigme 4, gestion de projet (planning pré-vol).** Huit opérations, affichées dans un ordre mélangé qui n'est jamais déjà une solution. Une tâche lancée avant ses prérequis coûte 20 s. Plusieurs ordres sont valides. L'un d'eux :
   1. Fermer l'écoutille.
   2. Charger la trajectoire.
   3. Purger le carburant.
   4. Pressuriser la cabine (après l'écoutille).
   5. Aligner la centrale inertielle (après la trajectoire).
   6. Contrôler l'O₂ des combinaisons (après la pressurisation).
   7. Désamarrer (après l'écoutille, la centrale et le carburant).
   8. Autoriser l'allumage (après le désamarrage et l'O₂).
3. **Dilemme** : garder ou larguer les échantillons.
4. **Énigme 5, logique** (décompte, à partir de l'énigme 3) : une fois le programme validé au terminal de la **zone 2**, le document « Terminal — séquence de lancement » est archivé dans **Messages**. Il donne BLEU · JAUNE · ROUGE · VERT et précise que le décompte se lit à l'envers. Au poste de la **zone 3**, saisir **VERT · ROUGE · JAUNE · BLEU**. Une couleur fausse remet le décompte à zéro (−30 s). Suivent le décollage et la rentrée atmosphérique.

### Zone 4 — Terre

1. **Fouiller la capsule** (derrière le joueur) : batterie, corde et manuel. Le manuel donne la détresse militaire, **243 MHz**, et dit que la balise civile émet sur la moitié exacte.
2. Ramasser l'**antenne** près des arbres, à l'ouest.
3. **Réparer le pont** au nord avec la corde. La rivière est infranchissable sans lui.
4. **Énigme 6, logique.** 243 ÷ 2 = **121,5**. Régler la **balise** (sur le rocher, de l'autre côté) sur **121,5 MHz** et émettre. Le bruit ne baisse qu'à moins de 2 MHz de la cible. Une autre fréquence coûte 20 s.
5. Prendre le **pistolet de détresse** dans la caisse du refuge, au nord-ouest.
6. **Tirer la fusée à l'hélisurface**, au nord. L'hélicoptère arrive : fin.

Une partie parfaite, sans erreur ni indice et en passant les cinématiques, dure environ 10 à 13 minutes.

<a id="base-lunaire"></a>

## Base lunaire Séléné-7 : carte et exploration

Dans le menu, choisir **Base lunaire**, puis lancer la mission. Cette campagne se déroule sur un seul niveau à la surface de la Lune ; elle ne mène pas aux quatre zones de la station spatiale. Le départ se fait dans la **Chambre de relève**. L’objectif est de rétablir les systèmes, certifier la combinaison, ravitailler **LV-1**, puis rejoindre la fusée et autoriser son décollage.

### Agencement et accès

Vue schématique dans le même sens que le plan de la tablette (haut = nord du plan). Les modules de droite sont reliés au hub par des couloirs diagonaux ; le dessin ne représente pas les distances ni la rotation exacte des pièces.

```text
                          M-02 · CENTRALE
                                 |
                                 |              M-03 · SÉCURITÉ
                                 |             /
 M-01 · CHAMBRE ------------- HUB ROND --------
                                 |             \
                                 |              M-04 · COMBINAISONS
                                 |
                          M-05 · SAS
                                 |
 LV-1 · FUSÉE <---- passerelle extérieure
```

| Lieu | Position sur le plan | Condition d’accès / rôle |
|---|---|---|
| M-01 · Chambre de relève | Ouest | Pièce de départ ; résoudre le coffre pour en sortir. |
| M-00 · Nœud central | Centre | Distribue les cinq modules ; aucun terminal d’énigme. |
| M-02 · Centrale électrique | Nord | Accessible après le coffre ; liaison solaire, bus et thermique. |
| M-03 · Terminal de sécurité | Nord-est | Ouvert après les trois bus ; habilitations et radio. |
| M-04 · Salle des combinaisons | Sud-est | Porte ouverte après les habilitations ; filtration utilisable après la radio. |
| M-05 · Sas d’évacuation | Sud | Ouvert après la certification EVA ; rover et carburant. |
| LV-1 · Fusée | Sud-ouest, dehors | Sortie du sas ouverte après les cartouches ; suivre la passerelle vers la fusée. |

**Une porte ouverte ne signifie pas que tous les postes de sa pièce sont déjà utilisables.** Chaque terminal vérifie ses propres prérequis et les objets nécessaires. Les portes déverrouillées s’ouvrent à l’approche.

### Se repérer et conserver les informations

- **E** : ramasser un objet, lire une plaque ou ouvrir un terminal en le visant à proximité.
- **F** : allumer la lampe après l’avoir ramassée ; utile pour examiner les plaques et pendant les coupures de courant.
- **Tab → Plan** : voir les vrais modules, la position et l’orientation du joueur. Le plan ne liste pas les épreuves restantes.
- **H → Messages** : relire les documents déjà consultés. Une aide explicite se demande ici et peut coûter du temps.
- **Tablette → Messages** : les résultats archivés après validation (coffre, thermique, radio, pression) servent au départ.
- **I → Inventaire** : consulter les objets possédés. Pour les épreuves lunaires, il suffit d’avoir l’objet requis dans l’inventaire : aucune sélection à la molette ni pose manuelle n’est nécessaire.

### Où trouver les objets

Pour les indications **droite / gauche / fond** ci-dessous et dans le guide, se placer à la porte qui relie le module au hub, puis regarder vers le fond de la pièce. Cette convention reste la même même si le joueur arrive d’un autre côté.

| Objet | Emplacement | Utilité |
|---|---|---|
| Lampe torche | Chambre, sur les plans de travail à droite, vers le fond | Éclairer le décor et les documents. |
| Fusible | Chambre, sur les mêmes plans de travail, près de la lampe | Ouvrir le poste de liaison solaire. |
| Clé à molette | Chambre, sur les mêmes plans de travail, vers leur milieu | Utiliser le banc de pression. |
| Eau et piles | Chambre, sur les plans de travail à droite, vers l’entrée | Réserves de survie. |
| Cellule d’énergie | Centrale, sur le plan de travail à droite, près de l’entrée | Utiliser le calculateur des cartouches dans le sas. |
| Bouteille d’O₂ | Centrale, au sol à gauche, près de l’entrée | Réserve d’oxygène. |
| Antenne | Sécurité, sur le plan de travail à gauche, près de l’entrée | Utiliser le poste de triangulation radio. |
| Eau | Sécurité, sur le plan de travail à droite, près de l’entrée | Réserve de survie. |
| Piles | Combinaisons, sur le plan de travail à droite, près de l’entrée | Réserve pour la lampe. |
| Bouteille d’O₂ | Combinaisons, au sol à gauche, près de l’entrée | Réserve d’oxygène. |

Le fusible et la clé sont ramassables directement dans la chambre : ils ne sont pas à l’intérieur du coffre. Prendre les trois outils de départ avant de quitter cette pièce évite un retour inutile.

### Où trouver toutes les consignes

Les indices sont des plaques à lire avec **E**. Une fois lus, ils restent consultables dans les **Messages** de la tablette et la consigne associée apparaît dans le terminal concerné.

| Document | Emplacement dans la base | Épreuve concernée |
|---|---|---|
| Relève · manifeste des cratères | Chambre, au centre du mur du fond | Coffre de relève. |
| Centrale · schéma de secours | Centrale, sur le mur de droite, vers le milieu | Liaison solaire et trois bus. |
| Maintenance · échangeurs couplés | **Sécurité**, sur le mur de droite, près de l’entrée | Thermique de la **centrale** : il faut y retourner. |
| Sécurité · registre de relève | Sécurité, sur le mur de droite, plus loin vers le fond | Habilitations croisées. |
| Radio · relevé des balises | Sécurité, sur le mur de gauche, vers le milieu | Triangulation radio. |
| EVA · chaîne de filtration | Combinaisons, sur le mur de droite, vers le fond | Filtration. |
| EVA · banc de transfert | Combinaisons, sur le mur de droite, près de l’entrée | Réservoirs de pression. |
| EVA · protocole de certification | Combinaisons, sur le mur de gauche, vers le milieu | Certification EVA. |
| Sas · ravitaillement autonome | Sas, sur le mur de droite, vers le milieu | Trajet du rover. |
| Sas · calculateur de cartouches | Sas, sur le mur de gauche, vers le milieu | Calcul des cartouches. |
| Départ · autorisation à quatre chiffres | **Sas**, sur le mur de droite, près de l’entrée | Terminal final à côté de la **fusée**. |

<a id="solution-lunaire"></a>

## Base lunaire : solution complète des douze épreuves

**Cette section révèle les solutions.** Les chiffres du coffre et les valeurs du thermique, de la radio et du carburant changent d’une nouvelle partie à l’autre. Utiliser les relevés de la partie en cours, pas un code universel. La sauvegarde conserve ces valeurs et les réglages déjà effectués.

Ordre conseillé : **chambre → centrale (solaire, bus) → sécurité (lire toutes les plaques, prendre l’antenne, habilitations, radio) → centrale (thermique) → combinaisons → sas → fusée**. Penser à prendre la cellule dans la centrale. Sur chaque poste, cliquer sur **Vérifier le système** après le réglage ; un affichage correct seul ne valide pas l’épreuve. Une erreur entraîne une pénalité de base de 20 secondes, modifiée par la difficulté et le personnage.

### 1. Le coffre de relève — Chambre

**Poste :** au fond à gauche. **Indice :** manifeste au milieu du mur du fond. Aucun objet requis.

Classer les cratères par altitude croissante : **Shackleton (−900 m) → Copernic (+300 m) → Tycho (+1 200 m) → Kepler (+2 100 m)**. Relever le chiffre associé à chacun sur le manifeste et saisir ces quatre chiffres dans cet ordre, sans additionner les altitudes. La validation ouvre la sortie de la chambre et l’accès à la centrale. Conserver le **troisième chiffre du code**, celui de Tycho, pour l’autorisation finale.

### 2. La liaison solaire — Centrale

**Poste :** au fond à droite. **Indice :** schéma de secours sur le mur de droite. **Prérequis :** coffre résolu et **fusible de la chambre** dans l’inventaire.

Cliquer sur un segment le tourne d’un quart de tour. L’entrée se trouve à gauche de la case 1 ; la sortie à droite de la case 16. Numérotation de gauche à droite, puis de haut en bas :

```text
 1   2   3   4
 5   6   7   8
 9  10  11  12
13  14  15  16
```

Raccorder ce chemin : **entrée → 1 → 2 → 6 → 5 → 9 → 10 → 11 → 7 → 8 → 12 → 16 → sortie**. Chaque coude doit pointer vers la case précédente et la suivante. La case 1 est horizontale ; la case 16 relie le haut à la droite. Les cases barrées **3, 4, 13, 14 et 15** sont inutilisées. Tous les autres câbles doivent être raccordés. Le trajet alimenté devient vert et le message **« Liaison complète »** confirme le raccordement ; valider ensuite pour débloquer les bus.

### 3. Les trois bus électriques — Centrale

**Poste :** au centre du fond. **Indice :** même schéma de secours. **Prérequis :** liaison solaire validée.

Les six équipements consomment, dans leur ordre d’affichage, **2, 3, 4, 5, 6 et 7** unités. Affecter exactement deux équipements à chacun des bus, sans dépasser ni laisser incomplète sa capacité. Une solution est :

| Bus | Équipements à affecter | Somme |
|---|---|---|
| A | n° 1 (2 unités) et n° 6 (7 unités) | 9 |
| B | n° 3 (4 unités) et n° 5 (6 unités) | 10 |
| C | n° 2 (3 unités) et n° 4 (5 unités) | 8 |

Dans les six listes, choisir donc **A, C, B, C, B, A**. Valider ouvre la sécurité et rend le poste thermique utilisable. Aller lire les trois plaques de la sécurité et y prendre l’antenne avant de poursuivre.

### 4. Les échangeurs couplés — Centrale, avec un indice dans la sécurité

**Poste :** au fond à gauche de la centrale. **Indice :** « Maintenance · échangeurs couplés », dans la **sécurité**, mur de droite près de l’entrée. **Prérequis :** bus validés.

La fiche donne trois températures cibles, appelées ici **T1, T2, T3** dans leur ordre d’affichage. Les commandes A, B et C vont de 0 à 6 et doivent respecter : `T1 = A + 2B`, `T2 = B + 2C`, `T3 = C + 2A`.

Calculer les commandes ainsi :

```text
A = (T1 − 2 × T2 + 4 × T3) / 9
B = (T1 − A) / 2
C = (T2 − B) / 2
```

Saisir A, B et C, vérifier que les trois compteurs atteignent leur cible, puis valider. Par exemple, **des cibles 8 / 7 / 6** donnent **A = 2, B = 3, C = 2** ; cet exemple ne vaut que si ce sont les cibles de la partie. Conserver la **commande C**, pas le troisième compteur, pour le départ. Cette épreuve peut être faite après la radio, mais doit être terminée avant la certification EVA.

### 5. Les habilitations croisées — Sécurité

**Poste :** au fond à droite. **Indice :** registre de relève, mur de droite vers le fond. **Prérequis :** bus validés.

Utiliser les flèches pour obtenir **Maya → Kenji → Sam → Inès**. Maya est dans les deux premiers créneaux ; Kenji doit être après elle et avant Inès ; Sam précède immédiatement Inès et ne peut pas être deuxième. Cet ordre satisfait toutes les contraintes. Valider ouvre la porte des combinaisons et débloque la radio. La filtration attend encore la validation radio.

### 6. La triangulation radio — Sécurité

**Poste :** au fond à gauche. **Indice :** relevé des balises, mur de gauche. **Prérequis :** habilitations validées et **antenne** ramassée sur la table de cette pièce.

Le relevé donne trois sommes : **S1 = A + B**, **S2 = B + C**, **S3 = A + C**. Retrouver les canaux :

```text
A = (S1 + S3 − S2) / 2
B = S1 − A
C = S3 − A
```

Entrer les trois valeurs entières, entre 0 et 9, puis valider. Par exemple, **S1 = 9, S2 = 8, S3 = 7** donnent **A = 4, B = 5, C = 3**. Conserver le **canal B** pour le départ. La filtration devient utilisable.

### 7. La chaîne de filtration — Combinaisons

**Poste :** au fond à droite. **Indice :** chaîne de filtration, mur de droite vers le fond. **Prérequis :** radio validée.

Réordonner les filtres avec les flèches : **Grille → Cyclone → Ioniseur → Tamis → Carbone**. Le carbone termine la chaîne, le tamis suit immédiatement l’ioniseur, et le cyclone se place après la grille mais avant l’ioniseur. Valider débloque le banc de pression et réduit la consommation d’oxygène à l’intérieur des pièces.

### 8. Les réservoirs de pression — Combinaisons

**Poste :** au centre du fond. **Indice :** banc de transfert, mur de droite près de l’entrée. **Prérequis :** filtration validée et **clé à molette de la chambre**.

Les capacités A, B, C sont **8, 5, 3**. Partir de **8 / 0 / 0** et obtenir **4 / 4 / 0**. Cliquer sur les transferts ci-dessous ; chaque transfert remplit la destination ou vide la source, sans perdre de gaz. Si le banc a déjà été modifié, cliquer d’abord sur **Réinitialiser ce poste**.

| Étape | Transfert | A | B | C |
|---|---|---|---|---|
| Départ | — | 8 | 0 | 0 |
| 1 | A → B | 3 | 5 | 0 |
| 2 | B → C | 3 | 2 | 3 |
| 3 | C → A | 6 | 2 | 0 |
| 4 | B → C | 6 | 0 | 2 |
| 5 | A → B | 1 | 5 | 2 |
| 6 | B → C | 1 | 4 | 3 |
| 7 | C → A | 4 | 4 | 0 |

Valider. La quantité finale dans **A = 4** sera le dernier chiffre du code de départ.

### 9. La certification EVA — Combinaisons

**Poste :** au fond à gauche. **Indice :** protocole de certification, mur de gauche. **Prérequis :** pression **et thermique** validés. Si le poste reste bloqué après les réservoirs, retourner régler les échangeurs dans la centrale.

Mettre les opérations dans l’ordre **Balise → Clapet → Pompe → Test → Visière → Purge**, puis valider. La porte du sas d’évacuation se déverrouille.

### 10. Le trajet du rover ravitailleur — Sas

**Poste :** au fond à droite. **Indice :** ravitaillement autonome, mur de droite. **Prérequis :** certification EVA validée.

Sur la grille 5 × 5, partir du coin inférieur gauche, visiter **R1 et R2**, puis atteindre la fusée dans le coin supérieur droit, en évitant les cases hachurées. Réinitialiser le poste si des déplacements ont déjà été programmés, puis saisir : **Est → Nord → Nord → Est → Nord → Nord → Est → Est**, soit **→ ↑ ↑ → ↑ ↑ → →**. Ce trajet utilise huit déplacements sur les douze autorisés et passe par les deux relais. Valider débloque le calculateur des cartouches.

### 11. Le calcul des cartouches — Sas

**Poste :** au fond à gauche. **Indice :** calculateur de cartouches, mur de gauche. **Prérequis :** trajet du rover validé et **cellule d’énergie ramassée dans la centrale**.

Le document donne trois valeurs cibles, appelées ici **F1, F2, F3**. Les quantités A, B et C doivent respecter `F1 = A + 2B + C`, `F2 = B + 3C`, `F3 = 2A + B`.

```text
C = (F3 + 3 × F2 − 2 × F1) / 7
B = F2 − 3 × C
A = (F3 − B) / 2
```

Entrer les quantités entières, entre 0 et 8, vérifier les trois compteurs puis valider. Par exemple, **des cibles 12 / 12 / 9** donnent **A = 3, B = 3, C = 3**. La sortie extérieure s’ouvre. Avant de partir, lire la plaque **« Départ · autorisation à quatre chiffres »**, sur le mur de droite près de l’entrée du sas.

### 12. L’autorisation de décollage — Fusée LV-1

**Poste :** dehors, à côté de la fusée, au bout de la passerelle. **Indice :** protocole de départ lu dans le **sas**. **Prérequis :** cartouches validées ; les dépendances précédentes imposent d’avoir terminé les onze autres épreuves.

Sortir du sas par son extrémité opposée au hub. Suivre la passerelle vers le sud, puis vers l’ouest jusqu’à LV-1. Composer les quatre chiffres dans cet ordre :

1. Le **troisième chiffre du code du coffre** de relève.
2. La **commande C du thermique**.
3. Le **canal B de la radio**.
4. La quantité finale du **réservoir A**, soit **4**.

Les trois premières valeurs dépendent de la partie. Les retrouver dans **Tablette → Messages**, dans les transmissions « Résultat archivé » des épreuves correspondantes ; les terminaux validés permettent aussi de les consulter. Saisir les chiffres à la suite, sans séparateurs, puis valider : la cinématique de décollage se lance et mène au bilan de la mission lunaire.

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

### Mise en ligne sur Hostinger

Le site est en ligne sur `https://royalblue-wolverine-280146.hostingersite.com`.

**Mise à jour automatique à chaque push sur main.** Il n'y a rien à faire.

1. Le workflow GitHub `.github/workflows/deploy.yml` vérifie les types et compile le jeu.
2. Il envoie `dist/` sur la branche `hostinger` du dépôt (le site compilé, rien d'autre).
3. Sur Hostinger, une tâche Cron lance `api/deploy.php` toutes les 5 minutes. Elle est configurée dans hPanel → Avancé → Tâches Cron.
4. `deploy.php` compare la dernière version de la branche `hostinger` avec celle en ligne. Si elle est nouvelle, il la télécharge depuis GitHub et remplace les fichiers de `public_html`. Sinon, il ne fait rien.

`https://…/version.json` indique le commit en ligne. Le site est donc à jour au plus 5 minutes après la fin du workflow (onglet Actions de GitHub, 2 à 3 minutes). Il n'y a ni FTP ni mot de passe, et aucun secret GitHub n'est nécessaire.

**Mise à jour immédiate depuis un poste :**

```bash
npm run deploy
```

La commande fait la même chose, puis demande au serveur d'installer la version tout de suite, sans attendre le Cron. Elle a besoin du fichier `.deploy-token` à la racine du projet. Ce fichier n'est pas versionné : demander son contenu à Simon. Le même jeton est rangé sur le serveur hors du dossier web, dans `cosmotrap-data/deploy-token.txt`. Sans ce fichier, la commande envoie la branche et le Cron fait le reste.

**Base de données.** Il n'y a rien à configurer. Sans `config.local.php`, l'API crée une base SQLite dans `cosmotrap-data/`, à côté de `public_html` et donc jamais servie par le web. Les tables sont créées et migrées automatiquement, une seule fois par version du schéma. `https://…/api/health.php` indique si la base répond.

Pour passer sur MySQL, créer une base dans hPanel (Bases de données), puis le fichier `public_html/api/config.local.php`. Il n'est jamais écrasé par une mise à jour.

```php
<?php return ['driver' => 'mysql', 'host' => 'localhost', 'name' => 'u123_cosmo', 'user' => 'u123_cosmo', 'pass' => 'mot-de-passe'];
```

Les comptes existants restent alors dans l'ancienne base SQLite : il faut changer de base avant d'ouvrir le jeu au public.

**Ce que règlent les `.htaccess` :**

- `index.html` passe avant la page « Bientôt disponible » de Hostinger (`default.php`) ;
- types des fichiers `.glb` et `.hdr`, compression, cache d'un an sur les fichiers à empreinte ;
- l'en-tête `Authorization` (jeton de session) est transmis à PHP ;
- `config.php`, `config.local.php` et `db.php` ne sont jamais servis.

**Connexion Google (optionnelle).** Créer un identifiant OAuth « Application Web » dans Google Cloud. Le mettre dans `config.local.php` (`'google_client_id' => '…'`) et dans `.env` (`VITE_GOOGLE_CLIENT_ID=…`) avant le build. Sans cette configuration, le bouton Google affiche un message et la connexion par e-mail reste disponible.

**Mot de passe oublié.** L'e-mail part avec la fonction PHP `mail()`. Sur le domaine temporaire `hostingersite.com`, il peut arriver en spam ou ne pas partir. Avec un vrai nom de domaine, créer une adresse e-mail dans hPanel.

### Tests

```bash
PLAYWRIGHT_SOFTWARE=1 npx playwright test
```

`PLAYWRIGHT_SOFTWARE=1` active le rendu WebGL logiciel. Sans lui, le navigateur de test sans carte graphique affiche « Problème d’affichage 3D » et la plupart des tests échouent.

`tests/playthrough.spec.ts` crée un compte et joue toute la partie en se téléportant devant chaque objectif. Il résout les énigmes par l'interface et vérifie les verrous :

- l'ascenseur reste verrouillé avant la pressurisation ;
- le gaz brûle à chaque passage : 40 % de vie pour atteindre la vanne et le disjoncteur ;
- le sas reste fermé tant que le terminal n'est pas décodé ;
- la rivière est infranchissable avant le pont.

Il vérifie aussi les ressources à zéro, les pénalités, les indices, la limite de temps et l'inscription au classement, et prend une capture par zone dans `test-results/`.

## Équipe

Clément Volle (chef de projet), Simon Leplat (game design et scénario), Kilian Orsal (lead dev), Hamza Chaibrassou et Ethan Angot-Chabanol (graphisme et UX), Loïc Chauvelot (qualité et passation).

L'usage de l'IA est déclaré dans le registre IA (`livrables/L4_Produit`).
