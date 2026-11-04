import { useEffect, useRef, useState } from 'react'
import { audio } from '../../game/audio/audio'
import { live, useGame } from '../../game/state'
import { skipCine } from '../../world/Cinematics'
import { IMPACT_T, prologue } from '../../world/TitleScene'
import { transitionTo } from '../../game/logic'
import { fr } from '../../i18n/fr'
import { requestLock } from '../../player/Player'
import { Keypad } from '../../game/puzzles/Keypad'
import { PowerGrid } from '../../game/puzzles/PowerGrid'
import { Radio } from '../../game/puzzles/Radio'
import { Sequence } from '../../game/puzzles/Sequence'
import { Valves } from '../../game/puzzles/Valves'
import { Algo } from '../../game/puzzles/Algo'
import { Plan } from '../../game/puzzles/Plan'
import { Dilemma } from '../../game/puzzles/Dilemma'
import { update } from './Settings'

const M = fr.menu

export function NoteReader() {
  const id = useGame((s) => s.readNote)
  if (!id) return null
  const n = fr.notes[id]
  if (!n) return null
  const screen = id === 'terminal' || id === 'lab' || id === 'cargo'
  const close = () => {
    useGame.setState({ readNote: null })
    requestLock()
  }
  return (
    <div className="modal-bg" onClick={close} data-testid="note">
      <div className={`note-reader ${screen ? 'screen' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h3>{n.title}</h3>
        {n.text}
        <div className="foot">Ajouté au carnet · E ou clic pour fermer</div>
      </div>
    </div>
  )
}

export function PuzzleHost() {
  const p = useGame((s) => s.puzzle)
  if (!p) return null
  const close = () => {
    useGame.setState({ puzzle: null })
    requestLock()
  }
  return (
    <div className="modal-bg" onClick={close} data-testid="puzzle">
      <div onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
        {p === 'keypad' && <Keypad />}
        {p === 'valves' && <Valves />}
        {p === 'power' && <PowerGrid />}
        {p === 'sequence' && <Sequence />}
        {p === 'radio' && <Radio />}
        {p === 'algo' && <Algo />}
        {p === 'plan' && <Plan />}
        {p === 'dilemma' && <Dilemma />}
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button className="btn ghost" data-testid="puzzle-close" onClick={close}>
            {fr.puzzles.close} (Échap)
          </button>
        </div>
      </div>
    </div>
  )
}

/** bouton « Passer » pour toutes les cinématiques (ou touche Entrée) */
export function SkipCine() {
  const cine = useGame((s) => s.cine)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (!e.repeat && (e.code === 'Enter' || e.code === 'NumpadEnter')) {
        e.preventDefault()
        skipCine()
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  if (!cine || cine === 'faint' || cine === 'fail') return null
  return (
    <button className="btn ghost skip" data-testid="skip" onClick={() => skipCine()}>
      Passer ▸ <span className="key" style={{ marginLeft: 8, marginRight: 0 }}>Entrée</span>
    </button>
  )
}

/** prologue : la station au-dessus de la Lune, puis l'impact */
export function Prologue() {
  const [line, setLine] = useState<string | null>(null)
  useEffect(() => {
    prologue.t0 = performance.now()
    audio.playMusic('title')
    const L = fr.story.prologue
    const timers = L.map((l, i) =>
      setTimeout(() => {
        setLine(l)
        audio.speak(l, { rate: 1.0, id: `prologue_${i}` })
      }, 600 + i * 3500),
    )
    timers.push(
      setTimeout(() => {
        audio.sfx('launch')
        audio.sfx('alarm_o2')
        setLine(fr.story.impact)
      }, IMPACT_T * 1000),
    )
    timers.push(setTimeout(finish, (IMPACT_T + 3.5) * 1000))
    const k = (e: KeyboardEvent) => {
      if (!e.repeat && (e.code === 'Enter' || e.code === 'Escape' || e.code === 'Space')) finish(true)
    }
    window.addEventListener('keydown', k)
    return () => {
      timers.forEach(clearTimeout)
      window.removeEventListener('keydown', k)
    }
  }, [])
  const flash = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let raf = 0
    const loop = () => {
      if (flash.current) flash.current.style.opacity = String(live.flash)
      raf = requestAnimationFrame(loop)
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <>
      <div className="flash" ref={flash} style={{ opacity: 0 }} />
      {line && (
        <div className="subtitle" style={{ bottom: 90 }}>
          <small>Prologue</small>
          {line}
        </div>
      )}
      <button className="btn ghost skip" data-testid="skip-prologue" onClick={() => finish(true)}>
        Passer ▸ <span className="key" style={{ marginLeft: 8, marginRight: 0 }}>Entrée</span>
      </button>
    </>
  )
}

let finished = false
function finish(skip = false) {
  if (useGame.getState().screen !== 'prologue' || finished) return
  finished = true
  setTimeout(() => (finished = false), 1000)
  audio.stopSpeech()
  live.flash = 0
  useGame.setState({ screen: 'playing', loading: 0, paused: false })
  transitionTo(1)
  if (skip) skipCine()
  requestLock()
}

export function RotatePhone() {
  return (
    <div className="rotate">
      <div>
        <div className="phone" />
        <h2 style={{ fontFamily: 'Rajdhani', letterSpacing: '0.15em' }}>{M.rotate}</h2>
        <p style={{ color: 'var(--muted)' }}>{M.rotateSub}</p>
      </div>
    </div>
  )
}

export { update as updateSettings }

export { End, Pause } from './Report'
