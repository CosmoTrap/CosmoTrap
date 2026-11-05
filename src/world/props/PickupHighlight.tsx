import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'

/** A small self-lit contribution on the item itself. No extra light or draw pass;
 * cloned materials keep shared furniture and the equipped item unchanged. */
export function highlightPickups(root: THREE.Group) {
  const changed = new Map<THREE.Mesh, { original: THREE.Material | THREE.Material[]; highlighted: THREE.Material | THREE.Material[] }>()
  const copies = new Map<THREE.Material, THREE.Material>()
  const tint = new THREE.Color('#c5e7ef').multiplyScalar(0.10)
  const highlight = (source: THREE.Material) => {
    if (!(source as THREE.MeshStandardMaterial).isMeshStandardMaterial || source.transparent) return source
    let copy = copies.get(source)
    if (!copy) {
      const material = (source as THREE.MeshStandardMaterial).clone()
      material.emissive.multiplyScalar(material.emissiveIntensity).add(tint)
      material.emissiveIntensity = 1
      material.userData.pickupHighlight = true
      copy = material
      copies.set(source, copy)
    }
    return copy
  }
  return {
    refresh() {
      root.traverseVisible(object => {
        const mesh = object as THREE.Mesh
        if (!mesh.isMesh || changed.has(mesh)) return
        const original = mesh.material
        const highlighted = Array.isArray(original) ? original.map(highlight) : highlight(original)
        if (highlighted !== original) {
          changed.set(mesh, { original, highlighted })
          mesh.material = highlighted
        }
      })
    },
    dispose() {
      changed.forEach(({ original, highlighted }, mesh) => { if (mesh.material === highlighted) mesh.material = original })
      copies.forEach(material => material.dispose())
      changed.clear(); copies.clear()
    },
  }
}

export function PickupHighlight({ children }: { children: ReactNode }) {
  const root = useRef<THREE.Group>(null)
  const effect = useRef<ReturnType<typeof highlightPickups> | null>(null)
  const nextCheck = useRef(0)
  useLayoutEffect(() => {
    if (!root.current) return
    const highlight = highlightPickups(root.current)
    effect.current = highlight
    highlight.refresh()
    return () => { effect.current = null; highlight.dispose() }
  }, [children])
  useFrame(({ clock }) => {
    // A GLTF may appear later inside its own Suspense boundary. Check twice per
    // second, reusing all existing materials instead of traversing every frame.
    if (clock.elapsedTime < nextCheck.current) return
    nextCheck.current = clock.elapsedTime + 0.5
    effect.current?.refresh()
  })
  return <group ref={root} name="pickup-highlight">{children}</group>
}
