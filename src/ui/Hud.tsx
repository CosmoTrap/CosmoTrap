import { useEffect, useRef, useState } from 'react'
import { fr } from '../i18n/fr'
import { stepsState } from '../game/logic'
import { Hotbar } from './Inventory'
import { timeLimit, live, useGame } from '../game/state'
import { isTouch, requestLock } from '../player/Player'
import { keyName, padButtonName } from '../player/input'
import { GaugeIcon } from './Icons'
import { fmtTime } from '../game/api'
import { gridMap } from '../game/maps'

function Gauge({ kind, value, color, label }: { kind: 'hp' | 'o2' | 'lamp' | 'water'; value: number; color: string; label: string }) {
  const low = value < 25
  const beat = kind === 'o2' && low ? 60 / (70 + 80 * (1 - value / 25)) : 0
  return (
    <div className={`gauge ${low ? 'low' : ''} ${beat ? 'beat' : ''}`} title={label} style={beat ? ({ '--beat': `${beat}s` } as React.CSSProperties) : undefined}>
      <GaugeIcon kind={kind} />
      <div className="bar">
        <div className="fill" style={{ width: `${Math.max(0, value)}%`, background: low ? '#ff5a4a' : color }} />
      </div>
      <span>{Math.round(value)}%</span>
    </div>
  )
}

function Objective() {
  const zone = useGame((s) => s.zone)
  useGame((s) => s.flags)
  useGame((s) => s.inv)
  useGame((s) => s.notes)
  const [room, setRoom] = useState('')
  useEffect(() => {
    const id = setInterval(() => setRoom(live.roomId), 400)
    return () => clearInterval(id)
  }, [])
  const cur = stepsState(zone).find((s) => s.status === 'current')
  return (
    <div className="objective">
      <b>
        {fr.zones[zone].name} · {fr.zones[zone].sub}
      </b>
      {cur && <span>{cur.text}</span>}
      {room && <div className="room">{fr.rooms[gridMap(zone)?.rooms.find((r) => r.id === room)?.name ?? room] ?? ''}</div>}
    </div>
  )
}

/** fondus, flash, carte de zone, compte à rebours (pilotés par les cinématiques) */
function CineOverlay() {
  const fade = useRef<HTMLDivElement>(null)
  const flash = useRef<HTMLDivElement>(null)
  const [card, setCard] = useState<typeof live.card>(null)
  const [cd, setCd] = useState<string | null>(null)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      if (fade.current) fade.current.style.opacity = String(live.fade)
      if (flash.current) flash.current.style.opacity = String(live.flash)
      setCard((c) => (c?.a === live.card?.a && c?.title === live.card?.title ? c : live.card ? { ...live.card } : null))
      setCd((c) => (c === live.countdown ? c : live.countdown))
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <>
      <div className="fade" ref={fade} style={{ opacity: 0 }} />
      <div className="flash" ref={flash} style={{ opacity: 0 }} />
      {card && card.a > 0 && (
        <div className="zonecard" style={{ opacity: card.a }}>
          <div>
            <h1>{card.title}</h1>
            <p>{card.sub}</p>
            <div className="rule" />
          </div>
        </div>
      )}
      {cd && <div className="countdown">{cd}</div>}
    </>
  )
}

function Chrono() {
  const t = useGame((s) => s.playTime + s.penalty)
  const errors = useGame((s) => s.errors)
  const ev = useGame((s) => s.event)
  const playTime = useGame((s) => s.playTime)
  const ghostOn = useGame((s) => s.settings.ghost)
  useGame((s) => s.difficulty)
  const left = Math.max(0, timeLimit() - t)
  const mm = Math.floor(left / 60)
  const ss = Math.floor(left % 60)
  return (
    <div className={`chrono ${left < 180 ? 'low' : ''} ${left < 60 ? 'urgent' : ''}`} data-testid="chrono">
      <small>
        {fr.rules.chrono}
        {errors ? ` · ${fr.rules.errors} ${errors}` : ''}
      </small>
      {mm}:{String(ss).padStart(2, '0')}
      {ev && (
        <div className={`event-tag ${ev.kind}`} data-testid="event">
          {ev.kind === 'blackout' ? '⚡ Coupure de courant' : '💨 Micro-fuite'} · {Math.max(0, Math.ceil(ev.until - playTime))} s
        </div>
      )}
      {live.ghost && ghostOn && <div className="ghost-tag">Fantôme : {live.ghost.pseudo} · {fmtTime(live.ghost.timeMs)}</div>}
    </div>
  )
}

/** bannière « Énigme résolue » animée */
function Banner() {
  const [b, setB] = useState<typeof live.banner>(null)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      const cur = live.banner
      if (cur && performance.now() - cur.t > 3600) live.banner = null
      setB((old) => (old === live.banner ? old : live.banner))
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])
  if (!b) return null
  return (
    <div className="banner" key={b.t} data-testid="banner">
      <small>{b.title}</small>
      <b>{b.sub}</b>
    </div>
  )
}

function PenaltyFlash() {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      live.penaltyFlash = Math.max(0, live.penaltyFlash - 0.025)
      if (ref.current) ref.current.style.opacity = String(live.penaltyFlash)
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])
  return <div className="penalty-flash" ref={ref} style={{ opacity: 0 }} />
}

/** rappel « verrouiller la souris » : affiché quelques secondes seulement, puis disparaît */
function LockHint() {
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 6000)
    return () => clearTimeout(t)
  }, [])
  if (!show) return null
  return (
    <div className="click-to-play" style={{ pointerEvents: 'auto' }} onClick={requestLock}>
      {fr.menu.clickToPlay}
    </div>
  )
}

function Fps() {
  const show = useGame((s) => s.settings.showFps)
  const [v, setV] = useState(0)
  useEffect(() => {
    if (!show) return
    const id = setInterval(() => setV(Math.round(live.fps)), 500)
    return () => clearInterval(id)
  }, [show])
  return show ? <div className="fps">{v} i/s</div> : null
}

export function Hud() {
  const res = useGame((s) => s.res)
  const zone = useGame((s) => s.zone)
  const label = useGame((s) => s.aimLabel)
  const toasts = useGame((s) => s.toasts)
  const subtitle = useGame((s) => s.subtitle)
  const cine = useGame((s) => s.cine)
  const locked = useGame((s) => s.locked)
  const overlay = useGame((s) => s.tabletOpen || !!s.puzzle || !!s.readNote || s.paused || s.settingsOpen)
  const keys = useGame((s) => s.settings.keys)
  const padActive = useGame((s) => s.padActive)
  const padType = useGame((s) => s.settings.padType)
  const padAct = useGame((s) => s.settings.pad.act)
  const character = useGame((s) => s.character)
  const briefer = character === 'ines' ? 'kenji' : 'ines'
  const showChrono = useGame((s) => s.settings.showChrono)
  const subsOn = useGame((s) => s.settings.subtitles)
  const touch = isTouch()
  const showUi = !cine || cine === 'briefing'
  return (
    <div className="layer" style={{ pointerEvents: 'none' }}>
      {showUi && (
        <>
          <div className="hud-top">
            <Gauge kind="hp" value={res.hp} color="#7ee08a" label={fr.hud.hp} />
            {zone < 4 && <Gauge kind="o2" value={res.o2} color="#7fe3ff" label={fr.hud.o2} />}
            <Gauge kind="lamp" value={res.lamp} color="#ffd27a" label={fr.hud.lamp} />
            <Gauge kind="water" value={res.water} color="#5aa8ff" label={fr.hud.water} />
          </div>
          <Objective />
          {showChrono && <Chrono />}
          {!overlay && (
            <>
              <div className={`reticle ${label ? 'on' : ''}`} />
              {label && (
                <div className="prompt">
                  <span className={`key ${padActive ? 'pad-a' : ''}`}>{padActive ? padButtonName(padType, padAct) : touch ? fr.hud.act : keyName(keys.act[0])}</span>
                  {label}
                </div>
              )}
            </>
          )}
          {!overlay && <Hotbar />}
        </>
      )}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.kind ?? ''}`}>
            {t.text}
          </div>
        ))}
      </div>
      {subtitle && (subsOn || cine === 'briefing' || cine === 'tour') && (
        <div className="subtitle">
          {cine === 'briefing' && <small>{fr.briefingFrom(fr.characters[briefer].name)}</small>}
          {subtitle}
        </div>
      )}
      <PenaltyFlash />
      <Banner />
      <CineOverlay />
      {!touch && !locked && !overlay && !cine && <LockHint />}
      <Fps />
    </div>
  )
}
