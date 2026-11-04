import { useEffect, useState } from 'react'
import { deleteCloudSave, fetchCloudSave, leaderboard, type Row } from '../../game/api'
import { audio } from '../../game/audio/audio'
import { DIFFICULTY, type Difficulty } from '../../game/difficulty'
import { loadExplored } from '../../game/explore'
import { clearSave, loadSave, newGameData, useGame, type MissionMap, type SaveFile } from '../../game/state'
import { fr } from '../../i18n/fr'
import { requestLock } from '../../player/Player'
import { GearIcon, openPage, Stage } from './Stage'

// Menu principal (maquette 03 « Poste de commande ») : partie en cours + classement.

const M = fr.menu2

/** initiales affichées dans les pastilles (comme sur la maquette : LÉ, KE, MA…) */
export const initials = (charId?: string) => (fr.characters[charId ?? 'nova']?.name ?? 'NO').slice(0, 2).toUpperCase()

export function Avatar({ charId, me }: { charId?: string; me?: boolean }) {
  return <span className={`x-avatar ${me ? 'me' : ''}`}>{initials(charId)}</span>
}

export const hms = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  return `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

/** énigmes résolues d'après une sauvegarde */
export function solvedCount(s: SaveFile) {
  const f = s.flags
  const list = [f.lockerOpen, f.pressurized, f.steamFixed, f.power && f.pw_sas && f.pw_terminal, f.readTerminal, s.planDone, f.engine, s.zone > 3, f.bridge, f.beacon]
  return { done: list.filter(Boolean).length, total: list.length }
}

/** nouvelle partie : efface la sauvegarde et lance le prologue */
export async function startNewGame(character: string, d: Difficulty, map: MissionMap) {
  await audio.init()
  clearSave()
  deleteCloudSave()
  loadExplored([])
  useGame.setState({ ...newGameData(character, d, map), screen: 'prologue', paused: false, tp: null, resume: null, tabletOpen: false, puzzle: null, readNote: null, lastResult: null })
}

export async function resumeGame(save: SaveFile) {
  await audio.init()
  const { pos, yaw, savedAt, ...data } = save
  void savedAt
  loadExplored(data.explored)
  useGame.setState({ ...data, screen: 'playing', paused: false, cine: null, resume: pos ? { pos, yaw: yaw ?? 0 } : null, tp: null, tabletOpen: false, puzzle: null, readNote: null })
  requestLock()
}

/** la sauvegarde la plus récente l'emporte (locale ou dans le compte) */
export function useCurrentSave() {
  const user = useGame((s) => s.user)
  const [save, setSave] = useState<SaveFile | null>(null)
  useEffect(() => {
    const local = loadSave()
    setSave(local)
    fetchCloudSave().then((cloud) => {
      if (cloud && (!local || (cloud.savedAt ?? 0) > (local.savedAt ?? 0))) setSave(cloud)
    })
  }, [user])
  return save
}

function Board() {
  const [period, setPeriod] = useState<'all' | 'week'>('all')
  const [map, setMap] = useState<MissionMap>(useGame.getState().settings.map)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState(false)
  useEffect(() => {
    setRows(null)
    setErr(false)
    leaderboard('all', period, map)
      .then((r) => {
        setRows(r.rows)
        if (period === 'all') useGame.setState({ myRank: r.myRank })
      })
      .catch(() => setErr(true))
  }, [period, map])
  const L = fr.launch
  return (
    <section className="x-panel mm-board" data-testid="leaderboard">
      <header>
        <h2>{fr.board.title}</h2>
        <div className="mm-period">
          <button type="button" className={period === 'all' ? 'on' : ''} onClick={() => setPeriod('all')}>
            {M.global}
          </button>
          <button type="button" className={period === 'week' ? 'on' : ''} onClick={() => setPeriod('week')}>
            {M.week}
          </button>
        </div>
      </header>
      <div className="mm-maps">
        {(['base', 'station'] as MissionMap[]).map((id, i) => (
          <button key={id} type="button" data-testid={`board-map-${id}`} className={map === id ? 'on' : ''} onClick={() => setMap(id)}>
            <small>0{i + 1}</small> {L.maps[id].name}
          </button>
        ))}
      </div>
      <div className="mm-thead">
        <span>#</span>
        <span>{M.player}</span>
        <span>{M.time}</span>
      </div>
      <div className="x-rows">
        {err && <p className="x-empty">{fr.board.offline}</p>}
        {rows && !rows.length && <p className="x-empty">{fr.board.empty}</p>}
        {rows?.map((r, i) => (
          <div key={i} className={`x-row ${r.me ? 'me' : ''}`} title={`${DIFFICULTY[r.difficulty as Difficulty]?.name ?? ''} · ${r.hints} indice(s) · ${r.errors} erreur(s) · score ${r.score}`}>
            <span className={`x-rank r${i + 1}`}>{String(i + 1).padStart(2, '0')}</span>
            <Avatar charId={r.avatar ?? r.character} />
            <span className="x-name">
              {r.pseudo}
              {r.me ? ` ${M.you}` : ''}
            </span>
            <span className="x-time">{hms(r.timeMs)}</span>
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
  const map = useGame((s) => s.settings.map)
  const difficulty = useGame((s) => s.settings.difficulty)
  const save = useCurrentSave()
  const L = fr.launch
  const sc = save ? solvedCount(save) : null
  const shownMap = save?.map ?? map
  const mapInfo = L.maps[shownMap]
  return (
    <Stage testId="title">
      <header className="x-brand wide">
        <img src="/logo/badge-dark.png" alt="" />
        <div>
          <b>COSMOTRAP</b>
          <small>{M.post}</small>
        </div>
      </header>
      <div className="mm-user" data-testid="user-chip">
        <Avatar charId={character} me />
        <div>
          <b>{user?.pseudo ?? M.guest}</b>
          <small>{user ? (myRank ? `${M.rank} #${myRank}` : M.unranked) : offline ? M.offline : ''}</small>
        </div>
      </div>
      <button type="button" className="x-tbtn square mm-gear" title={fr.menu.settings} data-testid="open-settings" onClick={() => openPage('settings', { settingsTab: 0 })}>
        <GearIcon />
      </button>

      <section className="x-panel mm-mission">
        <svg className="mm-planet" viewBox="0 0 602 588" aria-hidden>
          <defs>
            <radialGradient id="mm-pl" cx="66%" cy="68%" r="60%">
              <stop offset="0" stopColor="#FF8A5B" />
              <stop offset="0.5" stopColor="#CF5A2C" />
              <stop offset="1" stopColor="#B4471C" />
            </radialGradient>
          </defs>
          <circle cx="520" cy="521" r="181" fill="url(#mm-pl)" />
          <path d="M262 476 C330 425 470 382 602 363" fill="none" stroke="#F3F1EC" strokeWidth="4" />
          <path d="M340 518 C430 514 530 492 602 466" fill="none" stroke="#F3F1EC" strokeWidth="4" />
        </svg>
        <div className="mm-live">
          <i />
          {save ? M.inProgress : M.newMission}
        </div>
        <h1>{mapInfo.mission}</h1>
        <div className="mm-chip">
          <span>{L.card(shownMap === 'base' ? 1 : 2)}</span>
          <b>{mapInfo.name}</b>
          <small>{mapInfo.chip}</small>
        </div>
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
            <button type="button" className="x-primary mm-cta" data-testid="continue" onClick={() => resumeGame(save)}>
              {M.resume}
            </button>
          </>
        ) : (
          <>
            <p className="mm-pitch">{M.pitch}</p>
            <button type="button" className="x-primary mm-cta" data-testid="launch-mission" onClick={() => startNewGame(character, difficulty, map)}>
              {M.launchMission}
            </button>
          </>
        )}
      </section>
      <button type="button" className="x-panel mm-new" data-testid="new-game" onClick={() => useGame.setState({ screen: 'launch' })}>
        <span className="mm-plus">+</span>
        <span className="mm-new-txt">
          <b>{M.newGame}</b>
          <small>{M.abandon}</small>
        </span>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </button>
      <Board />
    </Stage>
  )
}
