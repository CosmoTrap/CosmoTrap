import { useState } from 'react'
import { fr } from '../../i18n/fr'
import { LAUNCH, SEQUENCE, pressSeq } from '../logic'
import { shuffle } from '../shuffle'
import { useGame } from '../state'

// Zone 3 : séquence de lancement au poste de pilotage.
const COLORS: Record<string, { bg: string; pattern: string }> = {
  blue: { bg: 'radial-gradient(circle at 40% 35%, #6f9bff, #1f4fd6)', pattern: 'repeating-linear-gradient(45deg, rgba(255,255,255,.25) 0 4px, transparent 4px 10px)' },
  yellow: { bg: 'radial-gradient(circle at 40% 35%, #ffe680, #e0b000)', pattern: 'radial-gradient(circle, rgba(0,0,0,.3) 2px, transparent 3px) 0 0/12px 12px' },
  red: { bg: 'radial-gradient(circle at 40% 35%, #ff7a6b, #c41f12)', pattern: 'repeating-linear-gradient(0deg, rgba(255,255,255,.25) 0 3px, transparent 3px 9px)' },
  green: { bg: 'radial-gradient(circle at 40% 35%, #6cf09a, #13a04a)', pattern: 'repeating-linear-gradient(90deg, rgba(0,0,0,.25) 0 3px, transparent 3px 9px)' },
}

export function Sequence() {
  const T = fr.puzzles.sequence
  const seq = useGame((s) => s.seq)
  const cb = useGame((s) => s.settings.colorblind)
  const [order] = useState(() => shuffle(['blue', 'yellow', 'red', 'green'], (o) => o.every((c, i) => c === LAUNCH[i]) || o.every((c, i) => c === SEQUENCE[i])))
  return (
    <div className="panel" data-testid="sequence">
      <h2>{T.title}</h2>
      <p className="sub">{T.sub}</p>
      <div className="seq">
        {order.map((c) => (
          <button key={c} data-testid={`seq-${c}`} onClick={() => pressSeq(c)} style={{ background: cb ? `${COLORS[c].pattern}, ${COLORS[c].bg}` : COLORS[c].bg }}>
            {T.colors[c]}
          </button>
        ))}
      </div>
      <div className="seq-dots">
        {LAUNCH.map((_, i) => (
          <i key={i} style={{ background: i < seq.length ? '#ff6b35' : 'transparent' }} />
        ))}
      </div>
    </div>
  )
}
