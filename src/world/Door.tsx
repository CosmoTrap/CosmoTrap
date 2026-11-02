import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { audio } from '../game/audio/audio'
import { CEIL } from '../game/maps'
import { doorUnlocked } from '../game/logic'
import { live } from '../game/state'
import { useMats } from './materials'

// Porte de cloison coulissante à deux vantaux, avec cadre, voyant et collisions.
export function Door({ id, x, z, alongZ }: { id: string; x: number; z: number; alongZ: boolean; room: string }) {
  const m = useMats()
  const left = useRef<THREE.Group>(null)
  const right = useRef<THREE.Group>(null)
  const anim = useRef(0)
  const target = useRef(0)
  const [closed, setClosed] = useState(true)
  const lamp = useMemo(() => new THREE.MeshStandardMaterial({ color: '#000', emissive: '#ff2a1a', emissiveIntensity: 4 }), [])
  const rot = alongZ ? 0 : Math.PI / 2

  useFrame((_, dt) => {
    const unlocked = doorUnlocked(id)
    const d = Math.hypot(live.pos[0] - x, live.pos[2] - z)
    const t = unlocked && d < 2.9 ? 1 : 0
    if (t !== target.current) {
      target.current = t
      audio.sfx(t ? 'door_open' : 'door_open', { pos: [x, 1.4, z], vol: t ? 0.9 : 0.5 })
    }
    anim.current = THREE.MathUtils.damp(anim.current, target.current, target.current ? 3.2 : 4, dt)
    const k = THREE.MathUtils.smootherstep(anim.current, 0, 1)
    if (left.current) left.current.position.x = -0.36 - k * 0.7
    if (right.current) right.current.position.x = 0.36 + k * 0.7
    const isClosed = anim.current < 0.55
    if (isClosed !== closed) setClosed(isClosed)
    lamp.emissive.set(unlocked ? '#38ff7a' : '#ff2a1a')
  })

  const frameMat = m.painted('#4a4e54', 0.45, 0.6)
  const leafMat = m.painted('#8b8f94', 0.5, 0.5)
  const stripe = m.painted('#e0a92a', 0.6, 0.1)
  const leaf = (sign: number) => (
    <>
      <mesh castShadow receiveShadow material={leafMat}>
        <boxGeometry args={[0.72, 2.3, 0.09]} />
      </mesh>
      <mesh position={[0, -0.95, 0.05]} material={stripe}>
        <boxGeometry args={[0.7, 0.14, 0.01]} />
      </mesh>
      <mesh position={[0, -0.95, -0.05]} material={stripe}>
        <boxGeometry args={[0.7, 0.14, 0.01]} />
      </mesh>
      <mesh position={[sign * -0.25, 0.25, 0]} material={m.glass('#7fa6bf', 0.35)}>
        <boxGeometry args={[0.1, 0.7, 0.1]} />
      </mesh>
      <mesh position={[sign * -0.3, 0, 0.06]} material={m.metal('#b0b4b8', 0.3)}>
        <boxGeometry args={[0.04, 0.4, 0.03]} />
      </mesh>
      <mesh position={[sign * -0.3, 0, -0.06]} material={m.metal('#b0b4b8', 0.3)}>
        <boxGeometry args={[0.04, 0.4, 0.03]} />
      </mesh>
    </>
  )

  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      {[-1, 1].map((end) => (
        <group key={end} position={[0, 0, end * 0.95]}>
          <mesh position={[-0.85, CEIL / 2, 0]} castShadow receiveShadow material={frameMat}>
            <boxGeometry args={[0.3, CEIL, 0.12]} />
          </mesh>
          <mesh position={[0.85, CEIL / 2, 0]} castShadow receiveShadow material={frameMat}>
            <boxGeometry args={[0.3, CEIL, 0.12]} />
          </mesh>
          <mesh position={[0, 2.55, 0]} castShadow receiveShadow material={frameMat}>
            <boxGeometry args={[1.4, 0.5, 0.12]} />
          </mesh>
          <mesh position={[0, 2.42, end * 0.07]} material={lamp}>
            <boxGeometry args={[0.3, 0.04, 0.02]} />
          </mesh>
          {/* bandes de danger sur les montants */}
          <mesh position={[-0.71, 1.15, end * 0.065]} material={stripe}>
            <boxGeometry args={[0.02, 2.3, 0.01]} />
          </mesh>
          <mesh position={[0.71, 1.15, end * 0.065]} material={stripe}>
            <boxGeometry args={[0.02, 2.3, 0.01]} />
          </mesh>
        </group>
      ))}
      {/* rails haut et bas */}
      <mesh position={[0, 2.31, 0]} material={m.metal('#3b3e42', 0.5)}>
        <boxGeometry args={[2, 0.04, 0.16]} />
      </mesh>
      <mesh position={[0, 0.01, 0]} material={m.metal('#3b3e42', 0.5)}>
        <boxGeometry args={[2, 0.02, 0.16]} />
      </mesh>
      <group ref={left} position={[-0.36, 1.15, 0]}>
        {leaf(-1)}
      </group>
      <group ref={right} position={[0.36, 1.15, 0]}>
        {leaf(1)}
      </group>
      <RigidBody type="fixed" colliders={false}>
        <CuboidCollider position={[-0.85, CEIL / 2, 0]} args={[0.15, CEIL / 2, 1]} />
        <CuboidCollider position={[0.85, CEIL / 2, 0]} args={[0.15, CEIL / 2, 1]} />
        {closed && <CuboidCollider position={[0, 1.15, 0]} args={[0.7, 1.15, 0.06]} />}
      </RigidBody>
    </group>
  )
}
