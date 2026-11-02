import { G, normalizeSave, setCloudSave, useGame, type SaveFile } from './state'

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
}

export async function me(): Promise<{ user: User | null; google: boolean }> {
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
export const googleLogin = async (credential: string) => signedIn(await req('auth.php?action=google', { method: 'POST', body: JSON.stringify({ credential }) }))

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
  if (inflight || !G().user) return
  inflight = true
  try {
    await req('save.php', { method: 'POST', body: JSON.stringify({ save: d }) })
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
}

export const leaderboard = () => req<{ rows: Row[] }>('leaderboard.php')

export async function submitScore(p: { timeMs: number; hints: number; errors: number; score: number; character: string; ending: string }) {
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
