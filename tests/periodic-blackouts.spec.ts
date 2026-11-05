import { expect, test } from '@playwright/test'

test('les coupures reviennent sans consulter le briefing et alternent avec les fuites', async ({ page }) => {
  test.setTimeout(90000)
  await page.route('**/api/**', r => r.fulfill({ status: 503, body: '{}' }))
  await page.addInitScript(() => localStorage.setItem('cosmotrap.settings.v1', JSON.stringify({ quality: 'low', resolution: 480, music: 0, voice: 0, sfx: 0 })))
  await page.goto('/')
  await expect(page.getByTestId('launch')).toBeVisible()
  await page.keyboard.press('Space')
  await page.getByTestId('guest').click()
  await page.evaluate(() => { window.__game.start('nova', false, 'astronaut', true); window.__game.set({ toured: [1, 2, 3, 4] }) })
  await page.waitForFunction(() => window.__game.state().loading === 1 && window.__game.state().playerZone === 1)
  const events = await page.evaluate(async () => {
    const { G } = await import('/src/game/state.ts' as string)
    const result: string[] = []
    for (let i = 0; i < 3; i++) {
      const state = G()
      window.__game.setRes({ o2: 100, water: 100 })
      window.__game.drain(Math.max(0, state.nextEventAt - state.playTime) + 0.2)
      const event = window.__game.state().event
      result.push(event?.kind ?? 'none')
      if (event) window.__game.drain(event.until - window.__game.state().playTime + 0.2)
      if (window.__game.state().event) throw new Error('Incident sans fin')
    }
    return { events: result, briefed: G().briefed }
  })
  expect(events.briefed).toBe(false)
  expect(events.events).toEqual(['blackout', 'leak', 'blackout'])
})
