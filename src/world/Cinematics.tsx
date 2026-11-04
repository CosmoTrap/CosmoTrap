import { useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { audio } from '../game/audio/audio'
import { enterZone, pendingZone, respawnAfterFaint, tick } from '../game/logic'
import { GRID_MAPS, spawnOf } from '../game/maps'
import { riverCenter, terrainHeight } from '../game/maps/zone4'
import { AUTOSAVE_EVERY, G, clearSave, live, saveGame, useGame } from '../game/state'
import { fr } from '../i18n/fr'
import { Astronaut, type AstronautHandle } from './Astronaut'
import { endScene, runScene } from './FilmScenes'
import { heli } from './zone4/Zone4'
import { input } from '../player/input'

// Metteur en scène : briefing holographique, évanouissement, transitions de zone,
// décollage + rentrée atmosphérique, arrivée de l'hélicoptère et fin.

const sm = THREE.MathUtils.smoothstep
/** when the lift's arrival began, measured after the new floor finished loading */
let liftArrival = 0

export function GameLoop() {
  const saveT = useRef(0)
  useFrame((_, dt) => {
    tick(Math.min(dt, 0.1))
    saveT.current += dt
    if (saveT.current > AUTOSAVE_EVERY) {
      saveT.current = 0
      saveGame()
    }
  })
  return null
}

export function CineDirector() {
  const cine = useGame((s) => s.cine)
  const t0 = useGame((s) => s.cineT0)
  const flags = useRef<Record<string, boolean>>({})
  useEffect(() => {
    flags.current = {}
    if (cine === 'briefing') {
      audio.sfx('holo')
    }
    // Pointer lock routes every click to the canvas, including clicks visually
    // over "Passer". Release it for every cinematic, not just the launch.
    // The lift is a short everyday ride: leave the mouse captured so play simply carries on.
    if (cine && cine !== 'lift' && G().cine === cine && document.pointerLockElement) {
      document.exitPointerLock?.()
    }
  }, [cine, t0])
  useEffect(() => () => resetCineView(), [])

  useFrame(() => {
    const s = G()
    if (s.loading < 1) return
    // Read the store, not the previous render: a click can finish the cinematic
    // between two frames. A stale tour frame must never take the camera back.
    const cine = s.cine
    const t = (performance.now() - s.cineT0) / 1000
    const once = (k: string, fn: () => void) => {
      if (!flags.current[k]) {
        flags.current[k] = true
        fn()
      }
    }
    if (!cine) {
      live.fade = Math.max(0, live.fade - 0.03)
      live.flash = Math.max(0, live.flash - 0.03)
      return
    }
    if (cine === 'briefing') {
      const lines = fr.briefing
      const per = 4.6
      const i = Math.floor(t / per)
      if (i < lines.length) {
        once(`l${i}`, () => {
          useGame.setState({ subtitle: lines[i] })
          audio.speak(lines[i], { radio: true, rate: 1.08, id: `briefing_${i}` })
        })
      } else
        once('end', () => {
          resumePlaying(true)
        })
    } else if (cine === 'faint') {
      live.fade = Math.min(1, t / 1.8)
      if (t > 2.2) once('respawn', respawnAfterFaint)
      if (t > 2.6) {
        live.fade = Math.max(0, 1 - (t - 2.6) / 1.5)
        useGame.setState({ subtitle: fr.msg.fainted })
      }
      if (t > 4.4) useGame.setState({ cine: null, subtitle: null })
    } else if (cine === 'zoneCard') {
      live.fade = t < 1.2 ? t / 1.2 : t < 2.4 ? 1 : Math.max(0, 1 - (t - 2.4) / 1.4)
      if (t > 1.2 && pendingZone) once('enter', () => enterZone(pendingZone!))
      const z = s.zone
      const a = t < 1.4 ? 0 : t < 2.0 ? (t - 1.4) / 0.6 : t < 4.2 ? 1 : Math.max(0, 1 - (t - 4.2) / 0.8)
      live.card = { title: fr.zones[z].name, sub: fr.zones[z].sub, a }
      if (t > 5) {
        live.card = null
        if (!s.toured.includes(s.zone)) useGame.setState({ cine: 'tour', cineT0: performance.now() })
        else afterTour()
      }
    } else if (cine === 'lift') {
      if (pendingZone) {
        // The door closes, then the picture fades while the cab travels.
        live.fade = sm(t, 0.55, 1.25)
        if (t > 1.3) once('enter', () => enterZone(pendingZone!))
      } else if (!s.toured.includes(s.zone)) {
        // First arrival on this floor: its title card, then its film scene.
        live.fade = 1
        useGame.setState({ cine: 'zoneCard', cineT0: performance.now() - 1300 })
      } else {
        liftArrival ||= performance.now()
        const a = (performance.now() - liftArrival) / 1000
        live.fade = Math.max(0, 1 - a / 0.9)
        if (a > 0.9) {
          liftArrival = 0
          afterTour()
        }
      }
    } else if (cine === 'tour') {
      // scène « film » de la zone (plans découpés, acteur, crash sur Terre)
      if (!runScene(s.zone, t, !flags.current.started)) once('end', endTour)
      flags.current.started = true
    } else if (cine === 'fail') {
      live.fade = Math.min(1, t / 3)
      const lines = fr.story.fail
      const i = Math.min(lines.length - 1, Math.floor(t / 3))
      once(`f${i}`, () => {
        useGame.setState({ subtitle: lines[i] })
        if (i === 0) {
          audio.sfx('faint')
          audio.stopAllLoops()
        }
      })
      if (t > 7)
        once('end', () => {
          clearSave()
          live.fade = 0
          useGame.setState({ cine: null, ended: true, ending: 'fail', screen: 'end', subtitle: null })
        })
    } else if (cine === 'launch') {
      // compte à rebours
      if (t < 4) {
        const n = 3 - Math.floor(t)
        live.countdown = n > 0 ? String(n) : fr.cine.liftoff
        once(`c${n}`, () => audio.sfx(n > 0 ? 'keypad' : 'success'))
      } else live.countdown = null
      once('music', () => audio.oneShotMusic('launch'))
      if (t > 3) once('rumble', () => audio.sfx('launch'))
      const shake = t < 3 ? 0 : t < 9 ? sm(t, 3, 6) * 1.6 : t < 10 ? 0.4 : t < 17 ? 1.2 + Math.sin(t * 9) * 0.3 : 0
      useGame.setState({ shake })
      // la Lune s'éloigne sous la fusée
      live.ext.y = t < 4 ? 0 : -Math.pow(t - 4, 2.2) * 6
      if (t > 8.6 && t < 10) live.flash = sm(t, 8.6, 9.3) * (1 - sm(t, 9.4, 10))
      if (t > 9.5) {
        once('reentry', () => {
          audio.loop('reentry', 'reentry', { vol: 1 })
          useGame.setState({ subtitle: fr.cine.reentry })
        })
        live.ext.plasma = Math.min(1, (t - 9.5) / 1.5) * (1 - sm(t, 16, 17.5))
      }
      if (t > 16.5) live.flash = sm(t, 16.5, 18)
      if (t > 18)
        once('land', () => {
          audio.stopLoop('reentry')
          live.ext.y = 0
          live.ext.plasma = 0
          useGame.setState({ shake: 0, subtitle: null })
          enterZone(4)
          useGame.setState({ cine: 'zoneCard', cineT0: performance.now() - 1300 })
          live.flash = 0
          live.fade = 1
        })
    } else if (cine === 'heli') {
      const sp = spawnOf(4)
      void sp
      const pad = new THREE.Vector3(6, 2.1, -60)
      // fusée de détresse
      if (t < 5) useGame.setState({ subtitle: fr.cine.heli })
      // trajectoire de l'hélicoptère
      const k = sm(t, 2, 13)
      heli.visible = t > 2
      const from = new THREE.Vector3(-150, 70, -220)
      const hover = new THREE.Vector3(pad.x, pad.y + 9, pad.z - 4)
      const p = from.clone().lerp(hover, k)
      p.y += Math.sin(k * Math.PI) * 15
      if (t > 13) p.copy(hover).setY(pad.y + 9 - sm(t, 13, 18) * 8.6)
      heli.x = p.x
      heli.y = p.y + Math.sin(t * 1.3) * 0.15
      heli.z = p.z
      heli.yaw = Math.atan2(hover.x - from.x, hover.z - from.z) * (1 - sm(t, 11, 15)) + sm(t, 11, 15) * 0.6
      if (t > 2) once('heliSnd', () => audio.loop('rotor', 'rotor', { vol: 0.2 }))
      audio.loopVol('rotor', 0.2 + k * 1.2)
      // caméra 3e personne
      if (t > 8) {
        const a = 0.6 + (t - 8) * 0.05
        const c = new THREE.Vector3(live.pos[0], live.pos[1], live.pos[2])
        live.camOverride = {
          pos: [c.x + Math.sin(a) * 4.2, c.y + 1.6, c.z + Math.cos(a) * 4.2],
          look: [c.x, c.y + 1.3 + sm(t, 8, 12) * 0.6, c.z],
        }
      }
      if (t > 19) live.fade = sm(t, 19, 21)
      if (t > 21.2)
        once('end', () => {
          audio.stopLoop('rotor')
          audio.stopAllLoops()
          audio.oneShotMusic('victory')
          live.camOverride = null
          heli.visible = false
          clearSave()
          useGame.setState({ cine: null, ended: true, ending: 'rescue', screen: 'end', subtitle: null })
          live.fade = 0
        })
    }
  })
  return null
}

function afterTour() {
  const s = G()
  resetCineView()
  const briefing = s.zone === 1 && !s.briefed
  useGame.setState({ cine: briefing ? 'briefing' : null, cineT0: performance.now(), subtitle: null, paused: false, shake: 0 })
}

function endTour() {
  const s = G()
  audio.stopSpeech()
  endScene()
  useGame.setState({ toured: [...s.toured, s.zone] })
  afterTour()
}

/** Release everything owned by a cinematic, including overlays outside the canvas. */
function resetCineView() {
  endScene()
  live.camOverride = null
  live.fade = 0
  live.flash = 0
  live.card = null
  live.countdown = null
  live.ext.y = 0
  live.ext.plasma = 0
  input.down.clear()
  input.jumpRequested = false
  input.look.dx = input.look.dy = 0
  input.joy.x = input.joy.y = 0
  input.touchRun = false
}

function resumePlaying(briefed = G().briefed) {
  audio.stopSpeech()
  audio.stopLoop('reentry')
  resetCineView()
  const s = G()
  useGame.setState({ cine: null, subtitle: null, briefed, paused: false, shake: 0,
    tabletOpen: false, puzzle: null, readNote: null, settingsOpen: false,
    toured: s.toured.includes(s.zone) ? s.toured : [...s.toured, s.zone] })
}

/** Skip is a complete transition, never a timer adjustment waiting on WebGL. */
export function skipCine() {
  const s = G()
  if (!s.cine || s.cine === 'faint' || s.cine === 'fail' || s.cine === 'lift') return
  if (s.cine === 'zoneCard' && pendingZone) enterZone(pendingZone)
  if (s.cine === 'launch') enterZone(4)
  if (s.cine === 'heli') {
    audio.stopAllLoops()
    heli.visible = false
    clearSave()
    resumePlaying()
    audio.oneShotMusic('victory')
    useGame.setState({ ended: true, ending: 'rescue', screen: 'end' })
    return
  }
  resumePlaying(G().zone === 1 ? true : G().briefed)
}

/** le personnage vu à la 3e personne pendant la fin : il lève le bras */
export function EndAvatar() {
  const cine = useGame((s) => s.cine)
  const t0 = useGame((s) => s.cineT0)
  const character = useGame((s) => s.character)
  const ref = useRef<AstronautHandle>(null)
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!g.current) return
    const show = cine === 'heli' && !!live.camOverride
    g.current.visible = show
    if (!show) return
    const t = (performance.now() - t0) / 1000
    g.current.position.set(live.pos[0], live.pos[1], live.pos[2])
    g.current.rotation.y = Math.atan2(heli.x - live.pos[0], heli.z - live.pos[2])
    const a = ref.current
    if (a?.armR) {
      const k = sm(t, 9, 10.5)
      a.armR.rotation.x = -k * 2.7 + Math.sin(t * 5) * 0.15 * k
      a.armR.rotation.z = k * 0.3
    }
    if (a?.head) a.head.rotation.x = -0.25 * sm(t, 9, 11)
  })
  return (
    <group ref={g} visible={false}>
      <Astronaut ref={ref} skin={character} accent={fr.characters[character]?.color ?? '#d9673a'} />
    </group>
  )
}

/** fusée éclairante tirée à l'hélisurface */
export function Flare() {
  const cine = useGame((s) => s.cine)
  const t0 = useGame((s) => s.cineT0)
  const g = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  useFrame(() => {
    if (!g.current) return
    const t = (performance.now() - t0) / 1000
    const on = cine === 'heli' && t < 9
    g.current.visible = on
    if (!on) return
    const h = Math.min(60, t * 28 - t * t * 1.6)
    g.current.position.set(live.pos[0] + 1 + t * 0.3, live.pos[1] + 1.6 + h, live.pos[2] - 2)
    if (light.current) light.current.intensity = 400 * (1 - t / 9)
  })
  return (
    <group ref={g} visible={false}>
      <mesh>
        <sphereGeometry args={[0.25, 10, 8]} />
        <meshBasicMaterial color={new THREE.Color(30, 4, 2)} />
      </mesh>
      <pointLight ref={light} color="#ff3a20" distance={120} decay={1.4} />
    </group>
  )
}
