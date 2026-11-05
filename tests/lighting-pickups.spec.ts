import { expect, test, type Page } from '@playwright/test'
import * as THREE from 'three'
import { highlightPickups } from '../src/world/props/PickupHighlight'

async function start(page: Page) {
  await page.route('**/api/**', r => r.fulfill({ status: 503, body: '{}' }))
  await page.addInitScript(() => localStorage.setItem('cosmotrap.settings.v1', JSON.stringify({ quality: 'high', resolution: 720, music: 0, sfx: 0, voice: 0 })))
  await page.goto('/')
  await expect(page.getByTestId('launch')).toBeVisible()
  await page.keyboard.press('Space')
  await page.getByTestId('guest').click()
  await page.evaluate(() => { window.__game.start(); window.__game.set({ toured: [1, 2, 3, 4] }) })
  await page.waitForFunction(() => window.__game.state().playerZone === 1 && window.__game.state().loading === 1)
  await page.evaluate(async () => {
    const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js' as string)
    ;(window as any).lightingScene = _roots.get(document.querySelector('canvas')).store.getState().scene
  })
}

test('la surbrillance garde les textures et épargne les matériaux partagés, même après un chargement tardif', () => {
  const root = new THREE.Group(), texture = new THREE.Texture()
  const source = new THREE.MeshStandardMaterial({ map: texture, color: '#996633', emissive: '#223344', emissiveIntensity: 0.3 })
  const originalEmission = source.emissive.clone()
  const geometry = new THREE.BoxGeometry()
  const a = new THREE.Mesh(geometry, source), b = a.clone()
  root.add(a)
  const effect = highlightPickups(root)
  effect.refresh()
  expect(a.material).not.toBe(source)
  expect(a.material.map).toBe(texture)
  expect(a.material.color.equals(source.color)).toBe(true)
  expect(source.emissive.equals(originalEmission)).toBe(true)
  expect(source.emissiveIntensity).toBe(0.3)
  expect(a.material.emissive.r).toBeGreaterThan(source.emissive.r * 0.3)
  root.add(b) // An asynchronously loaded model joins the same pickup later.
  effect.refresh()
  expect(b.material).toBe(a.material)
  let disposed = false, textureDisposed = false
  a.material.addEventListener('dispose', () => { disposed = true })
  texture.addEventListener('dispose', () => { textureDisposed = true })
  effect.dispose()
  expect(a.material).toBe(source)
  expect(b.material).toBe(source)
  expect(disposed).toBe(true)
  expect(textureDisposed).toBe(false)
  geometry.dispose(); source.dispose(); texture.dispose()
})

test('les trois zones retrouvent la lumière après une coupure de 20 à 30 secondes', async ({ page }) => {
  test.setTimeout(180000)
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await start(page)
  for (const zone of [1, 2, 3]) {
    if (zone !== 1) {
      await page.evaluate(z => { window.__game.goto(z); window.__game.set({ cine: null }) }, zone)
      await page.waitForFunction(z => window.__game.state().playerZone === z && window.__game.state().loading === 1, zone)
    }
    const room = zone === 3 ? 'pont' : 'couloir'
    // Floor 2 has no normal circuit until the player repairs its breaker.
    if (zone === 2) await page.evaluate(() => window.__game.set({ flags: { ...window.__game.state().flags, power: true } }))
    await page.evaluate(z => { window.__game.teleportXZ(z === 1 ? 44 : z === 2 ? 46 : 9, z === 1 ? 41 : z === 2 ? 37 : 15, 0) }, zone)
    await page.waitForFunction(room => (window as any).lightingScene.getObjectByName(`room-light:${room}`)?.intensity > 10, room)
    expect(await page.evaluate(() => window.__game.state().flags.pressurized)).toBe(false)
    await page.waitForFunction(() => (window as any).lightingScene.getObjectByName('alert-beam:0').intensity === 0)
    const duration = await page.evaluate(() => {
      const t = window.__game.state().playTime
      window.__game.startEvent('blackout')
      return window.__game.state().event.until - t
    })
    expect(duration).toBeGreaterThanOrEqual(20)
    expect(duration).toBeLessThanOrEqual(30)
    await page.waitForFunction(room => (window as any).lightingScene.getObjectByName(`room-light:${room}`).intensity === 0, room)
    await page.waitForFunction(() => (window as any).lightingScene.getObjectByName('alert-beam:0').intensity > 10)
    expect(await page.evaluate(room => (window as any).lightingScene.getObjectByName(`ceiling-light:${room}`).material.emissiveIntensity, room)).toBe(0)
    await page.screenshot({ path: `test-results/blackout-red-${zone}.png` })
    await page.evaluate(() => window.__game.drain(33))
    expect(await page.evaluate(() => window.__game.state().event)).toBeNull()
    await page.waitForFunction(room => (window as any).lightingScene.getObjectByName(`room-light:${room}`).intensity > 10, room)
    await page.waitForFunction(() => (window as any).lightingScene.getObjectByName('alert-beam:0').intensity === 0)
    expect(await page.evaluate(room => (window as any).lightingScene.getObjectByName(`ceiling-light:${room}`).material.emissiveIntensity, room)).toBeGreaterThan(3)
    await page.screenshot({ path: `test-results/power-restored-${zone}.png` })
  }
  expect(errors).toEqual([])
})

test('la plaque ne révèle 2041 qu’avec la torche et les objets brillent jusqu’au ramassage', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await start(page)
  await page.waitForFunction(() => {
    const scene = (window as any).lightingScene
    return scene.getObjectByName('ent:lamp')?.getObjectByName('pickup-highlight') && scene.getObjectByName('ent:ration')?.getObjectByName('pickup-highlight')?.children.length
  })
  await page.waitForFunction(() => {
    let count = 0
    ;(window as any).lightingScene.getObjectByName('ent:ration').traverse((o: any) => { if (o.material?.userData.pickupHighlight) count++ })
    return count > 0
  })
  await page.evaluate(() => window.__game.teleport('lamp', 0.9))
  await page.waitForTimeout(600)
  await page.screenshot({ path: 'test-results/pickup-subtle-glow.png' })
  await page.evaluate(() => window.__game.interact('lamp'))
  await page.waitForFunction(() => !(window as any).lightingScene.getObjectByName('ent:lamp'))
  await page.evaluate(() => window.__game.teleport('plate', 0.65))
  await page.waitForTimeout(700)
  const textureName = () => page.evaluate(() => (window as any).lightingScene.getObjectByName('station-date-plate').material.map.name)
  expect(await textureName()).toBe('plate-date-unreadable')
  expect(await page.evaluate(() => (window as any).lightingScene.getObjectByName('station-date-plate').material.userData.plateLight.value)).toBe(0)
  expect(await page.evaluate(() => window.__game.interact('plate'))).toBe(false)
  expect(await page.evaluate(() => window.__game.state().notes)).not.toContain('plate')
  await page.evaluate(() => window.__game.set({ toasts: [] }))
  await page.waitForTimeout(250)
  await page.screenshot({ path: 'test-results/date-without-torch.png' })
  await page.keyboard.press('KeyF')
  await expect.poll(textureName).toBe('plate-date-readable')
  expect(await page.evaluate(() => (window as any).lightingScene.getObjectByName('station-date-plate').material.userData.plateLight.value)).toBe(1)
  await page.evaluate(() => window.__game.set({ toasts: [] }))
  await page.waitForTimeout(800)
  await page.screenshot({ path: 'test-results/date-with-torch.png' })
  expect(await page.evaluate(() => window.__game.interact('plate'))).toBe(true)
  await expect(page.getByTestId('note')).toContainText('2041')
  await page.keyboard.press('Escape')
  await page.evaluate(() => window.__game.setRes({ lamp: 0 }))
  await expect.poll(textureName).toBe('plate-date-unreadable')
  // Once deciphered, the transcription in the journal remains available.
  expect(await page.evaluate(() => window.__game.state().notes)).toContain('plate')
  expect(errors).toEqual([])
})
