import { act, cycleItem, drinkPouch, toggleLamp, useBattery, useSelectedItem, useO2 } from '../game/logic'
import { G, live, useGame } from '../game/state'
import { skipCine } from '../world/Cinematics'
import { aim, closeInventory, closeTablet, openInventory, openTablet } from './Player'
import { input } from './input'

// Manette (mapping standard Xbox / PlayStation) :
// stick gauche bouger · stick droit regarder · A agir · B retour · X lampe · Y tablette
// LB oxygène · RB piles · RT boire · L3 ou LT courir · D-pad ←/→ choisir un objet, ↑ l'utiliser
// Start pause · Select passer la cinématique. Dans les menus : D-pad / stick pour se déplacer, A valider.

export const pad = { x: 0, y: 0, run: false, connected: false }
let prev: boolean[] = []
let navCooldown = 0

const DZ = 0.18
const dz = (v: number) => (Math.abs(v) < DZ ? 0 : Math.sign(v) * ((Math.abs(v) - DZ) / (1 - DZ)))

function overlayOpen() {
  const s = G()
  return s.screen !== 'playing' || s.loading < 1 || s.tabletOpen || s.inventoryOpen || !!s.puzzle || !!s.readNote || s.paused || s.settingsOpen
}

/** déplacement du focus entre boutons visibles (menus, énigmes, tablette) */
function moveFocus(dx: number, dy: number) {
  const els = [...document.querySelectorAll<HTMLElement>('button:not([disabled]), input[type=range], .char, .diff')].filter((e) => {
    const r = e.getBoundingClientRect()
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'
  })
  if (!els.length) return
  const cur = document.activeElement as HTMLElement | null
  if (!cur || !els.includes(cur)) {
    els[0].focus()
    return
  }
  const a = cur.getBoundingClientRect()
  const ax = a.left + a.width / 2
  const ay = a.top + a.height / 2
  let best: HTMLElement | null = null
  let bestD = Infinity
  for (const e of els) {
    if (e === cur) continue
    const r = e.getBoundingClientRect()
    const vx = r.left + r.width / 2 - ax
    const vy = r.top + r.height / 2 - ay
    const along = vx * dx + vy * dy
    if (along <= 4) continue
    const across = Math.abs(vx * dy - vy * dx)
    const d = along + across * 2.5
    if (d < bestD) {
      bestD = d
      best = e
    }
  }
  best?.focus()
}

function pressed(i: number, b: readonly GamepadButton[]) {
  return !!b[i]?.pressed && !prev[i]
}

export function pollGamepad(dt: number) {
  const gp = navigator.getGamepads?.().find((g) => g && g.connected) ?? null
  pad.connected = !!gp
  if (!gp) {
    pad.x = pad.y = 0
    pad.run = false
    return
  }
  const b = gp.buttons
  const ax = gp.axes
  const any = b.some((x) => x.pressed) || ax.some((v) => Math.abs(v) > 0.4)
  if (any && live.device !== 'pad') {
    live.device = 'pad'
    document.body.classList.add('pad')
    useGame.setState({ padActive: true })
  }
  const s = G()
  const menu = overlayOpen()
  if (s.screen === 'playing' && s.loading < 1) {
    pad.x = pad.y = 0
    pad.run = false
    if (pressed(8, b) && s.cine) skipCine()
    prev = b.map((x) => x.pressed)
    return
  }
  // sticks
  pad.x = menu ? 0 : dz(ax[0] ?? 0)
  pad.y = menu ? 0 : dz(ax[1] ?? 0)
  const rx = dz(ax[2] ?? 0)
  const ry = dz(ax[3] ?? 0)
  const k = 1100 * s.settings.sensitivity * dt
  if (!menu) {
    input.look.dx += Math.sign(rx) * rx * rx * k
    input.look.dy += Math.sign(ry) * ry * ry * k
  }
  pad.run = !!b[10]?.pressed || (b[6]?.value ?? 0) > 0.4

  if (pressed(9, b)) {
    if (s.screen === 'playing' && !s.cine) {
      if (s.puzzle || s.readNote) useGame.setState({ puzzle: null, readNote: null })
      else if (s.tabletOpen) closeTablet()
      else if (s.inventoryOpen) closeInventory()
      else useGame.setState({ paused: !s.paused })
    }
  }
  if (pressed(8, b) && s.cine) skipCine()

  if (menu) {
    // navigation dans les menus
    navCooldown -= dt
    const ny = (b[12]?.pressed ? -1 : 0) + (b[13]?.pressed ? 1 : 0) || (Math.abs(ax[1] ?? 0) > 0.6 ? Math.sign(ax[1]) : 0)
    const nx = (b[14]?.pressed ? -1 : 0) + (b[15]?.pressed ? 1 : 0) || (Math.abs(ax[0] ?? 0) > 0.6 ? Math.sign(ax[0]) : 0)
    if ((nx || ny) && navCooldown <= 0) {
      const el = document.activeElement as HTMLInputElement | null
      if (el?.type === 'range' && nx) {
        el.stepUp(nx > 0 ? 1 : 0)
        if (nx < 0) el.stepDown(1)
        el.dispatchEvent(new Event('input', { bubbles: true }))
      } else moveFocus(nx, ny)
      navCooldown = 0.18
    }
    if (!nx && !ny) navCooldown = 0
    if (pressed(0, b)) (document.activeElement as HTMLElement | null)?.click()
    if (pressed(1, b)) {
      if (s.tabletOpen) closeTablet()
      else if (s.inventoryOpen) closeInventory()
      else if (s.puzzle || s.readNote) useGame.setState({ puzzle: null, readNote: null })
      else if (s.paused) useGame.setState({ paused: false })
      else if (s.settingsOpen) useGame.setState({ settingsOpen: false })
    }
    if (pressed(3, b) && s.tabletOpen) closeTablet()
  } else if (s.screen === 'playing' && (!s.cine || s.cine === 'briefing')) {
    if (pressed(0, b) && aim.id && !s.cine) act(aim.id)
    if (pressed(2, b)) toggleLamp()
    if (pressed(3, b)) openTablet()
    if (pressed(4, b)) useO2()
    if (pressed(5, b)) useBattery()
    if ((b[7]?.value ?? 0) > 0.5 && !prev[7]) drinkPouch()
    if (!s.cine) {
      if (pressed(14, b)) cycleItem(-1)
      if (pressed(15, b)) cycleItem(1)
      if (pressed(12, b)) useSelectedItem()
      if (pressed(13, b)) openInventory()
    }
  }
  prev = b.map((x, i) => (i === 7 ? x.value > 0.5 : x.pressed))
}

/** boucle indépendante : la manette marche aussi dans les menus */
export function startGamepadLoop() {
  let last = performance.now()
  let raf = 0
  const loop = (t: number) => {
    pollGamepad(Math.min(0.05, (t - last) / 1000))
    last = t
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)
  return () => cancelAnimationFrame(raf)
}

/** clavier ou souris utilisés : on repasse aux libellés clavier */
export function markKeyboard() {
  if (live.device !== 'kb') {
    live.device = 'kb'
    document.body.classList.remove('pad')
    useGame.setState({ padActive: false })
  }
}
