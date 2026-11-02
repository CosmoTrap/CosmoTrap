import { useRef } from 'react'
import { fr } from '../i18n/fr'
import { act, toggleLamp } from '../game/logic'
import { useGame } from '../game/state'
import { aim, closeTablet, openTablet } from '../player/Player'
import { input } from '../player/input'

// Commandes tactiles (paysage) : joystick à gauche, glisser à droite, boutons Agir / Lampe.
export function MobileControls() {
  const joy = useRef<HTMLDivElement>(null)
  const knob = useRef<HTMLDivElement>(null)
  const joyId = useRef<number | null>(null)
  const lookId = useRef<number | null>(null)
  const last = useRef({ x: 0, y: 0 })
  const tablet = useGame((s) => s.tabletOpen)

  const onJoy = (e: React.PointerEvent) => {
    const r = joy.current!.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    let dx = (e.clientX - cx) / (r.width / 2)
    let dy = (e.clientY - cy) / (r.height / 2)
    const l = Math.hypot(dx, dy)
    if (l > 1) {
      dx /= l
      dy /= l
    }
    input.joy.x = dx
    input.joy.y = dy
    if (knob.current) knob.current.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`
  }
  const endJoy = () => {
    joyId.current = null
    input.joy.x = 0
    input.joy.y = 0
    if (knob.current) knob.current.style.transform = ''
  }
  return (
    <>
      <div
        className="look-zone"
        onPointerDown={(e) => {
          lookId.current = e.pointerId
          last.current = { x: e.clientX, y: e.clientY }
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
        }}
        onPointerMove={(e) => {
          if (lookId.current !== e.pointerId) return
          input.look.dx += (e.clientX - last.current.x) * 1.6
          input.look.dy += (e.clientY - last.current.y) * 1.6
          last.current = { x: e.clientX, y: e.clientY }
        }}
        onPointerUp={() => (lookId.current = null)}
        onPointerCancel={() => (lookId.current = null)}
      />
      <div
        className="joy"
        ref={joy}
        onPointerDown={(e) => {
          joyId.current = e.pointerId
          ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          onJoy(e)
        }}
        onPointerMove={(e) => joyId.current === e.pointerId && onJoy(e)}
        onPointerUp={endJoy}
        onPointerCancel={endJoy}
      >
        <div className="knob" ref={knob} />
      </div>
      <div className="mbtns">
        <button className="mbtn" onPointerDown={() => toggleLamp()}>
          {fr.hud.lampBtn}
        </button>
        <button className="mbtn act" onPointerDown={() => aim.id && act(aim.id)}>
          {fr.hud.act}
        </button>
      </div>
      <div className="mtop">
        <button className="mbtn" onPointerDown={() => (tablet ? closeTablet() : openTablet())}>
          {fr.hud.tablet}
        </button>
        <button className="mbtn" onPointerDown={() => useGame.setState({ paused: true })}>
          {fr.hud.pauseBtn}
        </button>
      </div>
    </>
  )
}
