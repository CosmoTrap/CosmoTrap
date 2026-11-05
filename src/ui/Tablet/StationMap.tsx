import { useEffect, useMemo, useRef, useState } from 'react'
import { allEnts, doorUnlocked, entActive } from '../../game/logic'
import { GRID_MAPS, TILE, entWorld, isFloor, roomAt } from '../../game/maps'
import { BOUNDS, BRIDGE_X, RIVER_HALF, riverCenter } from '../../game/maps/zone4'
import { isExplored } from '../../game/explore'
import { live, useGame } from '../../game/state'
import type { RoomDef, ZoneId } from '../../game/types'
import { fr } from '../../i18n/fr'
import { levelName, tabletText } from './copy'

const DOT = { key: '#ff885c', res: '#75cfff', surv: '#45d7a2', exam: '#edc86e', exit: '#bfacff' }
const square = (x: number, z: number, w = TILE, h = TILE) => `M${x},${z}h${w}v${h}h${-w}Z`

/** The schematic comes from the same grid and room definitions as the 3D world. */
export function StationMap({ zone, selected, onSelect }: { zone: ZoneId; selected: string | null; onSelect: (room: RoomDef) => void }) {
  const svg = useRef<SVGSVGElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState<[number, number]>([0, 0])
  const drag = useRef<{ x: number; y: number; pan: [number, number] } | null>(null)
  const [position, setPosition] = useState(() => ({ x: live.pos[0], z: live.pos[2], yaw: live.yaw, zone: live.playerZone }))
  useGame((s) => s.flags)
  useGame((s) => s.taken)
  useGame((s) => s.event)
  const currentZone = useGame((s) => s.zone)
  const t = tabletText()
  const map = zone < 4 ? GRID_MAPS[zone as 1 | 2 | 3] : null
  const layout = useMemo(() => {
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity
    let floor = ''
    let windows = ''
    map?.grid.forEach((row, z) => [...row].forEach((c, x) => {
      if (c === ' ') return
      minX = Math.min(minX, x * TILE); maxX = Math.max(maxX, (x + 1) * TILE)
      minZ = Math.min(minZ, z * TILE); maxZ = Math.max(maxZ, (z + 1) * TILE)
      const rounded = map.rooms.find((r) => r.shape === 'round' && x >= r.rect[0] && x <= r.rect[2] && z >= r.rect[1] && z <= r.rect[3])
      if (isFloor(c) && !rounded) floor += square(x * TILE, z * TILE)
      if (c === 'W' || c === 'V') windows += square(x * TILE + 0.55, z * TILE + 0.55, 0.9, 0.9)
    }))
    if (!map) { minX = BOUNDS.x0; minZ = BOUNDS.z0; maxX = BOUNDS.x1; maxZ = BOUNDS.z1 }
    return { floor, windows, minX: minX - 3, minZ: minZ - 3, w: maxX - minX + 6, h: maxZ - minZ + 6 }
  }, [map])
  const aspect = 1.45
  const w = Math.max(layout.w, layout.h * aspect), h = w / aspect
  const baseX = layout.minX - (w - layout.w) / 2, baseZ = layout.minZ - (h - layout.h) / 2
  const view = { x: baseX + (w - w / zoom) / 2 + pan[0], z: baseZ + (h - h / zoom) / 2 + pan[1], w: w / zoom, h: h / zoom }
  useEffect(() => { setZoom(1); setPan([0, 0]) }, [zone])
  useEffect(() => {
    const timer = setInterval(() => setPosition({ x: live.pos[0], z: live.pos[2], yaw: live.yaw, zone: live.playerZone }), 100)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => {
    const el = svg.current
    const wheel = (e: WheelEvent) => { e.preventDefault(); e.stopPropagation(); setZoom((v) => Math.max(1, Math.min(3.5, v * (e.deltaY < 0 ? 1.12 : 1 / 1.12)))) }
    el?.addEventListener('wheel', wheel, { passive: false })
    return () => el?.removeEventListener('wheel', wheel)
  }, [])
  const location = map && position.zone === zone ? roomAt(map, position.x, position.z) : null
  const fit = () => { setZoom(1); setPan([0, 0]) }
  const center = () => { setPan([position.x - (baseX + w / 2), position.z - (baseZ + h / 2)]); setZoom(2) }
  const river = Array.from({ length: 70 }, (_, i) => {
    const x = BOUNDS.x0 + i * (BOUNDS.x1 - BOUNDS.x0) / 69
    return `${i ? 'L' : 'M'}${x},${riverCenter(x)}`
  }).join('')
  return <div className="nav-map-frame">
    <svg ref={svg} className="nav-map" data-testid="minimap" data-zone={zone} data-zoom={zoom.toFixed(2)} viewBox={`${view.x} ${view.z} ${view.w} ${view.h}`} aria-label={`${levelName(zone)} · ${t.map}`}
      onPointerDown={(e) => { if ((e.target as Element).closest('[data-room]')) return; drag.current = { x: e.clientX, y: e.clientY, pan }; e.currentTarget.setPointerCapture(e.pointerId) }}
      onPointerMove={(e) => { if (!drag.current) return; const b = e.currentTarget.getBoundingClientRect(); setPan([drag.current.pan[0] - (e.clientX - drag.current.x) * view.w / b.width, drag.current.pan[1] - (e.clientY - drag.current.y) * view.h / b.height]) }}
      onPointerUp={() => { drag.current = null }} onPointerCancel={() => { drag.current = null }}>
      <defs>
        <pattern id="nav-grid" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M4 0H0V4" fill="none" stroke="#6672a1" strokeWidth=".05" opacity=".32" /><circle cx="0" cy="0" r=".06" fill="#7c89af" /></pattern>
        <linearGradient id="nav-room" x2="0.4" y2="1"><stop stopColor="#253253" /><stop offset="1" stopColor="#10192d" /></linearGradient>
        <radialGradient id="nav-node"><stop stopColor="#243e5d" /><stop offset="1" stopColor="#121b31" /></radialGradient>
      </defs>
      <rect x={view.x} y={view.z} width={view.w} height={view.h} fill="#090f20" />
      <rect x={view.x} y={view.z} width={view.w} height={view.h} fill="url(#nav-grid)" />
      {map ? <>
        <path d={layout.floor} fill="#202b43" stroke="#4b5a73" strokeWidth=".12" />
        {map.rooms.map((room, i) => {
          const [x0, z0, x1, z1] = room.rect
          const cx = (x0 + x1 + 1), cz = (z0 + z1 + 1), rw = (x1 - x0 + 1) * TILE, rh = (z1 - z0 + 1) * TILE
          const known = isExplored(zone, cx, cz)
          const active = room.id === selected
          const link = room.id.startsWith('liaison')
          const color = active ? '#ff865c' : known ? '#91a4bd' : '#475773'
          return <g key={room.id} data-room={room.id} data-testid={`map-room-${room.id}`} role="button" tabIndex={0} aria-label={fr.rooms[room.name] ?? room.name} aria-pressed={active}
            className={`nav-room ${active ? 'selected' : ''}`} onClick={() => onSelect(room)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); onSelect(room) } }}>
            {room.shape === 'round' ? <>
              <circle cx={cx} cy={cz} r={rw / 2} fill="url(#nav-node)" stroke={color} strokeWidth={active ? '.3' : '.2'} />
              <circle cx={cx} cy={cz} r={rw / 2 - 1.05} fill="none" stroke="#6d86aa" strokeWidth=".12" strokeDasharray=".9 .9" />
              <circle cx={cx} cy={cz} r="2.1" fill="#172c46" stroke="#5e8bb9" strokeWidth=".15" />
              {[0, 1, 2, 3].map((q) => { const a = q * Math.PI / 2; return <path key={q} d={`M${cx + Math.sin(a) * (rw / 2 - .3)},${cz + Math.cos(a) * (rw / 2 - .3)}L${cx + Math.sin(a) * (rw / 2 + .3)},${cz + Math.cos(a) * (rw / 2 + .3)}`} stroke="#202b43" strokeWidth="1.95" /> })}
            </> : <rect x={x0 * TILE + .12} y={z0 * TILE + .12} width={rw - .24} height={rh - .24} rx={link ? '.1' : '.55'} fill={link ? '#202b43' : 'url(#nav-room)'} stroke={color} strokeWidth={link ? '.08' : active ? '.3' : '.18'} />}
            {!link && <>
              <text x={cx} y={cz - (room.shape === 'round' ? -4.5 : .5)} textAnchor="middle" fontSize="1.2" fill={known ? '#e1e6f7' : '#a1afc9'} fontFamily="monospace" textLength={Math.min(rw - 1, (fr.rooms[room.name] ?? room.name).length * .72)} lengthAdjust="spacingAndGlyphs">{(fr.rooms[room.name] ?? room.name).toUpperCase()}</text>
              {!room.shape && <text x={cx} y={cz + 1.1} textAnchor="middle" fontSize=".82" fill={active ? '#ff9876' : '#8291b4'} fontFamily="monospace">{`${zone}-${String(i + 1).padStart(2, '0')} · ${known ? t.visited : t.unknown}`}</text>}
            </>}
          </g>
        })}
        <path d={layout.windows} fill="#639bb4" opacity=".8" pointerEvents="none" />
        {map.doors.map((d) => {
          const x = d.tile[0] * TILE + 1, z = d.tile[1] * TILE + 1
          const horizontal = isFloor(map.grid[d.tile[1] - 1]?.[d.tile[0]] ?? '')
          return <rect key={d.id} x={x - .8} y={z - .16} width="1.6" height=".32" rx=".1" transform={`rotate(${horizontal ? 0 : 90} ${x} ${z})`} fill={doorUnlocked(d.id) ? '#44c99c' : '#f26865'}><title>{doorUnlocked(d.id) ? t.unlocked : t.locked}</title></rect>
        })}
      </> : <>
        <rect x={BOUNDS.x0} y={BOUNDS.z0} width={BOUNDS.x1 - BOUNDS.x0} height={BOUNDS.z1 - BOUNDS.z0} rx="3" fill="#182b2b" opacity=".6" stroke="#57736c" strokeWidth=".3" />
        <path d={river} fill="none" stroke="#366482" strokeWidth={RIVER_HALF * 2} />
        <path d={`M${BRIDGE_X},${riverCenter(BRIDGE_X) - RIVER_HALF - 2}v${RIVER_HALF * 2 + 4}`} stroke={useGame.getState().flags.bridge ? '#c6b28d' : '#776b58'} strokeWidth="2" />
        <circle cx="6" cy="-60" r="5" fill="none" stroke="#8caaad" strokeWidth=".4" /><text x="6" y="-58" textAnchor="middle" fill="#afc9cd" fontSize="5">H</text>
      </>}
      {allEnts(zone).filter((e) => { const { p } = entWorld(e); return e.dot && entActive(e, zone) && isExplored(zone, p[0], p[2]) }).map((e) => {
        const { p } = entWorld(e)
        return <circle key={e.id} cx={p[0]} cy={p[2]} r=".25" fill={DOT[e.dot!]} stroke="#101525" strokeWidth=".1" pointerEvents="none"><title>{e.item ? fr.items[e.item]?.name : fr.labels[e.id] ?? e.id}</title></circle>
      })}
      {position.zone === zone && <g pointerEvents="none" data-testid="map-player" data-x={position.x.toFixed(3)} data-z={position.z.toFixed(3)} transform={`translate(${position.x} ${position.z})`}>
        <circle r="1.5" fill="#64adff" fillOpacity=".1" stroke="#76b7ff" strokeWidth=".08" className="nav-radar" />
        <circle r=".65" fill="#78b6ff" stroke="#d5eaff" strokeWidth=".15" />
        <path d="M0,-1.65l-.4,.65h.8Z" fill="#e0efff" transform={`rotate(${-position.yaw * 180 / Math.PI})`} />
        <text x="1.2" y="-.9" fill="#89c3ff" fontSize=".65" fontFamily="monospace">{t.you.toUpperCase()}</text>
      </g>}
    </svg>
    <div className="nav-map-tools"><button onClick={() => setZoom((v) => Math.min(3.5, v * 1.3))} aria-label={t.zoomIn}>+</button><button onClick={() => setZoom((v) => Math.max(1, v / 1.3))} aria-label={t.zoomOut}>−</button><button onClick={fit}>{Math.round(zoom * 100)}%</button>{currentZone === zone && <button onClick={center} data-testid="map-center">◎ {t.locate}</button>}</div>
    <div className="nav-map-position">{currentZone === zone ? `${t.location} · ${location ? fr.rooms[location.name] : levelName(zone)} / X ${position.x.toFixed(1)} · Z ${position.z.toFixed(1)}` : t.otherLevel}</div>
  </div>
}
