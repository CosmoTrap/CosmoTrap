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
import { RoomCtx, ceilingMaterial, floorMaterial, hullMaterial, setRoomLit, useMats, wallMaterial } from './materials'
import { EntModels } from './props/EntModels'
import { Props } from './props/Props'
import { EmergencyLights } from './EmergencyLights'
import { lampPositions, roomPowerCut } from './roomPower'
import { RoundHub } from './RoundHub'
import { StationPower } from './StationPower'
import { doorShadows } from './doorShadows'
import { TransmissionCulling } from './TransmissionCulling'

export const WIN_R = 0.42
/** Thickness of the station's outer wall behind a room (m). */
export const HULL_THICKNESS = 0.35
export const WIN_Y = 1.5
const WIN_DEPTH = 0.42

export interface WindowDef {
  x: number
  z: number
  rot: number // rotation Y : la normale +z locale pointe vers l'intérieur
  kind: 'W' | 'V'
  room: string
}

interface Built {
  rooms: Record<string, { floor: THREE.BufferGeometry[]; ceil: THREE.BufferGeometry[]; wall: THREE.BufferGeometry[]; trim: THREE.BufferGeometry[] }>
  windows: WindowDef[]
  colliders: { p: [number, number, number]; h: [number, number, number] }[]
  /** Opaque shell behind every wall, floor and ceiling: no seam can ever show open space. */
  hull: THREE.BufferGeometry | null
  doors: { id: string; x: number; z: number; alongZ: boolean; room: string }[]
}

const DIRS: { d: [number, number]; rot: number; off: (tx: number, tz: number) => [number, number] }[] = [
  { d: [0, -1], rot: 0, off: (tx, tz) => [tx * TILE + 1, tz * TILE] }, // mur nord
  { d: [0, 1], rot: Math.PI, off: (tx, tz) => [tx * TILE + 1, (tz + 1) * TILE] }, // sud
  { d: [-1, 0], rot: Math.PI / 2, off: (tx, tz) => [tx * TILE, tz * TILE + 1] }, // ouest
  { d: [1, 0], rot: -Math.PI / 2, off: (tx, tz) => [(tx + 1) * TILE, tz * TILE + 1] }, // est
]

function wallQuad() {
  // A hair wider and taller than its tile, so neighbouring panels meet with no seam at corners.
  const g = new THREE.PlaneGeometry(TILE + 0.02, CEIL + 0.04)
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
  const R = (id: string) => (rooms[id] ??= { floor: [], ceil: [], wall: [], trim: [] })
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
      if (map.rooms.find((room) => room.id === rid)?.shape === 'round') continue
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
        // Real depth at panel seams and skirting: catch grazing light without
        // adding a draw call per rib. Do not bridge doors or cover the windows.
        for (const [width, height, depth, px, py] of [
          // The skirting stays thin too: anything standing against the wall must hide it, not be crossed by it.
          [TILE, 0.12, 0.018, 0, 0.06],
          [TILE, 0.1, 0.1, 0, CEIL - 0.05],
          // Stands just proud enough to read as solid, while staying behind the cables (2.2 cm off the wall).
          [0.045, CEIL, 0.02, -0.97, CEIL / 2],
        ]) {
          const rib = new THREE.BoxGeometry(width, height, depth)
          rib.translate(px, py, depth / 2)
          rib.rotateY(dir.rot); rib.translate(x, 0, z)
          r.trim.push(rib)
        }
      }
    }

  // A corner post wherever two walls meet, inside corners and door jambs alike: the panels stop exactly
  // on the corner, and from close up the seam between them would show open space. The hub has its own.
  const round = map.rooms.filter((room) => room.shape === 'round').map((room) => room.rect)
  for (let tz = 0; tz <= H; tz++) for (let tx = 0; tx <= W; tx++) {
    const around: [number, number][] = [[tx - 1, tz - 1], [tx, tz - 1], [tx - 1, tz], [tx, tz]]
    const floors = around.filter(([x, z]) => isFloor(cellAt(map, x, z)))
    if (!floors.length || floors.length === 4) continue
    // Two floor tiles side by side: that is a straight wall, not a corner.
    if (floors.length === 2 && (floors[0][0] === floors[1][0] || floors[0][1] === floors[1][1])) continue
    if (floors.some(([x, z]) => round.some(([x0, z0, x1, z1]) => x >= x0 && x <= x1 && z >= z0 && z <= z1))) continue
    const post = new THREE.BoxGeometry(0.1, CEIL, 0.1)
    post.translate(tx * TILE, CEIL / 2, tz * TILE)
    R(roomOf(floors[0][0], floors[0][1])).trim.push(post)
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
  const hull: THREE.BufferGeometry[] = []
  const hullRoofs: THREE.BufferGeometry[] = []
  const solidBehind = (c: string) => c === '#'
  // The round hub has its own hull and looks out through its windows: nothing may stand in front of space there.
  const hubs = map.rooms.filter((room) => room.shape === 'round').map((room) => room.rect)
  const inHub = (tx: number, tz: number, margin = 0) => hubs.some(([x0, z0, x1, z1]) => tx >= x0 - margin && tx <= x1 + margin && tz >= z0 - margin && tz <= z1 + margin)
  const liningTunnel = (tx: number, tz: number) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => isFloor(cellAt(map, tx + dx, tz + dz)) && !inHub(tx + dx, tz + dz))
  for (let tz = 0; tz < H; tz++) for (let tx = 0; tx < W; tx++) {
    const c = cellAt(map, tx, tz)
    const [cx, cz] = tileCenter(tx, tz)
    if (inHub(tx, tz, 3) && !liningTunnel(tx, tz) && (!isFloor(c) || inHub(tx, tz))) continue
    if (isFloor(c)) {
      for (const y of [-0.025, CEIL + 0.025]) {
        // Reaches over the thin shell of the walls around it.
        const plane = new THREE.PlaneGeometry(TILE + 2 * HULL_THICKNESS, TILE + 2 * HULL_THICKNESS)
        plane.rotateX(-Math.PI / 2); plane.translate(cx, y, cz)
        hullRoofs.push(plane)
      }
    } else if (solidBehind(c) && near(tx, tz)) {
      // A thin shell right behind the wall facing a room, not the whole 2 m tile: the station's outer
      // walls are this thin. It stops just short of the room and overlaps its neighbours along the wall.
      const shell = (x: number, z: number, wide: number, deep: number) => {
        const box = new THREE.BoxGeometry(wide, CEIL + 0.1, deep)
        box.translate(x, CEIL / 2, z)
        hull.push(box)
      }
      const inner = TILE / 2 - 0.015 - HULL_THICKNESS / 2
      // Along the wall, each end overlaps a solid neighbour but stops short of a room or a door:
      // its edge would otherwise stand inside that room, as a pale strip beside the door.
      const end = (dx: number, dz: number) => (isFloor(cellAt(map, tx + dx, tz + dz)) ? -0.015 : 0.02)
      let facing = false
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (!isFloor(cellAt(map, tx + dx, tz + dz))) continue
        facing = true
        if (dx) {
          const a = end(0, -1), b = end(0, 1)
          shell(cx + dx * inner, cz + (b - a) / 2, HULL_THICKNESS, TILE + a + b)
        } else {
          const a = end(-1, 0), b = end(1, 0)
          shell(cx + (b - a) / 2, cz + dz * inner, TILE + a + b, HULL_THICKNESS)
        }
      }
      // Round a room's corner, where this tile only touches it diagonally.
      if (!facing) for (const [dx, dz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        if (isFloor(cellAt(map, tx + dx, tz + dz))) shell(cx + dx * inner, cz + dz * inner, HULL_THICKNESS, HULL_THICKNESS)
      }
    }
  }
  const walls = hull.length ? mergeGeometries(hull.map((g) => g.toNonIndexed())) : null
  const roofs = hullRoofs.length ? mergeGeometries(hullRoofs.map((g) => g.toNonIndexed())) : null
  const shell = walls && roofs ? mergeGeometries([walls, roofs], true) : walls ?? roofs
  if (walls && roofs) { walls.dispose(); roofs.dispose() }
  hull.forEach(g => g.dispose()); hullRoofs.forEach(g => g.dispose())
  return { rooms, windows, colliders, doors, hull: shell }
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
      trim: geo.trim.length ? mergeGeometries(geo.trim) : null,
    }),
    [geo],
  )
  const dark = !!room.dark
  const theme = room.theme ?? 'station'
  const m = useMats()
  return (
    <group>
      {/* Write the opaque room envelope before shading the furniture behind it. */}
      <mesh renderOrder={-1} geometry={merged.floor} material={floorMaterial(floorKind(room), dark, room.id)} receiveShadow castShadow />
      <mesh renderOrder={-1} geometry={merged.ceil} material={ceilingMaterial(dark, room.id)} receiveShadow castShadow />
      {merged.wall && <mesh renderOrder={-1} geometry={merged.wall} material={wallMaterial(theme, dark, room.id)} receiveShadow castShadow />}
      {merged.trim && <mesh geometry={merged.trim} material={m.painted('#60676b', 0.48, 0.65)} receiveShadow castShadow />}
    </group>
  )
}

/** hublot : tunnel, cadre boulonné, vitre */
function Porthole({ w }: { w: WindowDef }) {
  const m = useMats()
  // Clear glass: reflections of the bright room must not wash out the black of space.
  const glass = m.glass('#9fc3d9', 0.05) as THREE.MeshStandardMaterial
  glass.envMapIntensity = 0.04
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
      <mesh position={[0, WIN_Y, -WIN_DEPTH + 0.05]} material={glass}>
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

/** plafonniers émissifs (bloom) */
function Fixtures({ room, lit }: { room: RoomDef; lit: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const housing = useRef<THREE.InstancedMesh>(null)
  const materials = useMats()
  const lamps = useMemo(() => lampPositions(room), [room])
  useEffect(() => {
    const m = new THREE.Matrix4()
    const wide = room.rect[2] - room.rect[0] >= room.rect[3] - room.rect[1]
    lamps.forEach(([cx, cz], i) => {
      m.makeRotationY(wide ? 0 : Math.PI / 2)
      m.setPosition(cx, CEIL - 0.125, cz)
      ref.current!.setMatrixAt(i, m)
      m.setPosition(cx, CEIL - 0.06, cz)
      housing.current!.setMatrixAt(i, m)
    })
    ref.current!.instanceMatrix.needsUpdate = true
    housing.current!.instanceMatrix.needsUpdate = true
    // Three caches these from the matrices it first sees: stale ones made lamps vanish at some angles.
    ref.current!.computeBoundingSphere()
    housing.current!.computeBoundingSphere()
  }, [lamps, room])
  const color = room.light ?? '#ffffff'
  // A frosted LED panel: switched off it is a pale disc, still plainly there on the ceiling.
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9ced1', roughness: 0.42, emissive: color, emissiveIntensity: 0 }), [color])
  useFrame(() => {
    const k = lit && !roomPowerCut(room) ? 1 : 0
    mat.emissiveIntensity = 3.4 * k
  })
  return (
    <group>
      <instancedMesh ref={housing} args={[undefined, undefined, lamps.length]} material={materials.metal('#8d9499', 0.3)} receiveShadow>
        <cylinderGeometry args={[0.36, 0.4, 0.12, 48]} />
      </instancedMesh>
      <instancedMesh name={`ceiling-light:${room.id}`} ref={ref} args={[undefined, undefined, lamps.length]} material={mat}>
        <cylinderGeometry args={[0.33, 0.33, 0.012, 48]} />
      </instancedMesh>
    </group>
  )
}

/** lumière dynamique d'une pièce (nombre constant : on change l'intensité, pas le nombre) */
function RoomLight({ room, on, offset = [0, 0], share = 1 }: { room: RoomDef; on: boolean; offset?: [number, number]; share?: number }) {
  const ref = useRef<THREE.PointLight>(null)
  // Only the two lamps on either side of the mission airlock need local shadows.
  // Cached cube maps avoid rendering every room six times on every frame.
  const shadowed = G().zone === 1 ? ['sas', 'liaison_est'].includes(room.id)
    : G().zone === 2 && ['amarrage', 'liaison_ouest'].includes(room.id)
  const shadowVersion = useRef(-1)
  const [x0, z0, x1, z1] = room.rect
  // Directly under a real lamp, and well below the ceiling, so no bright spot appears on bare panels.
  const wide = x1 - x0 >= z1 - z0
  const snap = (from: number, to: number) => from + Math.round((to - from) / 4) * 2
  const fixture = room.shape === 'round' ? null : wide
    ? tileCenter(snap(x0, x1), Math.floor((z0 + z1) / 2))
    : tileCenter(Math.floor((x0 + x1) / 2), snap(z0, z1))
  const cx = (fixture ? fixture[0] : ((x0 + x1 + 1) * TILE) / 2) + offset[0]
  const cz = (fixture ? fixture[1] : ((z0 + z1 + 1) * TILE) / 2) + offset[1]
  const reach = Math.hypot((x1 - x0 + 1) * TILE, (z1 - z0 + 1) * TILE) * 0.55 + 1.5
  const base = (room.intensity ?? 8) * 2.3 * share
  useFrame((_, dt) => {
    if (!ref.current) return
    // The normal circuit really goes dark. Red light comes from the beacons.
    ref.current.intensity = !on || roomPowerCut(room) ? 0
      : THREE.MathUtils.damp(ref.current.intensity, base * diff().light, 10, Math.min(dt, 0.1))
    if (shadowed && (G().loading < 1 || shadowVersion.current !== doorShadows.version)) {
      ref.current.shadow.needsUpdate = true
      shadowVersion.current = doorShadows.version
    }
  })
  return <pointLight name={`room-light:${room.id}`} ref={ref} position={[cx, CEIL - 1.05, cz]} color={room.light} intensity={on && !roomPowerCut(room) ? base : 0} distance={reach} decay={1.5}
    castShadow={shadowed} shadow-mapSize={[256, 256]} shadow-autoUpdate={false} shadow-bias={-0.00015} shadow-normalBias={0.015} shadow-camera-near={0.1} shadow-camera-far={reach} />
}

/** A light at the hub's centre would be inside the lift and leave its outer wall black. */
const HUB_LIGHTS = [0, 1, 2].map((i): [number, number] => {
  const a = Math.PI / 2 + i * Math.PI * 2 / 3
  return [Math.sin(a) * 4, Math.cos(a) * 4]
})

/**
 * A permanently textured outer shell seals seams and stops sunlight.
 * Its appearance must not change when the player moves between rooms.
 */
function Hull({ geometry, map }: { geometry: THREE.BufferGeometry; map: GridMap }) {
  const materials = useMemo(() => [hullMaterial('wall', map.zone === 3 ? 'rocket' : 'station'), hullMaterial('roof', map.zone === 3 ? 'rocket' : 'station')], [map.zone])
  return <mesh name="hull" geometry={geometry} material={materials} castShadow receiveShadow />
}

export function Level({ map, shadows }: { map: GridMap; shadows: boolean }) {
  const root = useRef<THREE.Group>(null)
  const built = useMemo(() => buildLevel(map), [map])
  const machineryLit = useGame((s) => s.flags.power && s.flags.pw_lights)
  const lightsOn = (r: RoomDef) => {
    if (r.noDynLight) return false
    if (r.id === 'machinerie') return machineryLit
    return true
  }
  useEffect(() => {
    setRoomLit('machinerie', machineryLit)
  }, [machineryLit])

  return (
    <group ref={root} name="station-level">
      <TransmissionCulling root={root} />
      {map.zone === 2 && <StationPower root={root} />}
      {map.rooms.map((room) => {
        const geo = built.rooms[room.id]
        if (!geo && room.shape !== 'round') return null
        const lit = lightsOn(room)
        return (
          <RoomCtx.Provider key={room.id} value={{ id: room.id, dark: !!room.dark }}>
            {room.shape === 'round' ? <RoundHub room={room} shadows={shadows} zone={map.zone} /> : <RoomMeshes room={room} geo={geo} shadows={shadows} />}
            <Fixtures room={room} lit={lit} />
            {!room.noDynLight && (room.shape === 'round'
              ? HUB_LIGHTS.map((offset, i) => <RoomLight key={i} room={room} on={lit} offset={offset} share={0.5} />)
              : <RoomLight room={room} on={lit} />)}
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
      {built.hull && <Hull geometry={built.hull} map={map} />}
      <LightShafts windows={built.windows} sun={map.sun} />
      <RigidBody type="fixed" colliders={false}>
        {built.colliders.map((c, i) => (
          <CuboidCollider key={i} position={c.p} args={c.h} />
        ))}
      </RigidBody>
      <Props map={map} />
      <EmergencyLights map={map} />
      <EntModels zone={map.zone} />
    </group>
  )
}
