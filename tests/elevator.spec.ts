import { expect, test, type Page } from '@playwright/test'

test.setTimeout(240000)

const CAB = { 1: [41, 41], 2: [43, 37] } as const

async function start(page: Page) {
  await page.route('**/api/auth.php?action=me', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  await page.addInitScript(() => localStorage.setItem('cosmotrap.settings.v1', JSON.stringify({ quality: 'low', music: 0, voice: 0, sfx: 0 })))
  await page.goto('/?quality=low')
  await expect(page.getByTestId('launch')).toBeVisible()
  await page.keyboard.press('Space')
  await page.getByTestId('guest').click()
  await page.evaluate(() => { window.__game.start(); window.__game.set({ toured: [1] }) })
  await page.waitForFunction(() => window.__game.state().playerZone === 1 && window.__game.state().loading === 1)
}

async function teleport(page: Page, x: number, z: number, yaw: number) {
  await page.evaluate(({ x, z, yaw }) => window.__game.teleportXZ(x, z, yaw), { x, z, yaw })
  await page.waitForFunction(({ x, z }) => Math.hypot(window.__game.live.pos[0] - x, window.__game.live.pos[2] - z) < 0.1 && window.__game.live.pos[1] < 0.03, { x, z })
}

/** Walk from the hub, through the door, up to the tablet at the back of the cab. */
async function boardAndRide(page: Page, zone: 1 | 2) {
  const [cx, cz] = CAB[zone]
  await teleport(page, cx + 4, cz, Math.PI / 2)
  await page.keyboard.down('ArrowUp')
  try { await page.waitForFunction((cx) => window.__game.live.pos[0] < cx - 0.3, cx, { timeout: 30000 }) }
  finally { await page.keyboard.up('ArrowUp') }
  await expect.poll(() => page.evaluate(() => window.__game.state().aimed), { timeout: 10000 }).toBe('lift')
  await expect(page.locator('.prompt')).toBeVisible()
  await page.screenshot({ path: `test-results/lift-inside-${zone}.png` })
  await page.keyboard.press('KeyE')
  await expect.poll(() => page.evaluate(() => window.__game.state().cine)).toBe('lift')
}

async function arrive(page: Page, zone: 1 | 2) {
  await page.waitForFunction((zone) => {
    const s = window.__game.state()
    return s.zone === zone && s.playerZone === zone && s.loading === 1
  }, zone, { timeout: 60000 })
}

test('verrouillé sans les énigmes, puis aller-retour libre entre les deux étages', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await start(page)
  const [cx, cz] = CAB[1]

  // Locked: the door physically stops the player and only offers a refusal.
  await teleport(page, cx + 4, cz, Math.PI / 2)
  await page.screenshot({ path: 'test-results/lift-locked.png' })
  await page.keyboard.down('ArrowUp')
  try {
    await page.waitForFunction((cx) => window.__game.live.pos[0] < cx + 2.6, cx)
    await page.waitForTimeout(1500)
    expect(await page.evaluate(() => window.__game.live.pos[0])).toBeGreaterThan(cx + 1.8)
  } finally { await page.keyboard.up('ArrowUp') }
  await expect.poll(() => page.evaluate(() => window.__game.state().aimed)).toBe('liftDoor')
  await expect(page.locator('.prompt')).toBeVisible()
  await page.keyboard.press('KeyE')
  await page.waitForTimeout(300)
  expect(await page.evaluate(() => [window.__game.state().zone, window.__game.state().cine])).toEqual([1, null])

  // The trapdoor is gone, and the lift stays shut until the last puzzle is solved.
  expect(await page.evaluate(() => window.__game.ents())).not.toContain('hatch')
  await page.evaluate(() => window.__game.set({ flags: { ...window.__game.state().flags, lockerOpen: true, door_d1: true } }))
  expect(await page.evaluate(() => window.__game.interact('lift'))).toBe(false)
  await page.evaluate(() => window.__game.set({ flags: { ...window.__game.state().flags, pressurized: true }, inv: { lamp: 1 }, taken: ['1:lamp'] }))

  // First trip down: title card and the floor's film scene, then the player is in the cab.
  await boardAndRide(page, 1)
  await arrive(page, 2)
  await page.waitForFunction(() => window.__game.state().cine === 'tour', undefined, { timeout: 30000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'test-results/lift-tour-2.png' })
  await page.getByTestId('skip').click()
  await expect.poll(() => page.evaluate(() => window.__game.state().cine)).toBe(null)
  await page.waitForTimeout(1200)
  expect(Math.hypot(...(await page.evaluate(() => [window.__game.live.pos[0] - 43, window.__game.live.pos[2] - 37])) as [number, number])).toBeLessThan(0.2)
  await page.screenshot({ path: 'test-results/lift-arrival-2.png' })

  // Walk out through the door on floor 2 and work on a floor-2 flag.
  await page.keyboard.down('ArrowUp')
  try { await page.waitForFunction(() => window.__game.live.pos[0] > 46, undefined, { timeout: 30000 }) }
  finally { await page.keyboard.up('ArrowUp') }
  await page.evaluate(() => window.__game.set({ flags: { ...window.__game.state().flags, steamFixed: true }, discovered: ['p_steam', 'p_power'] }))
  await page.screenshot({ path: 'test-results/lift-outside-2.png' })

  // Back up, then down again: no card, no film, progress and items intact, door works from both sides.
  for (const [from, to] of [[2, 1], [1, 2], [2, 1]] as const) {
    await boardAndRide(page, from)
    await arrive(page, to)
    await expect.poll(() => page.evaluate(() => window.__game.state().cine), { timeout: 20000 }).toBe(null)
    const [x, z] = CAB[to]
    expect(Math.hypot(...(await page.evaluate(() => [window.__game.live.pos[0], window.__game.live.pos[2]]) as [number, number]).map((v, i) => v - (i ? z : x)) as [number, number])).toBeLessThan(0.2)
    const s = await page.evaluate(() => window.__game.state())
    expect(s.flags.steamFixed && s.flags.pressurized).toBe(true)
    expect(s.inv.lamp).toBe(1)
    await page.waitForTimeout(1000)
    await page.keyboard.down('ArrowUp')
    try { await page.waitForFunction((x) => window.__game.live.pos[0] > x + 2.5, x, { timeout: 30000 }) }
    finally { await page.keyboard.up('ArrowUp') }
  }

  // Taken items do not come back on floor 1, and the mission points back to floor 2.
  expect(await page.evaluate(() => window.__game.ents())).toContain('lift')
  await page.screenshot({ path: 'test-results/lift-outside-1.png' })
  await page.waitForFunction(() => { const s = JSON.parse(localStorage.getItem('cosmotrap.save.v2.guest') || 'null'); return s?.zone === 1 })
  expect(errors).toEqual([])
})
