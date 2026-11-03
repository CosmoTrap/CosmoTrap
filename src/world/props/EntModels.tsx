import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { audio } from '../../game/audio/audio'
import { fr } from '../../i18n/fr'
import { GRID_MAPS, placeOf, roomAt } from '../../game/maps'
import { allEnts, entActive } from '../../game/logic'
import { ITEM_KIND } from '../../game/items'
import { live, useGame } from '../../game/state'
import type { Ent, ZoneId } from '../../game/types'
import { Astronaut } from '../Astronaut'
import { RoomCtx, useMats } from '../materials'
import { textTexture } from '../textures'
import { Box, Cyl, DockHatch, Screen } from './models'
import { ZONE4_ENT_MODELS } from '../zone4/Zone4Ents'
import { SolidProp } from './SolidProps'

// Objets interactifs + zones de détection invisibles (raycast).

export const hitboxes = new Set<THREE.Object3D>()

function Hitbox({ e }: { e: Ent }) {
  const ref = useRef<THREE.Mesh>(null)
  const size = e.hit ?? (e.item ? [0.6, 0.55, 0.6] : [0.7, 0.7, 0.5])
  useEffect(() => {
    const m = ref.current!
    m.userData.entId = e.id
    hitboxes.add(m)
    return () => {
      hitboxes.delete(m)
    }
  }, [e.id])
  const yOff = e.y === undefined ? size[1] / 2 : 0
  return (
    <mesh ref={ref} position={[0, yOff, e.wall ? size[2] / 2 : 0]} visible={false}>
      <boxGeometry args={size as [number, number, number]} />
      <meshBasicMaterial />
    </mesh>
  )
}

/** petit reflet pulsé pour repérer les objets à ramasser */
// petite étincelle douce (texture ronde, plus de carré visible)
let sparkTex: THREE.Texture | null = null
function sparkTexture() {
  if (sparkTex) return sparkTex
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const g = c.getContext('2d')!
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32)
  r.addColorStop(0, 'rgba(255,255,255,1)')
  r.addColorStop(0.15, 'rgba(255,255,255,0.6)')
  r.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = r
  g.fillRect(0, 0, 64, 64)
  g.fillStyle = 'rgba(255,255,255,0.7)'
  g.fillRect(31, 4, 2, 56)
  g.fillRect(4, 31, 56, 2)
  sparkTex = new THREE.CanvasTexture(c)
  return sparkTex
}

function Glint({ resource }: { resource: boolean }) {
  const mat = useMemo(
    () => new THREE.SpriteMaterial({ map: sparkTexture(), color: resource ? '#7dffb0' : '#fff1d6', transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
    [resource],
  )
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    // les ressources gardent une lueur phosphorescente visible dans le noir
    mat.opacity = (resource ? 0.35 : 0.05) + Math.pow(Math.max(0, Math.sin(t * 2.2)), 8) * 0.9
  })
  return <sprite position={[0, 0.14, 0.05]} scale={resource ? 0.14 : 0.1} material={mat} />
}

function Bracket() {
  const m = useMats()
  return (
    <group>
      <Box s={[0.42, 0.025, 0.26]} p={[0, -0.012, 0.13]} m={m.painted('#6f747a', 0.4, 0.5)} />
      <Box s={[0.02, 0.12, 0.2]} p={[-0.18, -0.07, 0.1]} m={m.metal('#55595e')} />
      <Box s={[0.02, 0.12, 0.2]} p={[0.18, -0.07, 0.1]} m={m.metal('#55595e')} />
    </group>
  )
}

// ——— objets ramassables ———
function O2Bottle() {
  const m = useMats()
  return (
    <group position={[0, 0, 0.12]} rotation={[0.08, 0, 0.04]}>
      <Cyl a={[0.085, 0.085, 0.5]} p={[0, 0.27, 0]} m={m.painted('#e8e6e0', 0.3, 0.4)} />
      <mesh position={[0, 0.52, 0]} material={m.painted('#2f8a4a', 0.3, 0.4)}>
        <sphereGeometry args={[0.085, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <Cyl a={[0.02, 0.025, 0.08]} p={[0, 0.62, 0]} m={m.metal('#c0c4c8', 0.25)} />
      <Cyl a={[0.035, 0.035, 0.02]} p={[0, 0.66, 0]} r={[0, 0, Math.PI / 2]} m={m.painted('#2a2c30', 0.5)} />
      <mesh position={[0, 0.3, 0.083]} material={useMemo(() => new THREE.MeshStandardMaterial({ map: textTexture(['O₂', 'MED'], { w: 128, h: 128, bg: '#e8e6e0', fg: '#1f6b37', size: 34, align: 'center', pad: 20 }), roughness: 0.4 }), [])}>
        <planeGeometry args={[0.1, 0.1]} />
      </mesh>
    </group>
  )
}

function Batteries() {
  const m = useMats()
  return (
    <group position={[0, 0.03, 0.12]}>
      <Box s={[0.16, 0.012, 0.11]} p={[0, -0.02, 0]} m={m.plastic('#1d2a6b', 0.4)} />
      {[0, 1, 2, 3].map((i) => (
        <group key={i} position={[-0.054 + i * 0.036, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <Cyl a={[0.016, 0.016, 0.1]} m={m.metal('#cf7a2a', 0.35)} seg={12} />
          <Cyl a={[0.0165, 0.0165, 0.035]} p={[0, -0.034, 0]} m={m.metal('#222', 0.35)} seg={12} />
        </group>
      ))}
    </group>
  )
}

function WaterPouch() {
  const m = useMats()
  return (
    <group position={[0, 0.1, 0.1]}>
      <mesh scale={[1, 1.4, 0.38]} material={m.glass('#7fc4ff', 0.55)} castShadow>
        <sphereGeometry args={[0.08, 18, 14]} />
      </mesh>
      <mesh scale={[0.9, 1.1, 0.3]} position={[0, -0.02, 0]} material={m.plastic('#2a7fd0', 0.2)}>
        <sphereGeometry args={[0.075, 14, 10]} />
      </mesh>
      <Cyl a={[0.018, 0.018, 0.04]} p={[0, 0.125, 0]} m={m.plastic('#ff6b35')} seg={10} />
    </group>
  )
}

function Headlamp() {
  const m = useMats()
  return (
    <group position={[0, 0.05, 0.14]} rotation={[-0.3, 0, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={m.fabric('#2a2c30')}>
        <torusGeometry args={[0.085, 0.012, 6, 24]} />
      </mesh>
      <Box s={[0.07, 0.045, 0.045]} p={[0, 0.0, 0.09]} m={m.plastic('#d9673a', 0.4)} />
      <mesh position={[0, 0, 0.114]} material={m.glow('#fff4d0', 0.6)}>
        <circleGeometry args={[0.016, 14]} />
      </mesh>
    </group>
  )
}

function Fuse() {
  const m = useMats()
  return (
    <group position={[0, 0.03, 0.14]} rotation={[0, 0, Math.PI / 2]}>
      <Cyl a={[0.025, 0.025, 0.12]} m={m.plastic('#e8e2d0', 0.5)} seg={14} />
      <Cyl a={[0.028, 0.028, 0.025]} p={[0, 0.07, 0]} m={m.metal('#c9a14a', 0.3)} seg={14} />
      <Cyl a={[0.028, 0.028, 0.025]} p={[0, -0.07, 0]} m={m.metal('#c9a14a', 0.3)} seg={14} />
    </group>
  )
}

function Wrench() {
  const m = useMats()
  const steel = m.metal('#a9adb2', 0.3)
  return (
    <group position={[0, 0.015, 0.14]} rotation={[-Math.PI / 2, 0, 0.4]}>
      <Box s={[0.035, 0.28, 0.012]} m={steel} />
      <Box s={[0.075, 0.05, 0.016]} p={[0, 0.16, 0]} m={steel} />
      <Box s={[0.02, 0.04, 0.016]} p={[-0.03, 0.2, 0]} m={steel} />
      <Box s={[0.02, 0.03, 0.016]} p={[0.03, 0.195, 0]} m={steel} />
      <Box s={[0.04, 0.12, 0.018]} p={[0, -0.09, 0]} m={m.plastic('#c5302a', 0.5)} />
    </group>
  )
}

function Cell() {
  const m = useMats()
  const ref = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.emissiveIntensity = 3 + Math.sin(clock.elapsedTime * 3) * 1.5
  })
  return (
    <group position={[0, 0, 0.2]}>
      <Box s={[0.5, 0.5, 0.4]} p={[0, -0.25, 0]} m={m.painted('#4a5a40', 0.6, 0.2)} />
      <Cyl a={[0.08, 0.08, 0.32]} p={[0, 0.16, 0]} m={m.metal('#5d6166', 0.35)} />
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.26, 16]} />
        <meshStandardMaterial ref={ref} color="#000" emissive="#3ad7ff" emissiveIntensity={3} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} s={[0.015, 0.3, 0.015]} p={[Math.cos(i * 1.57) * 0.085, 0.16, Math.sin(i * 1.57) * 0.085]} m={m.metal('#2d3034')} />
      ))}
    </group>
  )
}

function SmallItem({ color, shape = 'box' }: { color: string; shape?: 'box' | 'cyl' | 'torus' | 'flat' | 'foil' }) {
  const m = useMats()
  return (
    <group position={[0, 0.03, 0.14]}>
      {shape === 'box' && <Box s={[0.14, 0.06, 0.1]} m={m.plastic(color, 0.4)} />}
      {shape === 'cyl' && <Cyl a={[0.04, 0.04, 0.04]} m={m.plastic(color, 0.35)} />}
      {shape === 'torus' && (
        <mesh rotation={[Math.PI / 2, 0, 0]} material={m.plastic(color, 0.6)} castShadow>
          <torusGeometry args={[0.04, 0.02, 10, 20]} />
        </mesh>
      )}
      {shape === 'flat' && <Box s={[0.1, 0.008, 0.07]} m={m.metal(color, 0.05)} />}
      {shape === 'foil' && <Box s={[0.16, 0.03, 0.12]} m={m.metal(color, 0.25)} />}
    </group>
  )
}

function Medkit() {
  const m = useMats()
  return (
    <group position={[0, 0, 0.1]}>
      <Box s={[0.3, 0.2, 0.12]} p={[0, 0, 0]} m={m.plastic('#e9ece8', 0.4)} />
      <Box s={[0.12, 0.035, 0.005]} p={[0, 0, 0.062]} m={m.plastic('#1f9a4a', 0.4)} />
      <Box s={[0.035, 0.12, 0.005]} p={[0, 0, 0.062]} m={m.plastic('#1f9a4a', 0.4)} />
      <Box s={[0.08, 0.02, 0.02]} p={[0, 0.11, 0]} m={m.plastic('#2a2c30')} />
    </group>
  )
}

// ——— éléments d'énigme ———
function Locker() {
  const m = useMats()
  const open = useGame((s) => s.flags.lockerOpen)
  const door = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (door.current) door.current.rotation.y = THREE.MathUtils.damp(door.current.rotation.y, open ? -1.9 : 0, 3, dt)
  })
  const label = useMemo(() => new THREE.MeshStandardMaterial({ map: textTexture(['SECOURS', 'Équipage Selene-7'], { w: 256, h: 96, bg: '#b8231c', fg: '#ffffff', size: 26, align: 'center', pad: 14 }) }), [])
  return (
    <group position={[0, 0, 0]}>
      <Box s={[0.8, 2.0, 0.55]} p={[0, 1.0, 0.28]} m={m.painted('#5e6a74', 0.45, 0.6)} />
      <Box s={[0.7, 0.6, 0.02]} p={[0, 1.0, 0.03]} m={m.painted('#3a3d42', 0.6, 0.3)} />
      <group ref={door} position={[0.39, 0, 0.56]}>
        <Box s={[0.78, 1.95, 0.03]} p={[-0.39, 1.0, 0]} m={m.painted('#6a7884', 0.45, 0.6)} />
        <mesh position={[-0.39, 1.65, 0.017]} material={label}>
          <planeGeometry args={[0.4, 0.15]} />
        </mesh>
        <Box s={[0.12, 0.18, 0.03]} p={[-0.18, 1.2, 0.025]} m={m.plastic('#1b1d20', 0.3)} />
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[-0.21 + (i % 2) * 0.06, 1.24 - Math.floor(i / 2) * 0.05, 0.042]} material={m.glow(open ? '#38ff7a' : '#ffb020', 1.5)}>
            <planeGeometry args={[0.04, 0.03]} />
          </mesh>
        ))}
        {[0.3, 0.5, 0.7].map((y) => (
          <Box key={y} s={[0.5, 0.012, 0.005]} p={[-0.39, y, 0.017]} m={m.metal('#3b3e42')} />
        ))}
      </group>
      {/* contenu : un badge sur l'étagère */}
      <Box s={[0.7, 0.02, 0.5]} p={[0, 1.1, 0.28]} m={m.metal('#55595e')} />
      <Box s={[0.08, 0.05, 0.005]} p={[0, 1.14, 0.3]} r={[-1.2, 0, 0]} m={m.plastic('#3d7bff', 0.3)} />
    </group>
  )
}

function Postit() {
  const mat = useMemo(() => {
    const t = textTexture(['La diagonale,', 'toujours la', 'diagonale. — N.'], { w: 128, h: 128, bg: '#f6e27a', fg: '#1d2a6b', size: 15, font: 'italic 600 15px Inter, sans-serif', pad: 10 })
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 })
  }, [])
  return (
    <mesh position={[0, 0, 0.02]} rotation={[0, 0, 0.1]} material={mat}>
      <planeGeometry args={[0.12, 0.12]} />
    </mesh>
  )
}

function Board() {
  const m = useMats()
  const mat = useMemo(() => {
    const t = textTexture(['RAPPEL ÉQUIPAGE', '', 'Code du casier', 'de secours changé :', "= année de mise", 'en service de la', 'station (plaque', 'de la réserve)', '', '                — Cdte'], {
      w: 512,
      h: 340,
      bg: '#f1efe8',
      fg: '#203b8a',
      size: 26,
      font: '600 26px "Inter", sans-serif',
      pad: 22,
    })
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.3 })
  }, [])
  return (
    <group>
      <Box s={[1.5, 1.0, 0.04]} p={[0, 0, 0.02]} m={m.metal('#9aa0a6', 0.3)} />
      <mesh position={[0, 0, 0.042]} material={mat}>
        <planeGeometry args={[1.42, 0.92]} />
      </mesh>
      <Box s={[0.3, 0.03, 0.06]} p={[0.4, -0.52, 0.04]} m={m.metal('#9aa0a6', 0.3)} />
      <Cyl a={[0.008, 0.008, 0.12]} p={[0.35, -0.49, 0.06]} r={[0, 0, Math.PI / 2]} m={m.plastic('#c5302a')} seg={8} />
    </group>
  )
}

function Plate() {
  const m = useMats()
  const mat = useMemo(() => {
    const t = textTexture(['STATION SELENE-7', 'Agence spatiale européenne', '', 'MISE EN SERVICE', '2041'], { w: 512, h: 300, bg: '#9a7a3a', fg: '#3b2a10', size: 34, align: 'center', font: '700 34px "Rajdhani", sans-serif', pad: 30 })
    return new THREE.MeshStandardMaterial({ map: t, metalness: 0.85, roughness: 0.35, color: '#e8c98a' })
  }, [])
  return (
    <group>
      <mesh position={[0, 0, 0.012]} material={mat}>
        <boxGeometry args={[0.5, 0.3, 0.012]} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sy) => <Cyl key={`${sx}${sy}`} a={[0.008, 0.008, 0.01]} p={[sx * 0.22, sy * 0.12, 0.02]} r={[Math.PI / 2, 0, 0]} m={m.metal('#6b5426')} seg={8} />),
      )}
    </group>
  )
}

function Dispenser() {
  const m = useMats()
  return (
    <group>
      <Box s={[0.45, 1.05, 0.4]} p={[0, 0.525, 0.22]} m={m.painted('#d9dcdf', 0.35, 0.2)} />
      <Cyl a={[0.15, 0.15, 0.38]} p={[0, 1.25, 0.22]} m={m.glass('#7fc4ff', 0.45)} seg={24} />
      <Cyl a={[0.14, 0.14, 0.3]} p={[0, 1.22, 0.22]} m={m.plastic('#3a8fe0', 0.1)} seg={20} />
      <Box s={[0.3, 0.2, 0.08]} p={[0, 0.85, 0.44]} m={m.plastic('#2a2d31', 0.4)} />
      <Box s={[0.04, 0.06, 0.06]} p={[-0.06, 0.78, 0.47]} m={m.plastic('#2a7fd0')} />
      <Box s={[0.04, 0.06, 0.06]} p={[0.06, 0.78, 0.47]} m={m.plastic('#c5302a')} />
      <Box s={[0.3, 0.02, 0.15]} p={[0, 0.6, 0.45]} m={m.metal('#8d9196')} />
    </group>
  )
}

function ValvePanel() {
  const m = useMats()
  const valves = useGame((s) => s.valves)
  return (
    <group>
      <Box s={[1.1, 1.1, 0.08]} p={[0, 0, 0.04]} m={m.painted('#3a3d42', 0.5, 0.6)} />
      {valves.map((on, i) => {
        const x = ((i % 3) - 1) * 0.32
        const y = (1 - Math.floor(i / 3)) * 0.32
        return (
          <group key={i} position={[x, y, 0.1]}>
            <mesh material={m.painted(on ? '#2f8a4a' : '#b8231c', 0.4, 0.4)} castShadow>
              <torusGeometry args={[0.1, 0.018, 8, 24]} />
            </mesh>
            {[0, 1].map((k) => (
              <Box key={k} s={[0.2, 0.018, 0.018]} r={[0, 0, k * 1.57 + (on ? 0.785 : 0)]} m={m.metal('#8d9196')} />
            ))}
            <mesh position={[0.13, 0.12, -0.02]} material={m.glow(on ? '#38ff7a' : '#ff2a1a', 3)}>
              <circleGeometry args={[0.015, 10]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function Hatch() {
  const m = useMats()
  const ok = useGame((s) => s.flags.pressurized)
  return (
    <group>
      <Cyl a={[0.75, 0.75, 0.06]} p={[0, 0.03, 0]} m={m.painted('#4a4e54', 0.4, 0.7)} seg={40} />
      <Cyl a={[0.6, 0.6, 0.02]} p={[0, 0.07, 0]} m={m.painted('#7d8288', 0.45, 0.6)} seg={40} />
      <mesh position={[0, 0.09, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.metal('#c0c4c8', 0.25)}>
        <torusGeometry args={[0.25, 0.025, 8, 30]} />
      </mesh>
      {[0, 1].map((k) => (
        <Box key={k} s={[0.5, 0.03, 0.04]} p={[0, 0.09, 0]} r={[0, k * 1.57, 0]} m={m.metal('#c0c4c8', 0.25)} />
      ))}
      {[0, 1, 2, 3].map((k) => (
        <mesh key={k} position={[Math.cos(k * 1.57) * 0.68, 0.065, Math.sin(k * 1.57) * 0.68]} material={m.glow(ok ? '#38ff7a' : '#ff2a1a', 3)}>
          <boxGeometry args={[0.06, 0.02, 0.06]} />
        </mesh>
      ))}
    </group>
  )
}

function Datapad({ lines }: { lines: string[] }) {
  const m = useMats()
  const mat = useMemo(() => {
    const t = textTexture(lines, { w: 256, h: 180, size: 16, fg: '#9fe8ff', bg: '#071820', scan: true, pad: 12 })
    return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#fff', emissiveIntensity: 1.2 })
  }, [lines.join('|')])
  return (
    <group position={[0, 0.01, 0.25]} rotation={[-Math.PI / 2 + 0.25, 0, 0.1]}>
      <Box s={[0.26, 0.18, 0.015]} m={m.plastic('#1b1d20', 0.3)} />
      <mesh position={[0, 0, 0.0085]} material={mat}>
        <planeGeometry args={[0.235, 0.155]} />
      </mesh>
    </group>
  )
}

function Tag() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: textTexture(['Clé à molette', 'près des bacs', 'NE PAS EMPORTER'], { w: 256, h: 128, bg: '#f2efe6', fg: '#2f6b2c', size: 20, pad: 12 }) }), [])
  return (
    <mesh position={[0, 0, 0.02]} material={mat}>
      <planeGeometry args={[0.26, 0.13]} />
    </mesh>
  )
}

function SteamValve() {
  const m = useMats()
  const fixed = useGame((s) => s.flags.steamFixed)
  const wheel = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (wheel.current) wheel.current.rotation.z = THREE.MathUtils.damp(wheel.current.rotation.z, fixed ? -Math.PI * 3 : 0, 2, dt)
  })
  return (
    <group>
      <Cyl a={[0.09, 0.09, 1.9]} p={[0, 0, 0.18]} r={[0, 0, Math.PI / 2]} m={m.painted('#9b5a2a', 0.5, 0.6)} />
      <Box s={[0.22, 0.22, 0.22]} p={[0, 0, 0.18]} m={m.painted('#5a5f66', 0.4, 0.8)} />
      <group ref={wheel} position={[0, 0, 0.36]}>
        <mesh material={m.painted('#c5302a', 0.4, 0.4)} castShadow>
          <torusGeometry args={[0.14, 0.02, 8, 24]} />
        </mesh>
        {[0, 1, 2].map((k) => (
          <Box key={k} s={[0.28, 0.02, 0.02]} r={[0, 0, (k * Math.PI) / 3]} m={m.painted('#c5302a', 0.4, 0.4)} />
        ))}
      </group>
    </group>
  )
}

/** fuite de vapeur : particules + collision + son spatial */
function Steam({ e }: { e: Ent }) {
  const fixed = useGame((s) => s.flags.steamFixed)
  const pts = useRef<THREE.Points>(null)
  const N = 220
  const { geo, mat, seeds } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3))
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const ctx = c.getContext('2d')!
    const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    gr.addColorStop(0, 'rgba(255,255,255,0.55)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gr
    ctx.fillRect(0, 0, 64, 64)
    const mat = new THREE.PointsMaterial({ size: 0.9, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0.55, color: '#dfe6ea' })
    return { geo: g, mat, seeds: Array.from({ length: N }, () => Math.random()) }
  }, [])
  const fade = useRef(1)
  useFrame(({ clock }, dt) => {
    fade.current = THREE.MathUtils.damp(fade.current, fixed ? 0 : 1, 1.2, dt)
    mat.opacity = 0.55 * fade.current
    const p = geo.attributes.position as THREE.BufferAttribute
    const t = clock.elapsedTime
    for (let i = 0; i < N; i++) {
      const life = (t * 0.6 + seeds[i]) % 1
      const a = seeds[i] * 40
      p.setXYZ(i, Math.cos(a) * life * 0.9 + Math.sin(t + i) * 0.05, 2.4 - life * 2.2 + Math.sin(a * 3) * 0.2, -0.7 + life * 1.6 + Math.sin(a) * life * 0.6)
    }
    p.needsUpdate = true
  })
  useEffect(() => {
    if (fixed) return
    const [x, , z] = placeOf(e).p
    const timer = setTimeout(() => audio.loop('steam', 'steam', { pos: [x, 1.8, z], vol: 0.9 }), 400)
    return () => {
      clearTimeout(timer)
      audio.stopLoop('steam')
    }
  }, [fixed, e])
  return (
    <group>
      <points ref={pts} geometry={geo} material={mat} frustumCulled={false} />
      {!fixed && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider args={[1, 1.4, 1]} position={[0, 1.4, 0]} />
        </RigidBody>
      )}
      {!fixed && <pointLight color="#ffd2a8" intensity={1.5} distance={4} position={[0, 1.6, 0]} />}
    </group>
  )
}

function Breaker() {
  const m = useMats()
  const power = useGame((s) => s.flags.power)
  const lever = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (lever.current) lever.current.rotation.x = THREE.MathUtils.damp(lever.current.rotation.x, power ? -0.6 : 0.6, 4, dt)
  })
  return (
    <group>
      <Box s={[1.3, 1.5, 0.3]} p={[0, 0, 0.15]} m={m.painted('#5c646c', 0.5, 0.5)} />
      <Box s={[1.2, 1.4, 0.02]} p={[0, 0, 0.31]} m={m.painted('#2e3237', 0.5, 0.5)} />
      <group ref={lever} position={[0.4, 0, 0.34]}>
        <Box s={[0.05, 0.4, 0.05]} p={[0, 0.2, 0]} m={m.metal('#8d9196')} />
        <Box s={[0.14, 0.06, 0.06]} p={[0, 0.4, 0]} m={m.plastic('#c5302a')} />
      </group>
      <Cyl a={[0.06, 0.06, 0.12]} p={[-0.3, 0.3, 0.33]} r={[0, 0, Math.PI / 2]} m={power ? m.plastic('#e8e2d0') : m.plastic('#1b1b1b')} seg={14} />
      {['LUM', 'O₂', 'TERM', 'SAS'].map((_, i) => (
        <mesh key={i} position={[-0.45 + i * 0.25, -0.45, 0.33]} material={m.glow(power ? '#38ff7a' : '#300', 2)}>
          <circleGeometry args={[0.025, 10]} />
        </mesh>
      ))}
      <mesh position={[0, 0.6, 0.322]} material={useMemo(() => new THREE.MeshStandardMaterial({ map: textTexture(['DISJONCTEUR PRINCIPAL', 'Réseau de secours 3 U'], { w: 512, h: 96, bg: '#e0a92a', fg: '#14161a', size: 26, pad: 14 }) }), [])}>
        <planeGeometry args={[0.9, 0.17]} />
      </mesh>
    </group>
  )
}

function Terminal() {
  const m = useMats()
  const f = useGame((s) => s.flags)
  const on = f.power && f.pw_terminal
  const mat = useMemo(() => {
    const lines = !on
      ? ['', '', '   AUCUN SIGNAL']
      : f.readTerminal
        ? ['HERMÈS · PRÉ-VOL', '> séquence chargée', '> sas : ' + (f.pw_sas ? 'OK' : 'HORS TENSION'), '> bon vol.']
        : ['> VERROUILLÉ', 'c ← [R, J, B, V]', 'pour i de 0 à 3 :', ' j ← (3i+2) mod 4', ' émettre c[j]']
    const t = textTexture(lines, { w: 512, h: 320, fg: on ? '#7fe3ff' : '#331111', bg: on ? '#061820' : '#020202', scan: true, glow: on, size: 32 })
    return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#fff', emissiveIntensity: on ? 1.6 : 0 })
  }, [on, f.pw_sas, f.readTerminal])
  return (
    <group>
      <Box s={[1.4, 0.9, 0.6]} p={[0, 0.45, 0.3]} m={m.painted('#3c4046', 0.5, 0.6)} />
      <Box s={[1.4, 0.05, 0.65]} p={[0, 0.92, 0.32]} m={m.plastic('#1e2023', 0.35)} />
      <Box s={[1.0, 0.65, 0.06]} p={[0, 1.45, 0.12]} r={[-0.1, 0, 0]} m={m.plastic('#1b1d20', 0.3)} />
      <mesh position={[0, 1.45, 0.155]} rotation={[-0.1, 0, 0]} material={mat}>
        <planeGeometry args={[0.92, 0.57]} />
      </mesh>
      <Box s={[0.6, 0.02, 0.2]} p={[0, 0.955, 0.4]} m={m.plastic('#2a2c30', 0.5)} />
    </group>
  )
}

function PilotConsole() {
  const m = useMats()
  const engine = useGame((s) => s.flags.engine)
  const cols = ['#2f6bff', '#ffd23a', '#ff3a2a', '#2fd060']
  return (
    <group>
      <Box s={[5.6, 0.95, 0.9]} p={[0, 0.475, 0.45]} m={m.painted('#2c2f33', 0.5, 0.6)} />
      <Box s={[5.6, 0.08, 1.0]} p={[0, 1.0, 0.5]} r={[0.3, 0, 0]} m={m.plastic('#15171a', 0.3)} />
      <Screen w={0.9} h={0.5} p={[-1.6, 1.12, 0.45]} lines={['TRAJECTOIRE', 'TLI → TERRE', 'T-0 : en attente']} fg="#ffb38a" />
      <Screen w={0.9} h={0.5} p={[1.6, 1.12, 0.45]} lines={['MOTEUR', engine ? 'CELLULE OK' : 'SANS ÉNERGIE', engine ? 'PRÊT' : '—']} fg={engine ? '#7fffb0' : '#ff7a6b'} />
      {cols.map((c, i) => (
        <group key={i} position={[-0.45 + i * 0.3, 1.07, 0.62]} rotation={[0.3, 0, 0]}>
          <Cyl a={[0.08, 0.09, 0.05]} m={m.metal('#2a2c30')} />
          <Cyl a={[0.065, 0.065, 0.04]} p={[0, 0.03, 0]} m={m.glow(c, engine ? 2.5 : 0.4)} />
        </group>
      ))}
      <Box s={[0.08, 0.25, 0.08]} p={[0.9, 1.18, 0.75]} r={[0.3, 0, 0]} m={m.plastic('#1b1d20')} />
    </group>
  )
}

function EngineSlot() {
  const m = useMats()
  const engine = useGame((s) => s.flags.engine)
  return (
    <group>
      <Box s={[1.0, 1.2, 0.35]} p={[0, 0, 0.17]} m={m.painted('#3c4046', 0.5, 0.7)} />
      <Cyl a={[0.12, 0.12, 0.2]} p={[0, 0.1, 0.36]} r={[Math.PI / 2, 0, 0]} m={m.metal('#1b1d20', 0.5)} />
      {engine && (
        <mesh position={[0, 0.1, 0.42]} rotation={[Math.PI / 2, 0, 0]} material={m.glow('#3ad7ff', 5)}>
          <cylinderGeometry args={[0.07, 0.07, 0.16, 16]} />
        </mesh>
      )}
      <mesh position={[0, 0.45, 0.352]} material={m.glow(engine ? '#38ff7a' : '#ff2a1a', 3)}>
        <planeGeometry args={[0.5, 0.05]} />
      </mesh>
    </group>
  )
}

/** hologramme de la commandante */
function Hologram() {
  const cine = useGame((s) => s.cine)
  const character = useGame((s) => s.character)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uA: { value: 0.35 } },
        vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW;
          void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `uniform float uTime; uniform float uA; varying vec3 vN; varying vec3 vV; varying vec3 vW;
          void main(){ float f = pow(1.-abs(dot(vN,vV)),2.); float scan = .7+.3*sin(vW.y*70.-uTime*6.);
            float flick = .85+.15*sin(uTime*37.)*sin(uTime*13.);
            float band = smoothstep(.0,.02,fract(vW.y*.8-uTime*.35))*.4+.6;
            vec3 c = vec3(.35,.8,1.)*(f*2.2+.06)*scan*flick*band;
            gl_FragColor = vec4(c*uA*1.6, 1.); }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime
    mat.uniforms.uA.value = THREE.MathUtils.lerp(mat.uniforms.uA.value, cine === 'briefing' ? 1 : 0.22, 0.05)
    if (g.current) g.current.rotation.y = Math.sin(clock.elapsedTime * 0.3) * 0.2
  })
  const briefer = character === 'ines' ? 'kenji' : 'ines'
  return (
    <group ref={g} position={[0, 0.1, 0]} scale={0.95}>
      <Astronaut override={mat} castShadow={false} accent={fr.characters[briefer].color} />
      <pointLight color="#59c8ff" intensity={cine === 'briefing' ? 3 : 0.8} distance={4} position={[0, 1.2, 0.3]} />
    </group>
  )
}

function DoorLock() {
  return null
}

const DATAPADS: Record<string, string[]> = {
  labNote: ['JOURNAL LABO', 'Disjoncteur sauté.', 'Fusible : tiroir', 'Réseau : 3 unités'],
  cargoNote: ['SOUTE · INVENTAIRE', 'Cellule énergie', 'caisse 3, au fond'],
}

export const ENT_MODELS: Record<string, (e: Ent) => ReactNode> = {
  o2: () => <O2Bottle />,
  battery: () => <Batteries />,
  water: () => <WaterPouch />,
  lamp: () => <Headlamp />,
  fuse: () => <Fuse />,
  wrench: () => <Wrench />,
  cell: () => <Cell />,
  ration: () => <SmallItem color="#c0c4c8" shape="foil" />,
  medkit: () => <Medkit />,
  blanket: () => <SmallItem color="#d4a63a" shape="foil" />,
  multitool: () => <SmallItem color="#c5302a" shape="box" />,
  purifier: () => <SmallItem color="#2a7fd0" shape="cyl" />,
  tape: () => <SmallItem color="#8d9196" shape="torus" />,
  compass: () => <SmallItem color="#3a3d42" shape="cyl" />,
  whistle: () => <SmallItem color="#ff6b35" shape="box" />,
  mirror: () => <SmallItem color="#e8ecf0" shape="flat" />,
  holo: () => <Hologram />,
  locker: () => <Locker />,
  postit: () => <Postit />,
  board: () => <Board />,
  plate: () => <Plate />,
  dispenser: () => <Dispenser />,
  valvePanel: () => <ValvePanel />,
  hatch: () => <Hatch />,
  datapad: (e) => <Datapad lines={DATAPADS[e.id] ?? ['NOTE']} />,
  tag: () => <Tag />,
  steamValve: () => <SteamValve />,
  steam: (e) => <Steam e={e} />,
  breaker: () => <Breaker />,
  terminal: () => <Terminal />,
  dockHatch: () => <DockHatch />,
  doorLock: () => <DoorLock />,
  pilotConsole: () => <PilotConsole />,
  engineSlot: () => <EngineSlot />,
  ...ZONE4_ENT_MODELS,
}

const WALL_BRACKET = new Set(['battery', 'water', 'fuse', 'wrench', 'multitool', 'purifier', 'tape', 'compass', 'whistle', 'mirror', 'lamp'])

function EntNode({ e, zone }: { e: Ent; zone: ZoneId }) {
  useGame((s) => s.taken.length + Object.values(s.flags).filter(Boolean).length)
  const active = entActive(e)
  const { p, r } = placeOf(e, 0)
  const map = zone === 4 ? null : GRID_MAPS[zone]
  const room = map ? roomAt(map, p[0] + (e.wall ? Math.sin(r) * 0.3 : 0), p[2] + (e.wall ? Math.cos(r) * 0.3 : 0)) : null
  const model = ENT_MODELS[e.model]
  const keepWhenDone = !e.item
  if (!active && !keepWhenDone) return null
  return (
    <RoomCtx.Provider value={{ id: room?.id ?? '', dark: !!room?.dark }}>
      <group position={p} rotation={[0, r, 0]}>
        {model ? model(e) : null}
        {!e.item && <SolidProp model={e.model} />}
        {e.item && e.wall && (e.y ?? 0) > 0.3 && WALL_BRACKET.has(e.model) && <Bracket />}
        {e.item && <Glint resource={ITEM_KIND[e.item] === 'resource'} />}
        {active && <Hitbox e={e} />}
      </group>
    </RoomCtx.Provider>
  )
}

export function EntModels({ zone }: { zone: ZoneId }) {
  const ents = useMemo(() => allEnts(zone), [zone])
  return (
    <group>
      {ents.map((e) => (
        <EntNode key={e.id} e={e} zone={zone} />
      ))}
    </group>
  )
}

export function aimedEnt() {
  return live.aimed
}
