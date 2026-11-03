import { useEffect, useRef, useState } from 'react'
import { audio } from '../../game/audio/audio'
import { SURVIVAL_ITEMS } from '../../game/items'
import { G, clearSave, live, loadSave, newGameData, toggleFullscreen, useGame, type SaveFile } from '../../game/state'
import { deleteCloudSave, fetchCloudSave, fmtTime, leaderboard, logout, submitScore, type Row } from '../../game/api'
import { skipCine } from '../../world/Cinematics'
import { IMPACT_T, prologue } from '../../world/TitleScene'
import { computeScore, transitionTo } from '../../game/logic'
import { loadExplored } from '../../game/explore'
import { DIFFICULTY, DIFF_ORDER, type Difficulty } from '../../game/difficulty'
import { ACHIEVEMENTS, allAchievements, checkEndAchievements, localAchievements } from '../../game/achievements'
import { fr } from '../../i18n/fr'
import { requestLock } from '../../player/Player'
import { Keypad } from '../../game/puzzles/Keypad'
import { PowerGrid } from '../../game/puzzles/PowerGrid'
import { Radio } from '../../game/puzzles/Radio'
import { Sequence } from '../../game/puzzles/Sequence'
import { Valves } from '../../game/puzzles/Valves'
import { Algo } from '../../game/puzzles/Algo'
import { Plan } from '../../game/puzzles/Plan'
import { Dilemma } from '../../game/puzzles/Dilemma'
import { Settings, update } from './Settings'

const M = fr.menu

function AstroSilhouette({ color, accent }: { color: string; accent: string }) {
  return (
    <svg viewBox="0 0 80 100" className="suit">
      <defs>
        <radialGradient id={`v${color}`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stopColor="#ffe3a0" />
          <stop offset="0.5" stopColor="#c99a35" />
          <stop offset="1" stopColor="#5a3d10" />
        </radialGradient>
      </defs>
      <rect x="22" y="34" width="36" height="32" rx="10" fill="#e8e5dc" />
      <rect x="18" y="36" width="10" height="26" rx="5" fill="#dcd8ce" />
      <rect x="52" y="36" width="10" height="26" rx="5" fill="#dcd8ce" />
      <rect x="26" y="62" width="12" height="30" rx="5" fill="#e8e5dc" />
      <rect x="42" y="62" width="12" height="30" rx="5" fill="#e8e5dc" />
      <rect x="24" y="88" width="15" height="8" rx="2" fill="#2a2c30" />
      <rect x="41" y="88" width="15" height="8" rx="2" fill="#2a2c30" />
      <circle cx="40" cy="22" r="15" fill="#e8e5dc" />
      <ellipse cx="40" cy="23" rx="11" ry="9" fill={`url(#v${color})`} />
      <rect x="22" y="44" width="36" height="5" fill={color} />
      <rect x="30" y="52" width="20" height="8" rx="2" fill="#cfcac0" />
      <circle cx="35" cy="56" r="1.6" fill={accent} />
      <circle cx="40" cy="56" r="1.6" fill={color} />
      <circle cx="45" cy="56" r="1.6" fill="#2a2c30" />
      <rect x="18" y="56" width="10" height="3" fill={color} />
      <rect x="52" y="56" width="10" height="3" fill={color} />
    </svg>
  )
}

export function Title() {
  const [save, setSave] = useState<SaveFile | null>(null)
  const [settings, setSettings] = useState(false)
  const [credits, setCredits] = useState(false)
  const [ach, setAch] = useState(false)
  const user = useGame((st) => st.user)
  const offline = useGame((st) => st.offline)
  useEffect(() => {
    // la sauvegarde la plus récente l'emporte (locale ou dans le compte)
    const local = loadSave()
    setSave(local)
    fetchCloudSave().then((cloud) => {
      if (cloud && (!local || (cloud.savedAt ?? 0) > (local.savedAt ?? 0))) setSave(cloud)
    })
  }, [user])
  const cont = async () => {
    const d = save
    if (!d) return
    await audio.init()
    const { pos, yaw, savedAt, ...data } = d
    void savedAt
    loadExplored(data.explored)
    useGame.setState({ ...data, screen: 'playing', paused: false, cine: null, resume: pos ? { pos, yaw: yaw ?? 0 } : null, tp: null, tabletOpen: false, puzzle: null, readNote: null })
    requestLock()
  }
  return (
    <div className="screen-full" data-testid="title">
      <img className="title-logo" src="/logo/badge.png" alt="" />
      <h1 className="title-name">{fr.title}</h1>
      <p className="title-sub">{fr.subtitle}</p>
      <div className="user-chip">
        <i style={{ background: user ? undefined : '#ffd23a' }} />
        {user ? fr.auth.hello(user.pseudo) : offline ? 'Hors ligne · invité' : '—'}
        <button className="chip-link" onClick={() => toggleFullscreen()}>
          ⛶ Plein écran
        </button>
        <button className="chip-link" onClick={() => (user ? logout() : useGame.setState({ screen: 'login', offline: false }))}>
          {user ? fr.auth.logout : fr.auth.login}
        </button>
      </div>
      <div className="menu">
        {save && (
          <button className="btn primary" data-testid="continue" onClick={cont}>
            {M.continue} · {fr.zones[save.zone].name}, {fr.zones[save.zone].sub.toLowerCase()}
          </button>
        )}
        <button
          className={`btn ${save ? '' : 'primary'}`}
          data-testid="new-game"
          onClick={async () => {
            await audio.init()
            audio.playMusic('title')
            useGame.setState({ screen: 'charSelect' })
          }}
        >
          {M.newGame}
        </button>
        <button className="btn" data-testid="open-board" onClick={() => useGame.setState({ screen: 'leaderboard' })}>
          {fr.board.title}
        </button>
        <button className="btn" data-testid="open-settings" onClick={() => setSettings(true)}>
          {M.settings} & touches
        </button>
        <button className="btn" data-testid="open-ach" onClick={() => setAch(true)}>
          Succès
        </button>
        <button className="btn" onClick={() => setCredits(true)}>
          {M.credits}
        </button>
      </div>
      <div className="hint-line">{fr.controls.desktop} · 1 à 9 : objets</div>
      {settings && <Settings onClose={() => setSettings(false)} />}
      {credits && <Credits onClose={() => setCredits(false)} />}
      {ach && <AchievementsPanel onClose={() => setAch(false)} />}
    </div>
  )
}

export function AchievementsPanel({ onClose }: { onClose: () => void }) {
  const [have, setHave] = useState<string[]>(localAchievements())
  useEffect(() => {
    allAchievements().then(setHave)
  }, [])
  return (
    <div className="modal-bg" style={{ zIndex: 40 }} onClick={onClose}>
      <div className="panel" style={{ width: 'min(640px, 94vw)' }} onClick={(e) => e.stopPropagation()} data-testid="achievements">
        <button className="close-x" onClick={onClose}>
          ×
        </button>
        <h2>Succès</h2>
        <p className="sub">
          {have.length} / {ACHIEVEMENTS.length} débloqués
        </p>
        <div className="ach-grid">
          {ACHIEVEMENTS.map((a) => (
            <div key={a.code} className={`ach ${have.includes(a.code) ? 'on' : ''}`}>
              <span className="ach-icon">{have.includes(a.code) ? a.icon : '🔒'}</span>
              <div>
                <b>{a.name}</b>
                <small>{a.desc}</small>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Leaderboard() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState(false)
  const [d, setD] = useState<Difficulty>(G().difficulty ?? 'astronaut')
  useEffect(() => {
    setRows(null)
    leaderboard(d)
      .then((r) => setRows(r.rows))
      .catch(() => setErr(true))
  }, [d])
  return (
    <div className="modal-bg" style={{ zIndex: 35 }} data-testid="leaderboard">
      <div className="panel board">
        <button className="close-x" onClick={() => useGame.setState({ screen: 'title' })}>
          ×
        </button>
        <h2>{fr.board.title}</h2>
        <p className="sub">{fr.board.sub}</p>
        <div className="set-tabs">
          {DIFF_ORDER.map((x) => (
            <button key={x} className={`btn ${d === x ? 'primary' : ''}`} onClick={() => setD(x)}>
              {DIFFICULTY[x].name}
            </button>
          ))}
        </div>
        {err && <p>{fr.board.offline}</p>}
        {rows && !rows.length && <p>{fr.board.empty}</p>}
        {rows && rows.length > 0 && (
          <table>
            <thead>
              <tr>
                <th>{fr.board.rank}</th>
                <th>{fr.board.player}</th>
                <th>{fr.board.time}</th>
                <th>{fr.board.hints}</th>
                <th>{fr.board.errors}</th>
                <th>{fr.board.score}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className={r.me ? 'me' : ''}>
                  <td className="medal">{i + 1}</td>
                  <td>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 5, background: fr.characters[r.character]?.color ?? '#888', marginRight: 8 }} />
                    {r.pseudo}
                  </td>
                  <td className="num">{fmtTime(r.timeMs)}</td>
                  <td className="num">{r.hints}</td>
                  <td className="num">{r.errors}</td>
                  <td className="num">{r.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div style={{ marginTop: 18 }}>
          <button className="btn" onClick={() => useGame.setState({ screen: 'title' })}>
            {M.back}
          </button>
        </div>
      </div>
    </div>
  )
}

function live_reset() {
  /* la position est fixée par Player via `resume` */
}

export function CharSelect() {
  const [sel, setSel] = useState('nova')
  const [diffSel, setDiffSel] = useState<Difficulty>('astronaut')
  const start = async () => {
    await audio.init()
    clearSave()
    deleteCloudSave()
    loadExplored([])
    useGame.setState({ ...newGameData(sel, diffSel), screen: 'prologue', paused: false, tp: null, resume: null, tabletOpen: false, puzzle: null, readNote: null, lastResult: null })
  }
  return (
    <div className="screen-full" data-testid="charselect">
      <h2 style={{ fontFamily: 'Rajdhani', letterSpacing: '0.2em', textTransform: 'uppercase', margin: 0 }}>{M.chooseChar}</h2>
      <p className="sub" style={{ color: 'var(--muted)' }}>
        Station Selene-7 · 2041 · Orbite lunaire basse
      </p>
      <div className="chars">
        {Object.entries(fr.characters).map(([id, c]) => (
          <div key={id} data-testid={`char-${id}`} className={`char ${sel === id ? 'on' : ''}`} tabIndex={0} onClick={() => setSel(id)}>
            <AstroSilhouette color={c.color} accent={c.accent} />
            <b>{c.name}</b>
            <small>{c.role}</small>
          </div>
        ))}
      </div>
      <h3 className="diff-title">Difficulté</h3>
      <div className="diffs">
        {DIFF_ORDER.map((d) => (
          <button key={d} data-testid={`diff-${d}`} className={`diff ${diffSel === d ? 'on' : ''} diff-${d}`} onClick={() => setDiffSel(d)}>
            <b>{DIFFICULTY[d].name}</b>
            <small>{DIFFICULTY[d].desc}</small>
          </button>
        ))}
      </div>
      <div className="menu" style={{ flexDirection: 'row', width: 'auto' }}>
        <button className="btn" onClick={() => useGame.setState({ screen: 'title' })}>
          {M.back}
        </button>
        <button className="btn primary" data-testid="start" onClick={start}>
          {M.start}
        </button>
      </div>
    </div>
  )
}

export function Credits({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-bg" style={{ zIndex: 40 }} onClick={onClose}>
      <div className="panel" style={{ width: 'min(560px, 92vw)' }} onClick={(e) => e.stopPropagation()}>
        <button className="close-x" onClick={onClose}>
          ×
        </button>
        <h2>{fr.credits.title}</h2>
        {fr.credits.lines.map(([a, b]) => (
          <div key={a} className="set-row">
            <span style={{ color: 'var(--muted)' }}>{a}</span>
            <span>{b}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function NoteReader() {
  const id = useGame((s) => s.readNote)
  if (!id) return null
  const n = fr.notes[id]
  if (!n) return null
  const screen = id === 'terminal' || id === 'lab' || id === 'cargo'
  const close = () => {
    useGame.setState({ readNote: null })
    requestLock()
  }
  return (
    <div className="modal-bg" onClick={close} data-testid="note">
      <div className={`note-reader ${screen ? 'screen' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h3>{n.title}</h3>
        {n.text}
        <div className="foot">Ajouté au carnet · E ou clic pour fermer</div>
      </div>
    </div>
  )
}

export function PuzzleHost() {
  const p = useGame((s) => s.puzzle)
  if (!p) return null
  const close = () => {
    useGame.setState({ puzzle: null })
    requestLock()
  }
  return (
    <div className="modal-bg" onClick={close} data-testid="puzzle">
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
        {p === 'keypad' && <Keypad />}
        {p === 'valves' && <Valves />}
        {p === 'power' && <PowerGrid />}
        {p === 'sequence' && <Sequence />}
        {p === 'radio' && <Radio />}
        {p === 'algo' && <Algo />}
        {p === 'plan' && <Plan />}
        {p === 'dilemma' && <Dilemma />}
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button className="btn ghost" data-testid="puzzle-close" onClick={close}>
            {fr.puzzles.close} (Échap)
          </button>
        </div>
      </div>
    </div>
  )
}

/** bouton « Passer » pour toutes les cinématiques (ou touche Entrée) */
export function SkipCine() {
  const cine = useGame((s) => s.cine)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') skipCine()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  if (!cine || cine === 'faint' || cine === 'fail') return null
  return (
    <button className="btn ghost skip" data-testid="skip" onClick={() => skipCine()}>
      Passer ▸ <span className="key" style={{ marginLeft: 8, marginRight: 0 }}>Entrée</span>
    </button>
  )
}

/** prologue : la station au-dessus de la Lune, puis l'impact */
export function Prologue() {
  const [line, setLine] = useState<string | null>(null)
  useEffect(() => {
    prologue.t0 = performance.now()
    audio.playMusic('title')
    const L = fr.story.prologue
    const timers = L.map((l, i) =>
      setTimeout(() => {
        setLine(l)
        audio.speak(l, { rate: 1.0, id: `prologue_${i}` })
      }, 600 + i * 3500),
    )
    timers.push(
      setTimeout(() => {
        audio.sfx('launch')
        audio.sfx('alarm_o2')
        setLine(fr.story.impact)
      }, IMPACT_T * 1000),
    )
    timers.push(setTimeout(finish, (IMPACT_T + 3.5) * 1000))
    const k = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Escape' || e.code === 'Space') finish()
    }
    window.addEventListener('keydown', k)
    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener('keydown', k)
    }
  }, [])
  const flash = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      if (flash.current) flash.current.style.opacity = String(live.flash)
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <>
      <div className="flash" ref={flash} style={{ opacity: 0 }} />
      {line && (
        <div className="subtitle" style={{ bottom: 90 }}>
          <small>Prologue</small>
          {line}
        </div>
      )}
      <button className="btn ghost skip" data-testid="skip-prologue" onClick={finish}>
        Passer ▸ <span className="key" style={{ marginLeft: 8, marginRight: 0 }}>Entrée</span>
      </button>
    </>
  )
}

let finished = false
function finish() {
  if (useGame.getState().screen !== 'prologue' || finished) return
  finished = true
  setTimeout(() => (finished = false), 1000)
  audio.stopSpeech()
  live.flash = 0
  useGame.setState({ screen: 'playing', paused: false })
  transitionTo(1)
  requestLock()
}

export function RotatePhone() {
  return (
    <div className="rotate">
      <div>
        <div className="phone" />
        <h2 style={{ fontFamily: 'Rajdhani', letterSpacing: '0.15em' }}>{M.rotate}</h2>
        <p style={{ color: 'var(--muted)' }}>{M.rotateSub}</p>
      </div>
    </div>
  )
}

export { update as updateSettings }

export { End, Pause } from './Report'
