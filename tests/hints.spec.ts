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
  await page.waitForFunction(() => window.__game.state().loading === 1 && window.__game.state().puzzle === 'lunar', null, { timeout: 90000 })
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

test('les boutons d’indice restent accessibles sur un écran étroit', async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 })
  await start(page)
  await openLocker(page)
  const light = page.getByTestId('puzzle-hint')
  const strong = page.getByTestId('puzzle-hint2')
  await expect(light).toBeInViewport()
  await expect(strong).toBeInViewport()
})
