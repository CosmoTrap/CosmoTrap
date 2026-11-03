import { useMemo, type ReactNode } from 'react'
import * as THREE from 'three'
import { useGame } from '../../game/state'
import type { Ent } from '../../game/types'
import { useMats } from '../materials'
import { Box, Cyl } from '../props/models'
import { textTexture } from '../textures'
import { photoSurface } from '../photomaterials'

// Objets interactifs de la zone 4 (Terre).

function CapsuleHatch() {
  // l'écoutille est portée par le modèle de capsule ; ici rien de plus (zone de détection seule)
  return null
}

function AntennaItem() {
  const m = useMats()
  return (
    <group rotation={[0, 0.6, Math.PI / 2 - 0.08]}>
      <Cyl a={[0.012, 0.02, 1.4]} p={[0, 0.7, 0]} m={m.metal('#c0c4c8', 0.25)} seg={8} />
      <Box s={[0.08, 0.1, 0.08]} p={[0, 0.02, 0]} m={m.plastic('#2a2c30')} />
      <Cyl a={[0.006, 0.006, 0.3]} p={[0, 0.0, 0.1]} r={[Math.PI / 2, 0, 0]} m={m.rubber()} seg={6} />
    </group>
  )
}

function Lighter() {
  const m = useMats()
  return (
    <group>
      <Box s={[0.04, 0.06, 0.015]} p={[0, 0.03, 0]} m={m.metal('#9aa0a6', 0.2)} />
    </group>
  )
}

function TrailSign() {
  const m = useMats()
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: textTexture(['REFUGE · HÉLISURFACE ↑', 'Pont de cordes'], { w: 512, h: 160, bg: '#6b4a2a', fg: '#f4ead2', size: 34, pad: 24, font: '700 34px Rajdhani, sans-serif' }), roughness: 0.85 }), [])
  return (
    <group>
      <Box s={[0.1, 1.6, 0.1]} p={[0, 0.8, 0]} m={m.fabric('#5a3e24')} />
      <Box s={[0.9, 0.3, 0.05]} p={[0, 1.4, 0.06]} r={[0, 0, 0.05]} m={m.fabric('#6b4a2a')} />
      <mesh position={[0, 1.4, 0.09]} rotation={[0, 0, 0.05]} material={mat}>
        <planeGeometry args={[0.86, 0.27]} />
      </mesh>
    </group>
  )
}

function BridgeAnchor() {
  const m = useMats()
  return (
    <group>
      {[-0.9, 0.9].map((x) => (
        <Cyl key={x} a={[0.1, 0.12, 1.4]} p={[x, 0.5, 0]} m={m.fabric('#5a3e24')} seg={10} />
      ))}
      <mesh position={[0, 0.15, 0.4]} rotation={[Math.PI / 2, 0, 0]} material={m.fabric('#b8a27a')}>
        <torusGeometry args={[0.25, 0.04, 8, 20]} />
      </mesh>
    </group>
  )
}

function RadioBeacon() {
  const m = useMats()
  const on = useGame((s) => s.flags.beacon)
  return (
    <group>
      <Box s={[0.5, 0.35, 0.35]} p={[0, 0.175, 0]} m={m.painted('#d8a020', 0.5, 0.3)} />
      <Box s={[0.36, 0.2, 0.01]} p={[0, 0.2, 0.18]} m={m.plastic('#1b1d20', 0.3)} />
      <mesh position={[0.15, 0.36, 0]} material={m.glow(on ? '#38ff7a' : '#ff2a1a', on ? 6 : 2)}>
        <sphereGeometry args={[0.025, 10, 8]} />
      </mesh>
      <Cyl a={[0.04, 0.04, 0.04]} p={[-0.12, 0.2, 0.19]} r={[Math.PI / 2, 0, 0]} m={m.metal('#8d9196')} />
      {on && <Cyl a={[0.008, 0.012, 1.4]} p={[-0.18, 1.05, 0]} m={m.metal('#c0c4c8', 0.25)} seg={8} />}
    </group>
  )
}

function FlareCrate() {
  const m = useMats()
  const taken = useGame((s) => s.taken.includes('4:flareGun'))
  return (
    <group>
      <Box s={[0.8, 0.45, 0.5]} p={[0, 0.225, 0]} m={m.painted('#c5302a', 0.55, 0.2)} />
      <Box s={[0.82, 0.04, 0.52]} p={[0, 0.46, -0.24]} r={[-1.2, 0, 0]} m={m.painted('#c5302a', 0.55, 0.2)} />
      {!taken && (
        <group position={[0, 0.48, 0]} rotation={[0, 0.4, 0]}>
          <Box s={[0.22, 0.06, 0.05]} m={m.plastic('#ff6b1a', 0.4)} />
          <Box s={[0.05, 0.12, 0.04]} p={[-0.06, -0.05, 0]} r={[0, 0, 0.3]} m={m.plastic('#ff6b1a', 0.4)} />
          <Cyl a={[0.025, 0.025, 0.12]} p={[0.14, 0.01, 0]} r={[0, 0, Math.PI / 2]} m={m.plastic('#ff6b1a', 0.4)} seg={10} />
        </group>
      )}
    </group>
  )
}

function MapItem() {
  const m = useMats()
  return <Box s={[0.25, 0.01, 0.18]} r={[0, 0.3, 0]} m={m.fabric('#e8dcc0')} />
}

function HelipadPanel() {
  return null
}

function RiverSpot() {
  return null
}

export const ZONE4_ENT_MODELS: Record<string, (e: Ent) => ReactNode> = {
  capsuleHatch: () => <CapsuleHatch />,
  antennaItem: () => <AntennaItem />,
  lighter: () => <Lighter />,
  trailSign: () => <TrailSign />,
  riverSpot: () => <RiverSpot />,
  bridgeAnchor: () => <BridgeAnchor />,
  radioBeacon: () => <RadioBeacon />,
  flareCrate: () => <FlareCrate />,
  mapItem: () => <MapItem />,
  helipadPanel: () => <HelipadPanel />,
}

let woodCache: THREE.MeshStandardMaterial | null = null
export function woodMat() {
  if (!woodCache) {
    const s = photoSurface('wood')
    woodCache = new THREE.MeshStandardMaterial({ ...s, color: '#e3d4bc', roughness: 0.95, metalness: 0, normalScale: new THREE.Vector2(0.65, 0.65) })
  }
  return woodCache
}
