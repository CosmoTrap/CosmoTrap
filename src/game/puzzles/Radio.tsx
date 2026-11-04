import { useEffect, useRef, useState } from 'react'
import { fr } from '../../i18n/fr'
import { audio } from '../audio/audio'
import { emitRadio } from '../logic'

// Zone 4 : balise radio, fréquence de détresse 121,5 MHz.
export function Radio() {
  const T = fr.puzzles.radio
  const [f, setF] = useState(118.0)
  const last = useRef(0)
  const set = (v: number) => {
    const n = Math.round(Math.min(136, Math.max(118, v)) * 10) / 10
    setF(n)
    const now = performance.now()
    if (now - last.current > 90) {
      const dist = Math.abs(n - 121.5)
      audio.sfx('radio_tune', { vol: dist > 2 ? 0.35 : Math.min(1, dist / 2 + 0.15) })
      last.current = now
    }
  }
  useEffect(() => {
    audio.loop('static', 'static', { vol: 0.5 })
    return () => audio.stopLoop('static')
  }, [])
  useEffect(() => {
    const dist = Math.abs(f - 121.5)
    audio.loopVol('static', dist >= 2 ? 0.55 : Math.min(0.55, dist / 2))
  }, [f])
  const noise = Math.min(1, Math.abs(f - 121.5) / 2)
  return (
    <div className="panel" data-testid="radio">
      <h2>{T.title}</h2>
      <p className="sub">{T.sub}</p>
      <div className="radio-face">
        <div className="freq" data-testid="radio-freq">
          {f.toFixed(1).replace('.', ',')} <small>MHz</small>
        </div>
        <div className="static-meter">
          <div style={{ width: `${(1 - noise) * 100}%` }} />
        </div>
        <p className="sub" style={{ textAlign: 'center', margin: '8px 0 0' }}>{noise >= 1 ? T.far : T.near}</p>
        <input className="dial" type="range" min={118} max={136} step={0.1} value={f} onChange={(e) => set(parseFloat(e.target.value))} />
        <div className="radio-btns">
          <button className="btn" data-testid="radio-m1" onClick={() => set(f - 1)}>
            −1
          </button>
          <button className="btn" data-testid="radio-m01" onClick={() => set(f - 0.1)}>
            −0,1
          </button>
          <button className="btn" data-testid="radio-p01" onClick={() => set(f + 0.1)}>
            +0,1
          </button>
          <button className="btn" data-testid="radio-p1" onClick={() => set(f + 1)}>
            +1
          </button>
          <button className="btn primary" data-testid="radio-emit" onClick={() => emitRadio(f)}>
            {T.emit}
          </button>
        </div>
      </div>
    </div>
  )
}
