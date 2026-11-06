import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'

/** The rhythm shared by every pickup, so they all breathe together. */
const pulse = { value: 1 }

/** A slow golden swell, brightest along the object's outline: bright enough to read in a lit room, unlike a glow. */
function addOutlineGlow(material: THREE.MeshStandardMaterial) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uPickupPulse = pulse
    shader.fragmentShader = `uniform float uPickupPulse;\n${shader.fragmentShader}`.replace(
      '#include <emissivemap_fragment>',
      `#include <emissivemap_fragment>
      float pickupEdge = pow(1.0 - saturate(dot(normalize(normal), normalize(vViewPosition))), 2.2);
      totalEmissiveRadiance += vec3(1.0, 0.78, 0.36) * (0.36 + pickupEdge * 2.4) * uPickupPulse;`,
    )
  }
  material.customProgramCacheKey = () => 'pickup-outline'
}

/** A self-lit contribution on the item itself. No extra light or draw pass;
 * cloned materials keep shared furniture and the equipped item unchanged. */
export function highlightPickups(root: THREE.Group) {
  const changed = new Map<THREE.Mesh, { original: THREE.Material | THREE.Material[]; highlighted: THREE.Material | THREE.Material[] }>()
  const copies = new Map<THREE.Material, THREE.Material>()
  const tint = new THREE.Color('#c5e7ef').multiplyScalar(0.07)
  const highlight = (source: THREE.Material) => {
    if (!(source as THREE.MeshStandardMaterial).isMeshStandardMaterial || source.transparent) return source
    let copy = copies.get(source)
    if (!copy) {
      const material = (source as THREE.MeshStandardMaterial).clone()
      material.emissive.multiplyScalar(material.emissiveIntensity).add(tint)
      material.emissiveIntensity = 1
      material.userData.pickupHighlight = true
      addOutlineGlow(material)
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
    pulse.value = 0.45 + 0.55 * Math.pow(0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.4), 2)
    // A GLTF may appear later inside its own Suspense boundary. Check twice per
    // second, reusing all existing materials instead of traversing every frame.
    if (clock.elapsedTime < nextCheck.current) return
    nextCheck.current = clock.elapsedTime + 0.5
    effect.current?.refresh()
  })
  return <group ref={root} name="pickup-highlight">{children}</group>
}
