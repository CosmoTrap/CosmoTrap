import { expect, test, type Page } from '@playwright/test'

test.setTimeout(120000)

async function pressPad(page: Page, button: number) {
  await page.evaluate((i) => { (window as any).__pad.buttons[i] = { pressed: true, touched: true, value: 1 } }, button)
  await page.waitForTimeout(120)
  await page.evaluate((i) => { (window as any).__pad.buttons[i] = { pressed: false, touched: false, value: 0 } }, button)
  await page.waitForTimeout(120)
}

test('nouveaux skins et touches configurables avec les mains détaillées et le vrai inventaire', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/api/auth.php?action=me', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  await page.addInitScript(() => {
    localStorage.setItem('cosmotrap.settings.v1', JSON.stringify({ quality: 'low', music: 0, voice: 0, sfx: 0, map: 'station' }))
    const pad = { id: 'Xbox test', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) }
    ;(window as any).__pad = pad
    navigator.getGamepads = () => [pad as any]
  })
  await page.goto('/?quality=low')
  await expect(page.getByTestId('launch')).toBeVisible()
  await page.keyboard.press('Space')
  await page.getByTestId('guest').click()
  await page.getByTestId('open-settings').click()
  for (const id of ['ines', 'kenji', 'leo', 'maya', 'nova', 'sam']) {
    await page.getByTestId(`char-${id}`).click()
    await expect.poll(() => page.getByTestId('char-preview').locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    await expect.poll(() => page.evaluate(() => window.__game.state().settings.character)).toBe(id)
  }
  await page.getByTestId('char-leo').click()
  await page.screenshot({ path: 'test-results/merged-skins.png' })
  await page.getByTestId('stab-2').click()
  await expect(page.getByTestId('bind-inventory-0')).toHaveText('I')
  await expect(page.getByTestId('bind-tablet-0')).toHaveText('Tab')
  await page.getByTestId('bind-useSelected-0').click()
  await page.keyboard.press('KeyC')
  await expect(page.getByTestId('bind-useSelected-0')).toHaveText('C')
  await page.getByRole('button', { name: 'Manette', exact: true }).click()
  await page.getByTestId('pad-inventory').click()
  await pressPad(page, 12) // Swap inventory with use-selected: no accidental consumption.
  await page.getByTestId('page-back').click()
  await page.getByTestId('launch-mission').click()
  await page.getByTestId('skip-prologue').click()
  await page.waitForFunction(() => window.__game.state().loading === 1)
  expect(await page.evaluate(() => window.__game.state().character)).toBe('leo')
  await page.evaluate(() => {
    window.__game.give('wrench')
    window.__game.useItem('wrench')
    window.__game.give('water', 3)
    window.__game.setRes({ water: 20 })
  })
  await expect.poll(() => page.evaluate(async () => {
    const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js' as string)
    const { armOf, stripMaterial } = await import('/src/player/avatarArms.ts' as string)
    const { skinOf } = await import('/src/world/skins.ts' as string)
    const scene = _roots.get(document.querySelector('canvas')).store.getState().scene
    const held = scene.getObjectByName('held-item')
    if (!held?.visible) return false
    const spec = armOf('leo'), expected = stripMaterial('leo', spec.forearm.strip, skinOf('leo').suit, spec)
    let detailedSkin = false
    held.traverse((obj: any) => {
      const m = obj.material
      // The new arms use the avatar picture and a bump map, rather than the
      // former fabric normal map. Verify Leo's actual arm and loaded details.
      if (m !== expected || m.bumpMap !== m.map || !m.map?.image?.getContext || obj.geometry.attributes.position.count < 100) return
      const pixels = m.map.image.getContext('2d').getImageData(64, 128, 128, 256).data
      const colors = new Set()
      for (let i = 0; i < pixels.length; i += 64) colors.add(`${pixels[i]},${pixels[i + 1]},${pixels[i + 2]}`)
      if (colors.size > 16) detailedSkin = true
    })
    return detailedSkin
  })).toBe(true)
  await pressPad(page, 12)
  await expect(page.getByTestId('inventory')).toBeVisible()
  await page.getByTestId('inventory-water').click()
  await pressPad(page, 12)
  await expect(page.getByTestId('inventory')).toBeHidden()
  expect(await page.evaluate(() => window.__game.state().inv.water)).toBe(3)
  await expect(page.getByTestId('open-inventory')).toContainText('↑')
  await pressPad(page, 3)
  expect(await page.evaluate(() => window.__game.state().inv.water)).toBe(2)
  await page.keyboard.press('KeyC')
  expect(await page.evaluate(() => window.__game.state().inv.water)).toBe(1)
  await page.keyboard.press('KeyI')
  await expect(page.getByTestId('inventory')).toBeVisible()
  await page.keyboard.press('KeyI')
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('tablet')).toBeVisible()
  expect(errors).toEqual([])
})
