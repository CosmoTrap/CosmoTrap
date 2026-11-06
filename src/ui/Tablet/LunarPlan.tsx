import { useEffect, useRef, useState } from 'react'
import { HUB, LAUNCH_DESK, MODULES, ROCKET, localPoint, lunarGate, lunarMap, lunarRoomAt, type LunarModule } from '../../game/lunar/map'
import { TASKS, available } from '../../game/lunar/puzzles'
import { live, useGame } from '../../game/state'
import { roomPowerCut } from '../../world/roomPower'
import { ICONS, Lock } from './moduleArt'

// Plan of the lunar base after the "Base lunaire" tablet design: real module transforms and real furniture,
// over the regolith photograph, with the same hull, tube and status language as the station's plan.

type Status = 'solved' | 'current' | 'locked' | 'idle'
const deg = (a: number) => a * 180 / Math.PI
const SHORT: Record<string, string> = { habitat: 'CHAMBRE', power: 'CENTRALE ÉLECTRIQUE', security: 'TERMINAL DE SÉCURITÉ', eva: 'SALLE DES COMBINAISONS', airlock: 'SAS D’ÉVACUATION' }
const STEPS = [
  { text: 'Sortir de la chambre', rooms: ['habitat'] },
  { text: 'Rétablir l’électricité', rooms: ['power'] },
  { text: 'Déverrouiller la sécurité', rooms: ['security'] },
  { text: 'Préparer l’évacuation', rooms: ['eva', 'airlock'] },
  { text: 'Rejoindre la capsule', rooms: ['rocket'] },
]
const TAGS: Record<Status, { text: string; color: string } | null> = {
  solved: { text: '✓ RÉSOLU', color: '#3fd6a0' }, current: { text: 'ÉNIGME EN COURS', color: '#ff9a62' }, locked: { text: 'VERROUILLÉ', color: '#ff6a60' }, idle: null,
}

const roomTasks = (room: string) => TASKS.filter((t) => t.room === room)
function statusOf(room: string, solved: readonly string[]): Status {
  const tasks = roomTasks(room)
  // The crew wakes up in the bedroom: its gate only guards the way out.
  if (room !== 'rocket' && room !== 'habitat' && !lunarGate(room, [...solved])) return 'locked'
  if (tasks.every((t) => solved.includes(t.id))) return 'solved'
  return tasks.some((t) => available({ seed: 0, solved: [...solved], drafts: {}, current: null }, t.id)) ? 'current' : 'idle'
}
/** Half extents, on the plan, of a module turned by its angle. */
const extents = (m: LunarModule) => {
  const c = Math.abs(Math.cos(m.angle)), s = Math.abs(Math.sin(m.angle))
  return [c * m.width / 2 + s * m.depth / 2, s * m.width / 2 + c * m.depth / 2]
}

/** Everything standing in a module, exactly where the 3D world places it. */
function Contents({ m }: { m: LunarModule }) {
  const inside = (x: number, z: number) => lunarRoomAt(x, z)?.id === m.id
  const items: { model: string; pos: [number, number, number]; rot: number }[] = [
    ...lunarMap.props.filter((p) => p.pos && inside(p.pos[0], p.pos[2])).map((p) => ({ model: p.model, pos: p.pos!, rot: p.rot ?? 0 })),
    ...lunarMap.ents.filter((e) => e.model === 'lunarTerminal' && e.pos && inside(e.pos[0], e.pos[2])).map((e) => ({ model: e.model, pos: e.pos!, rot: e.rot ?? 0 })),
  ]
  return <>{items.map((it, i) => {
    const icon = ICONS[it.model]
    return icon ? <g key={i} transform={`translate(${it.pos[0]} ${it.pos[2]}) rotate(${-deg(it.rot)})`}>{icon()}</g> : null
  })}</>
}

/** A module seen from above: metal hull, dark floor, portholes, contents and its lock. */
function ModuleCard({ m, status, selected }: { m: LunarModule; status: Status; selected: boolean }) {
  const w = m.width, d = m.depth
  return <g transform={`translate(${m.center[0]} ${m.center[1]}) rotate(${-deg(m.angle)})`}>
    <rect x={-w / 2 - .35} y={-d / 2 - .35} width={w + .7} height={d + .7} rx="1.1" fill="url(#nav-hull)" stroke={selected ? '#ff865c' : '#f0f3f7'} strokeWidth={selected ? .3 : .1} />
    <rect x={-w / 2} y={-d / 2} width={w} height={d} rx=".6" fill="#121829" />
    <rect x={-w / 2} y={-d / 2} width={w} height={d} rx=".6" fill="url(#nav-floor)" />
    {m.windows.map(([face, along], i) => {
      const [x, z] = face === 'front' ? [along, -d / 2] : face === 'back' ? [along, d / 2] : face === 'left' ? [-w / 2, along] : [w / 2, along]
      const across = face === 'front' || face === 'back'
      return <rect key={i} x={x - (across ? .56 : .14)} y={z - (across ? .14 : .56)} width={across ? 1.12 : .28} height={across ? .28 : 1.12} rx=".1" fill="#8fc8e2" />
    })}
    <g transform={`rotate(${deg(m.angle)}) translate(${-m.center[0]} ${-m.center[1]})`}><Contents m={m} /></g>
    {status === 'locked' && <>
      <rect x={-w / 2} y={-d / 2} width={w} height={d} rx=".6" fill="url(#nav-locked)" stroke="#ff5a55" strokeWidth=".16" strokeDasharray=".6 .4" />
      <g transform={`rotate(${deg(m.angle)})`}><Lock x={0} z={0} size={1.3} /></g>
    </>}
    {/* The door towards the hub. */}
    <rect x="-1.1" y={-d / 2 - .45} width="2.2" height=".7" rx=".2" fill={status === 'locked' ? '#ff5a55' : '#3fd6a0'} stroke="#101525" strokeWidth=".08" />
  </g>
}

function Rocket() {
  return <g pointerEvents="none">
    <circle cx={ROCKET[0]} cy={ROCKET[1]} r="8.3" fill="#0d1224" fillOpacity=".55" stroke="#ecc24a" strokeWidth=".22" strokeDasharray="1 .7" />
    <circle cx={ROCKET[0]} cy={ROCKET[1]} r="5.4" fill="none" stroke="#ecc24a55" strokeWidth=".15" />
    {[[1, 0], [-1, 0], [0, -1]].map(([x, z], i) => <rect key={i} x={ROCKET[0] + x * 3.3 - (x ? 1.1 : .14)} y={ROCKET[1] + z * 3.3 - (z ? 1.1 : .14)} width={x ? 2.2 : .28} height={z ? 2.2 : .28} fill="#d7dbe2" />)}
    <circle cx={ROCKET[0]} cy={ROCKET[1]} r="2.2" fill="#e9ecf0" stroke="#8a93a2" strokeWidth=".15" />
    <circle cx={ROCKET[0]} cy={ROCKET[1]} r=".9" fill="#23304a" stroke="#d3d8e0" strokeWidth=".12" />
    <rect x={LAUNCH_DESK[0] - .3} y={LAUNCH_DESK[1] - .7} width=".6" height="1.4" fill="#59c8ff" />
  </g>
}

/** The solar field and its feeder to the power plant, cut until the circuit is repaired. */
function Solar({ repaired }: { repaired: boolean }) {
  const end = localPoint('power', MODULES.find((m) => m.id === 'power')!.width / 2 + .2, 0, 1.5)
  const mid = [(26 + end[0]) / 2, (14 + end[2]) / 2]
  return <g pointerEvents="none">
    <text x="6.3" y="2.6" fontSize="1.9" fill="#e1e6f7" fontFamily="monospace" letterSpacing=".05">PANNEAUX SOLAIRES · {repaired ? 'EN LIGNE' : 'HORS LIGNE'}</text>
    {[0, 1].flatMap((row) => [0, 1, 2, 3, 4].map((col) => <g key={`${row}${col}`} transform={`translate(${8 + col * 3.6 - 1.6} ${6 + row * 4.4 - .95})`}>
      <rect width="3.2" height="1.9" fill="#1d4a9e" stroke="#a9c0e6" strokeWidth=".09" />
      <path d="M1.6 0V1.9M0 .95H3.2" stroke="#6f95d4" strokeWidth=".05" />
    </g>))}
    <path d={`M26 14L${end[0]} ${end[2]}`} stroke={repaired ? '#3fd6a0' : '#ecc24a'} strokeWidth=".35" strokeDasharray={repaired ? undefined : '.9 .6'} />
    {!repaired && <>
      <path d={`M${mid[0] - .9} ${mid[1] - .9}l1.8 1.8M${mid[0] + .9} ${mid[1] - .9}l-1.8 1.8`} stroke="#ff5a55" strokeWidth=".35" />
      <text x={mid[0] - 6} y={mid[1] + 2.9} fontSize="1.5" fill="#ff6a60" fontFamily="monospace">CÂBLE SECTIONNÉ</text>
    </>}
  </g>
}

function Tag({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  const w = text.length * 1.15 + 1.6
  return <g pointerEvents="none">
    <rect x={x - w / 2} y={y - 1.75} width={w} height="2.4" rx=".35" fill="#0b1020cc" stroke={color} strokeWidth=".12" />
    <text x={x} y={y} textAnchor="middle" fontSize="1.45" fill={color} fontFamily="monospace" letterSpacing=".03">{text}</text>
  </g>
}

export function LunarPlan() {
  const progress = useGame(s => s.lunar), event = useGame(s => s.event)
  const hints = useGame(s => s.hintsUsed), errors = useGame(s => s.errors)
  useGame(s => Math.floor(s.playTime))
  const [selected, select] = useState<string>(() => lunarRoomAt(live.pos[0], live.pos[2])?.id ?? 'habitat')
  const [zoom, setZoom] = useState(1)
  const svg = useRef<SVGSVGElement>(null)
  const [position, setPosition] = useState({ x: live.pos[0], z: live.pos[2], yaw: live.yaw })
  useEffect(() => { const timer = setInterval(() => setPosition({ x: live.pos[0], z: live.pos[2], yaw: live.yaw }), 100); return () => clearInterval(timer) }, [])
  useEffect(() => {
    const el = svg.current
    const wheel = (e: WheelEvent) => { e.preventDefault(); e.stopPropagation(); setZoom(z => Math.max(1, Math.min(2.5, z * (e.deltaY < 0 ? 1.12 : 1 / 1.12)))) }
    el?.addEventListener('wheel', wheel, { passive: false })
    return () => el?.removeEventListener('wheel', wheel)
  }, [])
  const solved = progress.solved
  const status = (id: string) => statusOf(id, solved)
  const module = MODULES.find(m => m.id === selected)
  const room = lunarMap.rooms.find(r => r.id === selected)
  // Fixed frame round the whole base, solar field and pad included; the wheel zooms on the player.
  const frame = { x: 3, z: 0, w: 82, h: 92 }
  const view = zoom === 1 ? frame : { w: frame.w / zoom, h: frame.h / zoom, x: position.x - frame.w / zoom / 2, z: position.z - frame.h / zoom / 2 }
  const steps = STEPS.map(step => step.rooms.every(r => r === 'rocket' ? solved.includes('launch') : status(r) === 'solved'))
  const stepIndex = steps.indexOf(false)
  const doneSteps = steps.filter(Boolean).length
  const tasks = roomTasks(selected), current = tasks.find(t => !solved.includes(t.id) && available({ ...progress }, t.id))
  const st = status(selected)
  const index = MODULES.findIndex(m => m.id === selected)
  const code = selected === 'rocket' ? 'LV-1' : `M-0${index + 1}`
  const stateLine = st === 'locked' ? 'ACCÈS VERROUILLÉ' : st === 'solved' ? 'MODULE VALIDÉ' : current ? `ÉNIGME ${TASKS.findIndex(t => t.id === current.id) + 1} · EN COURS` : 'EN ATTENTE'
  const power = room ? roomPowerCut(room) : false
  const alert = event?.kind === 'blackout' ? 'COUPURE TEMPORAIRE' : event?.kind === 'leak' ? 'FUITE D’AIR' : solved.includes('loads') ? 'RÉSEAU EN SERVICE' : 'ALIMENTATION DE SECOURS'
  const description = selected === 'rocket' ? 'Capsule de retour Hermès sur son aire. Le poste de lancement demande l’autorisation de décollage.'
    : st === 'locked' ? `Prérequis : ${(() => { const need = { power: 'manifest', security: 'loads', eva: 'identity', airlock: 'checklist' }[selected]; return TASKS.find(t => t.id === need)?.name ?? '—' })()}.`
      : current ? `${current.name}. Les consignes sont sur les plaques de la pièce.` : 'Toutes les épreuves de ce module sont validées.'
  return <div className="nav-plan-layout lunar-plan" data-testid="lunar-plan">
    <section className="nav-map-panel nav-card">
      <header className="nav-map-head">
        <span className="nav-eyebrow">NIVEAU 0 · VUE DE DESSUS · 1:250</span>
        <span className="nav-alert"><i />{alert}</span>
      </header>
      <div className="nav-map-frame lunar-frame">
        <svg ref={svg} className="nav-map lunar-map" data-testid="lunar-minimap" viewBox={`${view.x} ${view.z} ${view.w} ${view.h}`} aria-label="Plan réel de la base lunaire">
          <defs>
            <linearGradient id="nav-hull" x2="1" y2="1"><stop stopColor="#eef1f5" /><stop offset=".5" stopColor="#aab2bf" /><stop offset="1" stopColor="#7d8696" /></linearGradient>
            <pattern id="nav-floor" width="1" height="1" patternUnits="userSpaceOnUse"><path d="M1 0H0V1" fill="none" stroke="#6a7794" strokeWidth=".025" opacity=".5" /></pattern>
            <pattern id="nav-locked" width=".7" height=".7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width=".7" height=".7" fill="#5c1a24" fillOpacity=".42" /><path d="M0 0V.7" stroke="#d4453f" strokeWidth=".08" opacity=".55" /></pattern>
            <linearGradient id="nav-tube-v"><stop stopColor="#c7ccd5" /><stop offset=".5" stopColor="#8d95a4" /><stop offset="1" stopColor="#c7ccd5" /></linearGradient>
            <radialGradient id="nav-node"><stop offset=".55" stopColor="#1a2a44" /><stop offset=".78" stopColor="#2d3a53" /><stop offset=".8" stopColor="#d3d8e0" /><stop offset="1" stopColor="#8a93a2" /></radialGradient>
          </defs>
          <Solar repaired={solved.includes('circuit')} />
          {/* Walkway from the airlock to the pad. */}
          <path d={`M41 73.6V80.5H${ROCKET[0] + 8.4}`} fill="none" stroke="#9aa3b2" strokeWidth="1.6" strokeDasharray=".5 .35" pointerEvents="none" />
          <Rocket />
          {MODULES.map(m => {
            const length = m.distance - m.depth / 2 - 7, open = status(m.id) !== 'locked'
            return <g key={m.id} transform={`translate(${HUB.join(' ')}) rotate(${-deg(m.angle)})`} pointerEvents="none">
              <rect x="-1.2" y="6.8" width="2.4" height={length + .4} fill="url(#nav-tube-v)" stroke="#5d6678" strokeWidth=".1" />
              {Array.from({ length: Math.floor(length / 2) }, (_, i) => <path key={i} d={`M-1.2 ${8 + i * 2}H1.2`} stroke="#6d7688" strokeWidth=".06" />)}
              <path d={`M0 7.4V${6.8 + length}`} stroke={open ? '#3fd6a0' : '#ff5a55'} strokeWidth=".24" strokeDasharray=".8 .55" />
            </g>
          })}
          <g pointerEvents="none">
            <circle cx={HUB[0]} cy={HUB[1]} r="7.3" fill="url(#nav-node)" stroke="#f0f3f7" strokeWidth=".1" />
            <circle cx={HUB[0]} cy={HUB[1]} r="5" fill="none" stroke="#7288ad" strokeWidth=".3" strokeDasharray="1.3 1" />
            {[0, 1, 2, 3].map(i => <rect key={i} x={HUB[0] + Math.sin(i * Math.PI / 2) * 5 - .5} y={HUB[1] + Math.cos(i * Math.PI / 2) * 5 - .5} width="1" height="1" fill="#8a93a2" />)}
            <circle cx={HUB[0]} cy={HUB[1]} r="1.9" fill="#23304a" stroke="#d3d8e0" strokeWidth=".22" />
            <circle cx={HUB[0]} cy={HUB[1]} r="1.05" fill="#4f9dff" />
            <text x={HUB[0]} y={HUB[1] + 9.4} textAnchor="middle" fontSize="1.9" fill="#e1e6f7" fontFamily="monospace">M-00 · HUB</text>
          </g>
          {MODULES.map((m, i) => {
            const s = status(m.id), [hx, hz] = extents(m), tag = TAGS[s]
            return <g key={m.id} data-testid={`lunar-map-room-${m.id}`} role="button" tabIndex={0} aria-label={m.name} aria-pressed={selected === m.id}
              onClick={() => select(m.id)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(m.id) } }}>
              <ModuleCard m={m} status={s} selected={selected === m.id} />
              {tag && <Tag x={m.center[0]} y={m.center[1] - hz - 1.6} {...tag} />}
              <text x={m.center[0]} y={m.center[1] + hz + 2.5} textAnchor="middle" fontSize="1.9" fill="#e1e6f7" fontFamily="monospace" letterSpacing=".04" pointerEvents="none">M-0{i + 1} · {SHORT[m.id]}</text>
              {selected === m.id && [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([kx, kz]) => {
                const x = m.center[0] + kx * (hx + 1), z = m.center[1] + kz * (hz + 1)
                return <path key={`${kx}${kz}`} d={`M${x - kx * 1.4} ${z}H${x}V${z - kz * 1.4}`} fill="none" stroke="#ff865c" strokeWidth=".26" pointerEvents="none" />
              })}
            </g>
          })}
          <g role="button" tabIndex={0} aria-label="Capsule LV-1" onClick={() => select('rocket')} onKeyDown={e => { if (e.key === 'Enter') select('rocket') }}>
            <circle cx={ROCKET[0]} cy={ROCKET[1]} r="8.3" fill="transparent" />
            <Tag x={ROCKET[0]} y={ROCKET[1] - 9.8} text="OBJECTIF FINAL" color="#ecc24a" />
            <text x={ROCKET[0]} y={ROCKET[1] + 10.4} textAnchor="middle" fontSize="1.9" fill="#e1e6f7" fontFamily="monospace" pointerEvents="none">LV-1 · CAPSULE D’ÉVACUATION</text>
          </g>
          <g pointerEvents="none" data-testid="map-player" data-x={position.x.toFixed(3)} data-z={position.z.toFixed(3)} transform={`translate(${position.x} ${position.z})`}>
            <circle r="2" fill="#64adff" fillOpacity=".12" stroke="#76b7ff" strokeWidth=".1" className="nav-radar" />
            <circle r=".8" fill="#78b6ff" stroke="#d5eaff" strokeWidth=".18" />
            <path d="M0,-2l-.5,.8h1Z" fill="#e0efff" transform={`rotate(${-deg(position.yaw)})`} />
            <text x="1.6" y="-1.2" fill="#89c3ff" fontSize="1.4" fontFamily="monospace">TOI</text>
          </g>
        </svg>
        <div className="nav-map-tools"><button onClick={() => setZoom(z => Math.min(2.5, z * 1.3))} aria-label="Zoomer">+</button><button onClick={() => setZoom(z => Math.max(1, z / 1.3))} aria-label="Dézoomer">−</button><button onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button></div>
      </div>
      <footer className="nav-legend">
        <span><i className="unlocked" />Énigme résolue</span><span><i className="current" />Énigme en cours</span><span><i className="locked" />Module verrouillé</span>
        <span><i className="you" />Ta position</span><span><i className="evac" />Évacuation</span>
        <b>Progression {doneSteps} / {STEPS.length}</b>
      </footer>
    </section>
    <aside className="nav-sidebar">
      <section className="nav-card nav-module">
        <div className="nav-eyebrow">MODULE · {code}</div>
        <h2>{module?.name ?? 'Capsule LV-1'}</h2>
        <p className={`nav-status ${st}`}>{stateLine}</p>
        <div className="nav-module-drawing" aria-hidden="true">
          {module ? <svg viewBox={`${module.center[0] - module.width / 2 - 1} ${module.center[1] - module.depth / 2 - 1} ${module.width + 2} ${module.depth + 2}`}>
            <g transform={`rotate(${deg(module.angle)} ${module.center[0]} ${module.center[1]})`}><ModuleCard m={module} status={st} selected={false} /></g>
          </svg> : <svg viewBox={`${ROCKET[0] - 10} ${ROCKET[1] - 9} 20 18`}><Rocket /></svg>}
        </div>
        <div className="nav-metrics">
          <div><small>Pression</small><b>{selected === 'airlock' && !solved.includes('checklist') ? '0,2 bar' : selected === 'rocket' ? '—' : '0,7 bar'}</b></div>
          <div><small>Énergie</small><b className={power || !solved.includes('loads') ? 'off' : ''}>{power ? 'Coupée' : solved.includes('loads') ? 'En service' : 'Secours'}</b></div>
        </div>
        <p className="nav-description">{description}</p>
        <dl className="nav-rows">
          <div><dt>Épreuves du module</dt><dd>{tasks.filter(t => solved.includes(t.id)).length} / {tasks.length}</dd></div>
          <div><dt>Indices utilisés</dt><dd>{hints}</dd></div>
          <div><dt>Erreurs</dt><dd>{errors}</dd></div>
        </dl>
      </section>
      <section className="nav-card nav-module lunar-mission">
        <div className="nav-eyebrow">MISSION · {doneSteps} / {STEPS.length}</div>
        <div className="lunar-progress"><i style={{ width: `${doneSteps / STEPS.length * 100}%` }} /></div>
        <ol className="nav-mission-zone">{STEPS.map((step, i) => <li key={i} className={steps[i] ? 'done' : i === stepIndex ? 'current' : ''}><i>{steps[i] ? '✓' : ''}</i>{i + 1}. {step.text}</li>)}</ol>
      </section>
    </aside>
  </div>
}

