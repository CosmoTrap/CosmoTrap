import { create } from 'zustand'
import { FLAGS, type Flags, type ItemId, type PuzzleId, type ZoneId } from './types'
import { DEFAULT_KEYS, DEFAULT_PAD, detectKeyLayout, type KeyLayout, type KeyMap, type PadMap, type PadType } from '../player/input'
import { DIFFICULTY, type Difficulty } from './difficulty'
import { LAYOUT_VERSION, migrateStationSave } from './maps/layoutMigration'

export type Screen = 'launch' | 'login' | 'title' | 'prologue' | 'playing' | 'end' | 'settings' | 'achievements' | 'credits'
/** carte choisie sur l'écran de lancement */
export type MissionMap = 'base' | 'station'
export type Quality = 'low' | 'medium' | 'high' | 'ultra'
export type CineKind = 'briefing' | 'faint' | 'zoneCard' | 'lift' | 'tour' | 'launch' | 'heli' | 'fail' | null

/** limite de temps de la partie (s) selon la difficulté : au-delà, échec */
export const timeLimit = () => DIFFICULTY[useGame.getState().difficulty ?? 'astronaut'].time + (useGame.getState().character === 'ines' ? 180 : 0)

/** capacités des personnages (multiplicateurs) */
export const ability = () => {
  const c = useGame.getState().character
  return {
    speed: c === 'leo' ? 1.2 : 1,
    lamp: c === 'nova' ? 0.65 : 1,
    errorPenalty: c === 'kenji' ? 0.5 : 1,
    water: c === 'sam' ? 0.6 : 1,
    faintO2: c === 'sam' ? 75 : 50,
    o2: c === 'maya' ? 0.75 : 1,
  }
}
export const diff = () => DIFFICULTY[useGame.getState().difficulty ?? 'astronaut']
export const AUTOSAVE_EVERY = 30

export interface Settings {
  quality: Quality
  sensitivity: number
  invertY: boolean
  /** volume général (multiplie musique, effets et voix) */
  master: number
  music: number
  sfx: number
  voice: number
  /** ambiance spatiale (souffle, réacteurs, dépressurisation) */
  ambience: number
  audioOutput: 'headphones' | 'speakers'
  spatialAudio: boolean
  /** bip quand l'O₂ passe sous 20 % */
  o2Alert: boolean
  /** légendes « [alarme] », « [fuite d'air] »… */
  soundCaptions: boolean
  fov: number
  colorblind: boolean
  keys: KeyMap
  /** libellés affichés pour les touches (les touches restent physiques) */
  keyLayout: KeyLayout
  pad: PadMap
  padType: PadType
  showFps: boolean
  /** afficher la réplique fantôme du record */
  ghost: boolean
  /** hauteur de rendu en pixels, ou automatique */
  resolution: 'auto' | number
  /** personnage choisi dans le profil (invités : local) */
  character: string
  /** carte et difficulté retenues sur l'écran de lancement */
  map: MissionMap
  difficulty: Difficulty
  /** niveau d'aide : fréquence et précision des indices */
  help: 'recrue' | 'pilote' | 'commandant'
  showChrono: boolean
  subtitles: boolean
  /** sauvegarde à chaque énigme résolue (en plus des 30 s) */
  autosave: boolean
  lang: 'fr' | 'en'
  /** luminosité de l'image (0,6 à 1,6) */
  brightness: number
  /** voix de synthèse du navigateur quand aucun fichier de voix n'est fourni */
  browserVoice: boolean
  /** regarder en glissant à deux doigts sur le pavé tactile (ou molette) */
  trackpadLook: boolean
}

export interface Toast {
  id: number
  text: string
  kind?: 'info' | 'good' | 'bad' | 'item'
}

/** état non réactif mis à jour à chaque image (position du joueur, etc.) */
export const live = {
  pos: [0, 0, 0] as [number, number, number],
  yaw: 0,
  pitch: 0,
  speed: 0,
  aimed: null as string | null,
  inDarkRoom: false,
  roomId: '' as string,
  fps: 60,
  /** Zone whose physical player has rendered a frame (loading/test readiness). */
  playerZone: null as ZoneId | null,
  /** décor extérieur pendant les cinématiques (décollage, rentrée) */
  ext: { y: 0, plasma: 0 },
  /** contrôle caméra par une cinématique */
  camOverride: null as null | { pos: [number, number, number]; look: [number, number, number]; fov?: number },
  bob: 0,
  /** fondu au noir (0..1) et flash blanc (0..1) pilotés par les cinématiques */
  fade: 0,
  flash: 0,
  penaltyFlash: 0,
  card: null as null | { title: string; sub: string; a: number },
  countdown: null as null | string,
  /** cases explorées (brouillard de la mini-carte) : « zone:x,z » */
  explored: new Set<string>(),
  banner: null as null | { title: string; sub: string; t: number },
  /** dernière entrée utilisée (pour afficher les bonnes touches) */
  device: 'kb' as 'kb' | 'pad',
  /** emplacement de la barre choisi à la manette */
  padSlot: 0,
  /** pas d'imprévus (tests automatiques) */
  noEvents: false,
  /** réplique fantôme chargée : [t, zone, x×10, z×10, …] */
  ghost: null as null | { pseudo: string; timeMs: number; track: number[] },
}

function initialValves() {
  // départ : tout vert, puis appuis (0,0), (1,1), (2,2)
  const v = Array(9).fill(true)
  for (const [r, c] of [
    [0, 0],
    [1, 1],
    [2, 2],
  ])
    pressValveGrid(v, r, c)
  return v
}

export function pressValveGrid(v: boolean[], r: number, c: number) {
  const flip = (rr: number, cc: number) => {
    if (rr < 0 || rr > 2 || cc < 0 || cc > 2) return
    v[rr * 3 + cc] = !v[rr * 3 + cc]
  }
  flip(r, c)
  flip(r - 1, c)
  flip(r + 1, c)
  flip(r, c - 1)
  flip(r, c + 1)
}

const emptyFlags = () => Object.fromEntries(FLAGS.map((f) => [f, false])) as Flags

export interface GameData {
  layoutVersion: number
  zone: ZoneId
  character: string
  map: MissionMap
  flags: Flags
  inv: Partial<Record<ItemId, number>>
  res: { o2: number; lamp: number; water: number }
  lampOn: boolean
  notes: string[]
  taken: string[]
  discovered: string[]
  hintsUsed: number
  hintsShown: string[]
  faints: number
  playTime: number
  valves: boolean[]
  seq: string[]
  briefed: boolean
  ended: boolean
  /** objet clé tenu en main (barre 1-9) */
  held: ItemId | null
  selectedItem: ItemId | null
  /** secondes de pénalité (erreurs, indices) ajoutées au chrono */
  penalty: number
  errors: number
  /** planning pré-vol (zone 3) */
  plan: string[]
  planDone: boolean
  /** embranchement : garder ou larguer les échantillons */
  choice: 'keep' | 'drop' | null
  /** zones dont la présentation cinématique a été vue */
  toured: number[]
  ending: 'rescue' | 'fail' | null
  /** copie sérialisée de live.explored */
  explored: string[]
  difficulty: Difficulty
  /** trajectoire pour la réplique fantôme : [t, zone, x×10, z×10, …] */
  track: number[]
  /** imprévu en cours */
  event: { kind: 'blackout' | 'leak'; until: number } | null
  nextEventAt: number
  /** positions monde du mobilier déplacé par le joueur */
  propPositions: Record<string, [number, number, number]>
  /** temps de jeu (pénalités comprises) à la résolution de chaque énigme, par id */
  splits: Record<string, number>
}

export const newGameData = (character = 'nova', difficulty: Difficulty = 'astronaut', map: MissionMap = 'base'): GameData => ({
  layoutVersion: LAYOUT_VERSION,
  zone: 1,
  character,
  map,
  flags: emptyFlags(),
  inv: {},
  res: { o2: 100, lamp: 100, water: 100 },
  lampOn: false,
  notes: [],
  taken: [],
  discovered: [],
  hintsUsed: 0,
  hintsShown: [],
  faints: 0,
  playTime: 0,
  valves: initialValves(),
  seq: [],
  briefed: false,
  ended: false,
  held: null,
  selectedItem: null,
  penalty: 0,
  errors: 0,
  plan: [],
  planDone: false,
  choice: null,
  toured: [],
  ending: null,
  explored: [],
  difficulty,
  track: [],
  event: null,
  nextEventAt: DIFFICULTY[difficulty].events * 0.7,
  propPositions: {},
  splits: {},
})

export interface GameState extends GameData {
  screen: Screen
  /** écran où revient la flèche des pages Paramètres, Succès et Crédits */
  menuBack: Screen
  paused: boolean
  locked: boolean // pointer lock actif
  tabletOpen: boolean
  inventoryOpen: boolean
  tab: number
  puzzle: PuzzleId | null
  readNote: string | null
  cine: CineKind
  cineT0: number
  toasts: Toast[]
  settingsOpen: boolean
  /** onglet de la page Paramètres (0 Profil, 1 Jeu, 2 Touches, 3 Audio) */
  settingsTab: number
  /** première connexion : on guide vers le choix du personnage */
  firstRun: boolean
  creditsOpen: boolean
  tp: { pos: [number, number, number]; yaw: number; n: number } | null
  loading: number // 0..1, 1 = prêt
  settings: Settings
  subtitle: string | null
  shake: number
  aimLabel: string | null
  /** une manette est utilisée */
  padActive: boolean
  padSlotTick: number
  resume: { pos: [number, number, number]; yaw: number } | null
  user: { id: number; email: string; pseudo: string; character?: string } | null
  offline: boolean
  myRank: number | null
  lastResult: { timeMs: number; score: number; rank: number | null } | null
  set: (p: Partial<GameState>) => void
}

const SETTINGS_KEY = 'cosmotrap.settings.v1'

export function isMobile() {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches
}

/** estimation de la puissance graphique pour choisir la qualité par défaut */
export function detectQuality(): Quality {
  if (isMobile()) return 'low'
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2') as WebGL2RenderingContext | null
    if (!gl) return 'low'
    const ext = gl.getExtension('WEBGL_debug_renderer_info')
    const r = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)).toLowerCase()
    const cores = navigator.hardwareConcurrency || 4
    if (/swiftshader|llvmpipe|software|basic render/.test(r)) return 'low'
    if (/rtx|radeon rx [67]|rx 7|apple m[2-9] (pro|max|ultra)|apple m[3-9]/.test(r)) return 'ultra'
    if (/apple m|apple gpu|geforce gtx 1[0-9]|rx 5|arc a/.test(r)) return 'high'
    // CPU thread count is not a measure of integrated graphics performance.
    if (/uhd|intel.*hd graphics|mali|adreno/.test(r)) return 'low'
    if (/intel|iris/.test(r)) return 'medium'
    return cores >= 8 ? 'high' : 'medium'
  } catch {
    return 'medium'
  }
}

function loadSettings(): Settings {
  const def: Settings = {
    quality: detectQuality(),
    sensitivity: 1,
    invertY: false,
    master: 0.8,
    music: 0.6,
    sfx: 0.75,
    voice: 0.9,
    ambience: 0.5,
    audioOutput: 'headphones',
    spatialAudio: true,
    o2Alert: true,
    soundCaptions: true,
    fov: 72,
    colorblind: false,
    keys: DEFAULT_KEYS,
    keyLayout: detectKeyLayout(),
    pad: DEFAULT_PAD,
    padType: 'xbox',
    showFps: false,
    ghost: true,
    resolution: 'auto',
    character: 'nova',
    map: 'base',
    difficulty: 'astronaut',
    help: 'pilote',
    showChrono: true,
    subtitles: true,
    autosave: true,
    lang: 'fr',
    brightness: 1,
    browserVoice: false,
    trackpadLook: true,
  }
  try {
    const q = new URLSearchParams(location.search).get('quality') as Quality | null
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null')
    const out = { ...def, ...(s || {}), keys: { ...DEFAULT_KEYS, ...(s?.keys || {}) }, pad: { ...DEFAULT_PAD, ...(s?.pad || {}) } }
    // Before jumping existed, Space was a second interaction key.
    if (s?.keys && !('jump' in s.keys)) {
      out.keys.act = out.keys.act.filter((code: string) => code !== 'Space')
      if (!out.keys.act.length) out.keys.act = [...DEFAULT_KEYS.act]
    }
    if (q) out.quality = q
    return out
  } catch {
    return def
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
  } catch {
    /* stockage indisponible */
  }
}

export const useGame = create<GameState>((set) => ({
  ...newGameData(),
  // un lien de réinitialisation de mot de passe ouvre directement la connexion
  screen: typeof location !== 'undefined' && new URLSearchParams(location.search).has('reset') ? 'login' : 'launch',
  menuBack: 'launch',
  paused: false,
  locked: false,
  tabletOpen: false,
  inventoryOpen: false,
  tab: 0,
  puzzle: null,
  readNote: null,
  cine: null,
  cineT0: 0,
  toasts: [],
  settingsOpen: false,
  settingsTab: 0,
  firstRun: false,
  creditsOpen: false,
  tp: null,
  loading: 1,
  settings: loadSettings(),
  subtitle: null,
  shake: 0,
  aimLabel: null,
  padActive: false,
  padSlotTick: 0,
  resume: null,
  user: null,
  offline: false,
  myRank: null,
  lastResult: null,
  set: (p) => set(p),
}))

export const G = () => useGame.getState()

let toastId = 1
const toastTimers = new Map<number, ReturnType<typeof setTimeout>>()
export function toast(text: string, kind: Toast['kind'] = 'info', ms = 3200) {
  // même message déjà affiché : on prolonge au lieu de l'empiler
  const same = useGame.getState().toasts.find((t) => t.text === text)
  const id = same?.id ?? toastId++
  if (!same) useGame.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, text, kind }] }))
  clearTimeout(toastTimers.get(id))
  toastTimers.set(
    id,
    setTimeout(() => {
      toastTimers.delete(id)
      useGame.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, ms),
  )
}

export function has(item: ItemId) {
  return (G().inv[item] ?? 0) > 0
}

export function addItem(item: ItemId, n = 1) {
  useGame.setState((s) => ({ inv: { ...s.inv, [item]: (s.inv[item] ?? 0) + n }, selectedItem: s.selectedItem ?? item }))
}

export function removeItem(item: ItemId, n = 1) {
  useGame.setState((s) => {
    const c = Math.max(0, (s.inv[item] ?? 0) - n)
    const inv = { ...s.inv }
    if (c === 0) delete inv[item]
    else inv[item] = c
    const items = Object.keys(inv) as ItemId[]
    const previousIndex = Object.keys(s.inv).indexOf(item)
    return { inv, held: c === 0 && s.held === item ? null : s.held,
      selectedItem: c === 0 && s.selectedItem === item ? items[Math.min(previousIndex, items.length - 1)] ?? null : s.selectedItem }
  })
}

export function setFlag(f: keyof Flags, v = true) {
  useGame.setState((s) => ({ flags: { ...s.flags, [f]: v } }))
}

export function addNote(id: string) {
  const s = G()
  if (s.notes.includes(id)) return false
  useGame.setState({ notes: [...s.notes, id] })
  return true
}

export function discover(pid: string) {
  const s = G()
  if (!s.discovered.includes(pid)) useGame.setState({ discovered: [...s.discovered, pid] })
}

export const takenKey = (zone: ZoneId, id: string) => `${zone}:${id}`
export function isTaken(id: string, zone = G().zone) {
  return G().taken.includes(takenKey(zone, id))
}
export function markTaken(id: string) {
  const s = G()
  useGame.setState({ taken: [...s.taken, takenKey(s.zone, id)] })
}

// ——— sauvegarde ———
/** une sauvegarde locale par compte */
const saveKey = () => `cosmotrap.save.v2.${G().user?.id ?? 'guest'}`

export function saveData(): GameData & { pos: number[]; yaw: number; savedAt: number } {
  const s = G()
  const keys = Object.keys(newGameData()) as (keyof GameData)[]
  const d = Object.fromEntries(keys.map((k) => [k, s[k]])) as unknown as GameData
  return { ...d, seq: [], explored: [...live.explored], pos: live.pos, yaw: live.yaw, savedAt: Date.now() }
}

/** sauvegarde locale + dans le compte (si connecté) */
export function saveGame(cloud = true) {
  const s = G()
  if (s.screen !== 'playing' || s.ended) return
  const d = saveData()
  try {
    localStorage.setItem(saveKey(), JSON.stringify(d))
  } catch {
    /* stockage indisponible */
  }
  if (cloud && s.user) cloudSave?.(d)
}

/** branché par api.ts pour éviter une dépendance circulaire */
export let cloudSave: ((d: unknown) => void) | null = null
export function setCloudSave(fn: (d: unknown) => void) {
  cloudSave = fn
}

export type SaveFile = GameData & { pos?: [number, number, number]; yaw?: number; savedAt?: number }

export function normalizeSave(d: any): SaveFile | null {
  if (!d || !d.zone) return null
  const saved = { ...newGameData(d.character), ...d, flags: { ...emptyFlags(), ...d.flags } }
  const items = (Object.keys(saved.inv) as ItemId[]).filter((it) => saved.inv[it] > 0)
  if (!items.includes(saved.selectedItem)) saved.selectedItem = items[0] ?? null
  if (!items.includes(saved.held)) saved.held = null
  return migrateStationSave(saved, d.layoutVersion ?? 1)
}

export function loadSave(): SaveFile | null {
  try {
    const raw = localStorage.getItem(saveKey())
    if (!raw) return null
    return normalizeSave(JSON.parse(raw))
  } catch {
    return null
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(saveKey())
  } catch {
    /* rien */
  }
}

/** plein écran (avec repli Safari) ; sur mobile, verrouille aussi le paysage */
export async function toggleFullscreen() {
  const d = document as any
  const el = document.documentElement as any
  try {
    if (document.fullscreenElement || d.webkitFullscreenElement) {
      await (document.exitFullscreen?.() ?? d.webkitExitFullscreen?.())
    } else {
      await (el.requestFullscreen?.({ navigationUI: 'hide' }) ?? el.webkitRequestFullscreen?.())
      await (screen.orientation as any)?.lock?.('landscape').catch?.(() => {})
    }
  } catch {
    /* refusé par le navigateur */
  }
}
