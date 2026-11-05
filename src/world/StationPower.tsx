import { useFrame } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import { useLayoutEffect, useRef, type RefObject } from 'react'
import * as THREE from 'three'
import { stationPowerDown } from './roomPower'

/** Switch off decorative screens/strips too, including late GLTF loads and batches.
 * Backup beacons, door warnings and pickup highlighting have their own circuits. */
export function StationPower({ root }: { root: RefObject<THREE.Group> }) {
  const active = useProgress(s => s.active)
  const dirty = useRef(true)
  const materials = useRef(new Set<THREE.MeshStandardMaterial>())
  const saved = useRef(new Map<THREE.MeshStandardMaterial, number>())
  useLayoutEffect(() => { dirty.current = true }, [active])
  useLayoutEffect(() => () => { saved.current.forEach((value, m) => { m.emissiveIntensity = value }) }, [])
  useFrame(() => {
    if (dirty.current && root.current) {
      root.current.traverse(o => {
        const material = (o as THREE.Mesh).material
        for (const m of material ? Array.isArray(material) ? material : [material] : []) {
          if ('emissiveIntensity' in m && !m.userData.backupCircuit && !m.userData.pickupHighlight) materials.current.add(m as THREE.MeshStandardMaterial)
        }
      })
      dirty.current = false
    }
    if (stationPowerDown()) {
      materials.current.forEach(m => {
        if (!saved.current.has(m)) saved.current.set(m, m.emissiveIntensity)
        m.emissiveIntensity = 0
      })
    } else if (saved.current.size) {
      saved.current.forEach((value, m) => { m.emissiveIntensity = value })
      saved.current.clear()
    }
  }, 0.8)
  return null
}
