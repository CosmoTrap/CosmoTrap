import { expect, test, type Page } from '@playwright/test'

test.setTimeout(90000)

const state = (page: Page) => page.evaluate(() => window.__game.state())
async function start(page: Page) {
  await page.route('**/api/auth.php?action=me', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  await page.addInitScript(() => {
    if (!localStorage.getItem('cosmotrap.settings.v1')) localStorage.setItem('cosmotrap.settings.v1', JSON.stringify({ quality: 'low', music: 0, voice: 0, sfx: 0 }))
  })
  await page.goto('/?quality=low')
  await expect(page.getByTestId('launch')).toBeVisible()
  await page.keyboard.press('Space')
  await page.getByTestId('guest').click()
  await page.evaluate(() => window.__game.start())
  await page.waitForFunction(() => window.__game.state().playerZone === 1 && window.__game.state().playTime > 0.4, null, { timeout: 60000 })
}
async function fill(page: Page) {
  await page.evaluate(() => {
    for (const item of ['lamp', 'o2', 'water', 'battery', 'badge', 'fuse', 'wrench', 'cell', 'rope', 'carBattery', 'tape', 'map', 'medkit']) window.__game.give(item, item === 'water' ? 2 : 1)
  })
}

test('molette : tous les objets, aucune consommation, utilisation explicite et sélection valide après épuisement', async ({ page }) => {
  await start(page)
  await fill(page)
  const before = (await state(page)).inv
  const pitch = await page.evaluate(() => window.__game.live.pitch)
  await page.mouse.move(640, 350)
  await page.mouse.wheel(0, 120)
  await expect.poll(async () => (await state(page)).selectedItem).toBe('o2')
  expect((await state(page)).inv).toEqual(before)
  expect(await page.evaluate(() => window.__game.live.pitch)).toBe(pitch)
  await page.mouse.wheel(0, -120)
  await expect.poll(async () => (await state(page)).selectedItem).toBe('lamp')
  await page.mouse.wheel(0, -120)
  await expect.poll(async () => (await state(page)).selectedItem).toBe('medkit')
  await expect(page.getByTestId('hotbar-medkit')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('hotbar').locator('.slot')).toHaveCount(12)
  await page.keyboard.press('Digit3')
  expect((await state(page)).selectedItem).toBe('water')
  expect((await state(page)).inv.water).toBe(2)
  await page.evaluate(() => window.__game.setRes({ water: 20 }))
  await page.keyboard.down('KeyX')
  await page.keyboard.down('KeyX') // A repeated key must not consume twice.
  await page.keyboard.up('KeyX')
  expect((await state(page)).inv.water).toBe(1)
  expect((await state(page)).res.water).toBeGreaterThan(69)
  await page.keyboard.press('KeyX')
  expect((await state(page)).inv.water).toBeUndefined()
  expect((await state(page)).selectedItem).toBe('battery')
  await expect(page.getByTestId('hotbar-battery')).toHaveAttribute('aria-pressed', 'true')
  await page.screenshot({ path: 'test-results/inventory-hotbar.png' })
})

test('inventaire agrandi : ouverture, détails, défilement sans sélection, documents et retour aux commandes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await start(page)
  await page.keyboard.press('KeyI')
  await expect(page.getByTestId('inventory')).toContainText('Votre inventaire est vide')
  await page.keyboard.press('KeyI')
  await fill(page)
  await page.keyboard.press('KeyI')
  await expect(page.getByTestId('inventory')).toBeVisible()
  expect(await page.evaluate(() => !!document.pointerLockElement)).toBe(false)
  await expect(page.getByTestId('inventory').locator('.inventory-cell:not(.empty)')).toHaveCount(13)
  await page.getByTestId('inventory-water').click()
  await expect(page.getByTestId('inventory-detail')).toContainText("Poche d'eau")
  await page.evaluate(() => window.__game.setRes({ water: 20 }))
  await page.getByTestId('inventory-use').click()
  expect((await state(page)).inv.water).toBe(1)
  const pos = (await state(page)).pos
  await page.keyboard.down('ArrowUp')
  await page.waitForTimeout(500)
  await page.keyboard.up('ArrowUp')
  expect(Math.hypot((await state(page)).pos[0] - pos[0], (await state(page)).pos[2] - pos[2])).toBeLessThan(0.03)
  await page.getByTestId('inventory-badge').hover()
  await page.mouse.wheel(0, 500)
  await page.waitForTimeout(100)
  expect((await state(page)).selectedItem).toBe('water')
  await page.getByTestId('inventory-map').click()
  await page.locator('.inventory-storage').evaluate((el) => { el.scrollTop = 0 })
  await page.screenshot({ path: 'test-results/inventory-expanded.png' })
  await page.getByTestId('inventory-use').click()
  await expect(page.getByTestId('inventory')).toBeHidden()
  await expect(page.getByTestId('note')).toBeVisible()
  await page.keyboard.press('Escape')
  await page.keyboard.press('KeyI')
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('inventory')).toBeHidden()
  await page.evaluate(() => window.__game.teleportXZ(44, 41, -Math.PI / 2))
  await page.waitForFunction(() => Math.abs(window.__game.live.pos[0] - 44) < 0.1)
  await page.keyboard.down('ArrowUp')
  try { await expect.poll(async () => (await state(page)).pos[0]).toBeGreaterThan(44.5) }
  finally { await page.keyboard.up('ArrowUp') }
  await page.keyboard.press('KeyI')
  await page.setViewportSize({ width: 844, height: 390 })
  await expect(page.getByTestId('inventory-use')).toBeInViewport()
  await expect(page.getByTestId('close-tablet')).toBeInViewport()
  await page.screenshot({ path: 'test-results/inventory-small.png' })
  expect(errors).toEqual([])
})

test('raccourcis personnalisés, cinématiques et sauvegarde de la sélection', async ({ page }) => {
  await start(page)
  await fill(page)
  await page.evaluate(async () => {
    const { useGame, saveSettings } = await import('/src/game/state.ts' as string)
    const settings = { ...useGame.getState().settings, keys: { ...useGame.getState().settings.keys, inventory: ['KeyV'], useSelected: ['KeyC'] } }
    useGame.setState({ settings })
    saveSettings(settings)
  })
  await page.keyboard.press('KeyI')
  await expect(page.getByTestId('inventory')).toBeHidden()
  await page.keyboard.press('KeyV')
  await expect(page.getByTestId('inventory')).toBeVisible()
  await page.getByTestId('inventory-water').click()
  await page.evaluate(() => window.__game.setRes({ water: 20 }))
  await page.keyboard.press('KeyC')
  expect((await state(page)).inv.water).toBe(1)
  await page.keyboard.press('KeyV')
  await page.evaluate(() => window.__game.set({ cine: 'tour', cineT0: performance.now() }))
  await page.keyboard.press('KeyV')
  await expect(page.getByTestId('inventory')).toBeHidden()
  await page.keyboard.press('KeyC')
  expect((await state(page)).inv.water).toBe(1)
  await page.getByTestId('skip').click()
  await page.evaluate(async () => {
    const { saveGame } = await import('/src/game/state.ts' as string)
    saveGame(false)
  })
  await page.reload()
  await expect(page.getByTestId('launch')).toBeVisible()
  await page.keyboard.press('Space')
  await page.getByTestId('guest').click()
  await page.getByTestId('continue').first().click()
  await expect(page.getByTestId('scene-loading')).toBeHidden()
  await expect.poll(async () => (await state(page)).selectedItem).toBe('water')
  await expect(page.getByTestId('hotbar-water')).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('KeyV')
  await expect(page.getByTestId('inventory')).toBeVisible()
})

test('sur Terre, la couverture de survie évite le malus de vitesse sans jamais bloquer le joueur', async ({ page }) => {
  await start(page)
  await page.evaluate(() => { window.__game.goto(4); window.__game.set({ cine: null, toured: [1, 2, 3, 4] }) })
  await page.waitForFunction(() => window.__game.state().playerZone === 4 && window.__game.state().loading === 1, null, { timeout: 120000 })
  await page.waitForTimeout(500)
  const walk = async () => {
    const from = await page.evaluate(() => [...window.__game.live.pos])
    await page.keyboard.down('KeyW')
    await page.waitForTimeout(1500)
    await page.keyboard.up('KeyW')
    const to = await page.evaluate(() => [...window.__game.live.pos])
    await page.keyboard.down('KeyS')
    await page.waitForTimeout(1500)
    await page.keyboard.up('KeyS')
    await page.waitForTimeout(200)
    return Math.hypot(to[0] - from[0], to[2] - from[2])
  }
  const without = await walk()
  await page.evaluate(() => window.__game.give('blanket'))
  const withBlanket = await walk()
  expect(without).toBeGreaterThan(1)
  expect(without / withBlanket).toBeGreaterThan(0.7)
  expect(without / withBlanket).toBeLessThan(0.9)
})

test('vie : le gaz brûle, les trousses soignent, le froid blesse sur Terre sans couverture', async ({ page }) => {
  await start(page)
  await page.evaluate(() => { window.__game.goto(2); window.__game.set({ cine: null, toured: [1, 2, 3, 4] }) })
  await page.waitForFunction(() => window.__game.state().playerZone === 2 && window.__game.state().loading === 1, null, { timeout: 120000 })
  // Hors du gaz, rien ; dans le nuage, un seul coup de 40 % malgré plusieurs images.
  await page.evaluate(() => window.__game.teleportXZ(51, 37, -Math.PI / 2))
  await page.waitForTimeout(300)
  expect((await state(page)).res.hp).toBe(100)
  await page.evaluate(() => window.__game.teleportXZ(53, 37, -Math.PI / 2))
  await expect.poll(async () => (await state(page)).res.hp).toBe(60)
  await page.waitForTimeout(500)
  expect((await state(page)).res.hp).toBe(60)
  // Chaque nouveau passage brûle à nouveau.
  await page.evaluate(() => window.__game.teleportXZ(56, 37, -Math.PI / 2))
  await page.waitForTimeout(300)
  expect((await state(page)).res.hp).toBe(60)
  await page.evaluate(() => window.__game.teleportXZ(53, 37, -Math.PI / 2))
  await expect.poll(async () => (await state(page)).res.hp).toBe(20)
  const o2 = (await state(page)).res.o2
  expect(o2).toBeGreaterThan(90)
  await page.evaluate(() => window.__game.teleportXZ(51, 37, -Math.PI / 2))
  await page.waitForTimeout(300)
  // Une trousse soigne, et elle est refusée quand la vie est pleine.
  await page.evaluate(() => { window.__game.give('medkit', 2); window.__game.setRes({ hp: 20 }) })
  expect(await page.evaluate(() => window.__game.useItem('medkit'))).toBe(true)
  expect((await state(page)).res.hp).toBeCloseTo(40, 0)
  await page.evaluate(() => window.__game.setRes({ hp: 100 }))
  expect(await page.evaluate(() => window.__game.useItem('medkit'))).toBe(false)
  expect((await state(page)).inv.medkit).toBe(1)
  // À 15 %, la trousse restante se déclenche seule.
  await page.evaluate(() => { window.__game.setRes({ hp: 15 }); window.__game.drain(0.1) })
  expect((await state(page)).inv.medkit).toBeUndefined()
  expect((await state(page)).res.hp).toBeCloseTo(35, 0)
  // Sur Terre, la vie baisse sans couverture et ne bouge plus avec.
  await page.evaluate(() => { window.__game.goto(4); window.__game.set({ cine: null }) })
  await page.waitForFunction(() => window.__game.state().playerZone === 4 && window.__game.state().loading === 1, null, { timeout: 120000 })
  await page.evaluate(() => { window.__game.setRes({ hp: 80 }); window.__game.drain(10) })
  expect((await state(page)).res.hp).toBeCloseTo(79, 0)
  await page.evaluate(() => { window.__game.give('blanket'); window.__game.setRes({ hp: 80 }); window.__game.drain(10) })
  expect((await state(page)).res.hp).toBe(80)
})

for (const [gauge, cause, title] of [['o2', 'o2', 'Plus d’oxygène…'], ['hp', 'hp', 'Blessures mortelles…'], ['water', 'water', 'Plus une goutte d’eau…']] as const) {
  test(`à 0 % de ${gauge}, la partie est perdue et l'écran de défaite en donne la cause`, async ({ page }) => {
    await start(page)
    await page.evaluate((g) => { window.__game.setRes({ [g]: 0 }); window.__game.drain(0.1) }, gauge)
    expect((await state(page)).cine).toBe('fail')
    expect(await page.evaluate(() => window.__game.state().failCause)).toBe(cause)
    await expect(page.getByTestId('end')).toBeVisible({ timeout: 20000 })
    await expect(page.getByText(title)).toBeVisible()
    await expect(page.getByText('Temps restant')).toBeVisible()
    await page.waitForTimeout(2500)
    await page.screenshot({ path: `test-results/defaite-${cause}.png` })
  })
}

test('Sam soigne mieux, et le succès Souffle long suit le passage sous 15 % d’O₂', async ({ page }) => {
  await start(page)
  await page.evaluate(() => { window.__game.give('medkit'); window.__game.setRes({ hp: 20 }); window.__game.useItem('medkit') })
  expect((await state(page)).res.hp).toBeCloseTo(40, 0)
  // Une bouteille branchée à 15 % évite le passage en zone critique ; sans bouteille, il est retenu.
  await page.evaluate(() => { window.__game.give('o2'); window.__game.setRes({ o2: 15.05 }); window.__game.drain(1) })
  expect((await state(page)).o2Critical).toBe(false)
  await page.evaluate(() => { window.__game.setRes({ o2: 15.05 }); window.__game.drain(1) })
  expect((await state(page)).o2Critical).toBe(true)
  await page.evaluate(() => window.__game.start('sam'))
  await page.evaluate(() => { window.__game.give('medkit'); window.__game.setRes({ hp: 20 }); window.__game.useItem('medkit') })
  expect((await state(page)).res.hp).toBeCloseTo(50, 0)
  expect((await state(page)).o2Critical).toBe(false)
})

test('alarmes : niveau 1 jusqu’au sas, niveau 2 jusqu’à la vanne, 5 dernières minutes ; une coupure ne laisse que le rouge, sans bloquer l’ascenseur', async ({ page }) => {
  await start(page)
  const scene = async () => page.evaluate(async () => {
    const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js' as string)
    const s = _roots.get(document.querySelector('canvas')).store.getState().scene
    const l = s.getObjectByName('elevator-alarm-light')
    return { lift: '#' + l.color.getHexString(), liftOn: l.intensity > 0, beam: s.getObjectByName('alert-beam:0').intensity }
  })
  const setFlags = (f: Record<string, boolean>) => page.evaluate((f) => window.__game.set({ flags: { ...window.__game.state().flags, ...f } }), f)
  await page.evaluate(() => window.__game.teleportXZ(46, 41, 0))
  // Niveau 1 : alarme, ascenseur rouge, jusqu'à la pressurisation.
  await expect.poll(async () => (await scene()).lift).toBe('#ff1a0a')
  await expect.poll(async () => (await scene()).beam).toBe(48)
  await setFlags({ pressurized: true })
  await expect.poll(scene).toEqual({ lift: '#f2f6ff', liftOn: true, beam: 0 })
  // Moins de 5 minutes avant les météorites : l'alarme revient.
  await page.evaluate(() => window.__game.set({ playTime: 30 * 60 - 299 }))
  await expect.poll(async () => (await scene()).beam).toBe(48)
  await page.evaluate(() => window.__game.set({ playTime: 1 }))
  await expect.poll(async () => (await scene()).beam).toBe(0)
  // Niveau 2 : sans courant à l'arrivée, lampes éteintes et gyrophares rouges.
  const roomLight = () => page.evaluate(async () => {
    const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js' as string)
    return _roots.get(document.querySelector('canvas')).store.getState().scene.getObjectByName('room-light:couloir').intensity
  })
  await page.evaluate(() => { window.__game.goto(2); window.__game.set({ cine: null, toured: [1, 2, 3, 4] }) })
  await page.waitForFunction(() => window.__game.state().playerZone === 2 && window.__game.state().loading === 1, null, { timeout: 120000 })
  await page.evaluate(() => window.__game.teleportXZ(48, 37, 0))
  await expect.poll(async () => (await scene()).lift).toBe('#ff1a0a')
  await expect.poll(async () => (await scene()).beam).toBe(48)
  await expect.poll(roomLight).toBe(0)
  // Courant rétabli, gaz toujours en fuite : l'alarme, rouge et blanc ensemble.
  await setFlags({ power: true })
  await expect.poll(roomLight).toBeGreaterThan(10)
  expect((await scene()).beam).toBe(48)
  expect((await scene()).lift).toBe('#ff1a0a')
  await setFlags({ steamFixed: true })
  await expect.poll(scene).toEqual({ lift: '#f2f6ff', liftOn: true, beam: 0 })
  // Une coupure imprévue : rouge seul, et l'ascenseur reste utilisable.
  await page.evaluate(() => window.__game.startEvent('blackout'))
  await expect.poll(async () => (await scene()).lift).toBe('#ff1a0a')
  await expect.poll(roomLight).toBe(0)
  expect((await scene()).beam).toBe(48)
  expect(await page.evaluate(() => window.__game.interact('lift'))).toBe(true)
  expect((await state(page)).cine).toBe('lift')
})

test('la vanne reste visible une fois fermée, et la brûlure du gaz se voit', async ({ page }) => {
  await start(page)
  await page.evaluate(() => { window.__game.goto(2); window.__game.set({ cine: null, toured: [1, 2, 3, 4] }) })
  await page.waitForFunction(() => window.__game.state().playerZone === 2 && window.__game.state().loading === 1, null, { timeout: 120000 })
  await page.evaluate(() => window.__game.teleportXZ(53, 37, -Math.PI / 2))
  await expect.poll(async () => Number(await page.getByTestId('hurt-flash').evaluate((e) => (e as HTMLElement).style.opacity))).toBeGreaterThan(0.2)
  await expect.poll(async () => Number(await page.getByTestId('hurt-flash').evaluate((e) => (e as HTMLElement).style.opacity)), { timeout: 5000 }).toBe(0)
  await page.evaluate(() => { window.__game.teleportXZ(57, 37, -Math.PI / 2); window.__game.give('wrench'); window.__game.interact('steamValve') })
  expect((await state(page)).flags.steamFixed).toBe(true)
  const meshes = () => page.evaluate(async () => {
    const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js' as string)
    let n = 0
    _roots.get(document.querySelector('canvas')).store.getState().scene.getObjectByName('ent:steamValve').traverse((o: any) => { if (o.isMesh) n++ })
    return n
  })
  await page.waitForTimeout(300)
  expect(await meshes()).toBeGreaterThan(3)
})

test('un objet ramassé est sélectionné aussitôt, même avec plus de 9 objets', async ({ page }) => {
  await start(page)
  await page.evaluate(() => { for (const i of ['lamp', 'o2', 'water', 'wrench', 'fuse', 'cell', 'rope', 'tape', 'map', 'compass', 'whistle']) window.__game.give(i) })
  expect(await page.evaluate(() => window.__game.interact('battery_a'))).toBe(true)
  expect((await state(page)).selectedItem).toBe('battery')
  expect((await state(page)).inv.battery).toBe(1)
  await expect(page.getByTestId('hotbar-battery')).toHaveAttribute('aria-pressed', 'true')
})
