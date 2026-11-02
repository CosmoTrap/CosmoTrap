import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { CEIL, TILE, cellAt, isFloor, isSolid, roomAt, tileCenter } from '../game/maps'
import { G, diff, useGame } from '../game/state'
import type { GridMap, RoomDef } from '../game/types'
import { Door } from './Door'
import { LightShafts } from './LightShafts'
import { RoomCtx, ceilingMaterial, floorMaterial, setRoomLit, useMats, wallMaterial } from './materials'
import { EntModels } from './props/EntModels'
import { Props } from './props/Props'

export const WIN_R = 0.42
export const WIN_Y = 1.5
const WIN_DEPTH = 0.55

export interface WindowDef {
  x: number
  z: number
  rot: number // rotation Y : la normale +z locale pointe vers l'intérieur
  kind: 'W' | 'V'
  room: string
}

interface Built {
  rooms: Record<string, { floor: THREE.BufferGeometry[]; ceil: THREE.BufferGeometry[]; wall: THREE.BufferGeometry[] }>
  windows: WindowDef[]
  colliders: { p: [number, number, number]; h: [number, number, number] }[]
  doors: { id: string; x: number; z: number; alongZ: boolean; room: string }[]
}

const DIRS: { d: [number, number]; rot: number; off: (tx: number, tz: number) => [number, number] }[] = [
  { d: [0, -1], rot: 0, off: (tx, tz) => [tx * TILE + 1, tz * TILE] }, // mur nord
  { d: [0, 1], rot: Math.PI, off: (tx, tz) => [tx * TILE + 1, (tz + 1) * TILE] }, // sud
  { d: [-1, 0], rot: Math.PI / 2, off: (tx, tz) => [tx * TILE, tz * TILE + 1] }, // ouest
  { d: [1, 0], rot: -Math.PI / 2, off: (tx, tz) => [(tx + 1) * TILE, tz * TILE + 1] }, // est
]

function wallQuad() {
  const g = new THREE.PlaneGeometry(TILE, CEIL)
  g.translate(0, CEIL / 2, 0)
  return g
}

function wallWithHole() {
  const s = new THREE.Shape()
  s.moveTo(-1, 0)
  s.lineTo(1, 0)
  s.lineTo(1, CEIL)
  s.lineTo(-1, CEIL)
  s.lineTo(-1, 0)
  const h = new THREE.Path()
  h.absarc(0, WIN_Y, WIN_R, 0, Math.PI * 2, true)
  s.holes.push(h)
  const g = new THREE.ShapeGeometry(s, 24)
  const uv = g.attributes.uv as THREE.BufferAttribute
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + 1) / 2, pos.getY(i) / CEIL)
  return g
}

function sillOnly() {
  // verrière : seule l'allège (0 → 0,9 m) est opaque
  const g = new THREE.PlaneGeometry(TILE, 0.9)
  g.translate(0, 0.45, 0)
  const uv = g.attributes.uv as THREE.BufferAttribute
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * (0.9 / CEIL))
  return g
}

function buildLevel(map: GridMap): Built {
  const rooms: Built['rooms'] = {}
  const windows: WindowDef[] = []
  const doors: Built['doors'] = []
  const R = (id: string) => (rooms[id] ??= { floor: [], ceil: [], wall: [] })
  const H = map.grid.length
  const W = Math.max(...map.grid.map((r) => r.length))

  const roomOf = (tx: number, tz: number) => {
    const [cx, cz] = tileCenter(tx, tz)
    let r = roomAt(map, cx, cz)
    if (r) return r.id
    for (const [dx, dz] of [
      [0, 1],
      [0, -1],
      [1, 0],
      [-1, 0],
    ]) {
      if (!isFloor(cellAt(map, tx + dx, tz + dz))) continue
      const [x2, z2] = tileCenter(tx + dx, tz + dz)
      r = roomAt(map, x2, z2)
      if (r) return r.id
    }
    return map.rooms[0].id
  }

  for (let tz = 0; tz < H; tz++)
    for (let tx = 0; tx < W; tx++) {
      const c = cellAt(map, tx, tz)
      if (!isFloor(c)) continue
      const rid = roomOf(tx, tz)
      const r = R(rid)
      const [cx, cz] = tileCenter(tx, tz)
      const f = new THREE.PlaneGeometry(TILE, TILE)
      f.rotateX(-Math.PI / 2)
      f.translate(cx, 0, cz)
      r.floor.push(f)
      const ce = new THREE.PlaneGeometry(TILE, TILE)
      ce.rotateX(Math.PI / 2)
      ce.translate(cx, CEIL, cz)
      r.ceil.push(ce)
      if (c === 'D') {
        const alongZ = isSolid(cellAt(map, tx - 1, tz)) && isSolid(cellAt(map, tx + 1, tz))
        const d = map.doors.find((dd) => dd.tile[0] === tx && dd.tile[1] === tz)
        doors.push({ id: d?.id ?? `door_${tx}_${tz}`, x: cx, z: cz, alongZ, room: rid })
      }
      for (const dir of DIRS) {
        const n = cellAt(map, tx + dir.d[0], tz + dir.d[1])
        if (!isSolid(n)) continue
        const [x, z] = dir.off(tx, tz)
        let g: THREE.BufferGeometry
        if (n === 'W' && c !== 'D') {
          g = wallWithHole()
          windows.push({ x, z, rot: dir.rot, kind: 'W', room: rid })
        } else if (n === 'V') {
          g = sillOnly()
          windows.push({ x, z, rot: dir.rot, kind: 'V', room: rid })
        } else g = wallQuad()
        g.rotateY(dir.rot)
        g.translate(x, 0, z)
        r.wall.push(g)
      }
    }

  // collisions : murs pleins voisins d'un sol, fusionnés par rangée
  const colliders: Built['colliders'] = []
  const near = (tx: number, tz: number) => {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (isFloor(cellAt(map, tx + dx, tz + dz))) return true
    return false
  }
  for (let tz = -1; tz <= H; tz++) {
    let start = -99
    for (let tx = -1; tx <= W + 1; tx++) {
      const solid = isSolid(cellAt(map, tx, tz)) && near(tx, tz) && tx <= W
      if (solid && start === -99) start = tx
      if ((!solid || tx === W + 1) && start !== -99) {
        const end = solid ? tx : tx - 1
        const n = end - start + 1
        colliders.push({ p: [(start + n / 2) * TILE, CEIL / 2, tz * TILE + 1], h: [(n * TILE) / 2, CEIL / 2 + 0.5, TILE / 2] })
        start = -99
      }
    }
  }
  colliders.push({ p: [(W * TILE) / 2, -0.25, (H * TILE) / 2], h: [(W * TILE) / 2 + 4, 0.25, (H * TILE) / 2 + 4] })
  colliders.push({ p: [(W * TILE) / 2, CEIL + 0.25, (H * TILE) / 2], h: [(W * TILE) / 2 + 4, 0.25, (H * TILE) / 2 + 4] })
  return { rooms, windows, colliders, doors }
}

function floorKind(room: RoomDef): 'plate' | 'rubber' | 'grate' {
  if (room.theme === 'machine' || room.theme === 'rocket') return 'grate'
  if (room.id === 'couloir' || room.id === 'pont') return 'rubber'
  return 'plate'
}

function RoomMeshes({ room, geo, shadows }: { room: RoomDef; geo: Built['rooms'][string]; shadows: boolean }) {
  const merged = useMemo(
    () => ({
      floor: mergeGeometries(geo.floor),
      ceil: mergeGeometries(geo.ceil),
      wall: geo.wall.length ? mergeGeometries(geo.wall) : null,
    }),
    [geo],
  )
  const dark = !!room.dark
  const theme = room.theme ?? 'station'
  return (
    <group>
      <mesh geometry={merged.floor} material={floorMaterial(floorKind(room), dark, room.id)} receiveShadow castShadow={shadows} />
      <mesh geometry={merged.ceil} material={ceilingMaterial(dark, room.id)} receiveShadow castShadow={shadows} />
      {merged.wall && <mesh geometry={merged.wall} material={wallMaterial(theme, dark, room.id)} receiveShadow castShadow={shadows} />}
    </group>
  )
}

/** hublot : tunnel, cadre boulonné, vitre */
function Porthole({ w }: { w: WindowDef }) {
  const m = useMats()
  return (
    <group position={[w.x, 0, w.z]} rotation={[0, w.rot, 0]}>
      <mesh position={[0, WIN_Y, -WIN_DEPTH / 2]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow material={m.metal('#5d6166', 0.45)}>
        <cylinderGeometry args={[WIN_R, WIN_R, WIN_DEPTH, 32, 1, true]} />
      </mesh>
      <mesh position={[0, WIN_Y, 0.02]} castShadow material={m.painted('#3a3d42', 0.4, 0.7)}>
        <torusGeometry args={[WIN_R + 0.04, 0.055, 12, 40]} />
      </mesh>
      {Array.from({ length: 10 }).map((_, i) => {
        const a = (i / 10) * Math.PI * 2
        return (
          <mesh key={i} position={[Math.cos(a) * (WIN_R + 0.05), WIN_Y + Math.sin(a) * (WIN_R + 0.05), 0.07]} material={m.metal('#b8bcc0', 0.3)}>
            <cylinderGeometry args={[0.014, 0.014, 0.02, 6]} />
          </mesh>
        )
      })}
      <mesh position={[0, WIN_Y, -WIN_DEPTH + 0.05]} material={m.glass('#9fc3d9', 0.1)}>
        <circleGeometry args={[WIN_R, 32]} />
      </mesh>
    </group>
  )
}

/** verrière du cockpit : montants + grande vitre */
function Canopy({ w }: { w: WindowDef }) {
  const m = useMats()
  return (
    <group position={[w.x, 0, w.z]} rotation={[0, w.rot, 0]}>
      <mesh position={[0, 0.92, 0.04]} castShadow material={m.painted('#2c2f33', 0.4, 0.7)}>
        <boxGeometry args={[TILE, 0.08, 0.16]} />
      </mesh>
      <mesh position={[-TILE / 2, CEIL / 2 + 0.45, 0]} castShadow material={m.painted('#2c2f33', 0.4, 0.7)}>
        <boxGeometry args={[0.12, CEIL - 0.9, 0.2]} />
      </mesh>
      <mesh position={[0, CEIL - 0.05, 0]} castShadow material={m.painted('#2c2f33', 0.4, 0.7)}>
        <boxGeometry args={[TILE, 0.1, 0.2]} />
      </mesh>
      <mesh position={[0, 0.9 + (CEIL - 0.9) / 2, -0.08]} material={m.glass('#b6d3e6', 0.08)}>
        <planeGeometry args={[TILE, CEIL - 0.9]} />
      </mesh>
    </group>
  )
}

/** intensité courante de chaque pièce (0..1), partagée entre la lumière et ses néons */
const roomLevel = new Map<string, number>()

function flickerAt(t: number, seed: number) {
  // grésillement irrégulier avec de courtes coupures
  const a = Math.sin(t * 13.1 + seed) * Math.sin(t * 7.7 + seed * 2.3)
  const cut = Math.sin(t * 0.9 + seed) > 0.82 ? (Math.sin(t * 40) > 0 ? 0.05 : 0.6) : 1
  return Math.max(0.05, (0.82 + 0.18 * a) * cut)
}

/** plafonniers émissifs (bloom) */
function Fixtures({ room, lit }: { room: RoomDef; lit: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const tiles = useMemo(() => {
    const out: [number, number][] = []
    const [x0, z0, x1, z1] = room.rect
    const wide = x1 - x0 >= z1 - z0
    for (let tz = z0; tz <= z1; tz++)
      for (let tx = x0; tx <= x1; tx++) {
        const k = wide ? tx - x0 : tz - z0
        const mid = wide ? Math.floor((z0 + z1) / 2) === tz : Math.floor((x0 + x1) / 2) === tx
        if (mid && k % 2 === 0) out.push([tx, tz])
      }
    return out
  }, [room])
  useEffect(() => {
    const m = new THREE.Matrix4()
    const wide = room.rect[2] - room.rect[0] >= room.rect[3] - room.rect[1]
    tiles.forEach(([tx, tz], i) => {
      const [cx, cz] = tileCenter(tx, tz)
      m.makeRotationY(wide ? 0 : Math.PI / 2)
      m.setPosition(cx, CEIL - 0.03, cz)
      ref.current!.setMatrixAt(i, m)
    })
    ref.current!.instanceMatrix.needsUpdate = true
  }, [tiles, room])
  const color = room.light ?? '#ffffff'
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#111', emissive: color, emissiveIntensity: 0 }), [color])
  useFrame(() => {
    const k = lit ? (roomLevel.get(room.id) ?? 1) : 0
    mat.emissiveIntensity = 4.2 * k
    mat.color.set(lit ? '#1a1a1a' : '#0a0a0a')
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, tiles.length]} material={mat}>
      <boxGeometry args={[1.3, 0.05, 0.22]} />
    </instancedMesh>
  )
}

/** lumière dynamique d'une pièce (nombre constant : on change l'intensité, pas le nombre) */
function RoomLight({ room, on, flicker }: { room: RoomDef; on: boolean; flicker?: boolean }) {
  const ref = useRef<THREE.PointLight>(null)
  const [x0, z0, x1, z1] = room.rect
  const cx = ((x0 + x1 + 1) * TILE) / 2
  const cz = ((z0 + z1 + 1) * TILE) / 2
  const reach = Math.hypot((x1 - x0 + 1) * TILE, (z1 - z0 + 1) * TILE) * 0.55 + 1.5
  const base = (room.intensity ?? 8) * 2.3
  useFrame(({ clock }) => {
    if (!ref.current) return
    let k = on ? 1 : 0
    if (on && flicker) k = flickerAt(clock.elapsedTime, room.rect[0] * 3.1 + room.rect[1])
    // coupure de courant : quelques sursauts puis le noir
    if (G().event?.kind === 'blackout') k *= Math.sin(clock.elapsedTime * 31) > 0.97 ? 0.4 : 0.02
    roomLevel.set(room.id, k)
    k *= diff().light
    ref.current.intensity = flicker || G().event ? base * k : THREE.MathUtils.lerp(ref.current.intensity, base * k, 0.15)
  })
  return <pointLight ref={ref} position={[cx, CEIL - 0.45, cz]} color={room.light} intensity={on ? base : 0} distance={reach} decay={1.5} />
}

export function Level({ map, shadows }: { map: GridMap; shadows: boolean }) {
  const built = useMemo(() => buildLevel(map), [map])
  const flags = useGame((s) => s.flags)
  const lightsOn = (r: RoomDef) => {
    if (r.noDynLight) return false
    if (r.id === 'machinerie') return flags.power && flags.pw_lights
    return true
  }
  useEffect(() => {
    setRoomLit('machinerie', flags.power && flags.pw_lights)
  }, [flags.power, flags.pw_lights])

  return (
    <group>
      {map.rooms.map((room) => {
        const geo = built.rooms[room.id]
        if (!geo) return null
        const lit = lightsOn(room)
        return (
          <RoomCtx.Provider key={room.id} value={{ id: room.id, dark: !!room.dark }}>
            <RoomMeshes room={room} geo={geo} shadows={shadows} />
            <Fixtures room={room} lit={lit} />
            {!room.noDynLight && <RoomLight room={room} on={lit} flicker={!!room.flicker || (room.id === 'sas' && map.zone === 1 && !flags.pressurized)} />}
          </RoomCtx.Provider>
        )
      })}
      {built.windows.map((w, i) => (
        <RoomCtx.Provider key={i} value={{ id: w.room, dark: false }}>
          {w.kind === 'W' ? <Porthole w={w} /> : <Canopy w={w} />}
        </RoomCtx.Provider>
      ))}
      {built.doors.map((d) => (
        <RoomCtx.Provider key={d.id} value={{ id: d.room, dark: !!map.rooms.find((r) => r.id === d.room)?.dark }}>
          <Door {...d} />
        </RoomCtx.Provider>
      ))}
      <LightShafts windows={built.windows} sun={map.sun} />
      <RigidBody type="fixed" colliders={false}>
        {built.colliders.map((c, i) => (
          <CuboidCollider key={i} position={c.p} args={c.h} />
        ))}
      </RigidBody>
      <Props map={map} />
      <EntModels zone={map.zone} />
    </group>
  )
}
