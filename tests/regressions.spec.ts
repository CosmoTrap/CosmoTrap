import { expect, test, type Page } from '@playwright/test'

const state = (page: Page) => page.evaluate(() => window.__game.state())
async function call(page: Page, fn: string, ...args: unknown[]) {
  return page.evaluate(({ fn, args }) => window.__game[fn](...args), { fn, args })
}
async function guest(page: Page, legacyKeys = false) {
  await page.route('**/api/auth.php?action=me', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  await page.addInitScript((legacy) => localStorage.setItem('cosmotrap.settings.v1', JSON.stringify({ quality: 'low', music: 0, voice: 0, sfx: 0, map: 'station',
    ...(legacy ? { keys: { act: ['KeyE', 'Space'] } } : {}) })), legacyKeys)
  await page.goto('/?quality=low')
  await enterAsGuest(page)
}
/** écran de lancement → connexion → invité (serveur injoignable) */
async function enterAsGuest(page: Page) {
  await expect(page.getByTestId('launch')).toBeVisible()
  await page.keyboard.press('Space')
  await page.getByTestId('guest').click()
  await expect(page.getByTestId('title')).toBeVisible()
}
async function playable(page: Page) {
  await expect.poll(async () => (await state(page)).cine).toBeNull()
  await expect.poll(async () => (await state(page)).loading, { timeout: 60000 }).toBe(1)
  expect(await page.evaluate(() => ({ camera: window.__game.live.camOverride, fade: window.__game.live.fade,
    flash: window.__game.live.flash, card: window.__game.live.card, countdown: window.__game.live.countdown })))
    .toEqual({ camera: null, fade: 0, flash: 0, card: null, countdown: null })
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('tablet')).toBeVisible()
  await page.keyboard.press('Tab')
  // A cleared state alone is insufficient: actual Rapier movement must resume.
  await call(page, 'teleportXZ', 44, 41, -Math.PI / 2)
  await expect.poll(async () => Math.abs((await state(page)).pos[0] - 44)).toBeLessThan(0.1)
  const before = (await state(page)).pos[0]
  await page.keyboard.down('ArrowUp')
  try { await expect.poll(async () => (await state(page)).pos[0], { timeout: 20000 }).toBeGreaterThan(before + 0.45) }
  finally { await page.keyboard.up('ArrowUp') }
}

test('passer le prologue rend directement les commandes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await guest(page)
  await page.getByTestId('launch-mission').click()
  await page.getByTestId('skip-prologue').click()
  await playable(page)
  expect(errors).toEqual([])
})

test('Espace saute une fois depuis le sol, sans double saut ni interaction', async ({ page }) => {
  test.setTimeout(60000)
  await guest(page, true) // Existing players also had Space bound to interaction.
  await call(page, 'start')
  await page.waitForFunction(() => window.__game.state().playerZone === 1 && window.__game.state().playTime > 0.4)
  await call(page, 'teleport', 'locker')
  // Teleport starts slightly above the floor; wait for actual ground contact.
  await page.waitForFunction(() => window.__game.live.aimed === 'locker' && window.__game.live.pos[1] < 0.021)
  const ground = (await state(page)).pos[1]
  await page.evaluate(() => {
    const w = window as any
    w.jumpHeights = []
    const sample = () => { w.jumpHeights.push(window.__game.live.pos[1]); w.jumpFrame = requestAnimationFrame(sample) }
    sample()
  })
  await page.keyboard.down('Space')
  await page.waitForFunction((y) => window.__game.live.pos[1] > y + 0.35, ground)
  expect((await state(page)).puzzle).toBeNull()
  // A second press during ascent must not add another impulse.
  await page.keyboard.up('Space')
  await page.keyboard.down('Space')
  await page.waitForFunction((y) => window.__game.live.pos[1] < y + 0.06, ground)
  const landingFrame = await page.evaluate(() => (window as any).jumpHeights.length)
  await page.waitForFunction((n) => (window as any).jumpHeights.length > n + 25, landingFrame)
  await page.keyboard.up('Space')
  const heights = await page.evaluate(() => (window as any).jumpHeights as number[])
  expect(Math.max(...heights) - ground).toBeGreaterThan(0.6)
  expect(Math.max(...heights) - ground).toBeLessThan(1.15)
  expect(Math.max(...heights.slice(landingFrame + 3)) - ground).toBeLessThan(0.06)

  // A press while paused must neither jump nor be replayed after resuming.
  await call(page, 'set', { paused: true })
  await page.keyboard.press('Space')
  await call(page, 'set', { paused: false })
  const resumeFrame = await page.evaluate(() => (window as any).jumpHeights.length)
  await page.waitForFunction((n) => (window as any).jumpHeights.length > n + 25, resumeFrame)
  expect(await page.evaluate((n) => Math.max(...(window as any).jumpHeights.slice(n)), resumeFrame)).toBeLessThan(ground + 0.06)
  await page.keyboard.press('KeyE')
  await expect(page.getByTestId('key-1')).toBeVisible()
  await page.evaluate(() => cancelAnimationFrame((window as any).jumpFrame))
})

test('passer visite, briefing, transition, decollage et sauvetage', async ({ page }) => {
  await guest(page)
  await call(page, 'start')
  await page.waitForFunction(() => window.__game.state().playerZone === 1 && window.__game.state().playTime > 0.4)
  for (const cine of ['tour', 'briefing', 'zoneCard']) {
    await test.step(`Passer ${cine}`, async () => {
    await page.evaluate((kind) => window.__game.set({ cine: kind, cineT0: performance.now(), briefed: false, toured: [] }), cine)
    await expect(page.getByTestId('skip')).toBeVisible()
    if (cine === 'tour') await page.waitForFunction(() => !!window.__game.live.camOverride)
    if (cine === 'briefing') await page.keyboard.press('Enter')
    else await page.getByTestId('skip').click()
    await playable(page)
    })
  }
  // Natural completion must also release the camera and all overlays.
  await page.evaluate(() => window.__game.set({ cine: 'tour', cineT0: performance.now() - 120000, briefed: true }))
  await playable(page)
  await call(page, 'goto', 3)
  await page.evaluate(() => window.__game.set({ cine: 'launch', cineT0: performance.now() - 12000 }))
  await page.getByTestId('skip').click()
  await expect.poll(async () => (await state(page)).zone).toBe(4)
  await expect.poll(async () => (await state(page)).cine).toBeNull()
  // Main's crash scene must release its actor, blur and falling capsule when skipped.
  await page.waitForFunction(() => window.__game.state().playerZone === 4 && window.__game.state().loading === 1)
  await page.evaluate(() => window.__game.set({ cine: 'tour', cineT0: performance.now() - 3000 }))
  await page.waitForFunction(() => !!window.__game.live.camOverride)
  await page.getByTestId('skip').click()
  await expect.poll(async () => (await state(page)).cine).toBeNull()
  expect(await page.evaluate(async (path) => {
    const { actor, film, crash } = await import(path)
    return { actor: actor.visible, blur: film.blur, falling: crash.active, landed: crash.k }
  }, '/src/world/FilmScenes.tsx')).toEqual({ actor: false, blur: 0, falling: false, landed: 1 })
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('tablet')).toBeVisible()
  await page.keyboard.press('Tab')
  await page.evaluate(() => window.__game.set({ cine: 'heli', cineT0: performance.now() - 10000 }))
  await page.keyboard.press('Enter')
  await expect(page.getByTestId('end')).toBeVisible()
  expect((await state(page)).ending).toBe('rescue')
  expect(await page.evaluate(() => window.__game.live.camOverride)).toBeNull()
})

test('tables, lits, meubles et caisses bloquent la marche sans bloquer les passages', async ({ page }) => {
  await guest(page)
  await call(page, 'start')
  await page.waitForFunction(() => window.__game.state().playerZone === 1 && window.__game.state().playTime > 0.4)
  const cases = [
    { label: 'table et banc', zone: 1, x: 35, z: 22.2, yaw: 0, axis: 2, min: 20.2, max: 20.6 },
    { label: 'lit medical', zone: 1, x: 45, z: 65.5, yaw: 0, axis: 2, min: 62.2, max: 62.6 },
    { label: 'lit mural tourne', zone: 1, x: 13, z: 39, yaw: Math.PI / 2, axis: 0, min: 11.22, max: 11.65 },
    { label: 'meuble laboratoire', zone: 2, x: 23, z: 13.2, yaw: 0, axis: 2, min: 11.04, max: 11.4 },
    // Approach perpendicular to the rotated face, inside the room; walking
    // obliquely against a corner correctly slides around it.
    { label: 'caisses tournees', zone: 3, x: 7 + Math.sin(0.5) * 1.35, z: 23 + Math.cos(0.5) * 1.35, yaw: 0.5, axis: 2, min: 23.48, max: 23.95 },
  ]
  for (const c of cases) {
    await test.step(c.label, async () => {
      await call(page, 'goto', c.zone)
      await call(page, 'set', { cine: null, paused: false })
      await page.waitForFunction((z) => window.__game.state().playerZone === z && window.__game.state().loading === 1, c.zone)
      await call(page, 'teleportXZ', c.x, c.z, c.yaw)
      await expect.poll(async () => Math.hypot((await state(page)).pos[0] - c.x, (await state(page)).pos[2] - c.z)).toBeLessThan(0.1)
      await page.keyboard.down('ArrowUp')
      try {
        await expect.poll(async () => (await state(page)).pos[c.axis], { timeout: 30000 }).toBeLessThan(c.max)
        await page.waitForTimeout(1800)
        expect((await state(page)).pos[c.axis]).toBeGreaterThan(c.min)
      } finally { await page.keyboard.up('ArrowUp') }
      const stopped = (await state(page)).pos[c.axis]
      await page.keyboard.down('ArrowDown')
      try { await expect.poll(async () => (await state(page)).pos[c.axis]).toBeGreaterThan(stopped + 0.3) }
      finally { await page.keyboard.up('ArrowDown') }
    })
  }
})

test('le chariot de la serre se pousse et garde sa position, les autres portes restent libres', async ({ page }) => {
  test.setTimeout(120000)
  await guest(page)
  await call(page, 'start')
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await call(page, 'goto', 2)
  await call(page, 'set', { cine: null, paused: false, toured: [1, 2, 3, 4] })
  await page.waitForFunction(() => window.__game.state().playerZone === 2 && window.__game.state().loading === 1 && !!window.__game.state().propPositions['serre-cart'])
  await call(page, 'teleportXZ', 43, 19, 0)
  await page.waitForFunction(() => Math.abs(window.__game.live.pos[0] - 43) < 0.05 && window.__game.live.pos[1] < 0.021)
  const initial = (await state(page)).propPositions['serre-cart']
  await page.screenshot({ path: 'test-results/serre-avant-poussee.png' })
  await page.keyboard.down('ArrowUp')
  try {
    // The player must pass the door by physically pushing, without a teleport
    // or an interaction call that bypasses collision detection.
    await expect.poll(async () => (await state(page)).pos[2], { timeout: 20000 }).toBeLessThan(14.5)
  } finally { await page.keyboard.up('ArrowUp') }
  await page.waitForTimeout(700)
  const moved = (await state(page)).propPositions['serre-cart']
  expect(moved[2]).toBeLessThan(initial[2] - 1)
  expect(Math.abs(moved[0] - initial[0])).toBeLessThan(0.25)
  expect(Math.abs(moved[1] - initial[1])).toBeLessThan(0.02)
  expect((await state(page)).pos[2]).toBeGreaterThan(moved[2] + 0.28)
  await page.screenshot({ path: 'test-results/serre-apres-poussee.png' })

  // Back out through the same doorway; the cart must not follow the player.
  await page.keyboard.down('ArrowDown')
  try { await expect.poll(async () => (await state(page)).pos[2]).toBeGreaterThan(18.5) }
  finally { await page.keyboard.up('ArrowDown') }
  await call(page, 'goto', 3)
  await call(page, 'set', { cine: null, paused: false })
  await page.waitForFunction(() => window.__game.state().playerZone === 3 && window.__game.state().loading === 1)
  await call(page, 'teleportXZ', 5, 17, Math.PI)
  await page.waitForFunction(() => Math.abs(window.__game.live.pos[2] - 17) < 0.1)
  await page.keyboard.down('ArrowUp')
  try { await expect.poll(async () => (await state(page)).pos[2]).toBeGreaterThan(21.5) }
  finally { await page.keyboard.up('ArrowUp') }

  // Save, reload the page and resume: the entrance must stay cleared.
  await call(page, 'goto', 2)
  await call(page, 'set', { cine: null, paused: false })
  await page.waitForFunction(() => window.__game.state().playerZone === 2 && window.__game.state().loading === 1)
  await expect.poll(async () => (await state(page)).propPositions['serre-cart'][2]).toBeCloseTo(moved[2], 1)
  await page.waitForFunction((z) => {
    const saved = JSON.parse(localStorage.getItem('cosmotrap.save.v2.guest') || 'null')
    return saved?.zone === 2 && Math.abs(saved.propPositions?.['serre-cart']?.[2] - z) < 0.1
  }, moved[2])
  await page.reload()
  await enterAsGuest(page)
  await page.getByTestId('continue').first().click()
  await page.waitForFunction(() => window.__game.state().playerZone === 2 && window.__game.state().loading === 1)
  expect((await state(page)).propPositions['serre-cart'][2]).toBeCloseTo(moved[2], 1)
  expect(errors).toEqual([])
})
