import { expect, test, type Page } from '@playwright/test'

test.setTimeout(150000)
async function boot(page: Page) {
  // API injoignable : le bouton « Jouer hors ligne » apparaît
  await page.route('**/api/**', (route) => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  await page.addInitScript(() => localStorage.setItem('cosmotrap.settings.v1', JSON.stringify({ quality: 'high', resolution: 720, music: 0, voice: 0, sfx: 0, ambience: 0, map: 'station' })))
  await page.goto('/')
  await expect(page.getByTestId('launch')).toBeVisible()
  await page.getByTestId('start').click()
  await page.getByTestId('guest').click()
  await page.evaluate(() => { window.__game.start(); window.__game.set({ toured: [1, 2, 3, 4] }) })
  await page.waitForFunction(() => window.__game.state().loading === 1)
}
async function scene(page: Page) {
  await page.evaluate(async path => {
    const { _roots } = await import(path)
    ;(window as any).stationScene = _roots.get(document.querySelector('canvas')).store.getState().scene
  }, '/node_modules/.vite/deps/@react-three_fiber.js')
}
const captured = (page: Page) => page.evaluate(() => !!document.pointerLockElement)

test('souris reprise après tablette, document, digicode validé et pause', async ({ page }) => {
  // Chromium sans interface refuse le verrouillage de la souris (WrongDocumentError) : on l'émule
  // comme le navigateur (pointerLockElement + événements pointerlockchange) pour tester quand le jeu
  // demande ou rend la souris.
  await page.addInitScript(() => {
    let locked: Element | null = null
    Object.defineProperty(Document.prototype, 'pointerLockElement', { configurable: true, get: () => locked })
    Element.prototype.requestPointerLock = function (this: Element) {
      locked = this
      document.dispatchEvent(new Event('pointerlockchange'))
      return Promise.resolve() as any
    }
    Document.prototype.exitPointerLock = function () {
      locked = null
      document.dispatchEvent(new Event('pointerlockchange'))
    }
  })
  await boot(page)
  // One explicit gesture permits capture even on browsers with a stricter policy.
  if (!await captured(page)) await page.locator('canvas').click({ position: { x: 600, y: 300 } })
  await expect.poll(() => captured(page)).toBe(true)
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('tablet')).toBeVisible()
  await expect.poll(() => captured(page)).toBe(false)
  // Follow the three tabs shipped on main; the former Journal assertion was stale.
  await expect(page.getByRole('tab')).toHaveCount(3)
  await page.getByRole('tab', { name: 'Messages', exact: true }).click()
  await expect(page.getByRole('tabpanel', { name: 'Messages' })).toBeVisible()
  await page.keyboard.press('Tab')
  await expect.poll(() => captured(page)).toBe(true)
  await page.evaluate(() => window.__game.interact('board'))
  await expect(page.getByTestId('note')).toBeVisible()
  await expect.poll(() => captured(page)).toBe(false)
  await page.keyboard.press('KeyE')
  await expect.poll(() => captured(page)).toBe(true)
  await page.evaluate(() => window.__game.interact('locker'))
  await expect(page.getByTestId('keypad')).toBeVisible()
  await expect.poll(() => captured(page)).toBe(false)
  await page.keyboard.type('2041'); await page.keyboard.press('Enter')
  await expect(page.getByTestId('puzzle')).toBeHidden()
  await expect.poll(() => captured(page)).toBe(true)
  await page.keyboard.press('KeyP')
  await expect(page.getByTestId('pause')).toBeVisible()
  await expect.poll(() => captured(page)).toBe(false)
  await page.getByTestId('resume').click()
  await expect.poll(() => captured(page)).toBe(true)
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('tablet')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect.poll(() => captured(page)).toBe(true)
  await page.evaluate(() => window.__game.set({ cine: 'briefing', cineT0: performance.now() }))
  await expect.poll(() => captured(page)).toBe(false)
  await page.getByTestId('skip').click()
  await expect.poll(() => captured(page)).toBe(true)
  const yaw = await page.evaluate(() => window.__game.live.yaw)
  await page.mouse.move(900, 320)
  await expect.poll(() => page.evaluate(() => window.__game.live.yaw)).not.toBe(yaw)
})

test('zone 2 sur alarmes seules avant réparation ; retour du réseau et choix machinerie', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await boot(page)
  await page.evaluate(() => { window.__game.goto(2); window.__game.set({ cine: null }) })
  await page.waitForFunction(() => window.__game.state().playerZone === 2 && window.__game.state().loading === 1)
  await scene(page)
  await page.evaluate(() => window.__game.teleportXZ(46, 37, Math.PI / 2))
  await page.waitForFunction(() => Math.abs(window.__game.live.pos[0] - 46) < .1)
  const lighting = () => page.evaluate(() => {
    const s = (window as any).stationScene, lights: {name: string; power: number; red: boolean}[] = [], glows: string[] = []
    s.traverse((o: any) => {
      if (o.isLight && o.intensity > .001) lights.push({ name: o.name, power: o.intensity, red: o.color.r > o.color.g * 3 && o.color.r > o.color.b * 3 })
    })
    s.getObjectByName('station-level').traverse((o: any) => {
      for (const m of o.material ? Array.isArray(o.material) ? o.material : [o.material] : [])
        if (m.emissiveIntensity > 0 && m.emissive?.getHex() && !m.userData.backupCircuit && !m.userData.pickupHighlight) glows.push(o.name)
    })
    return { lights, glows, env: s.environmentIntensity }
  })
  await expect.poll(async () => (await lighting()).env).toBe(0)
  const dark = await lighting()
  expect(dark.lights.length).toBeGreaterThan(0)
  expect(dark.lights.every(l => l.red), JSON.stringify(dark.lights)).toBe(true)
  expect(dark.glows).toEqual([])
  await page.screenshot({ path: 'test-results/station-zone2-emergency.png' })
  await page.evaluate(() => { window.__game.give('lamp'); window.__game.set({ lampOn: true }) })
  await expect.poll(async () => (await lighting()).lights.some(l => !l.red)).toBe(true)
  await page.evaluate(() => { window.__game.give('fuse'); window.__game.set({ lampOn: false, flags: { ...window.__game.state().flags, steamFixed: true } }); window.__game.interact('breaker') })
  await page.waitForFunction(() => (window as any).stationScene.getObjectByName('room-light:labo').intensity > 10)
  await expect.poll(async () => (await lighting()).env).toBeGreaterThan(.9)
  expect(await page.evaluate(() => (window as any).stationScene.getObjectByName('room-light:machinerie').intensity)).toBeLessThan(10)
  await page.evaluate(() => window.__game.set({ puzzle: null, flags: { ...window.__game.state().flags, pw_lights: true } }))
  await page.waitForFunction(() => (window as any).stationScene.getObjectByName('room-light:machinerie').intensity > 10)
  await page.screenshot({ path: 'test-results/station-zone2-restored.png' })
  expect(errors).toEqual([])
})

test('sous-titres du prologue au-dessus des bandes sur plusieurs formats', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('cosmotrap.settings.v1', JSON.stringify({ quality: 'low', music: 0, voice: 0, map: 'station' })))
  await page.goto('/')
  await expect(page.getByTestId('launch')).toBeVisible()
  await page.evaluate(() => window.__game.set({ screen: 'prologue' }))
  for (const size of [{width:1280,height:720},{width:1280,height:1024},{width:1920,height:1080}]) {
    await page.setViewportSize(size)
    await expect(page.getByTestId('prologue-subtitle')).toBeVisible()
    const text = await page.getByTestId('prologue-subtitle').boundingBox()
    const edge = size.height - Math.max(0, (size.height-size.width/2.39)/2)
    expect(text!.y+text!.height).toBeLessThan(edge-10)
    expect(text!.y).toBeGreaterThan(0)
  }
  await page.screenshot({ path: 'test-results/station-prologue-readable.png' })
})

test('les éclairages des sas projettent des ombres mises à jour avec les vantaux', async ({ page }) => {
  await boot(page); await scene(page)
  for (const zone of [1,2]) {
    if (zone === 2) {
      await page.evaluate(() => { window.__game.goto(2); window.__game.set({ cine:null, flags:{...window.__game.state().flags,power:true,pw_sas:true,readTerminal:true} }) })
      await page.waitForFunction(() => window.__game.state().playerZone === 2 && window.__game.state().loading === 1)
    }
    const info = await page.evaluate(zone => {
      const s = (window as any).stationScene, room = zone === 1 ? 'sas' : 'amarrage'
      const light = s.getObjectByName(`room-light:${room}`), door = s.getObjectByName(zone === 1 ? 'bulkhead:door_d1' : 'bulkhead:door_dock')
      const alarm = s.getObjectByName('alert-beam:0')
      return { cast:light.castShadow, cached:!light.shadow.autoUpdate, map:!!light.shadow.map, alarmIdle:!alarm.shadow.autoUpdate && !alarm.shadow.needsUpdate, x:door.position.x,z:door.position.z }
    },zone)
    expect(info.cast).toBe(true); expect(info.cached).toBe(true); expect(info.map).toBe(true)
    expect(info.alarmIdle).toBe(true)
    await page.evaluate(({x,z}) => window.__game.teleportXZ(x-3.5,z,-Math.PI/2),info)
    await page.waitForFunction(({x})=>Math.abs(window.__game.live.pos[0]-(x-3.5))<.1,info)
    await page.screenshot({path:`test-results/station-sas-shadow-${zone}.png`})
    if(zone===1) await page.evaluate(()=>window.__game.set({flags:{...window.__game.state().flags,door_d1:true}}))
    const before = await page.evaluate(async path=>(await import(path)).doorShadows.version,'/src/world/doorShadows.ts')
    await page.evaluate(({x,z})=>window.__game.teleportXZ(x-1,z,-Math.PI/2),info)
    await expect.poll(()=>page.evaluate(async path=>(await import(path)).doorShadows.version,'/src/world/doorShadows.ts')).toBeGreaterThan(before)
  }
})
