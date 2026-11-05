import { expect, test } from '@playwright/test'

const rooms = [
  { zone: 2, name: 'serre', x: 43, z: 13 },
  { zone: 2, name: 'laboratoire', x: 27, z: 13 },
  { zone: 2, name: 'nœud 2', x: 43, z: 37 },
  { zone: 2, name: 'amarrage', x: 17, z: 37 },
  { zone: 1, name: 'dortoir', x: 15, z: 41 },
  { zone: 1, name: 'réfectoire', x: 41, z: 19 },
  { zone: 1, name: 'infirmerie', x: 41, z: 63 },
  { zone: 1, name: 'sas', x: 65, z: 41 },
  { zone: 1, name: 'nœud 1', x: 41, z: 41 },
  { zone: 3, name: 'cockpit', x: 9, z: 5 },
  { zone: 3, name: 'pont', x: 9, z: 15 },
]

for (const quality of ['low', 'high'] as const) test(`pas de flash noir selon l'angle de vue — ${quality}`, async ({ page }) => {
  test.setTimeout(240000)
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  await page.route('**/api/auth.php?action=me', r => r.fulfill({ status: 503, body: '{}' }))
  await page.addInitScript(quality => localStorage.setItem('cosmotrap.settings.v1', JSON.stringify({ quality, resolution: 480, music: 0, voice: 0, sfx: 0 })), quality)
  await page.goto('/')
  await expect(page.getByTestId('launch')).toBeVisible()
  await page.keyboard.press('Space')
  await page.getByTestId('guest').click()
  // Lights on: this looks for black frames, whereas level 1's alarm is meant to be very dark.
  await page.evaluate(() => { window.__game.start(); window.__game.set({ toured: [1, 2, 3, 4], flags: { ...window.__game.state().flags, pressurized: true } }) })
  await page.waitForFunction(() => window.__game.state().loading === 1)

  // Read the actual final framebuffer after the composer. A NaN in a single
  // sunlight fragment used to spread through bloom and black out the frame.
  await page.evaluate(async () => {
    const { _roots } = await import('/node_modules/.vite/deps/@react-three_fiber.js' as string)
    const store = _roots.get(document.querySelector('canvas')).store
    const w = window as any
    w.frameProbe = { samples: [], remaining: 0, skip: 0 }
    let pixels = new Uint8Array(0)
    store.getState().internal.subscribers.push({ priority: 2, store, ref: { current: ({ gl }: any) => {
      const probe = w.frameProbe
      if (!probe.remaining || probe.skip-- > 0) return
      const ctx = gl.getContext(), width = ctx.drawingBufferWidth, height = ctx.drawingBufferHeight
      if (pixels.length !== width * height * 4) pixels = new Uint8Array(width * height * 4)
      ctx.readPixels(0, 0, width, height, ctx.RGBA, ctx.UNSIGNED_BYTE, pixels)
      let sum = 0
      for (let i = 0; i < pixels.length; i += 16) sum += (pixels[i] + pixels[i + 1] + pixels[i + 2]) / 3
      probe.samples.push(sum / (pixels.length / 16))
      probe.remaining--
      probe.skip = 1
    } } })
    window.__game.set({ paused: true, playTime: 0, event: null })
  })

  for (const room of quality === 'low' ? rooms : rooms.slice(0, 2)) {
    if (await page.evaluate(() => window.__game.state().zone) !== room.zone) {
      await page.evaluate(z => { window.__game.goto(z); window.__game.set({ cine: null, paused: true, playTime: 0, event: null }) }, room.zone)
      await page.waitForFunction(z => window.__game.state().playerZone === z && window.__game.state().loading === 1, room.zone)
    }
    await page.evaluate(({ x, z }) => window.__game.teleportXZ(x, z, 0), room)
    // Include the narrow range that reliably reproduced the greenhouse flash.
    for (const yaw of [0, Math.PI / 2, Math.PI, 4.7, 4.8, 4.9, 5, 5.1, 5.3]) {
      await page.evaluate(yaw => {
        window.__game.live.yaw = yaw
        window.__game.live.pitch = 0
        ;(window as any).frameProbe = { samples: [], remaining: 12, skip: 8 }
      }, yaw)
      await page.waitForFunction(() => (window as any).frameProbe.remaining === 0)
      const samples: number[] = await page.evaluate(() => (window as any).frameProbe.samples)
      const sorted = [...samples].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)]
      expect(median, `${room.name}: image visible`).toBeGreaterThan(5)
      expect(Math.min(...samples) / median, `${room.name}: flash noir à ${yaw}`).toBeGreaterThan(0.75)
    }
  }
  expect(errors).toEqual([])
})
