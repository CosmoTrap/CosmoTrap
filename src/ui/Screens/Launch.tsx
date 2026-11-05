import { useEffect, useState } from 'react'
import { me, token } from '../../game/api'
import { DIFF_ORDER, type Difficulty } from '../../game/difficulty'
import { useGame, type MissionMap } from '../../game/state'
import { fr } from '../../i18n/fr'
import { deleteCurrentSave, hms, resumeGame, solvedCount, startNewGame, useCurrentSave } from './Menu'
import { update } from './Settings'
import { GearIcon, openPage, Stage } from './Stage'

// Écran de lancement (maquettes 00a / 00b) : choix de la carte et de la difficulté.

const MAPS: MissionMap[] = ['station', 'base']
const DIFF_LEVEL: Record<Difficulty, number> = { explorer: 1, astronaut: 2, survival: 3 }

export function Launch() {
  const L = fr.launch
  const user = useGame((s) => s.user)
  const offline = useGame((s) => s.offline)
  const map = useGame((s) => s.settings.map)
  const difficulty = useGame((s) => s.settings.difficulty)
  const character = useGame((s) => s.user?.character ?? s.settings.character)
  const current = useCurrentSave()
  const [deleted, setDeleted] = useState(false)
  // A slow answer from the account's save must not bring a deleted game back on screen.
  const save = deleted ? null : current
  const [confirm, setConfirm] = useState(false)
  const session = !!user || offline
  const sc = save ? solvedCount(save) : null

  useEffect(() => {
    // session déjà ouverte : on la reprend en silence
    if (useGame.getState().user || !token.get()) return
    me()
      .then((r) => {
        if (r.user) useGame.setState({ user: r.user })
        else token.set(null)
      })
      .catch(() => {})
  }, [])

  /** sans session, on passe d'abord par la connexion */
  const enter = () => useGame.setState({ screen: session ? 'title' : 'login' })
  const launch = () => {
    if (!session) return enter()
    startNewGame(character, difficulty, map)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (confirm || e.code !== 'Space' || e.repeat || (e.target as HTMLElement)?.tagName === 'BUTTON') return
      e.preventDefault()
      enter()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const m = L.maps[map]
  return (
    <Stage kind="launch" testId="launch">
      <header className="x-brand">
        <img src="/logo/badge-dark.png" alt="" />
        <div>
          <b>COSMOTRAP</b>
          <small>{L.brandSub}</small>
        </div>
      </header>
      <div className="la-top">
        <span className="la-version">{L.version}</span>
        <button type="button" className="x-tbtn" data-testid="open-ach" onClick={() => openPage('achievements')}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="9" r="5.5" />
            <path d="M8.5 13.5 7 21l5-2.6L17 21l-1.5-7.5" />
          </svg>
          {L.achievements}
        </button>
        <button type="button" className="x-tbtn" data-testid="open-credits" onClick={() => openPage('credits')}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5.5M12 7.6v.2" />
          </svg>
          {L.credits}
        </button>
        <button type="button" className="x-tbtn square" title={fr.menu.settings} data-testid="open-settings" onClick={() => openPage('settings', { settingsTab: 0 })}>
          <GearIcon />
        </button>
      </div>

      <div className="la-kicker">{L.kicker}</div>
      <h1 className="la-title">COSMOTRAP</h1>
      <p className="la-tagline">{L.tagline}</p>
      <div className="la-choose">{L.chooseMap}</div>

      <div className="la-maps">
        {MAPS.map((id, i) => (
          <button key={id} type="button" data-testid={`map-${id}`} className={`la-map ${map === id ? 'on' : ''}`} onClick={() => update({ map: id })}>
            <span className="la-map-top">
              <span>{L.card(i + 1)}</span>
              <span className="la-state">
                <i />
                {map === id ? L.selected : L.available}
              </span>
            </span>
            <b>{L.maps[id].name}</b>
            <small>{L.maps[id].sub}</small>
          </button>
        ))}
      </div>

      <div className="la-diff">
        <span className="la-diff-label">{L.difficulty}</span>
        {DIFF_ORDER.map((d) => (
          <button key={d} type="button" data-testid={`diff-${d}`} className={difficulty === d ? 'on' : ''} onClick={() => update({ difficulty: d })}>
            <span className="la-dots">
              {[1, 2, 3].map((n) => (
                <i key={n} className={n <= DIFF_LEVEL[d] ? 'on' : ''} />
              ))}
            </span>
            {d === 'explorer' ? L.easy : d === 'astronaut' ? L.normal : L.hard}
          </button>
        ))}
      </div>

      <button type="button" className="x-primary la-start" data-testid="start" onClick={launch}>
        {L.start} <span aria-hidden>→</span>
      </button>
      <button type="button" className="la-board" data-testid="open-board" onClick={enter}>
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#F26B3A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
        </svg>
        {L.board}
      </button>

      <div className={`la-resume ${save ? 'on' : ''}`}>
        <i className="la-resume-dot" />
        <div className="la-resume-txt">
          {save ? (
            <>
              <small>
                {fr.menu2.inProgress} · {L.maps[save.map].name}
              </small>
              <b>{L.maps[save.map].mission}</b>
            </>
          ) : (
            <>
              <small>{L.noSave}</small>
              <span>{L.noSaveText}</span>
            </>
          )}
        </div>
        <span className="la-resume-meta">{save && sc ? `${hms((save.playTime + save.penalty) * 1000)} · ${sc.done}/${sc.total}` : '–'}</span>
        <button type="button" data-testid="continue" disabled={!save} onClick={() => save && resumeGame(save)}>
          {L.resume}
          {save && <span aria-hidden> →</span>}
        </button>
        {save && (
          <button type="button" className="la-trash" data-testid="delete-save" title={L.deleteSave} aria-label={L.deleteSave} onClick={() => setConfirm(true)}>
            <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />
            </svg>
          </button>
        )}
      </div>

      <div className="la-press">{L.pressToStart}</div>
      <footer className="la-foot">
        <span>
          {L.footMap} · {m.name.toUpperCase()}
        </span>
        <span>{m.foot[0]}</span>
        <span>{m.foot[1]}</span>
        <span className="la-foot-end">{L.footCircle}</span>
      </footer>

      {confirm && (
        <div className="x-modal" onClick={() => setConfirm(false)}>
          <div className="x-panel x-confirm" data-testid="confirm-delete" onClick={(e) => e.stopPropagation()}>
            <h2>{L.confirmTitle}</h2>
            <p>{L.confirmText}</p>
            <div>
              <button type="button" className="x-ghost" onClick={() => setConfirm(false)}>
                {L.confirmNo}
              </button>
              <button type="button" className="x-primary" data-testid="confirm-delete-yes"
                onClick={() => {
                  deleteCurrentSave()
                  setDeleted(true)
                  setConfirm(false)
                }}
              >
                {L.confirmYes}
              </button>
            </div>
          </div>
        </div>
      )}
    </Stage>
  )
}

