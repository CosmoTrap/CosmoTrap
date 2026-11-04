import { expect, test, type Page } from '@playwright/test'

test.setTimeout(120000)
async function guest(page: Page) {
  await page.route('**/api/auth.php?action=me', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  await page.addInitScript(() => localStorage.setItem('cosmotrap.settings.v1', JSON.stringify({ quality: 'low', music: 0, voice: 0, sfx: 0 })))
  await page.goto('/?quality=low')
  await page.getByTestId('guest').click()
}
async function ready(page: Page, zone = 1) {
  await page.waitForFunction((z) => window.__game.state().playerZone === z && window.__game.state().loading === 1, zone)
  await expect(page.getByTestId('scene-loading')).toBeHidden()
}
async function scene(page: Page) {
  await page.evaluate(async (path) => {
    const { _roots } = await import(path)
    ;(window as any).testScene = _roots.get(document.querySelector('canvas')).store.getState().scene
  }, '/node_modules/.vite/deps/@react-three_fiber.js')
}

test('passer à froid affiche la préparation, attend les ressources et rend immédiatement le jeu', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  await page.route('**/assets/models/adjustable_wrench.glb', async (route) => { await gate; await route.continue() })
  await guest(page)
  await page.getByTestId('new-game').first().click()
  await page.getByTestId('start').click()
  await page.getByTestId('skip-prologue').click()
  await expect(page.getByTestId('scene-loading')).toBeVisible()
  expect(await page.evaluate(() => ({ cine: window.__game.state().cine, time: window.__game.state().playTime }))).toEqual({ cine: null, time: 0 })
  await page.screenshot({ path: 'test-results/scene-preparation.png' })
  release()
  await ready(page)
  await page.evaluate(() => window.__game.teleportXZ(41, 41, -Math.PI / 2))
  await page.waitForFunction(() => Math.abs(window.__game.live.pos[0] - 41) < 0.1)
  await page.keyboard.down('ArrowUp')
  await page.waitForFunction(() => window.__game.live.pos[0] > 41.6)
  await page.keyboard.up('ArrowUp')
  expect(errors).toEqual([])
})

test('tous les objets tenus et la tablette se rendent sans interrompre le monde', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await guest(page)
  await page.evaluate(() => window.__game.start())
  await ready(page)
  await scene(page)
  await page.evaluate(() => window.__game.teleportXZ(41, 41, -Math.PI / 2))
  for (const item of ['wrench', 'fuse', 'cell', 'rope', 'badge', 'carBattery', 'antenna', 'flareGun', 'manual', 'map']) {
    await page.evaluate((it) => { window.__game.give(it); window.__game.useItem(it); window.__game.set({ readNote: null }) }, item)
    await expect.poll(async () => page.evaluate(() => window.__game.state().held)).toBe(item)
    await page.waitForFunction(() => (window as any).testScene.getObjectByName('held-item')?.visible)
    await page.waitForTimeout(450) // Let the short equip motion finish for visual review.
    await page.screenshot({ path: `test-results/held-${item}.png` })
    expect(await page.evaluate(() => window.__game.state().loading)).toBe(1)
  }
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('tablet')).toBeVisible()
  await page.screenshot({ path: 'test-results/held-tablet.png' })
  await page.keyboard.press('Tab')
  expect(errors).toEqual([])
})

test('la coupure allume des faisceaux rouges rotatifs continus puis rétablit les lumières', async ({ page }) => {
  await guest(page)
  await page.evaluate(() => { window.__game.start('nova', true, 'astronaut', true); window.__game.set({ flags: { ...window.__game.state().flags, power: true, pw_lights: true } }) })
  await ready(page)
  await scene(page)
  // Exercise the actual event scheduler, not a manually started blackout.
  await page.evaluate(() => {
    window.__game.teleportXZ(41, 41, -Math.PI / 2)
    const random = Math.random
    try {
      Math.random = () => 0
      window.__game.set({ nextEventAt: window.__game.state().playTime })
      window.__game.drain(0.2)
    } finally { Math.random = random }
  })
  expect(await page.evaluate(() => window.__game.state().event?.kind)).toBe('blackout')
  await page.waitForFunction(() => (window as any).testScene.getObjectByName('alert-beam:0').intensity > 0)
  expect(await page.evaluate(() => ['couloir', 'dortoir', 'refectoire', 'infirmerie', 'sas'].every((id) => {
    const s = (window as any).testScene
    return s.getObjectByName(`room-light:${id}`).intensity === 0 && s.getObjectByName(`ceiling-light:${id}`).material.emissiveIntensity === 0
  }))).toBe(true)
  const before = await page.evaluate(() => {
    const l = (window as any).testScene.getObjectByName('alert-beam:0')
    return { intensity: l.intensity, color: l.color.getHexString(), target: l.target.position.toArray() }
  })
  expect(before.color).toBe('ff1408')
  const samples = await page.evaluate(() => new Promise<any[]>((resolve) => {
    const out: any[] = []
    const sample = () => {
      const l = (window as any).testScene.getObjectByName('alert-beam:0')
      out.push({ intensity: l.intensity, target: l.target.position.toArray() })
      if (out.length === 30) resolve(out); else requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
  }))
  expect(samples.every((s) => s.intensity === before.intensity)).toBe(true)
  expect(samples.at(-1).target).not.toEqual(before.target)
  await page.screenshot({ path: 'test-results/emergency-beacon.png' })
  await page.evaluate(() => window.__game.drain(23))
  expect(await page.evaluate(() => window.__game.state().event?.kind)).toBe('blackout')
  await page.evaluate(() => window.__game.drain(10))
  expect(await page.evaluate(() => window.__game.state().event)).toBeNull()
  await page.waitForFunction(() => (window as any).testScene.getObjectByName('alert-beam:0').intensity === 0)
  await page.waitForFunction(() => (window as any).testScene.getObjectByName('room-light:couloir').intensity > 10)
})

test('les coupures régulières du couloir reviennent et les gyrophares prennent le relais', async ({ page }) => {
  await guest(page)
  await page.evaluate(() => window.__game.start())
  await ready(page)
  await scene(page)
  await page.evaluate(() => window.__game.teleportXZ(41, 41, -Math.PI / 2))
  await page.waitForFunction(() => window.__game.live.roomId === 'couloir')
  await page.waitForFunction(() => (window as any).testScene.getObjectByName('room-light:couloir').intensity > 10)
  await page.screenshot({ path: 'test-results/power-normal.png' })
  await page.evaluate(() => window.__game.drain(9))
  await page.waitForFunction(() => (window as any).testScene.getObjectByName('room-light:couloir').intensity === 0)
  expect(await page.evaluate(() => {
    const s = (window as any).testScene
    return { normal: s.getObjectByName('ceiling-light:couloir').material.emissiveIntensity,
      red: s.getObjectByName('alert-beam:0').intensity, otherRoom: s.getObjectByName('room-light:dortoir').intensity }
  })).toEqual({ normal: 0, red: 65, otherRoom: expect.any(Number) })
  expect(await page.evaluate(() => (window as any).testScene.getObjectByName('room-light:dortoir').intensity)).toBeGreaterThan(10)
  expect(await page.evaluate(() => window.__game.state().event)).toBeNull()
  await page.screenshot({ path: 'test-results/power-cut-red.png' })
  await page.evaluate(() => window.__game.drain(6))
  expect(await page.evaluate(() => (window as any).testScene.getObjectByName('room-light:couloir').intensity)).toBe(0)
  await page.evaluate(() => window.__game.drain(10))
  await page.waitForFunction(() => (window as any).testScene.getObjectByName('room-light:couloir').intensity > 10)
  expect(await page.evaluate(() => (window as any).testScene.getObjectByName('alert-beam:0').intensity)).toBe(0)
  // The local outage must recur, independently of random global events.
  await page.evaluate(() => window.__game.drain(20))
  await page.waitForFunction(() => (window as any).testScene.getObjectByName('room-light:couloir').intensity === 0)
  expect(await page.evaluate(() => (window as any).testScene.getObjectByName('alert-beam:0').intensity)).toBe(65)
})

test('passer après impact efface immédiatement le flou et toutes les particules du crash', async ({ page }) => {
  await guest(page)
  await page.evaluate(() => { window.__game.start(); window.__game.goto(4) })
  await ready(page, 4)
  await scene(page)
  await page.evaluate(() => window.__game.set({ cine: 'tour', cineT0: performance.now() - 6700 }))
  await page.waitForFunction(() => (window as any).testScene.getObjectByName('crash-particles').children.some((s: any) => s.visible))
  await page.getByTestId('skip').click()
  await expect(page.getByTestId('skip')).toBeHidden()
  expect(await page.evaluate(async (path) => {
    const { actor, film, crash } = await import(path)
    return { cine: window.__game.state().cine, actor: actor.visible, blur: film.blur, impact: crash.impact, falling: crash.active }
  }, '/src/world/FilmScenes.tsx')).toEqual({ cine: null, actor: false, blur: 0, impact: -1, falling: false })
  await page.waitForFunction(() => (window as any).testScene.getObjectByName('crash-particles').children.every((s: any) => !s.visible))
  await page.screenshot({ path: 'test-results/after-skip-earth.png' })
  const before = await page.evaluate(() => window.__game.state().playTime)
  await page.waitForFunction((t) => window.__game.state().playTime > t + 0.2, before)
  await expect(page.getByTestId('scene-loading')).toBeHidden()
})
