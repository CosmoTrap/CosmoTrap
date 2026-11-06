import { useProgress } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { G, live, useGame } from '../game/state'
import type { ZoneId } from '../game/types'
import * as THREE from 'three'

function sceneTextures(scene: THREE.Scene) {
  const textures = new Set<THREE.Texture>()
  const add = (value: any) => {
    if (value?.isTexture && !value.isRenderTargetTexture) textures.add(value)
  }
  scene.traverse(object => {
    const material = (object as THREE.Mesh).material
    if (!material) return
    for (const m of Array.isArray(material) ? material : [material]) {
      Object.values(m).forEach(add)
      if ((m as THREE.ShaderMaterial).uniforms) Object.values((m as THREE.ShaderMaterial).uniforms).forEach(u => add(u.value))
    }
  })
  return [...textures]
}

/** Three.compile traverses even hidden batching sources. Compile just the
 * actual drawables, with the real scene's lights/environment. Shallow clones
 * preserve instancing/skinning variants without reparenting the live objects. */
function drawables(scene: THREE.Scene) {
  const group = new THREE.Group()
  // Every drawable, hidden ones included (rooms culled behind a door, things that appear when the power or
  // an alarm comes back): compiling them only when they first show froze the game for a moment, worst on
  // Windows, where each shader is translated to Direct3D. Batching sources stay out: their batch is drawn.
  scene.traverse(object => {
    if (object.userData.staticBatchSource) return
    if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line || object instanceof THREE.Sprite) {
      group.add(object.clone(false))
    }
  })
  return group
}

/** Shows hidden drawables, and asks every shadow-casting light for its map (even switched off, like the torch),
 * for the warm-up frames drawn under the loader. Returns how to put everything back. */
function revealForWarmup(scene: THREE.Scene) {
  const hidden: THREE.Object3D[] = [], lights: { light: THREE.Light; intensity: number }[] = []
  scene.traverse(object => {
    if (object.userData.staticBatchSource) return
    if (!object.visible && (object instanceof THREE.Mesh || object instanceof THREE.Points)) { hidden.push(object); object.visible = true }
    const light = object as THREE.Light
    if (light.isLight && light.castShadow && light.shadow) {
      lights.push({ light, intensity: light.intensity })
      if (light.intensity === 0) light.intensity = 1e-4
      light.shadow.needsUpdate = true
    }
  })
  return () => {
    hidden.forEach(object => { object.visible = false })
    lights.forEach(({ light, intensity }) => { if (light.intensity === 1e-4) light.intensity = intensity })
  }
}

/** Give the DOM a paint before constructing a new level on the main thread. */
export function SceneGate({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const first = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(first)
  }, [])
  return mounted ? children : null
}

/** Keep the loader until assets, physics and the first rendered frames are ready. */
export function SceneReady({ zone }: { zone: ZoneId }) {
  const active = useProgress((s) => s.active)
  const { gl, scene, camera } = useThree()
  const ready = useRef({ compiling: false, compiled: false, done: false })
  const alive = useRef(true)
  const uploads = useRef<THREE.Texture[] | null>(null)
  const uploaded = useRef(0)
  const generation = useRef(0)
  const warmup = useRef({ frames: 0, programs: -1, stable: 0 })
  const culling = useRef(new Map<THREE.Object3D, boolean>())
  const unreveal = useRef<(() => void) | null>(null)
  const restoreCulling = () => {
    culling.current.forEach((value, object) => { object.frustumCulled = value })
    culling.current.clear()
  }
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => () => { restoreCulling(); unreveal.current?.() }, [])
  useFrame(() => {
    const r = ready.current
    if (r.done || G().zone !== zone || live.playerZone !== zone) return
    if (active) {
      if (uploads.current) {
        // An inner Suspense boundary may reveal another model while warming up.
        generation.current++
        uploads.current = null; uploaded.current = 0
        r.compiling = r.compiled = false
        restoreCulling(); unreveal.current?.(); unreveal.current = null
        warmup.current = { frames: 0, programs: -1, stable: 0 }
      }
      return
    }
    // Textures outside the first view still need an upload before the player walks.
    // The shader compile runs during those uploads, so the loader is not the sum of both.
    uploads.current ??= sceneTextures(scene)
    const until = performance.now() + 12
    while (uploaded.current < uploads.current.length && performance.now() < until) {
      gl.initTexture(uploads.current[uploaded.current++])
    }
    if (!r.compiling) {
      r.compiling = true
      const version = generation.current
      gl.compileAsync(drawables(scene), camera, scene).catch(() => {}).finally(() => {
        if (alive.current && version === generation.current) r.compiled = true
      })
    }
    if (uploaded.current < uploads.current.length || !r.compiled) return
    const w = warmup.current
    if (w.frames === 0) {
      // compileAsync does not upload geometry or warm shadow/AO variants. Draw
      // every visible mesh through the real composer while the loader covers it,
      // including objects behind the initial camera. No camera/physics teleport.
      scene.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line)) return
        culling.current.set(object, object.frustumCulled)
        object.frustumCulled = false
      })
      unreveal.current = revealForWarmup(scene)
    } else if (w.frames <= 2) {
      // The shadow pass keeps drawing every light's map for both warm-up frames.
      scene.traverse(object => { const l = object as THREE.Light; if (l.isLight && l.castShadow && l.shadow) l.shadow.needsUpdate = true })
    }
    w.frames++
    if (w.frames <= 2) return
    restoreCulling()
    unreveal.current?.(); unreveal.current = null
    const programs = gl.info.programs ?? []
    // Three's async compile only waits for the last variant of a shared
    // material. Poll every program before its first-use diagnostics/uniforms.
    const context = gl.getContext()
    const parallel = gl.extensions.get('KHR_parallel_shader_compile')
    if (parallel && programs.some(p => !context.getProgramParameter(p.program, parallel.COMPLETION_STATUS_KHR))) return
    for (const program of programs) { program.getUniforms(); program.getAttributes() }
    w.stable = programs.length === w.programs ? w.stable + 1 : 0
    w.programs = programs.length
    if (w.stable < 2) return
    r.done = true
    useGame.setState({ loading: 1, cineT0: G().cine ? performance.now() : G().cineT0 })
  })
  return null
}
