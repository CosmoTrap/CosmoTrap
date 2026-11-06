import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { GRID_MAPS } from '../../game/maps'
import { G } from '../../game/state'
import { ENGINES, HERMES, HermesModel } from './Hermes'
import { GRID_MAPS as MAPS } from '../../game/maps'
import { FLOOR_GAP, HERMES as DOCKED, Station } from '../Exterior/Station'
import { Meteors, type Strike } from './Meteors'

// Departure, seen from outside, in the order real crews follow: the latches open, small thrusters push the
// Hermès gently away from the station, it turns round, then the main engines light and it heads for Earth,
// until the atmosphere wraps it in plasma. The interior countdown comes first (see the director).

const sm = THREE.MathUtils.smoothstep
const ease = (k: number) => k * k * (3 - 2 * k)

/** When each phase starts, in seconds from the launch. */
export const LAUNCH = { outside: 3.6, turn: 9, ignition: 13, burn: 14, reentry: 22.4, land: 25.3 }

/** Centre of the zone 3 sky, as the exterior uses it. */
function skyCentre() {
  const m = GRID_MAPS[3]
  return new THREE.Vector3(Math.max(...m.grid.map((r) => r.length)), 0, m.grid.length)
}
/** Where the Hermès sits while docked: high above the Moon, well away from the rocket's interior. */
export const stationAt = () => skyCentre().add(new THREE.Vector3(0, 400, 700))
/**
 * The real station, turned a quarter so that its docking bay faces -z: the Hermès, moored along the
 * station's x axis, then has its nose towards +z, as the stage's rocket model is built.
 */
const STATION_TURN = -Math.PI / 2
const stationOrigin = () => stationAt().sub(new THREE.Vector3(DOCKED.x, DOCKED.y, DOCKED.z).applyAxisAngle(new THREE.Vector3(0, 1, 0), STATION_TURN))
/** The Earth, exactly where the zone 3 sky draws it. */
const earthAt = () => skyCentre().add(new THREE.Vector3(120, 110, -2400))
const EARTH_R = 240

/** The station's centre, in its own coordinates (floor 2's): the lift's axis, between the two floors. */
const hubOf = (m: (typeof GRID_MAPS)[1]) => {
  const [x0, z0, x1, z1] = m.rooms.find((r) => r.id === 'couloir')!.rect
  return new THREE.Vector3(x0 + x1 + 1, 0, z0 + z1 + 1)
}
const STATION_CENTRE = hubOf(GRID_MAPS[2]).setY(FLOOR_GAP / 2)
const stationCentreWorld = () => STATION_CENTRE.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), STATION_TURN).add(stationOrigin())

/**
 * The meteor shower catching up with the station as the Hermès gets away: strikes on the modules of both floors,
 * one after another, then a last one in the middle, on the hub. In the station's own coordinates.
 */
export const DESTRUCTION = { first: 15.2, last: 20.4 }
const STRIKES: Strike[] = (() => {
  const room = (m: (typeof GRID_MAPS)[1], id: string, upper: boolean) => {
    const [x0, z0, x1, z1] = m.rooms.find((r) => r.id === id)!.rect
    // Floor 1 sits on the same lift axis, FLOOR_GAP higher: its own coordinates are shifted onto floor 2's.
    const shift = upper ? hubOf(GRID_MAPS[2]).sub(hubOf(GRID_MAPS[1])).setY(FLOOR_GAP) : new THREE.Vector3()
    return new THREE.Vector3(x0 + x1 + 1, 3.6, z0 + z1 + 1).add(shift)
  }
  const targets: [THREE.Vector3, number][] = [
    [room(GRID_MAPS[1], 'refectoire', true), 3.2], [room(GRID_MAPS[2], 'machinerie', false), 3.6],
    [room(GRID_MAPS[1], 'infirmerie', true), 2.8], [room(GRID_MAPS[2], 'labo', false), 3],
    [room(GRID_MAPS[1], 'dortoir', true), 3], [room(GRID_MAPS[2], 'disjoncteur', false), 2.8],
    [room(GRID_MAPS[1], 'sas', true), 3.4], [room(GRID_MAPS[2], 'serre', false), 3],
    [STATION_CENTRE.clone().setY(FLOOR_GAP + 2), 8],
  ]
  return targets.map(([to, size], i) => {
    const at = i === targets.length - 1 ? DESTRUCTION.last : DESTRUCTION.first + i * 0.6
    // From high up and to one side, each from a slightly different angle.
    const from = to.clone().add(new THREE.Vector3(70 + (i % 3) * 25, 150, -40 + (i % 4) * 30))
    return { from, to, at, size }
  })
})()

export interface RocketPose { pos: THREE.Vector3; quat: THREE.Quaternion; engine: number; plasma: number; heading: THREE.Vector3 }

export function rocketPose(t: number): RocketPose {
  const docked = stationAt()
  const heading = earthAt().sub(docked).normalize()
  const quat = new THREE.Quaternion()
  const pos = docked.clone()
  // Backing well clear first (the Hermès is 18 m long: its nose and tail sweep 10 m round when it turns),
  // then still drifting away while it turns round, so it never comes near the station's modules.
  const back = 16 * ease(sm(t, LAUNCH.outside, LAUNCH.turn + 0.6)) + 14 * sm(t, LAUNCH.turn, LAUNCH.ignition)
  pos.z -= back
  const turn = ease(sm(t, LAUNCH.turn + 0.6, LAUNCH.ignition - 0.2))
  // A turn about the vertical, back kept up: a roll would leave it flying belly up.
  const side = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), heading).normalize()
  const up = new THREE.Vector3().crossVectors(heading, side)
  const towardsEarth = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(side, up, heading))
  quat.slerpQuaternions(new THREE.Quaternion(), towardsEarth, turn)
  // The burn: a firm push at first, then the journey compressed into a few seconds, stopping above the clouds.
  const b = Math.max(0, t - LAUNCH.burn)
  const near = 0.5 * 22 * Math.min(b, 6) ** 2
  const far = earthAt().distanceTo(docked) - EARTH_R - 60
  const s = b <= 6 ? near : near + (far - near) * Math.pow(sm(t, LAUNCH.burn + 6, LAUNCH.land - 0.4), 2.4)
  pos.addScaledVector(heading, s)
  const engine = sm(t, LAUNCH.ignition, LAUNCH.burn) * (1 - sm(t, LAUNCH.reentry, LAUNCH.reentry + 0.8))
  const plasma = sm(t, LAUNCH.reentry, LAUNCH.reentry + 1.6)
  return { pos, quat, engine, plasma, heading }
}

/** The camera for the outside shots: alongside at the undocking, wide for the turn, then chasing the rocket. */
export function launchCamera(t: number): { pos: [number, number, number]; look: [number, number, number]; fov: number } {
  const D = stationAt()
  const r = rocketPose(t)
  const v = (x: number, y: number, z: number) => D.clone().add(new THREE.Vector3(x, y, z))
  let pos: THREE.Vector3
  let fov = 42
  if (t < LAUNCH.turn) pos = v(18, 4, -12).lerp(v(17, 6, -20), sm(t, LAUNCH.outside, LAUNCH.turn))
  else if (t < LAUNCH.burn + 1) pos = v(-30, 14, -46).lerp(v(-26, 11, -50), sm(t, LAUNCH.turn, LAUNCH.burn + 1))
  else if (t >= LAUNCH.burn + 1.5 && t < DESTRUCTION.last + 1.6) {
    // A fixed shot by the station as the meteor shower tears into it, the Hermès's flame leaving behind it.
    const side = new THREE.Vector3().crossVectors(r.heading, new THREE.Vector3(0, 1, 0)).normalize()
    const c = stationCentreWorld()
    const k = (t - LAUNCH.burn - 1.5) / (DESTRUCTION.last + 1.6 - LAUNCH.burn - 1.5)
    pos = c.clone().addScaledVector(side, 78 + k * 10).addScaledVector(r.heading, -38).add(new THREE.Vector3(0, 30 + k * 6, 0))
    return { pos: pos.toArray() as [number, number, number], look: c.toArray() as [number, number, number], fov: 52 }
  } else {
    const side = new THREE.Vector3().crossVectors(r.heading, new THREE.Vector3(0, 1, 0)).normalize()
    const k = sm(t, LAUNCH.burn + 1, LAUNCH.burn + 5)
    pos = r.pos.clone().addScaledVector(r.heading, -(10 + 12 * k)).addScaledVector(side, 6 - 2 * k).add(new THREE.Vector3(0, 3 + k, 0))
    fov = 48 + 8 * sm(t, LAUNCH.reentry - 2, LAUNCH.land)
  }
  const look = t >= LAUNCH.burn + 1 ? r.pos.clone().addScaledVector(r.heading, 25) : r.pos.clone()
  return { pos: pos.toArray() as [number, number, number], look: look.toArray() as [number, number, number], fov }
}

function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

/** Brightest at the nozzle, fading out along the plume. */
function plumeTexture() {
  const c = document.createElement('canvas')
  c.width = 8
  c.height = 128
  const x = c.getContext('2d')!
  const g = x.createLinearGradient(0, 0, 0, 128)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(0.75, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,1)')
  x.fillStyle = g
  x.fillRect(0, 0, 8, 128)
  return new THREE.CanvasTexture(c)
}

const PUFFS = 48

/** Seconds since the launch began, or -1 outside it. */
const launchTime = () => (G().cine === 'launch' ? (performance.now() - G().cineT0) / 1000 : -1)

export function LaunchStage() {
  const stage = useRef<THREE.Group>(null)
  const rocket = useRef<THREE.Group>(null)
  const plumes = useRef<THREE.Group>(null)
  const plasma = useRef<THREE.Group>(null)
  const fx = useMemo(() => {
    const glow = glowTexture()
    const additive = { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }
    return {
      glow,
      plumeTex: plumeTexture(),
      plume: new THREE.MeshBasicMaterial({ ...additive, map: plumeTexture(), color: new THREE.Color(1, 0.86, 0.66), side: THREE.DoubleSide }),
      core: new THREE.SpriteMaterial({ ...additive, map: glow, color: new THREE.Color(1, 0.9, 0.72) }),
      plasma: new THREE.SpriteMaterial({ ...additive, map: glow, color: new THREE.Color(1, 0.5, 0.18) }),
      trail: new THREE.MeshBasicMaterial({ ...additive, map: plumeTexture(), color: new THREE.Color(1, 0.45, 0.12), side: THREE.DoubleSide }),
      puffs: Array.from({ length: PUFFS }, () => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow, color: '#e8edf2', transparent: true, depthWrite: false, opacity: 0 }))
        s.userData = { life: 9, v: new THREE.Vector3() }
        return s
      }),
    }
  }, [])
  useEffect(() => () => {
    fx.glow.dispose(); fx.plumeTex.dispose(); fx.plume.map?.dispose(); fx.plume.dispose(); fx.core.dispose(); fx.plasma.dispose(); fx.trail.map?.dispose(); fx.trail.dispose()
    fx.puffs.forEach((p) => (p.material as THREE.SpriteMaterial).dispose())
  }, [fx])
  const next = useRef(0)
  const station = useRef<THREE.Group>(null)
  const last = useRef(0)
  useFrame((_, rawDt) => {
    const s = G()
    const t = s.cine === 'launch' ? (performance.now() - s.cineT0) / 1000 : -1
    const on = t >= LAUNCH.outside - 0.2 && t < LAUNCH.land
    if (stage.current) stage.current.visible = on
    if (!on || !rocket.current) return
    const dt = Math.min(rawDt, 0.05)
    if (station.current) {
      // Each strike jolts it; after the last, the wrecked station tumbles slowly away.
      const hit = STRIKES.reduce((a, s) => a + Math.max(0, 1 - Math.abs(t - s.at) * 3) * s.size * 0.012, 0)
      const wreck = sm(t, DESTRUCTION.first, LAUNCH.land) * 0.35
      station.current.rotation.set(wreck * 0.6 + (Math.random() - 0.5) * hit, STATION_TURN + wreck * 0.4, wreck + (Math.random() - 0.5) * hit)
    }
    const r = rocketPose(t)
    rocket.current.position.copy(r.pos)
    rocket.current.quaternion.copy(r.quat)
    // Main engines: a tight, slightly flickering plume, longer as the thrust builds.
    if (plumes.current) {
      plumes.current.visible = r.engine > 0.01
      const flicker = 0.92 + Math.random() * 0.12
      plumes.current.scale.set(1, 1, (0.4 + r.engine * 1.6) * flicker)
      fx.plume.opacity = r.engine
      fx.core.opacity = r.engine
    }
    if (plasma.current) {
      // A hot glow on the nose and a trail of ionised air streaming back past the hull.
      plasma.current.visible = r.plasma > 0.01
      fx.plasma.opacity = r.plasma * (0.75 + Math.random() * 0.25)
      fx.trail.opacity = r.plasma * (0.55 + Math.random() * 0.2)
      plasma.current.scale.set(1, 1, 0.8 + r.plasma * 0.6)
    }
    // Thruster puffs: forward ones push it away from the station, side ones turn it round.
    const pushing = t > LAUNCH.outside && t < LAUNCH.outside + 2.6
    const turning = t > LAUNCH.turn + 0.2 && t < LAUNCH.ignition - 0.4
    if ((pushing || turning) && t - last.current > 0.07) {
      last.current = t
      const emit = (local: THREE.Vector3, dir: THREE.Vector3) => {
        const p = fx.puffs[next.current++ % PUFFS]
        p.position.copy(local).applyQuaternion(r.quat).add(r.pos)
        p.userData.v.copy(dir).applyQuaternion(r.quat).multiplyScalar(3 + Math.random() * 1.5)
        p.userData.life = 0
      }
      if (pushing) for (const x of [-0.5, 0.5]) emit(new THREE.Vector3(x, 0.3, HERMES.nose - 1.6), new THREE.Vector3(x * 0.4, 0.2, 1))
      if (turning) {
        const side = Math.sin(t * 9) > 0 ? 1 : -1
        emit(new THREE.Vector3(side * HERMES.radius, 0, HERMES.nose - 3), new THREE.Vector3(side, 0, 0))
        emit(new THREE.Vector3(-side * HERMES.radius, 0, HERMES.tail + 1.2), new THREE.Vector3(-side, 0, 0))
      }
    }
    for (const p of fx.puffs) {
      const u = p.userData
      u.life += dt
      const m = p.material as THREE.SpriteMaterial
      if (u.life > 0.9) { m.opacity = 0; continue }
      p.position.addScaledVector(u.v, dt)
      const k = u.life / 0.9
      p.scale.setScalar(0.3 + k * 1.6)
      m.opacity = 0.75 * (1 - k)
    }
  })
  const origin = stationOrigin()
  return (
    <group ref={stage} visible={false} name="launch-stage">
      <group position={origin}>
        {/* Turned about its own centre when it tumbles, not about the docking bay. */}
        <group position={STATION_CENTRE.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), STATION_TURN)}>
          <group ref={station} rotation={[0, STATION_TURN, 0]}>
            <group position={STATION_CENTRE.clone().negate()}>
              <Station map={MAPS[2]} full rocket={false} />
              <Meteors strikes={STRIKES} time={launchTime} />
            </group>
          </group>
        </group>
      </group>
      <group ref={rocket}>
        <HermesModel glow={1} />
        <group ref={plumes} position={[0, 0, HERMES.tail - 1.5]}>
          {ENGINES.map(([x, y], i) => (
            <group key={i} position={[x, y, 0]}>
              <mesh position={[0, 0, -4]} rotation={[-Math.PI / 2, 0, 0]} material={fx.plume}>
                <cylinderGeometry args={[0.25, 0.62, 8, 20, 1, true]} />
              </mesh>
              <sprite material={fx.core} scale={[2.6, 2.6, 1]} position={[0, 0, -0.3]} />
            </group>
          ))}
        </group>
        <group ref={plasma} position={[0, -0.6, HERMES.nose - 0.5]}>
          <sprite material={fx.plasma} scale={[7, 7, 1]} />
          <mesh position={[0, 0, -4]} rotation={[Math.PI / 2, 0, 0]} material={fx.trail}>
            <cylinderGeometry args={[2.3, 2.9, 8, 24, 1, true]} />
          </mesh>
        </group>
      </group>
      {fx.puffs.map((p, i) => <primitive key={i} object={p} />)}
    </group>
  )
}
