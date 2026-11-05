import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'

const BORDER = new THREE.MeshBasicMaterial({
  color: '#d7f3fb',
  side: THREE.BackSide,
  transparent: true,
  opacity: 0.55,
  depthWrite: false,
  toneMapped: false,
})

/** A thin shell around each recoverable mesh. Shared furniture and the item in hand stay plain. */
export function highlightPickups(root: THREE.Group) {
  const shells: THREE.Mesh[] = []
  return {
    refresh() {
      root.traverseVisible(object => {
        const mesh = object as THREE.Mesh
        if (!mesh.isMesh || mesh.userData.pickupBorder || (mesh as THREE.InstancedMesh).isInstancedMesh) return
        const source = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
        if (!source || source.transparent || source === BORDER) return
        const shell = new THREE.Mesh(mesh.geometry, BORDER)
        shell.name = 'pickup-border'
        shell.scale.setScalar(1.035)
        shell.renderOrder = 2
        shell.raycast = () => {}
        shell.userData.pickupBorder = true
        mesh.add(shell)
        mesh.userData.pickupBorder = true
        shells.push(shell)
      })
    },
    dispose() {
      for (const shell of shells) shell.removeFromParent()
      shells.length = 0
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
