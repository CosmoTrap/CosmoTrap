import { useFrame } from '@react-three/fiber'
import { RigidBody, type RapierRigidBody } from '@react-three/rapier'
import { useRef, type ReactNode } from 'react'
import { G, useGame } from '../../game/state'
import { PropColliders } from './SolidProps'

type V3 = [number, number, number]

/** Model and collision shape move together; the cart stays upright on its wheels. */
export function PushableProp({ id, model, position, rotation, children }: {
  id: string; model: string; position: V3; rotation: number; children: ReactNode
}) {
  const body = useRef<RapierRigidBody>(null)
  const start = useRef(G().propPositions[id] ?? position)
  useFrame(() => {
    const b = body.current
    if (!b) return
    const s = G()
    if (s.paused || s.cine || s.tabletOpen || s.puzzle || s.readNote || s.settingsOpen) {
      b.setLinvel({ x: 0, y: 0, z: 0 }, false)
    }
    const p = b.translation()
    const old = s.propPositions[id]
    if (!old || Math.hypot(p.x - old[0], p.z - old[2]) > 0.02) {
      useGame.setState({ propPositions: { ...s.propPositions, [id]: [p.x, p.y, p.z] } })
    }
  })
  return <RigidBody ref={body} name={id} type="dynamic" colliders={false}
    position={start.current} rotation={[0, rotation, 0]} mass={45}
    enabledTranslations={[true, false, true]} enabledRotations={[false, false, false]}
    linearDamping={6} friction={0.25} restitution={0} ccd>
    {children}
    <PropColliders model={model} />
  </RigidBody>
}
