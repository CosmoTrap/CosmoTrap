import { expect, test } from '@playwright/test'
import * as THREE from 'three'
import { batchStaticMeshes } from '../src/world/props/StaticBatch'
import { spatialBatches } from '../src/world/zone4/spatialBatches'
import { batchStaticShadows } from '../src/world/props/StaticShadows'

test('les ombres regroupées excluent les découpes, les objets animés et restaurent les sources', () => {
  const root = new THREE.Group(), geometry = new THREE.BoxGeometry()
  const a = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()), b = a.clone()
  const cutout = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ alphaTest: 0.5 }))
  const glass = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ transparent: true }))
  for (const mesh of [a, b, cutout, glass]) { mesh.castShadow = true; root.add(mesh) }
  const result = batchStaticShadows(root)
  expect(result.originals).toEqual([a, b])
  expect(result.batches).toHaveLength(1)
  expect(result.batches[0].visible).toBe(false)
  expect(cutout.castShadow && glass.castShadow).toBe(true)
  result.dispose()
  expect(a.castShadow && b.castShadow).toBe(true)
  expect(result.batches[0].parent).toBeNull()
})

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
  expect(originals.every(m => !m.matrixAutoUpdate)).toBe(true)
  expect(originals.every(m => m.userData.staticBatchSource)).toBe(true)
  expect(merged.userData.staticBatch).toBe(true)
  let mergedDisposed = false, sourceDisposed = false
  merged.geometry.addEventListener('dispose', () => { mergedDisposed = true })
  originals[0].geometry.addEventListener('dispose', () => { sourceDisposed = true })
  batch.dispose()
  expect(originals.every(m => m.visible)).toBe(true)
  expect(originals.every(m => m.matrixAutoUpdate)).toBe(true)
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

test('les décors répétés conservent leurs données quantifiées, transformations et ressources partagées', () => {
  const root = new THREE.Group(), parent = new THREE.Group()
  root.position.set(8, 2, -4); root.rotation.y = 0.6
  parent.position.set(-1, 0.4, 2); parent.rotation.z = 0.2
  root.add(parent)
  const geometry = new THREE.BoxGeometry(), material = new THREE.MeshStandardMaterial()
  const positions = geometry.attributes.position
  geometry.setAttribute('position', new THREE.Int16BufferAttribute(Array.from(positions.array, x => Math.round(x * 32766)), 3, true))
  const meshes = [0, 1, 2].map(i => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(i * 2, i, -i); mesh.rotation.y = i * 0.4
    mesh.scale.set(1 + i, 2, 0.7); mesh.castShadow = mesh.receiveShadow = true
    parent.add(mesh); return mesh
  })
  root.updateWorldMatrix(true, true)
  const matrices = meshes.map(m => m.matrixWorld.clone())
  const result = batchStaticMeshes(root)
  expect(result.batches).toHaveLength(1)
  const batch = result.batches[0] as THREE.InstancedMesh
  expect(batch.isInstancedMesh).toBe(true)
  expect(batch.geometry).toBe(geometry)
  expect(batch.material).toBe(material)
  expect(batch.count).toBe(3)
  batch.updateWorldMatrix(true, false)
  const local = new THREE.Matrix4()
  matrices.forEach((matrix, i) => {
    batch.getMatrixAt(i, local)
    const actual = batch.matrixWorld.clone().multiply(local)
    matrix.elements.forEach((v, j) => expect(Math.abs(v - actual.elements[j])).toBeLessThan(0.00001))
  })
  let disposed = false, instanceDisposed = false
  geometry.addEventListener('dispose', () => { disposed = true })
  batch.addEventListener('dispose', () => { instanceDisposed = true })
  result.dispose()
  expect(disposed).toBe(false)
  expect(instanceDisposed).toBe(true)
  expect(meshes.every(m => m.visible && !m.userData.staticBatchSource)).toBe(true)
  expect(batch.parent).toBeNull()
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
    const optimizedPars = T.ShaderChunk.lights_pars_begin
    const { default: originalPars } = await import('/node_modules/three/src/renderers/shaders/ShaderChunk/lights_pars_begin.glsl.js' as string)
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
    for (const [x, y, z, intensity, distance] of [[-2, 2, 2, 8, 8], [1, 2, 0, 5, 2], [5, 3, 8, 4, 1], [1, 1, 1, 0, 10], [0, 4, 0, 2, 0]]) {
      const light = new T.PointLight(0xffbb88, intensity, distance)
      light.position.set(x, y, z); scene.add(light)
    }
    const spot = new T.SpotLight(0x6688ff, 15, 15, 0.4, 0.5)
    spot.position.set(2, 4, 3); spot.castShadow = true; scene.add(spot, spot.target)
    for (const intensity of [0, 20]) {
      const inactiveSpot = new T.SpotLight(0xff0000, intensity, 0.1, 0.4, 0.5)
      inactiveSpot.position.set(0, 8, 0); scene.add(inactiveSpot, inactiveSpot.target)
    }
    scene.add(new T.DirectionalLight(0xff0000, 0))
    const pixels: Uint8Array[] = []
    try {
      for (const [key, source] of [['original', original], ['optimized', optimized]]) {
        T.ShaderChunk.lights_fragment_begin = source
        T.ShaderChunk.lights_pars_begin = key === 'original' ? originalPars : optimizedPars
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
      T.ShaderChunk.lights_pars_begin = optimizedPars
      scene.traverse((o: any) => { o.geometry?.dispose(); o.material?.dispose(); o.shadow?.map?.dispose() })
      target.dispose(); renderer.dispose(); renderer.forceContextLoss()
    }
  })
  expect(difference.bright).toBeGreaterThan(10000) // Reject a blank framebuffer.
  expect(difference.max).toBeLessThanOrEqual(1)
  expect(difference.mean).toBeLessThan(0.01)
  expect(errors).toEqual([])
})

test('le rendu des instances conserve les textures, normales et ombres du décor original', async ({ page }) => {
  await page.route('**/api/**', r => r.fulfill({ status: 503, body: '{}' }))
  await page.goto('/')
  const difference = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js' as string)
    const { batchStaticMeshes } = await import('/src/world/props/StaticBatch.tsx' as string)
    const renderer = new T.WebGLRenderer(), target = new T.WebGLRenderTarget(256, 192)
    renderer.shadowMap.enabled = true
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(60, 256 / 192, 0.1, 40)
    camera.position.set(0, 4, 7); camera.lookAt(0, 0, 0)
    scene.add(new T.HemisphereLight(0xffffff, 0x273544, 0.8))
    const sun = new T.DirectionalLight(0xffeedd, 2)
    sun.position.set(3, 6, 2); sun.castShadow = true; scene.add(sun)
    const material = new T.MeshStandardMaterial({ color: 0x8199a1, roughness: 0.4, metalness: 0.3 })
    const geometry = new T.TorusGeometry(0.55, 0.16, 12, 28)
    const root = new T.Group(); root.rotation.y = 0.3; scene.add(root)
    for (let i = 0; i < 3; i++) {
      const mesh = new T.Mesh(geometry, material)
      mesh.position.set((i - 1) * 1.6, 0.9, 0); mesh.rotation.set(i * 0.2, i * 0.5, 0)
      mesh.scale.set(1, 0.7 + i * 0.2, 0.8); mesh.castShadow = mesh.receiveShadow = true
      root.add(mesh)
    }
    const floor = new T.Mesh(new T.PlaneGeometry(20, 20), new T.MeshStandardMaterial({ color: 0x929292 }))
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor)
    const pixels: Uint8Array[] = []
    let batch: any
    try {
      for (let pass = 0; pass < 2; pass++) {
        if (pass) batch = batchStaticMeshes(root)
        renderer.setRenderTarget(target); renderer.render(scene, camera)
        const p = new Uint8Array(256 * 192 * 4)
        renderer.readRenderTargetPixels(target, 0, 0, 256, 192, p); pixels.push(p)
      }
      let total = 0, different = 0, bright = 0
      pixels[0].forEach((v, i) => { const d = Math.abs(v - pixels[1][i]); total += d; if (d > 2) different++; if (i % 4 !== 3) bright += v })
      return { mean: total / pixels[0].length, different: different / pixels[0].length, bright, count: batch.batches.length }
    } finally {
      batch?.dispose(); geometry.dispose(); material.dispose(); floor.geometry.dispose(); floor.material.dispose()
      sun.shadow.map?.dispose(); target.dispose(); renderer.dispose(); renderer.forceContextLoss()
    }
  })
  expect(difference.count).toBe(1)
  expect(difference.bright).toBeGreaterThan(10000)
  expect(difference.mean).toBeLessThan(0.05)
  expect(difference.different).toBeLessThan(0.001)
})

test('les ombres regroupées gardent les mêmes pixels avec moins de dessins GPU', async ({ page }) => {
  await page.route('**/api/**', r => r.fulfill({ status: 503, body: '{}' }))
  await page.goto('/')
  const result = await page.evaluate(async () => {
    const T = await import('/node_modules/.vite/deps/three.js' as string)
    const { batchStaticShadows, installStaticShadowPass } = await import('/src/world/props/StaticShadows.ts' as string)
    const renderer = new T.WebGLRenderer(), target = new T.WebGLRenderTarget(320, 240)
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap; renderer.info.autoReset = false
    const uninstall = installStaticShadowPass(renderer)
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(60, 320 / 240, 0.1, 50)
    camera.position.set(0, 6, 8); camera.lookAt(0, 0, 0)
    scene.add(new T.HemisphereLight(0xffffff, 0x273544, 0.5))
    const sun = new T.DirectionalLight(0xffeedd, 2)
    sun.position.set(3, 6, 2); sun.castShadow = true; scene.add(sun)
    const point = new T.PointLight(0x66bbff, 20, 20)
    point.position.set(-3, 4, 1); point.castShadow = true; scene.add(point)
    const spot = new T.SpotLight(0xffdd88, 25, 20, 1, .5)
    spot.position.set(2, 5, 3); spot.castShadow = true; scene.add(spot, spot.target)
    const root = new T.Group(); root.rotation.y = .3; scene.add(root)
    const geometry = new T.BoxGeometry(.4, 1, .4)
    for (let i = 0; i < 24; i++) {
      const mat = new T.MeshStandardMaterial({ color: new T.Color().setHSL(i / 24, .5, .6), side: i % 2 ? T.DoubleSide : T.FrontSide })
      const mesh = new T.Mesh(geometry, mat)
      mesh.position.set(i % 6 - 2.5, .5, Math.floor(i / 6) - 1.5)
      mesh.rotation.y = i * .2; mesh.castShadow = mesh.receiveShadow = true; root.add(mesh)
    }
    const repeated = new T.InstancedMesh(geometry, new T.MeshStandardMaterial({ color: 0x778899 }), 3)
    for (let i = 0; i < 3; i++) repeated.setMatrixAt(i, new T.Matrix4().makeTranslation(i - 1, .5, 3))
    repeated.castShadow = true; root.add(repeated)
    const floor = new T.Mesh(new T.PlaneGeometry(30, 30), new T.MeshStandardMaterial({ color: 0x888888 }))
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor)
    const pixels: Uint8Array[] = [], calls: number[] = []; let batch: any
    try {
      for (let i = 0; i < 2; i++) {
        if (i) batch = batchStaticShadows(root)
        renderer.info.reset(); renderer.setRenderTarget(target); renderer.render(scene, camera)
        calls.push(renderer.info.render.calls)
        const p = new Uint8Array(320 * 240 * 4)
        renderer.readRenderTargetPixels(target, 0, 0, 320, 240, p); pixels.push(p)
      }
      let sum = 0, different = 0, bright = 0
      pixels[0].forEach((v, i) => { const d = Math.abs(v - pixels[1][i]); sum += d; if (d > 2) different++; if (i % 4 !== 3) bright += v })
      return { calls, mean: sum / pixels[0].length, different: different / pixels[0].length, bright, hidden: batch.batches.every((m: any) => !m.visible) }
    } finally {
      batch?.dispose(); uninstall()
      scene.traverse((o: any) => { o.geometry?.dispose(); o.material?.dispose(); o.shadow?.map?.dispose() })
      target.dispose(); renderer.dispose(); renderer.forceContextLoss()
    }
  })
  expect(result.hidden).toBe(true)
  expect(result.bright).toBeGreaterThan(10000)
  expect(result.mean).toBeLessThan(.05)
  expect(result.different).toBeLessThan(.001)
  expect(result.calls[1]).toBeLessThan(result.calls[0] * .6)
})
