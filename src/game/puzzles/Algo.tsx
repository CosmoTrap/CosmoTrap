import { useState } from 'react'
import { fr } from '../../i18n/fr'
import { audio } from '../audio/audio'
import { submitAlgo } from '../logic'
import { useGame } from '../state'

// Énigme d'algorithmique (zone 2) : exécuter le pseudo-code du terminal à la main.
const NAMES: Record<string, string> = { blue: 'BLEU', yellow: 'JAUNE', red: 'ROUGE', green: 'VERT' }
const CSS: Record<string, string> = { blue: '#2f6bff', yellow: '#e0b000', red: '#d0281a', green: '#18a64e' }

export function Algo() {
  const order = useGame((s) => s.algoOrder)
  const [out, setOut] = useState<string[]>([])
  const add = (c: string) => {
    audio.sfx('keypad')
    setOut((o) => (o.length < 4 ? [...o, c] : o))
  }
  return (
    <div className="panel" style={{ width: 'min(640px, 94vw)' }} data-testid="algo">
      <h2>{fr.algo.title}</h2>
      <p className="sub">{fr.algo.sub}</p>
      <pre className="code">
        <span className="kw">couleurs</span> ← [ROUGE, JAUNE, BLEU, VERT] <span className="cm">// indices 0 à 3</span>
        {'\n'}
        <span className="kw">pour</span> i <span className="kw">allant de</span> 0 <span className="kw">à</span> 3 :{'\n'}
        {'    '}j ← (3 × i + 2) <span className="kw">mod</span> 4{'\n'}
        {'    '}
        <span className="kw">émettre</span> couleurs[j]
      </pre>
      <div className="algo-out">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="algo-slot" style={{ borderColor: out[i] ? CSS[out[i]] : undefined }}>
            <small>i = {i}</small>
            {out[i] ? NAMES[out[i]] : '—'}
          </div>
        ))}
      </div>
      <div className="radio-btns" style={{ marginTop: 14 }}>
        {order.map((c) => (
          <button key={c} className="btn" data-testid={`algo-${c}`} style={{ borderColor: CSS[c], color: CSS[c] }} onClick={() => add(c)}>
            {NAMES[c]}
          </button>
        ))}
        <button className="btn ghost" onClick={() => setOut([])}>
          Effacer
        </button>
        <button
          className="btn primary"
          data-testid="algo-load"
          disabled={out.length < 4}
          onClick={() => {
            if (!submitAlgo(out)) setOut([])
          }}
        >
          {fr.algo.load}
        </button>
      </div>
    </div>
  )
}
