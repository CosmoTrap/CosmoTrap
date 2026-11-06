import { useEffect, useMemo, useRef, useState } from 'react'
import { allEnts, doorUnlocked, entActive } from '../../game/logic'
import { GRID_MAPS, TILE, entWorld, isFloor, roomAt } from '../../game/maps'
import { BOUNDS, BRIDGE_X, RIVER_HALF, riverCenter } from '../../game/maps/zone4'
import { isExplored } from '../../game/explore'
import { live, useGame } from '../../game/state'
import type { RoomDef, ZoneId } from '../../game/types'
import { fr } from '../../i18n/fr'
import { levelName, tabletText } from './copy'
import { Lock, ModuleArt, roomCode, roomStatus } from './moduleArt'
import { roomPowerCut } from '../../world/roomPower'
import { SOLAR_ARRAYS, SOLAR_CELL, SOLAR_GAP } from '../../game/maps/solarArrays'
import { Compartment, CompartmentLabel, HermesHull, OrbitBackdrop, ROCKET_BOUNDS } from './RocketMap'

const DOT = { key: '#ff885c', res: '#75cfff', surv: '#45d7a2', exam: '#edc86e', exit: '#bfacff' }
const square = (x: number, z: number, w = TILE, h = TILE) => `M${x},${z}h${w}v${h}h${-w}Z`

/** The schematic comes from the same grid and room definitions as the 3D world. */
export type MapMode = 'plan' | 'energy' | 'oxygen'

function SolarArray({ x, z, strutZ, strutX }: { x: number; z: number; strutZ: number; strutX: number }) {
  const cell = SOLAR_CELL, gap = SOLAR_GAP
  return <g pointerEvents="none">
    <path d={`M${strutX},${z + cell}V${strutZ}`} stroke="#6f7b92" strokeWidth=".28" />
    {[0, 1].map((row) => [0, 1, 2, 3, 4].map((col) => <g key={`${row}:${col}`} transform={`translate(${x + col * (cell + gap)} ${z + row * (cell * .78 + gap)})`}>
      <rect width={cell} height={cell * .78} fill="#1d4a9e" stroke="#a9c0e6" strokeWidth=".07" />
      <path d={`M${cell / 2},0V${cell * .78}M0,${cell * .39}H${cell}`} stroke="#6f95d4" strokeWidth=".04" />
    </g>))}
  </g>
}

export function StationMap({ zone, selected, onSelect, mode = 'plan' }: { zone: ZoneId; selected: string | null; onSelect: (room: RoomDef) => void; mode?: MapMode }) {
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
      // The rocket's nose canopy is drawn with its hull.
      if (c === 'W' || (c === 'V' && zone !== 3)) windows += square(x * TILE + 0.55, z * TILE + 0.55, 0.9, 0.9)
    }))
    if (!map) { minX = BOUNDS.x0; minZ = BOUNDS.z0; maxX = BOUNDS.x1; maxZ = BOUNDS.z1 }
    for (const { x: ax, z: az } of SOLAR_ARRAYS[zone] ?? []) { minX = Math.min(minX, ax); maxX = Math.max(maxX, ax + 15); minZ = Math.min(minZ, az); maxZ = Math.max(maxZ, az + 6) }
    if (zone === 2) minX = Math.min(minX, -8)
    if (zone === 3) { minX = ROCKET_BOUNDS.minX; maxX = ROCKET_BOUNDS.maxX; minZ = ROCKET_BOUNDS.minZ; maxZ = ROCKET_BOUNDS.maxZ }
    return { floor, windows, minX: minX - 3, minZ: minZ - 6, w: maxX - minX + 6, h: maxZ - minZ + 11 }
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
        <linearGradient id="nav-hull" x2="1" y2="1"><stop stopColor="#eef1f5" /><stop offset=".5" stopColor="#aab2bf" /><stop offset="1" stopColor="#7d8696" /></linearGradient>
        <pattern id="nav-floor" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="#6a7794" strokeWidth=".025" opacity=".5" /></pattern>
        <pattern id="nav-locked" width=".7" height=".7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".7" height=".7" fill="#5c1a24" fillOpacity=".42" /><path d="M0 0V.7" stroke="#d4453f" strokeWidth=".08" opacity=".55" /></pattern>
        <linearGradient id="nav-tube" x2="0" y2="1"><stop stopColor="#c7ccd5" /><stop offset=".5" stopColor="#8d95a4" /><stop offset="1" stopColor="#c7ccd5" /></linearGradient>
        <linearGradient id="nav-tube-v"><stop stopColor="#c7ccd5" /><stop offset=".5" stopColor="#8d95a4" /><stop offset="1" stopColor="#c7ccd5" /></linearGradient>
        <radialGradient id="nav-node"><stop offset=".55" stopColor="#1a2a44" /><stop offset=".78" stopColor="#2d3a53" /><stop offset=".8" stopColor="#d3d8e0" /><stop offset="1" stopColor="#8a93a2" /></radialGradient>
      </defs>
      {map ? <>
        {(SOLAR_ARRAYS[zone] ?? []).map((a, i) => <SolarArray key={i} {...a} />)}
        {zone === 3 && <><OrbitBackdrop /><HermesHull /></>}
        {zone === 2 && <g pointerEvents="none" data-testid="map-rocket">
          <rect x="-7.6" y="31.6" width="15.6" height="8.8" rx="1" fill="#0d1224" fillOpacity=".75" stroke="#ecc24a" strokeWidth=".14" strokeDasharray=".6 .4" />
          <path d="M-6.2,36l2-1.5h8.6v3h-8.6z" fill="#e9ecf0" /><path d="M-5.2,36l1.6-.9h7.6v1.8h-7.6z" fill="#e8772e" />
          {[-1.3, 1.3].map((k) => <rect key={k} x="-3.6" y={36 + k * 1.15 - .28} width="7" height=".56" rx=".28" fill="#d7dbe2" />)}
          <path d="M4.6,34.9h2.2v2.2h-2.2z" fill="#aab2bf" />
          <text x="-7.4" y="30.7" fontSize="1" fill="#ecc24a" fontFamily="monospace">LV-2 · ÉVACUATION</text>
        </g>}
        {map.rooms.filter((room) => room.id.startsWith('liaison')).map((room) => {
          const [x0, z0, x1, z1] = room.rect
          const across = x1 > x0, active = room.id === selected
          const x = x0 * TILE, z = z0 * TILE, rw = (x1 - x0 + 1) * TILE, rh = (z1 - z0 + 1) * TILE
          const door = map.doors.find((d) => across ? d.tile[1] === z0 && (d.tile[0] === x0 - 1 || d.tile[0] === x1 + 1) : d.tile[0] === x0 && (d.tile[1] === z0 - 1 || d.tile[1] === z1 + 1))
          const open = !door || doorUnlocked(door.id)
          return <g key={room.id} data-room={room.id} data-testid={`map-room-${room.id}`} role="button" tabIndex={0} aria-label={fr.rooms[room.name] ?? room.name} aria-pressed={active} className={`nav-room ${active ? 'selected' : ''}`}
            onClick={() => onSelect(room)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(room) } }}>
            <rect x={x} y={z + (across ? .15 : 0)} width={rw} height={rh - (across ? .3 : 0)} fill={`url(#${across ? 'nav-tube' : 'nav-tube-v'})`} stroke={active ? '#ff865c' : '#5d6678'} strokeWidth=".1" />
            <path d={across ? `M${x + .4},${z + rh / 2}H${x + rw - .4}` : `M${x + rw / 2},${z + .4}V${z + rh - .4}`} stroke={open ? '#3fd6a0' : '#ff5a55'} strokeWidth=".2" strokeDasharray=".8 .55" />
          </g>
        })}
        {map.rooms.filter((room) => !room.id.startsWith('liaison')).map((room) => {
          const [x0, z0, x1, z1] = room.rect
          const cx = x0 + x1 + 1, cz = z0 + z1 + 1, rw = (x1 - x0 + 1) * TILE, rh = (z1 - z0 + 1) * TILE
          const active = room.id === selected, status = roomStatus(zone, room)
          const hub = map.rooms.find((other) => other.shape === 'round')
          const hubZ = hub ? hub.rect[1] + hub.rect[3] + 1 : cz
          const below = !room.shape && cz > hubZ + 8
          const name = `${roomCode(room, zone)} · ${(fr.rooms[room.name] ?? room.name).toUpperCase()}`
          // Modules on the east side read back from their right edge, to stay inside the plan.
          const rightAligned = !room.shape && hub && cx > hub.rect[0] + hub.rect[2] + 1 + 14
          const labelX = room.shape ? cx - 9 : rightAligned ? (x1 + 1) * TILE : x0 * TILE
          const labelZ = room.shape ? cz + rh / 2 + 1.5 : below ? (z1 + 1) * TILE + 2.9 : z0 * TILE - 2.3
          const tag = status === 'solved' ? { text: '✓ RÉSOLU', color: '#3fd6a0' } : status === 'current' ? { text: 'ÉNIGME EN COURS', color: '#ff9a62' } : status === 'locked' ? { text: 'VERROUILLÉ', color: '#ff6a60' } : null
          const tagW = tag ? tag.text.length * .66 + .9 : 0
          const cut = roomPowerCut(room, zone)
          const overlay = mode === 'energy' ? (cut ? '#ff5a5566' : '#3fd6a044') : mode === 'oxygen' ? (zone === 2 && useGame.getState().flags.pw_o2 ? '#4fb6ff55' : '#ffb02a3a') : null
          return <g key={room.id} data-room={room.id} data-testid={`map-room-${room.id}`} role="button" tabIndex={0} aria-label={fr.rooms[room.name] ?? room.name} aria-pressed={active} className={`nav-room ${active ? 'selected' : ''}`}
            onClick={() => onSelect(room)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(room) } }}>
            {zone === 3 ? <Compartment room={room} selected={active} /> : room.shape === 'round' ? <>
              <circle cx={cx} cy={cz} r={rw / 2} fill="url(#nav-node)" stroke={active ? '#ff865c' : '#f0f3f7'} strokeWidth={active ? '.24' : '.08'} />
              <circle cx={cx} cy={cz} r={rw / 2 - 2.1} fill="none" stroke="#7288ad" strokeWidth=".3" strokeDasharray="1.3 1" />
              {/* The lift at the centre, with its door facing east. */}
              <circle cx={cx} cy={cz} r="1.9" fill="#23304a" stroke="#d3d8e0" strokeWidth=".22" />
              <circle cx={cx} cy={cz} r="1.05" fill={zone === 1 && !useGame.getState().flags.pressurized ? '#ff5a55' : '#4f9dff'} />
              {zone === 1 && !useGame.getState().flags.pressurized && <Lock x={cx} z={cz} size={.8} />}
            </> : <ModuleArt zone={zone} room={room} status={status} selected={active} />}
            {overlay && !room.shape && <rect x={x0 * TILE} y={z0 * TILE} width={rw} height={rh} rx=".55" fill={overlay} pointerEvents="none" />}
            {active && !room.shape && zone !== 3 && [[0, 0], [1, 0], [0, 1], [1, 1]].map(([kx, kz]) => {
              const x = x0 * TILE + kx * rw + (kx ? .9 : -.9), z = z0 * TILE + kz * rh + (kz ? .9 : -.9)
              return <path key={`${kx}${kz}`} d={`M${x + (kx ? -1.1 : 1.1)},${z}H${x}V${z + (kz ? -1.1 : 1.1)}`} fill="none" stroke="#ff865c" strokeWidth=".2" />
            })}
            {tag && zone !== 3 && <g pointerEvents="none">
              <rect x={rightAligned ? labelX - tagW : labelX} y={labelZ - 2.5} width={tagW} height="1.3" rx=".26" fill={`${tag.color}22`} stroke={tag.color} strokeWidth=".08" />
              <text x={(rightAligned ? labelX - tagW : labelX) + .45} y={labelZ - 1.56} fontSize=".78" fill={tag.color} fontFamily="monospace" letterSpacing=".02">{tag.text}</text>
            </g>}
            {zone !== 3 && <text x={labelX} y={labelZ} textAnchor={rightAligned ? 'end' : 'start'} fontSize=".95" fill="#e1e6f7" fontFamily="monospace" letterSpacing=".04" pointerEvents="none">{name}</text>}
          </g>
        })}
        {zone === 3 && map.rooms.map((room) => <CompartmentLabel key={room.id} room={room} />)}
        <path d={layout.windows} fill="#8fc8e2" opacity=".85" pointerEvents="none" />
        {map.doors.map((d) => {
          const x = d.tile[0] * TILE + 1, z = d.tile[1] * TILE + 1
          const horizontal = isFloor(map.grid[d.tile[1] - 1]?.[d.tile[0]] ?? '')
          return <g key={d.id} transform={`rotate(${horizontal ? 90 : 0} ${x} ${z})`} pointerEvents="none">
            <rect x={x - .55} y={z - 1.1} width="1.1" height="2.2" rx=".2" fill={doorUnlocked(d.id) ? '#3fd6a0' : '#ff5a55'} stroke="#101525" strokeWidth=".08" />
          </g>
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
    <div className="nav-map-grid" aria-hidden="true">
      <div>{'ACEGIKMOQS'.split('').map((c) => <span key={c}>{c}</span>)}</div>
      <div>{['01', '03', '05', '07', '09', '11', '13'].map((n) => <span key={n}>{n}</span>)}</div>
    </div>
    <div className="nav-map-tools"><button onClick={() => setZoom((v) => Math.min(3.5, v * 1.3))} aria-label={t.zoomIn}>+</button><button onClick={() => setZoom((v) => Math.max(1, v / 1.3))} aria-label={t.zoomOut}>−</button><button onClick={fit}>{Math.round(zoom * 100)}%</button>{currentZone === zone && <button onClick={center} data-testid="map-center">◎ {t.locate}</button>}</div>
    <div className="nav-map-position">{currentZone === zone ? `${t.location} · ${location ? fr.rooms[location.name] : levelName(zone)} / X ${position.x.toFixed(1)} · Z ${position.z.toFixed(1)}` : t.otherLevel}</div>
  </div>
}
