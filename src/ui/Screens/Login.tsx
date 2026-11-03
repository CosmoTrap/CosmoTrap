import { useEffect, useRef, useState } from 'react'
import { ApiError, forgotPassword, googleLogin, login, me, register, resetPassword, token } from '../../game/api'
import { audio } from '../../game/audio/audio'
import { useGame } from '../../game/state'
import { fr } from '../../i18n/fr'

// Écrans de connexion / inscription (maquettes « Accès équipage » et « Nouvelle recrue »).
// Le fond est la scène 3D de la base lunaire (LunarScene), rendue derrière.
const A = fr.auth
const GOOGLE_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

function GoogleG() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/** force du mot de passe : 0 à 4 segments */
function strength(p: string) {
  let s = 0
  if (p.length >= 8) s++
  if (p.length >= 12) s++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++
  return Math.min(4, s)
}

function Field({ label, aside, children, hint }: { label: string; aside?: React.ReactNode; children: React.ReactNode; hint?: string }) {
  return (
    <div className="au-field">
      <div className="au-label">
        <span>{label}</span>
        {aside}
      </div>
      {children}
      {hint && <div className="au-hint">{hint}</div>}
    </div>
  )
}

type Mode = 'login' | 'register' | 'forgot' | 'reset'

export function Login() {
  const resetToken = new URLSearchParams(location.search).get('reset')
  const [mode, setMode] = useState<Mode>(resetToken ? 'reset' : 'login')
  const [email, setEmail] = useState('')
  const [pseudo, setPseudo] = useState('')
  const [pass, setPass] = useState('')
  const [pass2, setPass2] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const [googleOn, setGoogleOn] = useState(false)
  const gbtn = useRef<HTMLDivElement>(null)

  useEffect(() => {
    me()
      .then((r) => {
        setGoogleOn(r.google && !!GOOGLE_ID)
        if (r.user && !resetToken) useGame.setState({ user: r.user, screen: 'title' })
        else if (token.get() && !r.user) token.set(null)
      })
      .catch(() => setOffline(true))
  }, [])

  useEffect(() => {
    if (!googleOn || !GOOGLE_ID || mode !== 'login') return
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
      if (gbtn.current) g?.accounts.id.renderButton(gbtn.current, { theme: 'outline', shape: 'rectangular', width: 460, text: 'continue_with', locale: 'fr' })
    }
    document.head.appendChild(s)
  }, [googleOn, mode])

  const go = (m: Mode) => {
    setErr(null)
    setInfo(null)
    setMode(m)
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setInfo(null)
    if ((mode === 'register' || mode === 'reset') && pass !== pass2) return setErr(A.mismatch)
    setBusy(true)
    try {
      if (mode === 'login') {
        await login(email, pass)
        audio.init()
        useGame.setState({ screen: 'title' })
      } else if (mode === 'register') {
        await register(email, pseudo, pass)
        audio.init()
        // étape 02 : choisir son personnage
        useGame.setState({ screen: 'settings', settingsTab: 0, firstRun: true })
      } else if (mode === 'forgot') {
        await forgotPassword(email)
        setInfo(A.forgotSent)
      } else {
        await resetPassword(resetToken ?? '', pass)
        history.replaceState(null, '', location.pathname)
        const r = await me()
        useGame.setState({ user: r.user, screen: 'title' })
      }
    } catch (e2) {
      const m = e2 as ApiError
      if (m.status === 0) setOffline(true)
      setErr(m.message)
    } finally {
      setBusy(false)
    }
  }

  const reg = mode === 'register'
  const st = strength(pass)

  return (
    <div className="au" data-testid="login">
      <div className="au-left">
        {reg || mode === 'forgot' || mode === 'reset' ? (
          <button type="button" className="au-back" onClick={() => go('login')}>
            ← {A.backToLogin}
          </button>
        ) : (
          <div className="au-mono au-top">{A.secure}</div>
        )}
        <img className={`au-logo ${reg ? 'small' : ''}`} src="/logo/badge-dark.png" alt="Cosmotrap" />
        {reg ? (
          <>
            <h1 className="au-title">{A.registerTitle}</h1>
            <ol className="au-steps">
              {A.steps.map((s, i) => (
                <li key={s} className={i === 0 ? 'on' : ''}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  {s}
                </li>
              ))}
            </ol>
            <div className="au-mono au-bottom">{A.matricule}</div>
          </>
        ) : (
          <>
            <h1 className="au-title">
              {A.heroA}
              <br />
              <em>{A.heroB}</em>
            </h1>
            <p className="au-sub">{A.heroSub}</p>
            <div className="au-mono au-bottom au-stats">
              <span>{A.statO2}</span>
              <span>{A.statT}</span>
              <span>{A.statG}</span>
            </div>
          </>
        )}
      </div>

      <form className="au-card" onSubmit={submit}>
        <div className="au-kicker">{reg ? A.kickerRegister : mode === 'login' ? A.kickerLogin : A.kickerForgot}</div>
        <h2>{reg ? A.register : mode === 'login' ? A.login : mode === 'forgot' ? A.forgotTitle : A.resetTitle}</h2>

        {mode === 'login' &&
          (googleOn ? (
            <div ref={gbtn} className="au-google-holder" />
          ) : (
            <button type="button" className="au-google" onClick={() => setErr(A.googleOff)}>
              <GoogleG /> {A.google}
            </button>
          ))}
        {mode === 'login' && (
          <div className="au-or">
            <span>{A.or}</span>
          </div>
        )}

        {reg && (
          <Field label={A.pseudo} hint={A.pseudoHint}>
            <input data-testid="pseudo" className="au-input" placeholder="Astro" value={pseudo} onChange={(e) => setPseudo(e.target.value)} required minLength={3} maxLength={16} autoComplete="nickname" />
          </Field>
        )}
        {mode !== 'reset' && (
          <Field label={mode === 'login' ? A.emailOrPseudo : A.email}>
            <input data-testid="email" className="au-input" type={mode === 'login' ? 'text' : 'email'} placeholder="astro@cosmotrap.fr" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete={mode === 'login' ? 'username' : 'email'} />
          </Field>
        )}
        {mode !== 'forgot' && (
          <Field
            label={A.password}
            aside={
              mode === 'login' && (
                <button type="button" className="au-link" onClick={() => go('forgot')}>
                  {A.forgot}
                </button>
              )
            }
          >
            <input data-testid="password" className="au-input" type="password" placeholder={reg || mode === 'reset' ? A.passwordMin : '••••••••'} value={pass} onChange={(e) => setPass(e.target.value)} required minLength={reg || mode === 'reset' ? 8 : 1} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            {(reg || mode === 'reset') && (
              <div className="au-strength">
                {[0, 1, 2, 3].map((i) => (
                  <i key={i} className={i < st ? 'on' : ''} />
                ))}
              </div>
            )}
          </Field>
        )}
        {(reg || mode === 'reset') && (
          <Field label={A.confirm}>
            <input data-testid="password2" className="au-input" type="password" placeholder={A.confirmPh} value={pass2} onChange={(e) => setPass2(e.target.value)} required minLength={8} autoComplete="new-password" />
          </Field>
        )}

        {err && <div className="au-err">{err}</div>}
        {info && <div className="au-info">{info}</div>}
        <button className="au-submit" data-testid="submit" disabled={busy}>
          {busy ? '…' : reg ? A.registerBtn : mode === 'login' ? A.loginBtn : mode === 'forgot' ? A.forgotBtn : A.resetBtn} <span aria-hidden>→</span>
        </button>
        {mode !== 'forgot' && mode !== 'reset' && (
          <p className="au-switch">
            {reg ? A.toLogin : A.toRegister}{' '}
            <button type="button" data-testid="switch-mode" onClick={() => go(reg ? 'login' : 'register')}>
              {reg ? A.toLoginLink : A.toRegisterLink}
            </button>
          </p>
        )}
        {offline && (
          <button
            type="button"
            className="au-guest"
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
