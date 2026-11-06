import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { audio, speechSeconds } from '../game/audio/audio'
import { enterZone, pendingZone, tick } from '../game/logic'
import { GRID_MAPS, spawnOf } from '../game/maps'
import { riverCenter, terrainHeight } from '../game/maps/zone4'
import { AUTOSAVE_EVERY, G, closeFinishedRun, live, saveGame, useGame } from '../game/state'
import { fr } from '../i18n/fr'
import { RealModel } from './props/RealModel'
import { endScene, runScene } from './FilmScenes'
import { heli } from './zone4/Zone4'
import { input } from '../player/input'
import { LAUNCH, launchCamera } from './cine/LaunchStage'
import { PAD, VEHICLES, vehiclePose } from './cine/Rescue'
import { finishLunar } from '../game/lunar/logic'
import { ROCKET } from '../game/lunar/map'

// Metteur en scène : briefing holographique, transitions de zone,
// décollage + rentrée atmosphérique, arrivée de l'hélicoptère et fin.

const sm = THREE.MathUtils.smoothstep

/** Camera bearing around the player during the rescue; the flare flies away from it. */
const FLARE_ORBIT = 0.6
/** Time (s) at which the flare reaches its peak and bursts. */
const FLARE_APEX = 3
/** Where the flare is, t seconds after the shot: up and away from the camera, then drifting down. */
function flarePosition(t: number) {
  const up = Math.min(t, FLARE_APEX)
  const after = Math.max(0, t - FLARE_APEX)
  const out = 0.4 + 9 * up + 0.5 * after
  return new THREE.Vector3(
    live.pos[0] - Math.sin(FLARE_ORBIT) * out,
    live.pos[1] + 2 + 30 * up - 5 * up * up - 1.2 * after,
    live.pos[2] - Math.cos(FLARE_ORBIT) * out,
  )
}
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
    if (cine === 'lunarLaunch') {
      live.camOverride = { pos: [ROCKET[0] + 22, 4 + t * 1.4, ROCKET[1] + 26], look: [ROCKET[0], 8 + Math.max(0, t - 3) ** 2 * 1.4, ROCKET[1]], fov: 58 }
      live.countdown = t < 3 ? String(3 - Math.floor(t)) : null
      once('ignition', () => { audio.sfx('airlock'); audio.playMusic('hermes') })
      if (t > 9) once('lunar-finish', finishLunar)
      return
    }
    if (cine === 'briefing') {
      const lines = fr.briefing
      // Each line is given the time to be said in full before the next.
      const durations = lines.map((l) => Math.max(4.6, speechSeconds(l) + 0.4))
      let i = 0
      for (let acc = durations[0]; i < lines.length && t >= acc; acc += durations[i] ?? 0) i++
      if (i < lines.length) {
        once(`l${i}`, () => {
          useGame.setState({ subtitle: lines[i] })
          audio.speak(lines[i], { radio: true, rate: 1.08, id: `briefing_${i}` })
        })
      } else
        once('end', () => {
          resumePlaying(true)
        })
    } else if (cine === 'zoneCard') {
      if (t > 1.2 && pendingZone) once('enter', () => enterZone(pendingZone!))
      // When a tour follows, the card stays on black: the tour opens on its own first shot, not on the room.
      const tourNext = !s.toured.includes(pendingZone ?? s.zone)
      live.fade = t < 1.2 ? t / 1.2 : t < 2.4 || tourNext ? 1 : Math.max(0, 1 - (t - 2.4) / 1.4)
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
      } else if (!s.toured.includes(s.zone) && s.zone !== 2) {
        // First arrival on this floor: its title card, then its film scene. Floor 2 has none: you simply step out.
        live.fade = 1
        useGame.setState({ cine: 'zoneCard', cineT0: performance.now() - 1300 })
      } else {
        if (!s.toured.includes(s.zone)) useGame.setState({ toured: [...s.toured, s.zone] })
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
      // Collapse, as hypoxia, blood loss or dehydration bring it on: the picture narrows to a tunnel and loses
      // its colour, the eyes blink longer and longer, things that are not there swim at the edges, the legs
      // give way, a last impact, darkness, and then the verdict.
      const cause = s.failCause ?? 'time'
      if (!death.start) {
        death.start = new THREE.Vector3(live.pos[0], live.pos[1] + 1.62, live.pos[2])
        death.yaw = live.yaw
        death.pitch = live.pitch
        audio.stopAllLoops()
        audio.loop('fail-heart', 'heartbeat', { vol: 0.9 })
      }
      const meteor = cause === 'time' && s.zone < 4
      if (meteor) {
        // The meteor shower reaches the base: impacts, the hull groans, then the air goes.
        once('m1', () => { audio.sfx('impact'); live.flash = 0.7; useGame.setState({ shake: 2.6 }) })
        if (t > 1.6) once('m2', () => { audio.sfx('impact'); audio.sfx('alarm_o2', { vol: 1 }); live.flash = 0.5 })
        useGame.setState({ shake: Math.max(0, 2.6 - t * 0.9) })
      }
      audio.setHeartRate(150 - 90 * sm(t, 2.5, 5.4))
      live.faint = sm(t, 0.3, 5)
      live.hallu = sm(t, 0.8, 3.2) * (1 - sm(t, 4.6, 5.6))
      // Blinks: short, then longer, then the eyes stay shut.
      const blink = (c: number, d: number) => Math.max(0, 1 - Math.abs(t - c) / d)
      live.fade = Math.max(blink(1.5, 0.18), blink(2.9, 0.3), blink(4.0, 0.42), sm(t, 5.3, 6.1))
      // The view sways, then the legs give way: down to the floor, rolling onto the side.
      const fall = Math.pow(sm(t, 4.1, 5.2), 1.6)
      const sway = Math.sin(t * 1.7) * 0.18 * sm(t, 0.4, 2.5) * (1 - fall)
      const yaw = death.yaw + sway + fall * 0.4
      const pitch = death.pitch * (1 - fall) - 0.15 * Math.sin(t * 1.1) * (1 - fall) + fall * 0.55
      const eye = death.start.clone()
      eye.y -= fall * 1.38
      const dir = new THREE.Vector3(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch))
      live.camOverride = { pos: eye.toArray() as [number, number, number], look: eye.clone().add(dir).toArray() as [number, number, number], fov: 72 + 10 * Math.sin(t * 2.3) * live.hallu, roll: fall * 1.25 + Math.sin(t * 1.3) * 0.05 * (1 - fall) }
      if (t > 5.2) once('thud', () => { audio.sfx('impact', { vol: 0.8 }); useGame.setState({ shake: 1.2 }) })
      if (t > 5.4) useGame.setState({ shake: Math.max(0, 1.2 - (t - 5.4) * 3) })
      const lines = fr.story.fail[cause]
      if (t > 0.2) once('f0', () => useGame.setState({ subtitle: lines[0] }))
      if (t > 2.8 && lines[1]) once('f1', () => useGame.setState({ subtitle: lines[1] }))
      if (t > 6) once('dark', () => { audio.stopLoop('fail-heart'); audio.sfx('faint'); useGame.setState({ subtitle: null }) })
      // GAME OVER, and why.
      if (t > 6.6) live.card = { title: fr.cine.gameOver, sub: fr.cine.deathCause[s.zone >= 4 && cause === 'time' ? 'night' : cause], a: sm(t, 6.6, 7.6) * (1 - sm(t, 11.2, 12)) }
      if (t > 12.2)
        once('end', () => {
          closeFinishedRun()
          resetDeath()
          live.card = null
          live.fade = 0
          useGame.setState({ cine: null, ended: true, ending: 'fail', screen: 'end', subtitle: null, shake: 0 })
        })
    } else if (cine === 'launch') {
      // Countdown in the cockpit, then the departure seen from outside (see LaunchStage).
      if (t < LAUNCH.outside) {
        const n = 3 - Math.floor(t)
        live.countdown = n > 0 ? String(n) : null
        once(`c${n}`, () => audio.sfx(n > 0 ? 'keypad' : 'success'))
        live.fade = sm(t, LAUNCH.outside - 0.45, LAUNCH.outside)
      } else {
        live.countdown = null
        live.fade = 1 - sm(t, LAUNCH.outside, LAUNCH.outside + 0.5)
        live.camOverride = launchCamera(t)
      }
      once('music', () => audio.oneShotMusic('launch'))
      if (t > LAUNCH.outside) once('undock', () => { audio.sfx('airlock'); useGame.setState({ subtitle: fr.cine.undock }) })
      if (t > LAUNCH.turn) once('turn', () => useGame.setState({ subtitle: fr.cine.turn }))
      if (t > LAUNCH.ignition) once('ignite', () => { audio.sfx('launch'); useGame.setState({ subtitle: fr.cine.burn }) })
      const thrust = sm(t, LAUNCH.ignition, LAUNCH.burn + 0.5) * (1 - sm(t, LAUNCH.burn + 4, LAUNCH.burn + 7))
      useGame.setState({ shake: thrust * 0.9 + sm(t, LAUNCH.reentry, LAUNCH.reentry + 1) * 1.6 })
      if (t > LAUNCH.reentry) {
        once('reentry', () => {
          audio.loop('reentry', 'reentry', { vol: 1 })
          useGame.setState({ subtitle: fr.cine.reentry })
        })
        live.flash = sm(t, LAUNCH.land - 0.9, LAUNCH.land - 0.1)
      }
      if (t > LAUNCH.land)
        once('land', () => {
          audio.stopLoop('reentry')
          live.ext.y = 0
          live.ext.plasma = 0
          live.camOverride = null
          useGame.setState({ shake: 0, subtitle: null })
          enterZone(4)
          useGame.setState({ cine: 'zoneCard', cineT0: performance.now() - 1300 })
          live.flash = 0
          live.fade = 1
        })
    } else if (cine === 'heli') {
      const ground = (x: number, z: number) => terrainHeight(x, z)
      const padY = ground(PAD.x, PAD.z)
      // The rescue helicopter: far out, across the valley, then a slow descent onto the pad.
      const pad = new THREE.Vector3(PAD.x, padY + 0.1, PAD.z)
      const k = sm(t, 4, 18)
      heli.visible = t > 4
      const from = new THREE.Vector3(-150, 70, -220)
      const hover = new THREE.Vector3(pad.x, pad.y + 9, pad.z - 4)
      const p = from.clone().lerp(hover, k)
      p.y += Math.sin(k * Math.PI) * 15
      if (t > 18) p.copy(hover).lerp(pad.clone().setZ(pad.z), sm(t, 18, 24.5))
      heli.x = p.x
      heli.y = p.y + Math.sin(t * 1.3) * 0.15 * (1 - sm(t, 23, 24.5))
      heli.z = p.z
      heli.yaw = Math.atan2(hover.x - from.x, hover.z - from.z) * (1 - sm(t, 15, 19)) + sm(t, 15, 19) * 0.6
      if (t > 4) once('heliSnd', () => audio.loop('rotor', 'rotor', { vol: 0.2 }))
      audio.loopVol('rotor', 0.25 + k * 1.1)
      const moving = VEHICLES.some((v) => vehiclePose(v, t).moving)
      if (t > 9) once('sirens', () => audio.loop('sirens', 'siren', { vol: 0.5 }))
      if (t > 9) audio.loopVol('sirens', moving ? 0.5 : 0.12)
      // Subtitles, each with its moment.
      if (t > 0.2) once('s0', () => useGame.setState({ subtitle: fr.cine.flare }))
      if (t > 7) once('s1', () => { useGame.setState({ subtitle: fr.cine.heliRadio }); audio.speak(fr.cine.heliRadio, { radio: true, id: 'radio' }) })
      if (t > 13.5) once('s2', () => useGame.setState({ subtitle: fr.cine.convoy }))
      if (t > 21) once('s3', () => useGame.setState({ subtitle: fr.cine.company }))
      // The shots.
      const me = new THREE.Vector3(live.pos[0], live.pos[1], live.pos[2])
      const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
      let cam: THREE.Vector3, look: THREE.Vector3, fov = 50
      if (t < 7) {
        // The flare, followed up into the sky from just behind the shoulder.
        // Behind the player, opposite the way the flare flies: it climbs, bursts red, and drifts down.
        cam = me.clone().add(v3(Math.sin(FLARE_ORBIT) * 4.2, 0, Math.cos(FLARE_ORBIT) * 4.2))
        cam.y = Math.max(me.y + 0.9 + sm(t, 5, 7) * 0.7, ground(cam.x, cam.z) + 0.8)
        look = me.clone().add(v3(0, 1.3, 0)).lerp(flarePosition(t), sm(t, 0.25, 1.1) * (1 - sm(t, 5.5, 7)))
      } else if (t < 13.5) {
        // From the pad, the sky: the rescue helicopter crossing the valley, the news crews arriving.
        cam = v3(14, padY + 1.7, -50).lerp(v3(12, padY + 2.2, -48), sm(t, 7, 13.5))
        look = v3(heli.x, heli.y, heli.z).lerp(v3(PAD.x, padY + 16, PAD.z), 0.25)
        fov = 46
      } else if (t < 21) {
        // Low by the track: the emergency services coming down from the hills, lights flashing.
        // Off to the side of the track, so that nothing drives through the camera.
        cam = v3(36, ground(36, -49) + 1.6, -49)
        const lead = vehiclePose(VEHICLES[Math.min(VEHICLES.length - 1, Math.floor(sm(t, 13.5, 21) * 4.2))], t)
        look = v3(lead.x, lead.y + 1.2, lead.z).lerp(v3(PAD.x, padY + 1.5, PAD.z), sm(t, 18, 21))
        fov = 44
      } else if (t < 27) {
        // Wide: the rescue helicopter settles on the pad, CosmoTrap arrives, the news crews circle.
        // From above the treetops.
        cam = v3(-14, padY + 13, -38).lerp(v3(-10, padY + 11, -42), sm(t, 21, 27))
        look = v3(PAD.x + 4, padY + 2, PAD.z - 2)
        fov = 52
      } else {
        // Crane shot over the whole scene.
        cam = v3(22, padY + 4, -40).lerp(v3(34, padY + 22, -30), sm(t, 27, 31.5))
        look = v3(PAD.x + 6, padY + 1, PAD.z - 2)
        fov = 54
      }
      live.camOverride = { pos: cam.toArray() as [number, number, number], look: look.toArray() as [number, number, number], fov }
      if (t > 29.5) live.fade = sm(t, 29.5, 31.5)
      if (t > 31.7)
        once('end', () => {
          audio.stopLoop('rotor')
          audio.stopAllLoops()
          audio.oneShotMusic('victory')
          live.camOverride = null
          heli.visible = false
          closeFinishedRun()
          useGame.setState({ cine: null, ended: true, ending: 'rescue', screen: 'end', subtitle: null })
          live.fade = 0
        })
    }
  })
  return null
}

/** Where the collapse started, kept for the whole death scene. */
const death = { start: null as THREE.Vector3 | null, yaw: 0, pitch: 0 }
function resetDeath() {
  death.start = null
  live.faint = 0
  live.hallu = 0
  audio.stopLoop('fail-heart')
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
  live.faint = 0
  live.hallu = 0
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
  if (s.cine === 'lunarLaunch') { finishLunar(); return }
  if (!s.cine || s.cine === 'fail' || s.cine === 'lift') return
  if (s.cine === 'zoneCard' && pendingZone) enterZone(pendingZone)
  if (s.cine === 'launch') enterZone(4)
  if (s.cine === 'heli') {
    audio.stopAllLoops()
    heli.visible = false
    closeFinishedRun()
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
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!g.current) return
    const show = cine === 'heli' && !!live.camOverride
    g.current.visible = show
    if (!show) return
    const t = (performance.now() - t0) / 1000
    g.current.position.set(live.pos[0], live.pos[1], live.pos[2])
    // Dos à la caméra pour le tir, puis tourné vers l'hélicoptère.
    const towardsFlare = FLARE_ORBIT + Math.PI
    const towardsHeli = Math.atan2(heli.x - live.pos[0], heli.z - live.pos[2])
    const turn = Math.atan2(Math.sin(towardsHeli - towardsFlare), Math.cos(towardsHeli - towardsFlare))
    g.current.rotation.y = towardsFlare + turn * sm(t, 6, 8)
  })
  // The crew wear the station's own EVA suits (NASA Z-2), the ones on the airlock racks.
  return (
    <group ref={g} visible={false}>
      <RealModel id="z2_spacesuit" height={1.85} />
    </group>
  )
}

/** Soft round glow for the flare and its muzzle flash. */
function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

const TRAIL = 48
const SPARKS = 90

/** fusée de détresse tirée à l'hélisurface : départ, traînée, explosion rouge, puis lente retombée */
export function Flare() {
  const cine = useGame((s) => s.cine)
  const t0 = useGame((s) => s.cineT0)
  const g = useRef<THREE.Group>(null)
  const light = useRef<THREE.PointLight>(null)
  const star = useRef<THREE.Sprite>(null)
  const core = useRef<THREE.Sprite>(null)
  const muzzle = useRef<THREE.Sprite>(null)
  const parts = useMemo(() => {
    const tex = glowTexture()
    // Plain blending: added to a bright daytime sky, red would wash out to white.
    const glow = { map: tex, transparent: true, depthWrite: false, toneMapped: false }
    const trail = new THREE.BufferGeometry()
    trail.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(TRAIL * 3), 3))
    trail.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(TRAIL * 3), 3))
    const sparks = new THREE.BufferGeometry()
    sparks.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(SPARKS * 3), 3))
    return {
      trail,
      sparks,
      trailMat: new THREE.PointsMaterial({ ...glow, size: 1.6, vertexColors: true }),
      sparkMat: new THREE.PointsMaterial({ ...glow, size: 1.8, color: '#ff3a14' }),
      starMat: new THREE.SpriteMaterial({ ...glow, color: '#ff2410' }),
      coreMat: new THREE.SpriteMaterial({ ...glow, color: '#fff0c8' }),
      muzzleMat: new THREE.SpriteMaterial({ ...glow, color: '#ffd080' }),
      dirs: Array.from({ length: SPARKS }, (_, i) => {
        // Evenly spread over a sphere; each spark has its own speed.
        const y = 1 - (2 * (i + 0.5)) / SPARKS, r = Math.sqrt(1 - y * y), a = i * 2.399963
        return [Math.cos(a) * r, y, Math.sin(a) * r, 6 + (i * 37 % 11) * 0.8]
      }),
    }
  }, [])
  useEffect(() => () => {
    parts.trail.dispose(); parts.sparks.dispose(); parts.trailMat.map?.dispose()
    parts.trailMat.dispose(); parts.sparkMat.dispose(); parts.starMat.dispose(); parts.coreMat.dispose(); parts.muzzleMat.dispose()
  }, [parts])
  useFrame(() => {
    if (!g.current) return
    const t = (performance.now() - t0) / 1000
    const on = cine === 'heli' && t < 10
    g.current.visible = on
    if (!on) return
    const pos = flarePosition(t)
    const burst = Math.max(0, t - FLARE_APEX)
    const fading = 1 - sm(t, 7.5, 10)
    if (star.current) {
      star.current.position.copy(pos)
      const size = burst > 0 ? 9 + 7 * Math.exp(-burst * 2.5) : 3
      star.current.scale.set(size, size, 1)
      parts.starMat.opacity = fading
    }
    if (core.current) {
      core.current.position.copy(pos)
      const size = burst > 0 ? 3 + 3 * Math.exp(-burst * 2.5) : 1.2
      core.current.scale.set(size, size, 1)
      parts.coreMat.opacity = fading
    }
    if (muzzle.current) {
      const flash = Math.max(0, 1 - t / 0.3)
      muzzle.current.position.copy(flarePosition(0))
      muzzle.current.scale.setScalar(0.1 + flash * 2.4)
      parts.muzzleMat.opacity = flash
    }
    if (light.current) {
      light.current.position.copy(pos)
      light.current.intensity = 400 * fading * (burst > 0 ? 1 : 0.4)
    }
    // The trail: pale smoke along the flare's path, orange at its head, thinning out after the burst.
    const tp = parts.trail.attributes.position as THREE.BufferAttribute
    const tc = parts.trail.attributes.color as THREE.BufferAttribute
    const end = Math.min(t, FLARE_APEX)
    parts.trailMat.opacity = Math.max(0, 1 - burst / 2.5)
    for (let i = 0; i < TRAIL; i++) {
      const k = i / (TRAIL - 1)
      const p = flarePosition(end * k)
      tp.setXYZ(i, p.x, p.y, p.z)
      const hot = k * k
      tc.setXYZ(i, 0.92 + 0.08 * hot, 0.88 - 0.5 * hot, 0.84 - 0.68 * hot)
    }
    tp.needsUpdate = true
    tc.needsUpdate = true
    // Stars thrown out by the burst, slowed by the air and falling.
    const sp = parts.sparks.attributes.position as THREE.BufferAttribute
    const apex = flarePosition(FLARE_APEX)
    const reach = 1 - Math.exp(-burst * 1.4)
    parts.dirs.forEach(([x, y, z, v], i) => sp.setXYZ(i, apex.x + x * v * reach, apex.y + y * v * reach - burst * burst * 0.45, apex.z + z * v * reach))
    sp.needsUpdate = true
    parts.sparkMat.opacity = burst > 0 ? Math.max(0, 1 - burst / 4) : 0
  })
  return (
    <group ref={g} visible={false}>
      <points geometry={parts.trail} material={parts.trailMat} frustumCulled={false} />
      <points geometry={parts.sparks} material={parts.sparkMat} frustumCulled={false} />
      <sprite ref={star} material={parts.starMat} renderOrder={1} />
      <sprite ref={core} material={parts.coreMat} renderOrder={2} />
      <sprite ref={muzzle} material={parts.muzzleMat} />
      <pointLight ref={light} color="#ff3a20" distance={120} decay={1.4} />
    </group>
  )
}
