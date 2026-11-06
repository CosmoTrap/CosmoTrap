import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { audio, speechSeconds } from '../game/audio/audio'
import { GRID_MAPS, TILE, entWorld, roomAt, spawnOf } from '../game/maps'
import { terrainHeight } from '../game/maps/zone4'
import { entById } from '../game/logic'
import { G, live, useGame } from '../game/state'
import { fr } from '../i18n/fr'
import { Astronaut, type AstronautHandle } from './Astronaut'

// Cinématiques « film » à l'entrée de chaque zone : plans découpés (travellings, plans serrés,
// contre-plongées), acteur à la 3e personne, et le crash de la capsule Hermès sur Terre.

type V3 = [number, number, number]
interface Shot {
  d: number
  /** caméra (position, cible) au début et à la fin du plan */
  from: [V3, V3]
  to: [V3, V3]
  fov?: number
  /** réplique (index dans fr.story.tours[zone]) dite au début du plan */
  line?: number
  /** animation propre au plan (k : avancée 0..1, t : secondes depuis le début du plan) */
  run?: (k: number, t: number) => void
}

/** acteur (le personnage) vu à la 3e personne pendant les plans */
export const actor = { visible: false, pos: [0, 0, 0] as V3, yaw: 0, lie: 0, walk: 0 }
/** capsule Hermès : avancée de la chute (0 = haut du ciel, 1 = au sol) */
export const crash = { active: false, k: 1, t: 0, impact: -1, fire: 0 }
/** flou plein écran piloté par les plans (réveil) */
export const film = { blur: 0, focus: new THREE.Vector3() }

const ease = (k: number) => k * k * (3 - 2 * k)
const lerp3 = (a: V3, b: V3, k: number): V3 => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]
const add = (a: V3, x: number, y: number, z: number): V3 => [a[0] + x, a[1] + y, a[2] + z]

/** point d'approche d'un objet : vers le centre de sa salle, sans sortir de la salle */
function closeUp(zone: 1 | 2 | 3, id: string, far: number, near: number, h = 1.25): [[V3, V3], [V3, V3]] {
  const e = entById(id, zone)
  const p = e ? entWorld(e).p : spawnOf(zone).pos
  const map = GRID_MAPS[zone]
  const room = roomAt(map, p[0], p[2])
  let cx = p[0] + 1
  let cz = p[2] + 1
  if (room) {
    cx = ((room.rect[0] + room.rect[2] + 1) / 2) * TILE
    cz = ((room.rect[1] + room.rect[3] + 1) / 2) * TILE
  }
  let dx = cx - p[0]
  let dz = cz - p[2]
  const len = Math.hypot(dx, dz) || 1
  dx /= len
  dz /= len
  const f = Math.min(far, len + 0.6)
  const n = Math.min(near, f * 0.7)
  const look: V3 = [p[0], Math.max(0.6, p[1] + 0.3), p[2]]
  return [
    [[p[0] + dx * f + dz * 0.7, h, p[2] + dz * f - dx * 0.7], look],
    [[p[0] + dx * n + dz * 0.25, h - 0.15, p[2] + dz * n - dx * 0.25], look],
  ]
}

function shotsFor(zone: number): Shot[] {
  if (zone === 4) return crashShots()
  const z = zone as 1 | 2 | 3
  const sp = spawnOf(z)
  const fwd: V3 = [-Math.sin(sp.yaw), 0, -Math.cos(sp.yaw)]
  const right: V3 = [Math.cos(sp.yaw), 0, -Math.sin(sp.yaw)]
  // Floor 2 opens in the lift: the over-the-shoulder shot starts inside the cab, not behind its wall.
  const start = z === 2 ? 2.2 : 0
  const at = (f: number, r: number, y: number): V3 => [sp.pos[0] + fwd[0] * (f + start) + right[0] * r, y, sp.pos[2] + fwd[2] * (f + start) + right[2] * r]
  if (z === 1) {
    // A quick presentation of the station, without the character: outside, its two levels joined by the
    // lift; then inside, a corridor, the mess, the infirmary, the hub and its lift, and the dormitory.
    // The real station, filmed from outside: floor 1 around the hub at (41, 41), floor 2 under it.
    const outside = (on: boolean) => {
      actor.visible = false
      void on
    }
    return [
      { d: 6.5, from: [[118, 26, 104], [41, -3, 41]], to: [[96, 16, 96], [41, -2.5, 41]], fov: 40, line: 0, run: () => outside(true) },
      { d: 5, from: [[78, -9, 78], [41, -6, 41]], to: [[52, -8, 92], [38, -5, 44]], fov: 46, run: () => outside(true) },
      { d: 4.6, from: [[41, 1.65, 36.5], [41, 1.5, 16]], to: [[41, 1.65, 27.5], [41, 1.45, 16]], fov: 58, line: 1, run: () => outside(false) },
      { d: 4.6, from: [[53, 1.8, 21], [30, 1.1, 17.5]], to: [[47, 1.7, 20.5], [28, 1.1, 17]], fov: 56, run: () => outside(false) },
      // The infirmary: a wide shot down its whole length, at eye level, rather than a close-up on one corner.
      { d: 4.2, from: [[39.2, 1.9, 65.2], [56, 1.15, 62.6]], to: [[41.6, 1.85, 65.1], [56, 1.1, 62.2]], fov: 62, run: () => outside(false) },
      { d: 4.8, from: [[47.5, 2.2, 45], [41, 1.4, 41]], to: [[45, 1.9, 47.5], [41, 1.3, 41]], fov: 52, line: 2, run: () => outside(false) },
      { d: 5.2, from: [[21, 1.75, 41], [11, 1.0, 41]], to: [[15.5, 1.62, 41], [10.5, 1.1, 41]], fov: 58, line: 3, run: () => outside(false) },
    ]
  }
  const key = z === 2 ? 'steam' : 'engine'
  const [cuA, cuB] = closeUp(z, key, 3.4, 2.2)
  return [
    // travelling derrière l'épaule : il avance dans le module
    {
      d: 6,
      from: [at(-2.2, 0.55, 1.55), at(4, 0, 1.3)],
      to: [at(0.2, 0.55, 1.6), at(5.5, 0, 1.3)],
      fov: 46,
      line: 0,
      // The places, never the character.
      run: () => (actor.visible = false),
    },
    // plan serré sur l'objectif
    {
      d: 6.5,
      from: cuA,
      to: cuB,
      fov: 38,
      line: 1,
      run: () => (actor.visible = false),
    },
  ]
}

/** zone 4 : la capsule traverse le ciel en feu, s'écrase, puis l'astronaute se relève */
function crashShots(): Shot[] {
  const L: V3 = [0, terrainHeight(0, 2.2), 2.2]
  const sp = spawnOf(4).pos
  const me: V3 = [sp[0], terrainHeight(sp[0], sp[2]), sp[2]]
  const cam: V3 = [-7, terrainHeight(-7, -15) + 1.35, -15]
  const IMPACT = 6.6
  return [
    {
      d: 7.4,
      from: [cam, add(L, 60, 80, 90)],
      to: [add(cam, 0.6, -0.1, 0.4), add(L, 0, 2, 0)],
      fov: 44,
      run: (_, t) => {
        actor.visible = false
        crash.active = true
        crash.t = t
        crash.k = Math.min(1, Math.pow(Math.max(0, t - 0.3) / (IMPACT - 0.3), 1.7))
        crash.fire = crash.k < 1 ? 1 : Math.max(0, 1 - (t - IMPACT) * 0.5)
        if (t > 0.2) once('whoosh', () => audio.loop('reentry', 'reentry', { vol: 0.6 }))
        audio.loopVol('reentry', 0.4 + crash.k * 1.2)
        // la caméra suit la capsule
        const c = capsulePos(crash.k)
        film.focus.set(c[0], c[1], c[2])
        if (live.camOverride) live.camOverride.look = crash.k < 1 ? [c[0], c[1], c[2]] : [L[0], L[1] + 1.5, L[2]]
        if (t >= IMPACT)
          once('impact', () => {
            crash.impact = performance.now()
            audio.stopLoop('reentry')
            audio.sfx('impact')
            live.flash = 0.85
            useGame.setState({ shake: 2.4 })
          })
        if (t > IMPACT) useGame.setState({ shake: Math.max(0, 2.4 - (t - IMPACT) * 2.4) })
      },
    },
    {
      d: 5,
      from: [add(L, 4.8, 0.45, 5.2), add(L, 0, 1.3, 0)],
      to: [add(L, 3.9, 0.6, 4.3), add(L, 0, 1.6, 0)],
      fov: 36,
      line: 0,
      run: () => {
        crash.k = 1
        crash.fire = 0
        actor.visible = false
        useGame.setState({ shake: 0 })
      },
    },
    // Through the crew member's eyes: lying in the grass, blurred, then sitting up and looking at the capsule.
    {
      d: 6.5,
      from: [add(me, 0, 0.28, 0), add(me, 0.4, 6, -1.2)],
      to: [add(me, 0, 1.55, 0), add(L, 0, 1.4, 0)],
      fov: 62,
      line: 1,
      run: (k, t) => {
        actor.visible = false
        film.blur = Math.max(0, 0.85 - t * 0.2)
        live.fade = t < 0.6 ? 1 - t / 0.6 : t > 1.4 && t < 1.8 ? (t - 1.4) / 0.4 : t >= 1.8 && t < 2.2 ? 1 - (t - 1.8) / 0.4 : 0
        void k
      },
    },
  ]
}

/** position de la capsule pendant la chute (trajectoire courbe venant du nord-est) */
export function capsulePos(k: number): V3 {
  const L: V3 = [0, terrainHeight(0, 2.2) + 2.2, 2.2]
  const a = 1 - k
  return [L[0] + 150 * a + Math.sin(a * 2) * 10, L[1] + 190 * a * a + 30 * a, L[2] + 210 * a]
}

let onceFlags: Record<string, boolean> = {}
function once(k: string, fn: () => void) {
  if (!onceFlags[k]) {
    onceFlags[k] = true
    fn()
  }
}

/**
 * Lengthen shots where needed so that each line is said in full before the next one starts (or the
 * scene ends): a new line would otherwise cut the voice off mid-sentence.
 */
function fitLines(zone: number, shots: Shot[]) {
  const lines = fr.story.tours[zone] ?? []
  const starts = (i: number) => shots.slice(0, i).reduce((a, s) => a + s.d, 0)
  shots.forEach((sh, i) => {
    if (sh.line == null || !lines[sh.line]) return
    let next = shots.findIndex((s, j) => j > i && s.line != null)
    if (next < 0) next = shots.length
    const room = starts(next) - starts(i)
    const need = speechSeconds(lines[sh.line]) + 0.3 + (next === shots.length ? 0.7 : 0)
    if (room < need) shots[next - 1].d += need - room
  })
  return shots
}

const cache = new Map<number, Shot[]>()
export function sceneDuration(zone: number) {
  const s = cache.get(zone) ?? fitLines(zone, shotsFor(zone))
  cache.set(zone, s)
  return s.reduce((a, x) => a + x.d, 0)
}

/** joue le plan courant ; renvoie false quand la scène est finie */
export function runScene(zone: number, t: number, first: boolean) {
  if (first) onceFlags = {}
  let shots = cache.get(zone)
  if (!shots) {
    shots = fitLines(zone, shotsFor(zone))
    cache.set(zone, shots)
  }
  const total = shots.reduce((a, x) => a + x.d, 0)
  if (t >= total) return false
  let acc = 0
  let i = 0
  while (i < shots.length - 1 && t >= acc + shots[i].d) acc += shots[i++].d
  const sh = shots[i]
  const lt = t - acc
  const k = ease(Math.min(1, lt / sh.d))
  const pos = lerp3(sh.from[0], sh.to[0], k)
  const look = lerp3(sh.from[1], sh.to[1], k)
  live.camOverride = { pos, look, fov: sh.fov }
  film.focus.set(look[0], look[1], look[2])
  // ouverture et fermeture au noir de la scène, coupes franches entre les plans
  live.fade = t < 0.5 ? 1 - t / 0.5 : t > total - 0.7 ? Math.min(1, (t - (total - 0.7)) / 0.7) : 0
  live.flash = Math.max(0, live.flash - 0.035)
  sh.run?.(k, lt)
  if (sh.line != null) {
    const lines = fr.story.tours[zone] ?? []
    const line = lines[sh.line]
    if (line)
      once(`line${i}`, () => {
        useGame.setState({ subtitle: line })
        // Floor 1's lines are new: their old recordings would no longer match the subtitles.
        // Floor 1's recordings say an older text: the browser's voice reads the current one meanwhile.
        audio.speak(line, { rate: 1.0, id: zone === 1 ? undefined : `tour_${zone}_${sh.line}`, narration: true })
      })
  }
  return true
}

/** remet tout en place à la fin (ou quand on passe la scène) */
export function endScene() {
  actor.visible = false
  film.blur = 0
  crash.active = false
  crash.k = 1
  crash.fire = 0
  crash.t = 0
  crash.impact = -1
  audio.stopLoop('reentry')
  useGame.setState({ shake: 0 })
}

export function CineActor() {
  const character = useGame((s) => s.character)
  const g = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const ref = useRef<AstronautHandle>(null)
  useFrame(({ clock }) => {
    if (!g.current || !body.current) return
    g.current.visible = actor.visible && G().cine === 'tour'
    if (!g.current.visible) return
    const t = clock.elapsedTime
    g.current.position.set(actor.pos[0], actor.pos[1] + Math.abs(Math.sin(t * 4.2)) * 0.04 * actor.walk, actor.pos[2])
    g.current.rotation.y = actor.yaw
    // allongé sur le dos → assis → debout
    body.current.rotation.x = -actor.lie * 1.45
    body.current.position.y = actor.lie * 0.25
    const a = ref.current
    if (a?.armR && a.armL) {
      a.armR.rotation.x = Math.sin(t * 4.2) * 0.45 * actor.walk - actor.lie * 0.6
      a.armL.rotation.x = -Math.sin(t * 4.2) * 0.45 * actor.walk - actor.lie * 0.3
    }
    if (a?.head) a.head.rotation.x = actor.lie * 0.5 - 0.05
  })
  return (
    <group ref={g} visible={false}>
      <group ref={body}>
        <Astronaut ref={ref} skin={character} accent={fr.characters[character]?.color ?? '#d9673a'} />
      </group>
    </group>
  )
}

/** traînée de feu pendant la chute, poussière à l'impact, colonne de fumée ensuite */
export function CrashFx() {
  const N = 220
  const { sprites, fireMat, smokeMat, light } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const x = c.getContext('2d')!
    const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32)
    gr.addColorStop(0, 'rgba(255,255,255,1)')
    gr.addColorStop(0.4, 'rgba(255,255,255,0.45)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = gr
    x.fillRect(0, 0, 64, 64)
    const tex = new THREE.CanvasTexture(c)
    const fireMat = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(9, 3.2, 0.9), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false })
    const smokeMat = new THREE.SpriteMaterial({ map: tex, color: '#3a3835', depthWrite: false, transparent: true, opacity: 0.5 })
    const sprites = Array.from({ length: N }, (_, i) => {
      const s = new THREE.Sprite(i % 3 === 0 ? fireMat.clone() : smokeMat.clone())
      s.visible = false
      s.userData = { life: 0, max: 1, v: new THREE.Vector3(), size: 1, fire: i % 3 === 0 }
      return s
    })
    const light = new THREE.PointLight('#ff7a2a', 0, 80, 1.6)
    return { sprites, fireMat, smokeMat, light }
  }, [])
  const idx = useRef(0)
  void fireMat
  void smokeMat
  const spawn = (fire: boolean, p: V3, v: THREE.Vector3, size: number, life: number) => {
    for (let n = 0; n < N; n++) {
      const s = sprites[(idx.current + n) % N]
      if (s.userData.fire !== fire) continue
      idx.current = (idx.current + n + 1) % N
      s.visible = true
      s.position.set(p[0], p[1], p[2])
      s.userData.v.copy(v)
      s.userData.life = 0
      s.userData.max = life
      s.userData.size = size
      return
    }
  }
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const inZone = G().zone === 4
    if (!inZone || (!crash.active && crash.impact < 0)) {
      // Also discard particles already emitted before skipping the impact.
      for (const s of sprites) s.visible = false
      light.intensity = 0
      return
    }
    const sinceImpact = crash.impact > 0 ? (performance.now() - crash.impact) / 1000 : -1
    if (inZone && crash.active && crash.k < 1) {
      const p = capsulePos(crash.k)
      for (let n = 0; n < 3; n++) spawn(true, [p[0] + (Math.random() - 0.5), p[1] + (Math.random() - 0.5), p[2] + (Math.random() - 0.5)], new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(2), (3 + Math.random() * 3) * (1 + (1 - crash.k) * 5), 0.6 + Math.random() * 0.4)
      spawn(false, p, new THREE.Vector3(0, 0.5, 0), 4 * (1 + (1 - crash.k) * 3), 6)
      light.position.set(p[0], p[1], p[2])
      light.intensity = 900
    } else light.intensity = Math.max(0, light.intensity - dt * 900)
    // impact : souffle de poussière + flammes au sol, puis fumée qui monte longtemps
    if (inZone && sinceImpact >= 0 && sinceImpact < 0.25) {
      const L: V3 = [0, terrainHeight(0, 2.2) + 0.6, 2.2]
      for (let n = 0; n < 12; n++) {
        const a = Math.random() * Math.PI * 2
        spawn(false, L, new THREE.Vector3(Math.cos(a) * 9, 1 + Math.random() * 3, Math.sin(a) * 9), 3 + Math.random() * 2, 3 + Math.random() * 2)
      }
      for (let n = 0; n < 5; n++) spawn(true, add(L, (Math.random() - 0.5) * 2, 0.5, (Math.random() - 0.5) * 2), new THREE.Vector3(0, 3 + Math.random() * 3, 0), 3, 0.7)
      light.position.set(L[0], L[1] + 2, L[2])
      light.intensity = 1400
    }
    if (inZone && sinceImpact > 0 && sinceImpact < 90 && Math.random() < dt * 14) {
      const L: V3 = [0.3, terrainHeight(0, 2.2) + 2.6, 2.0]
      spawn(false, L, new THREE.Vector3((Math.random() - 0.5) * 0.4 + 0.5, 1.4 + Math.random() * 0.8, (Math.random() - 0.5) * 0.4), 1.2, 7)
      if (sinceImpact < 25 && Math.random() < 0.5) spawn(true, add(L, (Math.random() - 0.5) * 0.8, -1.4, (Math.random() - 0.5) * 0.8), new THREE.Vector3(0, 1.2, 0), 0.9, 0.5)
    }
    for (const s of sprites) {
      if (!s.visible) continue
      const u = s.userData
      u.life += dt
      if (u.life > u.max || !inZone) {
        s.visible = false
        continue
      }
      const k = u.life / u.max
      u.v.multiplyScalar(u.fire ? 0.96 : 0.985)
      if (!u.fire) u.v.y += dt * 0.25
      s.position.addScaledVector(u.v, dt)
      const sc = u.size * (u.fire ? 1 - k * 0.6 : 1 + k * 2.5)
      s.scale.set(sc, sc, sc)
      const m = s.material as THREE.SpriteMaterial
      m.opacity = u.fire ? (1 - k) * 0.9 : Math.sin(k * Math.PI) * 0.45
    }
  })
  return (
    <group>
      <group name="crash-particles">{sprites.map((s, i) => (
        <primitive key={i} object={s} />
      ))}</group>
      <primitive object={light} />
    </group>
  )
}
