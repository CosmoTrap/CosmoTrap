import { useEffect, useRef, useState } from 'react'
import { fr } from '../i18n/fr'
import { hotbarItems, stepsState, useItem } from '../game/logic'
import { TIME_LIMIT, live, useGame } from '../game/state'
import { isTouch, requestLock } from '../player/Player'
import { keyName } from '../player/input'
import { GaugeIcon, ItemIcon } from './Icons'

function Gauge({ kind, value, color, label }: { kind: 'o2' | 'lamp' | 'water'; value: number; color: string; label: string }) {
  const low = value < 25
  return (
    <div className={`gauge ${low ? 'low' : ''}`} title={label}>
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
      {room && <div className="room">{fr.rooms[room] ?? ''}</div>}
    </div>
  )
}

function Hotbar() {
  const inv = useGame((s) => s.inv)
  const held = useGame((s) => s.held)
  const lampOn = useGame((s) => s.lampOn)
  void inv
  const items = hotbarItems()
  if (!items.length) return null
  return (
    <>
      {held && <div className="held-name">{fr.items[held].name}</div>}
      <div className="hotbar">
        {items.map((it, i) => (
          <button
            key={it}
            className={`slot ${held === it || (it === 'lamp' && lampOn) ? 'held' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              useItem(it)
            }}
          >
            <span className="num">{i + 1}</span>
            <ItemIcon item={it} />
            {(inv[it] ?? 0) > 1 && <span className="cnt">×{inv[it]}</span>}
            <span className="tip">
              {fr.items[it].name}
              {fr.items[it].action ? ` · ${fr.items[it].action}` : ''}
            </span>
          </button>
        ))}
      </div>
    </>
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
  const left = Math.max(0, TIME_LIMIT - t)
  const mm = Math.floor(left / 60)
  const ss = Math.floor(left % 60)
  return (
    <div className={`chrono ${left < 180 ? 'low' : ''}`} data-testid="chrono">
      <small>
        {fr.rules.chrono}
        {errors ? ` · ${fr.rules.errors} ${errors}` : ''}
      </small>
      {mm}:{String(ss).padStart(2, '0')}
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
  const character = useGame((s) => s.character)
  const briefer = character === 'ines' ? 'kenji' : 'ines'
  const touch = isTouch()
  const showUi = !cine || cine === 'briefing'
  return (
    <div className="layer" style={{ pointerEvents: 'none' }}>
      {showUi && (
        <>
          <div className="hud-top">
            {zone < 4 && <Gauge kind="o2" value={res.o2} color="#7fe3ff" label={fr.hud.o2} />}
            <Gauge kind="lamp" value={res.lamp} color="#ffd27a" label={fr.hud.lamp} />
            <Gauge kind="water" value={res.water} color="#5aa8ff" label={fr.hud.water} />
          </div>
          <Objective />
          <Chrono />
          {!overlay && (
            <>
              <div className={`reticle ${label ? 'on' : ''}`} />
              {label && (
                <div className="prompt">
                  <span className="key">{touch ? fr.hud.act : keyName(keys.act[0])}</span>
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
      {subtitle && (
        <div className="subtitle">
          {cine === 'briefing' && <small>{fr.briefingFrom(fr.characters[briefer].name)}</small>}
          {subtitle}
        </div>
      )}
      <PenaltyFlash />
      <CineOverlay />
      {!touch && !locked && !overlay && !cine && (
        <div className="click-to-play" style={{ pointerEvents: 'auto' }} onClick={requestLock}>
          {fr.menu.clickToPlay}
        </div>
      )}
      <Fps />
    </div>
  )
}
