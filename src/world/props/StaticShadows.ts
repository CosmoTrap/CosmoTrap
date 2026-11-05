import * as THREE from 'three'

const proxies = new Set<THREE.Mesh>()

/** Colour materials require separate draws, but opaque static objects sharing
 * the same shadow side can use one exact position/index buffer per room. */
export function batchStaticShadows(root: THREE.Group) {
  root.updateWorldMatrix(true, true)
  const inverse = root.matrixWorld.clone().invert()
  const groups = new Map<string, { mesh: THREE.Mesh; matrices: THREE.Matrix4[] }[]>()
  root.traverseVisible(object => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh || !mesh.castShadow || (mesh as THREE.SkinnedMesh).isSkinnedMesh || mesh.morphTargetInfluences || Array.isArray(mesh.material)) return
    const mat = mesh.material as THREE.MeshStandardMaterial
    if (!mat.visible || mat.transparent || mat.alphaTest > 0 || mat.alphaHash || mat.wireframe || mat.displacementMap || mat.clippingPlanes?.length ||
      (mat as unknown as THREE.ShaderMaterial).isShaderMaterial || mesh.customDepthMaterial || mesh.customDistanceMaterial) return
    if (mesh.geometry.drawRange.start !== 0 || mesh.geometry.drawRange.count !== Infinity) return
    const world = new THREE.Matrix4().multiplyMatrices(inverse, mesh.matrixWorld)
    const matrices: THREE.Matrix4[] = []
    const instanced = mesh as THREE.InstancedMesh
    if (instanced.isInstancedMesh) {
      for (let i = 0; i < instanced.count; i++) {
        const matrix = new THREE.Matrix4()
        instanced.getMatrixAt(i, matrix)
        matrices.push(matrix.premultiply(world))
      }
    } else matrices.push(world)
    if (matrices.some(m => m.determinant() <= 0)) return
    const key = `${mat.side}:${mat.shadowSide}:${mesh.layers.mask}`
    const list = groups.get(key) ?? []
    list.push({ mesh, matrices }); groups.set(key, list)
  })
  const originals: THREE.Mesh[] = [], batches: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[] = []
  for (const entries of groups.values()) {
    if (entries.length < 2) continue
    const vertexCount = entries.reduce((n, e) => n + e.mesh.geometry.attributes.position.count * e.matrices.length, 0)
    const indexCount = entries.reduce((n, e) => n + (e.mesh.geometry.index?.count ?? e.mesh.geometry.attributes.position.count) * e.matrices.length, 0)
    const positions = new Float32Array(vertexCount * 3), indices = new Uint32Array(indexCount)
    const v = new THREE.Vector3()
    let offset = 0, indexOffset = 0
    for (const { mesh, matrices } of entries) {
      const pos = mesh.geometry.attributes.position, index = mesh.geometry.index
      for (const matrix of matrices) {
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i).applyMatrix4(matrix).toArray(positions, (offset + i) * 3)
        }
        for (let i = 0; i < (index?.count ?? pos.count); i++) indices[indexOffset++] = offset + (index ? index.getX(i) : i)
        offset += pos.count
      }
      mesh.castShadow = false
      originals.push(mesh)
    }
    const source = entries[0].mesh
    const material = source.material as THREE.Material
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setIndex(new THREE.BufferAttribute(indices, 1))
    geometry.computeBoundingSphere()
    const batch = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ side: material.side }))
    batch.material.shadowSide = material.shadowSide
    batch.name = 'static-shadow-batch'
    batch.castShadow = true
    batch.layers.mask = source.layers.mask
    batch.matrixAutoUpdate = false
    batch.visible = false
    root.add(batch); proxies.add(batch); batches.push(batch)
  }
  return { originals, batches, dispose() {
    originals.forEach(mesh => { mesh.castShadow = true })
    batches.forEach(mesh => { proxies.delete(mesh); root.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose() })
  } }
}

/** Expose depth-only proxies solely during Three's shadow pass. The ordinary
 * colour/AO/depth passes still render every original material without proxies. */
export function installStaticShadowPass(renderer: THREE.WebGLRenderer) {
  const previous = renderer.shadowMap.render
  const render: typeof previous = function (...args) {
    proxies.forEach(mesh => { mesh.visible = true })
    try { return previous.apply(renderer.shadowMap, args) }
    finally { proxies.forEach(mesh => { mesh.visible = false }) }
  }
  renderer.shadowMap.render = render
  return () => { if (renderer.shadowMap.render === render) renderer.shadowMap.render = previous }
}
