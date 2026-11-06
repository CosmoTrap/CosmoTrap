import { expect, test, type Page } from '@playwright/test'
import { zone1 } from '../src/game/maps/zone1'
import { zone2 } from '../src/game/maps/zone2'

test.setTimeout(240000)

const FIBER = '/node_modules/.vite/deps/@react-three_fiber.js'
const STEP = 0.1
const PLAYER_RADIUS = 0.32
/** Small objects that belong on another piece of furniture, so they may rest on or touch it. */
const SMALL = /^(cookPot|jug|waterGallon|deskLamp|frame|cassette|cleanerBottle|cleanerCan|magnifier|sprays|clayPot|wateringCan|trowel|gloves|vice|oilCan|drill|tapeMeasure|lubricant|mugs|toy|microscope|flasks|chemSet|seeding|clock|postits|photos|poster|bands|sockets|screen|monitor|sign|beacon|camera|utilityBox|wallLamp|wallCables|dartboard|pipes|pipesBig|handrail|extinguisher|grating|hazard|shelf|plant|ladderRack|conduit|medWall|medicalBox|curtain|crutches|fireAlarm|crateSmall|foodBox|foodCans|thermos|kettle|cuttingBoard|toolbox|clipboard|binder|stationery|circuit|multimeter|pliers|screwdrivers|spanner|bunsen|dustpan)$/

type Box = { name: string; min: number[]; max: number[] }

async function boxes(page: Page): Promise<Box[]> {
  return page.evaluate(async (path) => {
    const { _roots } = await import(path)
    const scene = _roots.get(document.querySelector('canvas')).store.getState().scene
    scene.updateMatrixWorld(true)
    const out: Box[] = []
    scene.traverse((o: any) => {
      if (!/^(prop|ent):/.test(o.name)) return
      const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
      o.traverse((m: any) => {
        // Batched furniture is drawn by a shared mesh, but keeps its original bounds.
        // An entity's invisible hit box still locates it.
        if (!m.isMesh || !m.geometry || m.isInstancedMesh || (!m.visible && !m.userData.staticBatchSource && !o.name.startsWith('ent:'))) return
        m.geometry.computeBoundingBox()
        const b = m.geometry.boundingBox
        for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
          const e = m.matrixWorld.elements, w = [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]]
          for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], w[i]); max[i] = Math.max(max[i], w[i]) }
        }
      })
      if (Number.isFinite(min[0])) out.push({ name: o.name, min, max })
    })
    return out
  }, FIBER)
}

/** Everything meant to rest on something: the gap between its base and what is right below it. */
const RESTING = /^prop:(cookPot|jug|waterGallon|deskLamp|frame|cassette|cleanerBottle|cleanerCan|magnifier|sprays|clayPot|wateringCan|trowel|gloves|vice|oilCan|drill|tapeMeasure|lubricant|mugs|microscope|flasks|chemSet|crateSmall|foodBox|foodCans|thermos|kettle|cuttingBoard|toolbox|clipboard|binder|stationery|circuit|multimeter|pliers|screwdrivers|spanner|bunsen|dustpan|medicalBox)$/

async function floating(page: Page) {
  return page.evaluate(async ({ fiber, resting }) => {
    const { _roots } = await import(fiber)
    const THREE: any = await import('/node_modules/.vite/deps/three.js' as string)
    const scene = _roots.get(document.querySelector('canvas')).store.getState().scene
    scene.updateMatrixWorld(true)
    const pattern = new RegExp(resting)
    const meshes: any[] = []
    scene.traverse((o: any) => {
      // Use source meshes to exclude the resting object's own triangles, even
      // when it shares a render batch with its supporting furniture.
      if (!o.isMesh || !o.geometry || o.userData.staticBatch) return
      for (let p = o; p; p = p.parent) if (!p.visible && !(p === o && o.userData.staticBatchSource)) return
      meshes.push(o)
    })
    const out: { name: string; x: number; z: number; y: number; gap: number }[] = []
    scene.traverse((o: any) => {
      if (!pattern.test(o.name)) return
      const box = new THREE.Box3().setFromObject(o)
      if (!Number.isFinite(box.min.y)) return
      const own = new Set<any>()
      o.traverse((c: any) => own.add(c))
      const c = box.getCenter(new THREE.Vector3())
      const ray = new THREE.Raycaster(new THREE.Vector3(c.x, box.min.y + 0.03, c.z), new THREE.Vector3(0, -1, 0), 0, 4)
      const hit = ray.intersectObjects(meshes.filter((m) => !own.has(m)), false)[0]
      const below = hit ? hit.point.y : 0
      const gap = box.min.y - below
      if (gap > 0.035) out.push({ name: o.name, x: +c.x.toFixed(1), z: +c.z.toFixed(1), y: +box.min.y.toFixed(2), gap: +gap.toFixed(3) })
    })
    return out
  }, { fiber: FIBER, resting: RESTING.source })
}

test('chaque pièce est rangée : meubles sans chevauchement, passages libres et objectifs accessibles', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/api/auth.php?action=me', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  await page.addInitScript(() => localStorage.setItem('cosmotrap.settings.v1', JSON.stringify({ quality: 'low', music: 0, voice: 0, sfx: 0 })))
  await page.goto('/?quality=low')
  await expect(page.getByTestId('launch')).toBeVisible()
  await page.keyboard.press('Space')
  await page.getByTestId('guest').click()
  await page.evaluate(() => { window.__game.start(); window.__game.set({ toured: [1, 2, 3, 4] }) })
  await page.waitForFunction(() => window.__game.state().playerZone === 1 && window.__game.state().loading === 1)

  const problems: string[] = []
  for (const map of [zone1, zone2]) {
    if (map.zone === 2) {
      await page.evaluate(() => { window.__game.goto(2); window.__game.set({ cine: null, flags: { ...window.__game.state().flags, steamFixed: true } }) })
      await page.waitForFunction(() => window.__game.state().playerZone === 2 && window.__game.state().loading === 1)
    } else await page.evaluate(() => window.__game.set({ flags: { ...window.__game.state().flags, door_d1: true } }))
    await page.waitForTimeout(1500)
    const hub = map.rooms.find((r) => r.id === 'couloir')!.rect
    const hx = hub[0] + hub[2] + 1, hz = hub[1] + hub[3] + 1
    if (map.zone === 1) {
      for (const [name, x, z, yaw, wait] of [['door-closed', 53.5, 41, -Math.PI / 2, 700], ['door-open', 57, 41, -Math.PI / 2, 1700], ['door-chamber', 59, 41, -Math.PI / 2, 700], ['sign', 42.5, 41.8, Math.PI, 500]] as const) {
        await page.evaluate(({ x, z, yaw }) => { window.__game.teleportXZ(x, z, yaw); window.__game.live.pitch = 0.08 }, { x, z, yaw })
        await page.waitForTimeout(wait)
        await page.screenshot({ path: `test-results/view-${name}.png` })
      }
      await page.evaluate(() => { window.__game.teleportXZ(19, 39.6, 0); window.__game.live.pitch = -0.22 })
      await page.waitForTimeout(500)
      await page.evaluate(() => { window.__game.live.pitch = -0.22 })
      await page.waitForTimeout(150)
      await page.screenshot({ path: 'test-results/view-shelf.png' })
      await page.evaluate(() => { window.__game.teleportXZ(16, 41, Math.PI / 2); window.__game.live.pitch = 0.75 })
      await page.waitForTimeout(500)
      await page.evaluate(() => { window.__game.live.pitch = 0.75 })
      await page.waitForTimeout(150)
      await page.screenshot({ path: 'test-results/view-ceiling.png' })
      await page.evaluate(() => { window.__game.give('lamp'); window.__game.set({ lampOn: true, taken: ['1:lamp'] }); window.__game.teleportXZ(16, 41, Math.PI / 2) })
      await page.waitForTimeout(900)
      await page.screenshot({ path: 'test-results/view-torch.png' })
      // Up close, what is displayed on a wall must stay readable under the beam.
      await page.evaluate(() => { window.__game.teleportXZ(13, 42.5, Math.PI); window.__game.live.pitch = 0 })
      await page.waitForTimeout(1200)
      await page.screenshot({ path: 'test-results/view-torch-near.png' })
      await page.evaluate(() => window.__game.set({ lampOn: false, inv: {}, taken: [] }))
      await page.evaluate(() => window.__game.teleportXZ(19.2, 42.4, -1.98))
      await page.waitForTimeout(500)
      await page.screenshot({ path: 'test-results/view-locker-closed.png' })
      await page.evaluate(() => window.__game.set({ flags: { ...window.__game.state().flags, lockerOpen: true } }))
      await page.waitForTimeout(2200)
      await page.screenshot({ path: 'test-results/view-locker-open.png' })
      await page.evaluate(() => window.__game.set({ flags: { ...window.__game.state().flags, lockerOpen: false } }))
      await page.waitForTimeout(1800)
    }
    const all = await boxes(page)
    console.log(`niveau ${map.zone} : ${all.length} objets, ${await page.evaluate(async (path) => {
      const { _roots } = await import(path)
      const info = _roots.get(document.querySelector('canvas')).store.getState().gl.info.render
      void info
      let meshes = 0
      _roots.get(document.querySelector('canvas')).store.getState().scene.traverse((o: any) => { if (o.isMesh) meshes++ })
      await new Promise((r) => setTimeout(r, 6000))
      return `${meshes} maillages, ${Math.round(window.__game.live.fps)} i/s stabilisés`
    }, FIBER)}`)
    const furniture = all.filter((b) => b.name.startsWith('prop:') && !SMALL.test(b.name.slice(5)))
    // The hub's furniture stands at an angle along a curved wall, where axis-aligned boxes say nothing:
    // it is covered by the physical walks in round-hub-doors instead.
    const inHubRadius = (b: Box) => Math.hypot((b.min[0] + b.max[0]) / 2 - hx, (b.min[2] + b.max[2]) / 2 - hz) < 7.2

    for (let i = 0; i < furniture.length; i++) for (let j = i + 1; j < furniture.length; j++) {
      const a = furniture[i], b = furniture[j]
      if (inHubRadius(a) && inHubRadius(b)) continue
      if ([0, 1, 2].every((k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]) > 0.05))
        problems.push(`niveau ${map.zone} : ${a.name} chevauche ${b.name} vers x=${a.min[0].toFixed(1)} z=${a.min[2].toFixed(1)}`)
    }

    for (const f of await floating(page)) problems.push(`niveau ${map.zone} : ${f.name} flotte de ${f.gap} m (x=${f.x} z=${f.z} y=${f.y})`)

    // Every alarm beacon sits exactly halfway between two ceiling lamps.
    const beaconGaps = await page.evaluate(async (path) => {
      const { _roots } = await import(path)
      const THREE: any = await import('/node_modules/.vite/deps/three.js' as string)
      const scene = _roots.get(document.querySelector('canvas')).store.getState().scene
      scene.updateMatrixWorld(true)
      const m = new THREE.Matrix4(), lamps: number[][] = [], beacons: { id: string; x: number; z: number }[] = []
      scene.traverse((o: any) => {
        if (o.name.startsWith('ceiling-light:')) for (let i = 0; i < o.count; i++) {
          o.getMatrixAt(i, m)
          lamps.push([m.elements[12], m.elements[14]])
        }
        if (o.name.startsWith('alert-beacon:')) beacons.push({ id: o.name, x: o.position.x, z: o.position.z })
      })
      return beacons.map((b) => {
        const d = lamps.map(([x, z]) => Math.hypot(x - b.x, z - b.z)).sort((p, q) => p - q)
        return { id: b.id, nearest: d[0], second: d[1] }
      })
    }, FIBER)
    expect(beaconGaps.length).toBeGreaterThan(5)
    for (const b of beaconGaps) if (b.nearest < 0.8 || b.second - b.nearest > 0.05) problems.push(`niveau ${map.zone} : ${b.id} pas entre deux lampes (${b.nearest.toFixed(2)} / ${b.second.toFixed(2)})`)

    // Nothing is sunk into a wall, and nothing stands in front of a porthole.
    const onFloor = (x: number, z: number) => ['.', 'D'].includes(map.grid[Math.floor(z / 2)]?.[Math.floor(x / 2)] ?? ' ')
    const inset = 0.05
    for (const b of furniture.filter((f) => !inHubRadius(f))) {
      const corners = [[b.min[0] + inset, b.min[2] + inset], [b.max[0] - inset, b.min[2] + inset], [b.min[0] + inset, b.max[2] - inset], [b.max[0] - inset, b.max[2] - inset]]
      if (corners.some(([x, z]) => !onFloor(x, z))) problems.push(`niveau ${map.zone} : ${b.name} entre dans un mur (x ${b.min[0].toFixed(2)}…${b.max[0].toFixed(2)}, z ${b.min[2].toFixed(2)}…${b.max[2].toFixed(2)})`)
    }
    map.grid.forEach((row, tz) => [...row].forEach((cell, tx) => {
      if (cell !== '.') return
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if (map.grid[tz + dz]?.[tx + dx] !== 'W') continue
        // Porthole on the wall plane of this tile: radius 0.42 m, centred 1.5 m up.
        const wx = tx * 2 + 1 + dx, wz = tz * 2 + 1 + dz
        for (const b of all.filter((o) => o.name.startsWith('prop:') && !/conduit|pipes|labBench/.test(o.name))) {
          if (b.max[1] < 1.12 || b.min[1] > 1.88) continue
          const along = dx ? Math.min(b.max[2], wz + 0.38) - Math.max(b.min[2], wz - 0.38) : Math.min(b.max[0], wx + 0.38) - Math.max(b.min[0], wx - 0.38)
          const near = dx ? Math.min(Math.abs(b.min[0] - wx), Math.abs(b.max[0] - wx)) : Math.min(Math.abs(b.min[2] - wz), Math.abs(b.max[2] - wz))
          if (along > 0.02 && near < 0.9) problems.push(`niveau ${map.zone} : ${b.name} devant le hublot de la case ${tx},${tz}`)
        }
      }
    }))

    // Potted plants stand in corners or against walls, never in a way or beside a door.
    for (const b of all.filter((x) => x.name === 'prop:plant')) {
      const x = (b.min[0] + b.max[0]) / 2, z = (b.min[2] + b.max[2]) / 2
      for (const d of map.doors) {
        const dist = Math.hypot(x - (d.tile[0] * 2 + 1), z - (d.tile[1] * 2 + 1))
        if (dist < 2.2) problems.push(`niveau ${map.zone} : ${b.name} à ${dist.toFixed(1)} m de la porte ${d.id}`)
      }
    }

    for (const b of all.filter((x) => x.name === 'prop:plant')) {
      const x = (b.min[0] + b.max[0]) / 2, z = (b.min[2] + b.max[2]) / 2
      const r = Math.hypot(x - hx, z - hz)
      if (r < 7.5) problems.push(`niveau ${map.zone} : plante dans le nœud central (à ${r.toFixed(1)} m du centre)`)
    }

    // Occupancy from the real meshes: floor tiles, minus whatever stands at body height.
    const width = Math.max(...map.grid.map((r) => r.length)) * 2, depth = map.grid.length * 2
    const cols = Math.ceil(width / STEP), rows = Math.ceil(depth / STEP)
    const free = new Uint8Array(cols * rows)
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const x = (c + 0.5) * STEP, z = (r + 0.5) * STEP
      const margin = (v: number) => { const t = v % 2; return t > PLAYER_RADIUS && t < 2 - PLAYER_RADIUS }
      const tx = Math.floor(x / 2), tz = Math.floor(z / 2)
      const floor = (cx: number, cz: number) => ['.', 'D'].includes(map.grid[cz]?.[cx] ?? ' ')
      if (!floor(tx, tz)) continue
      if (!margin(x) && !(x % 2 <= PLAYER_RADIUS ? floor(tx - 1, tz) : floor(tx + 1, tz))) continue
      if (!margin(z) && !(z % 2 <= PLAYER_RADIUS ? floor(tx, tz - 1) : floor(tx, tz + 1))) continue
      const inHub = tx >= hub[0] && tx <= hub[2] && tz >= hub[1] && tz <= hub[3]
      if (inHub && Math.hypot(x - hx, z - hz) < 2.05) continue // Lift shaft.
      if (all.some((b) => b.name.startsWith('prop:') && !/pipes|grating|hazard/.test(b.name) && b.min[1] < 1.7 && b.max[1] > 0.32
        && x > b.min[0] - PLAYER_RADIUS && x < b.max[0] + PLAYER_RADIUS && z > b.min[2] - PLAYER_RADIUS && z < b.max[2] + PLAYER_RADIUS)) continue
      free[r * cols + c] = 1
    }
    const start = [Math.floor((hx + 3) / STEP), Math.floor(hz / STEP)]
    const seen = new Uint8Array(cols * rows), queue = [start[1] * cols + start[0]]
    seen[queue[0]] = 1
    for (let i = 0; i < queue.length; i++) {
      const n = queue[i]
      for (const d of [1, -1, cols, -cols]) if (free[n + d] && !seen[n + d]) { seen[n + d] = 1; queue.push(n + d) }
    }
    const nearest = (x: number, z: number) => {
      let best = Infinity
      for (const n of queue) best = Math.min(best, Math.hypot((n % cols + 0.5) * STEP - x, (Math.floor(n / cols) + 0.5) * STEP - z))
      return best
    }
    for (const d of map.doors) {
      const dist = nearest(d.tile[0] * 2 + 1, d.tile[1] * 2 + 1)
      if (dist > 0.5) problems.push(`niveau ${map.zone} : porte ${d.id} inaccessible (${dist.toFixed(1)} m)`)
    }
    for (const b of all.filter((x) => x.name.startsWith('ent:') && !/lift|steam$/.test(x.name))) {
      const x = (b.min[0] + b.max[0]) / 2, z = (b.min[2] + b.max[2]) / 2
      const dist = nearest(x, z)
      if (dist > 1.7) problems.push(`niveau ${map.zone} : ${b.name} trop loin du passage (${dist.toFixed(1)} m)`)
    }
    const [ax, az] = map.zone === 1 ? [13, 41] : [46, 37]
    if (nearest(ax, az) > 0.3) problems.push(`niveau ${map.zone} : point d'arrivée bloqué`)

    for (const degrees of [22, 50, 135, 202, 230, 315]) {
      const a = degrees * Math.PI / 180
      await page.evaluate(({ x, z, yaw }) => window.__game.teleportXZ(x, z, yaw), { x: hx + Math.sin(a) * 2.6, z: hz + Math.cos(a) * 2.6, yaw: Math.PI + a })
      await page.waitForTimeout(500)
      await page.screenshot({ path: `test-results/hub-plant-${map.zone}-${degrees}.png` })
    }

    // Rouge et pulsée pendant l'alarme du niveau 1 ; blanche et fixe au niveau 2, une fois la fuite fermée.
    const samples: number[] = []
    for (let i = 0; i < 16; i++) {
      samples.push(await page.evaluate(async (path) => {
        const { _roots } = await import(path)
        return _roots.get(document.querySelector('canvas')).store.getState().scene.getObjectByName('elevator-alarm-light').intensity
      }, FIBER))
      await page.waitForTimeout(200)
    }
    const swing = Math.max(...samples) - Math.min(...samples)
    if (map.zone === 1 ? swing < 3 : swing > 0.01) problems.push(`niveau ${map.zone} : lumière de l'ascenseur incorrecte (${samples.join(', ')})`)
    await page.evaluate(({ x, z }) => window.__game.teleportXZ(x, z, Math.PI / 2), { x: hx + 4.5, z: hz })
    await page.waitForTimeout(1400)
    await page.screenshot({ path: `test-results/view-lift-${map.zone}.png` })
    await page.evaluate(({ x, z }) => { window.__game.teleportXZ(x, z, 0); window.__game.live.pitch = 0.75 }, { x: hx + 4.1, z: hz + 1.4 })
    await page.waitForTimeout(500)
    await page.evaluate(() => { window.__game.live.pitch = 0.75 })
    await page.waitForTimeout(150)
    await page.screenshot({ path: `test-results/view-beacon-${map.zone}.png` })
    if (map.zone === 2) {
      await page.evaluate(({ x, z }) => { window.__game.teleportXZ(x, z, -Math.PI / 2); window.__game.live.pitch = 0.75 }, { x: hx - 0.3, z: hz })
      await page.waitForTimeout(600)
      await page.evaluate(() => { window.__game.live.pitch = 0.75 })
      await page.waitForTimeout(200)
      await page.screenshot({ path: 'test-results/view-cab-ceiling.png' })
      await page.evaluate(() => { window.__game.set({ inv: {}, lampOn: false }); window.__game.teleportXZ(42, 13, 0); window.__game.live.pitch = 0 })
      await page.waitForTimeout(700)
      await page.screenshot({ path: 'test-results/view-rack.png' })
      await page.evaluate(() => { window.__game.teleportXZ(54.5, 38.3, -1.2); window.__game.live.pitch = -0.1 })
      await page.waitForTimeout(700)
      await page.screenshot({ path: 'test-results/view-broken-pipe.png' })
      await page.evaluate(({ x, z }) => { window.__game.teleportXZ(x, z, 2.35); window.__game.live.pitch = 0 }, { x: hx + 2.4, z: hz - 2.2 })
      await page.waitForTimeout(600)
      await page.screenshot({ path: 'test-results/view-hub-2a.png' })
      await page.evaluate(({ x, z }) => { window.__game.teleportXZ(x, z, -0.8); window.__game.live.pitch = 0 }, { x: hx - 2.4, z: hz + 2.2 })
      await page.waitForTimeout(600)
      await page.screenshot({ path: 'test-results/view-hub-2b.png' })
    }
    const suit = map.zone === 1 ? [66.2, 39] : [17, 35]
    await page.evaluate(({ x, z, yaw }) => { window.__game.teleportXZ(x, z, yaw); window.__game.live.pitch = 0.05 }, { x: suit[0], z: suit[1], yaw: map.zone === 1 ? -Math.PI / 2 : 0 })
    await page.waitForTimeout(500)
    await page.evaluate(() => { window.__game.live.pitch = 0.05 })
    await page.waitForTimeout(150)
    await page.screenshot({ path: `test-results/view-suit-${map.zone}.png` })

    // Each collectible from close up, as the player sees it before taking it.
    for (const e of map.ents.filter((x) => x.item)) {
      await page.evaluate((id) => { window.__game.teleport(id, 0.75); window.__game.live.pitch = -0.55 }, e.id)
      await page.waitForTimeout(350)
      await page.evaluate(() => { window.__game.live.pitch = -0.55 })
      await page.waitForTimeout(150)
      await page.screenshot({ path: `test-results/item-${e.id}-z${map.zone}.png`, clip: { x: 340, y: 110, width: 600, height: 500 } })
    }
    for (const [name, degrees] of (map.zone === 1 ? [['chess', 135], ['meal', 315]] as const : [])) {
      const a = degrees * Math.PI / 180
      await page.evaluate(({ x, z, yaw }) => { window.__game.teleportXZ(x, z, yaw); window.__game.live.pitch = -0.7 }, { x: hx + Math.sin(a) * 4.9, z: hz + Math.cos(a) * 4.9, yaw: Math.PI + a })
      await page.waitForTimeout(400)
      await page.evaluate(() => { window.__game.live.pitch = -0.7 })
      await page.waitForTimeout(150)
      await page.screenshot({ path: `test-results/view-${name}-${map.zone}.png` })
      if (name === 'meal') {
        await page.evaluate(({ x, z, yaw }) => { window.__game.teleportXZ(x, z, yaw); window.__game.live.pitch = -0.95 }, { x: hx + Math.sin(a) * 5.15, z: hz + Math.cos(a) * 5.15, yaw: Math.PI + a })
        await page.waitForTimeout(400)
        await page.evaluate(() => { window.__game.live.pitch = -0.95 })
        await page.waitForTimeout(150)
        await page.screenshot({ path: `test-results/view-meal-close-${map.zone}.png` })
      }
    }

    // One view per room from both ends, for review by eye.
    await page.evaluate(() => window.__game.set({ inv: { lamp: 1 }, lampOn: true, flags: { ...window.__game.state().flags, power: true, pw_lights: true } }))
    for (const room of map.rooms.filter((r) => !r.id.startsWith('liaison_') && r.id !== 'couloir')) {
      const [x0, z0, x1, z1] = room.rect, w = x1 - x0 + 1, d = z1 - z0 + 1
      const z = z0 + z1 + 1, x = x0 + x1 + 1
      const views = w >= d ? [[x0 * 2 + 1, z, -Math.PI / 2], [(x1 + 1) * 2 - 1, z, Math.PI / 2]] : [[x, z0 * 2 + 1, Math.PI], [x, (z1 + 1) * 2 - 1, 0]]
      for (const [i, [vx, vz, yaw]] of views.entries()) {
        await page.evaluate(({ vx, vz, yaw }) => window.__game.teleportXZ(vx, vz, yaw), { vx, vz, yaw })
        await page.waitForTimeout(500)
        await page.screenshot({ path: `test-results/room-${room.id}-${i}.png` })
      }
    }
  }
  console.log(problems.join('\n') || 'aucun problème')
  expect(problems).toEqual([])
  expect(errors).toEqual([])
})
