import { act, allEnts, doorUnlocked, enterZone, entById, startEvent, tick, useItem } from './logic'
import { solveValves, valveHint } from './valves'
import { WALL_DIR, entWorld, spawnOf } from './maps'
import { G, addItem, live, newGameData, timeLimit, useGame } from './state'
import type { ItemId, ZoneId } from './types'

// API de test (équivalent de window.__c3 dans le prototype) : window.__game en mode dev.

export function installDevApi() {
  const api = {
    state: () => {
      const s = G()
      return {
        screen: s.screen,
        inventoryOpen: s.tabletOpen && s.tab === 3,
        tabletOpen: s.tabletOpen,
        tabletReady: s.tabletReady,
        tab: s.tab,
        messages: [...s.messages],
        selectedItem: s.selectedItem,
        held: s.held,
        zone: s.zone,
        playerZone: live.playerZone,
        loading: s.loading,
        flags: { ...s.flags },
        inv: { ...s.inv },
        res: { ...s.res },
        lampOn: s.lampOn,
        notes: [...s.notes],
        puzzle: s.puzzle,
        cine: s.cine,
        toured: [...s.toured],
        ended: s.ended,
        o2Critical: s.o2Critical,
        failCause: s.failCause,
        penalty: s.penalty,
        errors: s.errors,
        hintsUsed: s.hintsUsed,
        playTime: s.playTime,
        choice: s.choice,
        planDone: s.planDone,
        ending: s.ending,
        difficulty: s.difficulty,
        event: s.event,
        trackLen: s.track.length,
        valves: [...s.valves],
        valveStart: [...s.valveStart],
        pos: [...live.pos],
        aimed: live.aimed,
        propPositions: { ...s.propPositions },
        character: s.character,
        map: s.map,
        lunar: structuredClone(s.lunar),
        settings: { character: s.settings.character, help: s.settings.help },
      }
    },
    ents: () => allEnts(G().zone).map((e) => e.id),
    /** place le joueur devant un objectif, face à lui */
    teleport(id: string, dist = 1.3) {
      const e = entById(id)
      if (!e) throw new Error(`entité inconnue : ${id}`)
      const { p } = entWorld(e)
      let x = p[0]
      let z = p[2]
      if (e.wall) {
        const [nx, nz] = WALL_DIR[e.wall]
        x += nx * dist
        z += nz * dist
      } else {
        z += dist
      }
      const yaw = Math.atan2(-(p[0] - x), -(p[2] - z))
      useGame.setState({ tp: { pos: [x, G().zone === 4 ? p[1] + 0.2 : 0, z], yaw, n: Date.now() } })
      return [x, z]
    },
    teleportXZ(x: number, z: number, yaw = 0, y = 0) {
      useGame.setState({ tp: { pos: [x, y, z], yaw, n: Date.now() } })
    },
    interact: (id: string) => act(id),
    give: (item: ItemId, n = 1) => addItem(item, n),
    setRes: (r: Partial<{ o2: number; lamp: number; water: number; hp: number }>) => useGame.setState({ res: { ...G().res, ...r } }),
    /** simule n secondes de jeu pour les ressources */
    drain: (seconds: number) => {
      for (let i = 0; i < seconds * 10; i++) tick(0.1)
    },
    goto: (z: ZoneId) => enterZone(z),
    doorOpen: (id: string) => doorUnlocked(id),
    start(character = 'nova', skipIntro = true, difficulty: 'explorer' | 'astronaut' | 'survival' = 'astronaut', events = false, map: 'base' | 'station' = 'station') {
      live.explored.clear()
      live.noEvents = !events
      const loading = G().screen === 'playing' && G().zone === 1 && G().map === map ? G().loading : 0
      useGame.setState({ ...newGameData(character, difficulty, map), screen: 'playing', loading, tabletOpen: false, briefed: skipIntro, toured: map === 'base' ? [1] : [], cine: null, paused: false, puzzle: null, readNote: null })
      const sp = spawnOf(1)
      useGame.setState({ tp: { pos: sp.pos, yaw: sp.yaw, n: Date.now() } })
    },
    set: (p: Record<string, unknown>) => useGame.setState(p as any),
    startEvent: (k: 'blackout' | 'leak') => startEvent(k),
    useItem: (it: ItemId) => useItem(it),
    timeLimit: () => timeLimit(),
    valveSolution: () => solveValves(G().valves),
    valveHint: () => valveHint(G().valves),
    live,
  }
  ;(window as any).__game = api
  return api
}
