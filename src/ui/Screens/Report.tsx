import { useEffect, useState } from 'react'
import { ACHIEVEMENTS, checkEndAchievements } from '../../game/achievements'
import { leaderboard, submitScore, type Row as BoardRow } from '../../game/api'
import { audio } from '../../game/audio/audio'
import { computeScore } from '../../game/logic'
import { G, timeLimit, useGame, type GameData } from '../../game/state'
import { fr } from '../../i18n/fr'
import { requestLock } from '../../player/Player'
import { Avatar, startNewGame } from './Menu'
import { update } from './Settings'
import { Range, Row, Toggle } from './SettingsPage'

// Écrans « Mission accomplie », « Temps écoulé » et « Mission en pause » (maquettes) :
// progression énigme par énigme avec le temps passé, classement ou réglages rapides.

const R = fr.report

const hms = (sec: number) => {
  const s = Math.max(0, Math.floor(sec))
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
const ms = (sec: number) => {
  const s = Math.max(0, Math.round(sec))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** énigme résolue d'après les drapeaux (repli pour les sauvegardes sans temps intermédiaires) */
function solvedByFlags(id: string, s: GameData) {
  const f = s.flags
  const m: Record<string, boolean> = {
    p_locker: f.lockerOpen,
    p_valves: f.pressurized,
    p_steam: f.steamFixed,
    p_power: f.pw_sas && f.pw_terminal,
    p_algo: f.readTerminal,
    p_plan: s.planDone,
    p_engine: f.engine,
    p_sequence: s.zone > 3,
    p_bridge: f.bridge,
    p_radio: f.beacon,
  }
  return !!m[id]
}

type Status = 'done' | 'current' | 'locked'
interface Step {
  id: string
  name: string
  status: Status
  dur: number | null
}

/** étapes de la mission : durée de chaque énigme (entre deux résolutions), énigme en cours, verrouillées */
function missionSteps(s: GameData): Step[] {
  const splits = s.splits ?? {}
  const order = Object.entries(splits).sort((a, b) => a[1] - b[1])
  const dur: Record<string, number> = {}
  order.forEach(([id, t], i) => (dur[id] = t - (i ? order[i - 1][1] : 0)))
  let currentSet = false
  return fr.puzzleList.map((p) => {
    const done = splits[p.id] != null || solvedByFlags(p.id, s)
    let status: Status = done ? 'done' : 'locked'
    if (!done && !currentSet) {
      status = 'current'
      currentSet = true
    }
    return { id: p.id, name: p.name, status, dur: dur[p.id] ?? null }
  })
}

type Mode = 'win' | 'fail' | 'pause'

function Progress({ mode, steps }: { mode: Mode; steps: Step[] }) {
  const done = steps.filter((x) => x.status === 'done')
  const max = Math.max(1, ...done.map((x) => x.dur ?? 0))
  const longest = done.reduce<Step | null>((a, x) => (x.dur != null && (!a || (x.dur ?? 0) > (a.dur ?? 0)) ? x : a), null)
  const cur = steps.find((x) => x.status === 'current')
  const s = G()
  return (
    <section className="mm-panel rp-progress">
      <header>
        <h2>{mode === 'win' ? R.perPuzzle : R.progress}</h2>
        <span className={`rp-count ${mode}`}>{R.solved(done.length, steps.length)}</span>
      </header>
      <ol className="rp-steps">
        {steps.map((x, i) => {
          const isLong = mode === 'win' && x === longest
          const cls = x.status === 'done' ? (isLong ? 'long' : 'done') : x.status === 'current' ? (mode === 'fail' ? 'cut' : 'cur') : 'locked'
          // en cours : la barre avance avec le temps passé depuis la dernière énigme
          const since = Math.max(0, s.playTime + s.penalty - Math.max(0, ...Object.values(s.splits ?? {})))
          const w = x.status === 'done' ? ((x.dur ?? max * 0.6) / max) * 100 : x.status === 'current' ? Math.min(92, (since / max) * 100 + 8) : 0
          return (
            <li key={x.id} className={`rp-step ${cls}`}>
              <span className="rp-num">{String(i + 1).padStart(2, '0')}</span>
              <div className="rp-mid">
                <span>{x.name}</span>
                <i className="rp-bar">
                  <b style={{ width: `${w}%` }} />
                </i>
              </div>
              <span className="rp-time">{x.status === 'done' ? (x.dur != null ? ms(x.dur) : '—') : x.status === 'current' ? (mode === 'fail' ? R.interrupted : R.current) : R.locked}</span>
            </li>
          )
        })}
      </ol>
      <footer className="rp-foot">
        <span className={mode}>
          {mode === 'win' ? `${R.longest} · ${longest?.name ?? '—'}` : `${mode === 'fail' ? R.blocking : R.currentPuzzle} · ${cur?.name ?? '—'}`}
        </span>
        <span className="rp-mini">
          {R.hints} {s.hintsUsed} · {R.errors} {s.errors} · {R.faints} {s.faints}
          {mode === 'win' ? ` · ${R.score} ${computeScore()}` : ''}
        </span>
      </footer>
    </section>
  )
}

function Head({ mode, kicker, title, sub, clockLabel, clock, testId }: { mode: Mode; kicker: string; title: string; sub: string; clockLabel: string; clock: string; testId?: string }) {
  return (
    <header className="rp-head">
      <img src="/logo/badge-dark.png" alt="" className="rp-logo" />
      <div className="rp-titles">
        <div className={`rp-kicker ${mode}`}>{kicker}</div>
        <h1>{title}</h1>
        <p>{sub}</p>
      </div>
      <div className={`rp-clock ${mode}`}>
        <small>{clockLabel}</small>
        <b data-testid={testId}>{clock}</b>
      </div>
    </header>
  )
}

function Board({ mode, rank, prevRank }: { mode: 'win' | 'fail'; rank: number | null; prevRank: number | null }) {
  const [rows, setRows] = useState<BoardRow[] | null>(null)
  const user = useGame((s) => s.user)
  const character = useGame((s) => s.character)
  useEffect(() => {
    // en cas de victoire, on attend l'enregistrement du score pour s'y voir
    if (mode === 'win' && user && rank == null) return
    leaderboard('all', 'all')
      .then((r) => setRows(r.rows))
      .catch(() => setRows([]))
  }, [mode, rank, user])
  const top = (rows ?? []).slice(0, 7)
  const meIdx = (rows ?? []).findIndex((r) => r.me)
  const up = rank && prevRank && prevRank > rank ? prevRank - rank : 0
  return (
    <section className="mm-panel rp-board">
      <header>
        <h2>{R.board}</h2>
        <span className={`rp-chip ${mode}`}>{mode === 'win' && rank ? `${R.youAre(rank)}${up ? ` · ↑ ${up}` : ''}` : R.unranked}</span>
      </header>
      <div className="mm-rows">
        {rows && !rows.length && <p className="mm-empty">{user ? fr.board.empty : fr.board.offline}</p>}
        {top.map((r, i) => (
          <div key={i} className={`mm-row ${r.me && mode === 'win' && i === meIdx ? 'me win' : ''}`}>
            <span className={`mm-rank ${i < 3 ? 'top' : ''}`}>{String(i + 1).padStart(2, '0')}</span>
            <Avatar charId={r.avatar ?? r.character} />
            <span className="mm-name">
              {r.pseudo}
              {r.me && mode === 'win' && i === meIdx ? ` ${R.you}` : ''}
            </span>
            <span className="mm-time">{hms(r.timeMs / 1000)}</span>
          </div>
        ))}
        {mode === 'win' && meIdx >= 7 && rows && (
          <div className="mm-row me win">
            <span className="mm-rank">{String(meIdx + 1).padStart(2, '0')}</span>
            <Avatar charId={character} />
            <span className="mm-name">
              {rows[meIdx].pseudo} {R.you}
            </span>
            <span className="mm-time">{hms(rows[meIdx].timeMs / 1000)}</span>
          </div>
        )}
        {mode === 'fail' && (
          <div className="mm-row me fail">
            <span className="mm-rank">—</span>
            <Avatar charId={character} />
            <span className="mm-name">
              {user?.pseudo ?? fr.menu2.guest} {R.you}
            </span>
            <span className="mm-time">{R.failed.toUpperCase()}</span>
          </div>
        )}
      </div>
    </section>
  )
}

export function End() {
  const s = useGame()
  const fail = s.ending === 'fail'
  const mode: 'win' | 'fail' = fail ? 'fail' : 'win'
  const total = s.playTime + s.penalty
  const [rank, setRank] = useState<number | null>(null)
  const [prevRank] = useState(() => G().myRank ?? null)
  const [unlocked, setUnlocked] = useState<string[]>([])
  const steps = missionSteps(s)
  useEffect(() => {
    if (fail) return
    setUnlocked(checkEndAchievements())
    submitScore({ timeMs: Math.round(total * 1000), hints: s.hintsUsed, errors: s.errors, score: computeScore(), character: s.character, ending: s.choice === 'keep' ? 'rescue_keep' : 'rescue', difficulty: s.difficulty, ghost: s.track }).then((r) => {
      setRank(r)
      if (r) useGame.setState({ myRank: r })
    })
  }, [])
  const earth = s.zone >= 4
  const ep = fr.story.epilogue
  const again = () => {
    useGame.setState({ ended: false })
    startNewGame(s.character, s.difficulty)
  }
  return (
    <div className={`rp ${mode}`} data-testid="end">
      <Head
        mode={mode}
        kicker={fail ? (earth ? R.failKickerEarth : R.failKicker) : R.winKicker}
        title={fail ? R.failTitle : R.winTitle}
        sub={fail ? (earth ? R.failSubEarth : R.failSub) : `${R.winSub} ${s.choice === 'keep' ? ep.keep : ep.drop}`}
        clockLabel={fail ? R.limit : R.total}
        clock={fail ? '00:00:00' : hms(total)}
        testId="end-time"
      />
      {unlocked.length > 0 && (
        <div className="ach-row rp-ach">
          {unlocked.map((c) => {
            const a = ACHIEVEMENTS.find((x) => x.code === c)!
            return (
              <span key={c} className="ach-chip" title={a.desc}>
                {a.icon} {a.name}
              </span>
            )
          })}
        </div>
      )}
      <div className="rp-grid">
        <Progress mode={mode} steps={steps} />
        <div className="rp-right">
          <Board mode={mode} rank={rank} prevRank={prevRank} />
          <div className="rp-actions">
            <button className="rp-ghost" onClick={() => useGame.setState({ screen: 'title', ended: false })}>
              {R.menu}
            </button>
            <button className="au-submit" data-testid="again" onClick={again}>
              {fail ? R.retry : R.replay}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Pause() {
  const s = useGame()
  const st = s.settings
  const steps = missionSteps(s)
  const resume = () => {
    useGame.setState({ paused: false })
    requestLock()
  }
  const quit = () => {
    audio.stopAllLoops()
    audio.playMusic('title')
    useGame.setState({ screen: 'title', paused: false, cine: null, subtitle: null })
  }
  return (
    <div className="rp pause" data-testid="pause">
      <Head mode="pause" kicker={`${R.pauseKicker} · ${fr.zones[s.zone].sub}`} title={R.pauseTitle} sub={R.pauseSub} clockLabel={R.remaining} clock={hms(timeLimit() - s.playTime - s.penalty)} />
      <div className="rp-grid">
        <Progress mode="pause" steps={steps} />
        <div className="rp-right">
          <section className="mm-panel rp-quick">
            <header>
              <h2>{R.quick}</h2>
              <button className="rp-chip pause" onClick={() => useGame.setState({ settingsOpen: true, settingsTab: 1 })}>
                {R.allSettings} →
              </button>
            </header>
            <Row title={R.master} desc={R.masterDesc}>
              <Range value={st.master} min={0} max={1} step={0.01} onChange={(v) => update({ master: v })} />
            </Row>
            <Row title={fr.settings2.brightness} desc={R.brightnessDesc}>
              <Range value={st.brightness} min={0.6} max={1.6} step={0.02} onChange={(v) => update({ brightness: v })} />
            </Row>
            <Row title={fr.settings2.sensitivity} desc={R.sensDesc}>
              <Range value={st.sensitivity} min={0.2} max={3} step={0.05} onChange={(v) => update({ sensitivity: v })} />
            </Row>
            <Row title={fr.settings2.chrono} desc={fr.settings2.chronoDesc}>
              <Toggle on={st.showChrono} onChange={(v) => update({ showChrono: v })} />
            </Row>
            <Row title={fr.settings2.subs} desc={fr.settings2.subsDesc}>
              <Toggle on={st.subtitles} onChange={(v) => update({ subtitles: v })} />
            </Row>
          </section>
          <div className="rp-actions">
            <button className="rp-ghost" onClick={quit}>
              {R.quit}
            </button>
            <button className="au-submit" data-testid="resume" onClick={resume}>
              {R.resume}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
