import { expect, test, type Page } from '@playwright/test'

test.setTimeout(90000)

async function openGuest(page: Page) {
  await page.route('**/api/**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  await page.addInitScript(() => localStorage.setItem('cosmotrap.settings.v1', JSON.stringify({
    quality: 'low', resolution: 480, music: 0, voice: 0, sfx: 0, map: 'station',
  })))
  await page.goto('/')
  await expect(page.getByTestId('launch')).toBeVisible()
  await page.keyboard.press('Space')
  await page.getByTestId('guest').click()
}

test('le lancement affiche les quatre jauges et leurs mises à jour sans erreur', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await openGuest(page)
  await page.getByTestId('launch-mission').click()
  await page.getByTestId('confirm-character').click()
  await page.getByTestId('skip-prologue').click()
  const gauges = page.locator('.hud-top .gauge')
  await expect(gauges).toHaveCount(4)
  await page.waitForFunction(() => window.__game.state().loading === 1)
  await page.evaluate(() => {
    window.__game.set({ paused: true })
    window.__game.setRes({ hp: 42, o2: 37, lamp: 61, water: 53 })
  })
  await expect(gauges.locator('span')).toHaveText(['42%', '37%', '61%', '53%'])
  expect(errors).toEqual([])
})

test('une sauvegarde antérieure à la survie reprend avec une vie pleine et les réserves conservées', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await openGuest(page)
  await page.evaluate(async () => {
    const { newGameData } = await import('/src/game/state.ts' as string)
    const key = 'cosmotrap.save.v2.guest'
    const save = { ...newGameData('nova', 'astronaut', 'station'), briefed: true, toured: [1], savedAt: Date.now() }
    save.res = { o2: 37, lamp: 61, water: 53 }
    delete save.o2Critical
    delete save.failCause
    localStorage.setItem(key, JSON.stringify(save))
  })
  await page.reload()
  await page.getByTestId('continue').click()
  await page.waitForFunction(() => window.__game.state().loading === 1)
  await page.evaluate(() => window.__game.set({ paused: true }))
  await expect(page.locator('.hud-top .gauge span')).toHaveText(['100%', '37%', '61%', '53%'])
  expect(errors).toEqual([])
})
