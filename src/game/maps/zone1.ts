import type { GridMap } from '../types'

// Station Orion — quartiers d'équipage. Tuile = 2 m, plafond 2,8 m.
// # mur · . sol · W hublot · D porte
export const zone1: GridMap = {
  zone: 1,
  grid: [
    '###W####WW###WW###WW####',
    '#......#...............#',
    'W......#...............#',
    '#......#...............#',
    '####D#######D###########',
    'W......................W',
    '####D#######D#####D#####',
    '#......#.........#.....#',
    '#......#.........#.....W',
    '#......#.........#.....#',
    '##########W#######W#####',
  ],
  rooms: [
    { id: 'dortoir', name: 'dortoir', rect: [1, 1, 6, 3], light: '#ffe2c0', intensity: 9 },
    { id: 'refectoire', name: 'refectoire', rect: [8, 1, 22, 3], light: '#fff1de', intensity: 14 },
    { id: 'couloir', name: 'couloir', rect: [1, 5, 22, 5], light: '#dfe9ff', intensity: 9, flicker: true },
    { id: 'reserve', name: 'reserve', rect: [1, 7, 6, 9], dark: true, noDynLight: true },
    { id: 'infirmerie', name: 'infirmerie', rect: [8, 7, 16, 9], light: '#e8f6ff', intensity: 11, theme: 'lab' },
    { id: 'sas', name: 'sas', rect: [18, 7, 22, 9], light: '#ff5a3a', intensity: 7, theme: 'machine' },
  ],
  doors: [
    { id: 'd_dortoir', tile: [4, 4] },
    { id: 'd_refectoire', tile: [12, 4] },
    { id: 'd_reserve', tile: [4, 6] },
    { id: 'd_infirmerie', tile: [12, 6] },
    { id: 'door_d1', tile: [18, 6] },
  ],
  spawn: { tile: [2, 2], yaw: -Math.PI / 2 },
  sun: [0.85, 0.12, -0.5],
  exterior: 'moon',
  ents: [
    // dortoir
    { id: 'holo', model: 'holo', tile: [5, 2], dot: 'exam', hit: [0.9, 1.8, 0.9] },
    { id: 'lamp', model: 'lamp', tile: [5, 1], wall: 'N', y: 1.05, item: 'lamp', dot: 'key' },
    { id: 'locker', model: 'locker', tile: [6, 3], wall: 'E', dot: 'key', hit: [0.9, 2, 0.7] },
    { id: 'postit', model: 'postit', tile: [6, 2], wall: 'E', y: 1.5, dot: 'exam' },
    { id: 'o2_a', model: 'o2', tile: [6, 1], item: 'o2', dot: 'res' },
    // réfectoire
    { id: 'board', model: 'board', tile: [8, 2], wall: 'W', y: 1.55, dot: 'exam', hit: [1.6, 1.1, 0.3] },
    { id: 'dispenser', model: 'dispenser', tile: [22, 2], wall: 'E', dot: 'res', hit: [0.8, 1.6, 0.6] },
    { id: 'battery_a', model: 'battery', tile: [20, 1], wall: 'N', y: 0.95, item: 'battery', dot: 'res' },
    { id: 'ration', model: 'ration', tile: [16, 2], y: 0.79, item: 'ration', dot: 'surv' },
    // couloir
    { id: 'o2_b', model: 'o2', tile: [15, 5], wall: 'S', item: 'o2', dot: 'res' },
    // réserve (sombre)
    { id: 'plate', model: 'plate', tile: [1, 8], wall: 'W', y: 1.5, dot: 'exam', hit: [0.6, 0.5, 0.3] },
    { id: 'battery_b', model: 'battery', tile: [5, 7], wall: 'N', y: 1.05, item: 'battery', dot: 'res' },
    { id: 'blanket', model: 'blanket', tile: [3, 9], wall: 'S', y: 0.55, item: 'blanket', dot: 'surv' },
    // infirmerie
    { id: 'water_a', model: 'water', tile: [9, 7], wall: 'N', y: 1.0, item: 'water', dot: 'res' },
    { id: 'medkit', model: 'medkit', tile: [16, 8], wall: 'E', y: 1.2, item: 'medkit', dot: 'surv' },
    { id: 'o2_c', model: 'o2', tile: [14, 9], wall: 'S', item: 'o2', dot: 'res' },
    // sas
    { id: 'valves', model: 'valvePanel', tile: [20, 7], wall: 'N', y: 1.35, dot: 'key', hit: [1.2, 1.2, 0.4] },
    { id: 'hatch', model: 'hatch', tile: [21, 8], dot: 'exit', hit: [1.5, 0.5, 1.5] },
  ],
  props: [
    // dortoir
    { model: 'bunk', tile: [1, 1], wall: 'W' },
    { model: 'bunk', tile: [1, 3], wall: 'W' },
    { model: 'shelf', tile: [5, 1], wall: 'N', y: 1.0 },
    { model: 'photos', tile: [2, 1], wall: 'N', y: 1.55 },
    { model: 'photos', tile: [1, 2], wall: 'W', y: 1.6, off: [0, 0.2] },
    { model: 'toy', tile: [3, 2], y: 1.55 },
    { model: 'sockets', tile: [4, 3], wall: 'S', y: 0.4 },
    { model: 'personalLocker', tile: [6, 3], wall: 'E', off: [-0.95, 0] },
    { model: 'holoProjector', tile: [5, 2] },
    // réfectoire
    { model: 'table', tile: [12, 2] },
    { model: 'table', tile: [16, 2] },
    { model: 'mugs', tile: [12, 2], y: 0.79 },
    { model: 'mugs', tile: [16, 2], y: 0.79, off: [-0.4, 0.2] },
    { model: 'counter', tile: [20, 1], wall: 'N' },
    { model: 'counter', tile: [21, 1], wall: 'N' },
    { model: 'postits', tile: [8, 2], wall: 'W', y: 1.55 },
    { model: 'plant', tile: [22, 3], off: [0.4, 0.4] },
    { model: 'screen', tile: [10, 3], wall: 'S', y: 1.6 },
    // couloir
    { model: 'pipes', tile: [1, 5], scale: 22 },
    { model: 'sign', tile: [17, 5], wall: 'N', y: 2.0, color: '#ff6b35' },
    { model: 'extinguisher', tile: [7, 5], wall: 'S' },
    { model: 'handrail', tile: [9, 5], wall: 'N' },
    { model: 'handrail', tile: [20, 5], wall: 'S' },
    // réserve
    { model: 'crates', tile: [2, 7] },
    { model: 'crates', tile: [5, 9], rot: 0.4 },
    { model: 'rack', tile: [3, 7], wall: 'N' },
    { model: 'rack', tile: [6, 8], wall: 'E' },
    { model: 'debris', tile: [3, 8] },
    // infirmerie
    { model: 'medbed', tile: [11, 8] },
    { model: 'medbed', tile: [14, 8] },
    { model: 'cabinet', tile: [9, 7], wall: 'N' },
    { model: 'monitor', tile: [12, 7], wall: 'N', y: 1.4 },
    { model: 'photos', tile: [16, 7], wall: 'E', y: 1.6 },
    // sas
    { model: 'suitRack', tile: [22, 7], wall: 'E' },
    { model: 'suitRack', tile: [22, 9], wall: 'E' },
    { model: 'hazard', tile: [21, 8] },
    { model: 'beacon', tile: [18, 7], wall: 'N', y: 2.4 },
  ],
}
