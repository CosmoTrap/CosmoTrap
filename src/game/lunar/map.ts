import type { Ent, GridMap, Prop, RoomDef } from '../types'

export const HUB = [41, 41] as const
export const MODULES = ([
  { id: 'habitat', name: 'Chambre de relève', center: [17, 41], width: 12, depth: 10, light: '#ffe2c0', theme: 'station' },
  { id: 'power', name: 'Centrale électrique', center: [41, 15], width: 14, depth: 12, light: '#ffc88a', theme: 'machine' },
  { id: 'security', name: 'Terminal de sécurité', center: [66, 27], width: 12, depth: 10, light: '#a5d9ff', theme: 'lab' },
  { id: 'eva', name: 'Salle des combinaisons', center: [66, 55], width: 14, depth: 10, light: '#b2e9dd', theme: 'lab' },
  { id: 'airlock', name: 'Sas d’évacuation', center: [41, 68], width: 12, depth: 10, light: '#ffc398', theme: 'rocket' },
] satisfies { id: string; name: string; center: [number, number]; width: number; depth: number; light: string; theme: NonNullable<RoomDef['theme']> }[])
  .map(m => ({ ...m, angle: Math.atan2(m.center[0] - HUB[0], m.center[1] - HUB[1]), distance: Math.hypot(m.center[0] - HUB[0], m.center[1] - HUB[1]) }))
export type LunarModule = typeof MODULES[number]
export const ROCKET = [23, 79] as const
export function inModule(m: LunarModule, x: number, z: number, margin = 0) {
  const dx = x - m.center[0], dz = z - m.center[1], c = Math.cos(m.angle), s = Math.sin(m.angle)
  return Math.abs(dx * c - dz * s) <= m.width / 2 + margin && Math.abs(dx * s + dz * c) <= m.depth / 2 + margin
}
export function localPoint(id: string, x: number, y: number, z: number): [number, number, number] {
  const m = MODULES.find(m => m.id === id)!, c = Math.cos(m.angle), s = Math.sin(m.angle)
  return [m.center[0] + x * c + z * s, y, m.center[1] - x * s + z * c]
}
const prop = (room: string, model: string, x: number, z: number, y = 0, rot = 0): Prop => ({ model, pos: localPoint(room, x, y, z), rot: MODULES.find(m => m.id === room)!.angle + rot })
const terminal = (room: string, id: string, x: number, z: number, rot = Math.PI): Ent => ({ id: `l_${id}`, model: 'lunarTerminal', pos: localPoint(room, x, 0, z), rot: MODULES.find(m => m.id === room)!.angle + rot, dot: 'key', hit: [1.3, 1.8, 0.5] })
const note = (room: string, id: string, x: number, z: number, rot = Math.PI): Ent => ({ id: `ln_${id}`, model: 'lunarNote', pos: localPoint(room, x, 1.35, z), y: 1.35, rot: MODULES.find(m => m.id === room)!.angle + rot, dot: 'exam', hit: [0.65, 0.55, 0.24] })
const item = (room: string, id: string, type: NonNullable<Ent['item']>, x: number, z: number, y = 0.9): Ent => ({ id: `li_${['o2', 'water', 'battery'].includes(type) ? room + '_' : ''}${id}`, model: type, item: type, pos: localPoint(room, x, y, z), rot: MODULES.find(m => m.id === room)!.angle, dot: ['o2', 'water', 'battery'].includes(type) ? 'res' : 'key' })

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
    terminal('habitat', 'manifest', 3.8, 4.4), note('habitat', 'relief', 0, 4.8),
    item('habitat', 'lamp', 'lamp', -5.27, 2, 0.95), item('habitat', 'fuse', 'fuse', -5.27, 1, 0.95), item('habitat', 'wrench', 'wrench', -5.27, 0, 0.95),
    item('habitat', 'water', 'water', -5.27, -1, 0.95), item('habitat', 'battery', 'battery', -5.27, -2, 0.95),
    terminal('power', 'circuit', -4, 5.3), terminal('power', 'loads', 0, 5.3), terminal('power', 'thermal', 4, 5.3),
    note('power', 'solar', -6.7, 0, Math.PI / 2), item('power', 'cell', 'cell', -5, -2.68, 0.95),
    item('power', 'o2', 'o2', 5, -3, 0),
    terminal('security', 'identity', -3, 4.4), terminal('security', 'signal', 3, 4.4),
    note('security', 'crew', -5.8, 1, Math.PI / 2), note('security', 'thermal', -5.8, -2, Math.PI / 2), note('security', 'radio', 5.8, 0, -Math.PI / 2),
    item('security', 'antenna', 'antenna', 4, -1.68, 0.95), item('security', 'water', 'water', -4, -1.68, 0.95),
    terminal('eva', 'filters', -4.5, 4.4), terminal('eva', 'pressure', 0, 4.4), terminal('eva', 'checklist', 4.5, 4.4),
    note('eva', 'filters', -6.8, 1, Math.PI / 2), note('eva', 'pressure', -6.8, -2, Math.PI / 2), note('eva', 'eva', 6.8, 0, -Math.PI / 2),
    item('eva', 'o2', 'o2', 2.8, -3.8, 0), item('eva', 'battery', 'battery', -5, -1.68, 0.95),
    terminal('airlock', 'route', -3.8, 3.8), terminal('airlock', 'fuel', 3.8, 3.8),
    note('airlock', 'route', -5.8, 0, Math.PI / 2), note('airlock', 'fuel', 5.8, 0, -Math.PI / 2), note('airlock', 'departure', -5.8, -2.5, Math.PI / 2),
    { id: 'l_launch', model: 'lunarTerminal', pos: [ROCKET[0] + 3, 0, ROCKET[1] + 1], rot: Math.PI / 2, dot: 'exit', hit: [1.4, 1.8, 0.8] },
  ],
  props: [
    prop('habitat', 'bunk', 4.8, 0, 0, -Math.PI / 2), prop('habitat', 'bunk', 4.8, -2.8, 0, -Math.PI / 2),
    ...[2, 0, -2].map(z => prop('habitat', 'counterLow', -5.6, z, 0, Math.PI / 2)),
    prop('habitat', 'personalLocker', -4.5, 4.2), prop('habitat', 'photos', 5.8, 2.2, 1.5, -Math.PI / 2),
    prop('power', 'generator', -4, 1), prop('power', 'gasTank', 4.8, 1),
    prop('power', 'counterLow', -5, -3), prop('power', 'pipesBig', 6.5, 1, 0, -Math.PI / 2),
    prop('security', 'workstation', -4.6, 0, 0, Math.PI / 2), prop('security', 'rack', 4.5, 2),
    prop('security', 'counterLow', 4, -2), prop('security', 'counterLow', -4, -2),
    prop('eva', 'suitRack', 5.6, 1, 0, -Math.PI / 2), prop('eva', 'counterLow', -5, -2),
    prop('eva', 'gasTank', 5.4, -2), prop('eva', 'medbed', -4.8, 1, 0, Math.PI / 2),
    prop('airlock', 'suitRack', 4.8, -2, 0, -Math.PI / 2), prop('airlock', 'containerLow', -4.8, -3),
    ...MODULES.flatMap(m => [prop(m.id, 'extinguisher', m.width / 2 - 0.5, -m.depth / 2 + 0.8), prop(m.id, 'conduit', 0, m.depth / 2 - 0.15, 2.5, Math.PI)]),
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
