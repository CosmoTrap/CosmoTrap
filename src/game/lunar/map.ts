import type { Ent, GridMap, Prop, RoomDef } from '../types'

export const HUB = [41, 41] as const
/** A wall of a module: front faces the hub and holds the door, back is the far end. */
export type Face = 'front' | 'back' | 'left' | 'right'
/** Portholes, by wall and position along it (module x for front/back, module z for the sides).
 * Chosen between the furniture: nothing ever stands in front of a window. */
type WindowDef = [Face, number]
export const MODULES = ([
  { id: 'habitat', name: 'Chambre de relève', center: [17, 41], width: 14, depth: 10, light: '#ffe2c0', theme: 'station',
    windows: [['back', -2.6], ['back', 2.1], ['left', 2.6], ['right', -3.9]] as WindowDef[] },
  { id: 'power', name: 'Centrale électrique', center: [41, 15], width: 16, depth: 11, light: '#ffd9a8', theme: 'machine',
    windows: [['back', -2.5], ['back', 2.5], ['left', 3.0], ['right', 0.6]] as WindowDef[] },
  { id: 'security', name: 'Terminal de sécurité', center: [66, 27], width: 13, depth: 10, light: '#cfe6ff', theme: 'lab',
    windows: [['left', 3.4], ['right', 1.9]] as WindowDef[] },
  { id: 'eva', name: 'Salle des combinaisons', center: [66, 55], width: 15, depth: 10, light: '#d8f3ec', theme: 'lab',
    windows: [['back', -2.25], ['back', 2.25], ['left', 3.4], ['right', 3.7]] as WindowDef[] },
  { id: 'airlock', name: 'Sas d’évacuation', center: [41, 68], width: 12, depth: 10, light: '#ffe0c8', theme: 'rocket',
    windows: [['left', 2.6], ['right', 2.6]] as WindowDef[] },
] satisfies { id: string; name: string; center: [number, number]; width: number; depth: number; light: string; theme: NonNullable<RoomDef['theme']>; windows: WindowDef[] }[])
  .map(m => ({ ...m, angle: Math.atan2(m.center[0] - HUB[0], m.center[1] - HUB[1]), distance: Math.hypot(m.center[0] - HUB[0], m.center[1] - HUB[1]) }))
export type LunarModule = typeof MODULES[number]
export const ROCKET = [23, 79] as const
/** Where the launch pad's control desk stands, clear of the rocket's fins and of the walkway. */
export const LAUNCH_DESK = [ROCKET[0] + 6.5, ROCKET[1] - 1.6] as const
export function inModule(m: LunarModule, x: number, z: number, margin = 0) {
  const dx = x - m.center[0], dz = z - m.center[1], c = Math.cos(m.angle), s = Math.sin(m.angle)
  return Math.abs(dx * c - dz * s) <= m.width / 2 + margin && Math.abs(dx * s + dz * c) <= m.depth / 2 + margin
}
export function localPoint(id: string, x: number, y: number, z: number): [number, number, number] {
  const m = MODULES.find(m => m.id === id)!, c = Math.cos(m.angle), s = Math.sin(m.angle)
  return [m.center[0] + x * c + z * s, y, m.center[1] - x * s + z * c]
}
const mod = (id: string) => MODULES.find(m => m.id === id)!
/** Free-standing prop, in module coordinates. */
const prop = (room: string, model: string, x: number, z: number, y = 0, rot = 0): Prop => ({ model, pos: localPoint(room, x, y, z), rot: mod(room).angle + rot })
/** Prop backed against a wall, facing into the room; `along` as for windows. */
function wall(room: string, model: string, face: Face, along: number, y = 0): Prop {
  const { width: w, depth: d } = mod(room), inset = 0.03
  const [x, z, rot] = face === 'back' ? [along, d / 2 - inset, Math.PI] : face === 'front' ? [along, -d / 2 + inset, 0]
    : face === 'left' ? [-w / 2 + inset, along, Math.PI / 2] : [w / 2 - inset, along, -Math.PI / 2]
  return prop(room, model, x, z, y, rot)
}
const terminal = (room: string, id: string, x: number, z: number, rot = Math.PI): Ent => ({ id: `l_${id}`, model: 'lunarTerminal', pos: localPoint(room, x, 0, z), rot: mod(room).angle + rot, dot: 'key', hit: [1.3, 1.8, 0.5] })
/** A instruction plate on a wall, at reading height. */
function note(room: string, id: string, face: Face, along: number): Ent {
  const { width: w, depth: d } = mod(room), off = 0.06
  const [x, z, rot] = face === 'back' ? [along, d / 2 - off, Math.PI] : face === 'front' ? [along, -d / 2 + off, 0]
    : face === 'left' ? [-w / 2 + off, along, Math.PI / 2] : [w / 2 - off, along, -Math.PI / 2]
  return { id: `ln_${id}`, model: 'lunarNote', pos: localPoint(room, x, 1.35, z), y: 1.35, rot: mod(room).angle + rot, dot: 'exam', hit: [0.65, 0.55, 0.24] }
}
const item = (room: string, id: string, type: NonNullable<Ent['item']>, x: number, z: number, y = 0.9): Ent => ({ id: `li_${['o2', 'water', 'battery'].includes(type) ? room + '_' : ''}${id}`, model: type, item: type, pos: localPoint(room, x, y, z), rot: mod(room).angle, dot: ['o2', 'water', 'battery'].includes(type) ? 'res' : 'key' })

export const lunarHub: RoomDef = { id: 'l_hub', name: 'Nœud central', shape: 'round', rect: [17, 17, 23, 23], light: '#dfe9ff', intensity: 10,
  exits: MODULES.map(m => ({ angle: (m.angle + Math.PI * 2) % (Math.PI * 2), label: m.name.toUpperCase() })).sort((a, b) => a.angle - b.angle) }
export const lunarMap: GridMap = {
  zone: 1, sun: [0.65, 0.42, -0.7], exterior: 'moon',
  // The lunar renderer uses exact rotated modules. This coarse footprint is
  // only for exploration bookkeeping; movement uses the real colliders.
  grid: Array.from({ length: 46 }, () => '.'.repeat(46)),
  rooms: [lunarHub, ...MODULES.map(m => ({ id: m.id, name: m.name, rect: [Math.floor((m.center[0] - 9) / 2), Math.floor((m.center[1] - 9) / 2), Math.floor((m.center[0] + 9) / 2), Math.floor((m.center[1] + 9) / 2)] as [number, number, number, number], light: m.light, intensity: 9, theme: m.theme as RoomDef['theme'] }))],
  doors: [], spawn: { tile: [8, 20], yaw: -Math.PI / 2 },
  ents: [
    // M-01 · Chambre : couchettes à gauche, coin repas à droite, bureau et casiers.
    terminal('habitat', 'manifest', 4.4, 4.4), note('habitat', 'relief', 'back', 0),
    ...([['lamp', 2.6], ['fuse', 1.6], ['wrench', 0.6], ['water', -0.4], ['battery', -1.4]] as const)
      .map(([type, z]) => item('habitat', type, type, 6.62, z, 0.95)),
    // M-02 · Centrale : trois bancs de commande sous les turbines.
    terminal('power', 'circuit', -5, 4.9), terminal('power', 'loads', 0, 4.9), terminal('power', 'thermal', 5, 4.9),
    note('power', 'solar', 'left', 0), item('power', 'cell', 'cell', -7.6, -3.4, 0.95),
    item('power', 'o2', 'o2', 6.2, -4.2, 0),
    // M-03 · Sécurité : deux postes sous les écrans, baies serveurs à droite.
    terminal('security', 'identity', -3, 4.4), terminal('security', 'signal', 3, 4.4),
    note('security', 'crew', 'left', 1), note('security', 'thermal', 'left', -2), note('security', 'radio', 'right', 0.4),
    item('security', 'antenna', 'antenna', 6.2, 3.7, 0.95), item('security', 'water', 'water', -5.95, -3.7, 0.95),
    // M-04 · Combinaisons : rangée de scaphandres, colonne d'oxygène.
    terminal('eva', 'filters', -4.5, 4.4), terminal('eva', 'pressure', 0, 4.4), terminal('eva', 'checklist', 4.5, 4.4),
    note('eva', 'filters', 'left', 1), note('eva', 'pressure', 'left', -2), note('eva', 'eva', 'right', 0.6),
    item('eva', 'o2', 'o2', 2.8, -3.8, 0), item('eva', 'battery', 'battery', -6.95, -3.8, 0.95),
    // M-05 · Sas : trappe de sortie au fond, entre ses deux rails.
    terminal('airlock', 'route', -3.8, 3.8), terminal('airlock', 'fuel', 3.8, 3.8),
    note('airlock', 'route', 'left', 0), note('airlock', 'fuel', 'right', 0), note('airlock', 'departure', 'left', -2.5),
    { id: 'l_launch', model: 'lunarTerminal', pos: [LAUNCH_DESK[0], 0, LAUNCH_DESK[1]], rot: Math.PI / 2, dot: 'exit', hit: [1.4, 1.8, 0.8] },
  ],
  props: [
    // M-01 · Chambre
    wall('habitat', 'bunk', 'left', -3.0), wall('habitat', 'bunk', 'left', -0.75),
    ...[-6.2, -5.55, -4.9].map(x => wall('habitat', 'personalLocker', 'back', x)),
    ...[2.2, 0.2, -1.8].map(z => wall('habitat', 'counterLow', 'right', z)), wall('habitat', 'fridge', 'right', 3.9),
    prop('habitat', 'table', -3.2, 2.4), prop('habitat', 'chair', -3.7, 1.75), prop('habitat', 'chair', -2.7, 3.05, 0, Math.PI),
    wall('habitat', 'desk', 'front', -4.6), prop('habitat', 'chair', -4.6, -4.0, 0, Math.PI),
    wall('habitat', 'photos', 'front', 3.6, 1.5), prop('habitat', 'plant', 6.2, -4.3), wall('habitat', 'screen', 'front', -2.3, 1.55),
    // M-02 · Centrale
    ...[-5, 0, 5].map(x => prop('power', 'turbine', x, 1.3)),
    wall('power', 'breakerRow', 'right', -2.0, 1.25), wall('power', 'batteryGauge', 'right', 2.6),
    wall('power', 'counterLow', 'left', -3.4), prop('power', 'generator', -4.6, -4.4),
    prop('power', 'gasTank', 7.2, 4.5), prop('power', 'gasTank', 7.2, 3.8), wall('power', 'toolChest', 'front', 4.6),
    // M-03 · Sécurité
    wall('security', 'wallDisplays', 'back', 0, 2.3),
    ...[-4.1, -3.45, -2.8, -2.15].map(z => wall('security', 'serverRack', 'right', z)), wall('security', 'cabinet', 'right', 3.7),
    wall('security', 'counterLow', 'left', -3.7), wall('security', 'workstation', 'front', -3.6), prop('security', 'chair', -3.6, -4.0, 0, Math.PI),
    wall('security', 'elecCabinet', 'front', 4.2), prop('security', 'holoProjector', 0, 0.6),
    // M-04 · Combinaisons
    ...[-4.2, -3.3, -2.4, -1.5].map(z => wall('eva', 'suitRack', 'right', z)), prop('eva', 'suitBench', 5.6, -2.85, 0, Math.PI / 2),
    wall('eva', 'o2Column', 'right', 2.3), wall('eva', 'counterLow', 'left', -3.8), wall('eva', 'shelfUnit', 'front', -4.5),
    prop('eva', 'gasTank', -6.9, 4.4),
    // M-05 · Sas
    prop('airlock', 'hatchMarking', 0, 3.0), ...[-1.6, 1.6].map(x => wall('airlock', 'hatchRail', 'back', x)),
    wall('airlock', 'suitRack', 'right', -2.6), wall('airlock', 'containerLow', 'left', -4.2), wall('airlock', 'crewSeats', 'front', -3.5),
    // Every module: an extinguisher by the door and a cable conduit above it.
    ...MODULES.flatMap(m => [wall(m.id, 'extinguisher', 'front', m.width / 2 - 1.2), wall(m.id, 'conduit', 'front', 0, 2.5)]),
    { model: 'console', pos: [37, 0, 37], rot: Math.PI / 4 }, { model: 'plant', pos: [37, 0, 45] },
  ],
}
export function lunarRoomAt(x: number, z: number) {
  if (Math.hypot(x - HUB[0], z - HUB[1]) <= 7.15) return lunarHub
  const m = MODULES.find(m => inModule(m, x, z))
  return m ? lunarMap.rooms.find(r => r.id === m.id)! : null
}
export function lunarGate(id: string, solved: string[]) {
  const required: Record<string, string> = { habitat: 'manifest', power: 'manifest', security: 'loads', eva: 'identity', airlock: 'checklist', exterior: 'fuel' }
  return !required[id] || solved.includes(required[id])
}
