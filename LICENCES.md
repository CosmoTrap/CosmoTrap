# Licences et crédits

| Ressource | Auteur | Licence |
|---|---|---|
| Code du jeu, shaders, textures procédurales, modèles 3D en code | Cosmo Team | Propriété de l'équipe |
| Logo et planches de personnages (`public/logo`, `public/characters`, `assets/`) | Cosmo Team | Propriété de l'équipe |
| Musique et bruitages (synthèse Web Audio générée par le code, thèmes « orgue cosmique » originaux) | Cosmo Team | Propriété de l'équipe |
| Textures PBR, HDRI et modèles 3D (`public/assets/tex`, `hdri`, `models`) — [Poly Haven](https://polyhaven.com) | Poly Haven et ses artistes | CC0 (domaine public) |
| Cartes planétaires (Lune, Terre, Saturne, Voie lactée — `public/assets/planets`) — [Solar System Scope](https://www.solarsystemscope.com/textures/) | INOVE | CC BY 4.0 |
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
Le mobilier et le feuillage de la partie restent procéduraux ; les modèles complémentaires et le fond lunaire utilisent aussi les ressources de `public/assets/`.

Les ressources Poly Haven et Solar System Scope sont téléchargées par `npm run assets` (scripts `fetch-assets.mjs`, `prepare-textures.py`, `decimate-trees.mjs`), puis redimensionnées et compressées pour le web.
Les fichiers ElevenLabs ont été générés sur le forfait gratuit : usage non commercial, avec attribution (affichée dans les crédits du jeu). Pour un usage commercial, régénérer avec un forfait payant.
