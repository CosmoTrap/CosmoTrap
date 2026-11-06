import { expect, test, type Page } from '@playwright/test'

test.setTimeout(240000)

async function start(page: Page) {
  await page.route('**/api/auth.php?action=me', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  await page.addInitScript(() => {
    if (!localStorage.getItem('cosmotrap.settings.v1')) localStorage.setItem('cosmotrap.settings.v1', JSON.stringify({ quality: 'low', music: 0, voice: 0, sfx: 0 }))
  })
  await page.goto('/?quality=low')
  await expect(page.getByTestId('launch')).toBeVisible()
  await page.keyboard.press('Space')
  await page.getByTestId('guest').click()
  await page.evaluate(() => { window.__game.start(); window.__game.set({ toured: [1, 2, 3, 4] }) })
  await page.waitForFunction(() => window.__game.state().loading === 1)
}

async function openLocker(page: Page) {
  await page.evaluate(() => {
    const s = window.__game.state()
    window.__game.give('lamp')
    window.__game.set({ flags: { ...s.flags, read_board: true }, notes: ['plate'], puzzle: 'keypad', zone: 1 })
  })
  await expect(page.getByTestId('puzzle')).toBeVisible()
}

test('le chargement de zone affiche un pourcentage', async ({ page }) => {
  await start(page)
  await page.evaluate(() => window.__game.goto(2))
  const overlay = page.getByTestId('scene-loading')
  await expect(overlay).toBeVisible()
  await expect(overlay).toContainText('peut prendre un peu de temps')
  await expect(page.getByTestId('scene-loading-progress')).toHaveText(/\d{1,3} % chargé/)
  await page.waitForFunction(() => window.__game.state().loading === 1 && window.__game.state().loadProgress === 100, null, { timeout: 90000 })
  await expect(overlay).toBeHidden()
})

test('les indices du HUD et de la tablette partagent le même historique', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await start(page)
  for (const id of ['keypad', 'valves', 'power', 'algo', 'plan', 'dilemma', 'sequence', 'radio']) {
    await page.evaluate((puzzle) => window.__game.set({ puzzle }), id)
    await expect.poll(() => page.getByTestId('puzzle-hint').evaluate((el) => el.textContent)).toContain('Indice léger')
    await expect.poll(() => page.getByTestId('puzzle-hint2').evaluate((el) => el.textContent)).toContain('Indice fort')
  }
  await page.evaluate(() => {
    const lunar = window.__game.state().lunar
    window.__game.set({ map: 'base', puzzle: 'lunar', lunar: { ...lunar, current: 'manifest' } })
  })
  await page.waitForFunction(() => window.__game.state().puzzle === 'lunar', null, { timeout: 90000 })
  await expect(page.getByTestId('puzzle-hint')).toContainText('Indice léger')
  await expect(page.getByTestId('puzzle-hint2')).toContainText('60 secondes')

  await page.evaluate(() => window.__game.set({ map: 'station', difficulty: 'explorer' }))
  await openLocker(page)
  await expect(page.getByTestId('puzzle-hint')).toContainText('Indice léger (−15 secondes)')
  await expect(page.getByTestId('puzzle-hint2')).toContainText('Indice fort (−30 secondes)')
  await page.evaluate(() => window.__game.set({ difficulty: 'astronaut' }))
  await page.waitForFunction(() => window.__game.state().loading === 1)
  await expect(page.getByTestId('puzzle-hint')).toContainText('Indice léger (−30 secondes)')
  await expect(page.getByTestId('puzzle-hint2')).toContainText('Indice fort (−60 secondes)')

  await page.getByTestId('puzzle-hint').click()
  await expect(page.getByTestId('puzzle-hint')).toHaveClass(/used/)
  await expect(page.getByTestId('puzzle-hint')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('puzzle-hint-text')).toContainText('casier')
  expect(await page.evaluate(() => window.__game.state().penalty)).toBe(30)
  const again = await page.evaluate(async () => {
    const { requestHint } = await import('/src/game/logic.ts' as string)
    requestHint(1, { zone: 1, step: 'locker' })
    return window.__game.state().penalty
  })
  expect(again).toBe(30)

  await page.evaluate(() => window.__game.set({ tabletOpen: true, tabletReady: true, tab: 2 }))
  const tabletLight = page.getByTestId('hint')
  await expect(tabletLight).toHaveClass(/used/)
  await expect(tabletLight).toContainText('Consulté')
  await page.getByTestId('hint2').click()
  await expect(page.getByTestId('puzzle-hint2')).toHaveClass(/used/)
  expect(await page.evaluate(() => window.__game.state().penalty)).toBe(90)

  await page.evaluate(async () => {
    const { saveGame, loadSave, useGame } = await import('/src/game/state.ts' as string)
    saveGame(false)
    useGame.setState({ hintsShown: [], hintsUsed: 0, penalty: 0, puzzle: null, tabletOpen: false })
    const save = loadSave()
    if (!save?.hintsShown.includes('1:locker:1') || !save.hintsShown.includes('1:locker:2')) throw new Error('historique absent de la sauvegarde')
    useGame.setState({ ...save, screen: 'playing', loading: 1, puzzle: 'keypad', tabletOpen: false })
  })
  await expect(page.getByTestId('puzzle-hint')).toHaveClass(/used/)
  await expect(page.getByTestId('puzzle-hint2')).toHaveClass(/used/)
  expect(await page.evaluate(() => window.__game.state().penalty)).toBe(90)
})

test('la qualité par défaut est Moyen en 1080p', async ({ page }) => {
  await page.addInitScript(() => localStorage.removeItem('cosmotrap.settings.v1'))
  await page.goto('/?test')
  await page.waitForFunction(() => window.__game)
  const settings = await page.evaluate(async () => {
    const { useGame } = await import('/src/game/state.ts' as string)
    const s = useGame.getState().settings
    return { quality: s.quality, resolution: s.resolution }
  })
  expect(settings).toEqual({ quality: 'medium', resolution: 1080 })
})

test('une erreur au planning pré-vol efface la sélection et retire 20 secondes', async ({ page }) => {
  await start(page)
  await page.evaluate(() => window.__game.set({ puzzle: 'plan', plan: [], planDone: false }))
  await expect(page.getByTestId('plan')).toContainText('retire 20 secondes')
  await page.getByTestId('plan-hatch').click()
  await expect(page.getByTestId('plan-hatch')).toHaveClass(/done/)
  const before = await page.evaluate(() => window.__game.state().penalty)
  await page.getByTestId('plan-ignite').click()
  await expect(page.getByTestId('plan-hatch')).not.toHaveClass(/done/)
  expect(await page.evaluate(() => window.__game.state().plan)).toEqual([])
  expect(await page.evaluate(() => window.__game.state().penalty)).toBe(before + 20)
})

test('les boutons d’indice restent accessibles sur un écran étroit', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 })
  await start(page)
  await page.setViewportSize({ width: 844, height: 390 })
  await openLocker(page)
  const light = page.getByTestId('puzzle-hint')
  const strong = page.getByTestId('puzzle-hint2')
  await expect(light).toBeInViewport()
  await expect(strong).toBeInViewport()
})
