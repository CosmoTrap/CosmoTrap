import { expect, test, type Page } from '@playwright/test'

test.setTimeout(120000)

const SAVE_KEY = 'cosmotrap.save.v2.guest'

async function openWithSave(page: Page) {
  await page.route('**/api/auth.php?action=me', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  await page.addInitScript((key) => {
    localStorage.setItem('cosmotrap.settings.v1', JSON.stringify({ quality: 'low', music: 0, voice: 0, sfx: 0 }))
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1')
      localStorage.setItem(key, JSON.stringify({ zone: 1, layoutVersion: 3, map: 'base', playTime: 120, penalty: 0, savedAt: Date.now(), inv: {}, flags: { lockerOpen: true }, taken: [], notes: [], explored: [], track: [], propPositions: {} }))
    }
  }, SAVE_KEY)
  await page.goto('/?quality=low')
  await expect(page.getByTestId('launch')).toBeVisible()
}

const hasSave = (page: Page) => page.evaluate((key) => !!localStorage.getItem(key), SAVE_KEY)

test('la corbeille demande confirmation avant de supprimer la partie en cours', async ({ page }) => {
  await openWithSave(page)
  await expect(page.getByTestId('continue')).toBeEnabled()
  await page.getByTestId('delete-save').click()
  await expect(page.getByTestId('confirm-delete')).toBeVisible()
  await page.screenshot({ path: 'test-results/launch-delete-confirm.png' })

  // Cancelling keeps the game.
  await page.getByTestId('confirm-delete').getByRole('button').first().click()
  await expect(page.getByTestId('confirm-delete')).toBeHidden()
  expect(await hasSave(page)).toBe(true)
  await page.screenshot({ path: 'test-results/launch-with-save.png' })

  await page.getByTestId('delete-save').click()
  await page.getByTestId('confirm-delete-yes').click()
  await expect(page.getByTestId('confirm-delete')).toBeHidden()
  expect(await hasSave(page)).toBe(false)
  await expect(page.getByTestId('continue')).toBeDisabled()
  await expect(page.getByTestId('delete-save')).toBeHidden()

  await page.reload()
  await expect(page.getByTestId('launch')).toBeVisible()
  await expect(page.getByTestId('continue')).toBeDisabled()
})

test('sans partie en cours, pas de corbeille', async ({ page }) => {
  await page.addInitScript(() => sessionStorage.setItem('seeded', '1'))
  await openWithSave(page)
  await expect(page.getByTestId('delete-save')).toBeHidden()
})

test('lancer une nouvelle partie ne demande plus de confirmation', async ({ page }) => {
  await openWithSave(page)
  await page.keyboard.press('Space')
  await page.getByTestId('guest').click()
  await page.evaluate(() => window.__game.set({ screen: 'launch' }))
  await expect(page.getByTestId('launch')).toBeVisible()
  await page.getByTestId('start').click()
  await expect(page.getByTestId('confirm-delete')).toBeHidden()
  await expect.poll(() => page.evaluate(() => window.__game.state().screen)).toBe('prologue')
  expect(await hasSave(page)).toBe(false)
})

test('cliquer sur le fond de l’écran d’accueil ne quitte pas la page', async ({ page }) => {
  await openWithSave(page)
  for (const [x, y] of [[100, 300], [640, 80], [1200, 500], [640, 700]]) {
    await page.mouse.click(x, y)
    await page.waitForTimeout(150)
    await expect(page.getByTestId('launch')).toBeVisible()
  }
  await expect(page.getByTestId('leaderboard')).toHaveCount(0)
  // The explicit button still leaves the page: without a session, through the login screen.
  await page.getByTestId('open-board').click()
  await expect(page.getByTestId('guest')).toBeVisible()
})

