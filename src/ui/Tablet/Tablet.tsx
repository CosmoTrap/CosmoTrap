import { useEffect, useRef, useState } from 'react'
import { fr } from '../../i18n/fr'
import { ITEM_KIND, SURVIVAL_ITEMS } from '../../game/items'
import { allEnts, drinkPouch, entActive, hintFor, hintKey, puzzleStatus, requestHint, stepsState, useBattery, useItem, useO2 } from '../../game/logic'
import { GRID_MAPS, entWorld } from '../../game/maps'
import { BOUNDS, BRIDGE_X, RIVER_HALF, riverCenter } from '../../game/maps/zone4'
import { live, useGame } from '../../game/state'
import { CELL4, isExplored } from '../../game/explore'
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

// couleur de chaque pièce une fois explorée
const ROOM_COLORS = ['#ff8a5b', '#5bc6ff', '#b18cff', '#5bffb1', '#ffd45b', '#ff5bb0', '#7affea']

function MapTab() {
  const zone = useGame((s) => s.zone)
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let raf = 0
    let t = 0
    const map = zone < 4 ? GRID_MAPS[zone as 1 | 2 | 3] : null
    // Separate modules leave vacuum around the station. Fit its actual outline,
    // rather than including the empty grid origin in the tablet's framing.
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity
    map?.grid.forEach((row, z) => [...row].forEach((cell, x) => {
      if (cell === ' ') return
      x0 = Math.min(x0, x); x1 = Math.max(x1, x)
      z0 = Math.min(z0, z); z1 = Math.max(z1, z)
    }))
    const draw = () => {
      const c = ref.current
      if (!c) return
      t += 0.05
      const ctx = c.getContext('2d')!
      const W = c.width
      const H = c.height
      ctx.clearRect(0, 0, W, H)
      // grain de fond « radar »
      ctx.fillStyle = 'rgba(2,10,14,0.9)'
      ctx.fillRect(0, 0, W, H)
      ctx.strokeStyle = 'rgba(127,227,255,0.05)'
      for (let x = 0; x < W; x += 22) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, H)
        ctx.stroke()
      }
      for (let y = 0; y < H; y += 22) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(W, y)
        ctx.stroke()
      }
      let toPx: (x: number, z: number) => [number, number]
      if (map) {
        const gw = x1 - x0 + 1
        const gh = z1 - z0 + 1
        const ts = Math.min((W - 30) / gw, (H - 30) / gh)
        const ox = (W - gw * ts) / 2 - x0 * ts
        const oy = (H - gh * ts) / 2 - z0 * ts
        toPx = (x, z) => [ox + (x / 2) * ts, oy + (z / 2) * ts]
        map.grid.forEach((row, tz) =>
          [...row].forEach((ch, tx) => {
            if (ch === ' ' || !live.explored.has(`${zone}:${tx},${tz}`)) return
            const ri = map.rooms.findIndex((r) => tx >= r.rect[0] && tx <= r.rect[2] && tz >= r.rect[1] && tz <= r.rect[3])
            const room = map.rooms[ri]
            // The grid is a navigation mask; circular rooms have their own wall.
            if (ch === '#' && map.rooms.some((r) => r.shape === 'round' && tx >= r.rect[0] - 1 && tx <= r.rect[2] + 1 && tz >= r.rect[1] - 1 && tz <= r.rect[3] + 1)) return
            if (ch === '#') ctx.fillStyle = 'rgba(216,244,255,0.28)'
            else if (ch === 'W' || ch === 'V') ctx.fillStyle = 'rgba(127,227,255,0.85)'
            else if (ch === 'D') ctx.fillStyle = 'rgba(255,255,255,0.55)'
            else {
              const col = ROOM_COLORS[ri % ROOM_COLORS.length] ?? '#7fe3ff'
              ctx.fillStyle = room?.dark ? col + '33' : col + '55'
            }
            ctx.save()
            if (room?.shape === 'round') {
              ctx.beginPath()
              ctx.arc(ox + (room.rect[0] + room.rect[2] + 1) * ts / 2, oy + (room.rect[1] + room.rect[3] + 1) * ts / 2, (room.rect[2] - room.rect[0] + 1) * ts / 2, 0, Math.PI * 2)
              ctx.clip()
            }
            ctx.fillRect(ox + tx * ts, oy + tz * ts, ts - 0.6, ts - 0.6)
            ctx.restore()
          }),
        )
        ctx.font = '700 12px Rajdhani, sans-serif'
        ctx.textAlign = 'center'
        map.rooms.forEach((r, i) => {
          const cx = Math.floor((r.rect[0] + r.rect[2]) / 2)
          const cz = Math.floor((r.rect[1] + r.rect[3]) / 2)
          if (!live.explored.has(`${zone}:${cx},${cz}`)) return
          if (r.shape === 'round') {
            const radius = (r.rect[2] - r.rect[0] + 1) / 2
            const opening = Math.asin(0.5 / radius)
            const px = ox + (cx + 0.5) * ts, pz = oy + (cz + 0.5) * ts
            for (let q = 0; q < 4; q++) {
              const start = q * Math.PI / 2 + opening, end = (q + 1) * Math.PI / 2 - opening
              const arc = (a: number, b: number, color: string) => {
                ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 3
                ctx.arc(px, pz, radius * ts, Math.PI / 2 - a, Math.PI / 2 - b, true); ctx.stroke()
              }
              arc(start, end, '#9aabb5')
              arc(start + (end - start) * 10 / 32, start + (end - start) * 22 / 32, '#7fe3ff')
            }
            ctx.lineWidth = 1
          }
          ctx.fillStyle = ROOM_COLORS[i % ROOM_COLORS.length]
          const labelWidth = Math.max(5, r.rect[2] - r.rect[0] + 1) * ts - 4
          ctx.fillText((fr.rooms[r.name] ?? r.name).toUpperCase() + (r.dark ? ' ◐' : ''), ox + ((r.rect[0] + r.rect[2] + 1) / 2) * ts, oy + r.rect[1] * ts + 14, labelWidth)
        })
      } else {
        const bw = BOUNDS.x1 - BOUNDS.x0
        const bh = BOUNDS.z1 - BOUNDS.z0
        const sc = Math.min((W - 30) / bw, (H - 30) / bh)
        const ox = (W - bw * sc) / 2
        const oy = (H - bh * sc) / 2
        toPx = (x, z) => [ox + (x - BOUNDS.x0) * sc, oy + (z - BOUNDS.z0) * sc]
        for (let z = BOUNDS.z0; z < BOUNDS.z1; z += CELL4)
          for (let x = BOUNDS.x0; x < BOUNDS.x1; x += CELL4) {
            if (!isExplored(4, x + 1, z + 1)) continue
            const [px, py] = toPx(x, z)
            const river = Math.abs(z + CELL4 / 2 - riverCenter(x)) < RIVER_HALF + 1
            const pad = Math.hypot(x - 6, z + 60) < 8
            ctx.fillStyle = river ? 'rgba(90,168,255,0.55)' : pad ? 'rgba(216,244,255,0.35)' : z < -46 ? 'rgba(201,180,120,0.35)' : 'rgba(79,227,154,0.22)'
            ctx.fillRect(px, py, CELL4 * sc - 0.6, CELL4 * sc - 0.6)
          }
        if (isExplored(4, BRIDGE_X, riverCenter(BRIDGE_X))) {
          const [bx, by] = toPx(BRIDGE_X, riverCenter(BRIDGE_X))
          ctx.fillStyle = useGame.getState().flags.bridge ? '#c9a46a' : 'rgba(201,164,106,0.4)'
          ctx.fillRect(bx - 4, by - RIVER_HALF * sc - 6, 8, RIVER_HALF * 2 * sc + 12)
        }
        if (isExplored(4, 6, -60)) {
          const [hx, hy] = toPx(6, -60)
          ctx.font = '700 16px Rajdhani'
          ctx.fillStyle = 'rgba(216,244,255,0.9)'
          ctx.textAlign = 'center'
          ctx.fillText('H', hx, hy + 5)
        }
      }
      // points d'intérêt : seulement dans les lieux explorés
      for (const e of allEnts(zone)) {
        if (!e.dot || !entActive(e)) continue
        const { p } = entWorld(e)
        if (!isExplored(zone, p[0], p[2])) continue
        const [px, py] = toPx(p[0], p[2])
        ctx.fillStyle = DOT[e.dot]
        ctx.shadowColor = DOT[e.dot]
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.arc(px, py, 4.5, 0, Math.PI * 2)
        ctx.fill()
        ctx.shadowBlur = 0
      }
      // joueur + onde radar
      const [px, py] = toPx(live.pos[0], live.pos[2])
      const r = (t * 14) % 40
      ctx.strokeStyle = `rgba(255,255,255,${0.5 * (1 - r / 40)})`
      ctx.beginPath()
      ctx.arc(px, py, r, 0, Math.PI * 2)
      ctx.stroke()
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
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [zone])
  return (
    <div>
      <canvas ref={ref} width={880} height={380} data-testid="minimap" style={{ width: '100%', height: 'auto', borderRadius: 8 }} />
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
        <span style={{ color: 'rgba(216,244,255,.55)' }}>◐ pièce sombre · seuls les lieux explorés s’affichent</span>
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
