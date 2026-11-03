import { useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGame } from '../game/state'
import { fr } from '../i18n/fr'
import { pbr, tex } from './assets'
import { Astronaut } from './Astronaut'
import { MilkyWay, Stars } from './Exterior/Space'
import { RealModel } from './props/RealModel'

// Fond 3D des écrans de connexion, du menu et des réglages : la base lunaire Selene-7.

const SUN = new THREE.Vector3(0.75, 0.22, 0.35).normalize()

function hash(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function vnoise(x: number, z: number) {
  const xi = Math.floor(x)
  const zi = Math.floor(z)
  const xf = x - xi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = zf * zf * (3 - 2 * zf)
  const a = hash(xi, zi)
  const b = hash(xi + 1, zi)
  const c = hash(xi, zi + 1)
  const d = hash(xi + 1, zi + 1)
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v
}
const CRATERS = Array.from({ length: 26 }, (_, i) => ({ x: (hash(i, 1) - 0.5) * 160, z: -hash(i, 2) * 140 + 10, r: 2 + hash(i, 3) ** 2 * 11 }))
export function lunarHeight(x: number, z: number) {
  let h = 0
  let a = 1.2
  let f = 0.03
  for (let o = 0; o < 5; o++) {
    h += (vnoise(x * f, z * f) - 0.5) * a
    a *= 0.5
    f *= 2.1
  }
  for (const c of CRATERS) {
    const d = Math.hypot(x - c.x, z - c.z) / c.r
    if (d < 1) h -= (1 - d * d) * c.r * 0.22
    else if (d < 1.5) h += Math.exp(-((d - 1) * (d - 1)) / 0.04) * c.r * 0.06
  }
  // le sol remonte au loin (collines lunaires)
  h += Math.max(0, -z - 60) * 0.12
  return h
}

function Ground() {
  const { geo, mat } = useMemo(() => {
    const g = new THREE.PlaneGeometry(320, 240, 220, 170)
    g.rotateX(-Math.PI / 2)
    g.translate(0, 0, -60)
    const p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) p.setY(i, lunarHeight(p.getX(i), p.getZ(i)))
    g.computeVertexNormals()
    const s = pbr('moon_dusted_02', [36, 27])
    const mat = new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, roughnessMap: s.arm, aoMap: s.arm, roughness: 1, metalness: 0, color: '#c9c6c0', envMapIntensity: 0.15 })
    return { geo: g, mat }
  }, [])
  return <mesh geometry={geo} material={mat} receiveShadow />
}

function Saturn() {
  const g = useRef<THREE.Group>(null)
  const { ringGeo, ringMat, mat } = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({ map: tex('/assets/planets/saturn.jpg'), roughness: 1, metalness: 0, envMapIntensity: 0, fog: false })
    const ringGeo = new THREE.RingGeometry(1.25, 2.3, 128, 1)
    // UV radiales pour la texture des anneaux
    const p = ringGeo.attributes.position as THREE.BufferAttribute
    const uv = ringGeo.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const r = Math.hypot(p.getX(i), p.getY(i))
      uv.setXY(i, (r - 1.25) / 1.05, 0.5)
    }
    const rt = tex('/assets/planets/saturn_ring.png')
    const ringMat = new THREE.MeshStandardMaterial({ map: rt, alphaMap: rt, transparent: true, side: THREE.DoubleSide, roughness: 1, metalness: 0, depthWrite: false, fog: false, color: '#e9dcc4' })
    return { ringGeo, ringMat, mat }
  }, [])
  useFrame((_, dt) => {
    if (g.current) g.current.rotation.y += dt * 0.01
  })
  return (
    <group position={[230, 150, -480]} rotation={[0.35, 0, -0.42]} scale={38}>
      <group ref={g}>
        <mesh material={mat}>
          <sphereGeometry args={[1, 64, 48]} />
        </mesh>
      </group>
      <mesh geometry={ringGeo} material={ringMat} rotation={[-Math.PI / 2 + 0.1, 0, 0]} />
    </group>
  )
}

/** base lunaire : dômes vitrés, modules pressurisés, parabole, panneaux solaires */
function Base() {
  const mats = useMemo(() => {
    const hull = pbr('metal_plate_02', [2, 1])
    return {
      hull: new THREE.MeshStandardMaterial({ map: hull.map, normalMap: hull.normalMap, roughnessMap: hull.arm, metalnessMap: hull.arm, color: '#d6d2c8', metalness: 0.7, roughness: 1 }),
      dark: new THREE.MeshStandardMaterial({ color: '#2a2d33', metalness: 0.8, roughness: 0.4 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#3d7bb8', metalness: 0.2, roughness: 0.08, transparent: true, opacity: 0.55, clearcoat: 1, envMapIntensity: 1.5 }),
      win: new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ffb066', emissiveIntensity: 6 }),
      panel: new THREE.MeshStandardMaterial({ color: '#1b2a4a', metalness: 0.7, roughness: 0.25 }),
      accent: new THREE.MeshStandardMaterial({ color: '#ff6b35', roughness: 0.6 }),
    }
  }, [])
  const y = (x: number, z: number) => lunarHeight(x, z)
  const domes: [number, number, number][] = [
    [-18, -26, 5.5],
    [-8, -30, 4],
    [-27, -34, 3.2],
  ]
  return (
    <group>
      {domes.map(([x, z, r], i) => (
        <group key={i} position={[x, y(x, z) - 0.3, z]}>
          <mesh material={mats.glass} castShadow>
            <sphereGeometry args={[r, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
          <mesh material={mats.hull} castShadow receiveShadow>
            <cylinderGeometry args={[r * 1.02, r * 1.05, r * 0.35, 48, 1]} />
          </mesh>
          {Array.from({ length: 8 }).map((_, k) => (
            <mesh key={k} rotation={[0, (k / 8) * Math.PI, 0]} material={mats.dark}>
              <torusGeometry args={[r * 1.005, 0.05, 6, 48, Math.PI]} />
            </mesh>
          ))}
          <pointLight position={[0, r * 0.4, 0]} intensity={30} distance={r * 3} color="#8fd0ff" />
        </group>
      ))}
      {/* modules cylindriques avec hublots éclairés */}
      {[
        [-13, -22, 0.4, 9],
        [-22, -29, -0.8, 7],
      ].map(([x, z, r, l], i) => (
        <group key={i} position={[x, y(x, z) + 1.3, z]} rotation={[0, r, Math.PI / 2]}>
          <mesh material={mats.hull} castShadow receiveShadow>
            <cylinderGeometry args={[1.4, 1.4, l, 32]} />
          </mesh>
          {Array.from({ length: Math.floor(l / 1.6) }).map((_, k) => (
            <mesh key={k} position={[1.39, -l / 2 + 1 + k * 1.6, 0]} rotation={[0, Math.PI / 2, 0]} material={mats.win}>
              <circleGeometry args={[0.22, 16]} />
            </mesh>
          ))}
          <mesh position={[0, l / 2, 0]} material={mats.accent}>
            <cylinderGeometry args={[1.42, 1.42, 0.2, 32]} />
          </mesh>
        </group>
      ))}
      {/* parabole */}
      <group position={[-31, y(-31, -22) + 4, -22]} rotation={[0.6, 0.8, 0]}>
        <mesh material={mats.hull} castShadow>
          <sphereGeometry args={[2.4, 32, 12, 0, Math.PI * 2, 0, 0.5]} />
        </mesh>
        <mesh position={[0, -2.2, 0]} material={mats.dark}>
          <cylinderGeometry args={[0.12, 0.2, 4, 10]} />
        </mesh>
      </group>
      {/* panneaux solaires */}
      {[0, 1, 2].map((k) => (
        <group key={k} position={[-36 + k * 4.2, y(-36 + k * 4.2, -40) + 1.6, -40]} rotation={[-0.9, 0.3, 0]}>
          <mesh material={mats.panel} castShadow>
            <boxGeometry args={[3.8, 0.06, 2.2]} />
          </mesh>
        </group>
      ))}
      {/* traces de pas vers la base */}
      <pointLight position={[-14, y(-14, -18) + 2, -18]} intensity={40} distance={14} color="#ffb066" />
    </group>
  )
}

function Rocks() {
  const list = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => {
        const x = (hash(i, 7) - 0.5) * 90
        const z = -hash(i, 8) * 70 + 6
        return { id: ['moon_rock_01', 'moon_rock_02', 'moon_rock_03', 'moon_rock_05'][i % 4], x, z, s: 0.4 + hash(i, 9) ** 2 * 2.4, r: hash(i, 10) * 6 }
      }),
    [],
  )
  return (
    <group>
      {list.map((r, i) => (
        <RealModel key={i} id={r.id} p={[r.x, lunarHeight(r.x, r.z) - r.s * 0.15, r.z]} r={r.r} height={r.s} />
      ))}
    </group>
  )
}

function Astronauts() {
  const character = useGame((s) => s.user?.character ?? s.settings.character)
  const accent = fr.characters[character]?.color ?? '#F2643A'
  const a = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (a.current) a.current.rotation.y = -0.6 + Math.sin(clock.elapsedTime * 0.3) * 0.1
  })
  return (
    <group>
      <group ref={a} position={[-6, lunarHeight(-6, -12), -12]}>
        <Astronaut accent={accent} />
      </group>
      <group position={[24, lunarHeight(24, -9), -9]} rotation={[0, -1.4, 0]}>
        <Astronaut accent="#F2643A" />
      </group>
    </group>
  )
}

export function LunarScene() {
  const screen = useGame((s) => s.screen)
  const mouse = useRef({ x: 0, y: 0 })
  useFrame(({ camera, pointer, clock }) => {
    mouse.current.x += (pointer.x - mouse.current.x) * 0.03
    mouse.current.y += (pointer.y - mouse.current.y) * 0.03
    const t = clock.elapsedTime
    // plan de caméra selon l'écran (connexion, menu, réglages)
    const base = screen === 'login' ? [6, 4.2, 14] : screen === 'title' || screen === 'leaderboard' ? [2, 6, 18] : [-4, 5, 16]
    camera.position.set(base[0] + Math.sin(t * 0.05) * 1.5 + mouse.current.x * 1.2, base[1] + mouse.current.y * 0.6, base[2])
    camera.lookAt(-6 + mouse.current.x * 2, 3.5, -30)
  })
  return (
    <>
      <MilkyWay />
      <Stars count={5000} />
      <directionalLight
        position={SUN.clone().multiplyScalar(80)}
        intensity={4.2}
        color="#fff3e2"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-camera-bottom={-60}
        shadow-camera-far={220}
        shadow-bias={-0.0005}
      />
      <hemisphereLight args={['#3a4f80', '#1a1a1e', 0.35]} />
      <Ground />
      <Saturn />
      <Suspense fallback={null}>
        <Rocks />
      </Suspense>
      <Base />
      <Astronauts />
    </>
  )
}
