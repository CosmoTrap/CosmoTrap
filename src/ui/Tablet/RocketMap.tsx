import { stepsState } from '../../game/logic'
import { TILE } from '../../game/maps'
import { useGame } from '../../game/state'
import type { RoomDef } from '../../game/types'
import { fr } from '../../i18n/fr'
import { Furniture, Lock, roomCode, roomStatus } from './moduleArt'

// The Hermès seen from above, drawn with the same language as the station and base plans (white hull,
// dark decks with their real furniture, status tags and labels outside with a leader line), in orbit:
// Earth's limb below, the transfer trajectory ahead of the nose. Metres of the zone 3 grid (x 0–18, z 0–28).

/** Area the plan must show: hull, fins, labels round it and the Earth's limb. */
export const ROCKET_BOUNDS = { minX: -15, maxX: 33, minZ: -13, maxZ: 35 }
const ENGINES = [5, 9, 13]
const NOSE = 'M.2 2C.2-3.6 4.6-8.4 9-9.6C13.4-8.4 17.8-3.6 17.8 2'

/** Earth's limb and the trajectory, under everything else. */
export function OrbitBackdrop() {
  return <g pointerEvents="none">
    <defs>
      <radialGradient id="hermes-earth" cx="0.5" cy="0.5" r="0.5">
        <stop offset=".86" stopColor="#1d4f8f" /><stop offset=".95" stopColor="#3f8be0" /><stop offset=".985" stopColor="#9fd0ff" /><stop offset="1" stopColor="#9fd0ff" stopOpacity="0" />
      </radialGradient>
    </defs>
    <circle cx="40" cy="78" r="52" fill="url(#hermes-earth)" opacity=".55" />
    {/* Orbit, then the burn that leaves it, straight off the nose. */}
    <ellipse cx="40" cy="78" rx="62" ry="62" fill="none" stroke="#5d6a8c" strokeWidth=".12" strokeDasharray=".8 .6" />
    <path d="M9 -10.2C9 -11.8 11 -12.6 16 -12.8" fill="none" stroke="#ecc24a" strokeWidth=".18" strokeDasharray=".7 .45" />
    <text x="16.6" y="-12.5" fontSize="1.1" fill="#ecc24a" fontFamily="monospace">TLI → TERRE</text>
  </g>
}

/** Hull, fins, engines and canopy, drawn under the compartments. */
export function HermesHull() {
  const engine = useGame((s) => s.flags.engine)
  return <g pointerEvents="none">
    <defs>
      <linearGradient id="hermes-paint" x2="1"><stop stopColor="#8f97a6" /><stop offset=".18" stopColor="#eef1f4" /><stop offset=".5" stopColor="#ffffff" /><stop offset=".82" stopColor="#e3e7ec" /><stop offset="1" stopColor="#8f97a6" /></linearGradient>
      <linearGradient id="hermes-bell" x2="1"><stop stopColor="#3a3f46" /><stop offset=".5" stopColor="#8a929b" /><stop offset="1" stopColor="#3a3f46" /></linearGradient>
      <linearGradient id="hermes-glass" y2="1"><stop stopColor="#bfe3ff" /><stop offset="1" stopColor="#3f7fc4" /></linearGradient>
      <radialGradient id="hermes-flame" cy="0"><stop stopColor="#fff2c8" /><stop offset=".4" stopColor="#ff9e3d" /><stop offset="1" stopColor="#ff6a2a" stopOpacity="0" /></radialGradient>
    </defs>
    {engine && ENGINES.map((x) => <ellipse key={`f${x}`} cx={x} cy="33" rx="2.2" ry="3.8" fill="url(#hermes-flame)" opacity=".85" />)}
    {ENGINES.map((x) => <path key={x} d={`M${x - 1.1} 27.6L${x - 1.9} 31.6H${x + 1.9}L${x + 1.1} 27.6Z`} fill="url(#hermes-bell)" stroke="#20252b" strokeWidth=".12" />)}
    {[-1, 1].map((s) => {
      const root = s < 0 ? .4 : 17.6, tip = s < 0 ? -5.8 : 23.8
      return <g key={s}>
        <path d={`M${root} 17.2L${tip} 26.6L${tip} 29L${root} 27.4Z`} fill="url(#hermes-paint)" stroke="#5d6678" strokeWidth=".12" />
        <path d={`M${tip} 26.6L${tip} 29L${tip + s * -.9} 28.6L${tip + s * -.9} 27.6Z`} fill="#e8602a" />
      </g>
    })}
    <path d={`${NOSE}V26.4Q17.8 28 16.2 28H1.8Q.2 28 .2 26.4Z`} fill="url(#hermes-paint)" stroke="#d9dee6" strokeWidth=".18" />
    {[9.1, 19.1].map((z) => <g key={z}><rect x=".2" y={z - .3} width="1.5" height=".6" fill="#e8602a" /><rect x="16.3" y={z - .3} width="1.5" height=".6" fill="#e8602a" /></g>)}
    <path d="M3 1.2C4.4-2.4 6.8-4.6 9-5.2C11.2-4.6 13.6-2.4 15 1.2Z" fill="url(#hermes-glass)" stroke="#d9dee6" strokeWidth=".14" opacity=".92" />
    <path d="M6 -1.5L12 -1.5M5 0L13 0" stroke="#e6f4ff" strokeWidth=".1" opacity=".55" />
    {/* The pressure cabin, then the bulkheads between compartments, as on the real ship. */}
    <rect x="1.7" y="1.6" width="14.6" height="24.8" rx=".5" fill="#0c1222" stroke="#5d6678" strokeWidth=".1" />
    <text x="1" y="14" fontSize="1.05" fill="#23304a" fontFamily="Outfit, Inter, sans-serif" fontWeight="800" letterSpacing=".3" transform="rotate(-90 1 14)" textAnchor="middle">HERMÈS</text>
    <text x="17" y="14" fontSize="1.05" fill="#23304a" fontFamily="Outfit, Inter, sans-serif" fontWeight="800" letterSpacing=".3" transform="rotate(90 17 14)" textAnchor="middle">HERMÈS</text>
  </g>
}

type Status = ReturnType<typeof roomStatus>
const TAGS: Record<Status, readonly [string, string] | null> = { solved: ['✓ RÉSOLU', '#3fd6a0'], current: ['ÉNIGME EN COURS', '#ff9a62'], locked: ['VERROUILLÉ', '#ff6a60'], idle: null }

/** One compartment of the fuselage: deck plates and its real furniture, with its lock when closed. */
export function Compartment({ room, selected }: { room: RoomDef; selected: boolean }) {
  const [x0, z0, x1, z1] = room.rect
  const x = x0 * TILE, z = z0 * TILE, w = (x1 - x0 + 1) * TILE, d = (z1 - z0 + 1) * TILE
  const status = roomStatus(3, room)
  return <>
    <rect x={x} y={z} width={w} height={d} rx=".35" fill="#151c30" stroke={selected ? '#ff865c' : '#4d5874'} strokeWidth={selected ? .24 : .08} />
    <rect x={x} y={z} width={w} height={d} rx=".35" fill="url(#nav-floor)" />
    <Furniture zone={3} room={room} />
    {status === 'locked' && <>
      <rect x={x} y={z} width={w} height={d} rx=".35" fill="url(#nav-locked)" stroke="#ff5a55" strokeWidth=".12" strokeDasharray=".5 .35" />
      <Lock x={x + w / 2} z={z + d / 2} size={.8} />
    </>}
    {selected && [[0, 0], [1, 0], [0, 1], [1, 1]].map(([kx, kz]) => {
      const cx = x + kx * w + (kx ? .55 : -.55), cz = z + kz * d + (kz ? .55 : -.55)
      return <path key={`${kx}${kz}`} d={`M${cx + (kx ? -.9 : .9)},${cz}H${cx}V${cz + (kz ? -.9 : .9)}`} fill="none" stroke="#ff865c" strokeWidth=".18" pointerEvents="none" />
    })}
  </>
}

/** Where each compartment's label sits, outside the hull, and the side it reads from. */
const LABELS: Record<string, { x: number; z: number; end?: boolean }> = {
  cockpit: { x: 21.5, z: 2.6 }, pont: { x: 21.5, z: 13.5 }, soute: { x: -3.5, z: 21, end: true }, moteurs: { x: 26, z: 31 },
}

/** Code, name and state of a compartment, outside the hull with a leader line to it, like the station's modules. */
export function CompartmentLabel({ room }: { room: RoomDef }) {
  const at = LABELS[room.id]
  if (!at) return null
  const [x0, z0, x1, z1] = room.rect
  const cx = (x0 + x1 + 1) * TILE / 2, cz = (z0 + z1 + 1) * TILE / 2
  const tag = TAGS[roomStatus(3, room)]
  const name = `${roomCode(room, 3)} · ${(fr.rooms[room.name] ?? room.name).toUpperCase()}`
  const tw = tag ? tag[0].length * .8 + 1 : 0
  const anchor = at.end ? 'end' : 'start'
  return <g pointerEvents="none">
    <path d={`M${cx} ${cz}L${at.x + (at.end ? .4 : -.4)} ${at.z - .35}`} stroke="#7f8aa6" strokeWidth=".07" strokeDasharray=".3 .25" />
    <circle cx={cx} cy={cz} r=".22" fill="#7f8aa6" />
    {tag && <g>
      <rect x={at.end ? at.x - tw : at.x} y={at.z - 3.05} width={tw} height="1.6" rx=".24" fill={`${tag[1]}22`} stroke={tag[1]} strokeWidth=".07" />
      <text x={(at.end ? at.x - tw : at.x) + .5} y={at.z - 1.9} fontSize=".95" fill={tag[1]} fontFamily="monospace">{tag[0]}</text>
    </g>}
    <text x={at.x} y={at.z} textAnchor={anchor} fontSize="1.3" fill="#e1e6f7" fontFamily="monospace" letterSpacing=".04">{name}</text>
  </g>
}

/** Flight data and on-board systems, for the tablet's side panel aboard the Hermès. */
export function RocketFlightCard() {
  useGame((s) => s.flags)
  useGame((s) => s.planDone)
  useGame((s) => s.choice)
  const steps = stepsState(3)
  const engine = useGame.getState().flags.engine
  const done = steps.filter((s) => s.status === 'done').length
  return <section className="nav-card nav-module rocket-flight">
    <div className="nav-eyebrow">VOL · HERMÈS · {done} / {steps.length}</div>
    <dl className="nav-rows">
      <div><dt>Cap</dt><dd>TLI → Terre</dd></div>
      <div><dt>Orbite</dt><dd>112 km</dd></div>
      <div><dt>Δv requis</dt><dd>3,1 km/s</dd></div>
      <div><dt>Moteurs</dt><dd className={engine ? 'ok' : 'off'}>{engine ? 'Prêts · 3/3' : 'Sans cellule'}</dd></div>
    </dl>
    <ol className="rocket-steps">{steps.map((st) => <li key={st.id} className={st.status}><i />{st.text}</li>)}</ol>
  </section>
}
