import { expect, test } from '@playwright/test'

test('la coque masque les pièces depuis l’extérieur, sauf aux véritables fenêtres', async ({ page }) => {
  test.setTimeout(180000)
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.route('**/api/**', r => r.fulfill({ status: 503, body: '{}' }))
  await page.addInitScript(() => localStorage.setItem('cosmotrap.settings.v1', JSON.stringify({ quality: 'high', resolution: 720, music: 0, sfx: 0, voice: 0 })))
  await page.goto('/')
  await expect(page.getByTestId('launch')).toBeVisible()
  await page.keyboard.press('Space')
  await page.getByTestId('guest').click()
  await page.evaluate(() => { window.__game.start(); window.__game.set({ toured: [1, 2, 3, 4] }) })

  for (const zone of [1, 2, 3]) {
    if (zone !== 1) await page.evaluate(z => { window.__game.goto(z); window.__game.set({ cine: null }) }, zone)
    await page.waitForFunction(z => window.__game.state().playerZone === z && window.__game.state().loading === 1, zone)
    const result = await page.evaluate(async zone => {
      const T = await import('/node_modules/.vite/deps/three.js' as string)
      const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js' as string)
      const { gridMap, cellAt, isFloor, TILE } = await import('/src/game/maps/index.ts' as string)
      const { wallMaterial, ceilingMaterial, floorMaterial } = await import('/src/world/materials.ts' as string)
      const scene = _roots.get(document.querySelector('canvas')).store.getState().scene
      const map = gridMap(zone), materials = new Set(), wallMaterials = new Set()
      for (const room of map.rooms) {
        const wall = wallMaterial(room.theme ?? 'station', !!room.dark, room.id)
        wallMaterials.add(wall); materials.add(wall)
        materials.add(ceilingMaterial(!!room.dark, room.id))
        const kind = room.theme === 'machine' || room.theme === 'rocket' ? 'grate' : room.id === 'couloir' || room.id === 'pont' ? 'rubber' : 'plate'
        materials.add(floorMaterial(kind, !!room.dark, room.id))
      }
      const shell: any[] = []
      scene.traverse((o: any) => { if (o.isMesh && materials.has(o.material)) shell.push(o) })
      scene.updateMatrixWorld(true)
      const walls = shell.filter(o => wallMaterials.has(o.material))
      const outer: any[] = []
      scene.traverse((o: any) => { if (o.isMesh && ['hull', 'hub-hull', 'hub-sun-stop'].includes(o.name)) outer.push(o) })
      for (const mesh of outer) for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!material.map || !material.normalMap || !material.roughnessMap) throw new Error(`Coque sans textures PBR : ${mesh.name}`)
        if (material.transparent || !material.depthWrite) throw new Error('Coque extérieure transparente')
      }
      const ray = new T.Raycaster(), a = new T.Vector3(), b = new T.Vector3(), c = new T.Vector3()
      let panels = 0, missed = 0, oldBackfaceMisses = 0
      // Probe the real room meshes on BOTH sides, including roofs, floors and
      // the curved hub. A short ray cannot accidentally hit the opposite wall.
      for (const mesh of shell) {
        if (mesh.material.transparent || !mesh.material.depthWrite) throw new Error('Coque non opaque')
        const g = mesh.geometry, p = g.attributes.position, count = g.index?.count ?? p.count
        const vertex = (v: any, i: number) => v.fromBufferAttribute(p, g.index ? g.index.getX(i) : i).applyMatrix4(mesh.matrixWorld)
        const stride = Math.max(1, Math.floor(count / 3 / 32)) * 3
        for (let i = 0; i < count; i += stride) {
          vertex(a, i); vertex(b, i + 1); vertex(c, i + 2)
          const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize()
          if (!normal.lengthSq()) continue
          const center = a.clone().add(b).add(c).multiplyScalar(1 / 3)
          for (const sign of [-1, 1]) {
            ray.set(center.clone().addScaledVector(normal, sign * 0.04), normal.clone().multiplyScalar(-sign))
            ray.near = 0; ray.far = 0.08
            panels++
            if (!ray.intersectObject(mesh, false).length) missed++
          }
          const side = mesh.material.side
          mesh.material.side = T.FrontSide
          ray.set(center.clone().addScaledVector(normal, -0.04), normal)
          if (!ray.intersectObject(mesh, false).length) oldBackfaceMisses++
          mesh.material.side = side
        }
      }
      let openings = 0, covered = 0, missingSills = 0
      const probe = (x: number, y: number, z: number, nx: number, nz: number) => {
        ray.set(new T.Vector3(x - nx * 0.7, y, z - nz * 0.7), new T.Vector3(nx, 0, nz))
        ray.far = 1.4
        return ray.intersectObjects([...walls, ...outer], false).length > 0
      }
      for (let z = 0; z < map.grid.length; z++) for (let x = 0; x < map.grid[z].length; x++) {
        const cell = cellAt(map, x, z)
        if (!isFloor(cell)) continue
        for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
          const neighbor = cellAt(map, x + dx, z + dz)
          if (neighbor !== 'V' && (neighbor !== 'W' || cell === 'D')) continue
          const wx = (x + 0.5 + dx * 0.5) * TILE, wz = (z + 0.5 + dz * 0.5) * TILE
          openings++
          if (probe(wx, 1.5, wz, -dx, -dz)) covered++
          if (!probe(wx, 0.45, wz, -dx, -dz)) missingSills++
        }
      }
      for (const room of map.rooms.filter((r: any) => r.shape === 'round')) {
        const radius = room.rect[2] - room.rect[0] + 1
        const cx = room.rect[0] + room.rect[2] + 1, cz = room.rect[1] + room.rect[3] + 1
        for (let i = 0; i < 4; i++) {
          const angle = Math.PI / 4 + i * Math.PI / 2, dx = Math.sin(angle), dz = Math.cos(angle)
          openings++
          if (probe(cx + dx * radius, 1.5, cz + dz * radius, -dx, -dz)) covered++
          if (!probe(cx + dx * radius, 0.45, cz + dz * radius, -dx, -dz)) missingSills++
        }
      }
      ;(window as any).hullMaterialIds = outer.flatMap(o => (Array.isArray(o.material) ? o.material : [o.material]).map((m: any) => m.uuid))
      return { exteriorSurfaces: outer.length, surfaces: shell.length, panels, missed, oldBackfaceMisses, openings, covered, missingSills }
    }, zone)
    expect(result.surfaces).toBeGreaterThan(5)
    expect(result.exteriorSurfaces).toBeGreaterThan(0)
    expect(result.panels).toBeGreaterThan(100)
    expect(result.oldBackfaceMisses).toBeGreaterThan(50) // Reproduces the old bug.
    expect(result.missed, `zone ${zone}: faces extérieures manquantes`).toBe(0)
    expect(result.openings).toBeGreaterThan(0)
    expect(result.covered, `zone ${zone}: fenêtre obstruée`).toBe(0)
    expect(result.missingSills, `zone ${zone}: allège transparente`).toBe(0)

    if (zone < 3) {
      const x = zone === 1 ? 36.5 : 38.5, z = zone === 1 ? 45.5 : 41.5
      const targetX = zone === 1 ? 29 : 32, targetZ = zone === 1 ? 63 : 60
      await page.evaluate(({ x, z, yaw }) => {
        window.__game.teleportXZ(x, z, yaw)
        window.__game.set({ playTime: 25, event: null, nextEventAt: 999999 })
      }, { x, z, yaw: Math.atan2(x - targetX, z - targetZ) })
      await page.waitForTimeout(800)
      await page.screenshot({ path: `test-results/station-hull-${zone}.png` })
      // Looking through another room's window must not switch the hull to black.
      await page.evaluate(z => window.__game.teleportXZ(z === 1 ? 15 : 27, z === 1 ? 41 : 13, 0), zone)
      await page.waitForTimeout(300)
      expect(await page.evaluate(async () => {
        const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js' as string)
        const scene = _roots.get(document.querySelector('canvas')).store.getState().scene
        const ids: string[] = []
        scene.traverse((o: any) => {
          if (o.isMesh && ['hull', 'hub-hull', 'hub-sun-stop'].includes(o.name)) ids.push(...(Array.isArray(o.material) ? o.material : [o.material]).map((m: any) => m.uuid))
        })
        return JSON.stringify(ids) === JSON.stringify((window as any).hullMaterialIds)
      })).toBe(true)
    }
  }
  expect(errors).toEqual([])
})
