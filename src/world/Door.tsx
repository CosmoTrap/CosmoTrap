import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { audio } from '../game/audio/audio'
import { CEIL } from '../game/maps'
import { doorUnlocked } from '../game/logic'
import { live } from '../game/state'
import { useMats } from './materials'
import { Box, Cyl, Screen } from './props/models'

export const DOOR_HEIGHT = 2.3

/** Pressure bulkhead: bevelled armour, recessed panels and continuous header. */
export function Door({ id, x, z, alongZ }: { id: string; x: number; z: number; alongZ: boolean; room: string }) {
  const m = useMats()
  const left = useRef<THREE.Group>(null), right = useRef<THREE.Group>(null)
  const anim = useRef(0), target = useRef(0)
  const [closed, setClosed] = useState(true)
  const lamp = useMemo(() => new THREE.MeshStandardMaterial({ color: '#081218', emissive: '#ff4128', emissiveIntensity: 2.4 }), [])
  useEffect(() => () => lamp.dispose(), [lamp])
  const rot = alongZ ? 0 : Math.PI / 2
  useFrame((_, dt) => {
    const unlocked = doorUnlocked(id)
    const t = unlocked && Math.hypot(live.pos[0] - x, live.pos[2] - z) < 2.9 ? 1 : 0
    if (t !== target.current) {
      target.current = t
      audio.sfx('door_open', { pos: [x, 1.4, z], vol: t ? 0.9 : 0.5 })
    }
    anim.current = THREE.MathUtils.damp(anim.current, target.current, target.current ? 3.2 : 4, dt)
    const k = THREE.MathUtils.smootherstep(anim.current, 0, 1)
    if (left.current) left.current.position.x = -0.36 - k * 0.7
    if (right.current) right.current.position.x = 0.36 + k * 0.7
    const isClosed = anim.current < 0.55
    if (isClosed !== closed) setClosed(isClosed)
    lamp.emissive.set(unlocked ? '#62d6b1' : '#ff4128')
  })
  const frame = m.painted('#343e46', 0.42, 0.7)
  const armour = m.painted('#8b979b', 0.42, 0.65)
  const recess = m.painted('#27343b', 0.5, 0.65)
  const steel = m.metal('#a3adb3', 0.26)
  const seal = m.rubber('#111b20')
  const caution = m.painted('#c78b3e', 0.52, 0.25)
  const leaf = (sign: number) => <>
    <Box s={[0.72, DOOR_HEIGHT, 0.15]} m={frame} />
    {[-1, 1].map((face) => <group key={face} rotation={[0, face === 1 ? 0 : Math.PI, 0]}>
      <Box s={[0.61, 2.12, 0.04]} p={[0, 0, 0.085]} m={recess} />
      <Box s={[0.56, 1.04, 0.035]} p={[0, 0.4, 0.115]} m={armour} />
      <Box s={[0.56, 0.61, 0.035]} p={[0, -0.62, 0.115]} m={armour} />
      <Box s={[0.025, 2.24, 0.025]} p={[-sign * face * 0.34, 0, 0.086]} m={seal} />
      <Box s={[0.035, 0.31, 0.07]} p={[-sign * face * 0.2, -0.07, 0.15]} m={steel} />
      <Box s={[0.045, 0.32, 0.012]} p={[sign * face * 0.21, 0.56, 0.14]} m={lamp} cast={false} />
      <Box s={[0.5, 0.045, 0.012]} p={[0, -0.99, 0.116]} m={caution} />
    </group>)}
  </>
  return <group name={`bulkhead:${id}`} position={[x, 0, z]} rotation={[0, rot, 0]}>
    {/* A lined tunnel, including a solid roof that remains when the leaves open. */}
    {[-1, 1].map((side) => <Box key={side} s={[0.3, CEIL, 2]} p={[side * 0.85, CEIL / 2, 0]} m={recess} />)}
    <Box s={[1.4, CEIL - DOOR_HEIGHT, 2]} p={[0, (CEIL + DOOR_HEIGHT) / 2, 0]} m={recess} />
    {[-1, 1].map((face) => <group key={face} position={[0, 0, face * 0.96]} rotation={[0, face === 1 ? 0 : Math.PI, 0]}>
      {[-1, 1].map((side) => <group key={side}>
        <Box s={[0.28, CEIL, 0.18]} p={[side * 0.85, CEIL / 2, 0]} m={armour} />
        <Box s={[0.035, DOOR_HEIGHT, 0.045]} p={[side * 0.715, DOOR_HEIGHT / 2, 0.08]} m={steel} />
        {[0.2, 2.57].map((y) => <Cyl key={y} a={[0.027, 0.027, 0.018]} p={[side * 0.85, y, 0.104]} r={[Math.PI / 2, 0, 0]} m={steel} seg={6} />)}
      </group>)}
      <Box s={[1.43, 0.45, 0.18]} p={[0, 2.575, 0]} m={frame} />
      <Box s={[1.18, 0.025, 0.012]} p={[0, 2.35, 0.1]} m={lamp} cast={false} />
      <Screen w={0.86} h={0.12} p={[0, 2.59, 0.105]} lines={['SELENE / PRESSURE SEAL']} intensity={0.2} fg="#bbcbd0" />
    </group>)}
    <Box s={[2, 0.035, 0.22]} p={[0, 2.28, 0]} m={steel} />
    <Box s={[2, 0.018, 0.22]} p={[0, 0.009, 0]} m={steel} />
    <group ref={left} position={[-0.36, DOOR_HEIGHT / 2, 0]}>{leaf(-1)}</group>
    <group ref={right} position={[0.36, DOOR_HEIGHT / 2, 0]}>{leaf(1)}</group>
    <RigidBody name={`door-frame:${id}`} type="fixed" colliders={false}>
      <CuboidCollider position={[-0.85, CEIL / 2, 0]} args={[0.15, CEIL / 2, 1.05]} />
      <CuboidCollider position={[0.85, CEIL / 2, 0]} args={[0.15, CEIL / 2, 1.05]} />
      <CuboidCollider name={`door-lintel:${id}`} position={[0, (CEIL + DOOR_HEIGHT) / 2, 0]} args={[0.7, (CEIL - DOOR_HEIGHT) / 2, 1.05]} />
      {closed && <CuboidCollider position={[0, DOOR_HEIGHT / 2, 0]} args={[0.7, DOOR_HEIGHT / 2, 0.08]} />}
    </RigidBody>
  </group>
}
