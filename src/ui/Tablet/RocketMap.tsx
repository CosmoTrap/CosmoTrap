import { stepsState } from '../../game/logic'
import { TILE } from '../../game/maps'
import { useGame } from '../../game/state'
import type { RoomDef } from '../../game/types'
import { fr } from '../../i18n/fr'
import { Furniture, Lock, roomCode, roomStatus } from './moduleArt'

// The Hermès seen from above, as its own navigation tablet draws it: a white hull with a pointed nose and
// cockpit canopy, swept fins and three engines, and the four compartments inside the fuselage.
// Same metres as the 3D level: the hull wraps the zone 3 grid (x 0–18, z 0–28).

/** Area the plan must show around the hull, nose and fins included. */
export const ROCKET_BOUNDS = { minX: -7, maxX: 25, minZ: -11, maxZ: 34 }
const ENGINES = [5, 9, 13]
const NOSE = 'M.2 2C.2-3.6 4.6-8.4 9-9.6C13.4-8.4 17.8-3.6 17.8 2'

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
    {/* Engine plumes once the cell is in, then the bells. */}
    {engine && ENGINES.map((x) => <ellipse key={`f${x}`} cx={x} cy="33" rx="2.2" ry="3.8" fill="url(#hermes-flame)" opacity=".85" />)}
    {ENGINES.map((x) => <path key={x} d={`M${x - 1.1} 27.6L${x - 1.9} 31.6H${x + 1.9}L${x + 1.1} 27.6Z`} fill="url(#hermes-bell)" stroke="#20252b" strokeWidth=".12" />)}
    {/* Swept fins, white like the hull, with an orange tip. */}
    {[-1, 1].map((s) => {
      const root = s < 0 ? .4 : 17.6, tip = s < 0 ? -5.8 : 23.8
      return <g key={s}>
        <path d={`M${root} 17.2L${tip} 26.6L${tip} 29L${root} 27.4Z`} fill="url(#hermes-paint)" stroke="#5d6678" strokeWidth=".12" />
        <path d={`M${tip} 26.6L${tip} 29L${tip + s * -.9} 28.6L${tip + s * -.9} 27.6Z`} fill="#e8602a" />
      </g>
    })}
    {/* Fuselage and nose, in one outline. */}
    <path d={`${NOSE}V26.4Q17.8 28 16.2 28H1.8Q.2 28 .2 26.4Z`} fill="url(#hermes-paint)" stroke="#d9dee6" strokeWidth=".18" />
    {/* Orange bands, as on the real hull. */}
    {[9.1, 19.1].map((z) => <g key={z}><rect x=".2" y={z - .3} width="1.5" height=".6" fill="#e8602a" /><rect x="16.3" y={z - .3} width="1.5" height=".6" fill="#e8602a" /></g>)}
    {/* Cockpit canopy across the nose, and the pressure cabin's dark interior. */}
    <path d="M3 1.2C4.4-2.4 6.8-4.6 9-5.2C11.2-4.6 13.6-2.4 15 1.2Z" fill="url(#hermes-glass)" stroke="#d9dee6" strokeWidth=".14" opacity=".92" />
    <path d="M6 -1.5L12 -1.5M5 0L13 0" stroke="#e6f4ff" strokeWidth=".1" opacity=".55" />
    <rect x="1.7" y="1.6" width="14.6" height="24.8" rx=".5" fill="#0c1222" stroke="#5d6678" strokeWidth=".1" />
    <text x="1" y="14" fontSize="1.05" fill="#23304a" fontFamily="Outfit, Inter, sans-serif" fontWeight="800" letterSpacing=".3" transform="rotate(-90 1 14)" textAnchor="middle">HERMÈS</text>
    <text x="17" y="14" fontSize="1.05" fill="#23304a" fontFamily="Outfit, Inter, sans-serif" fontWeight="800" letterSpacing=".3" transform="rotate(90 17 14)" textAnchor="middle">HERMÈS</text>
    {/* Heading and trajectory, above the nose. */}
    <path d="M9 -10.3V-12" stroke="#ecc24a" strokeWidth=".14" strokeDasharray=".4 .3" />
    <text x="9" y="-10.6" fontSize=".72" fill="#ecc24a" fontFamily="monospace" textAnchor="middle" transform="translate(0 -1.6)">CAP · TLI → TERRE</text>
  </g>
}

const TAGS = { solved: ['✓ RÉSOLU', '#3fd6a0'], current: ['EN COURS', '#ff9a62'], locked: ['VERROUILLÉ', '#ff6a60'], idle: null } as const

/** One compartment of the fuselage: deck plates, its real furniture, its name and state. */
export function Compartment({ room, selected }: { room: RoomDef; selected: boolean }) {
  const [x0, z0, x1, z1] = room.rect
  const x = x0 * TILE, z = z0 * TILE, w = (x1 - x0 + 1) * TILE, d = (z1 - z0 + 1) * TILE
  const status = roomStatus(3, room), tag = TAGS[status]
  const name = `${roomCode(room, 3)} · ${(fr.rooms[room.name] ?? room.name).toUpperCase()}`
  return <>
    <rect x={x} y={z} width={w} height={d} rx=".35" fill="#151c30" stroke={selected ? '#ff865c' : '#4d5874'} strokeWidth={selected ? .22 : .08} />
    <rect x={x} y={z} width={w} height={d} rx=".35" fill="url(#nav-floor)" />
    <Furniture zone={3} room={room} />
    {status === 'locked' && <>
      <rect x={x} y={z} width={w} height={d} rx=".35" fill="url(#nav-locked)" stroke="#ff5a55" strokeWidth=".12" strokeDasharray=".5 .35" />
      <Lock x={x + w / 2} z={z + d / 2} size={.8} />
    </>}
    <g pointerEvents="none">
      <rect x={x + .25} y={z + .25} width={name.length * .43 + .5} height=".95" rx=".2" fill="#0b1020d9" />
      <text x={x + .5} y={z + .95} fontSize=".66" fill="#e1e6f7" fontFamily="monospace" letterSpacing=".03">{name}</text>
      {tag && <>
        <rect x={x + w - tag[0].length * .45 - .75} y={z + d - 1.2} width={tag[0].length * .45 + .5} height=".95" rx=".2" fill="#0b1020d9" stroke={tag[1]} strokeWidth=".06" />
        <text x={x + w - .5} y={z + d - .5} textAnchor="end" fontSize=".62" fill={tag[1]} fontFamily="monospace">{tag[0]}</text>
      </>}
    </g>
  </>
}

/** Flight data and on-board systems, at the sides of the plan: what the crew's tablet shows aboard. */
export function RocketHud() {
  useGame((s) => s.flags)
  useGame((s) => s.planDone)
  useGame((s) => s.choice)
  const steps = stepsState(3)
  const engine = useGame.getState().flags.engine
  return <>
    <div className="rocket-hud left" aria-hidden="true">
      <small>VOL · HERMÈS</small>
      <dl>
        <div><dt>Cap</dt><dd>TLI → Terre</dd></div>
        <div><dt>Orbite</dt><dd>112 km</dd></div>
        <div><dt>Δv requis</dt><dd>3,1 km/s</dd></div>
        <div><dt>Moteurs</dt><dd className={engine ? 'ok' : 'off'}>{engine ? 'Prêts · 3/3' : 'Sans cellule'}</dd></div>
      </dl>
      <svg viewBox="0 0 100 46" className="rocket-orbit">
        <circle cx="22" cy="23" r="9" fill="#2a3f63" stroke="#7aa2d6" strokeWidth=".8" />
        <ellipse cx="22" cy="23" rx="17" ry="13" fill="none" stroke="#5d6a8c" strokeWidth=".6" strokeDasharray="2 1.5" />
        <path d="M39 23C55 6 78 6 92 18" fill="none" stroke="#ecc24a" strokeWidth=".9" strokeDasharray="3 2" />
        <circle cx="92" cy="20" r="4.5" fill="#3f8be0" />
        <circle cx="39" cy="23" r="1.6" fill="#ff9a62" />
      </svg>
    </div>
    <div className="rocket-hud right" aria-hidden="true">
      <small>SYSTÈMES DE BORD</small>
      <ol>{steps.map((st) => <li key={st.id} className={st.status}><i />{st.text}</li>)}</ol>
    </div>
  </>
}
