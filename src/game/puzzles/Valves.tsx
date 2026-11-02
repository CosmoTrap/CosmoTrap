import { fr } from '../../i18n/fr'
import { pressValve, resetValves } from '../logic'
import { useGame } from '../state'

// Énigme 2 (zone 1) : pressurisation du sas — Lights Out 3×3.
export function Valves() {
  const T = fr.puzzles.valves
  const valves = useGame((s) => s.valves)
  const done = useGame((s) => s.flags.pressurized)
  return (
    <div className="panel" data-testid="valves">
      <h2>{T.title}</h2>
      <p className="sub">{T.sub}</p>
      <div className="valves">
        {valves.map((on, i) => (
          <button key={i} data-testid={`valve-${i}`} className={`valve ${on ? 'on' : 'off'}`} onClick={() => pressValve(i)} disabled={done}>
            <span>{on ? 'OUVERTE' : 'FERMÉE'}</span>
          </button>
        ))}
      </div>
      <div style={{ textAlign: 'center', marginTop: 18 }}>
        <button className="btn ghost" onClick={resetValves} disabled={done}>
          {T.reset}
        </button>
      </div>
    </div>
  )
}
