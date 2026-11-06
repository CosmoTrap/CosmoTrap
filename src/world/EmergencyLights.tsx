import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CEIL, TILE } from '../game/maps'
import { G, live } from '../game/state'
import type { GridMap, RoomDef } from '../game/types'
import { useMats } from './materials'
import { Cyl, Lathe } from './props/models'
import { beaconAngle, beaconsOn, lampPositions, mainsOut, stationPowerDown } from './roomPower'
import { localPoint, lunarMap, MODULES } from '../game/lunar/map'

/** Soft round glow, shared by every beacon's halo. */
let glowTex: THREE.Texture | null = null
function glowTexture() {
  if (glowTex) return glowTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.3, 'rgba(255,255,255,0.4)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 64, 64)
  return (glowTex = new THREE.CanvasTexture(c))
}

type BeaconDef = { room: RoomDef; pos: [number, number, number]; id: string }
function beaconsFor(room: RoomDef): BeaconDef[] {
  // Always halfway between two neighbouring ceiling lamps, spread evenly along the room.
  const lamps = lampPositions(room)
  const middle = (a: [number, number], b: [number, number]): [number, number] => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  // A round room's lamps form a ring: two opposite gaps, clear of the lift in the middle.
  const gaps = room.shape === 'round'
    ? [middle(lamps[0], lamps[1]), middle(lamps[2], lamps[3])]
    : lamps.slice(0, -1).map((a, i) => middle(a, lamps[i + 1]))
  const [x0, z0, x1, z1] = room.rect
  const n = room.shape === 'round' ? gaps.length : Math.min(gaps.length, Math.max(1, Math.ceil(Math.max(x1 - x0 + 1, z1 - z0 + 1) * TILE / 8)))
  return Array.from({ length: n }, (_, i) => {
    const [x, z] = gaps[Math.floor((i + 0.5) * gaps.length / n)]
    return { room, id: `${room.id}:${i}`, pos: [x, CEIL, z] }
  })
}
const angle = (room: RoomDef) => beaconAngle() + room.rect[0] * 0.7

/** How far each beam dips below the horizontal, in radians: a beacon's mirror throws it slightly downwards. */
const TILT = 0.5
const BEAM_LEN = 4.2
const BEAM_HALF = 0.34

/**
 * The visible shaft of light: an open cone, brightest at the lamp, fading along its length and towards its rim,
 * so it reads as light in the air rather than as a solid shape.
 */
let shaftGeo: THREE.ConeGeometry | null = null
function shaftGeometry() {
  if (shaftGeo) return shaftGeo
  const g = new THREE.ConeGeometry(Math.tan(BEAM_HALF) * BEAM_LEN, BEAM_LEN, 28, 12, true)
  // Apex on the lamp, opening along +z, then dipped down by TILT.
  g.translate(0, -BEAM_LEN / 2, 0)
  g.rotateX(-Math.PI / 2)
  g.rotateX(TILT)
  return (shaftGeo = g)
}
function shaftMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: { uOn: { value: 0 }, uColor: { value: new THREE.Color('#ff3a1c') } },
    vertexShader: `
      varying float vAlong; varying vec3 vN; varying vec3 vView;
      void main() {
        vAlong = uv.y; // 1 at the lamp, 0 at the far end
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        vN = normalize(normalMatrix * normal); vView = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform float uOn; uniform vec3 uColor;
      varying float vAlong; varying vec3 vN; varying vec3 vView;
      void main() {
        // Faces seen edge-on are the rim of the cone: let them vanish so the shaft has no outline.
        float core = pow(abs(dot(normalize(vN), normalize(vView))), 3.0);
        // Faint right at the lamp (no bright wedge on the dome), strongest a little way out, gone at the far end.
        float along = smoothstep(1.0, 0.82, vAlong) * pow(vAlong, 1.4);
        float a = uOn * core * along * 0.32;
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false,
  })
}

function Beacon({ room, pos, id }: BeaconDef) {
  const rotor = useRef<THREE.Group>(null)
  const m = useMats()
  const lens = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#76100c', roughness: 0.18,
    metalness: 0.15, clearcoat: 1, emissive: '#ff1806', emissiveIntensity: 0 }), [])
  lens.userData.backupCircuit = true
  const shaft = useMemo(shaftMaterial, [])
  const glow = useMemo(() => new THREE.SpriteMaterial({ map: glowTexture(), color: '#ff2a10', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }), [])
  const halo = useRef<THREE.Sprite>(null)
  useEffect(() => () => { lens.dispose(); glow.dispose(); shaft.dispose() }, [lens, glow, shaft])
  useFrame(({ camera }) => {
    const on = beaconsOn(room)
    const a = angle(room)
    // Out of alarm the beacon is simply switched off: no light and no turning.
    if (on && rotor.current) rotor.current.rotation.y = a
    // A steady glow while it turns: the light sweeps the room, the beacon itself never brightens and dims.
    void camera
    lens.emissiveIntensity = on ? 2.4 : 0
    shaft.uniforms.uOn.value = on ? 1 : 0
    glow.opacity = on ? 0.6 : 0
    halo.current?.scale.setScalar(0.75)
  })
  const metal = m.metal('#43494b')
  const guard = m.metal('#6d7377', 0.35)
  // Just under the ceiling: flush with it, both surfaces would fight for the same pixels.
  return <group position={[pos[0], pos[1] - 0.004, pos[2]]} name={`alert-beacon:${id}`}>
    {/* y = 0 is the ceiling: bolted flange, hanging neck, ribbed dome inside a wire guard. */}
    <Lathe m={metal} seg={32} profile={[[0, -0.07], [0.09, -0.07], [0.09, -0.05], [0.12, -0.022], [0.16, -0.012], [0.16, 0], [0, 0]]} />
    {[0, 1, 2, 3].map((i) => <Cyl key={i} a={[0.011, 0.011, 0.006]} p={[Math.sin(i * 1.57 + 0.78) * 0.135, -0.014, Math.cos(i * 1.57 + 0.78) * 0.135]} m={m.metal('#a2a19c', 0.25)} seg={8} />)}
    <Lathe m={m.glass('#c21f10', 0.42)} seg={32} profile={[[0, -0.262], [0.05, -0.255], [0.085, -0.23], [0.1, -0.19], [0.1, -0.1], [0.094, -0.07]]} />
    {[-0.115, -0.15, -0.185].map((y) => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.glass('#e04434', 0.5)}><torusGeometry args={[0.1, 0.0025, 4, 32]} /></mesh>)}
    <sprite ref={halo} material={glow} position={[0, -0.16, 0]} scale={0.3} />
    {/* The turning mirror, with its lamp in front. */}
    <group ref={rotor} name="alert-rotor" position={[0, -0.16, 0]}>
      {/* Two reflectors back to back: two beams, half a turn apart. */}
      {[0, Math.PI].map((r) => <mesh key={r} rotation={[0, Math.PI + r, 0]} material={m.metal('#d8dadc', 0.12)}><cylinderGeometry args={[0.07, 0.07, 0.13, 20, 1, true, -0.9, 1.8]} /></mesh>)}
      <mesh position={[0, 0, 0.02]} material={lens}><sphereGeometry args={[0.028, 14, 10]} /></mesh>
      <Cyl a={[0.012, 0.012, 0.18]} m={m.metal('#a2a19c', 0.25)} seg={8} />
      {/* The two visible beams, one per reflector, turning with it. */}
      {[0, Math.PI].map((r) => <mesh key={r} name="alert-shaft" rotation={[0, r, 0]} geometry={shaftGeometry()} material={shaft} renderOrder={5} frustumCulled={false} raycast={() => null} />)}
    </group>
    {/* Wire guard: two hoops and four ribs. */}
    {[-0.105, -0.2].map((y) => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={guard}><torusGeometry args={[0.112, 0.004, 6, 28]} /></mesh>)}
    {[0, 1].map((i) => <mesh key={i} position={[0, -0.16, 0]} rotation={[0, i * Math.PI / 2, 0]} material={guard}><torusGeometry args={[0.112, 0.004, 6, 28, Math.PI]} /></mesh>)}
  </group>
}

/**
 * With the ceiling lights out, nothing should brighten the rooms but the portholes and the beacons.
 * The reflections baked into every surface are the last ambient light: they fade down with the power.
 */
function Darkness() {
  const scene = useThree((state) => state.scene)
  useFrame((_, dt) => {
    const out = mainsOut()
    scene.environmentIntensity = stationPowerDown() ? 0 : THREE.MathUtils.damp(scene.environmentIntensity, out ? 0.26 : 1, 4, Math.min(dt, 0.1))
  })
  useEffect(() => () => { scene.environmentIntensity = 1 }, [scene])
  return null
}

/** Two nearby revolving beams, a fixed light count even when the power changes. */
export function EmergencyLights({ map }: { map: GridMap }) {
  const beacons = useMemo(() => map === lunarMap ? [
    ...beaconsFor(map.rooms[0]),
    ...MODULES.flatMap(m => [-3, 3].map((x, i) => ({ room: map.rooms.find(r => r.id === m.id)!, id: `${m.id}:${i}`, pos: localPoint(m.id, x, CEIL, 0) }))),
  ] : map.rooms.filter((r) => !r.noDynLight || r.beacons).flatMap(beaconsFor), [map])
  const beams = useMemo(() => Array.from({ length: 2 }, (_, i) => {
    // A narrower beam with a very soft edge: a rotating beacon throws a glow that sweeps, not a hard-edged disc.
    const light = map === lunarMap ? new THREE.SpotLight('#ff1408', 0, 25, 0.62, 0.8, 1.25) : new THREE.SpotLight('#ff4a30', 0, 16, 0.95, 1, 1)
    light.name = `alert-beam:${i}`
    // The door leaves must occlude the rotating beam, including on lower presets.
    light.castShadow = map !== lunarMap
    light.shadow.autoUpdate = false
    // Fine enough, and blurred, that its shadows are soft rather than jagged.
    light.shadow.mapSize.set(512, 512)
    light.shadow.radius = 4
    light.shadow.bias = -0.0002
    light.shadow.normalBias = 0.015
    light.shadow.camera.near = 0.1
    const spill = new THREE.PointLight('#ff1808', 0, 13, 1.1)
    spill.distance = map === lunarMap ? 13 : 2.5 // Local glow around the station lens, never a second beam through a door.
    return { light, spill, target: new THREE.Object3D() }
  }), [map])
  useEffect(() => {
    beams.forEach(({ light, target }) => { light.target = target })
    return () => beams.forEach(({ light, spill }) => { light.dispose(); spill.dispose() })
  }, [beams])
  useFrame(() => {
    const distance = (b: BeaconDef) => Math.hypot(b.pos[0] - live.pos[0], b.pos[2] - live.pos[2]) + (b.room.id === live.roomId ? 0 : 30)
    // These lights cast no shadows, so a beam from next door would shine straight through the wall.
    const active = beacons.filter(({ room }) => beaconsOn(room, map.zone) && (room.id === live.roomId || !live.roomId)).sort((a, b) => distance(a) - distance(b))
    const station = map !== lunarMap
    beams.forEach(({ light, spill, target }, i) => {
      // On the station, both beams come from the nearest beacon: its two reflectors, half a turn apart.
      const entry = station ? active[0] : active[i]
      // Warm maps under the loader, then render them only while the beacon is lit.
      light.shadow.needsUpdate = light.castShadow && (!!entry || G().loading < 1)
      light.intensity = entry ? (station ? 14 : 48) : 0
      if (!entry) { spill.intensity = 0; return }
      const { room, pos } = entry
      const a = angle(room) + (station ? i * Math.PI : 0)
      light.position.set(...pos)
      spill.position.set(...pos)
      spill.intensity = station ? 1.4 : 2.6
      // Along the visible shaft, so the patch on the wall or floor is where the beam lands.
      const tilt = station ? TILT : 0.2
      // From just under the neighbouring ceiling lamps: from the dome itself, their discs threw big dark arcs on the walls.
      const drop = station ? 0.75 : 0.16
      target.position.set(pos[0] + Math.sin(a) * Math.cos(tilt) * 6, pos[1] - drop - Math.sin(tilt) * 6, pos[2] + Math.cos(a) * Math.cos(tilt) * 6)
      light.position.set(pos[0], pos[1] - drop, pos[2])
      target.updateMatrixWorld()
      light.distance = 18
    })
  })
  return <group>
    <Darkness />
    {beacons.map((beacon) => <Beacon key={beacon.id} {...beacon} />)}
    {beams.map(({ light, spill, target }, i) => <group key={i}><primitive object={light} /><primitive object={spill} /><primitive object={target} /></group>)}
  </group>
}
