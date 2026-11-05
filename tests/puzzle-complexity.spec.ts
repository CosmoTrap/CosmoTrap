import { expect, test } from '@playwright/test'
import { initialValves, pressValveGrid, solveValves } from '../src/game/valves'

test('les grilles de vannes sont solubles en 4 à 7 appuis, y compris le repli', () => {
  const verify = () => {
    const grid = initialValves(), solution = solveValves(grid), result = [...grid]
    expect(solution.length).toBeGreaterThanOrEqual(4)
    expect(solution.length).toBeLessThanOrEqual(7)
    for (const i of solution) pressValveGrid(result, Math.floor(i / 3), i % 3)
    expect(result).toEqual(Array(9).fill(true))
    return grid.join(',')
  }
  expect(new Set(Array.from({ length: 80 }, verify)).size).toBeGreaterThan(1)
  const random = Math.random
  try {
    Math.random = () => 1 // Force the generator's bounded fallback.
    verify()
  } finally { Math.random = random }
})

test('les sauvegardes préservent la grille de départ et les messages de la tablette', async ({ page }) => {
  await page.route('**/api/**', r => r.fulfill({ status: 503, body: '{}' }))
  await page.goto('/')
  await expect(page.getByTestId('launch')).toBeVisible()
  const result = await page.evaluate(async () => {
    const { newGameData, normalizeSave, saveData, useGame } = await import('/src/game/state.ts' as string)
    const { pressValveGrid } = await import('/src/game/valves.ts' as string)
    const { resetValves } = await import('/src/game/logic.ts' as string)
    const fresh = newGameData(), initial = [...fresh.valveStart]
    pressValveGrid(fresh.valves, 0, 0)
    const messages = [{ id: 'kept-message', kind: 'radio', text: 'Transmission conservée', zone: 1, at: 12 }]
    useGame.setState({ ...fresh, messages, screen: 'playing' })
    const saved = saveData(), restored = normalizeSave(JSON.parse(JSON.stringify(saved)))
    useGame.setState(restored)
    resetValves()
    const reset = [...useGame.getState().valves]
    const legacy = { ...saved } as any
    delete legacy.valveStart; delete legacy.messages
    const migrated = normalizeSave(legacy)
    useGame.setState({ screen: 'title' })
    return { initial, current: saved.valves, restored: restored.valves, start: restored.valveStart,
      reset, messages: restored.messages, legacyStart: migrated.valveStart, legacyMessages: migrated.messages }
  })
  expect(result.current).not.toEqual(result.initial)
  expect(result.restored).toEqual(result.current)
  expect(result.start).toEqual(result.initial)
  expect(result.reset).toEqual(result.initial)
  expect(result.messages[0].text).toBe('Transmission conservée')
  expect(result.legacyStart).toEqual(result.current)
  expect(result.legacyMessages).toEqual([])
})
