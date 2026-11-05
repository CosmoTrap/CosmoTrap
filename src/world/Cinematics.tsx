import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { audio } from '../game/audio/audio'
import { enterZone, pendingZone, tick } from '../game/logic'
import { GRID_MAPS, spawnOf } from '../game/maps'
import { riverCenter, terrainHeight } from '../game/maps/zone4'
import { AUTOSAVE_EVERY, G, closeFinishedRun, live, saveGame, useGame } from '../game/state'
import { fr } from '../i18n/fr'
import { Astronaut, type AstronautHandle } from './Astronaut'
import { endScene, runScene } from './FilmScenes'
import { heli } from './zone4/Zone4'
import { input } from '../player/input'

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
      const lines = fr.story.fail[s.failCause ?? 'time']
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
          closeFinishedRun()
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
      // caméra 3e personne : d'abord le tir, qu'elle suit dans le ciel, puis l'arrivée de l'hélicoptère
      const a = t > 8 ? FLARE_ORBIT + (t - 8) * 0.05 : FLARE_ORBIT
      const c = new THREE.Vector3(live.pos[0], live.pos[1], live.pos[2])
      const follow = sm(t, 0.25, 1.1) * (1 - sm(t, 5.5, 7.5))
      const rest = new THREE.Vector3(c.x, c.y + 1.3 + sm(t, 8, 12) * 0.6, c.z)
      const look = rest.lerp(flarePosition(t), follow)
      const camX = c.x + Math.sin(a) * 4.2, camZ = c.z + Math.cos(a) * 4.2
      live.camOverride = {
        // The ground can rise behind the player: the camera must never end up under the hill.
        pos: [camX, Math.max(c.y + 0.9 + sm(t, 6, 8) * 0.7, terrainHeight(camX, camZ) + 0.8), camZ],
        look: [look.x, look.y, look.z],
      }
      if (t > 19) live.fade = sm(t, 19, 21)
      if (t > 21.2)
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
    // Dos à la caméra pour le tir, puis tourné vers l'hélicoptère.
    const towardsFlare = FLARE_ORBIT + Math.PI
    const towardsHeli = Math.atan2(heli.x - live.pos[0], heli.z - live.pos[2])
    const turn = Math.atan2(Math.sin(towardsHeli - towardsFlare), Math.cos(towardsHeli - towardsFlare))
    g.current.rotation.y = towardsFlare + turn * sm(t, 6, 8)
    const a = ref.current
    if (a?.armR) {
      const k = Math.max(sm(t, 9, 10.5), sm(t, 0, 0.35) * (1 - sm(t, 1.6, 2.4)))
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
