import { G, normalizeSave, saveBlocked, setCloudDelete, setCloudSave, useGame, type SaveFile } from './state'

// Client de l'API PHP (public/api) : comptes, sauvegarde dans le cloud, classement.

const TOKEN_KEY = 'cosmotrap.token'
const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? '/api'

export const token = {
  get: () => {
    try {
      return localStorage.getItem(TOKEN_KEY)
    } catch {
      return null
    }
  },
  set: (t: string | null) => {
    try {
      if (t) localStorage.setItem(TOKEN_KEY, t)
      else localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* stockage indisponible */
    }
  },
}

export class ApiError extends Error {
  constructor(
    msg: string,
    public status: number,
  ) {
    super(msg)
  }
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const t = token.get()
  let r: Response
  try {
    r = await fetch(`${BASE}/${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}), ...(init.headers ?? {}) },
    })
  } catch {
    throw new ApiError('Serveur injoignable.', 0)
  }
  const text = await r.text()
  let j: any = null
  try {
    j = JSON.parse(text)
  } catch {
    throw new ApiError('Serveur injoignable.', 0)
  }
  if (!r.ok) throw new ApiError(j?.error ?? 'Erreur serveur.', r.status)
  return j as T
}

export interface User {
  id: number
  email: string
  pseudo: string
  character?: string
}

export async function me(): Promise<{ user: User | null }> {
  return req('auth.php?action=me')
}

function signedIn(r: { token: string; user: User }) {
  token.set(r.token)
  useGame.setState({ user: r.user, offline: false })
  return r.user
}

export const login = async (email: string, password: string) => signedIn(await req('auth.php?action=login', { method: 'POST', body: JSON.stringify({ email, password }) }))
export const register = async (email: string, pseudo: string, password: string) =>
  signedIn(await req('auth.php?action=register', { method: 'POST', body: JSON.stringify({ email, pseudo, password }) }))

export async function updateProfile(p: { pseudo?: string; email?: string; character?: string }) {
  const r = await req<{ user: User }>('auth.php?action=profile', { method: 'POST', body: JSON.stringify(p) })
  useGame.setState({ user: r.user })
  return r.user
}

export const changePassword = (current: string, password: string) => req('auth.php?action=password', { method: 'POST', body: JSON.stringify({ current, password }) })
export const forgotPassword = (email: string) => req('auth.php?action=forgot', { method: 'POST', body: JSON.stringify({ email }) })
export async function resetPassword(token: string, password: string) {
  const r = await req<{ token: string }>('auth.php?action=reset', { method: 'POST', body: JSON.stringify({ token, password }) })
  setToken(r.token)
  return r
}
const setToken = (t: string) => token.set(t)

export async function logout() {
  try {
    await req('auth.php?action=logout', { method: 'POST', body: '{}' })
  } catch {
    /* déjà déconnecté */
  }
  token.set(null)
  useGame.setState({ user: null, screen: 'login' })
}

// ——— sauvegarde dans le compte ———
let inflight = false
export async function pushSave(d: unknown) {
  const stamp = (d as { savedAt?: number }).savedAt
  if (inflight || !G().user || saveBlocked(stamp)) return
  inflight = true
  try {
    await req('save.php', { method: 'POST', body: JSON.stringify({ save: d }) })
    if (saveBlocked(stamp)) await deleteCloudSave()
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) useGame.setState({ user: null })
  } finally {
    inflight = false
  }
}
setCloudSave(pushSave)

export async function fetchCloudSave(): Promise<SaveFile | null> {
  if (!G().user) return null
  try {
    const r = await req<{ save: unknown; updatedAt: number | null }>('save.php')
    const s = normalizeSave(r.save)
    if (s && r.updatedAt && !s.savedAt) s.savedAt = r.updatedAt * 1000
    return s
  } catch {
    return null
  }
}

export async function deleteCloudSave() {
  if (!G().user) return
  try {
    await req('save.php', { method: 'DELETE' })
  } catch {
    /* rien */
  }
}
setCloudDelete(() => void deleteCloudSave())

// ——— classement ———
export interface Row {
  pseudo: string
  timeMs: number
  hints: number
  errors: number
  score: number
  character: string
  ending: string
  date: number
  me: boolean
  avatar?: string
  difficulty?: string
}

export const leaderboard = (difficulty = 'astronaut', period: 'all' | 'week' = 'all', map?: 'base' | 'station') =>
  req<{ rows: Row[]; myRank: number | null }>(`leaderboard.php?difficulty=${difficulty}&period=${period}${map ? `&map=${map}` : ''}`)

export async function fetchGhost(difficulty: string) {
  try {
    const r = await req<{ ghost: { pseudo: string; timeMs: number; track: number[] } | null }>(`leaderboard.php?ghost=1&difficulty=${difficulty}`)
    return r.ghost
  } catch {
    return null
  }
}

export async function fetchAchievements(): Promise<string[] | null> {
  if (!G().user) return null
  try {
    const r = await req<{ achievements: { code: string }[] }>('achievements.php')
    return r.achievements.map((a) => a.code)
  } catch {
    return null
  }
}

export async function pushAchievements(codes: string[]) {
  if (!G().user || !codes.length) return
  try {
    await req('achievements.php', { method: 'POST', body: JSON.stringify({ codes }) })
  } catch {
    /* hors ligne : gardé en local */
  }
}

export async function submitScore(p: { timeMs: number; hints: number; errors: number; score: number; character: string; ending: string; difficulty: string; ghost?: number[]; map?: string }) {
  if (!G().user) return null
  try {
    const r = await req<{ rank: number }>('leaderboard.php', { method: 'POST', body: JSON.stringify(p) })
    return r.rank
  } catch {
    return null
  }
}

export function fmtTime(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
