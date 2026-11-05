import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { CEIL } from '../../game/maps'
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
    const radius = Math.min(soft ? 0.065 : 0.028, Math.min(...s) * (soft ? 0.42 : 0.3))
    geometry = Math.min(...s) < 0.018 ? new THREE.BoxGeometry(...s) : new RoundedBoxGeometry(...s, soft ? 3 : 2, radius)
    boxGeometries.set(key, geometry)
  }
  return (
    <mesh position={p} rotation={r} geometry={geometry} material={m} castShadow={cast} receiveShadow dispose={null} />
  )
}
/** Box with the small original bevel, for the fine first-person gloves and held objects. */
export function BoxExact({ s, p = [0, 0, 0], r, m, cast = true }: { s: [number, number, number]; p?: [number, number, number]; r?: [number, number, number]; m: M; cast?: boolean }) {
  const soft = !!m.userData.fabric
  const key = `exact:${s.join(':')}:${soft}`
  let geometry = boxGeometries.get(key)
  if (!geometry) {
    const radius = Math.min(soft ? 0.065 : 0.014, Math.min(...s) * (soft ? 0.42 : 0.2))
    geometry = Math.min(...s) < 0.018 ? new THREE.BoxGeometry(...s) : new RoundedBoxGeometry(...s, soft ? 2 : 1, radius)
    boxGeometries.set(key, geometry)
  }
  return <mesh position={p} rotation={r} geometry={geometry} material={m} castShadow={cast} receiveShadow dispose={null} />
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
      {[0.5, 0.8, 1.1].map((y) => <Cyl key={y} a={[0.012, 0.012, 0.32]} p={[0.8, y, 0.95]} r={[0, 0, Math.PI / 2]} m={m.metal('#a9aeb2', 0.3)} seg={10} />)}
      {[0.64, 0.96].map((x) => <Cyl key={x} a={[0.014, 0.014, 1.3]} p={[x, 0.68, 0.95]} m={m.metal('#a9aeb2', 0.3)} seg={10} />)}
      <Screen w={0.22} h={0.14} p={[-0.7, 1.95, 0.02]} lines={['LÉO', '♥ 62 bpm']} intensity={0.8} />
    </group>
  )
}

/** A book: two boards, a rounded spine and a block of pages. */
function Book({ x, h = 0.22, d = 0.15, t = 0.035, color, tilt = 0 }: { x: number; h?: number; d?: number; t?: number; color: string; tilt?: number }) {
  const m = useMats()
  const cover = m.plastic(color, 0.6)
  return <group position={[x, 0, 0.13]} rotation={[0, 0, tilt]}>
    <Box s={[t - 0.006, h - 0.008, d - 0.008]} p={[0, h / 2, 0.002]} m={m.plastic('#e6e0cf', 0.8)} />
    {[-1, 1].map((k) => <Box key={k} s={[0.004, h, d]} p={[k * (t / 2 - 0.002), h / 2, 0]} m={cover} />)}
    <Cyl a={[t / 2, t / 2, h]} p={[0, h / 2, d / 2]} m={cover} seg={12} />
    <Box s={[t + 0.002, 0.012, 0.002]} p={[0, h * 0.78, d / 2 + t / 2 - 0.002]} m={m.metal('#c7a24e', 0.3)} />
  </group>
}

/** Bedside wall shelf: curved brackets, a charging cradle for the flashlight, books between bookends. */
function Shelf() {
  const m = useMats()
  const steel = m.metal('#8d9196', 0.3)
  return (
    <group>
      <Box s={[1.25, 0.032, 0.3]} p={[0, -0.016, 0.15]} m={m.painted('#6f747a', 0.38, 0.5)} />
      <Box s={[1.25, 0.012, 0.012]} p={[0, 0.006, 0.296]} m={steel} />
      {[-0.5, 0.5].map((x) => <group key={x}>
        <Box s={[0.03, 0.2, 0.012]} p={[x, -0.13, 0.008]} m={steel} />
        <Cyl a={[0.008, 0.008, 0.3]} p={[x, -0.115, 0.1]} r={[-0.82, 0, 0]} m={steel} seg={10} />
      </group>)}
      {/* Charging cradle. */}
      <Box s={[0.28, 0.018, 0.09]} p={[0, 0.009, 0.14]} m={m.plastic('#24272a', 0.4)} />
      {[-0.09, 0.09].map((x) => <mesh key={x} position={[x, 0.034, 0.14]} rotation={[Math.PI / 2, 0, 0]} material={steel}>
        <torusGeometry args={[0.024, 0.003, 6, 16, Math.PI]} />
      </mesh>)}
      <mesh position={[0.125, 0.019, 0.17]} rotation={[-Math.PI / 2, 0, 0]} material={m.glow('#58e08a', 2.2)}><circleGeometry args={[0.005, 10]} /></mesh>
      {/* Books between two bookends. */}
      <Book x={0.3} color="#7a3b2a" />
      <Book x={0.34} color="#2c5a7a" h={0.2} />
      <Book x={0.382} color="#3e4a3c" h={0.24} t={0.042} />
      <Book x={0.425} color="#8a6b3a" h={0.19} t={0.03} />
      <Book x={0.468} color="#4a3f5c" h={0.21} tilt={-0.1} />
      <Box s={[0.006, 0.14, 0.11]} p={[0.268, 0.07, 0.14]} m={steel} />
      <RealModel id="standing_picture_frame_01" height={0.2} shadows={false} p={[-0.5, 0, 0.13]} r={Math.PI} />
    </group>
  )
}

/** Soft fade along a beam: bright at the lens, gone at the far end. */
function beamTexture() {
  const c = document.createElement('canvas')
  c.width = 4
  c.height = 128
  const ctx = c.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, 128)
  g.addColorStop(0, 'rgba(255,255,255,0)')
  g.addColorStop(1, 'rgba(255,255,255,1)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 4, 128)
  return new THREE.CanvasTexture(c)
}

/** Straight torch: tail at y = 0, lens at the top looking along +y. Machined body with an orange grip, readable even in a dark room. */
export function Flashlight({ on = false }: { on?: boolean }) {
  const mats = useMemo(() => {
    const std = (color: string, metalness: number, roughness: number, glow = 0.1) => new THREE.MeshStandardMaterial({ color, metalness, roughness, emissive: color, emissiveIntensity: glow })
    return {
      body: std('#aeb6bc', 0.55, 0.42),
      dark: std('#3a4046', 0.6, 0.5),
      grip: std('#e8662a', 0, 0.8, 0.16),
      steel: std('#dfe4e7', 0.8, 0.22),
      reflector: std('#f2f4f5', 0.9, 0.12),
      glass: new THREE.MeshStandardMaterial({ color: '#d9e6ec', metalness: 0.1, roughness: 0.08, transparent: true, opacity: 0.35 }),
      lens: new THREE.MeshBasicMaterial({ color: '#fff3d6', toneMapped: false }),
      beam: new THREE.MeshBasicMaterial({ map: beamTexture(), color: '#ffe9c2', transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
    }
  }, [])
  return (
    <group name="flashlight">
      {/* Tail cap, barrel and flared head, turned as one piece. */}
      <Lathe m={mats.dark} seg={28} profile={[[0, 0], [0.015, 0], [0.0175, 0.003], [0.0175, 0.024], [0.016, 0.027], [0, 0.027]]} />
      <Lathe m={mats.body} seg={28} profile={[[0.016, 0.027], [0.016, 0.128], [0.0185, 0.134], [0.027, 0.158], [0.0285, 0.176], [0.024, 0.178], [0.022, 0.15], [0, 0.15]]} />
      {/* Rubber grip where the fist closes, with raised ribs. */}
      <Cyl a={[0.0172, 0.0172, 0.07]} p={[0, 0.08, 0]} m={mats.grip} seg={28} />
      {[0.054, 0.067, 0.08, 0.093, 0.106].map((y) => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.grip}>
        <torusGeometry args={[0.0176, 0.0013, 6, 26]} />
      </mesh>)}
      {/* Knurled tail and steel collars. */}
      {[0.007, 0.013, 0.019].map((y) => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.steel}>
        <torusGeometry args={[0.0176, 0.0009, 6, 26]} />
      </mesh>)}
      <mesh position={[0, 0.123, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.steel}><torusGeometry args={[0.0165, 0.0014, 8, 26]} /></mesh>
      <mesh position={[0, 0.177, 0]} rotation={[Math.PI / 2, 0, 0]} material={mats.steel}><torusGeometry args={[0.0265, 0.0024, 8, 30]} /></mesh>
      {/* Reflector, then the lens: glass when off, lit when on. */}
      <Lathe m={mats.reflector} seg={28} profile={[[0.006, 0.152], [0.024, 0.175]]} />
      <mesh position={[0, 0.175, 0]} rotation={[-Math.PI / 2, 0, 0]} material={on ? mats.lens : mats.glass}><circleGeometry args={[0.0245, 30]} /></mesh>
      {/* Switch on the barrel, under the thumb. */}
      <Box s={[0.011, 0.018, 0.005]} p={[0, 0.118, 0.0172]} m={mats.dark} />
      <Box s={[0.007, 0.012, 0.003]} p={[0, 0.118, 0.0205]} m={on ? mats.lens : mats.grip} />
      {/* The beam, visible in the air when lit. */}
      {on && <mesh position={[0, 0.176 + 0.25, 0]} material={mats.beam}><cylinderGeometry args={[0.12, 0.024, 0.5, 24, 1, true]} /></mesh>}
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
  const front = m.painted('#74808c', 0.4, 0.55)
  return (
    <group>
      <Box s={[0.58, 2.0, 0.53]} p={[0, 1.0, 0.265]} m={m.painted('#6a7480', 0.45, 0.5)} />
      <Box s={[0.54, 1.9, 0.022]} p={[0, 1.0, 0.54]} m={front} />
      {[1.78, 1.72, 1.66, 1.6].map((y) => <Box key={y} s={[0.3, 0.018, 0.01]} p={[0, y, 0.554]} m={m.rubber()} />)}
      <Pull p={[0.19, 1.05, 0.551]} length={0.1} />
      <Box s={[0.14, 0.05, 0.006]} p={[0, 1.42, 0.553]} m={m.plastic('#e8e4d6', 0.4)} />
      {[0.3, 0.7, 1.3, 1.7].map((y) => <Cyl key={y} a={[0.009, 0.009, 0.02]} p={[-0.272, y, 0.54]} m={m.metal('#a9aeb2')} seg={8} />)}
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

/** Rounded slab, used for table tops: a soft outline instead of a box. */
function useSlab(w: number, d: number, radius: number, thick: number) {
  return useMemo(() => {
    const x = w / 2 - radius, z = d / 2 - radius
    const shape = new THREE.Shape()
    shape.moveTo(-x, -d / 2)
    shape.lineTo(x, -d / 2); shape.absarc(x, -z, radius, -Math.PI / 2, 0, false)
    shape.lineTo(w / 2, z); shape.absarc(x, z, radius, 0, Math.PI / 2, false)
    shape.lineTo(-x, d / 2); shape.absarc(-x, z, radius, Math.PI / 2, Math.PI, false)
    shape.lineTo(-w / 2, -z); shape.absarc(-x, -z, radius, Math.PI, Math.PI * 1.5, false)
    const g = new THREE.ExtrudeGeometry(shape, { depth: thick - 0.016, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 10 })
    g.rotateX(-Math.PI / 2)
    return g
  }, [w, d, radius, thick])
}

/** Bar handle on two standoffs, along local x. */
function Pull({ p, length = 0.16 }: { p: [number, number, number]; length?: number }) {
  const m = useMats()
  const steel = m.metal('#b8bcc0', 0.25)
  return <group position={p}>
    <Cyl a={[0.007, 0.007, length]} p={[0, 0, 0.024]} r={[0, 0, Math.PI / 2]} m={steel} seg={10} />
    {[-1, 1].map((k) => <Cyl key={k} a={[0.005, 0.005, 0.026]} p={[k * length * 0.38, 0, 0.012]} r={[Math.PI / 2, 0, 0]} m={steel} seg={8} />)}
  </group>
}

/** Fitted cupboard front: recessed plinth, body, and doors with real gaps and pulls. */
function Units({ w, h, d, doors, body, front }: { w: number; h: number; d: number; doors: number; body: M; front: M }) {
  const m = useMats()
  const dw = (w - 0.03) / doors
  return <group>
    <Box s={[w - 0.02, 0.1, d - 0.06]} p={[0, 0.05, (d - 0.06) / 2]} m={m.rubber('#17191b')} />
    <Box s={[w, h - 0.1, d]} p={[0, 0.1 + (h - 0.1) / 2, d / 2]} m={body} />
    {Array.from({ length: doors }, (_, i) => {
      const x = -w / 2 + 0.015 + dw * (i + 0.5)
      return <group key={i}>
        <Box s={[dw - 0.014, h - 0.14, 0.022]} p={[x, 0.1 + (h - 0.1) / 2, d + 0.008]} m={front} />
        <Pull p={[x, h - 0.1, d + 0.019]} />
      </group>
    })}
  </group>
}

function Table() {
  const m = useMats()
  const top = useSlab(1.7, 0.85, 0.14, 0.045)
  const leg = m.metal('#6d7177', 0.4)
  return (
    <group>
      <mesh geometry={top} position={[0, 0.745, 0]} material={m.painted('#d6d2c8', 0.35, 0.1)} castShadow receiveShadow />
      <Cyl a={[0.34, 0.34, 0.012]} p={[0, 0.738, 0]} m={leg} seg={32} />
      <Cyl a={[0.045, 0.06, 0.7]} p={[0, 0.38, 0]} m={leg} seg={24} />
      <Cyl a={[0.08, 0.3, 0.04]} p={[0, 0.03, 0]} m={leg} seg={32} />
      <Cyl a={[0.3, 0.32, 0.012]} p={[0, 0.006, 0]} m={m.rubber()} seg={32} />
    </group>
  )
}

/** Ceramic mug: walled body with a rolled rim, curved handle, and coffee inside. */
function Mug({ p, color, r = 0 }: { p: [number, number, number]; color: string; r?: number }) {
  const m = useMats()
  const ceramic = useMemo(() => {
    const c = m.plastic(color, 0.22).clone()
    c.side = THREE.DoubleSide
    return c
  }, [m.plastic(color, 0.22)])
  useEffect(() => () => ceramic.dispose(), [ceramic])
  return <group position={p} rotation={[0, r, 0]}>
    <Lathe m={ceramic} seg={28} profile={[[0, 0.002], [0.026, 0.002], [0.031, 0.005], [0.0345, 0.016], [0.036, 0.05], [0.036, 0.085], [0.0375, 0.09], [0.036, 0.094], [0.032, 0.09], [0.032, 0.012], [0, 0.009]]} />
    <Cyl a={[0.0318, 0.0318, 0.002]} p={[0, 0.074, 0]} m={m.plastic('#2c1a10', 0.18)} seg={24} />
    <mesh position={[0.046, 0.05, 0]} rotation={[0, 0, -Math.PI / 2]} scale={[1, 0.72, 1]} material={ceramic} castShadow>
      <torusGeometry args={[0.022, 0.005, 10, 18, Math.PI]} />
    </mesh>
  </group>
}

function Mugs() {
  return (
    <group>
      <Mug p={[-0.07, 0, 0.02]} color="#e9e6dd" r={0.5} />
      <Mug p={[0.09, 0, -0.04]} color="#2a6bb3" r={2.5} />
    </group>
  )
}

function Counter({ sink = false, upper = true }: { sink?: boolean; upper?: boolean }) {
  const m = useMats()
  const body = m.painted('#b9b3a6', 0.5, 0.2), front = m.painted('#a59f92', 0.42, 0.25)
  const steel = m.metal('#a7abb0', 0.25)
  return (
    <group>
      <Units w={2} h={0.9} d={0.58} doors={3} body={body} front={front} />
      <Box s={[2, 0.04, 0.64]} p={[0, 0.92, 0.32]} m={steel} />
      <Box s={[2, 0.5, 0.012]} p={[0, 1.19, 0.008]} m={steel} />
      {sink && <>
        <Box s={[0.56, 0.012, 0.38]} p={[-0.3, 0.942, 0.32]} m={m.metal('#6d7176', 0.3)} />
        <Cyl a={[0.025, 0.025, 0.006]} p={[-0.3, 0.95, 0.32]} m={m.rubber()} seg={16} />
        <Cyl a={[0.012, 0.016, 0.16]} p={[-0.3, 1.02, 0.1]} m={steel} seg={12} />
        <Cyl a={[0.009, 0.009, 0.16]} p={[-0.3, 1.095, 0.17]} r={[Math.PI / 2, 0, 0]} m={steel} seg={10} />
        <Cyl a={[0.009, 0.009, 0.04]} p={[-0.3, 1.075, 0.25]} m={steel} seg={10} />
      </>}
      {upper && <>
        <Box s={[2, 0.6, 0.33]} p={[0, 2.1, 0.165]} m={body} />
        {[-0.67, 0, 0.67].map((x) => <group key={x}>
          <Box s={[0.645, 0.57, 0.02]} p={[x, 2.1, 0.338]} m={front} />
          <Pull p={[x, 1.86, 0.348]} />
        </group>)}
        <mesh position={[0, 1.79, 0.2]} material={m.glow('#fff1de', 1.4)}><boxGeometry args={[1.8, 0.012, 0.05]} /></mesh>
      </>}
    </group>
  )
}

/** Kitchen fridge: rounded body, two doors, long pulls and a gasket line. */
function Fridge() {
  const m = useMats()
  const white = m.painted('#d9dbdc', 0.32, 0.3)
  return (
    <group>
      <Box s={[0.72, 0.08, 0.6]} p={[0, 0.04, 0.3]} m={m.rubber('#17191b')} />
      <Box s={[0.76, 1.86, 0.6]} p={[0, 1.0, 0.3]} m={white} />
      <Box s={[0.74, 1.22, 0.05]} p={[0, 0.72, 0.625]} m={white} />
      <Box s={[0.74, 0.58, 0.05]} p={[0, 1.61, 0.625]} m={white} />
      <Box s={[0.72, 0.012, 0.02]} p={[0, 1.33, 0.63]} m={m.rubber()} />
      {[[0.98, 0.5], [1.5, 0.28]].map(([y, h]) => <group key={y} position={[-0.29, y, 0.65]}>
        <Cyl a={[0.009, 0.009, h]} p={[0, 0, 0.03]} m={m.metal('#c4c8cb', 0.2)} seg={10} />
        {[-1, 1].map((k) => <Cyl key={k} a={[0.006, 0.006, 0.03]} p={[0, k * h * 0.4, 0.015]} r={[Math.PI / 2, 0, 0]} m={m.metal('#c4c8cb', 0.2)} seg={8} />)}
      </group>)}
      <Screen w={0.12} h={0.06} p={[0.2, 1.72, 0.652]} lines={['+4 C']} fg="#9fd0ff" intensity={0.6} />
    </group>
  )
}

/** Pedal bin. */
function Bin() {
  const m = useMats()
  return (
    <group>
      <Cyl a={[0.15, 0.13, 0.5]} p={[0, 0.27, 0]} m={m.metal('#8a8f94', 0.3)} seg={28} />
      <Cyl a={[0.152, 0.152, 0.03]} p={[0, 0.53, 0]} m={m.plastic('#24272a', 0.4)} seg={28} />
      <Cyl a={[0.14, 0.14, 0.02]} p={[0, 0.01, 0]} m={m.rubber()} seg={24} />
    </group>
  )
}

/** Service run along a wall: flanged pipes on clamps, junction boxes, colour bands and sagging cables. */
function Conduit({ scale = 6 }: { scale?: number }) {
  const m = useMats()
  const parts = useMemo(() => {
    const pipes: THREE.BufferGeometry[] = [], clamps: THREE.BufferGeometry[] = [], bands: THREE.BufferGeometry[] = []
    const cables: THREE.BufferGeometry[] = [], boxes: THREE.BufferGeometry[] = []
    const half = scale / 2
    const tube = (r: number, length: number, x: number, y: number, z: number) => {
      const g = new THREE.CylinderGeometry(r, r, length, 14)
      g.rotateZ(Math.PI / 2); g.translate(x, y, z)
      return g
    }
    pipes.push(tube(0.042, scale, 0, 0, 0.105), tube(0.026, scale, 0, 0.085, 0.085))
    // Flanged joints, with their bolts' ring, and colour bands identifying what each pipe carries.
    for (let x = -half + 1.2; x < half; x += 2.4) {
      pipes.push(tube(0.062, 0.022, x - 0.012, 0, 0.105), tube(0.062, 0.022, x + 0.012, 0, 0.105))
      bands.push(tube(0.0435, 0.1, x + 0.26, 0, 0.105), tube(0.0275, 0.08, x - 0.3, 0.085, 0.085))
    }
    const count = Math.max(2, Math.round(scale / 1.2))
    const clampAt: number[] = []
    for (let i = 0; i <= count; i++) {
      const x = -half + scale * i / count
      clampAt.push(x)
      const band = new THREE.TorusGeometry(0.047, 0.006, 6, 18)
      band.rotateY(Math.PI / 2); band.translate(x, 0, 0.105)
      const bar = new THREE.CylinderGeometry(0.009, 0.009, 0.08, 8)
      bar.rotateX(Math.PI / 2); bar.translate(x, 0, 0.04)
      const foot = new THREE.BoxGeometry(0.05, 0.2, 0.012)
      foot.translate(x, 0.02, 0.006)
      clampAt.length && clamps.push(band.toNonIndexed(), bar.toNonIndexed(), foot.toNonIndexed())
    }
    // Junction boxes, and cables that hang slightly between their clips.
    for (let x = -half + 2.4; x < half - 0.6; x += 3.6) {
      const box = new THREE.BoxGeometry(0.22, 0.18, 0.06)
      box.translate(x, -0.16, 0.035)
      boxes.push(box)
    }
    for (const [offset, sag, radius] of [[-0.09, 0.07, 0.006], [-0.115, 0.05, 0.008], [-0.14, 0.085, 0.005]] as const) {
      for (let i = 0; i < clampAt.length - 1; i++) {
        const a = clampAt[i], b = clampAt[i + 1], mid = (a + b) / 2
        const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(a, offset, 0.03), new THREE.Vector3((a + mid) / 2, offset - sag * 0.75, 0.04), new THREE.Vector3(mid, offset - sag, 0.045), new THREE.Vector3((mid + b) / 2, offset - sag * 0.75, 0.04), new THREE.Vector3(b, offset, 0.03)])
        cables.push(new THREE.TubeGeometry(curve, 12, radius, 6))
      }
    }
    const merge = (list: THREE.BufferGeometry[]) => mergeGeometries(list.map((g) => g.index ? g.toNonIndexed() : g))
    return { pipes: merge(pipes), clamps: mergeGeometries(clamps), bands: merge(bands), cables: merge(cables), boxes: boxes.length ? merge(boxes) : null }
  }, [scale])
  useEffect(() => () => Object.values(parts).forEach((g) => g?.dispose()), [parts])
  return <group>
    <mesh geometry={parts.pipes} material={m.metal('#8c9499', 0.34)} castShadow />
    <mesh geometry={parts.clamps} material={m.painted('#3c4348', 0.45, 0.6)} />
    <mesh geometry={parts.bands} material={m.painted('#2a6bb3', 0.45, 0.2)} />
    <mesh geometry={parts.cables} material={m.rubber('#1b1c1e')} />
    {parts.boxes && <mesh geometry={parts.boxes} material={m.painted('#596168', 0.4, 0.55)} />}
  </group>
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
  return <RealModel id="potted_plant_02" solid height={0.58} />
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
/** Corridor ceiling services: a run on each wall, flanked the same way as in the rooms. */
function Pipes({ scale = 10 }: { scale?: number }) {
  const len = scale * 2
  return (
    <group position={[len / 2 - 1, 0, 0]}>
      <group position={[0, 2.5, -0.98]}><Conduit scale={len} /></group>
      <group position={[0, 2.5, 0.98]} rotation={[0, Math.PI, 0]}><Conduit scale={len} /></group>
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

/** Fire point: a real extinguisher in its wall bracket, under a backlit sign. */
function Extinguisher() {
  const m = useMats()
  return (
    <group>
      <Box s={[0.3, 0.86, 0.015]} p={[0, 0.78, 0.008]} m={m.painted('#d8d3c6', 0.5, 0.2)} />
      <RealModel id="korean_fire_extinguisher_01" fit="wall" height={0.66} p={[0, 0.44, 0.02]} />
      <Box s={[0.08, 0.05, 0.05]} p={[0, 0.9, 0.04]} m={m.metal('#2b2d30')} />
      <Box s={[0.24, 0.022, 0.02]} p={[0, 0.72, 0.13]} m={m.rubber()} />
      <group position={[0, 1.38, 0.012]}>
        <Box s={[0.26, 0.26, 0.02]} m={m.painted('#b8231c', 0.35, 0.2)} />
        <Screen w={0.22} h={0.22} p={[0, 0, 0.012]} lines={['FEU', 'EXT.']} fg="#ffffff" bg="#b8231c" intensity={0.5} />
      </group>
    </group>
  )
}

/** Bed-head service panel: gas outlets, sockets and a call button. */
function MedWall() {
  const m = useMats()
  return (
    <group>
      <Box s={[1.5, 0.3, 0.05]} p={[0, 0, 0.025]} m={m.painted('#d4d8db', 0.35, 0.3)} />
      {[[-0.5, '#2f8a4a'], [-0.32, '#d8dce0'], [-0.14, '#2a6bb3']].map(([x, c]) => <group key={x as number} position={[x as number, 0, 0.05]}>
        <Cyl a={[0.04, 0.04, 0.016]} p={[0, 0, 0.008]} r={[Math.PI / 2, 0, 0]} m={m.plastic(c as string, 0.35)} seg={20} />
        <Cyl a={[0.012, 0.012, 0.03]} p={[0, 0, 0.022]} r={[Math.PI / 2, 0, 0]} m={m.metal('#c0c4c8', 0.25)} seg={10} />
      </group>)}
      {[0.12, 0.28].map((x) => <Box key={x} s={[0.12, 0.12, 0.012]} p={[x, 0, 0.056]} m={m.plastic('#eef0f1', 0.35)} />)}
      <mesh position={[0.52, 0, 0.056]} material={m.glow('#ff5a4a', 1.4)}><circleGeometry args={[0.03, 16]} /></mesh>
    </group>
  )
}

/** Privacy curtain on a ceiling rail, with real folds, running from the wall into the room. */
function Curtain() {
  const m = useMats()
  const LENGTH = 2.3, HEIGHT = 2.05
  const cloth = useMemo(() => {
    const g = new THREE.PlaneGeometry(LENGTH, HEIGHT, 72, 4)
    g.rotateY(Math.PI / 2)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const z = p.getZ(i), y = p.getY(i)
      p.setX(i, Math.sin(z * 15) * (0.03 + (HEIGHT / 2 - y) * 0.012))
    }
    g.computeVertexNormals()
    g.translate(0, 0.35 + HEIGHT / 2, LENGTH / 2)
    return g
  }, [])
  const fabric = m.fabric('#8fb5bd')
  fabric.side = THREE.DoubleSide
  return (
    <group>
      <mesh geometry={cloth} material={fabric} castShadow receiveShadow />
      <Cyl a={[0.012, 0.012, LENGTH + 0.05]} p={[0, 2.44, LENGTH / 2]} r={[Math.PI / 2, 0, 0]} m={m.metal('#a9aeb2', 0.28)} seg={10} />
      <Cyl a={[0.008, 0.008, 0.34]} p={[0, 2.62, LENGTH]} m={m.metal('#a9aeb2', 0.28)} seg={8} />
    </group>
  )
}

/** Hand-wash station: ceramic basin on brackets, tap, trap, mirror, soap. */
function WashBasin() {
  const m = useMats()
  const ceramic = m.plastic('#eef1f2', 0.18)
  const steel = m.metal('#c0c4c8', 0.2)
  const bowl = useMemo(() => {
    const g = new THREE.LatheGeometry([[0.03, -0.12], [0.11, -0.1], [0.2, -0.04], [0.24, 0.02], [0.25, 0.04]].map(([r, y]) => new THREE.Vector2(r, y)), 32)
    g.scale(1.25, 1, 0.9)
    return g
  }, [])
  bowl.computeVertexNormals()
  const inside = useMemo(() => { const c = ceramic.clone(); c.side = THREE.DoubleSide; return c }, [ceramic])
  useEffect(() => () => { inside.dispose(); bowl.dispose() }, [inside, bowl])
  return (
    <group>
      <mesh geometry={bowl} position={[0, 0.86, 0.26]} material={inside} castShadow receiveShadow />
      <Box s={[0.66, 0.05, 0.08]} p={[0, 0.89, 0.04]} m={ceramic} />
      <Cyl a={[0.016, 0.016, 0.22]} p={[0, 0.65, 0.26]} m={steel} seg={12} />
      <Cyl a={[0.016, 0.016, 0.24]} p={[0, 0.55, 0.14]} r={[Math.PI / 2, 0, 0]} m={steel} seg={12} />
      <Cyl a={[0.016, 0.02, 0.2]} p={[0, 1.0, 0.05]} m={steel} seg={12} />
      <Cyl a={[0.011, 0.011, 0.18]} p={[0, 1.09, 0.13]} r={[Math.PI / 2, 0, 0]} m={steel} seg={10} />
      {[-0.1, 0.1].map((x) => <Cyl key={x} a={[0.018, 0.018, 0.03]} p={[x, 0.95, 0.04]} m={steel} seg={10} />)}
      <Box s={[0.5, 0.62, 0.012]} p={[0, 1.62, 0.008]} m={m.metal('#dfe6ea', 0.04)} />
      <Box s={[0.09, 0.17, 0.05]} p={[0.42, 1.25, 0.03]} m={m.plastic('#eef1f2', 0.3)} />
      <Box s={[0.05, 0.04, 0.012]} p={[0.42, 1.17, 0.058]} m={m.plastic('#2f8fd8', 0.3)} />
    </group>
  )
}

/** Rolling care trolley: tube frame, lipped trays, swivel castors. */
function MedCart() {
  const m = useMats()
  const steel = m.metal('#b3b8bc', 0.25)
  return (
    <group position={[0, 0, 0.3]}>
      {[-0.32, 0.32].flatMap((x) => [-0.2, 0.2].map((z) => <group key={`${x}:${z}`} position={[x, 0, z]}>
        <Cyl a={[0.012, 0.012, 0.86]} p={[0, 0.5, 0]} m={steel} seg={10} />
        <Cyl a={[0.035, 0.035, 0.025]} p={[0, 0.04, 0]} r={[0, 0, Math.PI / 2]} m={m.rubber()} seg={14} />
      </group>))}
      {[0.28, 0.58, 0.9].map((y) => <group key={y}>
        <Box s={[0.72, 0.018, 0.46]} p={[0, y, 0]} m={m.painted('#e4e6e8', 0.3, 0.3)} />
        {[-1, 1].map((k) => <Box key={k} s={[0.72, 0.03, 0.008]} p={[0, y + 0.02, k * 0.228]} m={steel} />)}
        {[-1, 1].map((k) => <Box key={k} s={[0.008, 0.03, 0.46]} p={[k * 0.358, y + 0.02, 0]} m={steel} />)}
      </group>)}
      <Cyl a={[0.01, 0.01, 0.46]} p={[0.4, 0.86, 0]} r={[Math.PI / 2, 0, 0]} m={steel} seg={8} />
      <RealModel id="medical_box" height={0.17} shadows={false} p={[-0.14, 0.91, 0]} />
      <RealModel id="medical_tape" height={0.07} shadows={false} p={[0.2, 0.91, 0.08]} />
      <RealModel id="multi_cleaner_bottle" height={0.2} shadows={false} p={[-0.18, 0.59, 0.02]} />
      <RealModel id="plastic_crate_02" height={0.2} shadows={false} p={[0.02, 0.29, 0]} />
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
      {[-0.85, 0.85].flatMap((x) => [0.03, 0.47].map((z) => (
        <Cyl key={`${x}:${z}`} a={[0.022, 0.022, 2.2]} p={[x, 1.1, z]} m={f} seg={12} />
      )))}
      {[0.3, 1.0, 1.7].map((y, i) => (
        <group key={y}>
          <Box s={[1.75, 0.025, 0.5]} p={[0, y, 0.25]} m={f} />
          {[0.03, 0.47].map((z) => <Cyl key={z} a={[0.01, 0.01, 1.72]} p={[0, y + 0.03, z]} r={[0, 0, Math.PI / 2]} m={f} seg={8} />)}
          <RealModel id={i === 1 ? 'plastic_crate_02' : 'plastic_crate_01'} height={0.25} shadows={false} p={[-0.45, y + 0.013, 0.25]} />
          <RealModel id={i === 2 ? 'cardboard_box_01' : 'plastic_crate_02'} height={0.25} shadows={false} p={[0.42, y + 0.013, 0.25]} />
        </group>
      ))}
    </group>
  )
}

function Medbed() {
  const m = useMats()
  const steel = m.metal('#a9aeb2', 0.28)
  return (
    <group>
      <Box s={[0.74, 0.05, 1.86]} p={[0, 0.7, 0]} m={m.painted('#d8dde0', 0.35, 0.3)} />
      <Box s={[0.72, 0.11, 1.82]} p={[0, 0.79, 0]} m={m.fabric('#9ccad8')} />
      <Box s={[0.68, 0.035, 0.95]} p={[0, 0.855, 0.42]} m={m.fabric('#6f9fb0')} />
      <Box s={[0.54, 0.1, 0.34]} p={[0, 0.89, -0.7]} r={[0.12, 0, 0]} m={m.fabric('#f2f0ea')} />
      {/* Lifting column on a castored base. */}
      <Cyl a={[0.055, 0.07, 0.56]} p={[0, 0.4, 0]} m={steel} seg={20} />
      <Cyl a={[0.085, 0.09, 0.1]} p={[0, 0.17, 0]} m={m.painted('#596168', 0.4, 0.6)} seg={20} />
      {[-1, 1].map((z) => <group key={z}>
        <Cyl a={[0.02, 0.02, 0.66]} p={[0, 0.11, z * 0.62]} r={[0, 0, Math.PI / 2]} m={steel} seg={12} />
        {[-1, 1].map((x) => <Cyl key={x} a={[0.05, 0.05, 0.035]} p={[x * 0.3, 0.05, z * 0.62]} r={[0, 0, Math.PI / 2]} m={m.rubber()} seg={16} />)}
      </group>)}
      <Cyl a={[0.018, 0.018, 1.26]} p={[0, 0.11, 0]} r={[Math.PI / 2, 0, 0]} m={steel} seg={12} />
      {/* Folding side rails. */}
      {[-1, 1].map((x) => <group key={x} position={[x * 0.39, 0, -0.25]}>
        {[0.87, 1.0].map((y) => <Cyl key={y} a={[0.009, 0.009, 0.9]} p={[0, y, 0]} r={[Math.PI / 2, 0, 0]} m={steel} seg={10} />)}
        {[-0.42, 0.42].map((z) => <Cyl key={z} a={[0.009, 0.009, 0.3]} p={[0, 0.85, z]} m={steel} seg={10} />)}
      </group>)}
      {/* Drip stand with a bag and line. */}
      <group position={[0.47, 0, -0.9]}>
        <Cyl a={[0.012, 0.012, 1.7]} p={[0, 0.88, 0]} m={steel} seg={10} />
        <Cyl a={[0.16, 0.18, 0.025]} p={[0, 0.03, 0]} m={m.rubber()} seg={20} />
        <mesh position={[0, 1.58, 0]} scale={[0.055, 0.095, 0.03]} material={m.glass('#d8f0ff', 0.6)}><sphereGeometry args={[1, 16, 12]} /></mesh>
        <Cyl a={[0.002, 0.002, 0.5]} p={[-0.06, 1.25, 0.04]} r={[0, 0, 0.25]} m={m.plastic('#e8f0f2', 0.3)} seg={6} />
      </group>
    </group>
  )
}

function Cabinet() {
  const m = useMats()
  const body = m.painted('#e4e6e8', 0.4, 0.2), front = m.painted('#d4d8db', 0.34, 0.25)
  return (
    <group>
      <Units w={1.4} h={0.9} d={0.53} doors={2} body={body} front={front} />
      <Box s={[1.42, 0.03, 0.58]} p={[0, 0.915, 0.29]} m={m.plastic('#5f6870', 0.3)} />
      <Box s={[1.4, 0.7, 0.33]} p={[0, 2.0, 0.165]} m={body} />
      <Box s={[0.66, 0.62, 0.012]} p={[-0.35, 2.0, 0.338]} m={m.glass('#cfe8f2', 0.35)} />
      <Box s={[0.66, 0.62, 0.02]} p={[0.35, 2.0, 0.338]} m={front} />
      <Pull p={[0.35, 1.76, 0.348]} length={0.12} />
      <Box s={[0.6, 0.012, 0.25]} p={[-0.35, 2.0, 0.17]} m={m.metal('#a9aeb2', 0.3)} />
      {[-0.52, -0.38, -0.2].map((x, i) => <Cyl key={x} a={[0.03, 0.035, 0.13 + i * 0.03]} p={[x, 2.08 + i * 0.015, 0.18]} m={m.plastic(['#e9e4d0', '#b7d3e0', '#d9dee2'][i], 0.3)} seg={14} />)}
      <mesh position={[0.35, 2.06, 0.35]} material={m.glow('#ff3344', 1.5)}><planeGeometry args={[0.1, 0.03]} /></mesh>
      <mesh position={[0.35, 2.06, 0.35]} material={m.glow('#ff3344', 1.5)}><planeGeometry args={[0.03, 0.1]} /></mesh>
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
/** Turned shape from a [radius, height] profile: bottles, valves, suit segments. */
export function Lathe({ profile, m, p, scale, seg = 28 }: { profile: [number, number][]; m: M; p?: [number, number, number]; scale?: [number, number, number]; seg?: number }) {
  const key = profile.join(';')
  const geometry = useMemo(() => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg), [key, seg])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} position={p} scale={scale} material={m} castShadow receiveShadow />
}

/** A real spacesuit (NASA Z-2, 3D Resources), arms down, stored on its wall rack. */
export function SuitRack() {
  const m = useMats()
  const ring = m.metal('#a9aeb2', 0.25)
  return (
    <group>
      <Box s={[0.72, 0.56, 0.02]} p={[0, 1.38, 0.012]} m={m.painted('#596168', 0.4, 0.6)} />
      {[-0.22, 0.22].map((x) => <Cyl key={x} a={[0.02, 0.02, 0.2]} p={[x, 1.42, 0.1]} r={[Math.PI / 2, 0, 0]} m={ring} seg={12} />)}
      <Box s={[0.82, 0.02, 0.76]} p={[0, 0.01, 0.4]} m={m.rubber('#17191b')} />
      <RealModel id="z2_spacesuit" height={1.9} p={[0, 0.02, 0.4]} />
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
      <Box s={[0.06, 0.22, 0.04]} p={[0, 0.1, -0.06]} m={m.metal('#2d3034')} />
      <Cyl a={[0.08, 0.09, 0.06]} m={m.metal('#2d3034')} />
      <mesh position={[0, 0.08, 0]} material={mat}>
        <sphereGeometry args={[0.07, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  )
}

function LabBench() {
  const m = useMats()
  const body = m.painted('#d3d8db', 0.45, 0.2), front = m.painted('#bfc5c9', 0.38, 0.25)
  return (
    <group>
      <Box s={[1.9, 0.05, 0.75]} p={[0, 0.905, 0.38]} m={m.plastic('#2a2d31', 0.35)} />
      <Box s={[0.56, 0.78, 0.68]} p={[-0.65, 0.49, 0.34]} m={body} />
      <Box s={[0.56, 0.78, 0.68]} p={[0.65, 0.49, 0.34]} m={body} />
      <Box s={[0.76, 0.12, 0.62]} p={[0, 0.82, 0.31]} m={body} />
      <Box s={[1.84, 0.1, 0.6]} p={[0, 0.05, 0.3]} m={m.rubber('#17191b')} />
      {[-0.65, 0.65].flatMap((x) => [0.76, 0.5, 0.24].map((y) => <group key={`${x}:${y}`}>
        <Box s={[0.52, 0.235, 0.02]} p={[x, y, 0.69]} m={front} />
        <Pull p={[x, y, 0.7]} length={0.14} />
      </group>))}
      {/* Gas and power outlets along the back of the worktop. */}
      <Box s={[1.84, 0.1, 0.05]} p={[0, 0.98, 0.03]} m={m.metal('#a9aeb2', 0.3)} />
      {[-0.7, -0.35, 0.35, 0.7].map((x) => <Cyl key={x} a={[0.012, 0.012, 0.04]} p={[x, 0.98, 0.07]} r={[Math.PI / 2, 0, 0]} m={m.metal('#c7a24e', 0.25)} seg={10} />)}
      {/* colonnes latérales : le hublot, au centre du mur, reste dégagé */}
      {[-0.62, 0.62].map((x) => (
        <Box key={x} s={[0.5, 0.42, 0.26]} p={[x, 1.72, 0.14]} m={body} />
      ))}
      {[-0.62, 0.62].map((x) => <Pull key={`p${x}`} p={[x, 1.56, 0.27]} length={0.12} />)}
      {[-0.62, 0.62].map((x) => (
        <mesh key={`light-${x}`} position={[x, 1.48, 0.2]} material={m.glow('#e8f6ff', 1.6)}>
          <boxGeometry args={[0.36, 0.012, 0.06]} />
        </mesh>
      ))}
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

/** Three bays of real steel shelving holding real potted plants under grow lights. */
function PlantRack({ movable = false }: { movable?: boolean }) {
  const m = useMats()
  const lift = movable ? 0.14 : 0
  const steel = m.painted('#d8dcdc', 0.35, 0.4)
  return (
    <group position={[0, lift, 0]}>
      {[-0.62, 0, 0.62].map((x, bay) => <group key={x} position={[x, 0, 0]}>
        <RealModel id="steel_frame_shelves_02" fit="wall" />
        {/* Shelf boards of this unit stand at 0.62, 1.12 and 1.62 m. */}
        {[0.62, 1.12, 1.62].map((y, level) => <group key={y} position={[0, y, 0]}>
          {(level === 2 ? [0] : [-0.14, 0.14]).map((px, i) => <RealModel key={px} id="potted_plant_04" height={0.27} shadows={false} p={[px, 0, 0.25]} r={(bay * 7 + level * 3 + i * 5) * 0.9} />)}
          {/* Grow light under the board above. */}
          <Box s={[0.5, 0.016, 0.08]} p={[0, 0.462, 0.25]} m={steel} />
          <mesh position={[0, 0.45, 0.25]} rotation={[0, 0, Math.PI / 2]} material={m.glow('#ff5ad1', 2.6)}><cylinderGeometry args={[0.008, 0.008, 0.46, 8]} /></mesh>
        </group>)}
        <RealModel id="seeding_tray_01" height={0.09} shadows={false} p={[0, 0.14, 0.25]} r={bay * 1.6} />
      </group>)}
      {movable && <group position={[0, -lift, 0]}>
        <Box s={[1.95, 0.06, 0.62]} p={[0, 0.16, 0.3]} m={m.metal('#8d9196')} />
        {[-0.88, 0.88].flatMap((x) => [0.08, 0.54].map((z) => (
          <Cyl key={`${x}:${z}`} a={[0.07, 0.07, 0.05]} p={[x, 0.07, z]} r={[0, 0, Math.PI / 2]} m={m.rubber()} seg={16} />
        )))}
        <Screen w={0.58} h={0.1} p={[0, 0.25, 0.62]} lines={['POUSSER']} fg="#f3dfab" intensity={0.25} />
        <group position={[0, 0.25, -0.02]} rotation={[0, Math.PI, 0]}>
          <Screen w={0.58} h={0.1} lines={['POUSSER']} fg="#f3dfab" intensity={0.25} />
        </group>
      </group>}
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

/** A pipe following a curve through the given points. */
function Bent({ points, r, m: material }: { points: [number, number, number][]; r: number; m: M }) {
  const key = points.join(';')
  const geometry = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.2), 26, r, 14), [key, r])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh geometry={geometry} material={material} castShadow receiveShadow />
}

/**
 * The ruptured steam main. It comes down from the ceiling services, runs along the wall through
 * the shut-off valve, and is torn open here; the far half carries on into the bulkhead by the door.
 */
function BrokenPipe() {
  const m = useMats()
  const copper = m.painted('#9b5a2a', 0.5, 0.6)
  const burnt = m.painted('#2c231d', 0.8, 0.3)
  const clamp = m.painted('#3c4348', 0.45, 0.6)
  const Y = 1.2, Z = -0.82
  /** Peeled metal around a torn mouth, pointing along +x or -x. */
  const Tear = ({ p, dir, r }: { p: [number, number, number]; dir: 1 | -1; r: [number, number, number] }) => <group position={p} rotation={r}>
    <Cyl a={[0.074, 0.074, 0.05]} p={[dir * -0.01, 0, 0]} r={[0, 0, Math.PI / 2]} m={burnt} seg={14} />
    {[0, 1, 2, 3, 4, 5, 6].map((i) => {
      const a = i / 7 * Math.PI * 2, length = 0.06 + (i * 37 % 5) * 0.022
      return <group key={i} rotation={[a, 0, 0]}>
        <Box s={[length, 0.006, 0.06]} p={[dir * length * 0.42, 0.092, 0]} r={[0, 0, dir * (0.28 + (i % 3) * 0.18)]} m={copper} />
      </group>
    })}
  </group>
  return (
    <group name="broken-steam-main">
      {/* From the ceiling down to the wall, then along it to the valve (at x = -4 from here). */}
      <Bent m={copper} r={0.09} points={[[-6.45, 2.86, Z], [-6.45, 1.55, Z], [-6.32, 1.27, Z], [-6.05, Y, Z], [-5, Y, Z]]} />
      <Cyl a={[0.15, 0.15, 0.03]} p={[-6.45, CEIL - 0.015, Z]} m={m.metal('#7f878c', 0.35)} seg={20} />
      <Cyl a={[0.115, 0.115, 0.05]} p={[-6.45, CEIL - 0.05, Z]} m={m.painted('#3c4348', 0.45, 0.6)} seg={18} />
      {/* From the valve towards the rupture; the end has sagged out of line. */}
      <Bent m={copper} r={0.09} points={[[-3, Y, Z], [-1, Y, Z], [-0.45, Y + 0.01, Z], [-0.18, Y + 0.09, Z + 0.1]]} />
      <Tear p={[-0.18, Y + 0.09, Z + 0.1]} dir={1} r={[0, -0.34, 0.3]} />
      {/* The far half, dropped on its bracket, running on into the bulkhead. */}
      <Bent m={copper} r={0.09} points={[[0.38, Y - 0.11, Z + 0.07], [0.68, Y - 0.02, Z], [1.3, Y, Z], [2.5, Y, Z], [2.76, Y, Z - 0.03], [2.86, Y, Z - 0.18]]} />
      <Tear p={[0.38, Y - 0.11, Z + 0.07]} dir={-1} r={[0, 0.2, 0.28]} />
      {/* Clamps and flanges. */}
      {[-2.2, -1.2, 0.95, 1.9].map((x) => <group key={x} position={[x, Y, Z]}>
        <mesh rotation={[0, Math.PI / 2, 0]} material={clamp}><torusGeometry args={[0.097, 0.009, 8, 22]} /></mesh>
        <Box s={[0.04, 0.26, 0.16]} p={[0, 0, -0.1]} m={clamp} />
      </group>)}
      {[-2.7, 2.3].map((x) => <Cyl key={x} a={[0.125, 0.125, 0.04]} p={[x, Y, Z]} r={[0, 0, Math.PI / 2]} m={m.metal('#7f878c', 0.35)} seg={18} />)}
      {/* Pressure gauge reading off the scale. */}
      <group position={[-1.7, Y + 0.19, Z]}>
        <Cyl a={[0.016, 0.016, 0.1]} p={[0, -0.05, 0]} m={m.metal('#c7a24e', 0.3)} seg={10} />
        <Cyl a={[0.055, 0.055, 0.03]} p={[0, 0.03, 0.01]} r={[Math.PI / 2, 0, 0]} m={m.metal('#a9aeb2', 0.3)} seg={20} />
        <mesh position={[0, 0.03, 0.027]} material={m.plastic('#f1eee6', 0.3)}><circleGeometry args={[0.047, 20]} /></mesh>
        <Box s={[0.004, 0.04, 0.002]} p={[0.012, 0.042, 0.03]} r={[0, 0, -0.5]} m={m.plastic('#c5302a', 0.4)} />
      </group>
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

/** Wall-mounted workstation: cantilevered desk, real keys, and screens on standoff arms. */
function Workstation() {
  const m = useMats()
  const zone = useGame((s) => s.zone)
  const desk = useSlab(1.72, 0.44, 0.07, 0.035)
  const keys = useRef<THREE.InstancedMesh>(null)
  const dark = m.plastic('#1b1d20', 0.3)
  const frame = m.painted('#3c4348', 0.42, 0.65)
  const steel = m.metal('#a3adb3', 0.28)
  const COLS = 14, ROWS = 4
  useEffect(() => {
    const matrix = new THREE.Matrix4()
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      matrix.makeTranslation((c - (COLS - 1) / 2) * 0.041 + (r % 2) * 0.008, 0, (r - (ROWS - 1) / 2) * 0.041)
      keys.current!.setMatrixAt(r * COLS + c, matrix)
    }
    keys.current!.instanceMatrix.needsUpdate = true
  }, [])
  const main = zone === 1 ? ['SELENE-7 · ÉTAT', 'COQUE : BRÈCHE S-4', 'O₂ CABINE : 14 %', 'ÉVACUATION EN COURS'] : ['LABO-2 · CULTURES', 'TEMP 21,4 °C', 'CO₂ 0,7 %', '⚠ ALERTE RÉSEAU']
  const accent = zone === 1 ? '#ffb38a' : '#7fe3ff'
  return (
    <group>
      {/* Wall rail, brackets and a conduit running down to the floor. */}
      <Box s={[1.7, 0.1, 0.03]} p={[0, 0.98, 0.015]} m={frame} />
      {[-0.68, 0.68].map((x) => <group key={x}>
        <Cyl a={[0.014, 0.014, 0.42]} p={[x, 0.82, 0.14]} r={[-0.72, 0, 0]} m={steel} seg={10} />
        <Box s={[0.05, 0.1, 0.02]} p={[x, 0.66, 0.012]} m={frame} />
      </group>)}
      <Cyl a={[0.016, 0.016, 0.98]} p={[-0.8, 0.49, 0.03]} m={steel} seg={10} />
      <Cyl a={[0.03, 0.03, 0.04]} p={[-0.8, 0.02, 0.03]} m={frame} seg={12} />

      {/* Sloped desk, flush against the wall. */}
      <group position={[0, 1.0, 0.03]} rotation={[0.16, 0, 0]}>
        <mesh geometry={desk} position={[0, -0.03, 0.22]} material={frame} castShadow receiveShadow />
        <Box s={[0.7, 0.012, 0.22]} p={[-0.28, 0.012, 0.24]} m={dark} />
        <instancedMesh ref={keys} args={[undefined, undefined, COLS * ROWS]} position={[-0.28, 0.026, 0.24]} material={m.plastic('#3a3f45', 0.45)}>
          <boxGeometry args={[0.034, 0.012, 0.034]} />
        </instancedMesh>
        {/* Trackball. */}
        <Cyl a={[0.05, 0.055, 0.012]} p={[0.15, 0.012, 0.26]} m={dark} seg={24} />
        <mesh position={[0.15, 0.024, 0.26]} material={m.metal('#8d9196', 0.2)}><sphereGeometry args={[0.028, 16, 12]} /></mesh>
        {/* Guarded switches and status lamps. */}
        {[0.34, 0.42, 0.5, 0.58, 0.66].map((x, i) => <group key={x}>
          <Cyl a={[0.012, 0.014, 0.02]} p={[x, 0.012, 0.3]} m={steel} seg={10} />
          <mesh position={[x, 0.006, 0.2]} rotation={[-Math.PI / 2, 0, 0]} material={m.glow(i === 3 ? '#ffb02a' : '#58e08a', 2.2)}><circleGeometry args={[0.009, 10]} /></mesh>
        </group>)}
        <group position={[0.5, 0.008, 0.11]} rotation={[-Math.PI / 2, 0, 0]}>
          <Screen w={0.32} h={0.09} lines={[zone === 1 ? 'ALIM. SECOURS' : 'RÉSEAU : DÉGRADÉ']} fg={accent} intensity={0.7} />
        </group>
      </group>

      {/* Main and side screens on short arms. */}
      {[[0, 1.72, 1.0, 0.6], [-0.74, 1.6, 0.4, 0.32], [0.74, 1.6, 0.4, 0.32]].map(([x, y, w, h], i) => <group key={i} position={[x, y, 0]} rotation={[0, x === 0 ? 0 : -Math.sign(x) * 0.22, 0]}>
        <Cyl a={[0.018, 0.018, 0.08]} p={[0, 0, 0.04]} r={[Math.PI / 2, 0, 0]} m={steel} seg={10} />
        <Box s={[w, h, 0.045]} p={[0, 0, 0.1]} m={dark} />
        <Screen w={w - 0.06} h={h - 0.06} p={[0, 0, 0.125]} lines={i === 0 ? main : i === 1 ? ['O₂', zone === 1 ? '14 %' : '62 %', '/\\_/\\_'] : ['ÉNERGIE', zone === 1 ? '3 / 4' : '0 / 3', '||||.. ']} fg={accent} intensity={i === 0 ? 1.2 : 0.9} />
      </group>)}
    </group>
  )
}

/** A seat with a soft cushion, an inclined back and a single round column. */
function NookSeat() {
  const m = useMats()
  const cloth = m.fabric('#43362e')
  const steel = m.metal('#6d7177', 0.35)
  return (
    <group>
      <Cyl a={[0.21, 0.24, 0.03]} p={[0, 0.015, 0]} m={steel} seg={24} />
      <Cyl a={[0.05, 0.06, 0.38]} p={[0, 0.21, 0]} m={steel} seg={18} />
      <Box s={[0.52, 0.05, 0.48]} p={[0, 0.41, 0]} m={m.painted('#2f3237', 0.45, 0.6)} />
      <Box s={[0.54, 0.11, 0.5]} p={[0, 0.48, 0.01]} m={cloth} />
      <group position={[0, 0.5, -0.24]} rotation={[-0.14, 0, 0]}>
        <Box s={[0.5, 0.62, 0.04]} p={[0, 0.33, -0.05]} m={m.painted('#2f3237', 0.45, 0.6)} />
        <Box s={[0.52, 0.6, 0.1]} p={[0, 0.33, 0]} m={cloth} />
        <Box s={[0.3, 0.15, 0.09]} p={[0, 0.72, 0]} m={cloth} />
      </group>
    </group>
  )
}

const BAGUETTE_LENGTH = 0.25
const BAGUETTE_RADIUS = 0.034
/** Radius along the loaf, for t from 0 to 1: full body and tapered, slightly pointed ends. */
const baguetteRadius = (t: number) => BAGUETTE_RADIUS * Math.pow(Math.sin(Math.PI * t), 0.42)

/** Half a loaf along x, crust side up (or down) with the cut face flat at y = 0. */
function loafHalf(top: boolean) {
  const points = Array.from({ length: 25 }, (_, i) => new THREE.Vector2(Math.max(baguetteRadius(i / 24), 0.0005), (i / 24 - 0.5) * BAGUETTE_LENGTH))
  const g = new THREE.LatheGeometry(points, 22, top ? 0 : Math.PI, Math.PI)
  g.rotateZ(Math.PI / 2)
  g.scale(1, 0.8, 1)
  return g
}

/** Flat layer following the outline of the loaf, with a wavy edge for leafy fillings. */
function loafLayer(size: number, thick: number, wave = 0) {
  const shape = new THREE.Shape()
  const N = 48
  for (let i = 0; i <= N; i++) {
    const t = i / N, side = i < N / 2 ? 1 : -1
    const along = i < N / 2 ? t * 2 : 2 - t * 2
    const r = baguetteRadius(Math.min(Math.max(along, 0.005), 0.995)) * size * (1 + wave * Math.sin(i * 1.9))
    const x = (along - 0.5) * BAGUETTE_LENGTH * size, z = side * r
    if (i === 0) shape.moveTo(x, z)
    else shape.lineTo(x, z)
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false })
  g.rotateX(-Math.PI / 2)
  return g
}

/** Baguette sandwich on kraft paper: crusty loaf with scored top, ham, cheese, lettuce and tomato. */
function Sandwich({ p, r = 0 }: { p: [number, number, number]; r?: number }) {
  const m = useMats()
  const parts = useMemo(() => ({
    top: loafHalf(true), bottom: loafHalf(false), crumb: loafLayer(0.97, 0.002),
    lettuce: loafLayer(1.08, 0.003, 0.12), ham: loafLayer(1.02, 0.004, 0.03), cheese: loafLayer(0.98, 0.003),
  }), [])
  useEffect(() => () => Object.values(parts).forEach((g) => g.dispose()), [parts])
  const crust = useMemo(() => {
    const c = m.plastic('#b5772f', 0.72).clone()
    c.side = THREE.DoubleSide
    return c
  }, [m.plastic('#b5772f', 0.72)])
  useEffect(() => () => crust.dispose(), [crust])
  const crumb = m.plastic('#f0e2bd', 0.95)
  const lift = BAGUETTE_RADIUS * 0.8
  return <group position={p} rotation={[0, r, 0]}>
    <Box s={[0.29, 0.003, 0.11]} p={[0, 0.0015, 0]} m={m.plastic('#b99b6b', 0.85)} />
    <group position={[0, 0.003 + lift, 0]}>
      <mesh geometry={parts.bottom} material={crust} castShadow />
      <mesh geometry={parts.crumb} material={crumb} />
      <mesh geometry={parts.lettuce} material={m.plastic('#6f9a3c', 0.7)} position={[0, 0.002, 0]} castShadow />
      <mesh geometry={parts.ham} material={m.plastic('#df9f98', 0.55)} position={[0, 0.005, 0]} />
      <mesh geometry={parts.cheese} material={m.plastic('#efc64a', 0.5)} position={[0, 0.009, 0]} />
      {[-0.075, -0.025, 0.025, 0.075].map((x) => <Cyl key={x} a={[0.021, 0.021, 0.004]} p={[x, 0.014, 0.004]} m={m.plastic('#c8402c', 0.45)} seg={16} />)}
      <mesh geometry={parts.lettuce} material={m.plastic('#7daa45', 0.7)} position={[0, 0.016, 0]} />
      {/* Top half, tilted open by a hair at the far end, with the baker's diagonal cuts. */}
      <group position={[0, 0.02, 0]} rotation={[0, 0, -0.012]}>
        <mesh geometry={parts.crumb} material={crumb} />
        <mesh geometry={parts.top} material={crust} castShadow />
        {[-0.07, -0.023, 0.024, 0.07].map((x) => <Box key={x} s={[0.04, 0.003, 0.009]} p={[x, BAGUETTE_RADIUS * 0.8 - 0.0005, 0]} r={[0, 0.7, 0]} m={m.plastic('#e4c98e', 0.9)} />)}
      </group>
    </group>
  </group>
}

/** Hermetic drink pouch: foil bag with welded seams, and a screw cap still held by its tamper ring. */
function DrinkPouch({ p, r = 0, color, name }: { p: [number, number, number]; r?: number; color: string; name: string }) {
  const m = useMats()
  const foil = m.metal('#c4c8cb', 0.28)
  const label = useMemo(() => new THREE.MeshStandardMaterial({
    map: textTexture([name, 'SCELLÉ'], { w: 128, h: 128, bg: color, fg: '#ffffff', size: 22 }), roughness: 0.5,
  }), [name, color])
  useEffect(() => () => { label.map?.dispose(); label.dispose() }, [label])
  return <group position={p} rotation={[0, r, 0]}>
    <Lathe m={foil} scale={[1, 1, 0.42]} seg={32} profile={[[0, 0.001], [0.044, 0.001], [0.052, 0.012], [0.054, 0.05], [0.052, 0.095], [0.038, 0.128], [0.017, 0.145]]} />
    {/* Welded edges and folded base. */}
    {[-1, 1].map((k) => <Box key={k} s={[0.006, 0.1, 0.004]} p={[k * 0.054, 0.058, 0]} m={foil} />)}
    <Box s={[0.1, 0.006, 0.042]} p={[0, 0.004, 0]} m={foil} />
    <mesh position={[0, 0.058, 0.0232]} material={label}><planeGeometry args={[0.078, 0.078]} /></mesh>
    <mesh position={[0, 0.058, -0.0232]} rotation={[0, Math.PI, 0]} material={label}><planeGeometry args={[0.078, 0.078]} /></mesh>
    {/* Spout, tamper ring and ribbed screw cap. */}
    <Cyl a={[0.015, 0.019, 0.012]} p={[0, 0.15, 0]} m={m.plastic('#e7edf0', 0.35)} seg={20} />
    <mesh position={[0, 0.16, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.plastic(color, 0.4)}><torusGeometry args={[0.0155, 0.0022, 6, 22]} /></mesh>
    <Cyl a={[0.0165, 0.0175, 0.024]} p={[0, 0.176, 0]} m={m.plastic(color, 0.35)} seg={24} />
    {Array.from({ length: 12 }, (_, i) => {
      const a = i / 12 * Math.PI * 2
      return <Box key={i} s={[0.0024, 0.02, 0.0024]} p={[Math.sin(a) * 0.0175, 0.176, Math.cos(a) * 0.0175]} m={m.plastic(color, 0.35)} />
    })}
  </group>
}

/** Rest corner: two seats face to face at a small round table, with a chess game or a meal on it. */
function Nook({ meal = false }: { meal?: boolean }) {
  const m = useMats()
  const steel = m.metal('#6d7177', 0.35)
  return (
    <group>
      <group position={[-0.74, 0, 0.62]} rotation={[0, Math.PI / 2, 0]}><NookSeat /></group>
      <group position={[0.74, 0, 0.62]} rotation={[0, -Math.PI / 2, 0]}><NookSeat /></group>
      <group position={[0, 0, 0.62]}>
        <Cyl a={[0.2, 0.26, 0.03]} p={[0, 0.015, 0]} m={steel} seg={28} />
        <Cyl a={[0.035, 0.05, 0.66]} p={[0, 0.36, 0]} m={steel} seg={18} />
        <Cyl a={[0.32, 0.32, 0.03]} p={[0, 0.705, 0]} m={m.painted('#d6d2c8', 0.35, 0.1)} seg={40} />
        <Cyl a={[0.325, 0.325, 0.012]} p={[0, 0.69, 0]} m={m.metal('#8d9196', 0.3)} seg={40} />
        {meal ? <>
          <Sandwich p={[-0.17, 0.72, 0.055]} r={Math.PI / 2} />
          <Sandwich p={[0.17, 0.72, -0.055]} r={-Math.PI / 2} />
          <DrinkPouch p={[-0.15, 0.72, -0.16]} r={0.65} color="#c8561e" name="ORANGE" />
          <DrinkPouch p={[0.15, 0.72, 0.16]} r={-0.65} color="#2a6bb3" name="EAU" />
        </> : <RealModel id="chess_set" height={0.078} shadows={false} p={[0, 0.72, 0]} r={Math.PI / 2} />}
      </group>
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
      <mesh position={[0, 0, 0.05]} rotation={[Math.PI / 2, 0, 0]} material={m.painted('#4a4e54', 0.4, 0.7)} castShadow receiveShadow>
        <cylinderGeometry args={[0.85, 0.85, 0.1, 40]} />
      </mesh>
      <mesh position={[0, 0, 0.11]} material={m.painted('#7d8288', 0.45, 0.6)} castShadow receiveShadow>
        <circleGeometry args={[0.7, 40]} />
      </mesh>
      <mesh position={[0, 0, 0.14]} rotation={[0, 0, 0]} material={m.metal('#c0c4c8', 0.25)} castShadow receiveShadow>
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

function Poster() {
  const m = useMats()
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    map: textTexture(['CONDITIONNEMENT', '', '1. Étirements 15 min', '2. Gainage 15 min', '3. Respiration', '', 'Chaque jour — Cdte'], { w: 256, h: 340, bg: '#12324a', fg: '#e7f6ff', size: 22, align: 'center', pad: 16 }),
    roughness: 0.45,
  }), [])
  return (
    <group>
      <Box s={[0.62, 0.82, 0.02]} p={[0, 0, 0.01]} m={m.metal('#8d9196', 0.35)} />
      <mesh position={[0, 0, 0.022]} material={mat}>
        <planeGeometry args={[0.54, 0.74]} />
      </mesh>
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
  // Mobilier Poly Haven (CC0), importé par scripts/fetch-interior-models.mjs.
  cookPot: () => <RealModel id="pot_enamel_01" height={0.14} />,
  jug: () => <RealModel id="metal_jug" height={0.26} />,
  waterGallon: () => <RealModel id="plastic_bottle_gallon" height={0.27} />,
  sofa: () => <RealModel id="sofa_02" solid fit="wall" height={0.71} />,
  coffeeTable: () => <RealModel id="modern_coffee_table_01" solid height={0.39} />,
  armchair: () => <RealModel id="modern_arm_chair_01" solid fit="wall" height={0.95} />,
  nightTable: () => <RealModel id="side_table_01" solid fit="wall" height={0.55} />,
  deskLamp: () => <RealModel id="desk_lamp_arm_01" height={0.5} />,
  frame: () => <RealModel id="standing_picture_frame_01" height={0.22} r={Math.PI} />,
  cassette: () => <RealModel id="cassette_player" height={0.2} />,
  dartboard: () => <RealModel id="dartboard" fit="wall" height={0.45} />,
  drawers: () => <RealModel id="drawer_cabinet" solid fit="wall" height={1.1} />,
  desk: () => <RealModel id="metal_office_desk" solid fit="wall" height={0.75} />,
  workTable: () => <RealModel id="metal_office_desk" solid fit="wall" height={0.87} />,
  chair: () => <RealModel id="dining_chair_02" solid height={0.92} />,
  wheelchair: () => <RealModel id="wheelchair_01" solid fit="wall" height={1} />,
  cleanerBottle: () => <RealModel id="multi_cleaner_bottle" height={0.23} />,
  cleanerCan: () => <RealModel id="multi_cleaner_5_litre" height={0.3} />,
  cardboard: () => <RealModel id="cardboard_box_01" solid fit="wall" height={0.42} />,
  storageShelf: () => <RealModel id="steel_frame_shelves_02" solid fit="wall" height={2.1} />,
  barrel: () => <RealModel id="barrel_03" solid height={0.93} />,
  magnifier: () => <RealModel id="magnifying_glass_01" height={0.05} />,
  sprays: () => <RealModel id="spray_paint_bottles" height={0.23} />,
  planterLong: () => <><RealModel id="planter_box_02" solid fit="wall" height={0.45} /><RealModel id="fern_02" height={0.18} shadows={false} p={[0, 0.3, 0.39]} /></>,
  clayPot: () => <RealModel id="planter_pot_clay" height={0.22} />,
  wateringCan: () => <RealModel id="watering_can_metal_01" height={0.2} />,
  trowel: () => <RealModel id="trowel_01" height={0.1} />,
  gloves: () => <RealModel id="garden_gloves_01" height={0.08} />,
  compost: () => <RealModel id="compost_bag_02" solid fit="wall" height={0.45} />,
  vice: () => <RealModel id="bench_vice_01" height={0.27} />,
  oilCan: () => <RealModel id="small_oil_can_01" height={0.24} />,
  drill: () => <RealModel id="Drill_01" height={0.19} />,
  tapeMeasure: () => <RealModel id="measuring_tape_01" height={0.07} />,
  ladderRack: () => <RealModel id="ladder_sectioned_01" fit="wall" height={2.1} />,
  lubricant: () => <RealModel id="lubricant_spray" height={0.16} />,
  wallLamp: () => <RealModel id="industrial_wall_lamp" fit="wall" height={0.43} />,
  powerBox: () => <RealModel id="power_box_01" solid fit="wall" height={0.5} />,
  stack: () => <><RealModel id="plastic_container" solid fit="wall" height={0.43} /><RealModel id="plastic_crate_02" fit="wall" height={0.25} shadows={false} p={[0, 0.43, 0.08]} /></>,
  medicalBox: () => <RealModel id="medical_box" height={0.16} shadows={false} />,
  kettle: () => <RealModel id="vintage_electric_kettle" height={0.22} shadows={false} />,
  foodBox: () => <RealModel id="long_life_food" height={0.24} shadows={false} />,
  foodCans: () => <RealModel id="russian_food_cans_01" height={0.08} shadows={false} />,
  thermos: () => <RealModel id="plastic_thermos" height={0.3} shadows={false} />,
  cuttingBoard: () => <RealModel id="wooden_cutting_board" height={0.04} shadows={false} />,
  toolbox: () => <RealModel id="metal_toolbox" height={0.28} shadows={false} />,
  crateSmall: () => <RealModel id="plastic_crate_02" height={0.25} shadows={false} />,
  containerLow: () => <RealModel id="plastic_container" solid fit="wall" height={0.43} />,
  jerrycan: () => <RealModel id="metal_jerrycan_green" solid fit="wall" height={0.5} />,
  plasticCan: () => <RealModel id="plastic_jerrycan" solid fit="wall" height={0.32} />,
  gasBottle: () => <RealModel id="small_lpg_tank" solid height={0.64} />,
  elecBox: () => <RealModel id="utility_box_02" solid fit="wall" height={1.12} />,
  clipboard: () => <RealModel id="clipboard" height={0.04} shadows={false} />,
  binder: () => <RealModel id="binder_notebook" height={0.03} shadows={false} />,
  stationery: () => <RealModel id="stationery_supplies" height={0.16} shadows={false} />,
  circuit: () => <RealModel id="circuit_board" height={0.05} shadows={false} />,
  multimeter: () => <RealModel id="retro_multimeter" height={0.2} shadows={false} />,
  pliers: () => <RealModel id="pliers" height={0.02} shadows={false} />,
  screwdrivers: () => <RealModel id="screwdrivers_02" height={0.03} shadows={false} />,
  spanner: () => <RealModel id="combination_wrench" height={0.02} shadows={false} />,
  bunsen: () => <RealModel id="bunsen_burner" height={0.17} shadows={false} />,
  broom: () => <RealModel id="plastic_broom" fit="wall" height={1.2} />,
  dustpan: () => <RealModel id="dustpan" height={0.1} shadows={false} />,
  trashBag: () => <RealModel id="trashbag" solid height={0.57} />,
  fireAlarm: () => <RealModel id="fire_alarm" fit="wall" height={0.14} shadows={false} />,
  handTruck: () => <RealModel id="hand_truck" solid fit="wall" height={1.3} />,
  storageCart: () => <RealModel id="industrial_storage_cart" solid fit="wall" height={1.1} />,
  drillPress: () => <RealModel id="old_drill_press" solid fit="wall" height={1.05} />,
  weldCart: () => <RealModel id="portable_welding_cart" solid fit="wall" height={1.3} />,
  hvac: () => <RealModel id="exterior_aircon_unit" solid fit="wall" height={0.93} />,
  crutches: () => <RealModel id="vintage_crutches_01" fit="wall" height={1.3} />,
  metalStool: () => <RealModel id="metal_stool_02" solid height={0.46} />,
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
  counterSink: () => <Counter sink upper={false} />,
  counterLow: () => <Counter upper={false} />,
  fridge: () => <Fridge />,
  bin: () => <Bin />,
  conduit: (p) => <Conduit scale={p.scale} />,
  medWall: () => <MedWall />,
  curtain: () => <Curtain />,
  washBasin: () => <WashBasin />,
  medCart: () => <MedCart />,
  workstation: () => <Workstation />,
  nook: () => <Nook />,
  nookMeal: () => <Nook meal />,
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
  chemSet: () => <RealModel id="chemistry_set" height={0.28} p={[0, 0, 0.22]} />,
  gasTank: () => <RealModel id="propane_tank" solid height={0.72} />,
  shelfUnit: () => <RealModel id="steel_frame_shelves_01" solid fit="wall" height={1.7} />,
  poster: () => <Poster />,
}
