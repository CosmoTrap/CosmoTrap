import { Suspense, useMemo } from 'react'
import * as THREE from 'three'
import { useModel } from '../assets'
import { RoomCtx, ENV_DARK, ENV_LIT } from '../materials'
import { useContext } from 'react'

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
}

function Inner({ id, fit = 'floor', p = [0, 0, 0], r = 0, height, scale = 1, tint, shadows = true }: RealModelProps) {
  const room = useContext(RoomCtx)
  const obj = useModel(id, { shadows, envIntensity: room.dark ? ENV_DARK : ENV_LIT, tint })
  const { offset, k } = useMemo(() => {
    const b = new THREE.Box3().setFromObject(obj)
    const size = b.getSize(new THREE.Vector3())
    const k = (height ? height / Math.max(size.y, 1e-3) : 1) * scale
    const c = b.getCenter(new THREE.Vector3())
    const offset = new THREE.Vector3(-c.x, -b.min.y, fit === 'wall' ? -b.min.z : -c.z)
    if (fit === 'raw') offset.set(0, 0, 0)
    return { offset, k }
  }, [obj, height, scale, fit])
  return (
    <group position={p} rotation={[0, r, 0]} scale={k}>
      <primitive object={obj} position={offset} />
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
