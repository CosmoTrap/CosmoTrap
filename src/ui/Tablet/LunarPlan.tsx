import { useEffect, useState } from 'react'
import { HUB, MODULES, ROCKET, lunarGate, lunarMap, lunarRoomAt } from '../../game/lunar/map'
import { TASKS } from '../../game/lunar/puzzles'
import { live, useGame } from '../../game/state'
import { roomPowerCut } from '../../world/roomPower'

/** The same module transforms drive the 3D world and this plan. No decorative fake map. */
export function LunarPlan() {
  const progress = useGame(s => s.lunar), event = useGame(s => s.event)
  const [selected, select] = useState('habitat'), [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: live.pos[0], z: live.pos[2], yaw: live.yaw })
  useEffect(() => { const timer = setInterval(() => setPosition({ x: live.pos[0], z: live.pos[2], yaw: live.yaw }), 100); return () => clearInterval(timer) }, [])
  const module = MODULES.find(m => m.id === selected), tasks = TASKS.filter(t => t.room === selected)
  const room = lunarMap.rooms.find(r => r.id === selected), current = tasks.find(t => !progress.solved.includes(t.id))
  return <div className="nav-plan-layout lunar-plan" data-testid="lunar-plan">
    <section className="nav-map-panel nav-card">
      <header className="nav-map-head"><span className="nav-eyebrow">SELENE-7 · SURFACE LUNAIRE · NIVEAU 0</span><span className="nav-alert">{event?.kind === 'blackout' ? 'COUPURE TEMPORAIRE' : progress.solved.includes('loads') ? 'RÉSEAU EN SERVICE' : 'ALIMENTATION DE SECOURS'}</span></header>
      <svg className="lunar-map" data-testid="lunar-minimap" viewBox={`${44 - 38 / zoom} ${46 - 42 / zoom} ${76 / zoom} ${84 / zoom}`} onWheel={e => { setZoom(z => Math.max(1, Math.min(2, z - Math.sign(e.deltaY) * .1))) }} aria-label="Plan réel de la base lunaire">
        <defs><pattern id="lunar-grid" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M4 0H0V4" fill="none" stroke="#29405a" strokeWidth=".08" /></pattern></defs>
        <rect width="92" height="92" fill="url(#lunar-grid)" />
        {MODULES.map(m => <path key={m.id} d={`M${HUB.join(' ')} L${m.center.join(' ')}`} stroke="#8096a4" strokeWidth="2.2" />)}
        <path d="M41 73V80.5H23" fill="none" stroke="#dcc791" strokeWidth="1.7" strokeDasharray="1 .7" />
        <circle cx={HUB[0]} cy={HUB[1]} r="7" fill="#172c40" stroke="#a7bac9" strokeWidth=".35" />
        <circle cx="41" cy="41" r="4.5" fill="none" stroke="#769ab8" strokeWidth=".3" strokeDasharray="1 1" />
        <text x="41" y="41" textAnchor="middle" fontSize="2">HUB</text>
        {MODULES.map((m, i) => {
          const locked = !lunarGate(m.id, progress.solved), complete = TASKS.filter(t => t.room === m.id).every(t => progress.solved.includes(t.id))
          return <g key={m.id} data-testid={`lunar-map-room-${m.id}`} role="button" tabIndex={0} aria-label={m.name} aria-pressed={selected === m.id} onClick={() => select(m.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(m.id) } }}>
            <g transform={`translate(${m.center.join(' ')}) rotate(${-m.angle * 180 / Math.PI})`}><rect x={-m.width / 2} y={-m.depth / 2} width={m.width} height={m.depth} rx=".6" fill={complete ? '#163b36' : locked ? '#302635' : '#20304a'} stroke={selected === m.id ? '#ff9a64' : '#9fb1c1'} strokeWidth=".35" />
              <rect x="-1" y={-m.depth / 2 - .3} width="2" height=".6" fill={locked ? '#ff655f' : '#51dbac'} />
              {[-1, 1].map(side => <rect key={side} x={side * (m.width / 2 - 1.2) - .4} y="-2.5" width=".8" height="5" fill="#597ca4" />)}
            </g><text x={m.center[0]} y={m.center[1]} textAnchor="middle" fontSize="1.8">M-0{i + 1}</text><text x={m.center[0]} y={m.center[1] + 2.3} textAnchor="middle" fontSize="1.25">{complete ? '✓ VALIDÉ' : locked ? 'VERROUILLÉ' : 'ACCESSIBLE'}</text>
            <text x={m.center[0]} y={m.center[1] + Math.abs(Math.sin(m.angle)) * m.width / 2 + Math.abs(Math.cos(m.angle)) * m.depth / 2 + 3} textAnchor="middle" fontSize="1.8">{['CHAMBRE', 'CENTRALE', 'SÉCURITÉ', 'COMBINAISONS', 'SAS'][i]}</text>
          </g>
        })}
        <g role="button" tabIndex={0} aria-label="Fusée LV-1" onClick={() => select('rocket')} onKeyDown={e => { if (e.key === 'Enter') select('rocket') }}><circle cx={ROCKET[0]} cy={ROCKET[1]} r="4" fill="#354450" stroke="#f4cd6a" strokeDasharray="1 .6" /><text x={ROCKET[0]} y={ROCKET[1] + .5} textAnchor="middle" fontSize="1.4">LV-1</text></g>
        <g data-testid="map-player" data-x={position.x.toFixed(3)} data-z={position.z.toFixed(3)} transform={`translate(${position.x} ${position.z})`}><circle r="1" fill="#58baff" stroke="white" strokeWidth=".18" /><path transform={`rotate(${-position.yaw * 180 / Math.PI})`} d="M0 -2L-.7 -.8H.7Z" fill="white" /></g>
      </svg>
      <footer className="nav-legend"><span>● Position : {lunarRoomAt(position.x, position.z)?.name ?? 'Liaison / surface'}</span><b>{progress.solved.length} / 12 systèmes</b><button onClick={() => setZoom(1)}>Recentrer</button></footer>
    </section>
    <aside className="nav-sidebar"><section className="nav-card nav-module"><div className="nav-eyebrow">MODULE · NIVEAU 0</div><h2>{module?.name ?? 'Fusée LV-1'}</h2>
      <div className="nav-metrics"><div><small>Accès</small><b>{lunarGate(selected, progress.solved) ? 'Disponible' : 'Verrouillé'}</b></div><div><small>Éclairage</small><b>{room && roomPowerCut(room) ? 'Secours' : 'En service'}</b></div></div>
      <p className="nav-description">{current?.hint ?? 'Tous les systèmes de ce module sont validés.'}</p><ol>{tasks.map(t => <li key={t.id}>{progress.solved.includes(t.id) ? '✓ ' : '○ '}{t.name}</li>)}</ol><button className="nav-primary" onClick={() => useGame.setState({ tab: 1 })}>Ouvrir le journal →</button>
    </section></aside>
  </div>
}
