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

Les ressources Poly Haven et Solar System Scope sont téléchargées par `npm run assets` (scripts `fetch-assets.mjs`, `prepare-textures.py`, `decimate-trees.mjs`), puis redimensionnées et compressées pour le web.
Les fichiers ElevenLabs ont été générés sur le forfait gratuit : usage non commercial, avec attribution (affichée dans les crédits du jeu). Pour un usage commercial, régénérer avec un forfait payant.
