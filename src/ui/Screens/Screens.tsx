import { useEffect, useRef, useState } from 'react'
import { audio, speechSeconds } from '../../game/audio/audio'
import { live, recordMessage, useGame } from '../../game/state'
import { skipCine } from '../../world/Cinematics'
import { IMPACT_T, prologue } from '../../world/TitleScene'
import { puzzleHintTarget, transitionTo } from '../../game/logic'
import { HintButtons } from '../HintButtons'
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
import { LunarPuzzle } from '../../game/lunar/LunarPuzzle'
import { missionNote } from '../../game/lunar/logic'
import { update } from './Settings'

const M = fr.menu

export function NoteReader() {
  const id = useGame((s) => s.readNote)
  if (!id) return null
  const n = missionNote(id)
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
        <div className="foot">Archivé dans les messages · E ou clic pour fermer</div>
      </div>
    </div>
  )
}

export function PuzzleHost() {
  const p = useGame((s) => s.puzzle)
  const lunarStep = useGame((s) => s.lunar.current)
  if (!p) return null
  const close = () => {
    useGame.setState({ puzzle: null })
    requestLock()
  }
  return (
    <div className="modal-bg" onClick={close} data-testid="puzzle">
      <div className="puzzle-frame" onClick={(e) => e.stopPropagation()}>
        {p === 'keypad' && <Keypad />}
        {p === 'valves' && <Valves />}
        {p === 'power' && <PowerGrid />}
        {p === 'sequence' && <Sequence />}
        {p === 'radio' && <Radio />}
        {p === 'algo' && <Algo />}
        {p === 'plan' && <Plan />}
        {p === 'dilemma' && <Dilemma />}
        {p === 'lunar' && <LunarPuzzle key={lunarStep} />}
        <div className="puzzle-hints">
          <HintButtons target={puzzleHintTarget(p, lunarStep)} lightId="puzzle-hint" strongId="puzzle-hint2" />
        </div>
        <div style={{ textAlign: 'center' }}>
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
  if (!cine || cine === 'fail' || cine === 'lift') return null
  return (
    <button className="btn ghost skip" data-testid="skip" onClick={() => skipCine()}>
      Passer ▸ <span className="key" style={{ marginLeft: 8, marginRight: 0 }}>Entrée</span>
    </button>
  )
}

/** prologue : la station au-dessus de la Lune, puis l'impact */
export function Prologue() {
  const [line, setLine] = useState<string | null>(null)
  useEffect(() => { if (line) recordMessage(line, 'radio') }, [line])
  useEffect(() => {
    prologue.t0 = performance.now()
    audio.playMusic('title')
    const L = fr.story.prologue
    // Each line starts once the previous one has been said in full.
    const starts = L.map((_, i) => 600 + L.slice(0, i).reduce((a, l) => a + speechSeconds(l) * 1000 + 350, 0))
    const timers = L.map((l, i) =>
      setTimeout(() => {
        setLine(l)
        // The first line, a place and an orbit, is a title on screen: its recording gives the year (the locker's
        // code), and the browser's voice would not be the recorded one that says the rest.
        if (i > 0) audio.speak(l, { rate: 1.0, id: `prologue_${i}` })
      }, starts[i]),
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
        <div className="subtitle film-subtitle" data-testid="prologue-subtitle">
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
  useGame.setState({ screen: 'playing', loading: 0, loadProgress: 0, paused: false })
  transitionTo(1)
  if (skip) skipCine()
  requestLock()
}

export { update as updateSettings }

export { End, Pause } from './Report'
