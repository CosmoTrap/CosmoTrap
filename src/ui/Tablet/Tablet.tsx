import { useEffect, useRef, useState } from 'react'
import { fr } from '../../i18n/fr'
import { ITEM_KIND, SURVIVAL_ITEMS } from '../../game/items'
import { allEnts, drinkPouch, entActive, hintFor, hintKey, puzzleStatus, requestHint, stepsState, useBattery, useItem, useO2 } from '../../game/logic'
import { GRID_MAPS, entWorld } from '../../game/maps'
import { BOUNDS, BRIDGE_X, RIVER_HALF, riverCenter } from '../../game/maps/zone4'
import { live, useGame } from '../../game/state'
import type { DotKind, ItemId } from '../../game/types'
import { closeTablet } from '../../player/Player'
import { ItemIcon } from '../Icons'

const T = fr.tablet
const DOT: Record<DotKind, string> = { key: '#ff6b35', res: '#7fe3ff', surv: '#4fe39a', exam: '#ffd23a', exit: '#c79bff' }

function Mission() {
  const zone = useGame((s) => s.zone)
  const hints = useGame((s) => s.hintsUsed)
  useGame((s) => s.flags)
  useGame((s) => s.inv)
  const shown = useGame((s) => s.hintsShown)
  const steps = stepsState(zone)
  const k1 = hintKey(1)
  const k2 = hintKey(2)
  const has1 = !!k1 && shown.includes(k1)
  const has2 = !!k2 && shown.includes(k2)
  return (
    <div>
      <h3>
        {fr.zones[zone].name} — {fr.zones[zone].sub}
      </h3>
      {steps.map((s) => (
        <div key={s.id} className={`step ${s.status}`}>
          <i />
          <span>{s.text}</span>
          <em>{s.status === 'done' ? T.done : s.status === 'current' ? T.current : T.todo}</em>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, flexWrap: 'wrap' }}>
        <button className="btn" data-testid="hint" disabled={has1 || !k1} onClick={() => requestHint(1)}>
          {fr.rules.hintLight}
        </button>
        <button className="btn" data-testid="hint2" disabled={!has1 || has2} onClick={() => requestHint(2)}>
          {fr.rules.hintStrong}
        </button>
        <small style={{ color: 'rgba(216,244,255,.6)' }}>{T.hintsUsed(hints)}</small>
      </div>
      {has1 && <div className="hint-box">💡 {hintFor(1)}</div>}
      {has2 && <div className="hint-box" style={{ borderStyle: 'solid' }}>🔑 {hintFor(2)}</div>}
    </div>
  )
}

function Puzzles() {
  useGame((s) => s.flags)
  useGame((s) => s.discovered)
  const zone = useGame((s) => s.zone)
  return (
    <div>
      {fr.puzzleList.map((p) => {
        const st = puzzleStatus(p)
        return (
          <div key={p.id} className={`step ${st === 'solved' ? 'done' : st === 'progress' ? 'current' : ''}`} style={{ alignItems: 'flex-start' }}>
            <i style={{ marginTop: 2 }} />
            <div>
              <div>
                Zone {p.zone} · {p.name} <small style={{ color: '#ff6b35' }}>· {p.domain}</small>
              </div>
              {st !== 'locked' && p.zone === zone && <small style={{ color: 'rgba(216,244,255,.6)' }}>{p.hint}</small>}
            </div>
            <em>{st === 'solved' ? T.solved : st === 'progress' ? T.inProgress : T.lockedP}</em>
          </div>
        )
      })}
    </div>
  )
}

function Bag() {
  const inv = useGame((s) => s.inv)
  const items = Object.keys(inv) as ItemId[]
  const surv = SURVIVAL_ITEMS.filter((k) => (inv[k] ?? 0) > 0).length
  const action = (it: ItemId) => {
    if (it === 'o2') useO2()
    else if (it === 'battery') useBattery()
    else if (it === 'water') drinkPouch()
    else useItem(it)
  }
  return (
    <div>
      {!items.length && <p>{T.empty}</p>}
      <div className="inv-grid">
        {items.map((it) => (
          <div key={it} className="inv-cell" data-testid={`inv-${it}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: ITEM_KIND[it] === 'resource' ? '#7fe3ff' : ITEM_KIND[it] === 'survival' ? '#4fe39a' : '#ff6b35' }}>
              <ItemIcon item={ITEM_KIND[it] === 'survival' ? 'survival' : it} />
              <b style={{ color: '#d8f4ff' }}>
                {fr.items[it].name} {(inv[it] ?? 0) > 1 ? `×${inv[it]}` : ''}
              </b>
            </div>
            <small>{fr.items[it].desc}</small>
            {fr.items[it].action && (
              <button className="btn" onClick={() => action(it)}>
                {fr.items[it].action}
              </button>
            )}
          </div>
        ))}
      </div>
      <p style={{ marginTop: 16, color: '#4fe39a' }}>{T.survivalCount(surv)}</p>
    </div>
  )
}

function Notebook() {
  const notes = useGame((s) => s.notes)
  if (!notes.length) return <p>{T.noNotes}</p>
  return (
    <div>
      {notes.map((n) => (
        <div key={n} className="note">
          <b>{fr.notes[n]?.title}</b>
          {fr.notes[n]?.text}
        </div>
      ))}
    </div>
  )
}

function MapTab() {
  const zone = useGame((s) => s.zone)
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let raf = 0
    const draw = () => {
      const c = ref.current
      if (!c) return
      const ctx = c.getContext('2d')!
      const W = c.width
      const H = c.height
      ctx.clearRect(0, 0, W, H)
      let toPx: (x: number, z: number) => [number, number]
      let scale: number
      if (zone < 4) {
        const map = GRID_MAPS[zone as 1 | 2 | 3]
        const gw = Math.max(...map.grid.map((r) => r.length))
        const gh = map.grid.length
        const ts = Math.min((W - 20) / gw, (H - 20) / gh)
        const ox = (W - gw * ts) / 2
        const oy = (H - gh * ts) / 2
        scale = ts / 2
        toPx = (x, z) => [ox + (x / 2) * ts, oy + (z / 2) * ts]
        map.grid.forEach((row, tz) =>
          [...row].forEach((ch, tx) => {
            if (ch === ' ') return
            const room = map.rooms.find((r) => tx >= r.rect[0] && tx <= r.rect[2] && tz >= r.rect[1] && tz <= r.rect[3])
            ctx.fillStyle = ch === '#' ? 'rgba(127,227,255,0.22)' : ch === 'W' || ch === 'V' ? 'rgba(127,227,255,0.55)' : ch === 'D' ? 'rgba(255,255,255,0.35)' : room?.dark ? 'rgba(10,30,40,0.9)' : 'rgba(127,227,255,0.07)'
            ctx.fillRect(ox + tx * ts, oy + tz * ts, ts - 0.5, ts - 0.5)
          }),
        )
        ctx.font = '600 11px Rajdhani, sans-serif'
        ctx.fillStyle = 'rgba(216,244,255,0.55)'
        ctx.textAlign = 'center'
        for (const r of map.rooms) ctx.fillText((fr.rooms[r.name] ?? r.name).toUpperCase(), ox + ((r.rect[0] + r.rect[2] + 1) / 2) * ts, oy + r.rect[1] * ts + 13)
      } else {
        const bw = BOUNDS.x1 - BOUNDS.x0
        const bh = BOUNDS.z1 - BOUNDS.z0
        const s = Math.min((W - 20) / bw, (H - 20) / bh)
        const ox = (W - bw * s) / 2
        const oy = (H - bh * s) / 2
        scale = s
        toPx = (x, z) => [ox + (x - BOUNDS.x0) * s, oy + (z - BOUNDS.z0) * s]
        ctx.fillStyle = 'rgba(79,227,154,0.08)'
        ctx.fillRect(ox, oy, bw * s, bh * s)
        ctx.strokeStyle = 'rgba(90,168,255,0.7)'
        ctx.lineWidth = RIVER_HALF * 2 * s
        ctx.beginPath()
        for (let x = BOUNDS.x0; x <= BOUNDS.x1; x += 1) {
          const [px, py] = toPx(x, riverCenter(x))
          if (x === BOUNDS.x0) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.stroke()
        const fixed = useGame.getState().flags.bridge
        const [bx, by] = toPx(BRIDGE_X, riverCenter(BRIDGE_X))
        ctx.fillStyle = fixed ? '#c9a46a' : 'rgba(201,164,106,0.35)'
        ctx.fillRect(bx - 4, by - RIVER_HALF * s - 6, 8, RIVER_HALF * 2 * s + 12)
        const [hx, hy] = toPx(6, -60)
        ctx.strokeStyle = 'rgba(216,244,255,0.7)'
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.arc(hx, hy, 6 * s, 0, Math.PI * 2)
        ctx.stroke()
        ctx.font = '700 14px Rajdhani'
        ctx.fillStyle = 'rgba(216,244,255,0.8)'
        ctx.textAlign = 'center'
        ctx.fillText('H', hx, hy + 5)
      }
      // points d'intérêt
      for (const e of allEnts(zone)) {
        if (!e.dot || !entActive(e)) continue
        const { p } = entWorld(e)
        const [px, py] = toPx(p[0], p[2])
        ctx.fillStyle = DOT[e.dot]
        ctx.shadowColor = DOT[e.dot]
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.arc(px, py, 4.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }
      // joueur
      const [px, py] = toPx(live.pos[0], live.pos[2])
      ctx.save()
      ctx.translate(px, py)
      ctx.rotate(-live.yaw)
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.moveTo(0, -10)
      ctx.lineTo(6, 7)
      ctx.lineTo(0, 3)
      ctx.lineTo(-6, 7)
      ctx.closePath()
      ctx.fill()
      ctx.restore()
      void scale
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [zone])
  return (
    <div>
      <canvas ref={ref} width={880} height={380} style={{ width: '100%', height: 'auto', borderRadius: 8, background: 'rgba(0,0,0,0.25)' }} />
      <div className="legend">
        {(Object.keys(DOT) as DotKind[]).map((k) => (
          <span key={k}>
            <i style={{ background: DOT[k] }} />
            {T.legend[k]}
          </span>
        ))}
        <span>
          <i style={{ background: '#fff' }} />
          {T.legend.you}
        </span>
      </div>
    </div>
  )
}

export function Tablet() {
  const tab = useGame((s) => s.tab)
  const character = useGame((s) => s.character)
  const ch = fr.characters[character]
  const body = [<Mission key={0} />, <Puzzles key={1} />, <Bag key={2} />, <Notebook key={3} />, <MapTab key={4} />][tab]
  return (
    <div className="modal-bg" onClick={closeTablet} data-testid="tablet">
      <div className="tablet" onClick={(e) => e.stopPropagation()}>
        <div className="screen">
          <div className="tabs">
            {T.tabs.map((t, i) => (
              <button key={t} data-testid={`tab-${i}`} className={tab === i ? 'on' : ''} onClick={() => useGame.setState({ tab: i })}>
                {t}
              </button>
            ))}
          </div>
          <div className="tab-body">{body}</div>
        </div>
        <div className="tablet-foot">
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="portrait" style={{ background: `radial-gradient(circle at 50% 38%, #c99a35 0 30%, ${ch?.color ?? '#888'} 31%)` }} />
            {ch?.name} · {ch?.role}
          </span>
          <button className="btn ghost" onClick={closeTablet}>
            {T.close}
          </button>
        </div>
      </div>
    </div>
  )
}
