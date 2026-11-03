import { useEffect, useState } from 'react'
import { deleteCloudSave, fetchCloudSave, leaderboard, type Row } from '../../game/api'
import { audio } from '../../game/audio/audio'
import { DIFFICULTY, DIFF_ORDER, type Difficulty } from '../../game/difficulty'
import { loadExplored } from '../../game/explore'
import { G, clearSave, loadSave, newGameData, useGame, type SaveFile } from '../../game/state'
import { fr } from '../../i18n/fr'
import { requestLock } from '../../player/Player'
import { AchievementsPanel, Credits } from './Screens'

// Menu principal (maquette « Poste de commande ») : partie en cours + classement Global / Semaine.

const M = fr.menu2

/** initiales affichées dans les pastilles (comme sur la maquette : LÉ, KE, MA…) */
export const initials = (charId?: string) => (fr.characters[charId ?? 'nova']?.name ?? 'NO').slice(0, 2).toUpperCase()

export function Avatar({ charId, big }: { charId?: string; big?: boolean }) {
  const c = fr.characters[charId ?? 'nova']
  return (
    <span className={`mm-avatar ${big ? 'big' : ''}`} style={{ borderColor: c?.color ?? '#ff6b35', color: c?.color ?? '#ff6b35' }}>
      {initials(charId)}
    </span>
  )
}

const hms = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** énigmes résolues d'après une sauvegarde */
export function solvedCount(s: SaveFile) {
  const f = s.flags
  const list = [f.lockerOpen, f.pressurized, f.steamFixed, f.power && f.pw_sas && f.pw_terminal, f.readTerminal, s.planDone, f.engine, s.zone > 3, f.bridge, f.beacon]
  return { done: list.filter(Boolean).length, total: list.length }
}

function NewGameModal({ onClose }: { onClose: () => void }) {
  const [d, setD] = useState<Difficulty>('astronaut')
  const character = useGame((s) => s.user?.character ?? s.settings.character)
  const c = fr.characters[character]
  const start = async () => {
    await audio.init()
    clearSave()
    deleteCloudSave()
    loadExplored([])
    useGame.setState({ ...newGameData(character, d), screen: 'prologue', paused: false, tp: null, resume: null, tabletOpen: false, puzzle: null, readNote: null, lastResult: null })
  }
  return (
    <div className="modal-bg" style={{ zIndex: 60 }} onClick={onClose}>
      <div className="mm-panel mm-new" onClick={(e) => e.stopPropagation()} data-testid="new-game-modal">
        <div className="au-kicker">{M.newKicker}</div>
        <h2>{M.newTitle}</h2>
        <div className="mm-char-line">
          <Avatar charId={character} />
          <div>
            <b>
              {c.name} · {c.role}
            </b>
            <small>
              {c.ability} — {c.abilityDesc}
            </small>
          </div>
          <button className="au-link" onClick={() => useGame.setState({ screen: 'settings', settingsTab: 0 })}>
            {M.changeChar}
          </button>
        </div>
        <div className="mm-diffs">
          {DIFF_ORDER.map((x) => (
            <button key={x} data-testid={`diff-${x}`} className={`mm-diff ${d === x ? 'on' : ''} d-${x}`} onClick={() => setD(x)}>
              <b>{DIFFICULTY[x].name}</b>
              <small>{DIFFICULTY[x].desc}</small>
            </button>
          ))}
        </div>
        <button className="au-submit" data-testid="start" onClick={start}>
          {M.launch} <span aria-hidden>→</span>
        </button>
      </div>
    </div>
  )
}

function Board() {
  const [period, setPeriod] = useState<'all' | 'week'>('all')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    setRows(null)
    setErr(false)
    leaderboard('all', period)
      .then((r) => {
        setRows(r.rows)
        if (period === 'all') useGame.setState({ myRank: r.myRank })
      })
      .catch(() => setErr(true))
  }, [period])
  return (
    <section className="mm-panel mm-board" data-testid="leaderboard">
      <header>
        <h2>{fr.board.title}</h2>
        <div className="mm-tabs">
          <button className={period === 'all' ? 'on' : ''} onClick={() => setPeriod('all')}>
            {M.global}
          </button>
          <button className={period === 'week' ? 'on' : ''} onClick={() => setPeriod('week')}>
            {M.week}
          </button>
        </div>
      </header>
      <div className="mm-thead">
        <span>#</span>
        <span>{M.player}</span>
        <span>{M.time}</span>
      </div>
      <div className="mm-rows">
        {err && <p className="mm-empty">{fr.board.offline}</p>}
        {rows && !rows.length && <p className="mm-empty">{fr.board.empty}</p>}
        {rows?.map((r, i) => (
          <div key={i} className={`mm-row ${r.me ? 'me' : ''}`} title={`${DIFFICULTY[r.difficulty as Difficulty]?.name ?? ''} · ${r.hints} indice(s) · ${r.errors} erreur(s) · score ${r.score}`}>
            <span className={`mm-rank ${i < 3 ? 'top' : ''}`}>{String(i + 1).padStart(2, '0')}</span>
            <Avatar charId={r.avatar ?? r.character} />
            <span className="mm-name">
              {r.pseudo}
              {r.me ? ` ${M.you}` : ''}
            </span>
            <span className="mm-time">{hms(r.timeMs)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export function MainMenu() {
  const user = useGame((s) => s.user)
  const offline = useGame((s) => s.offline)
  const myRank = useGame((s) => s.myRank)
  const character = useGame((s) => s.user?.character ?? s.settings.character)
  const [save, setSave] = useState<SaveFile | null>(null)
  const [modal, setModal] = useState<null | 'new' | 'ach' | 'credits'>(null)
  useEffect(() => {
    const local = loadSave()
    setSave(local)
    fetchCloudSave().then((cloud) => {
      if (cloud && (!local || (cloud.savedAt ?? 0) > (local.savedAt ?? 0))) setSave(cloud)
    })
  }, [user])
  const resume = async () => {
    if (!save) return
    await audio.init()
    const { pos, yaw, savedAt, ...data } = save
    void savedAt
    loadExplored(data.explored)
    useGame.setState({ ...data, screen: 'playing', paused: false, cine: null, resume: pos ? { pos, yaw: yaw ?? 0 } : null, tp: null, tabletOpen: false, puzzle: null, readNote: null })
    requestLock()
  }
  const sc = save ? solvedCount(save) : null
  return (
    <div className="mm" data-testid="title">
      <header className="mm-head">
        <div className="mm-brand">
          <img src="/logo/badge-dark.png" alt="" />
          <div>
            <b>COSMOTRAP</b>
            <small>{M.post}</small>
          </div>
        </div>
        <div className="mm-head-right">
          <button className="mm-icon" title={M.achievements} data-testid="open-ach" onClick={() => setModal('ach')}>
            ★
          </button>
          <button className="mm-icon" title={fr.menu.credits} onClick={() => setModal('credits')}>
            ⓘ
          </button>
          <div className="mm-user">
            <Avatar charId={character} />
            <div>
              <b>{user?.pseudo ?? M.guest}</b>
              <small>{user ? (myRank ? `${M.rank} #${myRank}` : M.unranked) : offline ? M.offline : ''}</small>
            </div>
          </div>
          <button className="mm-icon gear" title={fr.menu.settings} data-testid="open-settings" onClick={() => useGame.setState({ screen: 'settings', settingsTab: 0 })}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="3.2" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
            </svg>
          </button>
        </div>
      </header>

      <div className="mm-grid">
        <div className="mm-left">
          <section className="mm-panel mm-mission">
            <div className="mm-planet" aria-hidden />
            <div className="mm-live">
              <i />
              {save ? M.inProgress : M.newMission}
            </div>
            <h1>{M.missionTitle}</h1>
            {save && sc ? (
              <>
                <div className="mm-stats">
                  <div>
                    <small>{M.elapsed}</small>
                    <b>{hms((save.playTime + save.penalty) * 1000)}</b>
                  </div>
                  <div>
                    <small>{M.puzzles}</small>
                    <b>
                      {sc.done} / {sc.total}
                    </b>
                  </div>
                </div>
                <div className="mm-progress">
                  {Array.from({ length: sc.total }).map((_, i) => (
                    <i key={i} className={i < sc.done ? 'on' : ''} />
                  ))}
                </div>
                <p className="mm-where">
                  {fr.zones[save.zone].name} · {fr.zones[save.zone].sub} · {DIFFICULTY[save.difficulty]?.name}
                </p>
                <button className="au-submit mm-cta" data-testid="continue" onClick={resume}>
                  {M.resume}
                </button>
              </>
            ) : (
              <>
                <p className="mm-pitch">{M.pitch}</p>
                <button className="au-submit mm-cta" data-testid="new-game" onClick={() => setModal('new')}>
                  {M.launchMission}
                </button>
              </>
            )}
          </section>
          {save && (
            <button className="mm-panel mm-newgame" data-testid="new-game" onClick={() => setModal('new')}>
              <span className="mm-plus">+</span>
              <span>
                <b>{M.newGame}</b>
                <small>{M.abandon}</small>
              </span>
              <span className="mm-chev">›</span>
            </button>
          )}
        </div>
        <Board />
      </div>
      {modal === 'new' && <NewGameModal onClose={() => setModal(null)} />}
      {modal === 'ach' && <AchievementsPanel onClose={() => setModal(null)} />}
      {modal === 'credits' && <Credits onClose={() => setModal(null)} />}
    </div>
  )
}

void G
