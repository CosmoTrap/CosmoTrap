import { expect, test, type Page } from '@playwright/test'

// Joue la partie complète : connexion, 4 zones, toutes les énigmes, verrous, fin + classement.
// S'appuie sur window.__game (mode dev), comme window.__c3 dans le prototype.

declare global {
  interface Window {
    __game: any
  }
}

const g = <T = any>(page: Page, fn: string, ...args: unknown[]) => page.evaluate(({ fn, args }) => (window.__game as any)[fn](...args) as T, { fn, args })
const st = (page: Page) => page.evaluate(() => window.__game.state())

async function waitIdle(page: Page, zone: number) {
  await page.waitForFunction((z) => window.__game.state().zone === z && !window.__game.state().cine && window.__game.state().loading === 1, zone, { timeout: 120000 })
}

async function act(page: Page, id: string) {
  await g(page, 'teleport', id)
  await page.waitForTimeout(250)
  return g<boolean>(page, 'interact', id)
}

async function holdKey(page: Page, key: string, ms: number) {
  await page.keyboard.down(key)
  await page.waitForTimeout(ms)
  await page.keyboard.up(key)
}

async function signedInPage(page: Page, request: any) {
  const email = `pw-${Date.now()}-${Math.floor(Math.random() * 1e6)}@cosmotrap.test`
  const r = await request.post('/api/auth.php?action=register', { data: { email, pseudo: `Robot${Math.floor(Math.random() * 1e6)}`, password: 'playwright-orion' } })
  expect(r.ok()).toBeTruthy()
  const { token } = await r.json()
  await page.addInitScript((t) => localStorage.setItem('cosmotrap.token', t), token)
  let loads = 0
  page.on('load', () => loads++)
  page.on('pageerror', (e) => console.log('Erreur page :', e.message))
  await page.goto('/?quality=low')
  ;(page as any).__loads = () => loads
  // écran de lancement, puis poste de commande (la session est reprise toute seule)
  await expect(page.getByTestId('launch')).toBeVisible({ timeout: 30000 })
  await page.keyboard.press('Space')
  await expect(page.getByTestId('title')).toBeVisible({ timeout: 30000 })
}

async function startGame(page: Page) {
  await g(page, 'start', 'nova', true)
  await g(page, 'set', { toured: [1, 2, 3, 4] })
  await page.waitForFunction(() => window.__game.state().screen === 'playing' && window.__game.state().loading === 1)
}

test('partie complète, de la station à la Terre', async ({ page, request }) => {
  await signedInPage(page, request)
  await startGame(page)

  // ——— Zone 1 ———
  await waitIdle(page, 1)
  expect(await g(page, 'interact', 'lift')).toBe(false) // l'ascenseur reste verrouillé avant la pressurisation
  expect((await st(page)).zone).toBe(1)
  await act(page, 'lamp')
  await page.keyboard.press('f')
  expect((await st(page)).lampOn).toBe(true)
  await act(page, 'board')
  await page.keyboard.press('Escape')
  await act(page, 'plate') // réserve sombre : lisible grâce à la lampe
  await page.keyboard.press('Escape')
  expect((await st(page)).notes).toContain('plate')
  // erreur volontaire : pénalité visible
  await act(page, 'locker')
  for (const k of ['1', '1', '1', '1', 'OK']) await page.getByTestId(`key-${k}`).click()
  await expect.poll(async () => (await st(page)).flags.lockerOpen).toBe(false)
  expect((await st(page)).errors).toBe(1)
  expect((await st(page)).penalty).toBe(30)
  for (const k of ['C', '2', '0', '4', '1', 'OK']) await page.getByTestId(`key-${k}`).click()
  await expect.poll(async () => (await st(page)).flags.lockerOpen).toBe(true)
  expect((await st(page)).inv.badge).toBe(1)
  await page.waitForTimeout(900)
  await act(page, 'door_d1')
  expect((await st(page)).flags.door_d1).toBe(true)
  await act(page, 'valves')
  const grid = await st(page)
  expect(grid.valves).toEqual(grid.valveStart)
  const presses = await g<number[]>(page, 'valveSolution')
  expect(presses.length).toBeGreaterThanOrEqual(4)
  expect(presses.length).toBeLessThanOrEqual(7)
  const hint = await g<string>(page, 'valveHint')
  for (const i of presses) expect(hint).toContain(`ligne ${Math.floor(i / 3) + 1}, colonne ${(i % 3) + 1}`)
  await page.getByTestId(`valve-${presses[0]}`).click()
  expect((await st(page)).valves).not.toEqual(grid.valveStart)
  await page.getByTestId('valve-reset').click()
  expect((await st(page)).valves).toEqual(grid.valveStart)
  for (const i of presses) await page.getByTestId(`valve-${i}`).click()
  await expect.poll(async () => (await st(page)).flags.pressurized).toBe(true)
  await page.waitForTimeout(1500)
  await page.screenshot({ path: 'test-results/zone1.png' })
  await g(page, 'teleportXZ', 41, 41, -Math.PI / 2)
  await page.waitForTimeout(250)
  await g(page, 'interact', 'lift')

  // ——— Zone 2 ———
  await waitIdle(page, 2)
  // le disjoncteur est inaccessible avant la vanne : le gaz bloque le couloir
  await g(page, 'teleportXZ', 51, 37, -Math.PI / 2)
  await page.waitForTimeout(600)
  await holdKey(page, 'w', 2500)
  // Steam starts at x=56; capsule radius 0.30 + controller skin 0.02.
  expect((await st(page)).pos[0]).toBeLessThan(55.75)
  expect((await st(page)).pos[0]).toBeGreaterThan(51.3)
  await act(page, 'fuse')
  await act(page, 'wrench')
  await act(page, 'steamValve')
  expect((await st(page)).flags.steamFixed).toBe(true)
  await act(page, 'breaker')
  await expect(page.getByTestId('power')).toBeVisible()
  await page.getByTestId('power-pw_terminal').click()
  expect((await st(page)).flags.pw_terminal).toBe(false)
  for (const k of ['pw_sas', 'pw_terminal', 'pw_o2']) await page.getByTestId(`power-${k}`).click()
  const f2 = (await st(page)).flags
  expect(f2.power && f2.pw_terminal && f2.pw_sas && f2.pw_o2 && !f2.pw_lights).toBe(true)
  await page.getByTestId('puzzle-close').click()
  // le sas refuse le passage tant que le terminal n'est pas décodé
  expect(await g(page, 'doorOpen', 'door_dock')).toBe(false)
  await act(page, 'terminal')
  for (const c of ['blue', 'yellow', 'red', 'green']) await page.getByTestId(`algo-${c}`).click()
  await page.getByTestId('algo-load').click()
  await expect.poll(async () => (await st(page)).flags.readTerminal).toBe(true)
  expect(await g(page, 'doorOpen', 'door_dock')).toBe(true)
  await page.waitForTimeout(1200)
  await page.screenshot({ path: 'test-results/zone2.png' })
  await act(page, 'dockExit')

  // ——— Zone 3 ———
  await waitIdle(page, 3)
  await act(page, 'cell')
  await act(page, 'engine')
  expect((await st(page)).flags.engine).toBe(true)
  await act(page, 'pilot')
  const planPenalty = (await st(page)).penalty
  await page.getByTestId('plan-ignite').click()
  expect((await st(page)).penalty).toBe(planPenalty + 20)
  await expect(page.getByTestId('dilemma')).toHaveCount(0)
  for (const t of ['hatch', 'traj', 'fuel', 'press', 'nav', 'suits', 'undock', 'ignite']) await page.getByTestId(`plan-${t}`).click()
  await expect(page.getByTestId('dilemma')).toBeVisible()
  await page.getByTestId('choice-drop').click()
  await expect(page.getByTestId('sequence')).toBeVisible()
  await page.screenshot({ path: 'test-results/zone3.png' })
  const seqPenalty = (await st(page)).penalty
  await page.getByTestId('seq-blue').click()
  expect((await st(page)).penalty).toBe(seqPenalty + 30)
  for (const c of ['green', 'red', 'yellow', 'blue']) await page.getByTestId(`seq-${c}`).click()
  await page.waitForFunction(() => window.__game.state().cine === 'launch')
  await page.waitForTimeout(1500)
  await page.keyboard.press('Enter') // passer la cinématique

  // ——— Zone 4 ———
  await waitIdle(page, 4)
  // la rivière est infranchissable avant le pont
  await g(page, 'teleportXZ', 0, -16.4, 0, 1.2)
  await page.waitForTimeout(800)
  await holdKey(page, 'w', 3000)
  expect((await st(page)).pos[2]).toBeGreaterThan(-18.9)
  await act(page, 'capsule')
  expect((await st(page)).notes).toContain('manual')
  await act(page, 'antenna')
  await act(page, 'bridge')
  expect((await st(page)).flags.bridge).toBe(true)
  await act(page, 'beacon')
  const radioPenalty = (await st(page)).penalty
  await page.getByTestId('radio-emit').click()
  expect((await st(page)).flags.beacon).toBe(false)
  expect((await st(page)).penalty).toBe(radioPenalty + 20)
  for (let i = 0; i < 3; i++) await page.getByTestId('radio-p1').click()
  for (let i = 0; i < 5; i++) await page.getByTestId('radio-p01').click()
  await expect(page.getByTestId('radio-freq')).toContainText('121,5')
  await page.getByTestId('radio-emit').click()
  await expect.poll(async () => (await st(page)).flags.beacon).toBe(true)
  await page.waitForTimeout(2800)
  await act(page, 'flareGun')
  await page.screenshot({ path: 'test-results/zone4.png' })
  // l'API refuse les parties de moins de 2 min (anti-triche) : on simule un temps réaliste
  await g(page, 'set', { playTime: 9 * 60 + 12 })
  await act(page, 'helipad')
  await page.waitForFunction(() => window.__game.state().cine === 'heli')
  await page.waitForTimeout(1500)
  await page.keyboard.press('Enter')

  // ——— Fin ———
  await expect(page.getByTestId('end')).toBeVisible({ timeout: 30000 })
  await expect(page.getByTestId('end-time')).toBeVisible()
  const end = await st(page)
  expect(end.ended).toBe(true)
  await page.screenshot({ path: 'test-results/fin.png' })
  // le score est enregistré dans le classement
  const board = await (await request.get('/api/leaderboard.php')).json()
  expect(board.rows.some((r: any) => r.pseudo.startsWith('Robot'))).toBe(true)
})

test('ressources à zéro, pénalités, indices et limite de temps', async ({ page, request }) => {
  await signedInPage(page, request)
  await startGame(page)
  await waitIdle(page, 1)
  let s = await st(page)
  // bouteille refusée tant que ses 55 % ne tiennent pas dans la jauge
  await g(page, 'give', 'o2')
  await g(page, 'setRes', { o2: 45.5 })
  expect(await g(page, 'useItem', 'o2')).toBe(false)
  s = await st(page)
  expect(s.inv.o2).toBe(1)
  await g(page, 'setRes', { o2: 45 })
  expect(await g(page, 'useItem', 'o2')).toBe(true)
  s = await st(page)
  expect(s.inv.o2).toBeUndefined()
  expect(s.res.o2).toBeGreaterThan(99)
  // bouteille branchée automatiquement à 15 %
  await g(page, 'give', 'o2')
  await g(page, 'setRes', { o2: 15.1 })
  await g(page, 'drain', 1)
  s = await st(page)
  expect(s.inv.o2).toBeUndefined()
  expect(s.res.o2).toBeGreaterThan(65)
  // lampe vide → elle s'éteint
  await g(page, 'give', 'lamp')
  await page.keyboard.press('f')
  await g(page, 'setRes', { lamp: 0.2 })
  await g(page, 'drain', 2)
  expect((await st(page)).lampOn).toBe(false)
  // indice léger : compté et pénalisé
  await page.keyboard.press('Tab')
  await expect(page.getByTestId('tablet')).toBeVisible()
  await page.getByTestId('tab-2').click()
  const before = (await st(page)).penalty
  await page.getByTestId('hint').click()
  s = await st(page)
  expect(s.hintsUsed).toBe(1)
  expect(s.penalty).toBe(before + 30)
  await page.getByTestId('hint2').click()
  expect((await st(page)).hintsUsed).toBe(2)
  await page.keyboard.press('Tab')
  // limite de temps → échec
  await g(page, 'set', { playTime: 30 * 60 - 0.5 })
  await g(page, 'drain', 1)
  await page.waitForFunction(() => window.__game.state().cine === 'fail')
  await expect(page.getByTestId('end')).toBeVisible({ timeout: 20000 })
  await expect(page.getByText('Temps écoulé…')).toBeVisible()
})

test('difficulté, imprévus, succès, fantôme et manette', async ({ page, request }) => {
  // manette simulée : on pilote navigator.getGamepads depuis le test
  await page.addInitScript(() => {
    const pad = { id: 'Manette de test', index: 0, connected: true, mapping: 'standard', timestamp: 0, axes: [0, 0, 0, 0], buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })) }
    ;(window as any).__pad = pad
    navigator.getGamepads = () => [pad as any]
  })
  await signedInPage(page, request)
  // difficulté Survie : 22 minutes
  await g(page, 'start', 'maya', true, 'survival')
  await g(page, 'set', { toured: [1, 2, 3, 4] })
  await waitIdle(page, 1)
  expect(await g(page, 'timeLimit')).toBe(22 * 60)
  expect((await st(page)).difficulty).toBe('survival')
  // pénalité ×1,5 en Survie
  await act(page, 'locker')
  for (const k of ['9', '9', '9', '9', 'OK']) await page.getByTestId(`key-${k}`).click()
  await expect.poll(async () => (await st(page)).penalty).toBe(45)
  await page.keyboard.press('Escape')

  // manette : stick gauche → le joueur avance, bouton X → ramasse la lampe
  await g(page, 'teleport', 'lamp', 1.2)
  await page.waitForTimeout(600)
  await page.evaluate(() => ((window as any).__game.live.pitch = -0.35))
  await page.waitForTimeout(500)
  expect((await st(page)).aimed).toBe('lamp')
  await page.evaluate(() => ((window as any).__pad.buttons[2].pressed = true))
  await page.waitForTimeout(400)
  await page.evaluate(() => ((window as any).__pad.buttons[2].pressed = false))
  await expect.poll(async () => (await st(page)).inv.lamp).toBe(1)
  const z0 = (await st(page)).pos[2]
  await page.evaluate(() => ((window as any).__pad.axes[1] = 1))
  await page.waitForTimeout(1500)
  await page.evaluate(() => ((window as any).__pad.axes[1] = 0))
  expect((await st(page)).pos[2]).toBeGreaterThan(z0 + 0.5)
  // bouton LB → lampe
  await page.evaluate(() => ((window as any).__pad.buttons[4].pressed = true))
  await page.waitForTimeout(400)
  await page.evaluate(() => ((window as any).__pad.buttons[4].pressed = false))
  await expect.poll(async () => (await st(page)).lampOn).toBe(true)

  // imprévu : micro-fuite colmatée au ruban adhésif → succès « Bricoleur »
  await g(page, 'startEvent', 'leak')
  expect((await st(page)).event?.kind).toBe('leak')
  await expect(page.getByTestId('event')).toBeVisible()
  await g(page, 'give', 'tape')
  await g(page, 'useItem', 'tape')
  expect((await st(page)).event).toBeNull()
  await expect(page.getByTestId('banner')).toBeVisible()
  // coupure de courant : se termine seule
  await g(page, 'startEvent', 'blackout')
  expect((await st(page)).event?.kind).toBe('blackout')
  await g(page, 'drain', 18)
  expect((await st(page)).event?.kind).toBe('blackout')
  await g(page, 'drain', 15)
  expect((await st(page)).event).toBeNull()

  // trajectoire enregistrée pour la réplique fantôme
  expect((await st(page)).trackLen).toBeGreaterThan(8)
  // un fantôme existe après la partie complète du 1er test (difficulté Astronaute)
  const ghost = await (await request.get('/api/leaderboard.php?ghost=1&difficulty=astronaut')).json()
  expect(ghost.ghost?.track?.length ?? 0).toBeGreaterThan(8)

  // menu des succès
  await page.evaluate(() => (window as any).__game.set({ screen: 'launch' }))
  await page.getByTestId('open-ach').click()
  await expect(page.getByTestId('achievements')).toContainText('Bricoleur')
})

test('menu principal, nouvelle partie et paramètres', async ({ page, request }) => {
  await signedInPage(page, request)
  await expect(page.getByTestId('leaderboard')).toBeVisible()
  // paramètres : profil → choix d'un personnage à capacité
  await page.getByTestId('open-settings').click()
  await page.getByRole('button', { name: /Léo/ }).click()
  await expect.poll(async () => (await st(page)).settings.character).toBe('leo')
  // l'avantage du personnage choisi est affiché
  await expect(page.getByTestId('char-ability')).toContainText('Sprinteur')
  await expect(page.getByTestId('char-ability')).toContainText('20 %')
  // K12's new jump action also appears in main's redesigned settings page.
  await page.getByTestId('stab-2').click()
  await expect(page.getByTestId('bind-jump-0')).toContainText('Espace')
  // onglet Jeu : le français est la seule langue du jeu
  await page.getByTestId('stab-1').click()
  await expect(page.getByRole('button', { name: 'English' })).toHaveCount(0)
  await expect(page.getByText('Niveau d’aide')).toBeVisible()
  await expect(page.getByRole('button', { name: /Se déconnecter/ })).toBeVisible()
  await page.evaluate(() => window.__game.set({ screen: 'title' }))
  // nouvelle partie : retour à l'écran de lancement, choix de la carte et de la difficulté
  await page.getByTestId('new-game').first().click()
  await page.getByTestId('map-station').click()
  await page.getByTestId('diff-explorer').click()
  await page.getByTestId('start').click()
  await page.waitForFunction(() => window.__game.state().screen === 'prologue')
  expect((await st(page)).difficulty).toBe('explorer')
  expect((await st(page)).character).toBe('leo')
  expect(await page.evaluate(() => (window as any).__game.state().map)).toBe('station')
})
