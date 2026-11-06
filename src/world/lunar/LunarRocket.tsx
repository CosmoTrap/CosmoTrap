import { useFrame } from '@react-three/fiber'
import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'
import { useRef } from 'react'
import * as THREE from 'three'
import { ROCKET } from '../../game/lunar/map'
import { G } from '../../game/state'
import { useMats } from '../materials'
import { ENGINES, HERMES, HermesModel } from '../cine/Hermes'
import { Box, Cyl } from '../props/models'
import { StaticBatch } from '../props/StaticBatch'

/** Height of the engine bells' exits above the pad, standing on its legs. */
const LIFT = 0.9
/** The Hermès's lowest point (its bells) relative to its own origin. */
const BELLS = HERMES.tail - 1.5
export const ROCKET_HEIGHT = HERMES.nose - BELLS + LIFT

/** The same Hermès as the station's, standing on its pad, nose up, ready for the return flight. */
export function LunarRocket() {
  const m = useMats(), body = useRef<THREE.Group>(null), exhaust = useRef<THREE.Group>(null)
  const fire = useRef<THREE.PointLight>(null)
  useFrame(() => {
    const t = G().cine === 'lunarLaunch' ? (performance.now() - G().cineT0) / 1000 : 0
    if (body.current) body.current.position.y = Math.max(0, t - 3) ** 2 * 1.6
    if (exhaust.current) { exhaust.current.visible = t > 2.7; exhaust.current.scale.y = .95 + Math.sin(t * 36) * .05 }
    if (fire.current) fire.current.intensity = t > 2.7 ? 90 : 0
  })
  const steel = m.metal('#8f989e', 0.3), dark = m.metal('#3c4449', 0.45)
  const legAngles = [Math.PI / 4, 3 * Math.PI / 4, 5 * Math.PI / 4, 7 * Math.PI / 4]
  return <group position={[ROCKET[0], 0, ROCKET[1]]} name="lunar-rocket">
    <group ref={body} name="lunar-rocket-body">
      {/* Model axes: nose towards +z; turned so the nose points up and the bells sit just above the pad. */}
      <group position={[0, LIFT - BELLS, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <HermesModel />
      </group>
      {/* Four landing legs between the fins, with their foot pads. */}
      {legAngles.map((a) => <group key={a} rotation={[0, a, 0]}>
        <Cyl a={[0.09, 0.09, 3.4]} p={[HERMES.radius + 0.75, 1.75, 0]} r={[0, 0, 0.5]} m={steel} seg={12} />
        <Cyl a={[0.06, 0.06, 2.2]} p={[HERMES.radius + 0.35, 1.0, 0]} r={[0, 0, -0.75]} m={dark} seg={10} />
        <Cyl a={[0.42, 0.5, 0.1]} p={[HERMES.radius + 1.6, 0.06, 0]} m={dark} seg={20} />
      </group>)}
      <group ref={exhaust} name="lunar-engine-plume" visible={false}>
        {ENGINES.map(([x, y], i) => <group key={i} position={[x, LIFT, -y]}>
          <mesh position={[0, -2.6, 0]}><cylinderGeometry args={[.85, .05, 5.2, 24]} /><meshBasicMaterial color="#ff9e3d" transparent opacity={.55} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
          <mesh position={[0, -1.6, 0]}><cylinderGeometry args={[.45, .03, 3.2, 24]} /><meshBasicMaterial color="#c6e6ff" transparent opacity={.9} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
        </group>)}
      </group>
      <pointLight ref={fire} intensity={0} color="#ffb763" distance={22} position={[0, 0.4, 0]} />
    </group>
    {/* Service tower beside the rocket: lattice, an access arm and a red top light. */}
    <StaticBatch>
      <group position={[-5.4, 0, 2.6]}>
        {[[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]].map(([x, z]) => <Box key={`${x}${z}`} s={[0.14, 14, 0.14]} p={[x, 7, z]} m={steel} />)}
        {Array.from({ length: 9 }, (_, i) => 1 + i * 1.55).map((y) => <group key={y}>
          {[-0.6, 0.6].map((z) => <Box key={z} s={[1.3, 0.08, 0.08]} p={[0, y, z]} m={steel} />)}
          {[-0.6, 0.6].map((x) => <Box key={x} s={[0.08, 0.08, 1.3]} p={[x, y, 0]} m={steel} />)}
          <Box s={[0.06, 1.9, 0.06]} p={[0, y + 0.77, 0.6]} r={[0, 0, 0.66]} m={dark} />
        </group>)}
        <Box s={[2.6, 0.18, 1.0]} p={[1.9, 9.6, -1.2]} r={[0, 0.5, 0]} m={dark} />
        <mesh position={[0, 14.15, 0]} material={m.glow('#ff2a14', 2.5)}><sphereGeometry args={[0.16, 12, 8]} /></mesh>
      </group>
    </StaticBatch>
    <RigidBody type="fixed" colliders={false}>
      <CylinderCollider args={[ROCKET_HEIGHT / 2, HERMES.radius + 0.1]} position={[0, ROCKET_HEIGHT / 2, 0]} />
      {/* The fins point east, west and north; keep the player out of them. */}
      {[[1, 0], [-1, 0], [0, -1]].map(([x, z]) => <CuboidCollider key={`${x}${z}`} position={[x * 3.3, 2.2, z * 3.3]} args={[x ? 1.1 : 0.12, 1.6, z ? 1.1 : 0.12]} />)}
      <CuboidCollider position={[-5.4, 7, 2.6]} args={[0.7, 7, 0.7]} />
    </RigidBody>
  </group>
}
