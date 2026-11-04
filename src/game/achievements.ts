import { fetchAchievements, pushAchievements } from './api'
import { audio } from './audio/audio'
import { SURVIVAL_ITEMS } from './items'
import { G, live, toast, useGame } from './state'

// Succès : débloqués en fin de partie (ou en cours), gardés en local et dans le compte.

export interface Achievement {
  code: string
  name: string
  desc: string
  icon: string
}

export const ACHIEVEMENTS: Achievement[] = [
  { code: 'rescued', name: 'Retour sur Terre', desc: 'Terminer la mission.', icon: '🌍' },
  { code: 'no_hint', name: 'Esprit d’ingénieur', desc: 'Terminer sans aucun indice.', icon: '🧠' },
  { code: 'perfect', name: 'Sans faute', desc: 'Terminer sans aucune erreur.', icon: '🎯' },
  { code: 'speed', name: 'Fusée', desc: 'Terminer en moins de 10 minutes.', icon: '⚡' },
  { code: 'collector', name: 'Prévoyant', desc: 'Ramasser les 11 objets de survie.', icon: '🎒' },
  { code: 'no_faint', name: 'Souffle long', desc: 'Terminer sans t’évanouir.', icon: '🫁' },
  { code: 'keeper', name: 'La découverte', desc: 'Ramener les échantillons de Maya.', icon: '🧪' },
  { code: 'survivor', name: 'Survivant', desc: 'Terminer en difficulté Survie.', icon: '🔥' },
  { code: 'sealed', name: 'Bricoleur', desc: 'Colmater une micro-fuite au ruban adhésif.', icon: '🩹' },
  { code: 'cartographer', name: 'Cartographe', desc: 'Explorer toute la station Orion (zones 1 et 2).', icon: '🗺️' },
]

const KEY = () => `cosmotrap.ach.${G().user?.id ?? 'guest'}`

export function localAchievements(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY()) || '[]')
  } catch {
    return []
  }
}

export async function allAchievements(): Promise<string[]> {
  const remote = await fetchAchievements()
  return [...new Set([...localAchievements(), ...(remote ?? [])])]
}

/** débloque un succès (bannière + son), s'il ne l'est pas déjà */
export function unlock(code: string) {
  const have = localAchievements()
  if (have.includes(code)) return false
  const a = ACHIEVEMENTS.find((x) => x.code === code)
  if (!a) return false
  try {
    localStorage.setItem(KEY(), JSON.stringify([...have, code]))
  } catch {
    /* stockage indisponible */
  }
  pushAchievements([code])
  live.banner = { title: 'Succès débloqué', sub: `${a.icon} ${a.name}`, t: performance.now() + 900 }
  audio.sting('discover')
  toast(`Succès : ${a.name} — ${a.desc}`, 'good', 4500)
  return true
}

/** vérifications en fin de partie réussie */
export function checkEndAchievements() {
  const s = G()
  const got: string[] = []
  const t = s.playTime + s.penalty
  const ok = (c: string, cond: boolean) => cond && unlock(c) && got.push(c)
  ok('rescued', true)
  ok('no_hint', s.hintsUsed === 0)
  ok('perfect', s.errors === 0)
  ok('speed', t < 600)
  ok('no_faint', s.faints === 0)
  ok('keeper', s.choice === 'keep')
  ok('survivor', s.difficulty === 'survival')
  ok('collector', SURVIVAL_ITEMS.every((k) => (s.inv[k] ?? 0) > 0 || (k === 'tape' && localAchievements().includes('sealed'))))
  return got
}

export function checkCollector() {
  const inv = G().inv
  if (SURVIVAL_ITEMS.every((k) => (inv[k] ?? 0) > 0)) unlock('collector')
}

/** toute la station explorée (zones 1 et 2 : cases de sol) */
export function checkCartographer(grids: { zone: number; grid: string[] }[]) {
  for (const { zone, grid } of grids)
    for (let z = 0; z < grid.length; z++)
      for (let x = 0; x < grid[z].length; x++) if (grid[z][x] === '.' && !live.explored.has(`${zone}:${x},${z}`)) return
  unlock('cartographer')
}

export const useAch = () => useGame((s) => s.user)
