// Entrées clavier / souris / tactile, avec touches configurables.
// On utilise KeyboardEvent.code (position physique) : ZQSD sur AZERTY = WASD sur QWERTY.

export type Action =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'run'
  | 'jump'
  | 'act'
  | 'lamp'
  | 'o2'
  | 'battery'
  | 'drink'
  | 'tablet'
  | 'inventory'
  | 'useSelected'
  | 'pause'
  | 'fullscreen'

export type KeyMap = Record<Action, string[]>

export const DEFAULT_KEYS: KeyMap = {
  forward: ['KeyW', 'ArrowUp'],
  back: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  run: ['ShiftLeft', 'ShiftRight'],
  jump: ['Space'],
  act: ['KeyE'],
  lamp: ['KeyF'],
  o2: ['KeyO'],
  battery: ['KeyR'],
  drink: ['KeyB'],
  tablet: ['Tab'],
  inventory: ['KeyI'],
  useSelected: ['KeyX'],
  pause: ['KeyP', 'Escape'],
  fullscreen: ['F11', 'KeyG'],
}

export const ACTION_ORDER: Action[] = ['forward', 'back', 'left', 'right', 'run', 'jump', 'act', 'inventory', 'useSelected', 'lamp', 'o2', 'battery', 'drink', 'tablet', 'pause', 'fullscreen']

let layout: Map<string, string> | null = null
;(navigator as any).keyboard
  ?.getLayoutMap?.()
  .then((m: Map<string, string>) => (layout = m))
  .catch(() => {})

const NAMES: Record<string, string> = {
  Space: 'Espace',
  ShiftLeft: 'Maj',
  ShiftRight: 'Maj D',
  ControlLeft: 'Ctrl',
  ControlRight: 'Ctrl D',
  AltLeft: 'Alt',
  Tab: 'Tab',
  Escape: 'Échap',
  Enter: 'Entrée',
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  Backspace: 'Retour',
  CapsLock: 'Verr. Maj',
  Mouse0: 'Clic G',
  Mouse2: 'Clic D',
  Mouse1: 'Clic molette',
}

/** nom affichable d'une touche, selon la disposition du clavier */
export function keyName(code: string) {
  if (NAMES[code]) return NAMES[code]
  const l = layout?.get(code)
  if (l) return l.toUpperCase()
  if (code.startsWith('Key')) return code.slice(3)
  if (code.startsWith('Digit')) return code.slice(5)
  if (code.startsWith('Numpad')) return 'Pavé ' + code.slice(6)
  return code
}

export function labelFor(keys: KeyMap, a: Action) {
  return keys[a]?.[0] ? keyName(keys[a][0]) : '—'
}

/** état des entrées lu par le joueur à chaque image */
export const input = {
  down: new Set<string>(),
  jumpRequested: false,
  look: { dx: 0, dy: 0 },
  // tactile
  joy: { x: 0, y: 0 },
  touchRun: false,
}

export function isDown(keys: KeyMap, a: Action) {
  for (const k of keys[a]) if (input.down.has(k)) return true
  return false
}

export function matches(keys: KeyMap, a: Action, code: string) {
  return keys[a].includes(code)
}
