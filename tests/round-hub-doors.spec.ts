import { expect, test, type Page } from '@playwright/test'

test.setTimeout(120000)
async function start(page: Page) {
  await page.route('**/api/auth.php?action=me', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  await page.addInitScript(() => localStorage.setItem('cosmotrap.settings.v1', JSON.stringify({ quality: 'low', music: 0, voice: 0, sfx: 0 })))
  await page.goto('/?quality=low')
  await expect(page.getByTestId('launch')).toBeVisible()
  await page.keyboard.press('Space')
  await page.getByTestId('guest').click()
  await page.evaluate(() => { window.__game.start(); window.__game.set({ toured: [1, 2, 3, 4] }) })
  await page.waitForFunction(() => window.__game.state().playerZone === 1 && window.__game.state().loading === 1)
}
async function teleport(page: Page, x: number, z: number, yaw: number) {
  await page.evaluate(({ x, z, yaw }) => window.__game.teleportXZ(x, z, yaw), { x, z, yaw })
  await page.waitForFunction(({ x, z }) => Math.hypot(window.__game.live.pos[0] - x, window.__game.live.pos[2] - z) < 0.1 && window.__game.live.pos[1] < 0.021, { x, z })
}

test('les deux nœuds sont courbes, vitrés et solides, avec quatre passages dégagés', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await start(page)
  for (const zone of [1, 2]) {
    if (zone === 2) {
      await page.evaluate(() => { window.__game.goto(2); window.__game.set({ cine: null }) })
      await page.waitForFunction(() => window.__game.state().playerZone === 2 && window.__game.state().loading === 1)
    }
    const cx = zone === 1 ? 41 : 43, cz = zone === 1 ? 41 : 37
    await teleport(page, cx + 3, cz, -Math.PI / 4)
    const geometry = await page.evaluate(async (path) => {
      const { _roots } = await import(path)
      const s = _roots.get(document.querySelector('canvas')).store.getState().scene
      const wall = s.getObjectByName('hub-curved-wall'), glass = s.getObjectByName('hub-observation-windows')
      const n = wall.geometry.attributes.normal
      const directions = new Set(Array.from({ length: n.count }, (_, i) => `${n.getX(i).toFixed(3)},${n.getZ(i).toFixed(3)}`))
      return { directions: directions.size, glassVertices: glass.geometry.attributes.position.count }
    }, '/node_modules/.vite/deps/@react-three_fiber.js')
    expect(geometry.directions).toBeGreaterThan(100)
    expect(geometry.glassVertices).toBeGreaterThan(150)
    await page.screenshot({ path: `test-results/round-hub-${zone}.png` })
    // A clear window and an opaque stretch of the curved hull must both stop us.
    for (const degrees of [45, 112]) {
      const a = degrees * Math.PI / 180
      await teleport(page, cx + Math.sin(a) * 3, cz + Math.cos(a) * 3, Math.PI + a)
      await page.keyboard.down('ArrowUp')
      try {
        await page.waitForFunction(({ cx, cz }) => Math.hypot(window.__game.live.pos[0] - cx, window.__game.live.pos[2] - cz) > 6.4, { cx, cz })
        await page.waitForTimeout(650)
        const radius = await page.evaluate(({ cx, cz }) => Math.hypot(window.__game.live.pos[0] - cx, window.__game.live.pos[2] - cz), { cx, cz })
        expect(radius).toBeGreaterThan(6.4)
        expect(radius).toBeLessThan(6.8)
      } finally { await page.keyboard.up('ArrowUp') }
      await page.keyboard.down('ArrowDown')
      try { await page.waitForFunction(({ cx, cz }) => Math.hypot(window.__game.live.pos[0] - cx, window.__game.live.pos[2] - cz) < 6.0, { cx, cz }) }
      finally { await page.keyboard.up('ArrowDown') }
    }
  }
  expect(errors).toEqual([])
})

test('sauter sous une porte ouverte et la traverser ne pénètre jamais le linteau, dans les deux orientations', async ({ page }) => {
  await start(page)
  for (const door of [{ x: 41, z: 23, yaw: 0, axis: 2 }, { x: 23, z: 41, yaw: Math.PI / 2, axis: 0 }]) {
    await teleport(page, door.x, door.z, door.yaw)
    await page.waitForTimeout(1200) // Let the pressure leaves slide completely open.
    await page.evaluate(() => {
      const w = window as any
      w.jumpSamples = []
      const sample = () => { w.jumpSamples.push([...window.__game.live.pos]); w.sampleFrame = requestAnimationFrame(sample) }
      sample()
    })
    await page.keyboard.press('Space')
    await page.waitForFunction(() => window.__game.live.pos[1] > 0.3)
    await page.waitForFunction(() => window.__game.live.pos[1] < 0.025)
    const peak = await page.evaluate(() => Math.max(...(window as any).jumpSamples.map((p: number[]) => p[1])))
    expect(peak).toBeGreaterThan(0.3)
    expect(peak).toBeLessThan(0.61) // 2.30 m opening - 1.70 m capsule - skin.
    await page.evaluate(() => cancelAnimationFrame((window as any).sampleFrame))

    const fromX = door.x + (door.axis === 0 ? 1.8 : 0), fromZ = door.z + (door.axis === 2 ? 1.8 : 0)
    await teleport(page, fromX, fromZ, door.yaw)
    await page.keyboard.down('ArrowUp')
    await page.keyboard.press('Space')
    try {
      await page.waitForFunction(({ axis, x, z }) => window.__game.live.pos[axis] < (axis === 0 ? x : z) - 1.6, door)
    } finally { await page.keyboard.up('ArrowUp') }
    await page.screenshot({ path: `test-results/door-pass-${door.axis}.png` })
  }
  await teleport(page, 56.8, 41, -Math.PI / 2)
  await expect(page.locator('.prompt')).toBeVisible()
  expect((await page.locator('.prompt').boundingBox())!.height).toBeLessThan(60)
  await page.screenshot({ path: 'test-results/bulkhead-locked.png' })
})
