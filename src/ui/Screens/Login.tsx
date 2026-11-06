import { useEffect, useState } from 'react'
import { ApiError, forgotPassword, login, me, register, resetPassword, token } from '../../game/api'
import { audio } from '../../game/audio/audio'
import { useGame } from '../../game/state'
import { fr } from '../../i18n/fr'
import { Stage } from './Stage'

// Écrans de connexion / inscription (maquettes 01 « Accès équipage » et 02 « Nouvelle recrue »).
const A = fr.auth
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
    <div className="x-field">
      <div className="x-label">
        <span>{label}</span>
        {aside}
      </div>
      {children}
      {hint && <div className="x-hint">{hint}</div>}
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

  useEffect(() => {
    me()
      .then((r) => {
        if (r.user && !resetToken) useGame.setState({ user: r.user, screen: 'title' })
        else if (token.get() && !r.user) token.set(null)
      })
      .catch(() => setOffline(true))
  }, [])

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
        useGame.setState({ screen: 'settings', menuBack: 'title', settingsTab: 0, firstRun: true })
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
    <Stage testId="login">
      <div className={`au-side ${reg ? 'reg' : ''}`}>
        {reg || mode === 'forgot' || mode === 'reset' ? (
          <button type="button" className="au-back" onClick={() => go('login')}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
            {A.backToLogin}
          </button>
        ) : (
          <div className="au-secure">{A.secure}</div>
        )}
        <img className="au-logo" src="/logo/badge-dark.png" alt="Cosmotrap" />
        {reg ? (
          <>
            <h1 className="au-title">{A.registerTitle}</h1>
            <ol className="au-steps">
              {A.steps.map((step, i) => (
                <li key={step} className={i === 0 ? 'on' : ''}>
                  <span>{String(i + 1).padStart(2, '0')}</span>
                  {step}
                </li>
              ))}
            </ol>
            <div className="au-bottom">{A.matricule}</div>
          </>
        ) : (
          <>
            <h1 className="au-title">
              {A.heroA}
              <br />
              <em>{A.heroB}</em>
            </h1>
            <p className="au-sub">{A.heroSub}</p>
            <div className="au-bottom au-stats">
              <span>{A.statO2}</span>
              <span>{A.statT}</span>
              <span>{A.statG}</span>
            </div>
          </>
        )}
      </div>

      <form className={`x-panel au-card ${mode}`} onSubmit={submit}>
        <div className="x-kicker">{reg ? A.kickerRegister : mode === 'login' ? A.kickerLogin : A.kickerForgot}</div>
        <h2>{reg ? A.register : mode === 'login' ? A.login : mode === 'forgot' ? A.forgotTitle : A.resetTitle}</h2>

        {reg && (
          <Field label={A.pseudo} hint={A.pseudoHint}>
            <input data-testid="pseudo" className="x-input" placeholder="Astro" value={pseudo} onChange={(e) => setPseudo(e.target.value)} required minLength={3} maxLength={16} autoComplete="nickname" />
          </Field>
        )}
        {mode !== 'reset' && (
          <Field label={mode === 'login' ? A.emailOrPseudo : A.email}>
            <input data-testid="email" className="x-input" type={mode === 'login' ? 'text' : 'email'} placeholder="astro@cosmotrap.fr" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete={mode === 'login' ? 'username' : 'email'} />
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
            <input data-testid="password" className="x-input" type="password" placeholder={reg || mode === 'reset' ? A.passwordMin : '••••••••'} value={pass} onChange={(e) => setPass(e.target.value)} required minLength={reg || mode === 'reset' ? 8 : 1} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
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
            <input data-testid="password2" className="x-input" type="password" placeholder={A.confirmPh} value={pass2} onChange={(e) => setPass2(e.target.value)} required minLength={8} autoComplete="new-password" />
          </Field>
        )}

        {err && <div className="x-err">{err}</div>}
        {info && <div className="x-info">{info}</div>}
        <button className="x-primary au-submit" data-testid="submit" disabled={busy}>
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
    </Stage>
  )
}
