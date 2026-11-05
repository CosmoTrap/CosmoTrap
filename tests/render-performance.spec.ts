import { expect, test } from '@playwright/test'
import * as THREE from 'three'
import { batchStaticMeshes } from '../src/world/props/StaticBatch'
import { spatialBatches } from '../src/world/zone4/spatialBatches'

test('regrouper les décors conserve sommets, UV, matériaux, ombres et nettoyage', () => {
  const root = new THREE.Group(), parent = new THREE.Group()
  root.position.set(4, 2, -8); root.rotation.y = 0.4
  parent.position.set(-2, 1, 3); parent.rotation.z = 0.2
  root.add(parent)
  const material = new THREE.MeshStandardMaterial()
  const originals = [0, 1, 2].map(i => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3), material)
    mesh.position.set(i * 2, i, -i); mesh.rotation.y = i * 0.7
    mesh.scale.set(1 + i * 0.2, 1, 0.8)
    mesh.castShadow = mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  })
  root.updateWorldMatrix(true, true)
  const worldVertices = originals.flatMap(mesh => Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, i).applyMatrix4(mesh.matrixWorld)))
  const uv = originals.flatMap(mesh => Array.from(mesh.geometry.attributes.uv.array))
  const batch = batchStaticMeshes(root)
  expect(batch.batches).toHaveLength(1)
  const merged = batch.batches[0]
  merged.updateWorldMatrix(true, false)
  worldVertices.forEach((p, i) => expect(p.distanceTo(new THREE.Vector3().fromBufferAttribute(merged.geometry.attributes.position, i).applyMatrix4(merged.matrixWorld))).toBeLessThan(0.00001))
  expect(Array.from(merged.geometry.attributes.uv.array)).toEqual(uv)
  expect(merged.geometry.index!.count).toBe(originals.reduce((n, m) => n + m.geometry.index!.count, 0))
  expect(merged.material).toBe(material)
  expect(merged.castShadow && merged.receiveShadow).toBe(true)
  expect(originals.every(m => !m.visible)).toBe(true)
  expect(originals.every(m => m.userData.staticBatchSource)).toBe(true)
  expect(merged.userData.staticBatch).toBe(true)
  let mergedDisposed = false, sourceDisposed = false
  merged.geometry.addEventListener('dispose', () => { mergedDisposed = true })
  originals[0].geometry.addEventListener('dispose', () => { sourceDisposed = true })
  batch.dispose()
  expect(originals.every(m => m.visible)).toBe(true)
  expect(originals.every(m => !m.userData.staticBatchSource)).toBe(true)
  expect(merged.parent).toBeNull()
  expect(mergedDisposed).toBe(true)
  expect(sourceDisposed).toBe(false)
})

test('les vitrages, éléments masqués et instances gardent leur rendu indépendant', () => {
  const root = new THREE.Group(), glass = new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.5 })
  const opaque = new THREE.MeshStandardMaterial(), geometry = new THREE.BoxGeometry()
  const a = new THREE.Mesh(geometry, glass), b = a.clone()
  const instanced = new THREE.InstancedMesh(geometry, opaque, 3)
  const hidden = new THREE.Mesh(geometry, opaque); hidden.visible = false
  root.add(a, b, instanced, hidden)
  const batch = batchStaticMeshes(root)
  expect(batch.batches).toHaveLength(0)
  batch.dispose()
  expect(a.visible && b.visible && instanced.visible).toBe(true)
  expect(hidden.visible).toBe(false)
})

test('les cellules de végétation conservent chaque instance et ses coordonnées exactes', () => {
  const items = Array.from({ length: 500 }, (_, i) => ({ x: (i * 17) % 140 - 70, z: (i * 7) % 130 - 90, id: i }))
  const cells = spatialBatches(items)
  const flattened = cells.flat()
  expect(flattened).toHaveLength(items.length)
  expect(new Set(flattened).size).toBe(items.length)
  items.forEach(item => expect(flattened.includes(item)).toBe(true))
  for (const cell of cells) {
    expect(Math.max(...cell.map(i => i.x)) - Math.min(...cell.map(i => i.x))).toBeLessThan(24)
    expect(Math.max(...cell.map(i => i.z)) - Math.min(...cell.map(i => i.z))).toBeLessThan(24)
  }
})

test('le calcul optimisé des lumières conserve les pixels du rendu PBR', async ({ page }) => {
  await page.route('**/api/**', r => r.fulfill({ status: 503, body: '{}' }))
  await page.goto('/')
  const errors: string[] = []
  page.on('console', m => { if (m.type() === 'error' && /Shader|WebGL/.test(m.text())) errors.push(m.text()) })
  const difference = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js' as string)
    const optimized = T.ShaderChunk.lights_fragment_begin
    const original = optimized.replaceAll('if ( directLight.visible ) { RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight ); }', 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );')
    if (original === optimized) throw new Error('Optimisation absente du shader testé')
    const renderer = new T.WebGLRenderer(), target = new T.WebGLRenderTarget(256, 192)
    renderer.shadowMap.enabled = true
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(60, 256 / 192, 0.1, 50)
    camera.position.set(0, 3, 6); camera.lookAt(0, 0, 0)
    scene.add(new T.HemisphereLight(0xffffff, 0x273544, 0.5))
    const materials: any[] = []
    for (let i = 0; i < 5; i++) {
      const mat = new T.MeshPhysicalMaterial({ color: 0x93a9b5, roughness: 0.15 + i * 0.2, metalness: i / 4, clearcoat: 0.5 })
      materials.push(mat)
      const mesh = new T.Mesh(new T.SphereGeometry(0.45, 24, 16), mat)
      mesh.position.x = (i - 2) * 1.05; mesh.castShadow = mesh.receiveShadow = true
      scene.add(mesh)
    }
    for (const [x, y, z, intensity, distance] of [[-2, 2, 2, 8, 8], [1, 2, 0, 5, 2], [5, 3, 8, 4, 1], [1, 1, 1, 0, 10]]) {
      const light = new T.PointLight(0xffbb88, intensity, distance)
      light.position.set(x, y, z); scene.add(light)
    }
    const spot = new T.SpotLight(0x6688ff, 15, 15, 0.4, 0.5)
    spot.position.set(2, 4, 3); spot.castShadow = true; scene.add(spot, spot.target)
    const pixels: Uint8Array[] = []
    try {
      for (const [key, source] of [['original', original], ['optimized', optimized]]) {
        T.ShaderChunk.lights_fragment_begin = source
        materials.forEach(mat => { mat.customProgramCacheKey = () => key; mat.needsUpdate = true })
        renderer.setRenderTarget(target); renderer.render(scene, camera)
        const p = new Uint8Array(256 * 192 * 4)
        renderer.readRenderTargetPixels(target, 0, 0, 256, 192, p); pixels.push(p)
      }
      let max = 0, total = 0, bright = 0
      for (let i = 0; i < pixels[0].length; i++) {
        const d = Math.abs(pixels[0][i] - pixels[1][i]); max = Math.max(max, d); total += d
        if (i % 4 !== 3) bright += pixels[1][i]
      }
      return { max, mean: total / pixels[0].length, bright }
    } finally {
      T.ShaderChunk.lights_fragment_begin = optimized
      scene.traverse((o: any) => { o.geometry?.dispose(); o.material?.dispose(); o.shadow?.map?.dispose() })
      target.dispose(); renderer.dispose(); renderer.forceContextLoss()
    }
  })
  expect(difference.bright).toBeGreaterThan(10000) // Reject a blank framebuffer.
  expect(difference.max).toBeLessThanOrEqual(1)
  expect(difference.mean).toBeLessThan(0.01)
  expect(errors).toEqual([])
})
