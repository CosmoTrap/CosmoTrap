import { createContext, useCallback, useLayoutEffect, useRef, type ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { useProgress } from '@react-three/drei'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { batchStaticShadows } from './StaticShadows'

export const StaticBatchContext = createContext<(() => void) | null>(null)

/** Bake only fixed, opaque decoration. Keep material instances and every vertex:
 * textures, normals, lighting and shadows remain identical. Colliders are untouched.
 * Transparent and animated objects must keep their own sorting/transforms. */
export function batchStaticMeshes(root: THREE.Group) {
  root.updateWorldMatrix(true, true)
  const inverse = root.matrixWorld.clone().invert()
  const groups = new Map<string, { mesh: THREE.Mesh; geometry: THREE.BufferGeometry }[]>()
  const instances = new Map<string, THREE.Mesh[]>()
  root.traverseVisible(object => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh || (mesh as THREE.InstancedMesh).isInstancedMesh || Array.isArray(mesh.material)) return
    // Hiding a source mesh must never hide unbatched children (e.g. glass).
    if (mesh.children.length) return
    const material = mesh.material
    const geometry = mesh.geometry
    if (material.transparent || (material as THREE.ShaderMaterial).isShaderMaterial || mesh.morphTargetInfluences || mesh.matrixWorld.determinant() <= 0) return
    if (geometry.drawRange.start !== 0 || geometry.drawRange.count !== Infinity) return
    const instanceKey = `${geometry.uuid}:${material.uuid}:${mesh.castShadow}:${mesh.receiveShadow}:${mesh.renderOrder}:${mesh.layers.mask}`
    // Instancing's normal transform supports rotation and scale, not shear
    // introduced by rotated children of non-uniformly scaled parents.
    const matrix = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)
    const x = new THREE.Vector3().setFromMatrixColumn(matrix, 0).normalize()
    const y = new THREE.Vector3().setFromMatrixColumn(matrix, 1).normalize()
    const z = new THREE.Vector3().setFromMatrixColumn(matrix, 2).normalize()
    if (Math.max(Math.abs(x.dot(y)), Math.abs(x.dot(z)), Math.abs(y.dot(z))) < 1e-6) {
      const identical = instances.get(instanceKey) ?? []
      identical.push(mesh); instances.set(instanceKey, identical)
    }
    // Merge only compatible attribute layouts; no conversion/quantisation of data.
    const attributes = Object.entries(geometry.attributes).sort(([a], [b]) => a.localeCompare(b))
    if (attributes.some(([, a]) => (a as THREE.InterleavedBufferAttribute).isInterleavedBufferAttribute || !(a.array instanceof Float32Array))) return
    const layout = attributes.map(([name, a]) => `${name}:${a.itemSize}:${a.normalized}`).join('|')
    const key = `${material.uuid}:${mesh.castShadow}:${mesh.receiveShadow}:${mesh.renderOrder}:${mesh.layers.mask}:${!!geometry.index}:${layout}`
    const group = groups.get(key) ?? []
    group.push({ mesh, geometry }); groups.set(key, group)
  })
  const hidden: THREE.Mesh[] = []
  const transforms = new Map<THREE.Mesh, boolean>()
  const batches: THREE.Mesh[] = []
  const instancedSources = new Set<THREE.Mesh>()
  const hide = (mesh: THREE.Mesh) => {
    mesh.visible = false; mesh.userData.staticBatchSource = true; hidden.push(mesh)
    // The source remains available to bounds/picking tools, but its fixed local
    // transform need not be recomposed for every render and shadow pass.
    transforms.set(mesh, mesh.matrixAutoUpdate)
    mesh.matrixAutoUpdate = false
  }
  for (const meshes of instances.values()) {
    if (meshes.length < 2) continue
    const source = meshes[0]
    const batch = new THREE.InstancedMesh(source.geometry, source.material, meshes.length)
    meshes.forEach((mesh, i) => {
      batch.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld))
      instancedSources.add(mesh); hide(mesh)
    })
    batch.instanceMatrix.needsUpdate = true
    batch.computeBoundingBox(); batch.computeBoundingSphere()
    batch.name = 'static-decor-instances'; batch.userData.staticBatch = true
    batch.castShadow = source.castShadow; batch.receiveShadow = source.receiveShadow
    batch.renderOrder = source.renderOrder; batch.layers.mask = source.layers.mask
    batch.matrixAutoUpdate = false
    root.add(batch); batches.push(batch)
  }
  for (const group of groups.values()) {
    const entries = group.filter(({ mesh }) => !instancedSources.has(mesh))
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
    entries.forEach(({ mesh }) => hide(mesh))
  }
  return { originals: hidden, batches, dispose() {
    hidden.forEach(mesh => { mesh.visible = true; mesh.matrixAutoUpdate = transforms.get(mesh)!; delete mesh.userData.staticBatchSource })
    batches.forEach(mesh => {
      root.remove(mesh)
      if ((mesh as THREE.InstancedMesh).isInstancedMesh) (mesh as THREE.InstancedMesh).dispose()
      else mesh.geometry.dispose()
    })
  } }
}

export function StaticBatch({ children }: { children: ReactNode }) {
  const root = useRef<THREE.Group>(null)
  const batch = useRef<ReturnType<typeof batchStaticMeshes> | null>(null)
  const shadows = useRef<ReturnType<typeof batchStaticShadows> | null>(null)
  const dirty = useRef(true)
  const active = useProgress(s => s.active)
  const invalidate = useCallback(() => { dirty.current = true }, [])
  useLayoutEffect(() => {
    dirty.current = true
    return () => { shadows.current?.dispose(); shadows.current = null; batch.current?.dispose(); batch.current = null }
  }, [children])
  useFrame(() => {
    if (active || !dirty.current || !root.current) return
    shadows.current?.dispose()
    batch.current?.dispose()
    batch.current = batchStaticMeshes(root.current)
    shadows.current = batchStaticShadows(root.current)
    dirty.current = false
  }, -90)
  return <StaticBatchContext.Provider value={invalidate}><group ref={root} name="static-decoration">{children}</group></StaticBatchContext.Provider>
}
