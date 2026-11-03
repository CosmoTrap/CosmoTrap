import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { useGame } from '../../game/state'
import { useMats } from '../materials'
import { RealModel } from './RealModel'
import { drawTexture, textTexture, texRnd, texSeed } from '../textures'

// Accessoires de décor modélisés en code. Convention : les objets muraux ont le dos en z = 0
// et s'étendent vers +z (l'intérieur de la pièce) ; les objets au sol sont centrés.

type M = THREE.Material
const boxGeometries = new Map<string, THREE.BufferGeometry>()
export function Box({ s, p = [0, 0, 0], r, m, cast = true }: { s: [number, number, number]; p?: [number, number, number]; r?: [number, number, number]; m: M; cast?: boolean }) {
  const soft = !!m.userData.fabric
  const key = `${s.join(':')}:${soft}`
  let geometry = boxGeometries.get(key)
  if (!geometry) {
    const radius = Math.min(soft ? 0.065 : 0.014, Math.min(...s) * (soft ? 0.42 : 0.2))
    geometry = Math.min(...s) < 0.018 ? new THREE.BoxGeometry(...s) : new RoundedBoxGeometry(...s, soft ? 2 : 1, radius)
    boxGeometries.set(key, geometry)
  }
  return (
    <mesh position={p} rotation={r} geometry={geometry} material={m} castShadow={cast} receiveShadow dispose={null} />
  )
}
export function Cyl({ a, p = [0, 0, 0], r, m, seg = 20 }: { a: [number, number, number]; p?: [number, number, number]; r?: [number, number, number]; m: M; seg?: number }) {
  return (
    <mesh position={p} rotation={r} material={m} castShadow receiveShadow>
      <cylinderGeometry args={[a[0], a[1], a[2], seg]} />
    </mesh>
  )
}

export function Screen({ w, h, lines, fg = '#7fe3ff', bg = '#06141c', p = [0, 0, 0] as [number, number, number], intensity = 1.4 }: { w: number; h: number; lines: string[]; fg?: string; bg?: string; p?: [number, number, number]; intensity?: number }) {
  const mat = useMemo(() => {
    const t = textTexture(lines, { w: 512, h: Math.round((512 * h) / w), fg, bg, scan: true, glow: true, size: 26 })
    return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: intensity, roughness: 0.25, metalness: 0 })
  }, [lines.join('|'), w, h, fg, bg, intensity])
  return (
    <mesh position={p} material={mat}>
      <planeGeometry args={[w, h]} />
    </mesh>
  )
}

const photoTex = (sd: number) =>
  drawTexture(256, 200, (c) => {
    texSeed(sd)
    const sky = c.createLinearGradient(0, 0, 0, 200)
    const warm = texRnd() > 0.5
    sky.addColorStop(0, warm ? '#f2b27a' : '#8fc2e8')
    sky.addColorStop(1, warm ? '#6b4a6e' : '#e8dcc0')
    c.fillStyle = sky
    c.fillRect(0, 0, 256, 200)
    c.fillStyle = warm ? '#3b2c3a' : '#4d6b3a'
    c.beginPath()
    c.moveTo(0, 150)
    for (let x = 0; x <= 256; x += 32) c.lineTo(x, 130 + texRnd() * 30)
    c.lineTo(256, 200)
    c.lineTo(0, 200)
    c.fill()
    const n = 2 + Math.floor(texRnd() * 3)
    for (let i = 0; i < n; i++) {
      const x = 60 + i * (140 / n) + texRnd() * 10
      const s = 0.7 + texRnd() * 0.5
      c.fillStyle = `hsl(${texRnd() * 360},35%,${30 + texRnd() * 20}%)`
      c.beginPath()
      c.ellipse(x, 175 - 30 * s, 16 * s, 34 * s, 0, 0, Math.PI * 2)
      c.fill()
      c.fillStyle = `hsl(25,${30 + texRnd() * 20}%,${35 + texRnd() * 30}%)`
      c.beginPath()
      c.arc(x, 128 - 40 * s + 30, 11 * s, 0, Math.PI * 2)
      c.fill()
    }
    c.fillStyle = 'rgba(255,240,220,0.12)'
    c.fillRect(0, 0, 256, 200)
  })

const postitTex = (lines: string[], color = '#f6e27a') =>
  drawTexture(128, 128, (c) => {
    c.fillStyle = color
    c.fillRect(0, 0, 128, 128)
    c.fillStyle = 'rgba(0,0,0,0.06)'
    c.fillRect(0, 0, 128, 14)
    c.fillStyle = '#1d2a6b'
    c.font = 'italic 600 15px "Inter", sans-serif'
    lines.forEach((l, i) => c.fillText(l, 8, 34 + i * 20))
  })

// ——— modèles ———
function Bunk() {
  const m = useMats()
  const frame = m.painted('#7d8288', 0.4, 0.6)
  const mattress = m.fabric('#3e5566')
  const blanket = m.fabric('#a4643e')
  const blanketGeo = useMemo(() => {
    const g = new THREE.PlaneGeometry(1.25, 1.02, 28, 24)
    g.rotateX(-Math.PI / 2)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i)
      p.setY(i, 0.025 * Math.sin(x * 19 + z * 3) + 0.009 * Math.sin(z * 37 + x * 8) - Math.pow(Math.max(0, Math.abs(z) - 0.38) * 3, 2))
    }
    g.computeVertexNormals()
    return g
  }, [])
  blanket.side = THREE.DoubleSide
  return (
    <group>
      {[0.35, 1.45].map((y, i) => (
        <group key={i} position={[0, y, 0.48]}>
          <Box s={[1.9, 0.08, 0.9]} m={frame} />
          <Box s={[1.84, 0.14, 0.84]} p={[0, 0.11, 0]} m={mattress} />
          <mesh geometry={blanketGeo} material={blanket} position={[0.28, 0.22, 0]} castShadow receiveShadow />
          <Box s={[0.4, 0.1, 0.6]} p={[-0.7, 0.23, 0]} m={m.fabric('#d9d4c8')} />
        </group>
      ))}
      {[-0.95, 0.95].map((x) => (
        <Box key={x} s={[0.05, 2.0, 0.05]} p={[x, 1.0, 0.92]} m={frame} />
      ))}
      <Box s={[0.04, 0.55, 0.9]} p={[0.97, 1.85, 0.48]} m={frame} />
      <Screen w={0.22} h={0.14} p={[-0.7, 1.95, 0.02]} lines={['LÉO', '♥ 62 bpm']} intensity={0.8} />
    </group>
  )
}

function Shelf() {
  const m = useMats()
  return (
    <group>
      <Box s={[1.2, 0.04, 0.3]} p={[0, 0, 0.15]} m={m.painted('#6f747a', 0.4, 0.5)} />
      <Box s={[0.18, 0.24, 0.14]} p={[-0.4, 0.14, 0.12]} m={m.plastic('#2f3a44')} />
      <Box s={[0.08, 0.2, 0.12]} p={[0.42, 0.12, 0.14]} m={m.fabric('#7a3b2a')} />
      <Box s={[0.08, 0.18, 0.12]} p={[0.5, 0.11, 0.14]} m={m.fabric('#2c5a7a')} />
    </group>
  )
}

function Photos() {
  const m = useMats()
  const mats = useMemo(() => [11, 23, 37].map((s) => new THREE.MeshStandardMaterial({ map: photoTex(s), roughness: 0.35 })), [])
  return (
    <group>
      {mats.map((mat, i) => (
        <group key={i} position={[-0.32 + i * 0.32, i === 1 ? 0.08 : 0, 0.012]} rotation={[0, 0, (i - 1) * 0.06]}>
          <Box s={[0.24, 0.2, 0.012]} m={m.plastic('#e8e3d8')} cast={false} />
          <mesh position={[0, 0, 0.007]} material={mat}>
            <planeGeometry args={[0.2, 0.16]} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** jouet en apesanteur : petit astronaute en peluche qui flotte */
function Toy() {
  const ref = useRef<THREE.Group>(null)
  const m = useMats()
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (!ref.current) return
    ref.current.position.y = Math.sin(t * 0.6) * 0.08
    ref.current.rotation.set(Math.sin(t * 0.3) * 0.4, t * 0.25, Math.cos(t * 0.23) * 0.5)
  })
  const suit = m.fabric('#e9e6df')
  return (
    <group ref={ref}>
      <mesh material={suit} castShadow>
        <capsuleGeometry args={[0.07, 0.08, 6, 12]} />
      </mesh>
      <mesh position={[0, 0.13, 0]} material={suit} castShadow>
        <sphereGeometry args={[0.075, 16, 12]} />
      </mesh>
      <mesh position={[0, 0.135, 0.045]} material={m.plastic('#c88a2a', 0.15)}>
        <sphereGeometry args={[0.05, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2.4]} />
      </mesh>
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.09, 0.02, 0]} rotation={[0, 0, s * 0.8]} material={suit}>
            <capsuleGeometry args={[0.025, 0.06, 4, 8]} />
          </mesh>
          <mesh position={[s * 0.04, -0.11, 0]} material={suit}>
            <capsuleGeometry args={[0.028, 0.05, 4, 8]} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, 0.02, 0.07]} material={m.fabric('#d9673a')}>
        <boxGeometry args={[0.05, 0.04, 0.01]} />
      </mesh>
    </group>
  )
}

function Sockets() {
  const m = useMats()
  return (
    <group>
      <Box s={[0.5, 0.12, 0.04]} p={[0, 0, 0.02]} m={m.plastic('#d8d4cc')} />
      {[-0.15, 0, 0.15].map((x) => (
        <Box key={x} s={[0.06, 0.06, 0.01]} p={[x, 0, 0.045]} m={m.plastic('#2d2f33')} />
      ))}
      <mesh position={[0.22, 0, 0.045]} material={m.glow('#4cff9a', 2)}>
        <circleGeometry args={[0.008, 8]} />
      </mesh>
    </group>
  )
}

function PersonalLocker() {
  const m = useMats()
  return (
    <group>
      <Box s={[0.6, 2.0, 0.55]} p={[0, 1.0, 0.28]} m={m.painted('#6a7480', 0.45, 0.5)} />
      <Box s={[0.02, 1.8, 0.01]} p={[0, 1.0, 0.56]} m={m.metal('#2d3034')} />
      <Box s={[0.4, 0.05, 0.01]} p={[0, 1.85, 0.56]} m={m.metal('#2d3034')} />
    </group>
  )
}

function HoloProjector() {
  const m = useMats()
  return (
    <group>
      <Cyl a={[0.32, 0.36, 0.08]} p={[0, 0.04, 0]} m={m.painted('#2e3237', 0.4, 0.8)} seg={32} />
      <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]} material={m.glow('#59c8ff', 3)}>
        <ringGeometry args={[0.18, 0.24, 40]} />
      </mesh>
    </group>
  )
}

function Table() {
  const m = useMats()
  const top = m.painted('#d6d2c8', 0.35, 0.1)
  const leg = m.metal('#6d7177', 0.4)
  return (
    <group>
      <Box s={[1.7, 0.05, 0.85]} p={[0, 0.76, 0]} m={top} />
      <Box s={[1.72, 0.02, 0.87]} p={[0, 0.735, 0]} m={m.metal('#8d9196', 0.3)} />
      <Cyl a={[0.06, 0.12, 0.72]} p={[0, 0.36, 0]} m={leg} />
      <Cyl a={[0.35, 0.38, 0.03]} p={[0, 0.015, 0]} m={leg} seg={24} />
      {[-0.65, 0.65].map((z) => (
        <group key={z} position={[0, 0, z * 1.15]}>
          <Box s={[1.6, 0.06, 0.35]} p={[0, 0.45, 0]} m={m.fabric('#4b5d6a')} />
          <Box s={[0.08, 0.45, 0.08]} p={[-0.6, 0.22, 0]} m={leg} />
          <Box s={[0.08, 0.45, 0.08]} p={[0.6, 0.22, 0]} m={leg} />
        </group>
      ))}
    </group>
  )
}

function Mugs() {
  const m = useMats()
  const cols = ['#d9673a', '#e8e3d8', '#2c5a7a']
  return (
    <group>
      {cols.map((c, i) => (
        <group key={i} position={[-0.3 + i * 0.28, 0.05, (i % 2) * 0.18 - 0.05]}>
          <Cyl a={[0.04, 0.035, 0.1]} m={m.plastic(c, 0.25)} />
          <mesh position={[0.045, 0, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.plastic(c, 0.25)}>
            <torusGeometry args={[0.025, 0.007, 6, 12]} />
          </mesh>
        </group>
      ))}
      <Box s={[0.22, 0.012, 0.16]} p={[0.35, 0.006, 0.12]} r={[0, 0.3, 0]} m={m.fabric('#efe9d6')} />
    </group>
  )
}

function Counter() {
  const m = useMats()
  return (
    <group>
      <Box s={[2, 0.9, 0.6]} p={[0, 0.45, 0.3]} m={m.painted('#b9b3a6', 0.5, 0.2)} />
      <Box s={[2, 0.04, 0.64]} p={[0, 0.92, 0.32]} m={m.metal('#a7abb0', 0.25)} />
      {[-0.5, 0.5].map((x) => (
        <Box key={x} s={[0.9, 0.7, 0.01]} p={[x, 0.42, 0.605]} m={m.painted('#a59f92', 0.5, 0.2)} />
      ))}
      <Box s={[2, 0.6, 0.35]} p={[0, 2.1, 0.18]} m={m.painted('#b9b3a6', 0.5, 0.2)} />
    </group>
  )
}

function Postits() {
  const mats = useMemo(
    () =>
      [
        ['Café : 3 dosettes', 'max / jour !'],
        ['Anniv. Kenji', 'vendredi 🎂'],
        ['Code casier ?', '→ voir plaque'],
        ['Appeler maman', 'fenêtre comm 18h'],
      ].map((l, i) => new THREE.MeshStandardMaterial({ map: postitTex(l, ['#f6e27a', '#f7a8b8', '#9fe3c4', '#f6e27a'][i]), roughness: 0.8 })),
    [],
  )
  return (
    <group>
      {mats.map((mat, i) => (
        <mesh key={i} position={[-0.6 + (i % 2) * 1.2, (i < 2 ? 0.45 : -0.42) + (i % 2) * 0.05, 0.03]} rotation={[0, 0, (i - 1.5) * 0.08]} material={mat}>
          <planeGeometry args={[0.12, 0.12]} />
        </mesh>
      ))}
    </group>
  )
}

function Plant() {
  const m = useMats()
  const leaves = useMemo(() => {
    texSeed(9)
    return Array.from({ length: 14 }, () => [texRnd() * Math.PI * 2, 0.3 + texRnd() * 0.5, 0.4 + texRnd() * 0.6] as const)
  }, [])
  return (
    <group>
      <Cyl a={[0.18, 0.14, 0.35]} p={[0, 0.175, 0]} m={m.plastic('#e8e3d8', 0.4)} />
      {leaves.map(([a, tilt, h], i) => (
        <mesh key={i} position={[Math.cos(a) * 0.08, 0.35 + h * 0.3, Math.sin(a) * 0.08]} rotation={[tilt * Math.sin(a), a, tilt * Math.cos(a)]} material={m.plastic('#3f7d3a', 0.6)} castShadow>
          <coneGeometry args={[0.06, h, 4]} />
        </mesh>
      ))}
    </group>
  )
}

function WallScreen() {
  const m = useMats()
  const zone = useGame((s) => s.zone)
  const lines = zone === 1 ? ['SELENE-7 · ÉTAT', 'COQUE : BRÈCHE S-4', 'O₂ CABINE : 14 %', 'ÉVACUATION EN COURS'] : zone === 2 ? ['LABO-2 · CULTURES', 'TEMP 21.4°C', 'CO₂ 0.9 %', '▲ ALERTE RÉSEAU'] : ['HERMÈS · NAV', 'ORBITE LUNAIRE', 'Δv dispo 3.1 km/s', 'CIBLE : TERRE']
  return (
    <group>
      <Box s={[1.0, 0.6, 0.05]} p={[0, 0, 0.025]} m={m.plastic('#1b1d20', 0.3)} />
      <Screen w={0.92} h={0.52} p={[0, 0, 0.052]} lines={lines} fg={zone === 1 ? '#ffb38a' : '#7fe3ff'} />
    </group>
  )
}

/** faisceaux de tuyaux et chemins de câbles le long du plafond */
function Pipes({ scale = 10 }: { scale?: number }) {
  const m = useMats()
  const len = scale * 2
  return (
    <group position={[len / 2 - 1, 0, 0]}>
      <Cyl a={[0.06, 0.06, len]} p={[0, 2.58, -0.75]} r={[0, 0, Math.PI / 2]} m={m.painted('#b8b2a5', 0.4, 0.5)} seg={12} />
      <Cyl a={[0.04, 0.04, len]} p={[0, 2.62, -0.58]} r={[0, 0, Math.PI / 2]} m={m.painted('#3d6e8c', 0.4, 0.4)} seg={10} />
      <Cyl a={[0.035, 0.035, len]} p={[0, 2.55, 0.72]} r={[0, 0, Math.PI / 2]} m={m.painted('#c5532f', 0.4, 0.4)} seg={10} />
      <Box s={[len, 0.04, 0.3]} p={[0, 2.66, 0.6]} m={m.metal('#5d6166', 0.5)} />
      {Array.from({ length: Math.floor(scale) }).map((_, i) => (
        <Box key={i} s={[0.05, 0.22, 0.24]} p={[-len / 2 + i * 2 + 1, 2.69, -0.66]} m={m.metal('#4a4d52', 0.5)} />
      ))}
    </group>
  )
}

function PipesBig({ scale = 10 }: { scale?: number }) {
  const m = useMats()
  const len = scale * 2
  return (
    <group position={[len / 2 - 1, 0, 0]}>
      <Cyl a={[0.16, 0.16, len]} p={[0, 2.45, -0.6]} r={[0, 0, Math.PI / 2]} m={m.painted('#7c8188', 0.5, 0.7)} />
      <Cyl a={[0.1, 0.1, len]} p={[0, 2.2, -0.75]} r={[0, 0, Math.PI / 2]} m={m.painted('#9b5a2a', 0.5, 0.6)} />
      {Array.from({ length: Math.floor(scale / 1.5) }).map((_, i) => (
        <Cyl key={i} a={[0.19, 0.19, 0.08]} p={[-len / 2 + i * 3 + 1.5, 2.45, -0.6]} r={[0, 0, Math.PI / 2]} m={m.metal('#4a4d52', 0.4)} />
      ))}
    </group>
  )
}

function Sign({ color = '#ff6b35' }: { color?: string }) {
  const m = useMats()
  const mat = useMemo(() => {
    const t = textTexture(['◄ SAS  ·  ÉVACUATION ►'], { w: 512, h: 96, bg: '#14161a', fg: color, size: 40, align: 'center', glow: true, pad: 26 })
    return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 1.6 })
  }, [color])
  return (
    <group>
      <Box s={[1.1, 0.22, 0.04]} p={[0, 0, 0.02]} m={m.plastic('#14161a')} />
      <mesh position={[0, 0, 0.042]} material={mat}>
        <planeGeometry args={[1.05, 0.19]} />
      </mesh>
    </group>
  )
}

function Extinguisher() {
  const m = useMats()
  return (
    <group position={[0, 0, 0.12]}>
      <Cyl a={[0.09, 0.09, 0.5]} p={[0, 0.55, 0]} m={m.painted('#b8231c', 0.3, 0.4)} />
      <mesh position={[0, 0.82, 0]} material={m.painted('#b8231c', 0.3, 0.4)}>
        <sphereGeometry args={[0.09, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <Box s={[0.12, 0.06, 0.05]} p={[0, 0.9, 0]} m={m.metal('#2b2d30')} />
      <Box s={[0.26, 0.6, 0.02]} p={[0, 0.6, -0.11]} m={m.painted('#d8d3c6', 0.5, 0.2)} />
    </group>
  )
}

function Handrail() {
  const m = useMats()
  return (
    <group position={[0, 1.05, 0.1]}>
      <Cyl a={[0.025, 0.025, 1.6]} r={[0, 0, Math.PI / 2]} m={m.painted('#e0a92a', 0.4, 0.3)} seg={10} />
      {[-0.7, 0.7].map((x) => (
        <Box key={x} s={[0.04, 0.04, 0.1]} p={[x, 0, -0.05]} m={m.metal('#5d6166')} />
      ))}
    </group>
  )
}

function Crates() {
  const m = useMats()
  const c = m.painted('#5b6a52', 0.6, 0.2)
  const c2 = m.painted('#8a6b3a', 0.6, 0.2)
  return (
    <group>
      <Box s={[0.8, 0.6, 0.6]} p={[0, 0.3, 0]} m={c} />
      <Box s={[0.6, 0.45, 0.5]} p={[0.05, 0.825, 0.02]} r={[0, 0.2, 0]} m={c2} />
      <Box s={[0.82, 0.04, 0.62]} p={[0, 0.45, 0]} m={m.metal('#2d3034')} />
      <Box s={[0.5, 0.5, 0.5]} p={[0.75, 0.25, 0.1]} r={[0, -0.3, 0]} m={c} />
    </group>
  )
}

function Rack() {
  const m = useMats()
  const f = m.metal('#55595e', 0.45)
  return (
    <group>
      {[-0.85, 0.85].map((x) => (
        <Box key={x} s={[0.05, 2.2, 0.05]} p={[x, 1.1, 0.45]} m={f} />
      ))}
      {[0.3, 1.0, 1.7].map((y) => (
        <group key={y}>
          <Box s={[1.75, 0.03, 0.5]} p={[0, y, 0.25]} m={f} />
          <Box s={[0.4, 0.3, 0.35]} p={[-0.5, y + 0.17, 0.25]} m={m.painted('#7a8691', 0.6, 0.2)} />
          <Box s={[0.3, 0.22, 0.3]} p={[0.35, y + 0.13, 0.22]} m={m.painted('#a8763a', 0.6, 0.2)} />
        </group>
      ))}
    </group>
  )
}

function Debris() {
  const m = useMats()
  return (
    <group>
      <Box s={[0.4, 0.02, 0.3]} p={[0, 0.01, 0]} r={[0, 0.6, 0]} m={m.painted('#c8c1b4', 0.6, 0.2)} />
      <Box s={[0.2, 0.15, 0.2]} p={[0.4, 0.075, 0.3]} r={[0, 0.3, 0.2]} m={m.painted('#5b6a52', 0.6, 0.2)} />
      <Cyl a={[0.02, 0.02, 0.6]} p={[-0.3, 0.02, 0.3]} r={[0, 0.5, Math.PI / 2]} m={m.rubber('#222')} seg={6} />
    </group>
  )
}

function Medbed() {
  const m = useMats()
  return (
    <group>
      <Box s={[0.85, 0.08, 1.95]} p={[0, 0.72, 0]} m={m.painted('#d8dde0', 0.35, 0.3)} />
      <Box s={[0.8, 0.1, 1.85]} p={[0, 0.81, 0]} m={m.fabric('#9ccad8')} />
      <Box s={[0.6, 0.08, 0.35]} p={[0, 0.9, -0.7]} m={m.fabric('#f2f0ea')} />
      <Cyl a={[0.06, 0.1, 0.7]} p={[0, 0.35, 0]} m={m.metal('#8d9196')} />
      <Box s={[0.7, 0.04, 0.9]} p={[0, 0.02, 0]} m={m.metal('#6d7177')} />
      <Cyl a={[0.015, 0.015, 1.7]} p={[0.45, 0.85, -0.9]} m={m.metal('#b0b4b8', 0.25)} seg={8} />
      <Box s={[0.12, 0.2, 0.04]} p={[0.45, 1.6, -0.9]} m={m.glass('#d8f0ff', 0.6)} />
    </group>
  )
}

function Cabinet() {
  const m = useMats()
  return (
    <group>
      <Box s={[1.4, 0.9, 0.55]} p={[0, 0.45, 0.28]} m={m.painted('#e4e6e8', 0.4, 0.2)} />
      <Box s={[1.42, 0.03, 0.58]} p={[0, 0.915, 0.29]} m={m.plastic('#5f6870', 0.3)} />
      <Box s={[1.4, 0.7, 0.35]} p={[0, 2.0, 0.18]} m={m.painted('#e4e6e8', 0.4, 0.2)} />
      <Box s={[0.66, 0.6, 0.01]} p={[-0.35, 2.0, 0.36]} m={m.glass('#cfe8f2', 0.35)} />
      <mesh position={[0.35, 2.0, 0.36]} material={m.glow('#ff3344', 1.5)}>
        <planeGeometry args={[0.12, 0.12]} />
      </mesh>
    </group>
  )
}

function Monitor() {
  const m = useMats()
  const ref = useRef<THREE.Mesh>(null)
  const tex = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 256
    c.height = 128
    return { c, t: new THREE.CanvasTexture(c) }
  }, [])
  useFrame(({ clock }) => {
    const ctx = tex.c.getContext('2d')!
    ctx.fillStyle = '#04120c'
    ctx.fillRect(0, 0, 256, 128)
    ctx.strokeStyle = '#33ff88'
    ctx.lineWidth = 2
    ctx.beginPath()
    const t = clock.elapsedTime
    for (let x = 0; x < 256; x++) {
      const ph = (x / 256) * 3 + t * 0.8
      const f = ph % 1
      const y = 70 - (f > 0.45 && f < 0.5 ? 40 : f > 0.5 && f < 0.53 ? -20 : 0) + Math.sin(ph * 20) * 1.5
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.fillStyle = '#33ff88'
    ctx.font = '600 20px monospace'
    ctx.fillText('SpO₂ --', 160, 24)
    tex.t.needsUpdate = true
  })
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: tex.t, emissiveMap: tex.t, emissive: '#ffffff', emissiveIntensity: 1.3 }), [tex])
  return (
    <group>
      <Box s={[0.55, 0.36, 0.08]} p={[0, 0, 0.06]} m={m.plastic('#202326', 0.4)} />
      <mesh ref={ref} position={[0, 0, 0.102]} material={mat}>
        <planeGeometry args={[0.48, 0.28]} />
      </mesh>
      <Box s={[0.05, 0.05, 0.08]} p={[0, -0.2, 0.03]} m={m.metal('#5d6166')} />
    </group>
  )
}

/** combinaison EVA rangée au mur */
export function SuitRack() {
  const m = useMats()
  const suit = m.fabric('#e8e5dc')
  return (
    <group position={[0, 0, 0.3]}>
      <Box s={[0.9, 0.06, 0.3]} p={[0, 2.25, -0.1]} m={m.metal('#55595e')} />
      <mesh position={[0, 1.35, 0]} material={suit} castShadow>
        <capsuleGeometry args={[0.26, 0.45, 8, 16]} />
      </mesh>
      <mesh position={[0, 1.95, 0]} material={m.glass('#c79a3a', 0.85)} castShadow>
        <sphereGeometry args={[0.2, 24, 16]} />
      </mesh>
      <Box s={[0.5, 0.6, 0.22]} p={[0, 1.45, -0.25]} m={m.painted('#d6d2c8', 0.5, 0.2)} />
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * 0.36, 1.3, 0]} rotation={[0, 0, s * 0.15]} material={suit} castShadow>
            <capsuleGeometry args={[0.09, 0.5, 6, 12]} />
          </mesh>
          <mesh position={[s * 0.14, 0.6, 0]} material={suit} castShadow>
            <capsuleGeometry args={[0.11, 0.55, 6, 12]} />
          </mesh>
          <Box s={[0.18, 0.12, 0.28]} p={[s * 0.14, 0.18, 0.05]} m={m.rubber('#3a3c40')} />
        </group>
      ))}
      <Box s={[0.12, 0.08, 0.02]} p={[-0.12, 1.55, 0.27]} m={m.fabric('#d9673a')} />
    </group>
  )
}

function Hazard() {
  const tex = useMemo(
    () =>
      drawTexture(256, 256, (c) => {
        c.fillStyle = '#1b1c1e'
        c.fillRect(0, 0, 256, 256)
        c.strokeStyle = '#e0a92a'
        c.lineWidth = 18
        for (let i = -256; i < 512; i += 48) {
          c.beginPath()
          c.moveTo(i, 0)
          c.lineTo(i + 256, 256)
          c.stroke()
        }
        c.fillStyle = '#1b1c1e'
        c.fillRect(24, 24, 208, 208)
      }),
    [],
  )
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0]} receiveShadow>
      <planeGeometry args={[1.9, 1.9]} />
      <meshStandardMaterial map={tex} roughness={0.8} transparent alphaTest={0.01} />
    </mesh>
  )
}

/** gyrophare d'alerte */
function Beacon() {
  const m = useMats()
  const zone = useGame((s) => s.zone)
  const pressurized = useGame((s) => s.flags.pressurized)
  const color = zone === 1 && pressurized ? '#3cff8a' : '#ff5a1f'
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#000', emissive: color, emissiveIntensity: 3 }), [color])
  useFrame(({ clock }) => {
    mat.emissiveIntensity = 1 + Math.max(0, Math.sin(clock.elapsedTime * 6)) * 7
  })
  return (
    <group position={[0, 0, 0.12]}>
      <Cyl a={[0.08, 0.09, 0.06]} m={m.metal('#2d3034')} />
      <mesh position={[0, 0.08, 0]} material={mat}>
        <sphereGeometry args={[0.07, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  )
}

function LabBench() {
  const m = useMats()
  return (
    <group>
      <Box s={[1.9, 0.06, 0.75]} p={[0, 0.9, 0.38]} m={m.plastic('#2a2d31', 0.35)} />
      <Box s={[1.85, 0.85, 0.7]} p={[0, 0.43, 0.36]} m={m.painted('#d3d8db', 0.45, 0.2)} />
      {[-0.6, 0, 0.6].map((x) => (
        <Box key={x} s={[0.55, 0.22, 0.01]} p={[x, 0.7, 0.715]} m={m.painted('#bfc5c9', 0.45, 0.2)} />
      ))}
      <Box s={[1.9, 0.5, 0.3]} p={[0, 1.85, 0.15]} m={m.painted('#d3d8db', 0.45, 0.2)} />
      <mesh position={[0, 1.58, 0.2]} material={m.glow('#e8f6ff', 2.5)}>
        <boxGeometry args={[1.6, 0.02, 0.05]} />
      </mesh>
    </group>
  )
}

function Microscope() {
  const m = useMats()
  return (
    <group position={[0, 0, 0.35]}>
      <Box s={[0.22, 0.04, 0.28]} p={[0, 0.02, 0]} m={m.plastic('#e8e8e8')} />
      <Box s={[0.05, 0.3, 0.05]} p={[0, 0.17, -0.1]} m={m.plastic('#e8e8e8')} />
      <Cyl a={[0.025, 0.03, 0.22]} p={[0, 0.3, -0.03]} r={[0.5, 0, 0]} m={m.plastic('#2a2d31', 0.3)} seg={12} />
      <Box s={[0.12, 0.015, 0.12]} p={[0, 0.12, 0]} m={m.metal('#8d9196')} />
    </group>
  )
}

function Flasks() {
  const m = useMats()
  const cols = ['#3fd8f0', '#9bd93c', '#ff7a6b', '#f6e27a']
  return (
    <group position={[0, 0, 0.35]}>
      {cols.map((c, i) => (
        <group key={i} position={[-0.25 + i * 0.16, 0, (i % 2) * 0.1]}>
          <Cyl a={[0.025, 0.05, 0.12]} p={[0, 0.06, 0]} m={m.glass('#dff3ff', 0.35)} seg={14} />
          <Cyl a={[0.035, 0.048, 0.06]} p={[0, 0.03, 0]} m={m.glow(c, 0.8)} seg={14} />
        </group>
      ))}
    </group>
  )
}

function PlantRack({ movable = false }: { movable?: boolean }) {
  const m = useMats()
  const leaf = m.plastic('#4c8f3a', 0.65)
  const leaf2 = m.plastic('#2f6b2c', 0.65)
  const pos = useMemo(() => {
    texSeed(4)
    return Array.from({ length: 22 }, () => [texRnd() * 1.6 - 0.8, texRnd() * 0.3, texRnd()] as const)
  }, [])
  return (
    <group>
      {[0.55, 1.45].map((y) => (
        <group key={y} position={[0, y, 0.38]}>
          <Box s={[1.9, 0.18, 0.6]} m={m.painted('#e9ece8', 0.4, 0.2)} />
          <Box s={[1.85, 0.03, 0.55]} p={[0, 0.1, 0]} m={m.fabric('#3b2c1f')} />
          {pos.map(([x, z, s], i) => (
            <mesh key={i} position={[x, 0.18 + s * 0.1, z - 0.15]} material={i % 2 ? leaf : leaf2} castShadow>
              <sphereGeometry args={[0.07 + s * 0.06, 7, 5]} />
            </mesh>
          ))}
          <mesh position={[0, 0.6, 0]} material={m.glow('#ff5ad1', 3)}>
            <boxGeometry args={[1.7, 0.03, 0.08]} />
          </mesh>
        </group>
      ))}
      {[-0.95, 0.95].map((x) => (
        <Box key={x} s={[0.05, movable ? 2.06 : 2.2, 0.05]} p={[x, movable ? 1.17 : 1.1, 0.65]} m={m.metal('#8d9196')} />
      ))}
      {movable && <>
        <Box s={[1.95, 0.08, 0.65]} p={[0, 0.18, 0.35]} m={m.metal('#8d9196')} />
        {[-0.88, 0.88].flatMap((x) => [0.1, 0.6].map((z) => (
          <Cyl key={`${x}:${z}`} a={[0.09, 0.09, 0.07]} p={[x, 0.09, z]} r={[0, 0, Math.PI / 2]} m={m.rubber()} seg={16} />
        )))}
        <Screen w={0.58} h={0.1} p={[0, 0.55, 0.69]} lines={['POUSSER']} fg="#f3dfab" intensity={0.25} />
        <group position={[0, 0.55, 0.065]} rotation={[0, Math.PI, 0]}>
          <Screen w={0.58} h={0.1} lines={['POUSSER']} fg="#f3dfab" intensity={0.25} />
        </group>
      </>}
    </group>
  )
}

function Ladder() {
  const m = useMats()
  return (
    <group position={[0, 0, 0.25]}>
      {[-0.25, 0.25].map((x) => (
        <Box key={x} s={[0.05, 2.8, 0.05]} p={[x, 1.4, 0]} m={m.painted('#e0a92a', 0.4, 0.4)} />
      ))}
      {Array.from({ length: 9 }).map((_, i) => (
        <Cyl key={i} a={[0.018, 0.018, 0.5]} p={[0, 0.3 + i * 0.3, 0]} r={[0, 0, Math.PI / 2]} m={m.metal('#8d9196')} seg={8} />
      ))}
      <Box s={[0.9, 0.04, 0.9]} p={[0, 2.78, 0.2]} m={m.painted('#3a3d42', 0.4, 0.6)} />
    </group>
  )
}

function BrokenPipe() {
  const m = useMats()
  return (
    <group>
      <Cyl a={[0.09, 0.09, 1.2]} p={[0.4, 2.45, -0.75]} r={[0, 0, Math.PI / 2]} m={m.painted('#9b5a2a', 0.5, 0.6)} />
      <Cyl a={[0.09, 0.09, 0.6]} p={[-0.55, 2.35, -0.72]} r={[0, 0.2, Math.PI / 2 + 0.3]} m={m.painted('#9b5a2a', 0.5, 0.6)} />
      <Box s={[0.4, 0.02, 0.4]} p={[0, 0.01, -0.5]} r={[0, 0.4, 0]} m={m.metal('#5d6166')} />
    </group>
  )
}

function ElecCabinet() {
  const m = useMats()
  const on = useGame((s) => s.flags.power)
  return (
    <group>
      <Box s={[1.0, 2.0, 0.5]} p={[0, 1.0, 0.25]} m={m.painted('#5c646c', 0.5, 0.5)} />
      <Box s={[0.9, 1.8, 0.02]} p={[0, 1.0, 0.51]} m={m.painted('#68717a', 0.5, 0.5)} />
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} position={[-0.3 + (i % 3) * 0.3, 1.6 - Math.floor(i / 3) * 0.12, 0.525]} material={m.glow(on ? (i === 4 ? '#ffb020' : '#38ff7a') : i === 0 ? '#ff2a1a' : '#110000', on ? 2.5 : 3)}>
          <circleGeometry args={[0.018, 10]} />
        </mesh>
      ))}
      <Box s={[0.6, 0.05, 0.02]} p={[0, 0.5, 0.53]} m={m.painted('#e0a92a', 0.5, 0.2)} />
    </group>
  )
}

function Cables() {
  const m = useMats()
  const curves = useMemo(
    () =>
      [0, 1, 2].map((i) => {
        const pts = [new THREE.Vector3(-0.8, 2.7, -0.2 + i * 0.2), new THREE.Vector3(-0.2, 1.6 - i * 0.2, i * 0.15), new THREE.Vector3(0.5, 0.05, 0.3 + i * 0.1), new THREE.Vector3(1.2, 0.04, 0.6)]
        return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.025, 6)
      }),
    [],
  )
  return (
    <group>
      {curves.map((g, i) => (
        <mesh key={i} geometry={g} material={m.rubber(['#1b1c1e', '#2a2c2f', '#7a2a1e'][i])} castShadow />
      ))}
    </group>
  )
}

/** réacteur de la machinerie : cuve, anneaux lumineux pulsés */
function Reactor() {
  const m = useMats()
  const power = useGame((s) => s.flags.power)
  const glow = useMemo(() => new THREE.MeshStandardMaterial({ color: '#000', emissive: '#3ad7ff', emissiveIntensity: 4 }), [])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    glow.emissive.set(power ? '#3ad7ff' : '#ff3a1a')
    glow.emissiveIntensity = power ? 4 + Math.sin(t * 2) * 1.2 : 0.6 + Math.max(0, Math.sin(t * 1.3)) * 0.8
  })
  const body = m.painted('#5a5f66', 0.4, 0.8)
  return (
    <group>
      <Cyl a={[1.0, 1.1, 0.3]} p={[0, 0.15, 0]} m={m.metal('#3b3e42', 0.5)} seg={32} />
      <Cyl a={[0.8, 0.8, 2.0]} p={[0, 1.3, 0]} m={body} seg={32} />
      <Cyl a={[0.9, 0.8, 0.25]} p={[0, 2.45, 0]} m={m.metal('#3b3e42', 0.5)} seg={32} />
      {[0.7, 1.3, 1.9].map((y) => (
        <mesh key={y} position={[0, y, 0]} material={glow}>
          <cylinderGeometry args={[0.815, 0.815, 0.06, 32, 1, true]} />
        </mesh>
      ))}
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} s={[0.12, 2.2, 0.12]} p={[Math.cos((i * Math.PI) / 2 + 0.78) * 0.86, 1.2, Math.sin((i * Math.PI) / 2 + 0.78) * 0.86]} m={m.painted('#e0a92a', 0.5, 0.3)} />
      ))}
      <Cyl a={[0.15, 0.15, 0.5]} p={[0, 2.7, 0]} m={m.metal('#6d7177')} />
    </group>
  )
}

function Console() {
  const m = useMats()
  return (
    <group>
      <Box s={[1.6, 0.95, 0.6]} p={[0, 0.475, 0.3]} m={m.painted('#3c4046', 0.5, 0.6)} />
      <Box s={[1.6, 0.06, 0.55]} p={[0, 1.0, 0.32]} r={[0.35, 0, 0]} m={m.plastic('#1e2023', 0.35)} />
      {Array.from({ length: 12 }).map((_, i) => (
        <mesh key={i} position={[-0.6 + (i % 6) * 0.24, 1.04, 0.2 + Math.floor(i / 6) * 0.15]} rotation={[-Math.PI / 2 + 0.35, 0, 0]} material={m.glow(['#ffb020', '#38ff7a', '#3ad7ff'][i % 3], 2)}>
          <planeGeometry args={[0.08, 0.04]} />
        </mesh>
      ))}
    </group>
  )
}

function Grating() {
  const m = useMats()
  return (
    <group>
      <Box s={[2.4, 0.06, 3.6]} p={[0, 0.03, 0]} m={m.metal('#2d3034', 0.6)} />
      {[-1.2, 1.2].map((x) => (
        <Box key={x} s={[0.05, 1.0, 3.6]} p={[x, 0.5, 0]} m={m.painted('#e0a92a', 0.5, 0.3)} cast={false} />
      ))}
    </group>
  )
}

function PilotSeat() {
  const m = useMats()
  const shell = m.painted('#2f3237', 0.5, 0.6)
  const pad = m.fabric('#43362e')
  return (
    <group rotation={[0, Math.PI, 0]}>
      <Cyl a={[0.08, 0.12, 0.45]} p={[0, 0.22, 0]} m={m.metal('#55595e')} />
      <Box s={[0.6, 0.12, 0.6]} p={[0, 0.5, 0]} m={shell} />
      <Box s={[0.54, 0.1, 0.54]} p={[0, 0.58, 0]} m={pad} />
      <Box s={[0.6, 0.85, 0.12]} p={[0, 0.98, 0.28]} r={[-0.15, 0, 0]} m={shell} />
      <Box s={[0.52, 0.75, 0.06]} p={[0, 0.98, 0.21]} r={[-0.15, 0, 0]} m={pad} />
      <Box s={[0.3, 0.2, 0.1]} p={[0, 1.48, 0.33]} r={[-0.15, 0, 0]} m={pad} />
      {[-1, 1].map((s) => (
        <Box key={s} s={[0.06, 0.06, 0.5]} p={[s * 0.32, 0.75, 0.02]} m={shell} />
      ))}
      <Box s={[0.06, 0.65, 0.02]} p={[-0.15, 1.0, 0.17]} r={[-0.15, 0, 0.3]} m={m.fabric('#d9673a')} />
      <Box s={[0.06, 0.65, 0.02]} p={[0.15, 1.0, 0.17]} r={[-0.15, 0, -0.3]} m={m.fabric('#d9673a')} />
    </group>
  )
}

function SideConsole() {
  const m = useMats()
  return (
    <group>
      <Box s={[1.8, 1.0, 0.55]} p={[0, 0.5, 0.28]} m={m.painted('#2f3237', 0.5, 0.6)} />
      <Box s={[1.8, 0.05, 0.6]} p={[0, 1.02, 0.3]} r={[0.25, 0, 0]} m={m.plastic('#16181a', 0.3)} />
      <Screen w={0.5} h={0.3} p={[-0.45, 1.06, 0.3]} lines={['ALT 112 km', 'V 1.63 km/s']} fg="#ffb38a" />
      <Screen w={0.5} h={0.3} p={[0.45, 1.06, 0.3]} lines={['CABINE OK', 'P 101 kPa']} />
    </group>
  )
}

export function DockHatch() {
  const m = useMats()
  return (
    <group>
      <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]} material={m.painted('#4a4e54', 0.4, 0.7)} castShadow>
        <cylinderGeometry args={[0.85, 0.85, 0.1, 40]} />
      </mesh>
      <mesh position={[0, 0, 0.11]} material={m.painted('#7d8288', 0.45, 0.6)}>
        <circleGeometry args={[0.7, 40]} />
      </mesh>
      <mesh position={[0, 0, 0.14]} rotation={[0, 0, 0]} material={m.metal('#c0c4c8', 0.25)}>
        <torusGeometry args={[0.32, 0.03, 8, 30]} />
      </mesh>
      {[0, 1, 2].map((i) => (
        <Box key={i} s={[0.64, 0.05, 0.04]} p={[0, 0, 0.14]} r={[0, 0, (i * Math.PI) / 3]} m={m.metal('#c0c4c8', 0.25)} />
      ))}
      <mesh position={[0, 0.9, 0.12]} material={m.glow('#38ff7a', 3)}>
        <boxGeometry args={[0.3, 0.04, 0.02]} />
      </mesh>
    </group>
  )
}

function CrewSeats() {
  const m = useMats()
  return (
    <group>
      {[-0.6, 0.6].map((x) => (
        <group key={x} position={[x, 0, 0.35]}>
          <Box s={[0.55, 0.1, 0.5]} p={[0, 0.48, 0]} m={m.fabric('#43362e')} />
          <Box s={[0.55, 0.8, 0.1]} p={[0, 0.9, -0.25]} m={m.fabric('#43362e')} />
          <Box s={[0.6, 0.45, 0.5]} p={[0, 0.22, 0]} m={m.painted('#2f3237', 0.5, 0.6)} />
        </group>
      ))}
    </group>
  )
}

function EngineCore() {
  const m = useMats()
  const engine = useGame((s) => s.flags.engine)
  const glow = useMemo(() => new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ff8a3a', emissiveIntensity: 1 }), [])
  useFrame(({ clock }) => {
    glow.emissive.set(engine ? '#7fd8ff' : '#ff5a1a')
    glow.emissiveIntensity = engine ? 5 + Math.sin(clock.elapsedTime * 5) : 0.4
  })
  return (
    <group>
      <mesh position={[0, 1.2, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.painted('#4a4e54', 0.4, 0.8)} castShadow>
        <cylinderGeometry args={[0.65, 0.75, 2.2, 32]} />
      </mesh>
      {[-0.6, 0, 0.6].map((z) => (
        <mesh key={z} position={[0, 1.2, z]} rotation={[Math.PI / 2, 0, 0]} material={glow}>
          <cylinderGeometry args={[0.7, 0.7, 0.05, 32, 1, true]} />
        </mesh>
      ))}
      <Box s={[1.6, 0.3, 2.2]} p={[0, 0.15, 0]} m={m.metal('#2d3034', 0.5)} />
    </group>
  )
}

export const PROP_MODELS: Record<string, (p: { color?: string; scale?: number; movable?: boolean }) => ReactNode> = {
  toolChest: () => <RealModel id="metal_tool_chest" solid fit="wall" height={1.05} />,
  toolCart: () => <RealModel id="tool_cart" solid height={0.95} />,
  generator: () => <RealModel id="portable_generator" solid height={0.6} />,
  camera: () => <RealModel id="security_camera_01" fit="wall" height={0.25} />,
  utilityBox: () => <RealModel id="utility_box_01" fit="wall" height={0.55} />,
  stool: () => <RealModel id="metal_stool_01" solid height={0.65} />,
  clock: () => <RealModel id="alarm_clock_01" height={0.12} />,
  seeding: () => <RealModel id="seeding_tray_01" height={0.1} />,
  container: () => <RealModel id="industrial_pastic_container" solid height={1.0} />,
  bunk: () => <Bunk />,
  shelf: () => <Shelf />,
  photos: () => <Photos />,
  toy: () => <Toy />,
  sockets: () => <Sockets />,
  personalLocker: () => <PersonalLocker />,
  holoProjector: () => <HoloProjector />,
  table: () => <Table />,
  mugs: () => <Mugs />,
  counter: () => <Counter />,
  postits: () => <Postits />,
  plant: () => <Plant />,
  screen: () => <WallScreen />,
  pipes: (p) => <Pipes scale={p.scale} />,
  pipesBig: (p) => <PipesBig scale={p.scale} />,
  sign: (p) => <Sign color={p.color} />,
  extinguisher: () => <Extinguisher />,
  handrail: () => <Handrail />,
  crates: () => <Crates />,
  rack: () => <Rack />,
  debris: () => <Debris />,
  medbed: () => <Medbed />,
  cabinet: () => <Cabinet />,
  monitor: () => <Monitor />,
  suitRack: () => <SuitRack />,
  hazard: () => <Hazard />,
  beacon: () => <Beacon />,
  labBench: () => <LabBench />,
  microscope: () => <Microscope />,
  flasks: () => <Flasks />,
  plantRack: (p) => <PlantRack movable={p.movable} />,
  ladder: () => <Ladder />,
  brokenPipe: () => <BrokenPipe />,
  elecCabinet: () => <ElecCabinet />,
  cables: () => <Cables />,
  reactor: () => <Reactor />,
  console: () => <Console />,
  grating: () => <Grating />,
  pilotSeat: () => <PilotSeat />,
  sideConsole: () => <SideConsole />,
  dockHatch: () => <DockHatch />,
  crewSeats: () => <CrewSeats />,
  engineCore: () => <EngineCore />,
}
