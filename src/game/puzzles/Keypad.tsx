import { useEffect, useRef, useState } from 'react'
import { fr } from '../../i18n/fr'
import { audio } from '../audio/audio'
import { submitKeypad } from '../logic'
import { shuffle } from '../shuffle'

// Énigme 1 (zone 1) : casier de secours, code à 4 chiffres.
export function Keypad() {
  const T = fr.puzzles.keypad
  const [code, setCode] = useState('')
  const [state, setState] = useState<'' | 'err' | 'ok'>('')
  const reset = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [layout] = useState(() => {
    const digits = shuffle([...'0123456789'], (o) => o.join('') === '1234567890')
    return [...digits.slice(0, 9), 'C', digits[9], 'OK']
  })
  useEffect(() => () => { if (reset.current) clearTimeout(reset.current) }, [])
  const press = (d: string) => {
    if (state === 'ok') return
    if (reset.current) clearTimeout(reset.current)
    reset.current = null
    audio.sfx('keypad')
    setState('')
    if (d === 'C') return setCode('')
    if (d === 'OK') {
      const ok = submitKeypad(code)
      setState(ok ? 'ok' : 'err')
      if (!ok) reset.current = setTimeout(() => setCode(''), 400)
      return
    }
    setCode((c) => state === 'err' ? d : c.length < 4 ? c + d : c)
  }
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.repeat) return
      if (/^(Digit|Numpad)[0-9]$/.test(e.code)) press(e.code.slice(-1))
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') press('OK')
      else if (e.code === 'Backspace') setCode((c) => c.slice(0, -1))
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', k, true)
    return () => window.removeEventListener('keydown', k, true)
  })
  return (
    <div className="panel" data-testid="keypad">
      <h2>{T.title}</h2>
      <p className="sub">{T.sub}</p>
      <div className={`lcd ${state}`} data-testid="keypad-lcd">
        {code.padEnd(4, '·')}
      </div>
      <div className="keypad">
        {layout.map((d) => (
          <button key={d} data-testid={`key-${d}`} onClick={() => press(d)}>
            {d}
          </button>
        ))}
      </div>
    </div>
  )
}
