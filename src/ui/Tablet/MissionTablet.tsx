import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { allEnts, entActive, hintFor, hintKey, puzzleStatus, requestHint, stepsState } from '../../game/logic'
import { GRID_MAPS, entWorld, roomAt } from '../../game/maps'
import { isExplored } from '../../game/explore'
import { live, timeLimit, useGame, type MissionMessage, type TabletTab } from '../../game/state'
import type { RoomDef, ZoneId } from '../../game/types'
import { fr } from '../../i18n/fr'
import { closeTablet } from '../../player/Player'
import { labelFor, matches } from '../../player/input'
import { InventoryContent } from '../Inventory'
import { roomPowerCut } from '../../world/roomPower'
import { StationMap } from './StationMap'
import { elapsed, levelName, tabletText } from './copy'
import './tablet.css'

const ZONES: ZoneId[] = [1, 2, 3, 4]

function MissionProgress({ zone }: { zone: ZoneId }) {
  useGame((s) => s.flags)
  useGame((s) => s.inv)
  useGame((s) => s.notes)
  useGame((s) => s.planDone)
  useGame((s) => s.choice)
  const activeZone = useGame((s) => s.zone)
  const steps = stepsState(zone)
  const complete = steps.filter((s) => s.status === 'done').length
  const t = tabletText()
  return <section className="nav-card nav-progress">
    <div className="nav-eyebrow">MISSION · {complete} / {steps.length}</div>
    <progress max={steps.length} value={complete} aria-label={t.progress} />
    <ol>{steps.map((s, i) => <li key={s.id} className={s.status === 'current' && activeZone !== zone ? 'todo' : s.status}>
      <i>{s.status === 'done' ? '✓' : s.status === 'current' && activeZone === zone ? '›' : '·'}</i><span>{i + 1}. {s.text}</span>
    </li>)}</ol>
  </section>
}

function Plan() {
  const currentZone = useGame((s) => s.zone)
  // Local outages also change with mission time while the terminal is open.
  useGame((s) => Math.floor(s.playTime))
  const [zone, setZone] = useState<ZoneId>(currentZone)
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
  return <div className="nav-plan-layout">
    <section className="nav-map-panel nav-card">
      <header className="nav-map-head"><span className="nav-eyebrow">{zone < 3 ? 'SELENE-7' : levelName(zone).toUpperCase()} · {t.map}</span><div className="nav-levels" aria-label={t.level}>
        {ZONES.filter((z) => z <= Math.max(2, currentZone)).map((z) => <button key={z} data-testid={`map-level-${z}`} className={zone === z ? 'on' : ''} aria-pressed={zone === z} onClick={() => changeZone(z)}>{levelName(z)}{z === currentZone && <i />}</button>)}
      </div></header>
      <StationMap key={zone} zone={zone} selected={selected} onSelect={select} />
      <footer className="nav-legend"><span><i className="you" />{t.you}</span><span><i className="unlocked" />{t.unlocked}</span><span><i className="locked" />{t.locked}</span><span><i className="object" />{t.objects}</span></footer>
    </section>
    <aside className="nav-sidebar">
      <section className="nav-card nav-module">
        <div className="nav-eyebrow">{t.module} · {levelName(zone).toUpperCase()}</div>
        <h2>{room ? fr.rooms[room.name] ?? room.name : t.select}</h2>
        <p className={`nav-status ${known ? 'good' : ''}`}>{room ? known ? t.visited : t.unknown : t.selectRoom}</p>
        <div className="nav-module-drawing" aria-hidden="true"><svg viewBox="0 0 180 90"><defs><pattern id="module-lines" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M10 0H0V10" fill="none" stroke="#66749f" strokeWidth=".3" /></pattern></defs>
          {room?.shape === 'round' ? <><circle cx="90" cy="45" r="35" fill="url(#module-lines)" stroke="#a6b7cf" strokeWidth="2" /><circle cx="90" cy="45" r="24" fill="none" stroke="#778fb7" strokeDasharray="5 5" /><circle cx="90" cy="45" r="10" fill="#487da9" /></> : <><rect x="25" y="13" width="130" height="64" rx="7" fill="url(#module-lines)" stroke="#a6b7cf" strokeWidth="2" /><path d="M65 77h50" stroke="#ff8a5b" strokeWidth="4" /></>}
        </svg></div>
        {room && <dl><div><dt>{t.power}</dt><dd data-testid="module-power">{room.noDynLight || roomPowerCut(room, zone) ? t.off : t.on}</dd></div><div><dt>{t.objects}</dt><dd>{known ? count : '—'}</dd></div></dl>}
        <p className="nav-description">{t.mapHelp}</p>
        <button className="nav-primary" onClick={() => useGame.setState({ tab: 1 })}>{t.journal}<span>→</span></button>
      </section>
      <MissionProgress zone={zone} />
    </aside>
  </div>
}

function HintPanel() {
  const shown = useGame((s) => s.hintsShown)
  const hints = useGame((s) => s.hintsUsed)
  const zone = useGame((s) => s.zone)
  const t = tabletText()
  const k1 = hintKey(1), k2 = hintKey(2)
  const first = !!k1 && shown.includes(k1), second = !!k2 && shown.includes(k2)
  const current = stepsState(zone).find((s) => s.status === 'current')
  return <section className="nav-card nav-assistance">
    <div className="nav-eyebrow">{t.hint}</div><h2>{t.current}</h2><p>{current?.text ?? t.noMission}</p>
    <button data-testid="hint" className="nav-primary" disabled={first || !k1} onClick={() => requestHint(1)}>{fr.rules.hintLight}</button>
    <button data-testid="hint2" className="nav-secondary" disabled={!first || second} onClick={() => requestHint(2)}>{fr.rules.hintStrong}</button>
    {first && <blockquote>{hintFor(1)}</blockquote>}{second && <blockquote>{hintFor(2)}</blockquote>}
    <small>{fr.tablet.hintsUsed(hints)}</small>
  </section>
}

function Journal() {
  const zone = useGame((s) => s.zone)
  useGame((s) => s.flags); useGame((s) => s.inv); useGame((s) => s.notes)
  useGame((s) => s.discovered); useGame((s) => s.planDone); useGame((s) => s.choice)
  const t = tabletText()
  return <div className="nav-journal" data-testid="mission-journal">
    <section className="nav-card nav-scroll"><header className="nav-section-head"><div className="nav-eyebrow">{t.allMissions}</div><h1>{t.missions}</h1></header>
      {ZONES.map((z) => {
        const steps = stepsState(z), remaining = steps.filter((s) => s.status !== 'done').length
        return <section key={z} className={`nav-mission-zone ${z === zone ? 'active' : ''}`} data-testid={`mission-zone-${z}`}>
          <header><span className="nav-zone-number">0{z}</span><div><h2>{fr.zones[z].name}</h2><small>{fr.zones[z].sub}</small></div><span>{remaining ? `${remaining} ${t.remaining}` : t.complete}</span></header>
          <ol>{steps.map((s) => {
            const status = s.status === 'current' && z !== zone ? 'todo' : s.status
            return <li key={s.id} className={status} data-testid={`mission-${z}-${s.id}`}><i>{status === 'done' ? '✓' : status === 'current' ? '›' : '·'}</i><span>{s.text}</span><small>{status === 'done' ? t.complete : status === 'current' ? t.current : t.pending}</small></li>
          })}</ol>
        </section>
      })}
      <section className="nav-puzzles"><div className="nav-eyebrow">{t.briefing}</div>{fr.puzzleList.map((p) => <div key={p.id}><span>{p.name}</span><small>{puzzleStatus(p) === 'solved' ? fr.tablet.solved : puzzleStatus(p) === 'progress' ? fr.tablet.inProgress : fr.tablet.lockedP}</small></div>)}</section>
    </section>
    <aside className="nav-sidebar"><HintPanel /><MissionProgress zone={zone} /></aside>
  </div>
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
  const textOf = (m: MissionMessage) => m.noteId ? fr.notes[m.noteId]?.text ?? m.text : m.text
  const titleOf = (m: MissionMessage) => m.noteId ? fr.notes[m.noteId]?.title ?? m.noteId : t[m.kind]
  return <section className="nav-messages nav-card" data-testid="message-archive">
    <header className="nav-section-head"><div><div className="nav-eyebrow">{t.communications}</div><h1>{t.tabs[2]} <small>{all.length}</small></h1></div><div className="nav-filters">{(['all', 'radio', 'system', 'document'] as const).map((kind) => <button key={kind} aria-pressed={filter === kind} onClick={() => { setFilter(kind); setSelected(null) }}>{t[kind]}</button>)}</div></header>
    {list.length ? <div className="nav-message-columns"><div className="nav-message-list">{list.map((m) => <button key={m.id} data-testid={`message-${m.id}`} className={message?.id === m.id ? 'on' : ''} onClick={() => setSelected(m.id)}><span className={`nav-message-type ${m.kind}`}>{m.kind === 'radio' ? '◉' : m.kind === 'document' ? '▤' : '⌁'}</span><span><b>{titleOf(m)}</b><small>{textOf(m)}</small></span><time>{m.id < 0 ? t.archive : elapsed(m.time)}</time></button>)}</div>
      {message && <article className="nav-message-detail" data-testid="message-detail"><div className="nav-eyebrow">{message.id < 0 ? t.archive : `${t.received} · ${elapsed(message.time)} · ${levelName(message.zone)}`}</div><h2>{titleOf(message)}</h2><p>{textOf(message)}</p><footer>{t.saved}</footer></article>}
    </div> : <div className="nav-empty"><span>⌁</span><h2>{t.empty}</h2><p>{t.emptyDetail}</p></div>}
  </section>
}

function Header({ tab, onTab }: { tab: TabletTab; onTab: (tab: TabletTab) => void }) {
  const zone = useGame((s) => s.zone)
  const res = useGame((s) => s.res)
  const time = useGame((s) => s.playTime + s.penalty)
  const t = tabletText()
  return <header className="nav-header">
    <div className="nav-brand"><img src="/logo/badge-dark.png" alt="" /><div><b>{zone < 3 ? 'SELENE-7' : zone === 3 ? 'HERMÈS' : 'TERRA'} · NAV</b><small>{t.terminal}</small></div></div>
    <nav className="nav-tabs" role="tablist" aria-label="Navigation"><>{t.tabs.map((label, i) => <button key={i} id={`tablet-tab-${i}`} role="tab" data-testid={`tab-${i}`} aria-selected={tab === i} aria-controls="tablet-panel" tabIndex={tab === i ? 0 : -1} onClick={() => onTab(i as TabletTab)} onKeyDown={(e) => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); const next = (i + (e.key === 'ArrowRight' ? 1 : 3)) % 4 as TabletTab; onTab(next); document.getElementById(`tablet-tab-${next}`)?.focus() } }}>{label}</button>)}</></nav>
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
          {tab === 0 ? <Plan /> : tab === 1 ? <Journal /> : tab === 2 ? <Messages /> : <InventoryContent />}
        </main>
        <footer className="nav-device-footer"><span>● SELENE SYSTEMS <small>/ PERSONAL NAVIGATION UNIT</small></span><span>{fr.characters[useGame.getState().character]?.name} · {levelName(useGame.getState().zone)}</span></footer>
      </div>
    </div>
    <div className="nav-help"><button onClick={closeTablet}><kbd>{labelFor(keys, 'tablet')}</kbd> {t.close}</button><span><kbd>↵</kbd> {t.navigate}</span><span>{tab === 0 ? t.scroll : tab === 2 ? t.messageHelp : ''}</span><button onClick={closeTablet}><kbd>{labelFor(keys, 'pause')}</kbd> {t.close}</button></div>
  </div>
}
