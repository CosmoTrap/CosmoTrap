import { useEffect, useState, type ReactNode } from 'react'
import { ApiError, changePassword, logout, updateProfile } from '../../game/api'
import { audio } from '../../game/audio/audio'
import { toggleFullscreen, useGame, type Quality } from '../../game/state'
import { fr } from '../../i18n/fr'
import { setLanguage } from '../../i18n'
import { detectPadType } from '../../player/gamepad'
import { DEFAULT_KEYS, DEFAULT_PAD, detectKeyLayout, keyName, padButtonName, type Action, type PadAction, type PadType } from '../../player/input'
import { update } from './Settings'
import { closePage, PageHead, Skin, Stage } from './Stage'

// Page « Configuration du terminal » : Profil, Jeu, Touches, Audio (maquettes 04a à 04d).

const S = fr.settings2
const CHAR_ORDER = ['ines', 'kenji', 'leo', 'maya', 'nova', 'sam']

export function Toggle({ on, onChange, id }: { on: boolean; onChange: (v: boolean) => void; id?: string }) {
  return <button type="button" data-testid={id} className={`x-toggle ${on ? 'on' : ''}`} aria-pressed={on} onClick={() => onChange(!on)} />
}

function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: [T, ReactNode][]; onChange: (v: T) => void }) {
  return (
    <div className="x-seg">
      {options.map(([v, l]) => (
        <button key={String(v)} type="button" className={value === v ? 'on' : ''} onClick={() => onChange(v)}>
          {l}
        </button>
      ))}
    </div>
  )
}

export function Range({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const pct = ((value - min) / (max - min)) * 100
  return <input className="x-range" type="range" min={min} max={max} step={step} value={value} style={{ ['--p' as string]: `${pct}%` }} onChange={(e) => onChange(+e.target.value)} />
}

/** sensibilité : curseur logarithmique, 1 au milieu (de 0,2 à 5) */
export function SensitivityRange() {
  const v = useGame((s) => s.settings.sensitivity)
  return <Range value={Math.log(v / 0.2) / Math.log(25)} min={0} max={1} step={0.01} onChange={(p) => update({ sensitivity: +(0.2 * Math.pow(25, p)).toFixed(3) })} />
}

export function Row({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <div className="x-setrow">
      <div>
        <b>{title}</b>
        {desc && <small>{desc}</small>}
      </div>
      <div className="x-ctl">{children}</div>
    </div>
  )
}

const ABILITY_ICON: Record<string, ReactNode> = {
  leo: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  nova: (
    <>
      <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3z" />
    </>
  ),
  kenji: <path d="m8 7-5 5 5 5M16 7l5 5-5 5M14 4l-4 16" />,
  ines: (
    <>
      <circle cx="12" cy="13.5" r="7.5" />
      <path d="M12 9.5v4l2.5 2M9.5 3h5M12 3v3" />
    </>
  ),
  sam: <path d="M12 3c3 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-6.5 6-11z" />,
  maya: <path d="M5 19c0-8 5-14 15-15 0 10-5 15-12 15-1 0-2 0-3-1m0 2 7-8" />,
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
      <header className="x-phead">
        <h2>{S.profileTitle}</h2>
        <span className="x-mono">
          {S.selection} · {CHAR_ORDER.indexOf(current) + 1} / 6
        </span>
      </header>
      {firstRun && <div className="sp-banner">{S.firstRun}</div>}
      <div className="sp-chars">
        <div className="sp-preview" data-testid="char-preview">
          <Skin id={current} />
          <b>{c.name.toUpperCase()}</b>
        </div>
        <div className="sp-grid">
          {CHAR_ORDER.map((id) => {
            const ch = fr.characters[id]
            return (
              <button key={id} type="button" data-testid={`char-${id}`} className={`sp-card ${id === current ? 'on' : ''}`} onClick={() => pick(id)} title={`${ch.ability} — ${ch.abilityDesc}`}>
                <Skin id={id} bust />
                <span>{ch.name}</span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="sp-ability" data-testid="char-ability">
        <span className="sp-ability-ico">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            {ABILITY_ICON[current]}
          </svg>
        </span>
        <div>
          <small>
            {S.advantage} · {c.role} · {c.species}
          </small>
          <b>{c.ability}</b>
          <p>{c.abilityDesc}</p>
        </div>
        {firstRun && (
          <button type="button" className="x-primary sp-first" data-testid="first-run-done" onClick={() => useGame.setState({ screen: 'title', firstRun: false })}>
            {S.firstRunBtn} <span aria-hidden>→</span>
          </button>
        )}
      </div>
      {user && (
        <div className="sp-fields">
          <label>
            <span className="x-mono">{fr.auth.pseudo}</span>
            <input className="x-input" value={pseudo} onChange={(e) => setPseudo(e.target.value)} minLength={3} maxLength={16} />
          </label>
          <label>
            <span className="x-mono">{fr.auth.email}</span>
            <input className="x-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
        </div>
      )}
      {user ? (
        <div className="sp-actions">
          {!pw && (
            <button type="button" className="sp-pw" onClick={() => setPw({ cur: '', a: '', b: '' })}>
              {S.changePw}
            </button>
          )}
          {dirty && (
            <button type="button" className="x-primary sp-save" onClick={save}>
              {S.save}
            </button>
          )}
        </div>
      ) : (
        <p className="sp-note">{S.guestNote}</p>
      )}
      {pw && (
        <div className="sp-pwform">
          <input className="x-input" type="password" placeholder={S.pwCurrent} value={pw.cur} onChange={(e) => setPw({ ...pw, cur: e.target.value })} />
          <input className="x-input" type="password" placeholder={fr.auth.passwordMin} value={pw.a} onChange={(e) => setPw({ ...pw, a: e.target.value })} />
          <input className="x-input" type="password" placeholder={fr.auth.confirmPh} value={pw.b} onChange={(e) => setPw({ ...pw, b: e.target.value })} />
          <button type="button" className="x-primary sp-save" onClick={savePw}>
            {S.save}
          </button>
          <button type="button" className="x-ghost sp-save" onClick={() => setPw(null)}>
            {fr.menu.back}
          </button>
        </div>
      )}
      {msg && <div className={msg.ok ? 'x-info' : 'x-err'}>{msg.t}</div>}
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
      <header className="x-phead">
        <h2>{S.game}</h2>
      </header>
      <div className="x-section">{S.part}</div>
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
      <div className="x-section">{S.display}</div>
      <Row title={S.quality} desc={S.qualityDesc}>
        <Seg value={s.quality} options={(['low', 'medium', 'high', 'ultra'] as Quality[]).map((q) => [q, S.qualities[q]] as [Quality, string])} onChange={(v) => update({ quality: v })} />
      </Row>
      <Row title={S.brightness} desc={S.brightnessDesc}>
        <Range value={s.brightness} min={0.4} max={1.4} step={0.02} onChange={(v) => update({ brightness: v })} />
      </Row>
      <Row title={S.sensitivity} desc={S.sensitivityDesc}>
        <SensitivityRange />
      </Row>
      <Row title={S.fov} desc={S.fovDesc(s.fov)}>
        <Range value={s.fov} min={70} max={110} step={1} onChange={(v) => update({ fov: v })} />
      </Row>
      {/* réglages hors maquette : conservés, accessibles en faisant défiler le panneau */}
      <div className="x-fold">
      <Row title={S.fullscreen} desc={S.fullscreenDesc}>
        <Toggle on={fs} onChange={() => toggleFullscreen()} />
      </Row>
      <Row title={S.resolution} desc={S.resolutionDesc}>
        <Seg value={s.resolution} options={(['auto', 720, 1080, 1440, 2160] as const).map((r) => [r, r === 'auto' ? 'Auto' : r === 2160 ? '4K' : `${r}p`] as ['auto' | number, string])} onChange={(v) => update({ resolution: v })} />
      </Row>
      <div className="x-section">{S.advanced}</div>
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
      </div>
    </>
  )
}

// ——— Touches ———

const KEY_LEFT: Action[] = ['forward', 'back', 'left', 'right']
const KEY_LEFT2: Action[] = ['jump', 'crouch']
const KEY_RIGHT: Action[] = ['act', 'inventory', 'tablet', 'lamp', 'hint', 'pause']
const KEY_MORE: Action[] = ['run', 'o2', 'battery', 'drink', 'fullscreen']
const PAD_LEFT: PadAction[] = ['jump', 'crouch']
const PAD_RIGHT: PadAction[] = ['act', 'inventory', 'tablet', 'lamp', 'hint', 'pause']
const PAD_MORE: PadAction[] = ['run', 'o2', 'battery', 'drink']

function KeyboardIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <rect x="2.5" y="6" width="19" height="12" rx="2.5" />
      <path d="M6.5 10h.01M10 10h.01M14 10h.01M17.5 10h.01M8 14.2h8" />
    </svg>
  )
}
function PadIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 7h10a5 5 0 0 1 4.9 4l.6 4a2.6 2.6 0 0 1-4.6 2.1L15.5 15h-7l-2.4 2.1a2.6 2.6 0 0 1-4.6-2.1l.6-4A5 5 0 0 1 7 7z" />
      <path d="M7.5 9.8v2.6M6.2 11.1h2.6M16.5 10h.01M18 12h.01" />
    </svg>
  )
}

/** symbole du bouton, aux couleurs de la marque */
function PadGlyph({ type, button }: { type: PadType; button: number }) {
  const name = padButtonName(type, button)
  if (type === 'xbox' && button <= 3) {
    const c = ['#5CB85C', '#E04848', '#3F8FE0', '#F2C230'][button]
    return (
      <span className="x-xbox" style={{ background: c }}>
        {name}
      </span>
    )
  }
  if (type === 'ps5' && button <= 3) {
    const c = ['#7AA2F7', '#F2708A', '#D88BD6', '#58D0B8'][button]
    const shape = [<path key="x" d="M5 5 19 19M19 5 5 19" />, <circle key="o" cx="12" cy="12" r="7.5" />, <rect key="s" x="5" y="5" width="14" height="14" rx="1" />, <path key="t" d="M12 4.5 20 19H4z" />][button]
    return (
      <span className="x-ps">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke={c} strokeWidth="2.4" strokeLinejoin="round">
          {shape}
        </svg>
        {name}
      </span>
    )
  }
  return <>{name}</>
}

function KeyBind({ a, onWait }: { a: Action; onWait: (a: Action | null) => void }) {
  const keys = useGame((s) => s.settings.keys)
  const [wait, setWait] = useState(false)
  useEffect(() => {
    if (!wait) return
    ;(window as any).__rebinding = true
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setWait(false)
      onWait(null)
      if (e.code === 'Escape' && a !== 'pause') return
      const next = { ...keys }
      // retire la touche des autres actions pour éviter les doublons
      for (const k of Object.keys(next) as Action[]) next[k] = next[k].filter((c) => c !== e.code)
      next[a] = [e.code, ...(keys[a] ?? []).slice(1).filter((c) => c !== e.code)]
      update({ keys: next })
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      ;(window as any).__rebinding = false
      window.removeEventListener('keydown', onKey, true)
    }
  }, [wait, a, keys, onWait])
  return (
    <button
      type="button"
      data-testid={`bind-${a}-0`}
      className={`x-key ${wait ? 'wait' : ''}`}
      onClick={() => {
        setWait(true)
        onWait(a)
      }}
    >
      {wait ? S.press : keys[a]?.[0] ? keyName(keys[a][0]) : '—'}
    </button>
  )
}

function PadBind({ a, type }: { a: PadAction; type: PadType }) {
  const pad = useGame((s) => s.settings.pad)
  const [wait, setWait] = useState(false)
  useEffect(() => {
    if (!wait) return
    ;(window as any).__rebinding = true
    const before = new Set((navigator.getGamepads?.().find((g) => g?.connected)?.buttons ?? []).flatMap((b, i) => (b.pressed ? [i] : [])))
    let raf = 0
    const poll = () => {
      const buttons = navigator.getGamepads?.().find((g) => g?.connected)?.buttons ?? []
      for (let i = 0; i < buttons.length; i++) {
        if (buttons[i].pressed && !before.has(i)) {
          // échange : l'action qui avait ce bouton récupère l'ancien
          const next = { ...pad }
          for (const k of Object.keys(next) as PadAction[]) if (next[k] === i) next[k] = pad[a]
          next[a] = i
          update({ pad: next })
          setWait(false)
          return
        }
        if (!buttons[i].pressed) before.delete(i)
      }
      raf = requestAnimationFrame(poll)
    }
    raf = requestAnimationFrame(poll)
    const esc = (e: KeyboardEvent) => e.code === 'Escape' && setWait(false)
    window.addEventListener('keydown', esc, true)
    return () => {
      ;(window as any).__rebinding = false
      cancelAnimationFrame(raf)
      window.removeEventListener('keydown', esc, true)
    }
  }, [wait, a, pad])
  return (
    <button type="button" data-testid={`pad-${a}`} className={`x-key ${wait ? 'wait' : ''}`} onClick={() => setWait(true)}>
      {wait ? S.press : <PadGlyph type={type} button={pad[a]} />}
    </button>
  )
}

function KeyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="k-row">
      <span>{label}</span>
      {children}
    </div>
  )
}

function Keys() {
  const s = useGame((st) => st.settings)
  const A = fr.actions
  const [device, setDevice] = useState<'kb' | 'pad'>(() => (useGame.getState().padActive ? 'pad' : 'kb'))
  const [waiting, setWaiting] = useState<Action | null>(null)
  const detected = detectPadType()
  const t = s.padType
  const padLabel = t === 'ps5' ? 'PS5' : 'Xbox'
  const stick = t === 'ps5' ? 'L' : 'LS'
  const reset = () => (device === 'kb' ? update({ keys: DEFAULT_KEYS, keyLayout: detectKeyLayout() }) : update({ pad: DEFAULT_PAD }))
  return (
    <>
      <header className="x-phead k-head">
        <h2>{S.keys}</h2>
        <div className="k-tools">
          <Seg
            value={device}
            options={[
              ['kb', <span key="k" className="k-dev"><KeyboardIcon /> {S.keyboard}</span>],
              ['pad', <span key="p" className="k-dev"><PadIcon /> {S.gamepad}</span>],
            ]}
            onChange={setDevice}
          />
          {device === 'kb' ? (
            <Seg value={s.keyLayout} options={[['azerty', 'AZERTY'], ['qwerty', 'QWERTY']]} onChange={(v) => update({ keyLayout: v })} />
          ) : (
            <Seg value={t} options={[['ps5', 'PS5'], ['xbox', 'Xbox']]} onChange={(v) => update({ padType: v })} />
          )}
          <button type="button" className="k-reset" data-testid="keys-reset" onClick={reset}>
            {S.reset}
          </button>
        </div>
      </header>
      <p className="k-help">{device === 'kb' ? S.keysHelp : S.padHelp(padLabel)}</p>
      {device === 'kb' ? (
        <div className="k-grid" key="kb">
          <div>
            {KEY_LEFT.map((a) => (
              <KeyRow key={a} label={A[a]}>
                <KeyBind a={a} onWait={setWaiting} />
              </KeyRow>
            ))}
            <KeyRow label={A.look}>
              <span className="x-key static">{S.mouse}</span>
            </KeyRow>
            {KEY_LEFT2.map((a) => (
              <KeyRow key={a} label={A[a]}>
                <KeyBind a={a} onWait={setWaiting} />
              </KeyRow>
            ))}
          </div>
          <div>
            {KEY_RIGHT.map((a) => (
              <KeyRow key={a} label={A[a]}>
                <KeyBind a={a} onWait={setWaiting} />
              </KeyRow>
            ))}
          </div>
        </div>
      ) : (
        <div className="k-grid" key="pad">
          <div>
            {(['↑', '↓', '←', '→'] as const).map((arrow, i) => (
              <KeyRow key={arrow} label={A[KEY_LEFT[i]]}>
                <span className="x-key static">
                  {stick} {arrow}
                </span>
              </KeyRow>
            ))}
            <KeyRow label={A.look}>
              <span className="x-key static">{t === 'ps5' ? 'R' : 'RS'}</span>
            </KeyRow>
            {PAD_LEFT.map((a) => (
              <KeyRow key={a} label={A[a]}>
                <PadBind a={a} type={t} />
              </KeyRow>
            ))}
          </div>
          <div>
            {PAD_RIGHT.map((a) => (
              <KeyRow key={a} label={A[a]}>
                <PadBind a={a} type={t} />
              </KeyRow>
            ))}
          </div>
        </div>
      )}
      <p className="k-foot">{device === 'kb' ? (waiting ? S.waiting(A[waiting]) : S.keysFoot) : detected ? S.padDetected(padLabel) : S.padNone(padLabel)}</p>
      {/* commandes hors maquette : toujours réglables, en faisant défiler le panneau */}
      <div className="x-section k-more">{S.otherCommands}</div>
      <div className="k-grid more">
        {device === 'kb'
          ? KEY_MORE.map((a) => (
              <KeyRow key={a} label={A[a]}>
                <KeyBind a={a} onWait={setWaiting} />
              </KeyRow>
            ))
          : PAD_MORE.map((a) => (
              <KeyRow key={a} label={A[a]}>
                <PadBind a={a} type={t} />
              </KeyRow>
            ))}
      </div>
    </>
  )
}

function Audio() {
  const s = useGame((st) => st.settings)
  return (
    <>
      <header className="x-phead">
        <h2>{S.audio}</h2>
      </header>
      <div className="x-section">{S.volume}</div>
      <Row title={fr.report.master} desc={S.masterDesc}>
        <Range value={s.master} min={0} max={1} step={0.01} onChange={(v) => update({ master: v })} />
      </Row>
      <Row title={S.musicTitle} desc={S.musicDesc}>
        <Range value={s.music} min={0} max={1} step={0.01} onChange={(v) => update({ music: v })} />
      </Row>
      <Row title={S.sfxTitle} desc={S.sfxDesc}>
        <Range value={s.sfx} min={0} max={1} step={0.01} onChange={(v) => update({ sfx: v })} />
      </Row>
      <Row title={S.voiceTitle} desc={S.voiceDesc}>
        <Range value={s.voice} min={0} max={1} step={0.01} onChange={(v) => update({ voice: v })} />
      </Row>
      <Row title={S.ambience} desc={S.ambienceDesc}>
        <Range value={s.ambience} min={0} max={1} step={0.01} onChange={(v) => update({ ambience: v })} />
      </Row>
      <div className="x-section">{S.outputSection}</div>
      <Row title={S.output} desc={S.outputDesc}>
        <Seg value={s.audioOutput} options={[['headphones', S.headphones], ['speakers', S.speakers]]} onChange={(v) => update({ audioOutput: v })} />
      </Row>
      <Row title={S.spatial} desc={S.spatialDesc}>
        <Toggle on={s.spatialAudio} onChange={(v) => update({ spatialAudio: v })} />
      </Row>
      <Row title={S.o2Alert} desc={S.o2AlertDesc}>
        <Toggle on={s.o2Alert} onChange={(v) => update({ o2Alert: v })} />
      </Row>
      <Row title={S.captions} desc={S.captionsDesc}>
        <Toggle on={s.soundCaptions} onChange={(v) => update({ soundCaptions: v })} />
      </Row>
      <div className="x-fold">
        <Row title={S.browserVoice} desc={S.browserVoiceDesc}>
          <Toggle on={s.browserVoice} onChange={(v) => update({ browserVoice: v })} />
        </Row>
      </div>
    </>
  )
}

export function SettingsPage({ overlay, onClose }: { overlay?: boolean; onClose?: () => void }) {
  const tab = useGame((s) => s.settingsTab)
  const user = useGame((s) => s.user)
  const tabs = [S.profile, S.game, S.keys, S.audio]
  return (
    <Stage overlay={overlay} testId="settings">
      <PageHead kicker={S.kicker} title={S.title} onBack={() => (overlay ? onClose?.() : closePage())} />
      <nav className="x-panel sp-nav">
        {tabs.map((t, i) => (
          <button key={t} type="button" data-testid={`stab-${i}`} className={tab === i ? 'on' : ''} onClick={() => useGame.setState({ settingsTab: i })}>
            <small>{String(i + 1).padStart(2, '0')}</small>
            {t}
          </button>
        ))}
        {user && !overlay && (
          <button type="button" className="sp-logout" onClick={() => logout()}>
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3M15 8l4 4-4 4M19 12H10" />
            </svg>
            {fr.auth.logout}
          </button>
        )}
      </nav>
      <section className="x-panel sp-panel" key={tab}>
        {tab === 0 ? <Profile /> : tab === 1 ? <Game /> : tab === 2 ? <Keys /> : <Audio />}
      </section>
    </Stage>
  )
}
