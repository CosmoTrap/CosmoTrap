import { G } from '../../game/state'
import type { ZoneId } from '../../game/types'

const fr = {
  tabs: ['Plan', 'Journal', 'Messages', 'Inventaire'], terminal: 'TERMINAL DE POIGNET · ÉQUIPAGE',
  level: 'Niveau', capsule: 'Hermès', earth: 'Terre', close: 'Ranger la tablette', raising: 'Connexion au terminal de poignet…',
  clock: 'CHRONO', map: 'VUE DE DESSUS', locate: 'Me localiser', zoomIn: 'Agrandir', zoomOut: 'Réduire',
  you: 'Ta position', visited: 'Exploré', unknown: 'Non exploré', locked: 'Accès verrouillé', unlocked: 'Accès ouvert',
  select: 'Sélectionne une pièce', module: 'MODULE', power: 'Éclairage', on: 'En service', off: 'Secours / hors tension',
  objects: 'Points repérés', location: 'Localisation', coordinates: 'Coordonnées', otherLevel: 'Tu te trouves sur un autre niveau.',
  current: 'Objectif actuel', missions: 'Journal de mission', allMissions: 'Toutes les étapes du voyage',
  remaining: 'à accomplir', complete: 'Terminé', pending: 'À faire', progress: 'Progression', journal: 'Consulter le journal',
  hint: 'Assistance', hints: 'Indices et pénalités', noMission: 'Toutes les étapes de cette zone sont terminées.',
  communications: 'Communications archivées', all: 'Tout', radio: 'Radio', system: 'Système', document: 'Documents',
  empty: 'Aucun message reçu', emptyDetail: 'Les transmissions, notifications et documents reçus apparaîtront ici.',
  messageHelp: 'Les messages reçus restent consultables après leur disparition à l’écran.',
  received: 'Réception', archive: 'Archive', saved: 'Historique conservé dans la sauvegarde',
  selectRoom: 'Choisir une pièce', scroll: 'Molette : zoom', navigate: 'Clic : sélectionner',
  mapHelp: 'Plan de la station · objets visibles dans les zones explorées',
  survival: 'Équipement de survie', briefing: 'Dossier de mission',
}
const en: typeof fr = {
  tabs: ['Map', 'Journal', 'Messages', 'Inventory'], terminal: 'WRIST TERMINAL · CREW',
  level: 'Level', capsule: 'Hermes', earth: 'Earth', close: 'Lower tablet', raising: 'Connecting wrist terminal…',
  clock: 'TIME', map: 'TOP VIEW', locate: 'Locate me', zoomIn: 'Zoom in', zoomOut: 'Zoom out',
  you: 'Your position', visited: 'Explored', unknown: 'Unexplored', locked: 'Access locked', unlocked: 'Access open',
  select: 'Select a room', module: 'MODULE', power: 'Lighting', on: 'Online', off: 'Backup / offline',
  objects: 'Located points', location: 'Location', coordinates: 'Coordinates', otherLevel: 'You are on another level.',
  current: 'Current objective', missions: 'Mission journal', allMissions: 'Every stage of your journey',
  remaining: 'remaining', complete: 'Completed', pending: 'To do', progress: 'Progress', journal: 'Open journal',
  hint: 'Assistance', hints: 'Hints and penalties', noMission: 'Every objective in this zone is complete.',
  communications: 'Archived communications', all: 'All', radio: 'Radio', system: 'System', document: 'Documents',
  empty: 'No messages received', emptyDetail: 'Received transmissions, notifications and documents will appear here.',
  messageHelp: 'Received messages stay available after disappearing from the screen.',
  received: 'Received', archive: 'Archive', saved: 'History kept in your saved game',
  selectRoom: 'Choose a room', scroll: 'Wheel: zoom', navigate: 'Click: select',
  mapHelp: 'Station plan · items shown in explored areas',
  survival: 'Survival equipment', briefing: 'Mission dossier',
}
export const tabletText = () => G().settings.lang === 'en' ? en : fr
export const levelName = (z: ZoneId) => z < 3 ? `${tabletText().level} ${z}` : z === 3 ? tabletText().capsule : tabletText().earth
export const elapsed = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
