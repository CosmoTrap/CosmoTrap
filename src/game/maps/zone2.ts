import type { GridMap } from '../types'

// Station Orion — labo & machinerie.
export const zone2: GridMap = {
  zone: 2,
  grid: [
    '##W###W###WWWWW##########',
    '#.......#.......#.......#',
    'W.......#.......#.......W',
    '#.......#.......#.......#',
    '####D#######D#######D####',
    'W.......................W',
    '############D############',
    '#...............#.......#',
    '#...............D.......W',
    '#...............#.......#',
    '#...............#.......#',
    '####W#######W####WW######',
  ],
  rooms: [
    { id: 'labo', name: 'labo', rect: [1, 1, 7, 3], light: '#eef6ff', intensity: 12, theme: 'lab' },
    { id: 'serre', name: 'serre', rect: [9, 1, 15, 3], light: '#ff7ad9', intensity: 10, theme: 'green' },
    { id: 'disjoncteur', name: 'disjoncteur', rect: [17, 1, 23, 3], light: '#ffb070', intensity: 5, theme: 'machine' },
    { id: 'couloir', name: 'couloir', rect: [1, 5, 23, 5], light: '#dfe9ff', intensity: 8, flicker: true },
    { id: 'machinerie', name: 'machinerie', rect: [1, 7, 15, 10], dark: true, light: '#cfe0ff', intensity: 16, theme: 'machine' },
    { id: 'amarrage', name: 'amarrage', rect: [17, 7, 23, 10], light: '#9fd0ff', intensity: 9, theme: 'machine' },
  ],
  doors: [
    { id: 'd_labo', tile: [4, 4] },
    { id: 'd_serre', tile: [12, 4] },
    { id: 'd_disj', tile: [20, 4] },
    { id: 'd_mach', tile: [12, 6] },
    { id: 'door_dock', tile: [16, 8] },
  ],
  spawn: { tile: [1, 5], yaw: -Math.PI / 2 },
  sun: [-0.6, 0.35, -0.7],
  exterior: 'asteroids',
  ents: [
    // labo
    { id: 'fuse', model: 'fuse', tile: [2, 1], wall: 'N', y: 0.97, item: 'fuse', dot: 'key' },
    { id: 'labNote', model: 'datapad', tile: [5, 1], wall: 'N', y: 0.95, dot: 'exam' },
    { id: 'o2_a', model: 'o2', tile: [7, 2], wall: 'E', item: 'o2', dot: 'res' },
    { id: 'water_a', model: 'water', tile: [1, 3], wall: 'W', y: 0.95, item: 'water', dot: 'res' },
    { id: 'multitool', model: 'multitool', tile: [5, 3], wall: 'S', y: 0.97, item: 'multitool', dot: 'surv' },
    // serre
    { id: 'wrench', model: 'wrench', tile: [14, 3], wall: 'S', y: 0.9, item: 'wrench', dot: 'key' },
    { id: 'serreNote', model: 'tag', tile: [13, 3], wall: 'S', y: 1.3, dot: 'exam' },
    { id: 'battery_a', model: 'battery', tile: [9, 2], wall: 'W', y: 0.95, item: 'battery', dot: 'res' },
    { id: 'purifier', model: 'purifier', tile: [15, 1], wall: 'E', y: 0.95, item: 'purifier', dot: 'surv' },
    // couloir
    { id: 'steamValve', model: 'steamValve', tile: [18, 5], wall: 'N', y: 1.2, dot: 'key', hit: [0.8, 0.8, 0.5] },
    { id: 'steam', model: 'steam', tile: [20, 5], hit: [1.6, 2.4, 1.6] },
    // disjoncteur
    { id: 'breaker', model: 'breaker', tile: [20, 1], wall: 'N', y: 1.3, dot: 'key', hit: [1.4, 1.6, 0.5] },
    { id: 'tape', model: 'tape', tile: [23, 3], wall: 'E', y: 0.95, item: 'tape', dot: 'surv' },
    // machinerie
    { id: 'terminal', model: 'terminal', tile: [8, 7], wall: 'N', dot: 'key', hit: [1.2, 1.6, 0.8] },
    { id: 'o2_b', model: 'o2', tile: [2, 10], wall: 'S', item: 'o2', dot: 'res' },
    { id: 'battery_b', model: 'battery', tile: [14, 7], wall: 'N', y: 1.0, item: 'battery', dot: 'res' },
    // sas d'amarrage
    { id: 'dockExit', model: 'dockHatch', tile: [23, 9], wall: 'E', y: 1.2, dot: 'exit', hit: [0.6, 2.2, 1.8] },
  ],
  props: [
    // labo
    { model: 'labBench', tile: [2, 1], wall: 'N' },
    { model: 'labBench', tile: [5, 1], wall: 'N' },
    { model: 'labBench', tile: [5, 3], wall: 'S' },
    { model: 'microscope', tile: [3, 1], wall: 'N', y: 0.92 },
    { model: 'flasks', tile: [6, 1], wall: 'N', y: 0.92 },
    { model: 'cabinet', tile: [1, 3], wall: 'W' },
    { model: 'screen', tile: [4, 3], wall: 'S', y: 1.7 },
    { model: 'photos', tile: [7, 1], wall: 'E', y: 1.6 },
    // serre
    { model: 'plantRack', tile: [10, 1], wall: 'N' },
    { model: 'plantRack', tile: [12, 1], wall: 'N' },
    { model: 'plantRack', tile: [14, 1], wall: 'N' },
    { model: 'plantRack', tile: [10, 3], wall: 'S' },
    { model: 'plantRack', tile: [12, 3], wall: 'S' },
    { model: 'plant', tile: [15, 3], off: [0.4, 0.3] },
    // couloir
    { model: 'ladder', tile: [1, 5], wall: 'W' },
    { model: 'pipes', tile: [1, 5], scale: 23 },
    { model: 'brokenPipe', tile: [20, 5] },
    { model: 'extinguisher', tile: [8, 5], wall: 'S' },
    { model: 'sign', tile: [11, 5], wall: 'S', y: 2.0, color: '#ffd23a' },
    // disjoncteur
    { model: 'elecCabinet', tile: [18, 1], wall: 'N' },
    { model: 'elecCabinet', tile: [22, 1], wall: 'N' },
    { model: 'cables', tile: [17, 2] },
    { model: 'elecCabinet', tile: [17, 3], wall: 'W' },
    // machinerie
    { model: 'reactor', tile: [3, 8], off: [0, 1] },
    { model: 'reactor', tile: [11, 8], off: [0, 1] },
    { model: 'pipesBig', tile: [1, 7], scale: 15 },
    { model: 'console', tile: [6, 10], wall: 'S' },
    { model: 'grating', tile: [7, 8], off: [0, 1] },
    { model: 'crates', tile: [14, 10] },
    { model: 'rack', tile: [1, 8], wall: 'W' },
    // amarrage
    { model: 'suitRack', tile: [20, 7], wall: 'N' },
    { model: 'suitRack', tile: [21, 10], wall: 'S' },
    { model: 'hazard', tile: [22, 9] },
    { model: 'beacon', tile: [23, 8], wall: 'E', y: 2.4 },
  ],
}
