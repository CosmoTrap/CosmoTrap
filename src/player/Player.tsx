import { useFrame, useThree } from '@react-three/fiber'
import { CapsuleCollider, RigidBody, useRapier, type RapierRigidBody } from '@react-three/rapier'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { audio } from '../game/audio/audio'
import { act, cycleItem, drinkPouch, entById, labelOf, toggleLamp, useBattery, useO2, useSelectedItem, useSlot } from '../game/logic'
import { GRID_MAPS, roomAt, spawnOf } from '../game/maps'
import { G, ability, live, toggleFullscreen, useGame } from '../game/state'
import { QUALITY } from '../world/quality'
import { hitboxes } from '../world/props/EntModels'
import { lampCookie } from '../world/textures'
import { input, isDown, matches } from './input'
import { reveal } from '../game/explore'
import { markKeyboard, pad } from './gamepad'

const EYE = 0.77 // au-dessus du centre de la capsule → yeux à 1,62 m
const REACH = 2.7
const JUMP_SPEED = 4.5 // ~1 m de hauteur, avec la gravité du contrôleur

export const aim = { id: null as string | null, label: null as string | null }

function overlayOpen() {
  const s = G()
  return s.loading < 1 || s.tabletOpen || s.inventoryOpen || !!s.puzzle || !!s.readNote || s.paused || s.settingsOpen
}

/** écoute clavier / souris (une seule fois) */
export function useInputListeners() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const s = G()
      if (matches(s.settings.keys, 'fullscreen', e.code) && !(window as any).__rebinding && (e.target as HTMLElement)?.tagName !== 'INPUT') {
        e.preventDefault()
        toggleFullscreen()
        return
      }
      if (s.screen !== 'playing') return
      if (s.loading < 1) return
      if ((window as any).__rebinding) return
      const target = e.target as HTMLElement
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
      markKeyboard()
      const k = s.settings.keys
      if ((e.code === 'Tab' && !s.inventoryOpen) || e.code === 'Space') e.preventDefault()
      input.down.add(e.code)
      if (e.repeat) return
      if (s.cine && s.cine !== 'briefing') return
      if (matches(k, 'pause', e.code)) {
        if (s.puzzle || s.readNote) useGame.setState({ puzzle: null, readNote: null })
        else if (s.inventoryOpen) closeInventory()
        else if (s.tabletOpen) closeTablet()
        else if (s.settingsOpen) useGame.setState({ settingsOpen: false })
        else useGame.setState({ paused: !s.paused })
        return
      }
      if (matches(k, 'inventory', e.code)) {
        e.preventDefault()
        if (s.inventoryOpen) closeInventory()
        else openInventory()
        return
      }
      if (s.inventoryOpen) {
        if (matches(k, 'useSelected', e.code)) useSelectedItem()
        return
      }
      if (matches(k, 'hint', e.code)) {
        e.preventDefault()
        if (!overlayOpen()) { useGame.setState({ tab: 0 }); openTablet() }
        return
      }
      if (matches(k, 'tablet', e.code)) {
        if (s.tabletOpen) closeTablet()
        else if (!overlayOpen()) openTablet()
        return
      }
      if (matches(k, 'jump', e.code)) {
        e.preventDefault()
        if (!s.cine && !overlayOpen()) input.jumpRequested = true
        return
      }
      if (s.paused || s.puzzle || s.settingsOpen) return
      if (s.readNote && matches(k, 'act', e.code)) {
        useGame.setState({ readNote: null })
        return
      }
      if (matches(k, 'useSelected', e.code)) useSelectedItem()
      else if (matches(k, 'lamp', e.code)) toggleLamp()
      else if (matches(k, 'o2', e.code)) useO2()
      else if (matches(k, 'battery', e.code)) useBattery()
      else if (matches(k, 'drink', e.code)) drinkPouch()
      else if (matches(k, 'act', e.code) && !s.tabletOpen) {
        if (s.cine === 'briefing') return
        if (aim.id) act(aim.id)
      } else if (/^(Digit|Numpad)[1-9]$/.test(e.code)) useSlot(Number(e.code.slice(-1)) - 1)
    }
    const up = (e: KeyboardEvent) => input.down.delete(e.code)
    // Ctrl (s'accroupir) + W (avancer en QWERTY) ferme l'onglet : le navigateur demande confirmation en partie
    const guardLeave = (e: BeforeUnloadEvent) => {
      if (G().screen === 'playing' && input.down.has('ControlLeft')) e.preventDefault()
    }
    window.addEventListener('beforeunload', guardLeave)
    // souris verrouillée (souris ou pavé tactile) ; sinon glisser-cliquer sur la vue
    let dragging = false
    const move = (e: MouseEvent) => {
      if (document.pointerLockElement || dragging) {
        input.look.dx += e.movementX
        input.look.dy += e.movementY
      }
    }
    const pdown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') markKeyboard()
      if (e.pointerType === 'mouse' && (e.target as HTMLElement)?.tagName === 'CANVAS' && !document.pointerLockElement) dragging = true
    }
    const pup = () => (dragging = false)
    // Wheel selects inventory; Alt + wheel preserves the trackpad camera gesture.
    let wheelAmount = 0
    let lastWheel = 0
    const wheel = (e: WheelEvent) => {
      const s = G()
      if (s.screen !== 'playing' || overlayOpen() || s.cine || e.ctrlKey || (window as any).__rebinding) return
      const target = e.target as HTMLElement
      if (target?.tagName !== 'CANVAS' && !target?.closest('[data-hotbar]') && !document.pointerLockElement) return
      e.preventDefault()
      markKeyboard()
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? window.innerHeight : 1
      if (e.altKey && s.settings.trackpadLook) {
        input.look.dx += e.deltaX * unit * 0.9
        input.look.dy += e.deltaY * unit * 0.9
        wheelAmount = 0
        return
      }
      const delta = e.deltaY * unit
      const now = performance.now()
      if (now - lastWheel > 180 || Math.sign(delta) !== Math.sign(wheelAmount)) wheelAmount = 0
      lastWheel = now
      wheelAmount += delta
      if (Math.abs(wheelAmount) >= 30) {
        cycleItem(Math.sign(wheelAmount))
        wheelAmount = 0
      }
    }
    const blur = () => { input.down.clear(); input.jumpRequested = false }
    let lockedAt = 0
    const plc = () => {
      const locked = !!document.pointerLockElement
      useGame.setState({ locked })
      if (locked) lockedAt = performance.now()
      const s = G()
      // pause sur Échap ; on ignore un verrouillage refusé ou relâché aussitôt par le navigateur
      if (!locked && performance.now() - lockedAt > 600 && s.screen === 'playing' && !overlayOpen() && !s.cine && !isTouch()) useGame.setState({ paused: true })
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('mousemove', move)
    window.addEventListener('pointerdown', pdown)
    window.addEventListener('pointerup', pup)
    window.addEventListener('wheel', wheel, { passive: false })
    window.addEventListener('blur', blur)
    document.addEventListener('pointerlockchange', plc)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('mousemove', move)
      window.removeEventListener('pointerdown', pdown)
      window.removeEventListener('pointerup', pup)
      window.removeEventListener('wheel', wheel)
      window.removeEventListener('blur', blur)
      window.removeEventListener('beforeunload', guardLeave)
      document.removeEventListener('pointerlockchange', plc)
    }
  }, [])
}

export const isTouch = () => window.matchMedia?.('(pointer: coarse)').matches

export function openTablet() {
  useGame.setState({ tabletOpen: true, inventoryOpen: false })
  audio.sfx('tablet_open')
  document.exitPointerLock?.()
}
export function closeTablet() {
  useGame.setState({ tabletOpen: false })
  audio.sfx('tablet_close')
  requestLock()
}
export function openInventory() {
  const s = G()
  if (s.screen !== 'playing' || s.loading < 1 || s.cine || s.paused || s.puzzle || s.readNote || s.settingsOpen) return
  useGame.setState({ inventoryOpen: true, tabletOpen: false })
  input.down.clear()
  input.jumpRequested = false
  input.joy.x = input.joy.y = 0
  input.touchRun = false
  audio.sfx('tablet_open')
  document.exitPointerLock?.()
}
export function closeInventory() {
  useGame.setState({ inventoryOpen: false })
  input.down.clear()
  input.jumpRequested = false
  audio.sfx('tablet_close')
  requestLock()
}
export function requestLock() {
  if (isTouch() || G().screen !== 'playing' || G().cine || overlayOpen()) return
  const c = document.querySelector('canvas')
  try {
    ;(c as any)?.requestPointerLock?.()?.catch?.(() => {})
  } catch {
    /* refusé */
  }
}

export function Player() {
  const body = useRef<RapierRigidBody>(null)
  const { world, rapier } = useRapier()
  const { camera, raycaster } = useThree()
  const zone = useGame((s) => s.zone)
  const tp = useGame((s) => s.tp)
  const quality = useGame((s) => s.settings.quality)
  const q = QUALITY[quality]
  const st = useRef({ vy: 0, grounded: false, phase: 0, lastStep: 0, roll: 0, lampYaw: 0, lampPitch: 0, flick: 1, breath: 0, prevAim: '', cinematic: false, crouch: 0 })
  const controller = useMemo(() => {
    const c = world.createCharacterController(0.02)
    c.enableAutostep(0.35, 0.25, false)
    c.setApplyImpulsesToDynamicBodies(true)
    c.setCharacterMass(80)
    c.enableSnapToGround(0.45)
    c.setMaxSlopeClimbAngle((52 * Math.PI) / 180)
    c.setMinSlopeSlideAngle((60 * Math.PI) / 180)
    c.setSlideEnabled(true)
    return c
  }, [world])
  useEffect(() => () => world.removeCharacterController(controller), [world, controller])
  useEffect(() => () => { live.playerZone = null; input.jumpRequested = false }, [])

  // lampe frontale
  const lamp = useMemo(() => {
    const l = new THREE.SpotLight('#fff1dc', 0, 24, 0.44, 0.55, 1.5)
    l.map = lampCookie()
    l.castShadow = q.lampShadow
    l.shadow.mapSize.set(1024, 1024)
    l.shadow.bias = -0.0005
    l.shadow.normalBias = 0.03
    l.shadow.camera.near = 0.1
    l.shadow.camera.far = 24
    return l
  }, [q.lampShadow])
  const lampTarget = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => {
    lamp.target = lampTarget
  }, [lamp, lampTarget])

  const spawn = spawnOf(zone)
  const startPos = useMemo(() => G().resume?.pos ?? spawn.pos, [zone])

  useEffect(() => {
    live.yaw = G().resume?.yaw ?? spawn.yaw
    live.pitch = 0
    live.pos = [...startPos]
    useGame.setState({ resume: null })
  }, [zone])

  // téléportation
  useEffect(() => {
    if (!tp || !body.current) return
    body.current.setTranslation({ x: tp.pos[0], y: tp.pos[1] + 0.95, z: tp.pos[2] }, true)
    body.current.setNextKinematicTranslation({ x: tp.pos[0], y: tp.pos[1] + 0.95, z: tp.pos[2] })
    live.yaw = tp.yaw
    live.pitch = 0
    st.current.vy = 0
    st.current.grounded = false
    input.jumpRequested = false
  }, [tp])

  const fwd = useMemo(() => new THREE.Vector3(), [])
  const right = useMemo(() => new THREE.Vector3(), [])
  const mv = useMemo(() => new THREE.Vector3(), [])
  const center = useMemo(() => new THREE.Vector2(0, 0), [])

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.05)
    const s = G()
    const b = body.current
    if (!b) return
    live.playerZone = zone
    const S = st.current
    const keys = s.settings.keys
    const frozen = s.screen !== 'playing' || s.loading < 1 || s.paused || !!s.cine || s.tabletOpen || s.inventoryOpen || !!s.puzzle || !!s.readNote || s.settingsOpen

    // regard
    const sens = 0.0022 * s.settings.sensitivity
    if (!frozen || s.cine === 'briefing') {
      live.yaw -= input.look.dx * sens
      live.pitch -= input.look.dy * sens * (s.settings.invertY ? -1 : 1)
      live.pitch = THREE.MathUtils.clamp(live.pitch, -1.45, 1.45)
    }
    input.look.dx = 0
    input.look.dy = 0

    // déplacement
    let ix = 0
    let iz = 0
    if (!frozen) {
      if (isDown(keys, 'forward')) iz -= 1
      if (isDown(keys, 'back')) iz += 1
      if (isDown(keys, 'left')) ix -= 1
      if (isDown(keys, 'right')) ix += 1
      ix += input.joy.x + pad.x
      iz += input.joy.y + pad.y
    }
    const len = Math.hypot(ix, iz)
    if (len > 1) {
      ix /= len
      iz /= len
    }
    const running = !frozen && (isDown(keys, 'run') || input.touchRun || pad.run || Math.hypot(input.joy.x, input.joy.y) > 0.95)
    // s'accroupir : vue abaissée et marche lente (la capsule de collision ne change pas)
    const crouching = !frozen && (isDown(keys, 'crouch') || pad.crouch)
    S.crouch = THREE.MathUtils.damp(S.crouch, crouching ? 1 : 0, 10, dt)
    let speed = (running && !crouching ? 4.4 : crouching ? 1.4 : 2.5) * ability().speed
    if (s.res.water <= 0) speed *= 0.55
    if (s.zone < 4 && s.res.o2 < 10) speed *= 0.8
    fwd.set(-Math.sin(live.yaw), 0, -Math.cos(live.yaw))
    right.set(Math.cos(live.yaw), 0, -Math.sin(live.yaw))
    mv.set(0, 0, 0).addScaledVector(fwd, -iz * speed * dt).addScaledVector(right, ix * speed * dt)
    if (input.jumpRequested && !frozen && S.grounded) S.vy = JUMP_SPEED
    // Consume each press once, including presses in midair or behind an overlay.
    input.jumpRequested = false
    S.vy = Math.max(S.vy - 9.81 * dt, -20)
    mv.y = S.vy * dt
    const col = b.collider(0)
    controller.computeColliderMovement(col, mv)
    const m = controller.computedMovement()
    S.grounded = controller.computedGrounded()
    if (S.grounded) S.vy = -0.5
    else if (S.vy > 0 && m.y < mv.y - 0.001) S.vy = 0 // tête contre un plafond
    const t = b.translation()
    let nx = t.x + m.x
    let ny = t.y + m.y
    let nz = t.z + m.z
    if (ny < -20) {
      const sp = spawnOf(s.zone)
      nx = sp.pos[0]
      ny = sp.pos[1] + 1
      nz = sp.pos[2]
      S.vy = 0
      S.grounded = false
    }
    b.setNextKinematicTranslation({ x: nx, y: ny, z: nz })
    const horiz = Math.hypot(m.x, m.z) / Math.max(dt, 1e-4)
    live.pos = [nx, ny - 0.85, nz]
    live.speed = horiz

    // tête : balancement, inclinaison en courant, respiration
    const moving = horiz > 0.4 && S.grounded
    if (moving) S.phase += dt * (running ? 11 : 7.6)
    const k = moving ? Math.min(1, horiz / 2.5) : 0
    const bobY = Math.sin(S.phase * 2) * 0.032 * k
    const bobX = Math.sin(S.phase) * 0.018 * k
    const stepIdx = Math.floor((S.phase + Math.PI / 4) / Math.PI)
    if (moving && stepIdx !== S.lastStep) {
      S.lastStep = stepIdx
      audio.sfx(s.zone === 4 ? 'steps_grass' : 'steps_metal', { vol: running ? 0.9 : 0.6 })
    }
    S.roll = THREE.MathUtils.damp(S.roll, (running ? -ix * 0.035 : -ix * 0.012) + (running && moving ? Math.sin(S.phase) * 0.006 : 0), 6, dt)
    const lowO2 = s.zone < 4 && s.res.o2 < 25 ? 1 - s.res.o2 / 25 : 0
    S.breath += dt * (1.2 + lowO2 * 2.5)
    const breathY = Math.sin(S.breath) * (0.004 + lowO2 * 0.012)

    const shake = s.shake
    const sx = shake ? (Math.random() - 0.5) * shake * 0.05 : 0
    const sy = shake ? (Math.random() - 0.5) * shake * 0.05 : 0

    if (s.cine && live.camOverride) {
      camera.position.set(...live.camOverride.pos)
      camera.lookAt(...live.camOverride.look)
    } else {
      camera.position.set(nx + right.x * bobX + sx, ny + EYE - S.crouch * 0.55 + bobY + breathY + sy, nz + right.z * bobX)
      camera.rotation.set(live.pitch + sy * 0.5, live.yaw + sx * 0.3, S.roll, 'YXZ')
    }
    const pc = camera as THREE.PerspectiveCamera
    const fov = (s.cine ? live.camOverride?.fov : undefined) ?? s.settings.fov + (running && moving ? 4 : 0) + lowO2 * 3
    if (Math.abs(pc.fov - fov) > 0.05) {
      pc.fov = S.cinematic && !s.cine ? fov : THREE.MathUtils.damp(pc.fov, fov, 5, dt)
      pc.updateProjectionMatrix()
    }
    S.cinematic = !!s.cine

    // lampe : suit la tête avec un léger retard
    S.lampYaw = THREE.MathUtils.damp(S.lampYaw, live.yaw, 14, dt)
    S.lampPitch = THREE.MathUtils.damp(S.lampPitch, live.pitch, 14, dt)
    lamp.position.set(camera.position.x + right.x * 0.12, camera.position.y + 0.08, camera.position.z + right.z * 0.12)
    const ldir = new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(S.lampPitch, S.lampYaw, 0, 'YXZ'))
    lampTarget.position.copy(lamp.position).add(ldir)
    lampTarget.updateMatrixWorld()
    let li = s.lampOn && s.res.lamp > 0 ? 42 : 0
    if (li && s.res.lamp < 15) {
      S.flick = Math.random() < 0.08 ? Math.random() * 0.4 : THREE.MathUtils.damp(S.flick, 1, 10, dt)
      li *= S.flick * (0.5 + s.res.lamp / 30)
    }
    lamp.intensity = li

    // son : écouteur
    audio.setListener([camera.position.x, camera.position.y, camera.position.z], [fwd.x, 0, fwd.z])

    // pièce courante + brouillard de la carte
    if (!s.cine) reveal(s.zone, nx, nz)
    if (s.zone < 4) {
      const room = roomAt(GRID_MAPS[s.zone as 1 | 2 | 3], nx, nz)
      live.roomId = room?.id ?? ''
    } else live.roomId = ''

    // visée
    let aimed: string | null = null
    if (!frozen) {
      raycaster.setFromCamera(center, camera)
      raycaster.far = REACH + 0.5
      const hits = raycaster.intersectObjects([...hitboxes], false)
      const h = hits.find((x) => x.distance <= REACH)
      if (h) {
        const id = h.object.userData.entId as string
        const dir = raycaster.ray.direction
        const o = raycaster.ray.origin
        const ray = new rapier.Ray({ x: o.x, y: o.y, z: o.z }, { x: dir.x, y: dir.y, z: dir.z })
        const wall = world.castRay(ray, h.distance + 0.3, true, undefined, undefined, col, b)
        if (!wall || wall.timeOfImpact >= h.distance - 0.35) aimed = id
      }
    }
    live.aimed = aimed
    const e = aimed ? entById(aimed) : null
    const label = e ? labelOf(e) : null
    const key = `${aimed}|${label}`
    if (key !== S.prevAim) {
      S.prevAim = key
      aim.id = label ? aimed : null
      aim.label = label
      useGame.setState({ aimLabel: label })
    }
  })

  return (
    <>
      <RigidBody ref={body} type="kinematicPosition" colliders={false} position={[startPos[0], startPos[1] + 0.95, startPos[2]]} enabledRotations={[false, false, false]}>
        <CapsuleCollider args={[0.55, 0.3]} />
      </RigidBody>
      <primitive object={lamp} />
      <primitive object={lampTarget} />
    </>
  )
}
