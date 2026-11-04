import { fr } from '../i18n/fr'
import { audio } from './audio/audio'
import { ITEM_KIND } from './items'
import { GRID_MAPS, entWorld, entsOf, roomAt, spawnOf } from './maps'
import {
  ability,
  G,
  addItem,
  addNote,
  discover,
  has,
  isTaken,
  live,
  markTaken,
  pressValveGrid,
  removeItem,
  saveGame,
  setFlag,
  toast,
  useGame,
  diff,
  timeLimit,
} from './state'
import { SURVIVAL_ITEMS } from './items'
import { checkCartographer, checkCollector, unlock } from './achievements'
import type { Ent, Flag, ItemId, ZoneId } from './types'

const L = fr.labels
const M = fr.msg

// ——— entités ———
const LOCKED_DOORS: Record<string, string> = { door_d1: 'doorBadge', door_dock: 'dockDoor' }

export function allEnts(zone: ZoneId): Ent[] {
  const base = entsOf(zone)
  if (zone === 4) return base
  const extra: Ent[] = GRID_MAPS[zone].doors
    .filter((d) => LOCKED_DOORS[d.id])
    .map((d) => ({ id: d.id, model: 'doorLock', tile: d.tile, dot: 'key' as const, hit: [2, 2.6, 2.2] as [number, number, number] }))
  return [...base, ...extra]
}

export function entById(id: string, zone = G().zone) {
  return allEnts(zone).find((e) => e.id === id) ?? null
}

export function doorUnlocked(id: string) {
  const f = G().flags
  if (id === 'door_d1') return f.door_d1
  if (id === 'door_dock') return f.power && f.pw_sas && f.readTerminal
  return true
}

/** l'entité est-elle dans une pièce sombre (non éclairée) ? */
export function isDarkAt(x: number, z: number, zone = G().zone) {
  if (zone === 4) return false
  const room = roomAt(GRID_MAPS[zone], x, z)
  if (!room?.dark) return false
  if (room.id === 'machinerie' && G().flags.pw_lights) return false
  return true
}

export function canSeeInDark() {
  const s = G()
  return s.lampOn && s.res.lamp > 0
}

/** l'entité est-elle visible / active (pas encore ramassée, etc.) */
export function entActive(e: Ent) {
  const s = G()
  if (e.item && isTaken(e.id)) return false
  if (LOCKED_DOORS[e.id]) return !doorUnlocked(e.id)
  switch (e.id) {
    case 'steam':
      return !s.flags.steamFixed
    case 'steamValve':
      return !s.flags.steamFixed
    case 'capsule':
      return !s.flags.capsule
    case 'bridge':
      return !s.flags.bridge
    case 'holo':
      return true
    case 'locker':
      return true
    case 'engine':
      return !s.flags.engine
  }
  return true
}

/** libellé « E · … » ou null si rien à faire */
export function labelOf(e: Ent): string | null {
  if (!entActive(e)) return null
  const s = G()
  if (e.item) return `${L.take} · ${fr.items[e.item].name}`
  if (LOCKED_DOORS[e.id]) return (L as any)[LOCKED_DOORS[e.id]]
  switch (e.id) {
    case 'locker':
      return s.flags.lockerOpen ? null : L.locker
    case 'board':
      return L.board
    case 'plate':
      return L.plate
    case 'postit':
    case 'labNote':
    case 'serreNote':
    case 'cargoNote':
    case 'sign':
      return L.read
    case 'dispenser':
      return L.dispenser
    case 'valves':
      return s.flags.pressurized ? null : L.valves
    case 'hatch':
      return L.hatch
    case 'steamValve':
      return L.steamValve
    case 'steam':
      return L.examine
    case 'breaker':
      return s.flags.power ? L.power : L.breaker
    case 'terminal':
      return L.terminal
    case 'dockExit':
      return L.dockDoor
    case 'engine':
      return L.engine
    case 'pilot':
      return L.pilot
    case 'capsule':
      return L.capsule
    case 'bridge':
      return L.bridge
    case 'beacon':
      return s.flags.beacon ? null : L.beacon
    case 'helipad':
      return L.helipad
    case 'river':
    case 'river2':
      return L.river
    case 'holo':
      return L.holo
  }
  return L.examine
}

function readNote(id: string, flag?: Flag) {
  if (flag) setFlag(flag)
  if (addNote(id)) toast(M.noteAdded, 'info', 1800)
  useGame.setState({ readNote: id })
  audio.sfx('page')
}

function pickup(e: Ent) {
  const item = e.item as ItemId
  markTaken(e.id)
  addItem(item)
  const kind = ITEM_KIND[item]
  if (item === 'o2') audio.sfx('pickup_o2')
  else if (item === 'battery') audio.sfx('pickup_battery')
  else if (item === 'water') audio.sfx('pickup_water')
  else if (kind === 'survival') audio.sfx('pickup_bonus')
  else audio.sfx('pickup_key')
  toast(M.picked(fr.items[item].name), 'item')
  if (kind === 'survival') checkCollector()
  if (item === 'lamp') {
    const k = G().settings.keys.lamp[0]
    toast(`Touche ${k?.replace('Key', '')} : allumer la lampe`, 'info', 4500)
  }
}

/** agir sur une entité (E / bouton Agir) */
export function act(id: string) {
  const s = G()
  const e = entById(id)
  if (!e || !entActive(e)) return false
  const { p } = entWorld(e)
  // les ressources (O₂, piles, eau) portent un marquage phosphorescent : on peut les prendre dans le noir,
  // sinon une lampe vide sans piles bloquerait la partie. Les objets clés et la lecture exigent de la lumière.
  const glows = !!e.item && ITEM_KIND[e.item] === 'resource'
  const needsLight = (!!e.item && !glows) || ['board', 'plate', 'postit', 'labNote', 'serreNote', 'cargoNote', 'terminal', 'locker'].includes(e.id)
  if (needsLight && isDarkAt(p[0], p[2]) && !canSeeInDark()) {
    toast(!has('lamp') ? M.noLamp : s.res.lamp <= 0 ? M.lampEmpty : M.tooDark, 'bad')
    audio.sfx('error', { vol: 0.5 })
    return false
  }
  if (e.item) {
    pickup(e)
    return true
  }
  const f = s.flags
  switch (e.id) {
    case 'holo':
      useGame.setState({ cine: 'briefing', cineT0: performance.now() })
      return true
    case 'board':
      readNote('board', 'read_board')
      discover('p_locker')
      return true
    case 'plate':
      readNote('plate')
      discover('p_locker')
      return true
    case 'postit':
      readNote('postit')
      return true
    case 'labNote':
      readNote('lab')
      return true
    case 'serreNote':
      readNote('serre')
      return true
    case 'cargoNote':
      readNote('cargo')
      discover('p_engine')
      return true
    case 'sign':
      readNote('sign')
      return true
    case 'locker':
      discover('p_locker')
      if (f.lockerOpen) return false
      openPuzzle('keypad')
      return true
    case 'dispenser':
    case 'river':
    case 'river2':
      if (s.res.water >= 99.5) toast(M.full)
      else {
        useGame.setState({ res: { ...s.res, water: 100 } })
        audio.sfx('drink')
        toast(M.drank, 'good')
      }
      return true
    case 'door_d1':
      if (!has('badge')) {
        audio.sfx('door_locked')
        toast(M.needBadge, 'bad')
        return false
      }
      setFlag('door_d1')
      audio.sfx('success')
      toast(M.doorOpen, 'good')
      return true
    case 'valves':
      discover('p_valves')
      openPuzzle('valves')
      return true
    case 'hatch':
      if (!f.pressurized) {
        audio.sfx('door_locked')
        toast(M.hatchLocked, 'bad')
        return false
      }
      transitionTo(2)
      return true
    case 'steam':
      discover('p_steam')
      toast(M.steamBlocks, 'bad')
      return true
    case 'steamValve':
      discover('p_steam')
      if (!has('wrench')) {
        audio.sfx('error')
        toast(M.needWrench, 'bad')
        return false
      }
      setFlag('steamFixed')
      celebrate('p_steam')
      audio.sfx('valve')
      audio.stopLoop('steam')
      toast(M.steamFixed, 'good')
      return true
    case 'breaker':
      discover('p_power')
      if (!f.power) {
        if (!has('fuse')) {
          audio.sfx('error')
          toast(M.needFuse, 'bad')
          return false
        }
        removeItem('fuse')
        setFlag('power')
        audio.sfx('power_up')
        toast(M.powerOn, 'good')
      }
      openPuzzle('power')
      return true
    case 'terminal':
      if (!f.power || !f.pw_terminal) {
        audio.sfx('error')
        toast(M.noPowerTerminal, 'bad')
        return false
      }
      discover('p_algo')
      discover('p_sequence')
      if (f.readTerminal) {
        readNote('terminal')
        return true
      }
      addNote('terminalCode')
      openPuzzle('algo')
      return true
    case 'door_dock':
      if (!f.power || !f.pw_sas) {
        audio.sfx('door_locked')
        toast(M.dockNoPower, 'bad')
        return false
      }
      if (!f.readTerminal) {
        audio.sfx('door_locked')
        toast(M.dockNoTerminal, 'bad')
        return false
      }
      return true
    case 'dockExit':
      transitionTo(3)
      return true
    case 'engine':
      discover('p_engine')
      if (!has('cell')) {
        audio.sfx('error')
        toast(M.needCell, 'bad')
        return false
      }
      removeItem('cell')
      setFlag('engine')
      celebrate('p_engine')
      audio.sfx('power_up')
      toast(M.engineOn, 'good')
      return true
    case 'pilot':
      discover('p_sequence')
      if (!f.engine) {
        audio.sfx('error')
        toast(M.engineOff, 'bad')
        return false
      }
      discover('p_plan')
      if (!s.planDone) openPuzzle('plan')
      else if (!s.choice) openPuzzle('dilemma')
      else {
        useGame.setState({ seq: [] })
        openPuzzle('sequence')
      }
      return true
    case 'capsule':
      setFlag('capsule')
      addItem('carBattery')
      addItem('rope')
      addItem('manual')
      addNote('manual')
      audio.sfx('pickup_key')
      toast(M.capsuleDone, 'item', 4200)
      discover('p_bridge')
      discover('p_radio')
      return true
    case 'bridge':
      discover('p_bridge')
      if (!has('rope')) {
        audio.sfx('error')
        toast(M.needRope, 'bad')
        return false
      }
      removeItem('rope')
      setFlag('bridge')
      celebrate('p_bridge')
      audio.sfx('rope')
      toast(M.bridgeFixed, 'good')
      return true
    case 'beacon':
      discover('p_radio')
      if (!has('carBattery') || !has('antenna')) {
        audio.sfx('error')
        toast(M.beaconNeeds, 'bad')
        return false
      }
      openPuzzle('radio')
      return true
    case 'helipad':
      if (!f.beacon) {
        toast(M.needBeacon, 'bad')
        return false
      }
      if (!has('flareGun')) {
        toast(M.needFlare, 'bad')
        return false
      }
      removeItem('flareGun')
      audio.sfx('flare')
      useGame.setState({ cine: 'heli', cineT0: performance.now(), tabletOpen: false, inventoryOpen: false, puzzle: null })
      return true
  }
  return false
}

/** erreur : conséquence visible (pénalité de temps) */
export function penalize(sec: number, countError = true) {
  const s = G()
  sec = Math.round(sec * diff().penalty * (countError ? ability().errorPenalty : 1))
  useGame.setState({ penalty: s.penalty + sec, errors: s.errors + (countError ? 1 : 0) })
  live.flash = 0
  live.penaltyFlash = 1
  toast(fr.rules.penalty(sec), 'bad', 1800)
}

export function timeUsed() {
  const s = G()
  return s.playTime + s.penalty
}

export function computeScore() {
  const s = G()
  const surv = SURVIVAL_ITEMS.filter((k) => (s.inv[k] ?? 0) > 0).length
  const t = timeUsed()
  return Math.max(0, Math.round((6000 + (timeLimit() - t) * 3 - s.hintsUsed * 150 - s.errors * 100 + surv * 60 + (s.choice === 'keep' ? 300 : 0)) * diff().score))
}

function openPuzzle(p: 'keypad' | 'valves' | 'power' | 'sequence' | 'radio' | 'algo' | 'plan' | 'dilemma') {
  useGame.setState({ puzzle: p, tabletOpen: false, inventoryOpen: false })
  document.exitPointerLock?.()
}

// ——— énigmes ———
export function submitKeypad(code: string) {
  if (code === '2041') {
    setFlag('lockerOpen')
    celebrate('p_locker')
    addItem('badge')
    audio.sfx('success')
    audio.sfx('pickup_key')
    toast(M.lockerOpen, 'good', 4000)
    setTimeout(() => useGame.setState({ puzzle: null }), 700)
    return true
  }
  audio.sfx('error')
  penalize(30)
  return false
}

export function pressValve(i: number) {
  const s = G()
  if (s.flags.pressurized) return
  const v = [...s.valves]
  pressValveGrid(v, Math.floor(i / 3), i % 3)
  useGame.setState({ valves: v })
  audio.sfx('valve', { vol: 0.5 })
  if (v.every(Boolean)) {
    setFlag('pressurized')
    celebrate('p_valves')
    audio.sfx('airlock')
    audio.sfx('success')
    toast(M.pressurized, 'good', 4000)
    setTimeout(() => useGame.setState({ puzzle: null }), 1200)
  }
}

export function resetValves() {
  const v = Array(9).fill(true)
  for (const [r, c] of [
    [0, 0],
    [1, 1],
    [2, 2],
  ])
    pressValveGrid(v, r, c)
  useGame.setState({ valves: v })
}

export const POWER_SYSTEMS = ['pw_lights', 'pw_o2', 'pw_terminal', 'pw_sas'] as const
export function togglePower(sys: (typeof POWER_SYSTEMS)[number]) {
  const f = G().flags
  if (!f.power) return
  const used = POWER_SYSTEMS.filter((k) => f[k]).length
  if (!f[sys] && used >= 3) {
    audio.sfx('error')
    toast(fr.puzzles.power.full, 'bad')
    return
  }
  setFlag(sys, !f[sys])
  const nf = G().flags
  if (!(f.pw_sas && f.pw_terminal) && nf.pw_sas && nf.pw_terminal) celebrate('p_power')
  audio.sfx(f[sys] ? 'lamp_off' : 'lamp_on')
  if (!f[sys] && sys === 'pw_lights') audio.sfx('power_up', { vol: 0.5 })
}

export const SEQUENCE = ['blue', 'yellow', 'red', 'green']
export function pressSeq(color: string) {
  const s = G()
  const seq = [...s.seq, color]
  audio.sfx('keypad')
  if (SEQUENCE[seq.length - 1] !== color) {
    audio.sfx('error')
    toast(M.seqWrong, 'bad')
    useGame.setState({ seq: [] })
    penalize(30)
    return
  }
  useGame.setState({ seq })
  if (seq.length === SEQUENCE.length) {
    audio.sfx('success')
    celebrate('p_sequence')
    toast(M.seqOk, 'good')
    setTimeout(() => useGame.setState({ puzzle: null, cine: 'launch', cineT0: performance.now() }), 900)
  }
}

export function emitRadio(freq: number) {
  if (Math.abs(freq - 121.5) < 0.05) {
    removeItem('carBattery')
    removeItem('antenna')
    setFlag('beacon')
    celebrate('p_radio')
    audio.sfx('success')
    audio.speak('Signal reçu sur 121,5. Hélicoptère en route.', { radio: true, id: 'radio' })
    useGame.setState({ subtitle: fr.puzzles.radio.voice })
    setTimeout(() => useGame.setState({ subtitle: null }), 5000)
    toast(M.beaconOk, 'good', 5000)
    setTimeout(() => useGame.setState({ puzzle: null }), 2500)
    return true
  }
  audio.sfx('radio_tune')
  audio.sfx('error', { vol: 0.4 })
  penalize(20)
  return false
}

// ——— énigme d'algorithmique : programme du terminal ———
export function submitAlgo(colors: string[]) {
  const ok = colors.length === 4 && colors.every((c, i) => c === SEQUENCE[i])
  if (ok) {
    setFlag('readTerminal')
    celebrate('p_algo')
    addNote('terminal')
    audio.sfx('success')
    toast(fr.algo.ok, 'good', 3500)
    setTimeout(() => useGame.setState({ puzzle: null }), 900)
    return true
  }
  audio.sfx('error')
  toast(fr.algo.wrong, 'bad')
  penalize(30)
  return false
}

// ——— énigme de gestion de projet : planning pré-vol ———
export function pressPlan(task: string) {
  const s = G()
  if (s.planDone || s.plan.includes(task)) return
  const t = fr.plan.tasks[task]
  if (!t.dep.every((d) => s.plan.includes(d))) {
    audio.sfx('error')
    toast(fr.plan.wrong(t.name), 'bad')
    penalize(20)
    return
  }
  const plan = [...s.plan, task]
  audio.sfx('keypad')
  const done = plan.length === Object.keys(fr.plan.tasks).length
  useGame.setState({ plan, planDone: done })
  if (done) {
    audio.sfx('success')
    celebrate('p_plan')
    toast(fr.plan.ok, 'good', 3500)
    setTimeout(() => useGame.setState({ puzzle: 'dilemma' }), 1100)
  }
}

// ——— embranchement narratif ———
export function choose(c: 'keep' | 'drop') {
  useGame.setState({ choice: c })
  if (c === 'keep') penalize(60, false)
  toast(c === 'keep' ? fr.dilemma.kept : fr.dilemma.dropped, 'info', 4000)
  audio.sfx('click')
  setTimeout(() => {
    useGame.setState({ seq: [], puzzle: 'sequence' })
  }, 600)
}

// ——— ressources ———
export function useO2(auto = false) {
  const s = G()
  if (!has('o2')) {
    if (!auto) toast(M.noO2, 'bad')
    return false
  }
  if (s.zone === 4) return false
  if (!auto && s.res.o2 >= 99) {
    toast(M.full)
    return false
  }
  removeItem('o2')
  useGame.setState({ res: { ...G().res, o2: Math.min(100, G().res.o2 + 55) } })
  audio.sfx('breathe_o2')
  if (auto) toast(M.autoO2, 'good')
  return true
}

export function useBattery(auto = false) {
  const s = G()
  if (!has('battery')) {
    if (!auto) toast(M.noBattery, 'bad')
    return false
  }
  if (!auto && s.res.lamp >= 99) {
    toast(M.full)
    return false
  }
  removeItem('battery')
  useGame.setState({ res: { ...G().res, lamp: Math.min(100, G().res.lamp + 50) } })
  audio.sfx('pickup_battery')
  if (auto) toast(M.autoBattery, 'good')
  return true
}

export function drinkPouch() {
  const s = G()
  if (!has('water')) {
    toast(M.noWater, 'bad')
    return false
  }
  if (s.res.water >= 99) {
    toast(M.full)
    return false
  }
  removeItem('water')
  useGame.setState({ res: { ...G().res, water: Math.min(100, G().res.water + 50) } })
  audio.sfx('drink')
  return true
}

export function toggleLamp() {
  const s = G()
  if (!has('lamp')) {
    toast(M.noLamp, 'bad')
    return
  }
  if (!s.lampOn && s.res.lamp <= 0) {
    if (!useBattery(true)) {
      toast(M.lampEmpty, 'bad')
      return
    }
  }
  useGame.setState({ lampOn: !s.lampOn })
  audio.sfx(s.lampOn ? 'lamp_off' : 'lamp_on')
}

/** Tous les objets possédés, dans l'ordre d'acquisition, sans limite de cases. */
export function hotbarItems(): ItemId[] {
  const inv = G().inv
  return (Object.keys(inv) as ItemId[]).filter((k) => (inv[k] ?? 0) > 0 && k in ITEM_KIND)
}

export function selectedInventoryItem(): ItemId | null {
  const items = hotbarItems()
  return items.find((it) => it === G().selectedItem) ?? items[0] ?? null
}

export function selectItem(item: ItemId) {
  if (!has(item)) return
  useGame.setState({ selectedItem: item })
}

export function cycleItem(direction: number) {
  const items = hotbarItems()
  if (!items.length) return
  const current = items.indexOf(selectedInventoryItem()!)
  selectItem(items[(current + Math.sign(direction) + items.length) % items.length])
}

export function useSelectedItem() {
  const s = G()
  if (s.screen !== 'playing' || s.loading < 1 || s.cine || s.paused || s.settingsOpen || s.puzzle || s.readNote || s.tabletOpen) return
  const item = selectedInventoryItem()
  if (item) useItem(item)
}

export function canUseItem(item: ItemId) {
  return ITEM_KIND[item] !== 'survival' || item === 'tape' || item === 'map'
}

/** Sélection directe : les touches 1 à 9 ne consomment jamais un objet. */
export function useSlot(n: number) {
  const item = hotbarItems()[n]
  if (!item) return
  selectItem(item)
}

export function useItem(item: ItemId) {
  if (!has(item)) return false
  selectItem(item)
  if (!canUseItem(item)) return false
  if (item === 'o2') return useO2()
  if (item === 'battery') return useBattery()
  if (item === 'water') return drinkPouch()
  if (item === 'lamp') return toggleLamp()
  if (item === 'tape') return sealLeak()
  const s = G()
  useGame.setState({ held: s.held === item ? null : item })
  audio.sfx('click')
  if (item === 'manual' || item === 'map') useGame.setState({ readNote: item === 'manual' ? 'manual' : 'sign', inventoryOpen: false, tabletOpen: false })
}

// ——— boucle des ressources ———
let alarmT = 0
let lowO2On = false
let lastTick = -1
let urgentWarned = false

// ——— imprévus : coupure de courant, micro-fuite ———
function updateEvents(dt: number): 'blackout' | 'leak' | null {
  const s = G()
  const D = diff()
  if (s.event && s.playTime >= s.event.until) endEvent()
  if (!s.event && D.events && s.zone < 4 && !live.noEvents && !s.puzzle && s.playTime >= s.nextEventAt && s.briefed) startEvent(Math.random() < 0.5 ? 'blackout' : 'leak')
  void dt
  return G().event?.kind ?? null
}

export function startEvent(kind: 'blackout' | 'leak') {
  const s = G()
  const dur = kind === 'blackout' ? 22 : 28
  useGame.setState({ event: { kind, until: s.playTime + dur } })
  audio.sting('danger')
  if (kind === 'blackout') {
    audio.sfx('lamp_off', { vol: 1 })
    audio.sfx('power_up', { vol: 0.3 })
    toast(fr.events.blackout, 'bad', 5000)
  } else {
    audio.loop('leak', 'steam', { vol: 0.45 })
    toast(has('tape') ? fr.events.leakTape : fr.events.leak, 'bad', 6000)
  }
}

export function endEvent(sealed = false) {
  const s = G()
  const k = s.event?.kind
  const D = diff()
  useGame.setState({ event: null, nextEventAt: s.playTime + D.events * (0.7 + Math.random() * 0.6) })
  if (k === 'leak') {
    audio.stopLoop('leak')
    toast(sealed ? fr.events.sealed : fr.events.leakEnd, 'good', 3000)
  }
  if (k === 'blackout') {
    audio.sfx('power_up', { vol: 0.6 })
    toast(fr.events.powerBack, 'good', 2500)
  }
}

/** colmater une micro-fuite avec le ruban adhésif (objet de survie) */
export function sealLeak() {
  const s = G()
  if (s.event?.kind !== 'leak') {
    toast(fr.events.noLeak)
    return false
  }
  if (!has('tape')) return false
  removeItem('tape')
  audio.sfx('rope')
  endEvent(true)
  unlock('sealed')
  return true
}

// ——— trajectoire pour la réplique fantôme ———
let lastSample = -1
function recordTrack() {
  const s = G()
  const t = Math.floor(s.playTime * 2) / 2
  if (t === lastSample) return
  lastSample = t
  const tr = s.track
  if (tr.length > 4 * 6000) return
  tr.push(Math.round(t * 10) / 10, s.zone, Math.round(live.pos[0] * 10), Math.round(live.pos[2] * 10))
}

/** bannière animée + motif musical quand une énigme est résolue */
export function celebrate(id: string) {
  const p = fr.puzzleList.find((x) => x.id === id)
  if (!p) return
  useGame.setState((s) => (s.splits?.[id] ? {} : { splits: { ...s.splits, [id]: s.playTime + s.penalty } }))
  live.banner = { title: G().settings.lang === 'en' ? 'Puzzle solved' : 'Énigme résolue', sub: `${p.name} · ${p.domain}`, t: performance.now() }
  audio.sting('solved')
  if (G().settings.autosave) setTimeout(() => saveGame(), 400)
}
export function tick(dt: number) {
  const s = G()
  if (s.screen !== 'playing' || s.loading < 1 || s.paused || s.cine) return
  const f = s.flags
  const res = { ...s.res }
  const D = diff()
  const ev = updateEvents(dt)
  recordTrack()
  // oxygène (zones 1 à 3)
  if (s.zone < 4) {
    const AB = ability()
    let rate = 0.42 * D.drain * AB.o2
    if (ev === 'leak') rate *= 2.2
    if (s.zone === 2 && !f.steamFixed) rate *= 1.5
    if (s.zone === 2 && f.power && f.pw_o2) rate = 0
    res.o2 = Math.max(0, res.o2 - rate * dt)
  } else res.o2 = 100
  // lampe
  let lampOn = s.lampOn
  if (lampOn) {
    res.lamp = Math.max(0, res.lamp - 0.75 * D.drain * ability().lamp * dt)
    if (res.lamp <= 0) {
      if (has('battery')) {
        removeItem('battery')
        res.lamp = 50
        audio.sfx('pickup_battery')
        toast(M.autoBattery, 'good')
      } else {
        lampOn = false
        audio.sfx('lamp_off')
        toast(M.lampEmpty, 'bad')
      }
    }
  }
  // eau
  res.water = Math.max(0, res.water - 0.11 * D.drain * ability().water * dt)
  useGame.setState({ res, lampOn, playTime: s.playTime + dt })
  if (s.playTime + dt + s.penalty >= timeLimit()) {
    useGame.setState({ cine: 'fail', cineT0: performance.now(), tabletOpen: false, inventoryOpen: false, puzzle: null, readNote: null })
    return
  }

  if (res.o2 <= 0 && s.zone < 4) {
    if (has('o2')) useO2(true)
    else faint()
  }
  // retours O₂ faible
  const low = res.o2 < 25 && s.zone < 4
  if (low) {
    alarmT -= dt
    if (alarmT <= 0) {
      audio.sfx('alarm_o2', { vol: 0.8 })
      alarmT = 2.5
    }
    if (!lowO2On) {
      audio.loop('heartbeat', 'heartbeat', { vol: 0.7 })
      toast(M.o2Low, 'bad')
      lowO2On = true
    }
  } else if (lowO2On) {
    audio.stopLoop('heartbeat')
    lowO2On = false
  }
  // musique : accélère quand l'oxygène baisse ou que le temps presse
  const left = timeLimit() - (s.playTime + s.penalty)
  const urgency = left < 180 ? 1 - left / 180 : 0
  const o2t = s.zone < 4 ? (res.o2 < 25 ? 0.6 + 0.4 * (1 - res.o2 / 25) : res.o2 < 40 ? 0.35 : 0) : 0
  audio.setTension(o2t, urgency)
  audio.setHeartRate(low ? 70 + 80 * (1 - res.o2 / 25) : 62)
  if (left < 60 && Math.floor(left) !== lastTick) {
    lastTick = Math.floor(left)
    audio.sfx('tick', { vol: 0.6 })
  }
  if (left < 180 && !urgentWarned) {
    urgentWarned = true
    audio.sting('danger')
    toast('Plus que 3 minutes !', 'bad', 3500)
  }
  audio.setMuffle(s.zone < 4 && res.o2 < 10 ? 1 - res.o2 / 10 : 0)
}

export function faint() {
  const s = G()
  audio.sfx('faint')
  useGame.setState({ cine: 'faint', cineT0: performance.now(), faints: s.faints + 1, tabletOpen: false, inventoryOpen: false, puzzle: null })
}

export function respawnAfterFaint() {
  const s = G()
  const sp = spawnOf(s.zone)
  useGame.setState({ res: { ...s.res, o2: ability().faintO2 }, tp: { pos: sp.pos, yaw: sp.yaw, n: Date.now() } })
  audio.sfx('gasp')
}

// ——— changement de zone ———
export let pendingZone: ZoneId | null = null
export function transitionTo(z: ZoneId) {
  pendingZone = z
  audio.sfx('airlock')
  useGame.setState({ cine: 'zoneCard', cineT0: performance.now(), tabletOpen: false, inventoryOpen: false, puzzle: null })
}

export function enterZone(z: ZoneId) {
  if (G().zone !== z) {
    live.playerZone = null
    useGame.setState({ loading: 0 })
  }
  if (z === 3) checkCartographer([1, 2].map((zone) => ({ zone, grid: GRID_MAPS[zone as 1 | 2].grid })))
  pendingZone = null
  urgentWarned = false
  const sp = spawnOf(z)
  audio.stopAllLoops()
  useGame.setState({ zone: z, held: null, tp: { pos: sp.pos, yaw: sp.yaw, n: Date.now() }, lampOn: G().lampOn })
  live.pos = [...sp.pos]
  live.yaw = sp.yaw
  setTimeout(saveGame, 300)
}

// ——— mission ———
export function stepsState(zone: ZoneId) {
  const s = G()
  const f = s.flags
  const zDone = s.zone > zone || s.ended
  const done: Record<string, boolean> = {
    lamp: has('lamp'),
    board: f.read_board,
    plate: s.notes.includes('plate'),
    locker: f.lockerOpen,
    door: f.door_d1,
    valves: f.pressurized,
    hatch: zDone,
    fuse: has('fuse') || f.power,
    wrench: has('wrench') || f.steamFixed,
    steam: f.steamFixed,
    breaker: f.power,
    power: f.power && f.pw_sas && f.pw_terminal,
    terminal: f.readTerminal,
    dock: zDone,
    cell: has('cell') || f.engine,
    engine: f.engine,
    plan: s.planDone,
    choice: !!s.choice,
    launch: zDone,
    capsule: f.capsule,
    antenna: has('antenna') || f.beacon,
    bridge: f.bridge,
    beacon: f.beacon,
    flare: has('flareGun') || s.ended,
    helipad: s.ended,
  }
  const steps = fr.steps[zone]
  const firstTodo = steps.findIndex((st) => !(zDone || done[st.id]))
  return steps.map((st, i) => ({
    ...st,
    status: (zDone || done[st.id] ? 'done' : i === firstTodo ? 'current' : 'todo') as 'done' | 'current' | 'todo',
  }))
}

const STEP_PUZZLE: Record<string, string> = {
  board: 'p_locker',
  plate: 'p_locker',
  locker: 'p_locker',
  valves: 'p_valves',
  wrench: 'p_steam',
  steam: 'p_steam',
  power: 'p_power',
  terminal: 'p_algo',
  plan: 'p_plan',
  cell: 'p_engine',
  engine: 'p_engine',
  launch: 'p_sequence',
  capsule: 'p_bridge',
  bridge: 'p_bridge',
  beacon: 'p_radio',
}

/** indice de l'étape courante : niveau 1 (léger, −30 s) ou 2 (fort, −60 s) */
export function hintFor(level: 1 | 2) {
  const s = G()
  const cur = stepsState(s.zone).find((x) => x.status === 'current')
  if (!cur) return null
  const pz = fr.puzzleList.find((p) => p.id === STEP_PUZZLE[cur.id])
  return level === 1 ? cur.hint : pz?.hint2 ?? cur.hint
}

export function hintKey(level: 1 | 2) {
  const s = G()
  const cur = stepsState(s.zone).find((x) => x.status === 'current')
  return cur ? `${s.zone}:${cur.id}:${level}` : null
}

export function requestHint(level: 1 | 2 = 1) {
  const s = G()
  const key = hintKey(level)
  if (!key) return null
  if (!s.hintsShown.includes(key)) {
    useGame.setState({ hintsShown: [...s.hintsShown, key], hintsUsed: s.hintsUsed + 1 })
    const help = s.settings.help
    const cost = help === 'recrue' ? (level === 1 ? 0 : 30) : help === 'commandant' ? (level === 1 ? 60 : 120) : level === 1 ? 30 : 60
    if (cost) penalize(cost, false)
  }
  return hintFor(level)
}

export function puzzleStatus(p: { id: string; zone: number }) {
  const s = G()
  const f = s.flags
  const solved: Record<string, boolean> = {
    p_locker: f.lockerOpen,
    p_valves: f.pressurized,
    p_steam: f.steamFixed,
    p_power: f.power && f.pw_sas && f.pw_terminal,
    p_engine: f.engine,
    p_sequence: s.zone > 3 || s.ended,
    p_algo: f.readTerminal,
    p_plan: s.planDone,
    p_bridge: f.bridge,
    p_radio: f.beacon,
  }
  if (solved[p.id]) return 'solved'
  if (p.zone === s.zone && s.discovered.includes(p.id)) return 'progress'
  return 'locked'
}
