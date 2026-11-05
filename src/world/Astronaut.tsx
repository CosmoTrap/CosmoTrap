import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { photoSurface } from './photomaterials'
import { skinOf } from './skins'

// Personnage construit en code. Sans `skin` (ou avec Inès) : astronaute réaliste (combinaison EVA,
// sac PLSS, casque à visière dorée). Avec `skin` : même corps, mais tête, teintes et queue de l'espèce.
// Utilisé pour l'hologramme, l'écran de fin et les cinématiques.

export interface AstronautHandle {
  root: THREE.Group | null
  armR: THREE.Group | null
  armL: THREE.Group | null
  foreR: THREE.Group | null
  head: THREE.Group | null
}

export const Astronaut = forwardRef<AstronautHandle, { accent?: string; override?: THREE.Material; castShadow?: boolean; skin?: string }>(function Astronaut({ accent = '#d9673a', override, castShadow = true, skin }, ref) {
  const look = skinOf(skin)
  const species = skin && !look.helmet ? skin : null
  const root = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const foreR = useRef<THREE.Group>(null)
  const head = useRef<THREE.Group>(null)
  useImperativeHandle(ref, () => ({ root: root.current, armR: armR.current, armL: armL.current, foreR: foreR.current, head: head.current }))
  const mats = useMemo(() => {
    if (override) return { suit: override, soft: override, accent: override, visor: override, metal: override, dark: override, pack: override, body: override, boots: override, glow: override, ink: override }
    const fabric = photoSurface('fabric', 3)
    const weave = { normalMap: fabric.normalMap, normalScale: new THREE.Vector2(0.22, 0.22), roughnessMap: fabric.roughnessMap }
    return {
      suit: new THREE.MeshStandardMaterial({ ...weave, color: look.suit, roughness: 0.88, metalness: 0 }),
      soft: new THREE.MeshStandardMaterial({ ...weave, color: look.soft, roughness: 0.95 }),
      accent: new THREE.MeshStandardMaterial({ color: accent, roughness: 0.7 }),
      visor: new THREE.MeshPhysicalMaterial({ color: '#c99a35', metalness: 1, roughness: 0.08, clearcoat: 1, envMapIntensity: 2 }),
      metal: new THREE.MeshStandardMaterial({ color: '#b7bbc0', metalness: 1, roughness: 0.3 }),
      dark: new THREE.MeshStandardMaterial({ color: '#2a2c30', roughness: 0.7, metalness: 0.2 }),
      pack: new THREE.MeshStandardMaterial({ color: '#dcd8ce', roughness: 0.7, metalness: 0.05 }),
      body: new THREE.MeshStandardMaterial({ color: look.body, roughness: skin === 'kenji' ? 0.35 : 0.8, metalness: skin === 'kenji' ? 0.7 : 0 }),
      boots: new THREE.MeshStandardMaterial({ color: look.boots, roughness: 0.7, metalness: 0.2 }),
      glow: new THREE.MeshStandardMaterial({ color: '#000', emissive: look.emissive ?? accent, emissiveIntensity: 2.4 }),
      ink: new THREE.MeshStandardMaterial({ color: '#141033', roughness: 0.5 }),
    }
  }, [accent, override, look, skin])
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
          <mesh position={[0, 0.06, 0.04]} material={mats.boots} castShadow={S}>
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
      {/* sac de survie (PLSS) : réservé à l'astronaute */}
      {!species && (
        <>
          <mesh position={[0, 1.22, -0.25]} material={mats.pack} castShadow={S}>
            <boxGeometry args={[0.46, 0.6, 0.24]} />
          </mesh>
          <mesh position={[0, 1.22, -0.375]} material={mats.dark}>
            <boxGeometry args={[0.36, 0.45, 0.01]} />
          </mesh>
        </>
      )}
      {/* queue : félin et saurien */}
      {(species === 'leo' || species === 'sam') && (
        <group position={[0, 0.9, -0.14]} rotation={[-1.05, 0, 0]}>
          {cap(species === 'sam' ? 0.07 : 0.04, 0.55, mats.body, [0, -0.3, 0])}
          <group position={[0, -0.6, 0]} rotation={[-0.7, 0, 0]}>
            {cap(species === 'sam' ? 0.045 : 0.035, 0.3, mats.body, [0, -0.15, 0])}
          </group>
        </group>
      )}
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
            <mesh position={[0, -0.33, 0.03]} material={species ? mats.body : mats.dark} castShadow={S}>
              <boxGeometry args={[0.1, 0.13, 0.08]} />
            </mesh>
          </group>
        </group>
      ))}
      {/* tête de l'espèce */}
      {species && (
        <group ref={head} position={[0, 1.64, 0.01]}>
          <SpeciesHead id={species} m={mats} shadow={S} />
        </group>
      )}
      {/* casque */}
      {!species && (
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
      )}
    </group>
  )
})

type HeadMats = Record<'body' | 'glow' | 'ink' | 'accent' | 'dark' | 'suit', THREE.Material>

function Ball({ m, p, s, shadow }: { m: THREE.Material; p: [number, number, number]; s: [number, number, number]; shadow?: boolean }) {
  return (
    <mesh position={p} scale={s} material={m} castShadow={shadow}>
      <sphereGeometry args={[1, 20, 14]} />
    </mesh>
  )
}

/** têtes non humaines (mêmes proportions que le casque, tournées vers +Z) */
function SpeciesHead({ id, m, shadow }: { id: string; m: HeadMats; shadow: boolean }) {
  const eyes = (x: number, y: number, z: number, r: number, mat: THREE.Material) => (
    <>
      <Ball m={mat} p={[-x, y, z]} s={[r, r, r * 0.5]} />
      <Ball m={mat} p={[x, y, z]} s={[r, r, r * 0.5]} />
    </>
  )
  const neck = (
    <mesh position={[0, 0.02, 0]} material={m.body}>
      <cylinderGeometry args={[0.07, 0.09, 0.1, 14]} />
    </mesh>
  )
  if (id === 'leo')
    return (
      <>
        {neck}
        <Ball m={m.body} p={[0, 0.17, 0]} s={[0.17, 0.16, 0.16]} shadow={shadow} />
        <Ball m={m.suit} p={[0, 0.11, 0.11]} s={[0.08, 0.06, 0.07]} />
        {eyes(0.07, 0.2, 0.14, 0.024, m.ink)}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.11, 0.33, 0]} rotation={[0, 0, -s * 0.25]} material={m.body} castShadow={shadow}>
            <coneGeometry args={[0.05, 0.11, 4]} />
          </mesh>
        ))}
      </>
    )
  if (id === 'nova')
    return (
      <>
        {neck}
        <Ball m={m.body} p={[0, 0.17, 0]} s={[0.15, 0.18, 0.15]} shadow={shadow} />
        {eyes(0.065, 0.19, 0.125, 0.04, m.ink)}
        {eyes(0.065, 0.19, 0.145, 0.018, m.glow)}
        {[-1, 1].map((s) => (
          <group key={s}>
            <mesh position={[s * 0.08, 0.36, 0]} rotation={[0, 0, -s * 0.5]} material={m.body}>
              <cylinderGeometry args={[0.006, 0.01, 0.12, 6]} />
            </mesh>
            <Ball m={m.glow} p={[s * 0.115, 0.42, 0]} s={[0.022, 0.022, 0.022]} />
          </group>
        ))}
      </>
    )
  if (id === 'kenji')
    return (
      <>
        {neck}
        <mesh position={[0, 0.17, 0]} material={m.body} castShadow={shadow}>
          <boxGeometry args={[0.28, 0.26, 0.26]} />
        </mesh>
        <mesh position={[0, 0.19, 0.132]} material={m.ink}>
          <boxGeometry args={[0.23, 0.08, 0.01]} />
        </mesh>
        <mesh position={[-0.06, 0.19, 0.139]} material={m.glow}>
          <boxGeometry args={[0.07, 0.03, 0.005]} />
        </mesh>
        <mesh position={[0.06, 0.19, 0.139]} material={m.glow}>
          <boxGeometry args={[0.07, 0.03, 0.005]} />
        </mesh>
        <mesh position={[0, 0.36, 0]} material={m.dark}>
          <cylinderGeometry args={[0.006, 0.006, 0.11, 6]} />
        </mesh>
        <Ball m={m.glow} p={[0, 0.42, 0]} s={[0.018, 0.018, 0.018]} />
      </>
    )
  if (id === 'sam')
    return (
      <>
        {neck}
        <Ball m={m.body} p={[0, 0.18, -0.01]} s={[0.15, 0.14, 0.16]} shadow={shadow} />
        <Ball m={m.body} p={[0, 0.13, 0.13]} s={[0.1, 0.07, 0.11]} />
        {eyes(0.09, 0.25, 0.08, 0.035, m.ink)}
        {[-0.12, -0.04, 0.04].map((z, i) => (
          <mesh key={z} position={[0, 0.33 - i * 0.012, z]} rotation={[0.5, 0, 0]} material={m.accent}>
            <coneGeometry args={[0.022, 0.1, 5]} />
          </mesh>
        ))}
      </>
    )
  // Maya : être végétal, couronne de feuilles
  return (
    <>
      {neck}
      <Ball m={m.body} p={[0, 0.17, 0]} s={[0.155, 0.155, 0.15]} shadow={shadow} />
      {eyes(0.06, 0.18, 0.13, 0.024, m.ink)}
      {[-0.9, -0.45, 0, 0.45, 0.9].map((a) => (
        <group key={a} position={[0, 0.27, -0.01]} rotation={[0, 0, -a]}>
          <mesh position={[0, 0.1, 0]} scale={[0.05, 0.12, 0.02]} material={m.body} castShadow={shadow}>
            <sphereGeometry args={[1, 10, 8]} />
          </mesh>
        </group>
      ))}
      <Ball m={m.accent} p={[0.1, 0.3, 0.07]} s={[0.03, 0.03, 0.02]} />
    </>
  )
}
