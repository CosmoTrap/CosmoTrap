import { expect, test, type Page } from '@playwright/test'
import { zone1 } from '../src/game/maps/zone1'
import { zone2 } from '../src/game/maps/zone2'
import { migrateStationSave, LAYOUT_VERSION } from '../src/game/maps/layoutMigration'
import type { GridMap } from '../src/game/types'
import type { SaveFile } from '../src/game/state'

function reachable(map: GridMap, blocked: string[] = []) {
  const key = (x: number, z: number) => `${x},${z}`
  const queue = [map.spawn.tile], seen = new Set<string>()
  for (let i = 0; i < queue.length; i++) {
    const [x, z] = queue[i], k = key(x, z)
    if (seen.has(k) || blocked.includes(k) || !['.', 'D'].includes(map.grid[z]?.[x])) continue
    seen.add(k)
    queue.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1])
  }
  return seen
}

for (const map of [zone1, zone2]) test(`niveau ${map.zone} : quatre branches connectées, objets accessibles et sortie verrouillée`, () => {
  const all = reachable(map)
  expect(all.size).toBe(map.grid.join('').split('').filter((c) => c === '.' || c === 'D').length)
  expect(map.rooms.filter((r) => r.id.startsWith('liaison_'))).toHaveLength(4)
  for (const e of [...map.ents, ...map.props]) if (e.tile) expect(all.has(e.tile.join(',')), e.model).toBe(true)
  for (const door of map.doors) {
    const [x, z] = door.tile
    const floor = (dx: number, dz: number) => ['.', 'D'].includes(map.grid[z + dz]?.[x + dx])
    expect([floor(1, 0), floor(-1, 0), floor(0, 1), floor(0, -1)]).toEqual(
      floor(1, 0) ? [true, true, false, false] : [false, false, true, true])
  }
  const gate = map.doors.find((d) => d.id === (map.zone === 1 ? 'door_d1' : 'door_dock'))!
  const exit = map.ents.find((e) => e.id === (map.zone === 1 ? 'valves' : 'dockExit'))!
  expect(reachable(map, [gate.tile.join(',')]).has(exit.tile!.join(','))).toBe(false)
  if (map.zone === 2) {
    const beforeSteam = reachable(map, [map.ents.find((e) => e.id === 'steam')!.tile!.join(',')])
    for (const id of ['wrench', 'fuse', 'steamValve']) expect(beforeSteam.has(map.ents.find((e) => e.id === id)!.tile!.join(','))).toBe(true)
    expect(beforeSteam.has(map.ents.find((e) => e.id === 'breaker')!.tile!.join(','))).toBe(false)
  }
})

test('anciennes sauvegardes : déplacer les positions sans perdre la progression, une seule fois', () => {
  const old = {
    zone: 2, pos: [5, 0, 5], yaw: 0.3, inv: { wrench: 1, badge: 1 }, flags: { lockerOpen: true },
    taken: ['1:lamp', '2:wrench'], notes: ['board'], playTime: 430,
    propPositions: { 'serre-cart': [25, 0, 4.8] }, explored: ['1:3,2', '2:2,2', '3:2,2', '4:8,9'],
    track: [100, 1, 50, 50, 200, 2, 50, 50, 300, 3, 50, 50],
  } as unknown as SaveFile
  const moved = migrateStationSave(old, 1)
  expect(moved.pos).toEqual([23, 0, 13])
  expect(moved.propPositions['serre-cart']).toEqual([43, 0, 12.8])
  for (const key of ['inv', 'flags', 'taken', 'notes', 'playTime', 'yaw'] as const) expect(moved[key]).toEqual(old[key])
  expect(moved.explored).toEqual(['3:2,2', '4:8,9'])
  expect(moved.track).toEqual([300, 3, 50, 50])
  expect(moved.layoutVersion).toBe(LAYOUT_VERSION)
  expect(migrateStationSave(moved, moved.layoutVersion)).toBe(moved)
  expect(old.pos).toEqual([5, 0, 5])
  expect(migrateStationSave({ ...old, zone: 1, pos: [7, 0, 11] }, 1).pos).toEqual([43.6, 0, 41])
  // Saved where the lift now stands, on the previous layout: moved out, nothing else changes.
  const inCab = migrateStationSave({ ...old, zone: 2, pos: [43, 0, 38], explored: ['2:21,18'] }, 2)
  expect(inCab.pos).toEqual([43, 0, 39.6])
  expect(inCab.explored).toEqual(['2:21,18'])
  expect(migrateStationSave({ ...old, zone: 2, pos: [43, 0, 45] }, 2).pos).toEqual([43, 0, 45])
  for (const zone of [3, 4] as const) expect(migrateStationSave({ ...old, zone }, 1).pos).toEqual(old.pos)
})

async function walk(page: Page, from: [number, number], yaw: number, axis: number, destination: number, direction: number) {
  await page.evaluate(({ from, yaw }) => window.__game.teleportXZ(...from, yaw), { from, yaw })
  await page.waitForFunction(([x, z]) => Math.hypot(window.__game.live.pos[0] - x, window.__game.live.pos[2] - z) < 0.1, from)
  await page.keyboard.down('ArrowUp')
  try {
    await expect.poll(async () => page.evaluate(({ axis, direction }) => window.__game.live.pos[axis] * direction, { axis, direction }), { timeout: 25000 }).toBeGreaterThan(destination * direction)
  } finally { await page.keyboard.up('ArrowUp') }
}

test('circuler physiquement entre le nœud, les salles et les compartiments des deux niveaux', async ({ page }) => {
  test.setTimeout(180000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/api/auth.php?action=me', (r) => r.fulfill({ status: 503, contentType: 'application/json', body: '{}' }))
  await page.addInitScript(() => localStorage.setItem('cosmotrap.settings.v1', JSON.stringify({ quality: 'low', music: 0, voice: 0, sfx: 0 })))
  await page.goto('/?quality=low')
  await expect(page.getByTestId('launch')).toBeVisible()
  await page.keyboard.press('Space')
  await page.getByTestId('guest').click()
  await page.evaluate(() => { window.__game.start(); window.__game.set({ toured: [1, 2, 3, 4] }) })
  await page.waitForFunction(() => window.__game.state().playerZone === 1 && window.__game.state().loading === 1)
  await walk(page, [41, 38], 0, 2, 21.5, -1) // North mess hall, clear of its tables.
  await walk(page, [41, 44], Math.PI, 2, 62, 1) // South infirmary.
  await walk(page, [40, 63], Math.PI / 2, 0, 35.5, -1) // Storage compartment.
  await walk(page, [38, 41], Math.PI / 2, 0, 21.8, -1) // West dormitory.
  await page.evaluate(() => window.__game.set({ flags: { ...window.__game.state().flags, door_d1: true } }))
  await walk(page, [44, 41], -Math.PI / 2, 0, 61.5, 1) // East airlock.

  for (const zone of [1, 2]) {
    if (zone === 2) {
      await page.evaluate(() => { window.__game.goto(2); window.__game.set({ cine: null }) })
      await page.waitForFunction(() => window.__game.state().playerZone === 2 && window.__game.state().loading === 1)
    }
    await page.evaluate((grid) => {
      const g = window.__game
      g.teleportXZ(...(g.state().zone === 1 ? [41, 38] : [43, 34]), 0)
      grid.forEach((row, z) => [...row].forEach((_, x) => g.live.explored.add(`${g.state().zone}:${x},${z}`)))
      g.set({ tabletOpen: true })
    }, zone === 1 ? zone1.grid : zone2.grid)
    await page.getByTestId('tab-0').click()
    await expect(page.getByTestId('minimap')).toBeVisible()
    await page.screenshot({ path: `test-results/station-plan-${zone}.png` })
    await page.evaluate(() => window.__game.set({ tabletOpen: false }))
    await page.screenshot({ path: `test-results/station-hub-${zone}.png` })
  }
  await walk(page, [43, 34], 0, 2, 14.5, -1) // Push cart through greenhouse entrance.
  await walk(page, [37, 13], Math.PI / 2, 0, 32.5, -1) // Lab compartment.
  await walk(page, [43, 40], Math.PI, 2, 58, 1) // Machinery, terminal beside entry.
  await page.evaluate(() => window.__game.set({ flags: { ...window.__game.state().flags, steamFixed: true, power: true, pw_sas: true, readTerminal: true } }))
  await walk(page, [46, 37], -Math.PI / 2, 0, 63.5, 1) // Breaker after repaired steam leak.
  await walk(page, [40, 37], Math.PI / 2, 0, 22, -1) // Docking airlock.
  expect(errors).toEqual([])
})
