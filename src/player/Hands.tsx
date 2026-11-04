import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { live, useGame } from '../game/state'
import type { ItemId } from '../game/types'
import { photoSurface } from '../world/photomaterials'
import { skinOf } from '../world/skins'

// Vue à la 1re personne : gants + tablette 3D qui s'anime à l'ouverture, objet tenu en main.

function Glove({ side }: { side: 1 | -1 }) {
  // manches et mains aux couleurs du skin choisi (fourrure, feuillage, métal…)
  const character = useGame((s) => s.character)
  const look = skinOf(character)
  const mat = useMemo(() => {
    const s = photoSurface('fabric', 3)
    return new THREE.MeshStandardMaterial({ color: look.suit, roughness: 0.85, normalMap: s.normalMap,
      normalScale: new THREE.Vector2(0.22, 0.22), roughnessMap: s.roughnessMap })
  }, [look])
  const dark = useMemo(() => new THREE.MeshStandardMaterial({ color: look.body, roughness: 0.7, metalness: character === 'kenji' ? 0.6 : 0 }), [look, character])
  const accent = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d9673a', roughness: 0.6 }), [])
  return (
    <group>
      <mesh material={mat}>
        <capsuleGeometry args={[0.055, 0.32, 6, 12]} />
      </mesh>
      <mesh position={[0, 0.2, 0]} material={accent}>
        <cylinderGeometry args={[0.062, 0.062, 0.04, 14]} />
      </mesh>
      <mesh position={[0, 0.27, 0.01]} scale={[1, 0.8, 0.55]} material={dark}>
        <sphereGeometry args={[0.07, 14, 10]} />
      </mesh>
      <mesh position={[side * -0.045, 0.31, 0.03]} rotation={[0, 0, side * 0.6]} material={dark}>
        <capsuleGeometry args={[0.018, 0.05, 4, 8]} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[side * (0.03 - i * 0.02), 0.34, 0.035]} rotation={[0.4, 0, 0]} material={dark}>
          <capsuleGeometry args={[0.012, 0.04, 4, 6]} />
        </mesh>
      ))}
    </group>
  )
}

function HeldItem({ item }: { item: ItemId }) {
  const m = useMemo(
    () => ({
      steel: new THREE.MeshStandardMaterial({ color: '#a9adb2', metalness: 1, roughness: 0.3 }),
      red: new THREE.MeshStandardMaterial({ color: '#c5302a', roughness: 0.5 }),
      orange: new THREE.MeshStandardMaterial({ color: '#ff6b1a', roughness: 0.4 }),
      blue: new THREE.MeshStandardMaterial({ color: '#3d7bff', roughness: 0.3 }),
      rope: new THREE.MeshStandardMaterial({ color: '#b8a27a', roughness: 0.95 }),
      dark: new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: 0.6 }),
      paper: new THREE.MeshStandardMaterial({ color: '#efe6cf', roughness: 0.9 }),
      glow: new THREE.MeshStandardMaterial({ color: '#000', emissive: '#3ad7ff', emissiveIntensity: 4 }),
      fuse: new THREE.MeshStandardMaterial({ color: '#e8e2d0', roughness: 0.5 }),
    }),
    [],
  )
  switch (item) {
    case 'wrench':
      return (
        <group rotation={[0.2, 0, -0.3]}>
          <mesh material={m.steel} position={[0, 0.12, 0]}>
            <boxGeometry args={[0.035, 0.28, 0.012]} />
          </mesh>
          <mesh material={m.steel} position={[0, 0.28, 0]}>
            <boxGeometry args={[0.08, 0.05, 0.016]} />
          </mesh>
          <mesh material={m.red} position={[0, -0.02, 0]}>
            <boxGeometry args={[0.04, 0.12, 0.02]} />
          </mesh>
        </group>
      )
    case 'flareGun':
      return (
        <group rotation={[0, Math.PI / 2, 0]}>
          <mesh material={m.orange} position={[0.06, 0.06, 0]}>
            <boxGeometry args={[0.22, 0.06, 0.05]} />
          </mesh>
          <mesh material={m.orange} position={[0, 0, 0]} rotation={[0, 0, 0.3]}>
            <boxGeometry args={[0.05, 0.12, 0.04]} />
          </mesh>
        </group>
      )
    case 'badge':
      return (
        <mesh material={m.blue} rotation={[0.3, 0, 0]}>
          <boxGeometry args={[0.09, 0.06, 0.004]} />
        </mesh>
      )
    case 'rope':
      return (
        <mesh material={m.rope} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.07, 0.03, 8, 20]} />
        </mesh>
      )
    case 'cell':
      return (
        <mesh material={m.glow}>
          <cylinderGeometry args={[0.05, 0.05, 0.2, 14]} />
        </mesh>
      )
    case 'fuse':
      return (
        <mesh material={m.fuse} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.025, 0.025, 0.12, 12]} />
        </mesh>
      )
    case 'antenna':
      return (
        <mesh material={m.steel} rotation={[0.6, 0, 0]} position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.008, 0.015, 0.8, 8]} />
        </mesh>
      )
    case 'carBattery':
      return (
        <mesh material={m.dark}>
          <boxGeometry args={[0.2, 0.14, 0.12]} />
        </mesh>
      )
    case 'manual':
    case 'map':
      return (
        <mesh material={m.paper} rotation={[0.9, 0, 0]}>
          <boxGeometry args={[0.16, 0.22, 0.01]} />
        </mesh>
      )
    default:
      return null
  }
}

export function Hands() {
  const g = useRef<THREE.Group>(null)
  const tablet = useRef<THREE.Group>(null)
  const held = useRef<THREE.Group>(null)
  const open = useGame((s) => s.tabletOpen)
  const item = useGame((s) => s.held)
  const k = useRef(0)
  const screen = useMemo(() => new THREE.MeshStandardMaterial({ color: '#000', emissive: '#1b6f8a', emissiveIntensity: 1.6, roughness: 0.2 }), [])
  useFrame(({ camera, clock }, dt) => {
    if (!g.current) return
    g.current.position.copy(camera.position)
    g.current.quaternion.copy(camera.quaternion)
    k.current = THREE.MathUtils.damp(k.current, open ? 1 : 0, 7, dt)
    const e = THREE.MathUtils.smootherstep(k.current, 0, 1)
    if (tablet.current) {
      tablet.current.visible = k.current > 0.01
      tablet.current.position.set(0, -0.55 + e * 0.43, -0.45)
      tablet.current.rotation.set(-0.9 + e * 0.62, 0, (1 - e) * 0.3)
    }
    if (held.current) {
      const sw = Math.sin(clock.elapsedTime * 1.2) * 0.004 + Math.sin(live.bob) * 0.002
      held.current.visible = !!item && !open && !live.camOverride
      held.current.position.set(0.24, -0.27 + sw, -0.42)
    }
    screen.emissiveIntensity = 1.2 + Math.sin(clock.elapsedTime * 3) * 0.05
  })
  return (
    <group ref={g}>
      <group ref={tablet} visible={false}>
        <mesh>
          <boxGeometry args={[0.42, 0.29, 0.018]} />
          <meshStandardMaterial color="#2b2e33" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0, 0.0095]} material={screen}>
          <planeGeometry args={[0.39, 0.25]} />
        </mesh>
        <mesh position={[0.2, 0.13, 0.01]}>
          <boxGeometry args={[0.03, 0.01, 0.004]} />
          <meshStandardMaterial color="#000" emissive="#ff6b35" emissiveIntensity={3} />
        </mesh>
        <group position={[-0.23, -0.12, 0.02]} rotation={[0.4, 0.2, -0.5]}>
          <Glove side={-1} />
        </group>
        <group position={[0.23, -0.12, 0.02]} rotation={[0.4, -0.2, 0.5]}>
          <Glove side={1} />
        </group>
      </group>
      <group ref={held} visible={false}>
        <group rotation={[0.5, -0.2, 0.2]} position={[0.02, -0.2, 0.05]}>
          <Glove side={1} />
        </group>
        {item && <HeldItem item={item} />}
      </group>
    </group>
  )
}
