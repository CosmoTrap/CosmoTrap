import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { allEnts, entActive, hintFor, hintKey, requestHint, stepsState } from '../../game/logic'
import { GRID_MAPS, entWorld, roomAt } from '../../game/maps'
import { isExplored } from '../../game/explore'
import { live, timeLimit, useGame, type MissionMessage, type TabletTab } from '../../game/state'
import type { RoomDef, ZoneId } from '../../game/types'
import { fr } from '../../i18n/fr'
import { closeTablet } from '../../player/Player'
import { labelFor, matches } from '../../player/input'
import { InventoryContent } from '../Inventory'
import { alarmOn, roomPowerCut } from '../../world/roomPower'
import { StationMap, type MapMode } from './StationMap'
import { ModuleArt, roomCode, roomStatus, roomSteps } from './moduleArt'
import { elapsed, levelName, tabletText } from './copy'
import './tablet.css'
import { LunarPlan } from './LunarPlan'
import { missionNote } from '../../game/lunar/logic'

const ZONES: ZoneId[] = [1, 2, 3, 4]

/** The station carries its mission name; the rocket and Earth keep theirs. */
const brandName = (zone: ZoneId) => zone < 3 ? (useGame.getState().map === 'station' ? 'ORION' : 'SELENE-7') : zone === 3 ? 'HERMÈS' : 'TERRA'

function Plan() {
  const currentZone = useGame((s) => s.zone)
  // Local outages also change with mission time while the terminal is open.
  useGame((s) => Math.floor(s.playTime))
  const [zone, setZone] = useState<ZoneId>(currentZone)
  const [mode, setMode] = useState<MapMode>('plan')
  const [selected, setSelected] = useState<string | null>(() => currentZone < 4 ? roomAt(GRID_MAPS[currentZone as 1 | 2 | 3], live.pos[0], live.pos[2])?.id ?? null : null)
  useGame((s) => s.flags)
  useGame((s) => s.event)
  const t = tabletText()
  const map = zone < 4 ? GRID_MAPS[zone as 1 | 2 | 3] : null
  const room = map?.rooms.find((r) => r.id === selected)
  const changeZone = (z: ZoneId) => { setZone(z); setSelected(null) }
  const select = (r: RoomDef) => setSelected(r.id)
  const known = room && isExplored(zone, room.rect[0] + room.rect[2] + 1, room.rect[1] + room.rect[3] + 1)
  const count = room ? allEnts(zone).filter((e) => {
    const { p } = entWorld(e)
    return e.dot && entActive(e, zone) && isExplored(zone, p[0], p[2]) && map && roomAt(map, p[0], p[2])?.id === room.id
  }).length : 0
  const f = useGame.getState().flags
  const event = useGame.getState().event
  const alert = zone === 1 && !f.pressurized && alarmOn(1) ? t.alarm : event?.kind === 'blackout' ? t.blackout : event?.kind === 'leak' ? t.leak : zone === 2 && !f.power ? t.noPower : null
  const allSteps = stepsState(zone)
  const stationSolved = allSteps.filter((s) => s.status === 'done').length
  const status = room ? roomStatus(zone, room) : 'idle'
  const steps = room ? roomSteps(zone, room) : []
  const statusText = !room ? t.selectRoom : status === 'locked' ? t.statusLocked : status === 'solved' ? t.statusSolved : status === 'current' ? t.statusCurrent : known ? t.visited : t.unknown
  const pressure = zone === 1 && room?.id === 'sas' && !f.pressurized ? '0,2 bar' : zone === 2 && !f.pw_o2 ? '0,6 bar' : '0,9 bar'
  const [x0, z0, x1, z1] = room?.rect ?? [0, 0, 0, 0]
  const hints = useGame.getState().hintsUsed, errors = useGame.getState().errors
  return <div className="nav-plan-layout">
    <section className="nav-map-panel nav-card">
      <header className="nav-map-head">
        <span className="nav-eyebrow">{brandName(zone)} · {t.map} · 1:300</span>
        <div className="nav-levels" aria-label={t.level}>
          {ZONES.filter((z) => z <= Math.max(2, currentZone)).map((z) => <button key={z} data-testid={`map-level-${z}`} className={zone === z ? 'on' : ''} aria-pressed={zone === z} onClick={() => changeZone(z)}>{levelName(z)}</button>)}
        </div>
        {alert && <span className="nav-alert" data-testid="map-alert"><i />{alert}</span>}
        <div className="nav-levels nav-modes" aria-label={t.mapModes}>
          {(['plan', 'energy', 'oxygen'] as const).map((m, i) => <button key={m} data-testid={`map-mode-${m}`} className={mode === m ? 'on' : ''} aria-pressed={mode === m} onClick={() => setMode(m)}>{t.modes[i]}</button>)}
        </div>
      </header>
      <StationMap key={zone} zone={zone} selected={selected} onSelect={select} mode={mode} />
      <footer className="nav-legend">
        <span><i className="unlocked" />{t.legendSolved}</span><span><i className="current" />{t.legendCurrent}</span><span><i className="locked" />{t.legendLocked}</span>
        <span><i className="you" />{t.you}</span><span><i className="evac" />{t.legendEvac}</span>
        <b>{t.progressLabel} {stationSolved} / {allSteps.length}</b>
      </footer>
    </section>
    <aside className="nav-sidebar">
      <section className="nav-card nav-module">
        <div className="nav-eyebrow">{t.module} · {room ? `${roomCode(room, zone)} · ` : ''}{levelName(zone).toUpperCase()}</div>
        <h2>{room ? fr.rooms[room.name] ?? room.name : t.select}</h2>
        <p className={`nav-status ${status}`}>{statusText}</p>
        <div className="nav-module-drawing" aria-hidden="true">
          {room && !room.id.startsWith('liaison') && room.shape !== 'round' && <svg viewBox={`${x0 * 2 - 1} ${z0 * 2 - 1} ${(x1 - x0 + 1) * 2 + 2} ${(z1 - z0 + 1) * 2 + 2}`}><ModuleArt zone={zone} room={room} status={status} /></svg>}
          {room?.shape === 'round' && <svg viewBox="-9 -9 18 18"><circle r="7" fill="url(#nav-node)" stroke="#f0f3f7" strokeWidth=".08" /><circle r="4.9" fill="none" stroke="#7288ad" strokeWidth=".3" strokeDasharray="1.3 1" /><circle r="1.9" fill="#23304a" stroke="#d3d8e0" strokeWidth=".22" /><circle r="1.05" fill="#4f9dff" /></svg>}
          {room?.id.startsWith('liaison') && <svg viewBox="0 0 24 8"><rect x="1" y="2.5" width="22" height="3" fill="url(#nav-tube)" stroke="#5d6678" strokeWidth=".1" /></svg>}
        </div>
        {room && <div className="nav-metrics">
          <div><small>{t.pressure}</small><b>{pressure}</b></div>
          <div><small>{t.power}</small><b data-testid="module-power" className={room.noDynLight || roomPowerCut(room, zone) ? 'off' : ''}>{room.noDynLight || roomPowerCut(room, zone) ? t.off : t.on}</b></div>
        </div>}
        <p className="nav-description">{room ? (known ? t.visited : t.unknown) : t.mapHelp}</p>
        {room && <dl className="nav-rows">
          <div><dt>{t.tasks}</dt><dd>{steps.filter((s) => s.status === 'done').length} / {steps.length}</dd></div>
          <div><dt>{t.objects}</dt><dd>{known ? count : '—'}</dd></div>
          <div><dt>{t.mistakes}</dt><dd>{errors}</dd></div>
          <div><dt>{t.hintsUsedLabel}</dt><dd>{hints}</dd></div>
        </dl>}
      </section>
    </aside>
  </div>
}

/** Asking for help: a light hint, then a stronger one, each costing time. */
function HelpPanel() {
  const shown = useGame((s) => s.hintsShown)
  const hints = useGame((s) => s.hintsUsed)
  const zone = useGame((s) => s.zone)
  const t = tabletText()
  const k1 = hintKey(1), k2 = hintKey(2)
  const first = !!k1 && shown.includes(k1), second = !!k2 && shown.includes(k2)
  const current = stepsState(zone).find((s) => s.status === 'current')
  return <section className="nav-help-panel">
    <h2>{t.askHelp}</h2>
    <p>{t.current} : <b>{current?.text ?? t.noMission}</b></p>
    <div className="nav-help-actions">
      <button data-testid="hint" disabled={first || !k1} onClick={() => requestHint(1)}>{fr.rules.hintLight}</button>
      <button data-testid="hint2" disabled={!first || second} onClick={() => requestHint(2)}>{fr.rules.hintStrong}</button>
      <small>{fr.tablet.hintsUsed(hints)}</small>
    </div>
    {first && <blockquote>{hintFor(1)}</blockquote>}{second && <blockquote>{hintFor(2)}</blockquote>}
  </section>
}

function Messages() {
  const history = useGame((s) => s.messages)
  const notes = useGame((s) => s.notes)
  const [filter, setFilter] = useState<'all' | MissionMessage['kind']>('all')
  const [selected, setSelected] = useState<number | null>(null)
  const t = tabletText()
  // Old saves already contain documents: keep them readable even without a timestamp.
  const legacy: MissionMessage[] = notes.filter((id) => !history.some((m) => m.noteId === id)).map((id, i) => ({ id: -i - 1, text: id, noteId: id, kind: 'document', zone: 1, time: 0 }))
  const all = [...legacy, ...history].reverse()
  const list = all.filter((m) => filter === 'all' || m.kind === filter)
  const message = list.find((m) => m.id === selected) ?? list[0]
  const textOf = (m: MissionMessage) => m.noteId ? missionNote(m.noteId)?.text ?? m.text : m.text
  const titleOf = (m: MissionMessage) => m.noteId ? missionNote(m.noteId)?.title ?? m.noteId : t[m.kind]
  return <section className="nav-messages-sheet nav-card" data-testid="message-archive">
    <div className="nav-base-messages">
      <h1>{t.baseMessages}</h1>
      <ul>{(useGame.getState().map === 'base' ? ['Rétablir la liaison solaire, sécuriser les modules et certifier une sortie EVA.', 'Archiver les consignes ; les résultats validés sont conservés dans les transmissions.', 'Rejoindre LV-1 après le ravitaillement. La carte représente les modules et les couloirs réels.'] : fr.briefing).map((line) => <li key={line}>{line}</li>)}</ul>
      <HelpPanel />
    </div>
    <div className="nav-received">
      <header><h1>{t.communications} <small>{all.length}</small></h1>
        <div className="nav-filters">{(['all', 'radio', 'system', 'document'] as const).map((kind) => <button key={kind} className={filter === kind ? 'on' : ''} aria-pressed={filter === kind} data-testid={`message-filter-${kind}`} onClick={() => setFilter(kind)}>{t[kind]}</button>)}</div>
      </header>
      {list.length ? <>
        <div className="nav-message-list">{list.map((m) => <button key={m.id} data-testid={`message-${m.id}`} className={message?.id === m.id ? 'on' : ''} onClick={() => setSelected(m.id)}><small>{m.id < 0 ? t.archive : elapsed(m.time)} · {t[m.kind]}</small><span>{titleOf(m) === t[m.kind] ? textOf(m) : titleOf(m)}</span></button>)}</div>
        {message && <article className="nav-message-detail" data-testid="message-detail"><div className="nav-eyebrow">{message.id < 0 ? t.archive : `${t.received} · ${elapsed(message.time)} · ${levelName(message.zone)}`}</div><h2>{titleOf(message)}</h2><p>{textOf(message)}</p></article>}
      </> : <p className="nav-empty-line">{t.emptyDetail}</p>}
    </div>
  </section>
}

function Header({ tab, onTab }: { tab: TabletTab; onTab: (tab: TabletTab) => void }) {
  const zone = useGame((s) => s.zone)
  const res = useGame((s) => s.res)
  const time = useGame((s) => s.playTime + s.penalty)
  const t = tabletText()
  return <header className="nav-header">
    <div className="nav-brand"><img src="/logo/badge-dark.png" alt="" /><div><b>{brandName(zone)} · NAV</b><small>{t.terminal}</small></div></div>
    <nav className="nav-tabs" role="tablist" aria-label="Navigation"><>{([0, 2, 3] as TabletTab[]).map((i) => <button key={i} id={`tablet-tab-${i}`} role="tab" data-testid={`tab-${i}`} aria-selected={tab === i} aria-controls="tablet-panel" tabIndex={tab === i ? 0 : -1} onClick={() => onTab(i)} onKeyDown={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const tabs: TabletTab[] = [0, 2, 3]; const next = tabs[(tabs.indexOf(i) + (e.key === 'ArrowRight' ? 1 : 2)) % 3]; onTab(next); document.getElementById(`tablet-tab-${next}`)?.focus() } }}>{t.tabs[i]}</button>)}</></nav>
    <div className="nav-telemetry"><span><small>{t.clock}</small>{elapsed(timeLimit() - time)}</span><span className={res.o2 < 25 ? 'danger' : ''}><small>O₂</small>{Math.ceil(res.o2)}%</span><span><svg viewBox="0 0 25 14" aria-hidden="true"><rect x="1" y="1" width="20" height="12" rx="2" fill="none" stroke="currentColor" /><path d="M23 4v6" stroke="currentColor" strokeWidth="2" /><rect x="3" y="3" width={Math.max(0, res.lamp * .16)} height="8" rx="1" fill="currentColor" /></svg>{Math.ceil(res.lamp)}%</span></div>
    <button type="button" className="nav-close" onClick={closeTablet} aria-label={t.close} data-testid="close-tablet">×</button>
  </header>
}

export function Tablet() {
  const ready = useGame((s) => s.tabletReady)
  const tab = useGame((s) => s.tab)
  const keys = useGame((s) => s.settings.keys)
  const panel = useRef<HTMLDivElement>(null)
  const t = tabletText()
  useEffect(() => { if (ready) document.getElementById(`tablet-tab-${useGame.getState().tab}`)?.focus() }, [ready])
  const focusTrap = (e: KeyboardEvent) => {
    if (e.key !== 'Tab' || matches(keys, 'tablet', e.code) || matches(keys, 'inventory', e.code)) return
    e.stopPropagation()
    const buttons = [...(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]') ?? [])]
    if (e.shiftKey && document.activeElement === buttons[0]) { e.preventDefault(); buttons.at(-1)?.focus() }
    if (!e.shiftKey && document.activeElement === buttons.at(-1)) { e.preventDefault(); buttons[0]?.focus() }
  }
  if (!ready) return <div className="nav-raising" role="status" data-testid="tablet-raising"><i />{t.raising}<button onClick={closeTablet} aria-label={t.close}>×</button></div>
  return <div className="nav-backdrop" data-testid="tablet" onPointerDown={(e) => { if (e.target === e.currentTarget) closeTablet() }}>
    <div ref={panel} className="nav-device" role="dialog" aria-modal="true" aria-label="Terminal NAV" onKeyDown={focusTrap}>
      <i className="nav-camera" aria-hidden="true" />
      <div className="nav-display"><Header tab={tab} onTab={(next) => useGame.setState({ tab: next })} />
        <main id="tablet-panel" className="nav-content" role="tabpanel" aria-labelledby={`tablet-tab-${tab}`}>
          {tab === 0 ? (useGame.getState().map === 'base' ? <LunarPlan /> : <Plan />) : tab === 3 ? <InventoryContent /> : <Messages />}
        </main>
      </div>
    </div>
    <div className="nav-help">
      <button onClick={closeTablet}><kbd>{labelFor(keys, 'tablet')}</kbd> {t.close}</button>
      <span><kbd>{t.clickKey}</kbd> {t.selectModule}</span>
      <span><kbd>{t.wheelKey}</kbd> {t.zoomWord}</span>
      <span><kbd>{labelFor(keys, 'pause')}</kbd> {t.pauseWord}</span>
    </div>
  </div>
}
