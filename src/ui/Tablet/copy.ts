import { G } from '../../game/state'
import type { ZoneId } from '../../game/types'

const fr = {
  tabs: ['Plan', 'Journal', 'Messages', 'Inventaire'], terminal: 'TERMINAL PORTABLE · ÉQUIPAGE',
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
  alarm: 'ALARME · NIVEAU 1', blackout: 'ÉNERGIE COUPÉE', leak: 'FUITE D’AIR', noPower: 'ÉNERGIE COUPÉE',
  mapModes: 'Mode d’affichage', modes: ['Plan', 'Énergie', 'Oxygène'], pressure: 'Pression',
  legendSolved: 'Énigme résolue', legendCurrent: 'Énigme en cours', legendLocked: 'Module verrouillé', legendEvac: 'Évacuation', progressLabel: 'PROGRESSION',
  statusLocked: 'Module verrouillé', statusSolved: 'Énigme résolue', statusCurrent: 'Énigme en cours', moduleLocked: 'Module verrouillé',
  roomDone: 'Toutes les tâches de ce module sont terminées.', noRoomTask: 'Aucune tâche de mission dans ce module.',
  notebook: 'Carnet', puzzles: 'Énigmes', noNotes: 'Aucune note pour l’instant. Lis les panneaux, plaques et terminaux.', puzzleLocked: 'Verrouillée',
  baseMessages: 'Messages de la base', askHelp: 'Demander de l’aide', clickKey: 'Clic', wheelKey: 'Molette', selectModule: 'Sélectionner un module', zoomWord: 'Zoomer', pauseWord: 'Pause',
  tasks: 'Tâches du module', mistakes: 'Erreurs', hintsUsedLabel: 'Indices utilisés',
}
export const tabletText = () => fr
export const levelName = (z: ZoneId) => z < 3 ? `${tabletText().level} ${z}` : z === 3 ? tabletText().capsule : tabletText().earth
export const elapsed = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
