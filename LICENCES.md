# Licences et crédits

| Ressource | Auteur | Licence |
|---|---|---|
| Code du jeu, shaders, textures procédurales, modèles 3D en code | Cosmo Team | Propriété de l'équipe |
| Logo et planches de personnages (`public/logo`, `public/characters`, `assets/`) | mo Team | Propriété de l'équipe |
| Musique et bruitages (synthèse Web Audio générée par le code, thèmes « orgue cosmique » originaux) | Cosmo Team | Propriété de l'équipe |
| Textures PBR, HDRI et modèles 3D (`public/assets/tex`, `hdri`, `models`) — [Poly Haven](https://polyhaven.com) | Poly Haven et ses artistes | CC0 (domaine public) |
| Cartes planétaires (Lune, Terre, Saturne, Voie lactée — `public/assets/planets`) — [Solar System Scope](https://www.solarsystemscope.com/textures/) | INOVE | CC BY 4.0 |
| Photos affichées aux murs (`public/assets/photos`) : Earthrise (Apollo 8), Terre vue d'Apollo 17, Buzz Aldrin sur la Lune (Apollo 11), décollage d'Apollo 11 — [NASA](https://www.nasa.gov/nasa-brand-center/images-and-media/), via Wikimedia Commons | NASA | Domaine public |
| Voix (répliques FR / EN) et bruitages réalistes (`public/audio`) — générés avec ElevenLabs (`npm run audio`) | Cosmo Team via ElevenLabs | Licence d'usage ElevenLabs (attribution requise sur le forfait gratuit : « Voix et sons : ElevenLabs ») |
| Polices Outfit, Rajdhani, Inter, JetBrains Mono (Google Fonts) | Leurs auteurs | SIL Open Font License 1.1 |
| three.js, React Three Fiber, drei, postprocessing, Rapier, zustand, howler | Leurs auteurs | MIT / Apache 2.0 |

Les textures PBR de `public/textures/` proviennent de **[Poly Haven](https://polyhaven.com)**, sous **[CC0 1.0](https://polyhaven.com/license)** :

| Surface | Ressource originale |
|---|---|
| Métal (normales et rugosité) | [Rusty Metal 04](https://polyhaven.com/a/rusty_metal_04) |
| Tissu (normales et rugosité) | [Fabric Pattern 07](https://polyhaven.com/a/fabric_pattern_07) |
| Sol extérieur | [Forest Ground 04](https://polyhaven.com/a/forest_ground_04) |
| Roche | [Rock Face](https://polyhaven.com/a/rock_face) |
| Bois | [Wood Planks Grey](https://polyhaven.com/a/wood_planks_grey) |
| Écorce | [Pine Bark](https://polyhaven.com/a/pine_bark) |

Les fichiers 1K sont servis localement, sans appel à Poly Haven pendant une partie.
`public/textures/sources.json` conserve les URL originales, tailles et empreintes SHA256.
Le script d'import hors ligne `scripts/fetch-materials.mjs` utilise l'API Poly Haven — Powered by Poly Haven.
Une partie du mobilier et le feuillage restent procéduraux ; les modèles complémentaires et le fond lunaire utilisent aussi les ressources de `public/assets/`.

### Fond étoilé de la tablette

`public/menu/starfield.jpg` : image fournie par l'équipe, générée avec Gemini (Google).

`public/menu/lunar-surface.jpg` (fond du plan de la base lunaire dans la tablette) : image fournie par l'équipe, générée avec Gemini (Google).

### Combinaisons spatiales et hologramme

Modèle **Z2 Spacesuit** de **[NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources)**, importé par `scripts/fetch-interior-models.mjs` puis compressé. Crédit : NASA.
Les contenus de la NASA ne sont en général pas soumis au droit d'auteur aux États-Unis, selon ses [règles d'utilisation](https://www.nasa.gov/nasa-brand-center/images-and-media) : la NASA doit être citée comme source, ses logos ne sont pas dans le domaine public, et aucune utilisation ne doit laisser croire à son soutien. Ce projet n'est ni soutenu ni approuvé par la NASA.

### Mobilier d'intérieur de la base

Importé de **[Poly Haven](https://polyhaven.com)** par `scripts/fetch-interior-models.mjs`, sous **[CC0 1.0](https://polyhaven.com/license)** (domaine public) : usage libre, y compris commercial, sans attribution obligatoire. Les auteurs sont cités ici par courtoisie. Les fichiers sont compressés et servis localement.

| Modèle | Auteur | Licence |
|---|---|---|
| [Potted Plant 04](https://polyhaven.com/a/potted_plant_04) | James Ray Cock | CC0 1.0 |
| [Seadogs Compass](https://polyhaven.com/a/seadogs_compass) | Benny Weimer | CC0 1.0 |
| [Chess Set](https://polyhaven.com/a/chess_set) | Riley Queen | CC0 1.0 |
| [Pot Enamel 01](https://polyhaven.com/a/pot_enamel_01) | Kuutti Siitonen | CC0 1.0 |
| [Metal Jug](https://polyhaven.com/a/metal_jug) | Anzor Lezhava | CC0 1.0 |
| [Plastic Bottle Gallon](https://polyhaven.com/a/plastic_bottle_gallon) | Rahul Chaudhary | CC0 1.0 |
| [Sofa 02](https://polyhaven.com/a/sofa_02) | Kirill Sannikov | CC0 1.0 |
| [Modern Coffee Table 01](https://polyhaven.com/a/modern_coffee_table_01) | Amin | CC0 1.0 |
| [Modern Arm Chair 01](https://polyhaven.com/a/modern_arm_chair_01) | Vibrant Nordic | CC0 1.0 |
| [Side Table 01](https://polyhaven.com/a/side_table_01) | James Ray Cock | CC0 1.0 |
| [Desk Lamp Arm 01](https://polyhaven.com/a/desk_lamp_arm_01) | Yann Kervran, Kuutti Siitonen | CC0 1.0 |
| [Standing Picture Frame 01](https://polyhaven.com/a/standing_picture_frame_01) | James Ray Cock | CC0 1.0 |
| [Cassette Player](https://polyhaven.com/a/cassette_player) | Oday Abuzaeed | CC0 1.0 |
| [Dartboard](https://polyhaven.com/a/dartboard) | Satyaki Mandal | CC0 1.0 |
| [Drawer Cabinet](https://polyhaven.com/a/drawer_cabinet) | Ulan Cabanilla | CC0 1.0 |
| [Wheelchair 01](https://polyhaven.com/a/wheelchair_01) | Garreth Dean | CC0 1.0 |
| [Multi Cleaner Bottle](https://polyhaven.com/a/multi_cleaner_bottle) | James Ray Cock | CC0 1.0 |
| [Multi Cleaner 5 Litre](https://polyhaven.com/a/multi_cleaner_5_litre) | James Ray Cock | CC0 1.0 |
| [Cardboard Box 01](https://polyhaven.com/a/cardboard_box_01) | Rahul Chaudhary | CC0 1.0 |
| [Steel Frame Shelves 02](https://polyhaven.com/a/steel_frame_shelves_02) | James Ray Cock | CC0 1.0 |
| [Barrel 03](https://polyhaven.com/a/barrel_03) | Serhii Khromov | CC0 1.0 |
| [Dining Chair 02](https://polyhaven.com/a/dining_chair_02) | James Ray Cock | CC0 1.0 |
| [Magnifying Glass 01](https://polyhaven.com/a/magnifying_glass_01) | Nazar Borodavka | CC0 1.0 |
| [Spray Paint Bottles](https://polyhaven.com/a/spray_paint_bottles) | James Ray Cock | CC0 1.0 |
| [Planter Box 02](https://polyhaven.com/a/planter_box_02) | James Ray Cock | CC0 1.0 |
| [Planter Pot Clay](https://polyhaven.com/a/planter_pot_clay) | Amal Kumar | CC0 1.0 |
| [Watering Can Metal 01](https://polyhaven.com/a/watering_can_metal_01) | Charles Nderitu | CC0 1.0 |
| [Trowel 01](https://polyhaven.com/a/trowel_01) | Satyaki Mandal | CC0 1.0 |
| [Garden Gloves 01](https://polyhaven.com/a/garden_gloves_01) | Satyaki Mandal | CC0 1.0 |
| [Compost Bag 02](https://polyhaven.com/a/compost_bag_02) | Satyaki Mandal | CC0 1.0 |
| [Vintage Electric Kettle](https://polyhaven.com/a/vintage_electric_kettle) | SV Garip | CC0 1.0 |
| [Long Life Food](https://polyhaven.com/a/long_life_food) | Mia Pecina Zorko | CC0 1.0 |
| [Russian Food Cans 01](https://polyhaven.com/a/russian_food_cans_01) | Kosan Aziz | CC0 1.0 |
| [Plastic Thermos](https://polyhaven.com/a/plastic_thermos) | PierreB3D | CC0 1.0 |
| [Wooden Cutting Board](https://polyhaven.com/a/wooden_cutting_board) | Kuutti Siitonen | CC0 1.0 |
| [Clipboard](https://polyhaven.com/a/clipboard) | ProgrammerOnCoffee | CC0 1.0 |
| [Binder Notebook](https://polyhaven.com/a/binder_notebook) | DaDrood | CC0 1.0 |
| [Stationery Supplies](https://polyhaven.com/a/stationery_supplies) | Mateusz Sadek | CC0 1.0 |
| [Plastic Broom](https://polyhaven.com/a/plastic_broom) | L | CC0 1.0 |
| [Dustpan](https://polyhaven.com/a/dustpan) | Balen | CC0 1.0 |
| [Trashbag](https://polyhaven.com/a/trashbag) | Benny Weimer | CC0 1.0 |
| [Fire Alarm](https://polyhaven.com/a/fire_alarm) | Slinc | CC0 1.0 |
| [Vintage Crutches 01](https://polyhaven.com/a/vintage_crutches_01) | James Ray Cock | CC0 1.0 |
| [Metal Stool 02](https://polyhaven.com/a/metal_stool_02) | Ulan Cabanilla | CC0 1.0 |
| [Bunsen Burner](https://polyhaven.com/a/bunsen_burner) | BKS | CC0 1.0 |
| [Plastic Crate 02](https://polyhaven.com/a/plastic_crate_02) | Fabi_G | CC0 1.0 |
| [Plastic Container](https://polyhaven.com/a/plastic_container) | PierreB3D | CC0 1.0 |
| [Metal Toolbox](https://polyhaven.com/a/metal_toolbox) | Mateusz Sadek | CC0 1.0 |
| [Metal Jerrycan Green](https://polyhaven.com/a/metal_jerrycan_green) | Ulan Cabanilla | CC0 1.0 |
| [Plastic Jerrycan](https://polyhaven.com/a/plastic_jerrycan) | Ulan Cabanilla | CC0 1.0 |
| [Small Lpg Tank](https://polyhaven.com/a/small_lpg_tank) | Ulan Cabanilla | CC0 1.0 |
| [Hand Truck](https://polyhaven.com/a/hand_truck) | Mutanzom3D | CC0 1.0 |
| [Industrial Storage Cart](https://polyhaven.com/a/industrial_storage_cart) | Jule Bielitz | CC0 1.0 |
| [Utility Box 02](https://polyhaven.com/a/utility_box_02) | James Ray Cock | CC0 1.0 |
| [Circuit Board](https://polyhaven.com/a/circuit_board) | Benny Weimer | CC0 1.0 |
| [Retro Multimeter](https://polyhaven.com/a/retro_multimeter) | elli moeller | CC0 1.0 |
| [Pliers](https://polyhaven.com/a/pliers) | PierreB3D | CC0 1.0 |
| [Screwdrivers 02](https://polyhaven.com/a/screwdrivers_02) | BKS | CC0 1.0 |
| [Combination Wrench](https://polyhaven.com/a/combination_wrench) | BKS | CC0 1.0 |
| [Old Drill Press](https://polyhaven.com/a/old_drill_press) | Harsh Vardhan Singh | CC0 1.0 |
| [Portable Welding Cart](https://polyhaven.com/a/portable_welding_cart) | Georgii Gorbunov | CC0 1.0 |
| [Exterior Aircon Unit](https://polyhaven.com/a/exterior_aircon_unit) | Monsta3D | CC0 1.0 |
| [Bench Vice 01](https://polyhaven.com/a/bench_vice_01) | Yann Kervran, Antanas Kep | CC0 1.0 |
| [Small Oil Can 01](https://polyhaven.com/a/small_oil_can_01) | Raven van de Werken | CC0 1.0 |
| [Measuring Tape 01](https://polyhaven.com/a/measuring_tape_01) | Kuutti Siitonen | CC0 1.0 |
| [Drill 01](https://polyhaven.com/a/Drill_01) | Fernando Quinn | CC0 1.0 |
| [Ladder Sectioned 01](https://polyhaven.com/a/ladder_sectioned_01) | MP | CC0 1.0 |
| [Lubricant Spray](https://polyhaven.com/a/lubricant_spray) | James Ray Cock | CC0 1.0 |
| [Industrial Wall Lamp](https://polyhaven.com/a/industrial_wall_lamp) | Kuutti Siitonen | CC0 1.0 |

Les ressources Poly Haven et Solar System Scope sont téléchargées par `npm run assets` (scripts `fetch-assets.mjs`, `prepare-textures.py`, `decimate-trees.mjs`), puis redimensionnées et compressées pour le web.
Les fichiers ElevenLabs ont été générés sur le forfait gratuit : usage non commercial, avec attribution (affichée dans les crédits du jeu). Pour un usage commercial, régénérer avec un forfait payant.
