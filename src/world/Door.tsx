import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody, type RapierCollider } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { audio } from '../game/audio/audio'
import { CEIL } from '../game/maps'
import { doorUnlocked } from '../game/logic'
import { live } from '../game/state'
import { useMats } from './materials'
import { alarmOn } from './roomPower'
import { Box, Cyl } from './props/models'
import { drawTexture } from './textures'
import { StaticBatch } from './props/StaticBatch'

export const DOOR_HEIGHT = 2.3
const OPENING_HALF = 0.72
const CHAMFER = 0.2
/** Distance of each of the two pressure doors from the middle of the lock. */
const LEAF_Z = 0.62
const LEAF_TRAVEL = 0.74

/** Yellow and black warning stripes, shared by every door. */
let hazardTexture: THREE.Texture | null = null
function hazard() {
  hazardTexture ??= drawTexture(256, 32, (c) => {
    c.fillStyle = '#d9a521'
    c.fillRect(0, 0, 256, 32)
    c.fillStyle = '#14171a'
    for (let x = -32; x < 288; x += 40) {
      c.beginPath()
      c.moveTo(x, 32); c.lineTo(x + 20, 32); c.lineTo(x + 52, 0); c.lineTo(x + 32, 0)
      c.fill()
    }
  })
  hazardTexture.wrapS = THREE.RepeatWrapping
  return hazardTexture
}

/** Wall plate around the opening: a solid face with chamfered upper corners cut out of it. */
function portalGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(-1, 0); shape.lineTo(1, 0); shape.lineTo(1, CEIL); shape.lineTo(-1, CEIL); shape.closePath()
  const hole = new THREE.Path()
  const w = OPENING_HALF, h = DOOR_HEIGHT
  hole.moveTo(-w, 0); hole.lineTo(-w, h - CHAMFER); hole.lineTo(-w + CHAMFER, h); hole.lineTo(w - CHAMFER, h); hole.lineTo(w, h - CHAMFER); hole.lineTo(w, 0); hole.closePath()
  shape.holes.push(hole)
  return new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1 })
}

const WINDOW = { x: 0.03, y: 1.58, w: 0.44, h: 0.66, r: 0.09 }

function roundedRect(path: THREE.Shape | THREE.Path, x: number, y: number, w: number, h: number, r: number) {
  const l = x - w / 2, b = y - h / 2
  path.moveTo(l + r, b)
  path.lineTo(l + w - r, b); path.absarc(l + w - r, b + r, r, -Math.PI / 2, 0, false)
  path.lineTo(l + w, b + h - r); path.absarc(l + w - r, b + h - r, r, 0, Math.PI / 2, false)
  path.lineTo(l + r, b + h); path.absarc(l + r, b + h - r, r, Math.PI / 2, Math.PI, false)
  path.lineTo(l, b + r); path.absarc(l + r, b + r, r, Math.PI, Math.PI * 1.5, false)
}

/** A door leaf, or the frame of its window: a plate with a real opening cut through it. */
function plateWithWindow(sign: number, width: number, height: number, cx: number, cy: number, depth: number) {
  const shape = new THREE.Shape()
  roundedRect(shape, cx, cy, width, height, Math.min(0.1, Math.min(width, height) / 4))
  const hole = new THREE.Path()
  roundedRect(hole, sign * WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h, WINDOW.r)
  shape.holes.push(hole)
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 8 })
  g.translate(0, 0, -depth / 2)
  return g
}

/** One sliding half of a pressure door, with a glazed window you can see through. */
function Leaf({ sign, lamp }: { sign: 1 | -1; lamp: THREE.Material }) {
  const m = useMats()
  const hazardMaterial = useMemo(() => new THREE.MeshStandardMaterial({ map: hazard(), roughness: 0.6 }), [])
  const geometry = useMemo(() => {
    const leaf = new THREE.Shape()
    leaf.moveTo(-0.37, 0); leaf.lineTo(0.37, 0); leaf.lineTo(0.37, DOOR_HEIGHT); leaf.lineTo(-0.37, DOOR_HEIGHT); leaf.closePath()
    const hole = new THREE.Path()
    roundedRect(hole, sign * WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h, WINDOW.r)
    leaf.holes.push(hole)
    const plate = new THREE.ExtrudeGeometry(leaf, { depth: 0.07, bevelEnabled: false, curveSegments: 8 })
    plate.translate(0, 0, -0.035)
    return { plate, frame: plateWithWindow(sign, WINDOW.w + 0.06, WINDOW.h + 0.06, sign * WINDOW.x, WINDOW.y, 0.09) }
  }, [sign])
  useEffect(() => () => { hazardMaterial.dispose(); geometry.plate.dispose(); geometry.frame.dispose() }, [hazardMaterial, geometry])
  const armour = m.painted('#8b979b', 0.4, 0.65), recess = m.painted('#343e46', 0.45, 0.65), steel = m.metal('#a3adb3', 0.26)
  // Each half moves as a unit; its detailing is fixed in that local frame.
  return <StaticBatch>
    <mesh geometry={geometry.plate} material={armour} castShadow receiveShadow />
    <mesh geometry={geometry.frame} material={steel} />
    <mesh position={[sign * WINDOW.x, WINDOW.y, 0]} material={m.glass('#cfe6f2', 0.16)}><planeGeometry args={[WINDOW.w, WINDOW.h]} /></mesh>
    <Box s={[0.62, 0.72, 0.085]} p={[-sign * 0.01, 0.62, 0]} m={recess} />
    <Box s={[0.74, 0.1, 0.082]} p={[0, 0.16, 0]} m={hazardMaterial} cast={false} />
    <Box s={[0.022, DOOR_HEIGHT, 0.09]} p={[-sign * 0.365, DOOR_HEIGHT / 2, 0]} m={m.rubber('#111b20')} cast={false} />
    <Box s={[0.012, 0.4, 0.092]} p={[-sign * 0.335, 1.1, 0]} m={lamp} cast={false} />
    {[0.36, 0.86].map((y) => <Box key={y} s={[0.3, 0.018, 0.09]} p={[sign * 0.03, y, 0]} m={steel} cast={false} />)}
  </StaticBatch>
}

/** A real airlock: two pressure doors with a small chamber between them, opening one after the other. */
export function Door({ id, x, z, alongZ, rotationY }: { id: string; x: number; z: number; alongZ: boolean; room: string; rotationY?: number }) {
  const m = useMats()
  const leaves = useRef<(THREE.Group | null)[]>([])
  const anim = useRef([0, 0]), target = useRef(0)
  const blockers = useRef<(RapierCollider | null)[]>([])
  const closed = useRef([true, true])
  const lamp = useMemo(() => new THREE.MeshStandardMaterial({ color: '#081218', emissive: '#ff4128', emissiveIntensity: 2.4 }), [])
  const chamberLight = useMemo(() => new THREE.MeshStandardMaterial({ color: '#081218', emissive: '#e8f6ff', emissiveIntensity: 1.2 }), [])
  const portal = useMemo(portalGeometry, [])
  const hazardMaterial = useMemo(() => new THREE.MeshStandardMaterial({ map: hazard(), roughness: 0.6 }), [])
  useEffect(() => () => { lamp.dispose(); chamberLight.dispose(); portal.dispose(); hazardMaterial.dispose() }, [lamp, chamberLight, portal, hazardMaterial])
  const rot = rotationY ?? (alongZ ? 0 : Math.PI / 2)
  useFrame(({ clock }, dt) => {
    const unlocked = doorUnlocked(id)
    const dx = live.pos[0] - x, dz = live.pos[2] - z
    const t = unlocked && Math.hypot(dx, dz) < 2.9 ? 1 : 0
    if (t !== target.current) {
      target.current = t
      audio.sfx('door_open', { pos: [x, 1.4, z], vol: t ? 0.9 : 0.5 })
    }
    // The door on the player's side goes first; the far one follows once it is well under way.
    const side = dx * Math.sin(rot) + dz * Math.cos(rot)
    const near = side >= 0 ? 0 : 1, far = 1 - near
    const goal = [0, 0]
    goal[near] = t
    goal[far] = t && anim.current[near] > 0.55 ? 1 : 0
    anim.current.forEach((value, i) => {
      const v = THREE.MathUtils.damp(value, goal[i], goal[i] ? 3.6 : 4, dt)
      anim.current[i] = v
      const k = THREE.MathUtils.smootherstep(v, 0, 1)
      const pair = i * 2
      if (leaves.current[pair]) leaves.current[pair]!.position.x = -0.37 - k * LEAF_TRAVEL
      if (leaves.current[pair + 1]) leaves.current[pair + 1]!.position.x = 0.37 + k * LEAF_TRAVEL
      // Match the actual clear width to the player's 0.64 m collision envelope.
      // Apply before the physics step, without waiting for a React commit.
      const blocked = 2 * k * LEAF_TRAVEL < 0.66
      if (blocked !== closed.current[i] && blockers.current[i]) {
        blockers.current[i]!.setEnabled(blocked)
        closed.current[i] = blocked
      }
    })
    // In the same red breath as the lift while the alarm lasts; otherwise white, and green or red for the lock.
    if (alarmOn()) {
      const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.2)
      lamp.emissive.set('#ff1a0a')
      chamberLight.emissive.set('#ff1a0a')
      lamp.emissiveIntensity = chamberLight.emissiveIntensity = 0.25 + 2.5 * pulse
    } else {
      lamp.emissive.set(unlocked ? '#62d6b1' : '#ff4128')
      lamp.emissiveIntensity = 2.4
      chamberLight.emissive.set('#e8f6ff')
      chamberLight.emissiveIntensity = 1.2
    }
  }, -100)
  const frame = m.painted('#4a545b', 0.42, 0.7)
  const chamber = m.painted('#2c363d', 0.5, 0.65)
  const steel = m.metal('#a3adb3', 0.26)
  return <group name={`bulkhead:${id}`} position={[x, 0, z]} rotation={[0, rot, 0]}>
    <StaticBatch>
    {/* The lock chamber: lined walls and roof, a steel floor, its own light. */}
    {[-1, 1].map((side) => <group key={side}>
      <Box s={[0.28, CEIL, 1.9]} p={[side * 0.86, CEIL / 2, 0]} m={chamber} />
      {[-0.3, 0.3].map((pz) => <Box key={pz} s={[0.012, 1.5, 0.42]} p={[side * 0.72, 1.05, pz]} m={m.painted('#556068', 0.4, 0.6)} cast={false} />)}
      <Box s={[0.012, 0.02, 1.2]} p={[side * 0.722, 2.0, 0]} m={lamp} cast={false} />
    </group>)}
    <Box s={[1.44, CEIL - DOOR_HEIGHT, 1.9]} p={[0, (CEIL + DOOR_HEIGHT) / 2, 0]} m={chamber} />
    <Box s={[1.1, 0.012, 0.3]} p={[0, DOOR_HEIGHT - 0.008, 0]} m={chamberLight} cast={false} />
    <Box s={[1.44, 0.02, 1.9]} p={[0, 0.01, 0]} m={steel} cast={false} />

    {/* Each face: wall plate, hazard sill and header, corner bolts. */}
    {[-1, 1].map((face) => <group key={face} position={[0, 0, face * 0.9]} rotation={[0, face === 1 ? 0 : Math.PI, 0]}>
      <mesh geometry={portal} material={frame} castShadow receiveShadow />
      <Box s={[OPENING_HALF * 2 - CHAMFER * 2, 0.05, 0.11]} p={[0, DOOR_HEIGHT + 0.045, 0.06]} m={hazardMaterial} cast={false} />
      <Box s={[OPENING_HALF * 2, 0.03, 0.2]} p={[0, 0.015, 0.05]} m={hazardMaterial} cast={false} />
      <Box s={[1.2, 0.022, 0.016]} p={[0, CEIL - 0.2, 0.116]} m={lamp} cast={false} />
      {[-1, 1].flatMap((sx) => [0.2, 1.2, 2.2].map((y) => <Cyl key={`${sx}:${y}`} a={[0.02, 0.02, 0.016]} p={[sx * 0.88, y, 0.118]} r={[Math.PI / 2, 0, 0]} m={steel} seg={8} />))}
    </group>)}
    </StaticBatch>

    {/* The two pressure doors. */}
    {[LEAF_Z, -LEAF_Z].map((pz, door) => <group key={pz} position={[0, 0, pz]}>
      <group ref={(g) => { leaves.current[door * 2] = g }} position={[-0.37, 0, 0]}><Leaf sign={-1} lamp={lamp} /></group>
      <group ref={(g) => { leaves.current[door * 2 + 1] = g }} position={[0.37, 0, 0]}><Leaf sign={1} lamp={lamp} /></group>
    </group>)}

    <RigidBody name={`door-frame:${id}`} type="fixed" colliders={false}>
      <CuboidCollider position={[-0.85, CEIL / 2, 0]} args={[0.15, CEIL / 2, 1.05]} />
      <CuboidCollider position={[0.85, CEIL / 2, 0]} args={[0.15, CEIL / 2, 1.05]} />
      <CuboidCollider name={`door-lintel:${id}`} position={[0, (CEIL + DOOR_HEIGHT) / 2, 0]} args={[0.7, (CEIL - DOOR_HEIGHT) / 2, 1.05]} />
      {[LEAF_Z, -LEAF_Z].map((pz, i) => <CuboidCollider key={pz} ref={c => { blockers.current[i] = c }} name={`door-blocker:${id}:${i}`} position={[0, DOOR_HEIGHT / 2, pz]} args={[0.7, DOOR_HEIGHT / 2, 0.05]} />)}
    </RigidBody>
  </group>
}
