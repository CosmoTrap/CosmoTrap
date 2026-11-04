// Entrées clavier / souris / tactile, avec touches configurables.
// On utilise KeyboardEvent.code (position physique) : ZQSD sur AZERTY = WASD sur QWERTY.

export type Action =
  | 'forward'
  | 'back'
  | 'left'
  | 'right'
  | 'run'
  | 'jump'
  | 'crouch'
  | 'act'
  | 'inventory'
  | 'hint'
  | 'lamp'
  | 'o2'
  | 'battery'
  | 'drink'
  | 'tablet'
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
  crouch: ['ControlLeft'],
  act: ['KeyE'],
  inventory: ['Tab'],
  hint: ['KeyH'],
  lamp: ['KeyF'],
  o2: ['KeyO'],
  battery: ['KeyR'],
  drink: ['KeyB'],
  tablet: ['KeyT'],
  pause: ['Escape', 'KeyP'],
  fullscreen: ['F11', 'KeyG'],
}

export const ACTION_ORDER: Action[] = ['forward', 'back', 'left', 'right', 'run', 'jump', 'crouch', 'act', 'inventory', 'tablet', 'lamp', 'hint', 'pause', 'o2', 'battery', 'drink', 'fullscreen']

// ——— disposition du clavier (libellés seulement : les codes restent physiques) ———
export type KeyLayout = 'azerty' | 'qwerty'
let keyLayout: KeyLayout | null = null
const AZERTY: Record<string, string> = { KeyW: 'Z', KeyZ: 'W', KeyA: 'Q', KeyQ: 'A', Semicolon: 'M' }
export const setKeyLayout = (l: KeyLayout) => {
  keyLayout = l
}
export const detectKeyLayout = (): KeyLayout => (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fr') ? 'azerty' : 'qwerty')

// ——— manette ———
export type PadType = 'xbox' | 'ps5'
/** actions réaffectables à la manette (index du mapping standard) */
export type PadAction = 'jump' | 'crouch' | 'act' | 'inventory' | 'tablet' | 'lamp' | 'hint' | 'pause' | 'run' | 'drink' | 'o2' | 'battery'
export type PadMap = Record<PadAction, number>
export const DEFAULT_PAD: PadMap = { jump: 0, crouch: 1, act: 2, inventory: 3, tablet: 8, lamp: 4, hint: 5, pause: 9, run: 6, drink: 7, o2: 13, battery: 11 }
const PAD_XBOX = ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'Vue', 'Menu', 'L3', 'R3', 'Croix ↑', 'Croix ↓', 'Croix ←', 'Croix →', 'Xbox']
const PAD_PS5 = ['Croix', 'Rond', 'Carré', 'Triangle', 'L1', 'R1', 'L2', 'R2', 'Créer', 'Options', 'L3', 'R3', 'Flèche ↑', 'Flèche ↓', 'Flèche ←', 'Flèche →', 'PS', 'Pavé tactile']
/** nom d'un bouton de manette, avec le symbole de la marque */
export const padButtonName = (type: PadType, i: number) => (type === 'ps5' ? (i === 8 ? 'Pavé tactile' : PAD_PS5[i]) : PAD_XBOX[i]) ?? `B${i}`

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
  if (keyLayout === 'azerty' && AZERTY[code]) return AZERTY[code]
  if (keyLayout && code.startsWith('Key')) return code.slice(3)
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
