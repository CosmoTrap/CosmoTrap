import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { photoSurface } from './photomaterials'

// Astronaute réaliste construit en code (combinaison EVA, sac PLSS, casque à visière dorée).
// Utilisé pour l'hologramme, l'écran de fin et l'aperçu du personnage.

export interface AstronautHandle {
  root: THREE.Group | null
  armR: THREE.Group | null
  armL: THREE.Group | null
  foreR: THREE.Group | null
  head: THREE.Group | null
}

export const Astronaut = forwardRef<AstronautHandle, { accent?: string; override?: THREE.Material; castShadow?: boolean }>(function Astronaut({ accent = '#d9673a', override, castShadow = true }, ref) {
  const root = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const foreR = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  useImperativeHandle(ref, () => ({ root: root.current, armR: armR.current, armL: armL.current, foreR: foreR.current, head: head.current }))
  const mats = useMemo(() => {
    if (override) return { suit: override, soft: override, accent: override, visor: override, metal: override, dark: override, pack: override }
    const fabric = photoSurface('fabric', 3)
    const weave = { normalMap: fabric.normalMap, normalScale: new THREE.Vector2(0.22, 0.22), roughnessMap: fabric.roughnessMap }
    return {
      suit: new THREE.MeshStandardMaterial({ ...weave, color: '#e9e6de', roughness: 0.88, metalness: 0 }),
      soft: new THREE.MeshStandardMaterial({ ...weave, color: '#d8d4ca', roughness: 0.95 }),
      accent: new THREE.MeshStandardMaterial({ color: accent, roughness: 0.7 }),
      visor: new THREE.MeshPhysicalMaterial({ color: '#c99a35', metalness: 1, roughness: 0.08, clearcoat: 1, envMapIntensity: 2 }),
      metal: new THREE.MeshStandardMaterial({ color: '#b7bbc0', metalness: 1, roughness: 0.3 }),
      dark: new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: 0.7, metalness: 0.2 }),
      pack: new THREE.MeshStandardMaterial({ color: '#dcd8ce', roughness: 0.7, metalness: 0.05 }),
    }
  }, [accent, override])
  const S = castShadow
  const cap = (r: number, l: number, m: THREE.Material, p: [number, number, number], rot?: [number, number, number]) => (
    <mesh position={p} rotation={rot} material={m} castShadow={S}>
      <capsuleGeometry args={[r, l, 8, 16]} />
    </mesh>
  )
  return (
    <group ref={root}>
      {/* jambes */}
      {[-1, 1].map((s) => (
        <group key={s} position={[s * 0.13, 0, 0]}>
          {cap(0.095, 0.32, mats.suit, [0, 0.62, 0])}
          <mesh position={[0, 0.43, 0.02]} material={mats.soft} castShadow={S}>
            <sphereGeometry args={[0.1, 14, 10]} />
          </mesh>
          {cap(0.085, 0.28, mats.suit, [0, 0.27, 0])}
          <mesh position={[0, 0.06, 0.04]} material={mats.dark} castShadow={S}>
            <boxGeometry args={[0.16, 0.12, 0.3]} />
          </mesh>
          <mesh position={[0, 0.0, 0.04]} material={mats.metal}>
            <boxGeometry args={[0.17, 0.02, 0.31]} />
          </mesh>
          <mesh position={[0, 0.7, 0.095]} material={mats.accent}>
            <boxGeometry args={[0.1, 0.04, 0.01]} />
          </mesh>
        </group>
      ))}
      {/* bassin et torse */}
      <mesh position={[0, 0.88, 0]} material={mats.soft} castShadow={S}>
        <boxGeometry args={[0.38, 0.18, 0.26]} />
      </mesh>
      {cap(0.2, 0.32, mats.suit, [0, 1.18, 0])}
      <mesh position={[0, 1.3, 0.16]} material={mats.pack} castShadow={S}>
        <boxGeometry args={[0.3, 0.2, 0.1]} />
      </mesh>
      {[-0.08, 0, 0.08].map((x, i) => (
        <mesh key={x} position={[x, 1.32, 0.215]} material={i === 1 ? mats.accent : mats.dark}>
          <cylinderGeometry args={[0.018, 0.018, 0.02, 10]} />
        </mesh>
      ))}
      <mesh position={[0.12, 1.18, 0.19]} material={mats.accent}>
        <boxGeometry args={[0.1, 0.06, 0.01]} />
      </mesh>
      {/* sac de survie (PLSS) */}
      <mesh position={[0, 1.22, -0.25]} material={mats.pack} castShadow={S}>
        <boxGeometry args={[0.46, 0.6, 0.24]} />
      </mesh>
      <mesh position={[0, 1.22, -0.375]} material={mats.dark}>
        <boxGeometry args={[0.36, 0.45, 0.01]} />
      </mesh>
      {/* bras */}
      {[-1, 1].map((s) => (
        <group key={s} ref={s > 0 ? armR : armL} position={[s * 0.27, 1.38, 0]}>
          <mesh material={mats.soft} castShadow={S}>
            <sphereGeometry args={[0.11, 14, 10]} />
          </mesh>
          {cap(0.075, 0.22, mats.suit, [s * 0.02, -0.2, 0])}
          <group ref={s > 0 ? foreR : undefined} position={[s * 0.02, -0.36, 0]}>
            {cap(0.07, 0.2, mats.suit, [0, -0.14, 0.02])}
            <mesh position={[0, -0.25, 0.02]} material={mats.accent}>
              <cylinderGeometry args={[0.078, 0.078, 0.04, 14]} />
            </mesh>
            <mesh position={[0, -0.33, 0.03]} material={mats.dark} castShadow={S}>
              <boxGeometry args={[0.1, 0.13, 0.08]} />
            </mesh>
          </group>
        </group>
      ))}
      {/* casque */}
      <group ref={head} position={[0, 1.64, 0.01]}>
        <mesh material={mats.metal}>
          <cylinderGeometry args={[0.15, 0.17, 0.06, 24]} />
        </mesh>
        <mesh position={[0, 0.15, 0]} material={mats.suit} castShadow={S}>
          <sphereGeometry args={[0.18, 28, 20]} />
        </mesh>
        <mesh position={[0, 0.15, 0.02]} rotation={[0.15, 0, 0]} material={mats.visor}>
          <sphereGeometry args={[0.176, 28, 20, Math.PI * 0.12, Math.PI * 0.76, Math.PI * 0.22, Math.PI * 0.42]} />
        </mesh>
        <mesh position={[0.1, 0.3, 0.04]} material={mats.dark}>
          <boxGeometry args={[0.05, 0.03, 0.06]} />
        </mesh>
      </group>
    </group>
  )
})
