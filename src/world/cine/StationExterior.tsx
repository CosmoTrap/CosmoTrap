import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { GRID_MAPS } from '../../game/maps'
import { Station } from '../TitleScene'

// The station seen from outside, as used by the cinematics: its two levels, one above the other,
// joined along the lift's axis. Floor 1 is the upper level, floor 2 the lower one, where the Hermès docks.

/** Height between the two levels of the model (m). */
export const LEVEL_GAP = 9
/** Where the Hermès sits while docked, relative to the station's centre: under it, nose towards the lower level. */
export const DOCK = new THREE.Vector3(0, -LEVEL_GAP, -20)

export function StationExterior() {
  return (
    <group name="station-exterior">
      <Station />
      <group position={[0, -LEVEL_GAP, 0]} rotation={[0, Math.PI / 4, 0]}>
        <Station />
      </group>
      {/* The lift's shaft, between the two hubs. */}
      <mesh position={[0, -LEVEL_GAP / 2, 0]}>
        <cylinderGeometry args={[1.6, 1.6, LEVEL_GAP - 3, 32, 1, true]} />
        <meshStandardMaterial color="#c9c6be" metalness={0.4} roughness={0.7} side={THREE.DoubleSide} />
      </mesh>
      {/* The docking tunnel the Hermès is moored to, on the lower level. */}
      <mesh position={[0, -LEVEL_GAP, -11]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.85, 0.85, 3.2, 24]} />
        <meshStandardMaterial color="#8d9196" metalness={0.8} roughness={0.4} />
      </mesh>
    </group>
  )
}

/** Where the zone 1 tour shows the station from outside: well away from the real rooms, above the Moon. */
export function tourBackdrop() {
  const m = GRID_MAPS[1]
  return new THREE.Vector3(Math.max(...m.grid.map((r) => r.length)), 40, m.grid.length - 230)
}

/** Visibility of the backdrop, set by the shots that need it. */
export const backdrop = { visible: false }

export function StationBackdrop() {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    if (g.current) g.current.visible = backdrop.visible
  })
  return (
    <group ref={g} position={tourBackdrop()} visible={false}>
      <StationExterior />
    </group>
  )
}
