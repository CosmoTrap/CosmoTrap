// Niveaux de difficulté : chrono, consommation des ressources, éclairage, pénalités, imprévus.
export type Difficulty = 'explorer' | 'astronaut' | 'survival'

export interface DiffCfg {
  name: string
  desc: string
  /** limite de temps (s) */
  time: number
  /** multiplicateur de consommation (O₂, lampe, eau) */
  drain: number
  /** multiplicateur de l'éclairage des pièces */
  light: number
  /** multiplicateur des pénalités de temps */
  penalty: number
  /** intervalle moyen entre deux imprévus (s), 0 = aucun */
  events: number
  /** bonus de score */
  score: number
}

export const DIFFICULTY: Record<Difficulty, DiffCfg> = {
  explorer: { name: 'Explorateur', desc: '40 min, ressources économes, pièces mieux éclairées, peu d’imprévus.', time: 40 * 60, drain: 0.6, light: 1.35, penalty: 0.5, events: 240, score: 0.8 },
  astronaut: { name: 'Astronaute', desc: '30 min, l’expérience prévue. Coupures et fuites de temps en temps.', time: 30 * 60, drain: 1, light: 1, penalty: 1, events: 140, score: 1 },
  survival: { name: 'Survie', desc: '22 min, ressources qui fondent, station presque noire, imprévus fréquents.', time: 22 * 60, drain: 1.35, light: 0.55, penalty: 1.5, events: 75, score: 1.4 },
}

export const DIFF_ORDER: Difficulty[] = ['explorer', 'astronaut', 'survival']
