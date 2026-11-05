import type { ReactNode } from 'react'
import { doorUnlocked, entActive, stepsState } from '../../game/logic'
import { GRID_MAPS, TILE, placeOf } from '../../game/maps'
import { useGame } from '../../game/state'
import type { RoomDef, ZoneId } from '../../game/types'
import { resolveProps } from '../../world/props/clearance'

// Top-down drawings of what really stands in each module, generated from the same placements as the 3D world.

type Status = 'solved' | 'current' | 'locked' | 'idle'

/** Which mission step is carried out in which room. */
const ROOM_STEPS: Record<number, Record<string, string[]>> = {
  1: { dortoir: ['lamp', 'locker'], refectoire: ['board'], reserve: ['plate'], sas: ['door', 'valves'], couloir: ['lift'] },
  2: { labo: ['fuse'], serre: ['wrench'], liaison_est: ['steam'], disjoncteur: ['breaker', 'power'], machinerie: ['terminal'], amarrage: ['dock'] },
  3: {},
}
const ROOM_CODES: Record<string, string> = {
  'couloir:1': '0-00', dortoir: '0-01', refectoire: '0-02', reserve: '0-03', infirmerie: '0-04', sas: '0-05',
  'couloir:2': '0-06', labo: '0-07', serre: '0-08', disjoncteur: '0-09', machinerie: '0-10', amarrage: '0-11',
}
export const roomCode = (room: RoomDef, zone: number) => ROOM_CODES[`${room.id}:${zone}`] ?? ROOM_CODES[room.id] ?? '0-XX'

export function roomSteps(zone: ZoneId, room: RoomDef) {
  const ids = ROOM_STEPS[zone]?.[room.id] ?? []
  return stepsState(zone).filter((s) => ids.includes(s.id))
}

export function roomLocked(zone: ZoneId, room: RoomDef) {
  const f = useGame.getState().flags
  if (zone === 1 && room.id === 'sas') return !doorUnlocked('door_d1')
  if (zone === 2 && room.id === 'amarrage') return !doorUnlocked('door_dock')
  if (zone === 2 && room.id === 'disjoncteur') return !f.steamFixed
  return false
}

export function roomStatus(zone: ZoneId, room: RoomDef): Status {
  if (roomLocked(zone, room)) return 'locked'
  const steps = roomSteps(zone, room)
  if (!steps.length) return 'idle'
  if (steps.some((s) => s.status === 'current')) return 'current'
  return steps.every((s) => s.status === 'done') ? 'solved' : 'idle'
}

const r = (x: number, z: number, w: number, d: number, fill: string, rx = 0.06, stroke?: string) =>
  <rect x={x - w / 2} y={z - d / 2} width={w} height={d} rx={rx} fill={fill} stroke={stroke} strokeWidth={stroke ? 0.04 : undefined} />
const dot = (x: number, z: number, radius: number, fill: string, stroke?: string) =>
  <circle cx={x} cy={z} r={radius} fill={fill} stroke={stroke} strokeWidth={stroke ? 0.05 : undefined} />

const WHITE = '#d9dee6', STEEL = '#7d8798', DARK = '#3a4356', WOOD = '#a9825a', BLUE = '#3f6fc4', GREEN = '#4fae62', RED = '#c5453c'

/** Icon of each model, in metres; +z points into the room, as in the 3D props. */
const ICONS: Record<string, () => ReactNode> = {
  bunk: () => <>{r(0, .48, 1.95, .94, STEEL)}{r(.25, .48, 1.3, .82, BLUE)}{r(-.7, .48, .4, .62, WHITE)}</>,
  table: () => <>{r(0, 0, 1.7, .85, WHITE, .14)}{dot(0, 0, .1, STEEL)}</>,
  chair: () => <>{r(0, 0, .45, .45, DARK, .08)}{r(0, -.17, .42, .1, '#232a3a')}</>,
  stool: () => dot(0, 0, .17, WOOD), metalStool: () => dot(0, 0, .2, WOOD),
  counter: () => <>{r(0, .31, 2, .62, STEEL)}{r(-.5, .31, .8, .4, '#8e98a8')}{r(.5, .31, .8, .4, '#8e98a8')}</>,
  counterLow: () => r(0, .31, 2, .62, STEEL),
  counterSink: () => <>{r(0, .31, 2, .62, STEEL)}{r(-.3, .32, .56, .38, '#b9d4e8')}{dot(-.3, .1, .03, WHITE)}</>,
  fridge: () => <>{r(0, .32, .76, .64, WHITE)}{r(-.28, .62, .04, .03, STEEL)}</>,
  sofa: () => <>{r(0, .4, 1.8, .8, '#2b2f3a', .14)}{r(-.45, .46, .78, .5, '#474d5c', .08)}{r(.45, .46, .78, .5, '#474d5c', .08)}</>,
  coffeeTable: () => r(0, 0, 1.2, .6, WOOD, .08),
  armchair: () => <>{r(0, .45, .82, .85, '#2b2f3a', .16)}{r(0, .5, .52, .5, '#474d5c', .08)}</>,
  nightTable: () => r(0, .22, .5, .44, WOOD),
  sideTable: () => r(0, .22, .5, .44, WOOD),
  drawers: () => <>{r(0, .17, .66, .34, WOOD)}{[-.2, 0, .2].map((x) => <rect key={x} x={x - .07} y=".3" width=".14" height=".03" fill={DARK} />)}</>,
  desk: () => r(0, .35, 1.5, .7, WHITE),
  workTable: () => r(0, .38, 1.7, .78, WOOD),
  personalLocker: () => <>{r(0, .28, .58, .55, STEEL)}{r(0, .52, .5, .04, WHITE)}</>,
  rack: () => <>{r(0, .25, 1.8, .5, DARK)}{[-.5, .42].map((x) => <rect key={x} x={x - .2} y=".1" width=".4" height=".3" fill={WOOD} />)}</>,
  storageShelf: () => <>{r(0, .25, .6, .5, DARK)}{r(0, .25, .4, .32, WOOD)}</>,
  shelfUnit: () => <>{r(0, .25, 1, .5, DARK)}{r(0, .25, .8, .32, WOOD)}</>,
  shelf: () => r(0, .15, 1.25, .3, STEEL),
  cabinet: () => <>{r(0, .27, 1.4, .55, WHITE)}{r(0, .5, 1.3, .03, STEEL)}</>,
  medbed: () => <>{r(0, 0, .85, 1.95, STEEL)}{r(0, .14, .72, 1.5, '#8fc3d6')}{r(0, -.7, .54, .34, WHITE)}</>,
  curtain: () => <rect x="-.03" width=".06" height="2.3" fill="#8fb5bd" />,
  washBasin: () => <>{r(0, .26, .62, .46, WHITE, .2)}{dot(0, .28, .14, '#b9d4e8')}</>,
  medCart: () => <>{r(0, .3, .78, .5, WHITE)}{r(-.14, .3, .28, .22, RED)}</>,
  wheelchair: () => <>{r(0, .42, .7, .8, DARK, .1)}{r(0, .5, .46, .46, '#2e7a83')}</>,
  suitRack: () => <>{r(0, .38, .82, .3, WHITE, .12)}{dot(0, .38, .17, '#c79a3a', WHITE)}{r(0, .08, .54, .14, STEEL)}</>,
  labBench: () => <>{r(0, .38, 1.9, .75, '#262b36')}{r(0, .06, 1.84, .05, STEEL)}</>,
  plantRack: () => <>{r(0, .26, 1.8, .5, DARK)}{[-.68, -.34, 0, .34, .68].map((x) => <circle key={x} cx={x} cy=".26" r=".13" fill={GREEN} />)}</>,
  planterLong: () => <>{r(0, .24, 1.25, .46, '#6a3f2d')}{r(0, .24, 1.1, .32, GREEN, .12)}</>,
  plant: () => dot(0, 0, .25, GREEN),
  reactor: () => <>{dot(0, 0, 1.05, DARK, STEEL)}{dot(0, 0, .72, '#21364a', '#59c8ff')}{dot(0, 0, .3, '#59c8ff')}</>,
  console: () => <>{r(0, .31, 1.6, .62, DARK)}{[-.5, -.2, .1, .4].map((x, i) => <rect key={x} x={x} y=".22" width=".18" height=".1" fill={i % 2 ? '#62d6b1' : '#ffb02a'} />)}</>,
  toolChest: () => <>{r(0, .25, 1.05, .5, RED)}{r(0, .44, .95, .04, '#7d2a24')}</>,
  toolCart: () => r(0, 0, .95, .5, '#3d7a5a'),
  generator: () => r(0, 0, 1, .55, '#d2a72e'),
  barrel: () => dot(0, 0, .32, '#2a5a9e', STEEL),
  container: () => r(0, 0, 1.1, 1.5, '#2348a8', .08),
  containerLow: () => r(0, .3, .9, .6, '#2348a8', .06),
  stack: () => <>{r(0, .3, .9, .6, '#2348a8', .06)}{r(0, .3, .5, .35, WOOD)}</>,
  crates: () => <>{r(0, 0, .82, .62, '#5b6a52')}{r(.75, .1, .5, .5, '#8a6b3a')}</>,
  cardboard: () => r(0, .22, .5, .44, '#b48f5e'),
  gasBottle: () => dot(0, 0, .2, RED), gasTank: () => dot(0, 0, .22, RED),
  jerrycan: () => r(0, .1, .36, .18, '#4b6a3a'), plasticCan: () => r(0, .15, .3, .3, '#d8d8d0'),
  elecCabinet: () => <>{r(0, .25, 1, .5, '#566070')}{[-.25, 0, .25].map((x) => <circle key={x} cx={x} cy=".42" r=".035" fill="#62d6b1" />)}</>,
  elecBox: () => r(0, .22, .9, .44, '#6f8a6d'), powerBox: () => r(0, .2, .4, .4, '#566070'),
  hvac: () => <>{r(0, .19, 1.8, .38, '#8a8f8e')}{dot(-.45, .19, .14, DARK)}{dot(.45, .19, .14, DARK)}</>,
  weldCart: () => r(0, .3, .7, .6, '#b6562c'), drillPress: () => <>{r(0, .25, .5, .5, '#46627a')}{dot(0, .3, .08, WHITE)}</>,
  storageCart: () => r(0, .38, 1.4, .76, '#546272'), handTruck: () => r(0, .3, .55, .55, RED),
  holoProjector: () => <>{dot(0, 0, .34, DARK)}{dot(0, 0, .22, '#59c8ff')}</>,
  bin: () => dot(0, 0, .15, STEEL), nook: () => null, workstation: () => r(0, .22, 1.7, .44, DARK),
  // Interactive objects
  locker: () => <>{r(0, .28, .8, .56, '#6a7884')}{r(0, .56, .7, .05, '#ffb02a')}</>,
  valvePanel: () => <>{r(0, .08, 1.2, .16, DARK)}{[-.35, 0, .35].map((x) => <circle key={x} cx={x} cy=".08" r=".07" fill={RED} />)}</>,
  terminal: () => <>{r(0, .32, 1.4, .64, DARK)}{r(0, .12, 1, .14, '#59c8ff')}</>,
  breaker: () => <>{r(0, .16, 1.3, .32, '#566070')}{r(0, .28, .5, .08, '#ffb02a')}</>,
  dispenser: () => <>{r(0, .26, .45, .52, WHITE)}{dot(0, .26, .1, '#7fc4ff')}</>,
  board: () => r(0, .03, 1.6, .06, WHITE), dockHatch: () => <>{r(0, .1, 1.8, .2, STEEL)}{r(0, .22, 1.2, .05, '#ffb02a')}</>,
}

/** Everything standing inside a room, placed exactly as in the 3D level. */
function Furniture({ zone, room }: { zone: ZoneId; room: RoomDef }) {
  const map = GRID_MAPS[zone as 1 | 2 | 3]
  const [x0, z0, x1, z1] = room.rect
  const inside = (x: number, z: number) => x >= x0 * TILE - 0.2 && x <= (x1 + 1) * TILE + 0.2 && z >= z0 * TILE - 0.2 && z <= (z1 + 1) * TILE + 0.2
  const items = [...resolveProps(map), ...map.ents.filter((e) => !e.item && entActive(e, zone))]
  return <>{items.map((item, i) => {
    const icon = ICONS[item.model]
    if (!icon) return null
    const { p, r: rotation } = placeOf(item, 0)
    if (!inside(p[0], p[2])) return null
    return <g key={i} transform={`translate(${p[0]} ${p[2]}) rotate(${-rotation * 180 / Math.PI})`}>{icon()}</g>
  })}</>
}

export function Lock({ x, z, size = 1 }: { x: number; z: number; size?: number }) {
  return <g transform={`translate(${x} ${z}) scale(${size})`} pointerEvents="none">
    <circle r="1.05" fill="#7a1f24" stroke="#ff6a60" strokeWidth=".1" />
    <path d="M-.35-.1v-.25a.35.35 0 0 1 .7 0v.25" fill="none" stroke="#ffd9d4" strokeWidth=".12" />
    <rect x="-.5" y="-.12" width="1" height=".72" rx=".1" fill="#ffd9d4" />
  </g>
}

/** A module seen from above: metal hull, dark floor, its real contents, and a warning state when locked. */
export function ModuleArt({ zone, room, status, selected = false }: { zone: ZoneId; room: RoomDef; status: Status; selected?: boolean }) {
  const [x0, z0, x1, z1] = room.rect
  const x = x0 * TILE, z = z0 * TILE, w = (x1 - x0 + 1) * TILE, d = (z1 - z0 + 1) * TILE
  const locked = status === 'locked'
  return <>
    <rect x={x - .28} y={z - .28} width={w + .56} height={d + .56} rx="1" fill="url(#nav-hull)" stroke={selected ? '#ff865c' : '#f0f3f7'} strokeWidth={selected ? .22 : .08} />
    <rect x={x} y={z} width={w} height={d} rx=".55" fill="#121829" stroke="#070b16" strokeWidth=".1" />
    <rect x={x} y={z} width={w} height={d} rx=".55" fill="url(#nav-floor)" />
    <Furniture zone={zone} room={room} />
    {locked && <>
      <rect x={x} y={z} width={w} height={d} rx=".55" fill="url(#nav-locked)" stroke="#ff5a55" strokeWidth=".14" strokeDasharray=".5 .35" />
      <Lock x={x + w / 2} z={z + d / 2} />
    </>}
  </>
}
