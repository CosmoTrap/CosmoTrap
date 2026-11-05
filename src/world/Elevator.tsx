import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { audio } from '../game/audio/audio'
import { liftUnlocked } from '../game/logic'
import { CEIL } from '../game/maps'
import { G, live, useGame } from '../game/state'
import { useMats } from './materials'
import { Box, Cyl, Screen } from './props/models'

/** Fixed glass wall of the shaft, and the cab's own glass wall inside it. */
const SHAFT_R = 1.7
const CAB_R = 1.42
/** Each door leaf slides just inside the wall it belongs to. */
const LEAF_GAP = 0.04
const DOOR_H = 2.3
const DOOR_HALF = 0.7
const BASE_H = 0.1
/** The single solid volume stopping the player, from inside the cab to outside the shaft. */
const SOLID_R = (SHAFT_R + CAB_R) / 2
const SOLID_HALF = (SHAFT_R - CAB_R) / 2 + 0.04
/** Half of the doorway's angle, shared by both walls. The door faces +x: theta = 90 degrees. */
const GAP = Math.asin(DOOR_HALF / SHAFT_R)
const DOOR_THETA = Math.PI / 2
const OPEN_DISTANCE = 2.6
/** Keep in step with the 'lift' entity in game/maps/hubDecor.ts. */
const PILLAR_X = -1
const PILLAR_H = 1.02
/** Mullions stay on the solid walls: the doorway spans theta = 1.15 to 2.0. */
const MULLIONS = [0.75, 2.45, 3.25, 4.05, 4.85, 5.65]

/** One arc of a vertical cylinder; x = r sin(theta), z = r cos(theta). */
function Arc({ r, start, length, y0 = 0, y1 = CEIL, m, cast = true }: { r: number; start: number; length: number; y0?: number; y1?: number; m: THREE.Material; cast?: boolean }) {
  const geometry = useMemo(() => {
    const g = new THREE.CylinderGeometry(r, r, y1 - y0, 64, 1, true, start, length)
    // Metres, not 0..1: otherwise one texture stretches around the whole cylinder.
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * r * length / 2, uv.getY(i) * (y1 - y0) / 2)
    return g
  }, [r, start, length, y0, y1])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh position={[0, (y0 + y1) / 2, 0]} geometry={geometry} material={m} castShadow={cast} receiveShadow={cast} />
}

/** A curved glass wall with its low base, mullions and door jambs. */
function GlassWall({ r, glass, frame }: { r: number; glass: THREE.Material; frame: THREE.Material }) {
  const start = DOOR_THETA + GAP
  const length = Math.PI * 2 - GAP * 2
  return <>
    <Arc r={r} start={start} length={length} y0={BASE_H} y1={DOOR_H} m={glass} cast={false} />
    <Arc r={r} start={start} length={length} y1={BASE_H} m={frame} />
    {[...MULLIONS, DOOR_THETA + GAP, DOOR_THETA - GAP].map((a) => <group key={a} position={[Math.sin(a) * r, 0, Math.cos(a) * r]} rotation={[0, a, 0]}>
      <Box s={[0.05, DOOR_H, 0.07]} p={[0, DOOR_H / 2, 0]} m={frame} />
    </group>)}
  </>
}

/** Glass lift at the centre of the hub. It stays closed until the floor's puzzles are solved. */
export function Elevator({ zone, cx, cz }: { zone: number; cx: number; cz: number }) {
  const m = useMats()
  const unlocked = useGame((s) => liftUnlocked(s.zone, s.flags.pressurized))
  const left = useRef<THREE.Group>(null), right = useRef<THREE.Group>(null)
  const anim = useRef(0), target = useRef(0)
  const [closed, setClosed] = useState(true)
  const lamp = useMemo(() => new THREE.MeshStandardMaterial({ color: '#081218', emissive: '#ff4128', emissiveIntensity: 2.6 }), [])
  const shell = m.painted('#7f8a90', 0.42, 0.6)
  const frame = m.painted('#343e46', 0.42, 0.7)
  const steel = m.metal('#a3adb3', 0.26)
  const glassBase = m.glass('#aac9da', 0.14)
  const alarm = useMemo(() => new THREE.MeshStandardMaterial({ color: '#080202', emissive: '#ff1a0a', emissiveIntensity: 1 }), [])
  const cabLight = useRef<THREE.PointLight>(null)
  const inner = useMemo(() => {
    const c = shell.clone()
    c.side = THREE.BackSide
    // The cab's own circuit: it stays readable during the hub's power cuts.
    c.emissive.set('#ff2a1a')
    c.emissiveIntensity = 0.2
    return c
  }, [shell])
  // Seen from both the hub and the cab.
  const glass = useMemo(() => {
    const c = glassBase.clone()
    c.side = THREE.DoubleSide
    // Barely any specular: the sun coming through the hub's windows must not glare on the lift.
    c.specularIntensity = 0.06
    return c
  }, [glassBase])
  useEffect(() => () => { lamp.dispose(); alarm.dispose(); inner.dispose(); glass.dispose() }, [lamp, alarm, inner, glass])

  useFrame(({ clock }, dt) => {
    // A slow swell, about three seconds per cycle, on its own circuit: it never stops.
    const locked = !liftUnlocked(G().zone, G().flags.pressurized)
    const pulse = 0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.2)
    alarm.emissive.set(locked ? '#ff1a0a' : '#eef4ff')
    alarm.emissiveIntensity = locked ? 0.2 + 2.6 * pulse : 1.3
    inner.emissive.set(locked ? '#ff2a1a' : '#eef4ff')
    inner.emissiveIntensity = locked ? 0.06 + 0.34 * pulse : 0.12
    if (cabLight.current) {
      cabLight.current.color.set(locked ? '#ff1a0a' : '#f2f6ff')
      cabLight.current.intensity = locked ? 0.5 + 6 * pulse : 4
    }
    const open = liftUnlocked(G().zone, G().flags.pressurized) && G().cine !== 'lift'
      && Math.hypot(live.pos[0] - (cx + SHAFT_R), live.pos[2] - cz) < OPEN_DISTANCE
    const t = open ? 1 : 0
    if (t !== target.current) {
      target.current = t
      audio.sfx('door_open', { pos: [cx + SHAFT_R, 1.4, cz], vol: t ? 0.9 : 0.5 })
    }
    anim.current = THREE.MathUtils.damp(anim.current, t, t ? 3.2 : 4, dt)
    const k = THREE.MathUtils.smootherstep(anim.current, 0, 1) * GAP * 1.05
    // Shaft and cab doors open together, each pair sliding along its own curve.
    if (left.current) left.current.rotation.y = k
    if (right.current) right.current.rotation.y = -k
    const isClosed = anim.current < 0.55
    if (isClosed !== closed) setClosed(isClosed)
    lamp.emissive.set(liftUnlocked(G().zone, G().flags.pressurized) ? '#62d6b1' : '#ff4128')
  })

  const segments = useMemo(() => {
    const start = DOOR_THETA + GAP, length = Math.PI * 2 - GAP * 2, step = length / 28
    return Array.from({ length: 28 }, (_, i) => {
      const a = start + (i + 0.5) * step
      return { x: Math.sin(a) * SOLID_R, z: Math.cos(a) * SOLID_R, a, half: Math.tan(step / 2) * SOLID_R + 0.01 }
    })
  }, [])
  const destination = zone === 1 ? 'ETAGE 2  v' : 'ETAGE 1  ^'

  return <group name="elevator">
    {/* Fixed shaft: glass wall, and the solid machinery band hiding the floor above. */}
    <group name="elevator-shaft">
      <GlassWall r={SHAFT_R} glass={glass} frame={frame} />
      <Arc r={SHAFT_R} start={0} length={Math.PI * 2} y0={DOOR_H} m={shell} />
      <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} material={frame} receiveShadow>
        <circleGeometry args={[SHAFT_R, 64]} />
      </mesh>
      <mesh position={[0, 2.72, 0]} rotation={[Math.PI / 2, 0, 0]} material={alarm}>
        <torusGeometry args={[SHAFT_R + 0.025, 0.02, 8, 96]} />
      </mesh>
      {/* Outside: state lamp and floor display. */}
      <Box s={[0.03, 0.03, DOOR_HALF * 2]} p={[SHAFT_R + 0.015, DOOR_H + 0.07, 0]} m={lamp} cast={false} />
      <group position={[SHAFT_R + 0.03, 2.58, 0]} rotation={[0, Math.PI / 2, 0]}>
        <Box s={[1.08, 0.3, 0.05]} m={frame} />
        <Screen w={1} h={0.24} p={[0, 0, 0.03]} lines={[`ETAGE ${zone} - ${unlocked ? 'ASCENSEUR' : 'VERROUILLE'}`]} intensity={0.8} fg={unlocked ? '#62d6b1' : '#ff6a50'} />
      </group>
    </group>

    {/* The cab itself: its own glass wall, roof band, floor, light and controls. */}
    <group name="elevator-cab">
      <GlassWall r={CAB_R} glass={glass} frame={frame} />
      <Arc r={CAB_R} start={0} length={Math.PI * 2} y0={DOOR_H} m={inner} />
      <mesh position={[0, DOOR_H, 0]} rotation={[Math.PI / 2, 0, 0]} material={frame}>
        <ringGeometry args={[CAB_R, SHAFT_R, 96]} />
      </mesh>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} material={steel} receiveShadow>
        <circleGeometry args={[CAB_R, 48]} />
      </mesh>
      {/* The cab's own ceiling, lower than the room's, with the lamp set flush into it. */}
      <mesh name="elevator-ceiling" position={[0, DOOR_H - 0.01, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.painted('#c8ccce', 0.34, 0.45)} receiveShadow>
        <circleGeometry args={[CAB_R + 0.01, 64]} />
      </mesh>
      {[0.82, 1.14].map((r) => <mesh key={r} position={[0, DOOR_H - 0.014, 0]} rotation={[Math.PI / 2, 0, 0]} material={frame}><torusGeometry args={[r, 0.008, 6, 64]} /></mesh>)}
      {Array.from({ length: 12 }, (_, i) => {
        const a = i / 12 * Math.PI * 2
        return <Box key={i} s={[0.14, 0.006, 0.025]} p={[Math.sin(a) * 0.98, DOOR_H - 0.014, Math.cos(a) * 0.98]} r={[0, a, 0]} m={frame} />
      })}
      <mesh position={[0, DOOR_H - 0.022, 0]} rotation={[Math.PI / 2, 0, 0]} material={steel}><torusGeometry args={[0.62, 0.022, 10, 64]} /></mesh>
      <mesh name="elevator-lamp" position={[0, DOOR_H - 0.018, 0]} rotation={[Math.PI / 2, 0, 0]} material={alarm}>
        <circleGeometry args={[0.6, 48]} />
      </mesh>
      <pointLight ref={cabLight} name="elevator-alarm-light" position={[0, DOOR_H - 0.3, 0]} color="#ff1a0a" intensity={1} distance={5} decay={1.6} />
      {/* Control tablet on a pillar anchored in the floor, facing the door. */}
      <group name="elevator-control" position={[PILLAR_X, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <Cyl a={[0.2, 0.24, 0.04]} p={[0, 0.032, 0]} m={frame} seg={32} />
        <Cyl a={[0.045, 0.06, PILLAR_H]} p={[0, PILLAR_H / 2, 0]} m={steel} seg={20} />
        <group position={[0, PILLAR_H + 0.03, 0.02]} rotation={[-0.65, 0, 0]}>
          <Box s={[0.44, 0.38, 0.035]} m={frame} />
          <Screen w={0.38} h={0.25} p={[0, 0.04, 0.02]} lines={[`ETAGE ${zone}`, destination]} intensity={0.9} fg="#62d6b1" />
          <Cyl a={[0.028, 0.028, 0.012]} p={[0, -0.135, 0.022]} r={[Math.PI / 2, 0, 0]} m={m.glow('#62d6b1', 2)} />
        </group>
      </group>
    </group>

    {/* Threshold bridging the gap between the two walls. */}
    <Box s={[SHAFT_R - CAB_R + 0.36, 0.02, DOOR_HALF * 2]} p={[SOLID_R - 0.08, 0.016, 0]} m={steel} />

    {/* Sliding glass leaves, one pair per wall. Their edges meet at the centre only while closed. */}
    {[1, -1].map((side) => <group key={side} ref={side === 1 ? left : right}>
      {[SHAFT_R - LEAF_GAP, CAB_R + LEAF_GAP].map((r) => <group key={r}>
        <Arc r={r} start={side === 1 ? DOOR_THETA : DOOR_THETA - GAP} length={GAP} y1={DOOR_H} m={glass} cast={false} />
        <Box s={[0.035, DOOR_H, 0.05]} p={[r, DOOR_H / 2, -side * 0.02]} m={frame} />
      </group>)}
    </group>)}

    <RigidBody name="elevator" type="fixed" colliders={false}>
      {segments.map((s, i) => <CuboidCollider key={i} position={[s.x, CEIL / 2, s.z]} rotation={[0, s.a, 0]} args={[s.half, CEIL / 2, SOLID_HALF]} />)}
      <CuboidCollider position={[SOLID_R, (CEIL + DOOR_H) / 2, 0]} args={[SOLID_HALF, (CEIL - DOOR_H) / 2, DOOR_HALF + 0.05]} />
      <CuboidCollider name="elevator-roof" position={[0, DOOR_H + 0.05, 0]} args={[CAB_R, 0.05, CAB_R]} />
      <CuboidCollider name="elevator-control" position={[PILLAR_X, (PILLAR_H + 0.2) / 2, 0]} args={[0.12, (PILLAR_H + 0.2) / 2, 0.22]} />
      {closed && <CuboidCollider name="elevator-door" position={[SOLID_R, DOOR_H / 2, 0]} args={[SOLID_HALF, DOOR_H / 2, DOOR_HALF]} />}
    </RigidBody>
  </group>
}
