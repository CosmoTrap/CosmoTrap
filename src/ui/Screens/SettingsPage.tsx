import { useEffect, useState } from 'react'
import { ApiError, changePassword, logout, updateProfile } from '../../game/api'
import { audio } from '../../game/audio/audio'
import { toggleFullscreen, useGame, type Quality } from '../../game/state'
import { fr } from '../../i18n/fr'
import { setLanguage } from '../../i18n'
import { ACTION_ORDER, DEFAULT_KEYS } from '../../player/input'
import { KeyRow, update } from './Settings'

// Page « Configuration du terminal » : Profil, Jeu, Touches, Audio (maquettes Paramètres).

const S = fr.settings2
const CHAR_ORDER = ['ines', 'kenji', 'leo', 'maya', 'nova', 'sam']

function Toggle({ on, onChange, id }: { on: boolean; onChange: (v: boolean) => void; id?: string }) {
  return <button type="button" data-testid={id} className={`sp-toggle ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onChange(!on)} />
}

function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="sp-seg">
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  )
}

function Range({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const pct = ((value - min) / (max - min)) * 100
  return <input className="sp-range" type="range" min={min} max={max} step={step} value={value} style={{ ['--p' as string]: `${pct}%` }} onChange={(e) => onChange(+e.target.value)} />
}

function Row({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="sp-row">
      <div>
        <b>{title}</b>
        {desc && <small>{desc}</small>}
      </div>
      <div className="sp-ctl">{children}</div>
    </div>
  )
}

function Person({ color }: { color?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke={color ?? 'currentColor'} strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 21c1-4.2 4-6.3 7.5-6.3s6.5 2.1 7.5 6.3" />
    </svg>
  )
}

function Profile() {
  const user = useGame((s) => s.user)
  const firstRun = useGame((s) => s.firstRun)
  const current = useGame((s) => s.user?.character ?? s.settings.character)
  const [pseudo, setPseudo] = useState(user?.pseudo ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [pw, setPw] = useState<null | { cur: string; a: string; b: string }>(null)
  useEffect(() => {
    setPseudo(user?.pseudo ?? '')
    setEmail(user?.email ?? '')
  }, [user])
  const pick = async (id: string) => {
    audio.sfx('click')
    update({ character: id })
    if (user) {
      try {
        await updateProfile({ character: id })
      } catch (e) {
        setMsg({ ok: false, t: (e as Error).message })
      }
    }
  }
  const save = async () => {
    try {
      await updateProfile({ pseudo, email })
      setMsg({ ok: true, t: S.saved })
    } catch (e) {
      setMsg({ ok: false, t: (e as ApiError).message })
    }
  }
  const savePw = async () => {
    if (!pw) return
    if (pw.a !== pw.b) return setMsg({ ok: false, t: fr.auth.mismatch })
    try {
      await changePassword(pw.cur, pw.a)
      setPw(null)
      setMsg({ ok: true, t: S.pwChanged })
    } catch (e) {
      setMsg({ ok: false, t: (e as ApiError).message })
    }
  }
  const c = fr.characters[current]
  const dirty = !!user && (pseudo !== user.pseudo || email !== user.email)
  return (
    <>
      <header className="sp-panel-head">
        <h2>{S.profileTitle}</h2>
        <span className="sp-mono">
          {S.selection} · {CHAR_ORDER.indexOf(current) + 1} / 6
        </span>
      </header>
      {firstRun && <div className="sp-banner">{S.firstRun}</div>}
      <div className="sp-chars">
        <div className="sp-preview" style={{ borderColor: c.color }} data-testid="char-preview">
          <div className="sp-preview-ico">
            <Person color={c.color} />
          </div>
          <b style={{ color: c.color }}>{c.name.toUpperCase()}</b>
          <small>{c.role}</small>
          <div className="sp-ability">
            <span>{c.ability}</span>
            {c.abilityDesc}
          </div>
        </div>
        <div className="sp-grid">
          {CHAR_ORDER.map((id) => {
            const ch = fr.characters[id]
            return (
              <button key={id} type="button" data-testid={`char-${id}`} className={`sp-card ${id === current ? 'on' : ''}`} onClick={() => pick(id)} title={`${ch.ability} — ${ch.abilityDesc}`}>
                <Person color={id === current ? '#ff6b35' : undefined} />
                <span>{ch.name}</span>
                <small>{ch.ability}</small>
              </button>
            )
          })}
        </div>
      </div>
      {user ? (
        <>
          <div className="sp-fields">
            <label>
              <span className="sp-mono">{fr.auth.pseudo}</span>
              <input className="au-input" value={pseudo} onChange={(e) => setPseudo(e.target.value)} minLength={3} maxLength={16} />
            </label>
            <label>
              <span className="sp-mono">{fr.auth.email}</span>
              <input className="au-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
          </div>
          <div className="sp-actions">
            {!pw && (
              <button type="button" className="au-link sp-strong" onClick={() => setPw({ cur: '', a: '', b: '' })}>
                {S.changePw}
              </button>
            )}
            {dirty && (
              <button type="button" className="btn primary" onClick={save}>
                {S.save}
              </button>
            )}
          </div>
          {pw && (
            <div className="sp-fields three">
              <input className="au-input" type="password" placeholder={S.pwCurrent} value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} />
              <input className="au-input" type="password" placeholder={fr.auth.passwordMin} value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} />
              <input className="au-input" type="password" placeholder={fr.auth.confirmPh} value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} />
              <div className="sp-actions">
                <button type="button" className="btn primary" onClick={savePw}>
                  {S.save}
                </button>
                <button type="button" className="btn ghost" onClick={() => setPw(null)}>
                  {fr.menu.back}
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="sp-note">{S.guestNote}</p>
      )}
      {msg && <div className={msg.ok ? 'au-info' : 'au-err'}>{msg.t}</div>}
      {firstRun && (
        <button type="button" className="au-submit sp-continue" data-testid="first-run-done" onClick={() => useGame.setState({ screen: 'title', firstRun: false })}>
          {S.firstRunBtn} <span aria-hidden>→</span>
        </button>
      )}
    </>
  )
}

function Game() {
  const s = useGame((st) => st.settings)
  const [fs, setFs] = useState(!!document.fullscreenElement)
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])
  return (
    <>
      <header className="sp-panel-head">
        <h2>{S.game}</h2>
      </header>
      <div className="sp-section">{S.part}</div>
      <Row title={S.help} desc={S.helpDesc}>
        <Seg value={s.help} options={[['recrue', S.helpRecrue], ['pilote', S.helpPilote], ['commandant', S.helpCommandant]]} onChange={(v) => update({ help: v })} />
      </Row>
      <Row title={S.chrono} desc={S.chronoDesc}>
        <Toggle id="toggle-chrono" on={s.showChrono} onChange={(v) => update({ showChrono: v })} />
      </Row>
      <Row title={S.subs} desc={S.subsDesc}>
        <Toggle on={s.subtitles} onChange={(v) => update({ subtitles: v })} />
      </Row>
      <Row title={S.autosave} desc={S.autosaveDesc}>
        <Toggle on={s.autosave} onChange={(v) => update({ autosave: v })} />
      </Row>
      <Row title={S.lang} desc={S.langDesc}>
        <Seg
          value={s.lang}
          options={[
            ['fr', 'Français'],
            ['en', 'English'],
          ]}
          onChange={(v) => {
            update({ lang: v })
            setLanguage(v)
          }}
        />
      </Row>
      <div className="sp-section">{S.display}</div>
      <Row title={S.quality} desc={S.qualityDesc}>
        <Seg value={s.quality} options={(['low', 'medium', 'high', 'ultra'] as Quality[]).map((q) => [q, S.qualities[q]] as [Quality, string])} onChange={(v) => update({ quality: v })} />
      </Row>
      <Row title={S.brightness} desc={S.brightnessDesc}>
        <Range value={s.brightness} min={0.6} max={1.6} step={0.02} onChange={(v) => update({ brightness: v })} />
      </Row>
      <Row title={S.sensitivity} desc={S.sensitivityDesc}>
        <Range value={s.sensitivity} min={0.2} max={3} step={0.05} onChange={(v) => update({ sensitivity: v })} />
      </Row>
      <Row title={S.fov} desc={S.fovDesc(s.fov)}>
        <Range value={s.fov} min={70} max={110} step={1} onChange={(v) => update({ fov: v })} />
      </Row>
      <Row title={S.fullscreen} desc={S.fullscreenDesc}>
        <Toggle on={fs} onChange={() => toggleFullscreen()} />
      </Row>
      <Row title={S.resolution} desc={S.resolutionDesc}>
        <Seg value={s.resolution} options={(['auto', 720, 1080, 1440, 2160] as const).map((r) => [r, r === 'auto' ? 'Auto' : r === 2160 ? '4K' : `${r}p`] as ['auto' | number, string])} onChange={(v) => update({ resolution: v })} />
      </Row>
      <div className="sp-section">{S.advanced}</div>
      <Row title={S.trackpad} desc={S.trackpadDesc}>
        <Toggle on={s.trackpadLook} onChange={(v) => update({ trackpadLook: v })} />
      </Row>
      <Row title={S.invertY}>
        <Toggle on={s.invertY} onChange={(v) => update({ invertY: v })} />
      </Row>
      <Row title={S.ghost} desc={S.ghostDesc}>
        <Toggle on={s.ghost} onChange={(v) => update({ ghost: v })} />
      </Row>
      <Row title={S.colorblind}>
        <Toggle on={s.colorblind} onChange={(v) => update({ colorblind: v })} />
      </Row>
      <Row title={S.fps}>
        <Toggle on={s.showFps} onChange={(v) => update({ showFps: v })} />
      </Row>
    </>
  )
}

function Keys() {
  return (
    <>
      <header className="sp-panel-head">
        <h2>{S.keys}</h2>
        <button type="button" className="au-link" onClick={() => update({ keys: DEFAULT_KEYS })}>
          {S.defaults}
        </button>
      </header>
      <p className="sp-note">{S.keysNote}</p>
      <div className="sp-keys">
        {ACTION_ORDER.map((a) => (
          <KeyRow key={a} a={a} />
        ))}
      </div>
      <div className="sp-section">{S.pad}</div>
      {S.padRows.map(([a, b]) => (
        <Row key={a} title={a}>
          <span className="sp-mono">{b}</span>
        </Row>
      ))}
    </>
  )
}

function Audio() {
  const s = useGame((st) => st.settings)
  return (
    <>
      <header className="sp-panel-head">
        <h2>{S.audio}</h2>
      </header>
      {(['music', 'sfx', 'voice'] as const).map((k) => (
        <Row key={k} title={fr.settings[k]} desc={`${Math.round(s[k] * 100)} %`}>
          <Range value={s[k]} min={0} max={1} step={0.01} onChange={(v) => update({ [k]: v })} />
        </Row>
      ))}
      <Row title={S.browserVoice} desc={S.browserVoiceDesc}>
        <Toggle on={s.browserVoice} onChange={(v) => update({ browserVoice: v })} />
      </Row>
    </>
  )
}

export function SettingsPage({ overlay, onClose }: { overlay?: boolean; onClose?: () => void }) {
  const tab = useGame((s) => s.settingsTab)
  const user = useGame((s) => s.user)
  const close = () => (overlay ? onClose?.() : useGame.setState({ screen: 'title', firstRun: false }))
  const tabs = [S.profile, S.game, S.keys, S.audio]
  return (
    <div className={`sp ${overlay ? 'overlay' : ''}`} data-testid="settings">
      <header className="sp-head">
        <button type="button" className="sp-back" onClick={close} aria-label={fr.menu.back}>
          ←
        </button>
        <div>
          <div className="au-kicker">{S.kicker}</div>
          <h1>{S.title}</h1>
        </div>
        <img className="sp-logo" src="/logo/badge-dark.png" alt="" />
      </header>
      <div className="sp-body">
        <nav className="sp-nav">
          {tabs.map((t, i) => (
            <button key={t} type="button" data-testid={`stab-${i}`} className={tab === i ? 'on' : ''} onClick={() => useGame.setState({ settingsTab: i })}>
              <span>{String(i + 1).padStart(2, '0')}</span>
              {t}
            </button>
          ))}
          <div className="sp-grow" />
          {user && !overlay && (
            <button type="button" className="sp-logout" onClick={() => logout()}>
              ⎋ {fr.auth.logout}
            </button>
          )}
        </nav>
        <section className="sp-panel">{tab === 0 ? <Profile /> : tab === 1 ? <Game /> : tab === 2 ? <Keys /> : <Audio />}</section>
      </div>
    </div>
  )
}
