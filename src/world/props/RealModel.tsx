import { Suspense, useLayoutEffect, useMemo } from 'react'
import * as THREE from 'three'
import { useModel } from '../assets'
import { RoomCtx, ENV_DARK, ENV_LIT } from '../materials'
import { useContext } from 'react'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { StaticBatchContext } from './StaticBatch'

// Modèle photoscanné posé proprement : au sol (centré, base à y = 0) ou contre un mur (dos à z = 0).
export interface RealModelProps {
  id: string
  fit?: 'floor' | 'wall' | 'raw'
  p?: [number, number, number]
  r?: number
  /** hauteur voulue (m) : le modèle est mis à l'échelle ; sinon taille réelle */
  height?: number
  scale?: number
  tint?: string
  shadows?: boolean
  /** Fixed collision for additional furniture, using its actual scaled bounds. */
  solid?: boolean
}

function Inner({ id, fit = 'floor', p = [0, 0, 0], r = 0, height, scale = 1, tint, shadows = true, solid = false }: RealModelProps) {
  const room = useContext(RoomCtx)
  const invalidateBatch = useContext(StaticBatchContext)
  const obj = useModel(id, { shadows, envIntensity: room.dark ? ENV_DARK : ENV_LIT, tint, shared: !!invalidateBatch })
  useLayoutEffect(() => { invalidateBatch?.(); return () => invalidateBatch?.() }, [obj, invalidateBatch])
  const { offset, k, center, half } = useMemo(() => {
    const b = new THREE.Box3().setFromObject(obj)
    const size = b.getSize(new THREE.Vector3())
    const k = (height ? height / Math.max(size.y, 1e-3) : 1) * scale
    const c = b.getCenter(new THREE.Vector3())
    const offset = new THREE.Vector3(-c.x, -b.min.y, fit === 'wall' ? -b.min.z : -c.z)
    if (fit === 'raw') offset.set(0, 0, 0)
    return { offset, k, center: c.add(offset).multiplyScalar(k).toArray() as [number, number, number],
      half: size.multiplyScalar(k / 2).toArray() as [number, number, number] }
  }, [obj, height, scale, fit])
  return (
    <group position={p} rotation={[0, r, 0]}>
      <group scale={k}><primitive object={obj} position={offset} /></group>
      {solid && <RigidBody type="fixed" colliders={false}><CuboidCollider args={half} position={center} /></RigidBody>}
    </group>
  )
}

export function RealModel(props: RealModelProps) {
  return (
    <Suspense fallback={null}>
      <Inner {...props} />
    </Suspense>
  )
}
