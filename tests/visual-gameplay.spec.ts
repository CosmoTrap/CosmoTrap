import { expect, test, type Page } from '@playwright/test'

test.setTimeout(120000)
async function guest(page: Page) {
  await page.route('**/api/auth.php?action=me', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  await page.addInitScript(() => localStorage.setItem('cosmotrap.settings.v1', JSON.stringify({ quality: 'low', music: 0, voice: 0, sfx: 0 })))
  await page.goto('/?quality=low')
  await expect(page.getByTestId('launch')).toBeVisible()
  await page.keyboard.press('Space')
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
  await page.getByTestId('launch-mission').click()
  await page.getByTestId('skip-prologue').click()
  await expect(page.getByTestId('scene-loading')).toBeVisible()
  expect(await page.evaluate(() => ({ cine: window.__game.state().cine, time: window.__game.state().playTime }))).toEqual({ cine: null, time: 0 })
  await page.screenshot({ path: 'test-results/scene-preparation.png' })
  release()
  await ready(page)
  await page.evaluate(() => window.__game.teleportXZ(44, 41, -Math.PI / 2))
  await page.waitForFunction(() => Math.abs(window.__game.live.pos[0] - 44) < 0.1)
  await page.keyboard.down('ArrowUp')
  await page.waitForFunction(() => window.__game.live.pos[0] > 44.6)
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
  await page.evaluate(() => window.__game.teleportXZ(44, 41, -Math.PI / 2))
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

test('une coupure imprévue éteint les plafonniers et allume les gyrophares rouges', async ({ page }) => {
  await guest(page)
  await page.evaluate(() => { window.__game.start('nova', true, 'astronaut', true); window.__game.set({ flags: { ...window.__game.state().flags, power: true, pw_lights: true, pressurized: true } }) })
  await ready(page)
  await scene(page)
  await page.evaluate(() => {
    window.__game.teleportXZ(44, 41, -Math.PI / 2)
    const random = Math.random
    try {
      Math.random = () => 0
      window.__game.set({ nextEventAt: window.__game.state().playTime })
      window.__game.drain(0.2)
    } finally { Math.random = random }
  })
  expect(await page.evaluate(() => window.__game.state().event?.kind)).toBe('blackout')
  await page.waitForFunction(() => (window as any).testScene.getObjectByName('room-light:couloir').intensity === 0)
  await page.waitForFunction(() => (window as any).testScene.getObjectByName('alert-beam:0').intensity > 0)
  await page.evaluate(() => window.__game.drain(33))
  expect(await page.evaluate(() => window.__game.state().event)).toBeNull()
  await page.waitForFunction(() => (window as any).testScene.getObjectByName('room-light:couloir').intensity > 10)
  await page.waitForFunction(() => (window as any).testScene.getObjectByName('alert-beam:0').intensity === 0)
})

test('une fois l’ascenseur déverrouillé, plus aucune coupure régulière ni alarme, aux deux étages', async ({ page }) => {
  await guest(page)
  await page.evaluate(() => window.__game.start())
  await ready(page)
  await scene(page)
  await page.evaluate(() => { window.__game.set({ flags: { ...window.__game.state().flags, pressurized: true } }); window.__game.teleportXZ(44, 41, -Math.PI / 2) })
  await page.waitForFunction(() => (window as any).testScene.getObjectByName('room-light:couloir').intensity > 10)
  await page.screenshot({ path: 'test-results/power-normal.png' })
  // The beacons are off and stopped, not just dark.
  const rotor = () => page.evaluate(() => (window as any).testScene.getObjectByName('alert-rotor').rotation.y)
  const stopped = await rotor()
  for (const seconds of [9, 16, 20]) {
    await page.evaluate((s) => window.__game.drain(s), seconds)
    await page.waitForTimeout(300)
    expect(await page.evaluate(() => (window as any).testScene.getObjectByName('room-light:couloir').intensity)).toBeGreaterThan(10)
    expect(await page.evaluate(() => (window as any).testScene.getObjectByName('alert-beam:0').intensity)).toBe(0)
    expect(await rotor()).toBe(stopped)
  }
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

test('le niveau 1 reste en alerte, lumières éteintes, jusqu’à sa dernière énigme, dortoir compris', async ({ page }) => {
  await guest(page)
  await page.evaluate(() => window.__game.start())
  await ready(page)
  await scene(page)
  const look = () => page.evaluate(() => {
    const s = (window as any).testScene
    return { red: s.getObjectByName('alert-beam:0').intensity, light: s.getObjectByName('room-light:dortoir').intensity,
      panel: s.getObjectByName('ceiling-light:dortoir').material.emissiveIntensity }
  })
  await page.waitForFunction(() => window.__game.live.roomId === 'dortoir')
  await expect.poll(look).toEqual({ red: 48, light: 0, panel: 0 })
  await page.evaluate(() => window.__game.drain(40)) // Past any local power cycle: still on alert.
  await expect.poll(look).toEqual({ red: 48, light: 0, panel: 0 })
  await page.screenshot({ path: 'test-results/alert-dortoir.png' })
  await page.evaluate(() => window.__game.set({ flags: { ...window.__game.state().flags, pressurized: true } }))
  await expect.poll(async () => (await look()).red).toBe(0)
  await expect.poll(async () => (await look()).light).toBeGreaterThan(10)
  await page.screenshot({ path: 'test-results/calm-dortoir.png' })
})
