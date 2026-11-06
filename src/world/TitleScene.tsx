import { useFrame } from '@react-three/fiber'
import { speechSeconds } from '../game/audio/audio'
import { fr } from '../i18n/fr'
import { live, useGame } from '../game/state'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Earth } from './Exterior/Earth'
import { Moon } from './Exterior/Moon'
import { MilkyWay, Stars, Sun } from './Exterior/Space'
import { paintedMetal, drawTexture } from './textures'
import { Station as RealStation } from './Exterior/Station'
import { Meteors } from './cine/Meteors'
import { GRID_MAPS } from '../game/maps'

/** The station is about 80 m across: scaled down to fit the title's and the prologue's camera paths. */
const TITLE_SCALE = 0.55

// Écran titre : la caméra tourne lentement autour de la station Selene-7, la Lune en fond.

function SolarPanel({ p, r }: { p: [number, number, number]; r: number }) {
  const mat = useMemo(() => {
    const t = drawTexture(512, 256, (c) => {
      c.fillStyle = '#0b1a3a'
      c.fillRect(0, 0, 512, 256)
      for (let x = 0; x < 512; x += 32)
        for (let y = 0; y < 256; y += 32) {
          const g = c.createLinearGradient(x, y, x + 32, y + 32)
          g.addColorStop(0, '#1d3b7a')
          g.addColorStop(1, '#0a1835')
          c.fillStyle = g
          c.fillRect(x + 1, y + 1, 30, 30)
        }
      c.strokeStyle = '#c9b06a'
      c.lineWidth = 2
      c.strokeRect(1, 1, 510, 254)
    })
    return new THREE.MeshStandardMaterial({ map: t, metalness: 0.6, roughness: 0.25, side: THREE.DoubleSide })
  }, [])
  return (
    <group position={p} rotation={[0, r, 0]}>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[0, 0, s * 7]} material={mat}>
          <boxGeometry args={[4, 0.05, 12]} />
        </mesh>
      ))}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 26, 8]} />
        <meshStandardMaterial color="#9aa0a6" metalness={1} roughness={0.3} />
      </mesh>
    </group>
  )
}

export function Station() {
  const hull = useMemo(() => {
    const s = paintedMetal('#d9d6cf', 512, 0.5, 3)
    return new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, roughnessMap: s.roughnessMap, metalness: 0.4, roughness: 0.9 })
  }, [])
  const gold = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c9a043', metalness: 1, roughness: 0.35 }), [])
  const truss = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8d9196', metalness: 0.9, roughness: 0.4 }), [])
  const win = useMemo(() => new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffcf8a', emissiveIntensity: 5 }), [])
  return (
    <group>
      {/* poutre principale */}
      <mesh rotation={[0, 0, Math.PI / 2]} material={truss}>
        <boxGeometry args={[0.8, 46, 0.8]} />
      </mesh>
      {/* modules habitables */}
      {[
        [0, 0, 0, 9],
        [0, 0, 6, 7],
        [0, 0, -6, 7],
        [8, 0, 0, 6],
      ].map(([x, y, z, l], i) => (
        <group key={i} position={[x, y, z]} rotation={[i === 3 ? 0 : Math.PI / 2, 0, i === 3 ? Math.PI / 2 : 0]}>
          <mesh material={hull} castShadow receiveShadow>
            <cylinderGeometry args={[2.1, 2.1, l, 32]} />
          </mesh>
          {[-1, 1].map((e) => (
            <mesh key={e} position={[0, (e * l) / 2, 0]} rotation={[e < 0 ? Math.PI : 0, 0, 0]} scale={[1, 0.45, 1]} material={hull}>
              <sphereGeometry args={[2.1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
            </mesh>
          ))}
          {Array.from({ length: Math.floor(l / 2) }).map((_, k) => (
            <mesh key={k} position={[2.08, -l / 2 + 1 + k * 2, 0]} rotation={[0, Math.PI / 2, 0]} material={win}>
              <circleGeometry args={[0.22, 16]} />
            </mesh>
          ))}
          <mesh material={gold} position={[0, 0, 0]}>
            <cylinderGeometry args={[2.13, 2.13, 0.3, 32, 1, true]} />
          </mesh>
        </group>
      ))}
      <SolarPanel p={[-20, 0, 0]} r={0} />
      <SolarPanel p={[20, 0, 0]} r={0} />
      {/* radiateurs */}
      {[-10, 10].map((x) => (
        <mesh key={x} position={[x, 3, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[3, 6, 0.06]} />
          <meshStandardMaterial color="#e8e6e0" roughness={0.6} />
        </mesh>
      ))}
      {/* fusée Hermès amarrée */}
      <group position={[0, 0, -14]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh material={hull}>
          <cylinderGeometry args={[1.6, 1.8, 9, 32]} />
        </mesh>
        <mesh position={[0, -6, 0]} material={hull}>
          <coneGeometry args={[1.6, 3, 32]} />
        </mesh>
        <mesh position={[0, 5.2, 0]} material={truss}>
          <cylinderGeometry args={[1.0, 1.6, 1.4, 24]} />
        </mesh>
      </group>
      {/* feux de position */}
      <mesh position={[-23, 0, 0]}>
        <sphereGeometry args={[0.15, 8, 6]} />
        <meshBasicMaterial color={new THREE.Color(8, 0.5, 0.3)} />
      </mesh>
      <mesh position={[23, 0, 0]}>
        <sphereGeometry args={[0.15, 8, 6]} />
        <meshBasicMaterial color={new THREE.Color(0.3, 8, 1)} />
      </mesh>
      {/* brèche : micro-météorite */}
      <mesh position={[0, -2.05, 2]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.35, 12]} />
        <meshBasicMaterial color="#050505" />
      </mesh>
    </group>
  )
}

/** temps de départ du prologue (fixé par l'écran Prologue) */
export const prologue = { t0: 0 }
/** The impact comes once the prologue's lines have all been said. */
/** Seconds into the prologue, or -1 outside it. */
const prologueTime = () => (useGame.getState().screen === 'prologue' ? (performance.now() - prologue.t0) / 1000 : -1)

export const IMPACT_T = 0.6 + fr.story.prologue.reduce((a, l) => a + speechSeconds(l) + 0.35, 0) + 0.6

/**
 * The micrometeorite: out of the dark above, into the hub on top of the station (which stays put as the
 * station slowly turns), in full view of the prologue's camera at the impact.
 */
const IMPACT_POINT = new THREE.Vector3(-2.5, 3.2, 0)
const PROLOGUE_STRIKE = [{ from: IMPACT_POINT.clone().add(new THREE.Vector3(18, 34, 52)), to: IMPACT_POINT, at: IMPACT_T, size: 1.6, flight: 2.4 }]

export function TitleScene() {
  const sun = useMemo(() => new THREE.Vector3(0.8, 0.18, -0.55).normalize(), [])
  const station = useRef<THREE.Group>(null)
  const screen = useGame((s) => s.screen)
  useFrame(({ camera, clock }) => {
    if (station.current) station.current.rotation.y = clock.elapsedTime * 0.01
    if (screen === 'prologue') {
      const t = (performance.now() - prologue.t0) / 1000
      // lent travelling vers la station, puis impact
      const a = 2.2 + t * 0.035
      const d = 70 - (Math.min(t, IMPACT_T) / IMPACT_T) * 39
      const shake = t > IMPACT_T ? Math.max(0, 1 - (t - IMPACT_T) / 3) * 0.8 : 0
      camera.position.set(Math.cos(a) * d + (Math.random() - 0.5) * shake, 6 + t * 0.15 + (Math.random() - 0.5) * shake, Math.sin(a) * d)
      camera.lookAt(0, -1, 0)
      live.flash = t > IMPACT_T && t < IMPACT_T + 1.5 ? Math.max(0, 1 - (t - IMPACT_T) / 1.5) : 0
      return
    }
    const t = clock.elapsedTime * 0.06
    camera.position.set(Math.cos(t) * 52, 10 + Math.sin(t * 0.7) * 4, Math.sin(t) * 52)
    camera.lookAt(0, -4, 0)
  })
  return (
    <>
      <MilkyWay />
      <Stars count={7000} />
      <Sun dir={sun} />
      <directionalLight position={sun.clone().multiplyScalar(100)} intensity={5} color="#fff3e2" />
      <hemisphereLight args={['#334466', '#111111', 0.15]} />
      {/* lumière renvoyée par la Lune */}
      <directionalLight position={[0, -100, 20]} intensity={1.1} color="#c9c4ba" />
      <group ref={station}>
        {/* The real station, both floors, scaled to the old framing and centred on the lift. */}
        <group scale={TITLE_SCALE} position={[-43 * TITLE_SCALE, -1, -37 * TITLE_SCALE]}>
          <RealStation map={GRID_MAPS[2]} full />
        </group>
        <Meteors strikes={PROLOGUE_STRIKE} time={prologueTime} />
      </group>
      <Moon radius={1500} position={[0, -1560, 0]} sun={sun} detail={3} />
      <Earth radius={80} position={[-1800, 300, -2600]} sun={sun} />
    </>
  )
}
