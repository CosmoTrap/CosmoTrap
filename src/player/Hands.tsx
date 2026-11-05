import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { G, live, useGame } from '../game/state'
import { preloadModels } from '../world/assets'
import { useMats } from '../world/materials'
import { BoxExact as Box, Cyl, Flashlight } from '../world/props/models'
import { textTexture } from '../world/textures'
import { HeldItem } from './HandheldModels'
import { ARM_THICKNESS, armOf, FOREARM_LENGTH, HAND_SCALE, handMesh, radiusAt, stripMaterial, type HandMesh, type Knot } from './avatarArms'
import { skinOf } from '../world/skins'
import { TABLET_RAISE_MS } from './tabletMotion'

type V3 = [number, number, number]

const UP = new THREE.Vector3(0, 1, 0)

/** One segment of the arm, turned from its profile; starts at `at` and runs along `dir`. */
function Limb({ knots, material, at, dir }: { knots: Knot[]; material: THREE.Material; at: V3; dir: V3 }) {
  const geometry = useMemo(() => {
    const rings: Knot[] = [[knots[0][0], 0, knots[0][2]]]
    for (let i = 0; i < knots.length - 1; i++) {
      const [d0, r0, v0] = knots[i], [d1, r1, v1] = knots[i + 1]
      const steps = Math.max(1, Math.ceil((d1 - d0) / 0.02))
      for (let n = 0; n < steps; n++) {
        const k = n / steps
        rings.push([d0 + (d1 - d0) * k, r0 + (r1 - r0) * k, v0 + (v1 - v0) * k])
      }
    }
    const [dEnd, , vEnd] = knots[knots.length - 1]
    rings.push(knots[knots.length - 1], [dEnd, 0, vEnd])
    const lathe = new THREE.LatheGeometry(rings.map(([d, r]) => new THREE.Vector2(r * ARM_THICKNESS, d)), 32)
    const uv = lathe.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i <= 32; i++) rings.forEach(([, , v], j) => uv.setY(i * rings.length + j, v))
    return lathe
  }, [JSON.stringify(knots)])
  useEffect(() => () => geometry.dispose(), [geometry])
  const quaternion = useMemo(() => new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(...dir).normalize()), [JSON.stringify(dir)])
  return <mesh geometry={geometry} material={material} position={at} quaternion={quaternion} receiveShadow />
}

/** The avatar's own hand; shown as soon as its picture is ready. */
function AvatarHand({ grip }: { grip: boolean }) {
  const character = useGame((s) => s.character)
  const [mesh, setMesh] = useState<HandMesh | null>(null)
  useEffect(() => {
    let current = true
    void handMesh(character, armOf(character), grip).then((m) => { if (current) setMesh(m) }).catch(() => {})
    return () => { current = false }
  }, [character, grip])
  return mesh && <mesh geometry={mesh.geometry} material={mesh.material} receiveShadow />
}

/** Closer to the camera than the tablet's arm, so smaller to look the same size on screen. */
const HELD_SCALE = 0.6
const HELD_ARM: V3 = [0.05, -0.93, 0.36]

/** Hand and forearm holding a tool, seen from behind: back of the hand, thumb towards the middle of the screen. */
function Glove({ side = 1 }: { side?: 1 | -1 }) {
  const character = useGame((s) => s.character)
  const spec = armOf(character)
  return <group scale={[side, 1, 1]} name="eva-glove">
    <group position={[0.006, -0.035, 0.04]} scale={HELD_SCALE}>
      <group rotation={[-0.38, 0, 0]} scale={[-HAND_SCALE, HAND_SCALE, HAND_SCALE]}><AvatarHand grip /></group>
      <Limb knots={spec.forearm.knots} material={stripMaterial(character, spec.forearm.strip, skinOf(character).suit, spec)} at={[0, 0, 0]} dir={HELD_ARM} />
    </group>
  </group>
}

function TabletModel() {
  const m = useMats()
  const character = useGame((s) => s.character)
  const look = skinOf(character)
  const spec = armOf(character)
  // Wrist at the tablet's right edge, elbow at its lower-left corner; the upper arm then leaves the screen quickly.
  const wrist = new THREE.Vector3(0.285, -0.035, -0.125)
  const toElbow = new THREE.Vector3(-0.535, -0.135, 0).normalize()
  const elbow = wrist.clone().addScaledVector(toElbow, FOREARM_LENGTH)
  const strap = new THREE.Quaternion().setFromUnitVectors(UP, toElbow)
  const screen = useMemo(() => {
    const map = textTexture(['SELENE-7  /  NAV', 'PLAN   JOURNAL   MESSAGES', 'TERMINAL • CONNECTED', 'INVENTORY / CREW SYSTEMS'],
      { w: 1024, h: 640, size: 44, bg: '#10142e', fg: '#9bb3ed', pad: 50 })
    return new THREE.MeshStandardMaterial({ map, emissiveMap: map, emissive: '#8eb7b9', emissiveIntensity: 0.45, roughness: 0.26, metalness: 0.05 })
  }, [])
  useEffect(() => () => { screen.map?.dispose(); screen.dispose() }, [screen])
  return <group name="left-wrist-tablet">
    <group name="left-forearm">
      <Limb knots={spec.forearm.knots} material={stripMaterial(character, spec.forearm.strip, look.suit, spec)} at={wrist.toArray()} dir={toElbow.toArray()} />
      <mesh position={elbow} material={stripMaterial(character, spec.elbow.strip, look.suit, spec)}><sphereGeometry args={[spec.elbow.radius * ARM_THICKNESS, 28, 20]} /></mesh>
      <Limb knots={spec.upper.knots} material={stripMaterial(character, spec.upper.strip, look.suit, spec)} at={elbow.toArray()} dir={[-0.05, -0.85, 0.52]} />
    </group>
    {/* Two straps hold the tablet on the forearm. */}
    {[0.1, 0.27].map((d) => {
      const at = wrist.clone().addScaledVector(toElbow, d)
      const radius = radiusAt(spec.forearm.knots, d) + 0.003
      return <group key={d}>
        <mesh position={at} quaternion={strap} material={m.rubber('#1d232b')}>
          <cylinderGeometry args={[radius, radius, 0.04, 32, 1, true]} />
        </mesh>
        <Box s={[0.044, 0.05, Math.max(0.02, -0.0105 - at.z)]} p={[at.x, at.y, (at.z - 0.0105) / 2]} m={m.rubber('#1d232b')} />
      </group>
    })}
    <Box s={[0.425, 0.285, 0.021]} m={m.metal('#474f51', 0.4)} />
    <Box s={[0.409, 0.269, 0.025]} m={m.rubber()} />
    <Box s={[0.365, 0.233, 0.003]} p={[0, 0, 0.013]} m={m.plastic('#111c20')} />
    <mesh position={[0, 0, 0.015]} material={screen}><planeGeometry args={[0.355, 0.223]} /></mesh>
    {[-1, 1].flatMap((x) => [-1, 1].map((y) => <Cyl key={`${x}:${y}`} a={[0.003, 0.003, 0.002]} p={[x * 0.199, y * 0.124, 0.014]} r={[Math.PI / 2, 0, 0]} m={m.metal('#979a92')} seg={12} />))}
    <Cyl a={[0.003, 0.003, 0.002]} p={[0.19, 0.105, 0.015]} r={[Math.PI / 2, 0, 0]} m={m.glow('#89bfb1', 0.6)} seg={12} />
    {/* Left hand as when looking at a watch: back of the hand towards the eye, thumb underneath. */}
    <group position={wrist} rotation={[0, 0, -Math.PI / 2]} scale={HAND_SCALE} name="eva-glove"><AvatarHand grip={false} /></group>
  </group>
}

export function Hands() {
  const g = useRef<THREE.Group>(null)
  const tablet = useRef<THREE.Group>(null)
  const held = useRef<THREE.Group>(null)
  const torch = useRef<THREE.Group>(null)
  const torchUp = useRef(0)
  const open = useGame((s) => s.tabletOpen)
  const item = useGame((s) => s.held)
  const lampOn = useGame((s) => s.lampOn)
  const k = useRef(0)
  const raise = useRef(0)
  useEffect(() => { preloadModels(['adjustable_wrench']) }, [])
  // Ready before the first time the arm is raised or a tool is taken.
  const character = useGame((s) => s.character)
  useEffect(() => { for (const grip of [false, true]) void handMesh(character, armOf(character), grip).catch(() => {}) }, [character])
  useEffect(() => { raise.current = 0 }, [item])
  // The beam starts in front of the hand: the hand and torch must not throw a shadow across it.
  useEffect(() => { torch.current?.traverse((o) => { o.castShadow = false }) })
  useFrame(({ camera, clock }, rawDt) => {
    if (!g.current) return
    const s = G()
    const dt = Math.min(rawDt, 0.05)
    g.current.position.copy(camera.position)
    g.current.quaternion.copy(camera.quaternion)
    const blocked = s.loading < 1 || !!s.cine || !!live.camOverride
    g.current.visible = !blocked
    if (blocked) k.current = 0
    else if (s.tabletOpen) k.current = Math.min(1, (performance.now() - s.tabletOpenedAt) / TABLET_RAISE_MS)
    else k.current = Math.max(0, k.current - dt * 3.5)
    const e = THREE.MathUtils.smootherstep(k.current, 0, 1)
    if (tablet.current) {
      tablet.current.visible = k.current > 0.01
      tablet.current.position.set(-0.43 + e * 0.39, -0.74 + e * 0.69, -0.48 - e * 0.12)
      tablet.current.rotation.set(-0.75 * (1 - e), -0.5 * (1 - e), 0.8 * (1 - e) + 0.035)
      tablet.current.userData.raiseProgress = k.current
    }
    if (!blocked && s.tabletOpen && !s.tabletReady && k.current === 1) useGame.setState({ tabletReady: true })
    if (torch.current) {
      // Out in the left hand while lit; the right hand stays free for tools.
      const twoHanded = item === 'carBattery' || item === 'manual' || item === 'map'
      const showTorch = s.lampOn && !open && k.current < 0.02 && !twoHanded
      torchUp.current = THREE.MathUtils.damp(torchUp.current, showTorch ? 1 : 0, 10, dt)
      torch.current.visible = torchUp.current > 0.02
      const motion = Math.min(live.speed / 2.5, 1)
      const sway = Math.sin(clock.elapsedTime * 1.3) * 0.003 + Math.sin(clock.elapsedTime * 7) * 0.004 * motion
      // Same pose as a tool in the right hand, mirrored.
      torch.current.position.set(-0.23, -0.2 + sway - (1 - torchUp.current) * 0.22, -0.43)
      torch.current.rotation.set((1 - torchUp.current) * 0.25, Math.sin(clock.elapsedTime * 1.1) * 0.009, sway * 1.4)
    }
    if (held.current) {
      raise.current = THREE.MathUtils.damp(raise.current, 1, 12, dt)
      const wide = item === 'carBattery' || item === 'manual' || item === 'map'
      const motion = Math.min(live.speed / 2.5, 1)
      const sway = Math.sin(clock.elapsedTime * 1.5) * 0.002 + Math.sin(clock.elapsedTime * 7) * 0.003 * motion
      held.current.visible = !!item && !open && k.current < 0.02
      held.current.position.set(wide ? 0.12 : 0.23, -0.20 + sway - (1 - raise.current) * 0.18, wide ? -0.47 : -0.43)
      held.current.rotation.set((1 - raise.current) * 0.25, Math.sin(clock.elapsedTime * 1.1) * 0.009, sway * 1.4)
    }
  })
  const right: V3 = item === 'carBattery' ? [0.115, 0.015, 0] : item === 'badge' ? [0.042, 0.008, 0]
    : item === 'manual' || item === 'map' ? [0.075, 0.03, 0] : [0, 0, 0]
  return <group ref={g} name="first-person-hands">
    <group ref={tablet} name="tablet-arm-animation" visible={false}><TabletModel /></group>
    <group ref={torch} visible={false} name="torch-hand">
      <Glove side={-1} />
      <group position={[0, -0.07, 0.012]}><Flashlight on={lampOn} /></group>
    </group>
    <group ref={held} visible={false} name="held-item">
      <group position={right}><Glove /></group>
      {(item === 'carBattery' || item === 'manual' || item === 'map') && <group position={[-right[0], right[1], 0]}><Glove side={-1} /></group>}
      {item && <HeldItem item={item} />}
    </group>
  </group>
}
