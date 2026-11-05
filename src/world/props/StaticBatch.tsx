import { useLayoutEffect, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/** Bake only fixed, opaque decoration. Keep material instances and every vertex:
 * textures, normals, lighting and shadows remain identical. Colliders are untouched.
 * Transparent and animated objects must keep their own sorting/transforms. */
export function batchStaticMeshes(root: THREE.Group) {
  root.updateWorldMatrix(true, true)
  const inverse = root.matrixWorld.clone().invert()
  const groups = new Map<string, { mesh: THREE.Mesh; geometry: THREE.BufferGeometry }[]>()
  root.traverseVisible(object => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || Array.isArray(mesh.material)) return
    const material = mesh.material
    const geometry = mesh.geometry
    if (material.transparent || (material as THREE.ShaderMaterial).isShaderMaterial || mesh.morphTargetInfluences || mesh.matrixWorld.determinant() <= 0) return
    if (geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity) return
    // Merge only compatible attribute layouts; no conversion/quantisation of data.
    const attributes = Object.entries(geometry.attributes).sort(([a], [b]) => a.localeCompare(b))
    if (attributes.some(([, a]) => (a as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute || !(a.array instanceof Float32Array))) return
    const layout = attributes.map(([name, a]) => `${name}:${a.itemSize}:${a.normalized}`).join('|')
    const key = `${material.uuid}:${mesh.castShadow}:${mesh.receiveShadow}:${mesh.renderOrder}:${mesh.layers.mask}:${!!geometry.index}:${layout}`
    const group = groups.get(key) ?? []
    group.push({ mesh, geometry }); groups.set(key, group)
  })
  const hidden: THREE.Mesh[] = []
  const batches: THREE.Mesh[] = []
  for (const entries of groups.values()) {
    if (entries.length < 2) continue
    const copies = entries.map(({ mesh, geometry }) => geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)))
    const merged = mergeGeometries(copies, false)
    copies.forEach(g => g.dispose())
    if (!merged) continue
    merged.computeBoundingBox(); merged.computeBoundingSphere()
    const source = entries[0].mesh
    const batch = new THREE.Mesh(merged, source.material)
    batch.name = 'static-decor-batch'
    batch.userData.staticBatch = true
    batch.castShadow = source.castShadow; batch.receiveShadow = source.receiveShadow
    batch.renderOrder = source.renderOrder; batch.layers.mask = source.layers.mask
    batch.matrixAutoUpdate = false
    root.add(batch); batches.push(batch)
    // Keep each prop's original geometry available for bounds and picking tools.
    entries.forEach(({ mesh }) => { mesh.visible = false; mesh.userData.staticBatchSource = true; hidden.push(mesh) })
  }
  return { originals: hidden, batches, dispose() {
    hidden.forEach(mesh => { mesh.visible = true; delete mesh.userData.staticBatchSource })
    batches.forEach(mesh => { root.remove(mesh); mesh.geometry.dispose() })
  } }
}

export function StaticBatch({ children }: { children: ReactNode }) {
  const root = useRef<THREE.Group>(null)
  useLayoutEffect(() => {
    if (!root.current) return
    const batch = batchStaticMeshes(root.current)
    return () => batch.dispose()
  }, [children])
  return <group ref={root} name="static-decoration">{children}</group>
}
