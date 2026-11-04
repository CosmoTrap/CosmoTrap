export type ZoneId = 1 | 2 | 3 | 4

export const FLAGS = [
  'read_board',
  'lockerOpen',
  'door_d1',
  'pressurized',
  'steamFixed',
  'power',
  'pw_lights',
  'pw_o2',
  'pw_terminal',
  'pw_sas',
  'readTerminal',
  'engine',
  'capsule',
  'bridge',
  'beacon',
] as const
export type Flag = (typeof FLAGS)[number]
export type Flags = Record<Flag, boolean>

export type ItemId =
  // ressources
  | 'o2'
  | 'battery'
  | 'water'
  // objets clés
  | 'lamp'
  | 'badge'
  | 'fuse'
  | 'wrench'
  | 'cell'
  | 'rope'
  | 'carBattery'
  | 'antenna'
  | 'manual'
  | 'flareGun'
  // survie (11)
  | 'ration'
  | 'medkit'
  | 'blanket'
  | 'multitool'
  | 'purifier'
  | 'tape'
  | 'compass'
  | 'whistle'
  | 'mirror'
  | 'lighter'
  | 'map'

export type ItemKind = 'resource' | 'key' | 'survival'

export type Wall = 'N' | 'S' | 'E' | 'W'

export type DotKind = 'key' | 'res' | 'surv' | 'exam' | 'exit'

export type PuzzleId = 'keypad' | 'valves' | 'power' | 'sequence' | 'radio' | 'algo' | 'plan' | 'dilemma'

/** Objet interactif placé dans une map. */
export interface Ent {
  id: string
  /** modèle 3D à afficher (voir world/props) */
  model: string
  /** position en tuiles (zones 1-3) : centre de la tuile = (tx*2+1, tz*2+1) */
  tile?: [number, number]
  /** position monde (zone 4, ou ajustement fin) */
  pos?: [number, number, number]
  /** collé contre ce mur de la tuile */
  wall?: Wall
  /** hauteur (m) pour les objets muraux / posés */
  y?: number
  /** rotation Y (rad) quand pas de mur */
  rot?: number
  /** objet ramassé */
  item?: ItemId
  /** point sur la mini-carte */
  dot?: DotKind
  /** taille de la zone de détection (m) */
  hit?: [number, number, number]
}

export interface Prop {
  model: string
  /** identifiant stable du mobilier poussable, utilisé pour sa sauvegarde */
  pushable?: string
  tile?: [number, number]
  pos?: [number, number, number]
  wall?: Wall
  y?: number
  rot?: number
  /** décalage local (x,z) en m dans le repère de la tuile */
  off?: [number, number]
  scale?: number
  color?: string
}

export interface DoorDef {
  id: string
  tile: [number, number]
}

export interface RoomDef {
  id: string
  name: string
  shape?: 'round'
  /** rectangle en tuiles : x0, z0, x1, z1 (inclus) */
  rect: [number, number, number, number]
  /** pièce sombre (lampe nécessaire pour lire / ramasser) */
  dark?: boolean
  /** couleur de l'éclairage plafond */
  light?: string
  /** intensité (candela) */
  intensity?: number
  /** pas de lumière dynamique dans cette pièce (néons émissifs seulement) */
  noDynLight?: boolean
  /** néons défaillants qui grésillent */
  flicker?: boolean
  /** palette de murs */
  theme?: 'station' | 'lab' | 'machine' | 'rocket' | 'green'
}

export interface GridMap {
  zone: ZoneId
  grid: string[]
  rooms: RoomDef[]
  doors: DoorDef[]
  ents: Ent[]
  props: Prop[]
  spawn: { tile: [number, number]; yaw: number }
  /** direction du soleil (vers le soleil) */
  sun: [number, number, number]
  exterior: 'moon' | 'asteroids' | 'earthrise'
}
