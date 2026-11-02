import { useEffect, useRef, useState } from 'react'
import { ApiError, googleLogin, login, me, register, token } from '../../game/api'
import { audio } from '../../game/audio/audio'
import { useGame } from '../../game/state'
import { fr } from '../../i18n/fr'

// Page de connexion / inscription (maquette « Bienvenue sur CosmoTrap »).
const A = fr.auth
const GOOGLE_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

function Stars() {
  const stars = useRef(
    Array.from({ length: 70 }, () => ({ x: Math.random() * 100, y: Math.random() * 62, s: Math.random() < 0.12 ? 14 : 3 + Math.random() * 3, d: Math.random() * 4 })),
  ).current
  return (
    <svg className="login-stars" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
      {stars.map((st, i) =>
        st.s > 10 ? (
          <path key={i} d={`M${st.x} ${st.y - 1.2}L${st.x + 0.25} ${st.y - 0.25}L${st.x + 1.2 * 0.6} ${st.y}L${st.x + 0.25} ${st.y + 0.25}L${st.x} ${st.y + 1.2}L${st.x - 0.25} ${st.y + 0.25}L${st.x - 0.72} ${st.y}L${st.x - 0.25} ${st.y - 0.25}Z`} fill="#fff" style={{ animationDelay: `${st.d}s` }} className="twinkle" />
        ) : (
          <circle key={i} cx={st.x} cy={st.y} r={st.s / 40} fill="#fff" opacity={0.7} className="twinkle" style={{ animationDelay: `${st.d}s` }} />
        ),
      )}
    </svg>
  )
}

function Planet() {
  return (
    <svg className="login-planet" viewBox="0 0 120 80" aria-hidden>
      <defs>
        <radialGradient id="pl" cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#e9e2d6" />
          <stop offset="1" stopColor="#a49c8f" />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="42" rx="52" ry="11" fill="none" stroke="#8d8577" strokeWidth="4" transform="rotate(-14 60 42)" />
      <circle cx="60" cy="40" r="24" fill="url(#pl)" />
      <path d="M8 52 A52 11 0 0 0 112 30" fill="none" stroke="#c9c1b3" strokeWidth="4" transform="rotate(-14 60 42)" />
    </svg>
  )
}

function MoonGround() {
  return (
    <svg className="login-ground" viewBox="0 0 1440 360" preserveAspectRatio="none" aria-hidden>
      <path d="M0 150 C 240 90, 420 120, 620 140 S 1000 70, 1440 120 L1440 360 L0 360Z" fill="#cfcac0" />
      <path d="M0 210 C 300 170, 560 200, 820 190 S 1200 150, 1440 180 L1440 360 L0 360Z" fill="#dcd8cf" />
      {[
        [220, 250, 60, 14],
        [520, 300, 36, 8],
        [1080, 230, 70, 16],
        [1290, 300, 40, 9],
        [760, 330, 90, 16],
        [380, 330, 22, 5],
        [960, 290, 26, 6],
      ].map(([x, y, rx, ry], i) => (
        <g key={i}>
          <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#bdb7ab" />
          <ellipse cx={x + rx * 0.08} cy={y + ry * 0.15} rx={rx * 0.82} ry={ry * 0.7} fill="#c8c2b6" />
        </g>
      ))}
    </svg>
  )
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

export function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const [googleOn, setGoogleOn] = useState(false)
  const gbtn = useRef<HTMLDivElement>(null)

  // reprise de session
  useEffect(() => {
    me()
      .then((r) => {
        setGoogleOn(r.google && !!GOOGLE_ID)
        if (r.user) useGame.setState({ user: r.user, screen: 'title' })
        else if (token.get()) token.set(null)
      })
      .catch(() => setOffline(true))
  }, [])

  // bouton Google (Google Identity Services), seulement si configuré
  useEffect(() => {
    if (!googleOn || !GOOGLE_ID) return
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => {
      const g = (window as any).google
      g?.accounts.id.initialize({
        client_id: GOOGLE_ID,
        callback: async (r: { credential: string }) => {
          try {
            await googleLogin(r.credential)
            useGame.setState({ screen: 'title' })
          } catch (e) {
            setErr((e as Error).message)
          }
        },
      })
      if (gbtn.current) g?.accounts.id.renderButton(gbtn.current, { theme: 'filled_black', shape: 'pill', width: 300, text: 'continue_with', locale: 'fr' })
    }
    document.head.appendChild(s)
  }, [googleOn])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (mode === 'register' && pass !== pass2) return setErr(A.mismatch)
    setBusy(true)
    try {
      if (mode === 'login') await login(email, pass)
      else await register(email, pseudo, pass)
      audio.init()
      useGame.setState({ screen: 'title' })
    } catch (e2) {
      const m = e2 as ApiError
      if (m.status === 0) setOffline(true)
      setErr(m.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login" data-testid="login">
      <Stars />
      <Planet />
      <MoonGround />
      <img className="login-astro" src="/characters/leo.png" alt="" />
      <form className="login-card" onSubmit={submit}>
        <img className="login-logo" src="/logo/badge.png" alt="Cosmotrap" />
        <h1>{A.welcome}</h1>
        {googleOn ? (
          <div ref={gbtn} className="g-holder" />
        ) : (
          <button type="button" className="login-google" onClick={() => setErr(A.googleOff)}>
            <GoogleG /> {A.google}
          </button>
        )}
        <div className="login-or">
          <span>{A.or}</span>
        </div>
        {mode === 'register' && (
          <label className="login-field">
            <svg viewBox="0 0 24 24" aria-hidden>
              <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="1.8" />
              <path d="M4 21c1-4 15-4 16 0" fill="none" stroke="currentColor" strokeWidth="1.8" />
            </svg>
            <input data-testid="pseudo" placeholder={A.pseudo} value={pseudo} onChange={(e) => setPseudo(e.target.value)} required minLength={2} maxLength={20} autoComplete="nickname" />
          </label>
        )}
        <label className="login-field">
          <svg viewBox="0 0 24 24" aria-hidden>
            <rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="m3 7 9 6 9-6" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
          <input data-testid="email" type="email" placeholder={A.email} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
        </label>
        <label className="login-field">
          <svg viewBox="0 0 24 24" aria-hidden>
            <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          <input data-testid="password" type="password" placeholder={A.password} value={pass} onChange={(e) => setPass(e.target.value)} required minLength={mode === 'register' ? 8 : 1} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        </label>
        {mode === 'register' && (
          <label className="login-field">
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            <input data-testid="password2" type="password" placeholder={A.confirm} value={pass2} onChange={(e) => setPass2(e.target.value)} required minLength={8} autoComplete="new-password" />
          </label>
        )}
        {err && <div className="login-err">{err}</div>}
        <button className="login-submit" data-testid="submit" disabled={busy}>
          {busy ? '…' : mode === 'login' ? A.login : A.register}
        </button>
        <p className="login-switch">
          {mode === 'login' ? A.toRegister : A.toLogin}{' '}
          <button
            type="button"
            data-testid="switch-mode"
            onClick={() => {
              setErr(null)
              setMode(mode === 'login' ? 'register' : 'login')
            }}
          >
            {mode === 'login' ? A.toRegisterLink : A.toLoginLink}
          </button>
        </p>
        {offline && (
          <button
            type="button"
            className="login-guest"
            data-testid="guest"
            onClick={() => {
              audio.init()
              useGame.setState({ user: null, offline: true, screen: 'title' })
            }}
          >
            {A.offline} {A.guest}
          </button>
        )}
      </form>
    </div>
  )
}
