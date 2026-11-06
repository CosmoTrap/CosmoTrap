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
  scene.traverseVisible(object => {
    if (object instanceof THREE.Mesh || object instanceof THREE.Points || object instanceof THREE.Line || object instanceof THREE.Sprite) {
      group.add(object.clone(false))
    }
  })
  return group
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

/** Keep the loader until assets, physics and every visible shader are ready. */
export function SceneReady({ zone }: { zone: ZoneId }) {
  const active = useProgress((s) => s.active)
  const assetProgress = useProgress((s) => s.progress)
  const { gl, scene, camera } = useThree()
  const ready = useRef({ compiling: false, compiled: false, done: false })
  const alive = useRef(true)
  const uploads = useRef<THREE.Texture[] | null>(null)
  const uploaded = useRef(0)
  const generation = useRef(0)
  const warmup = useRef({ frames: 0, programs: -1, stable: 0 })
  const culling = useRef(new Map<THREE.Object3D, boolean>())
  const boot = useRef(0)
  const restoreCulling = () => {
    culling.current.forEach((value, object) => { object.frustumCulled = value })
    culling.current.clear()
  }
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => () => restoreCulling(), [])
  useFrame(() => {
    const r = ready.current
    const publish = (pct: number) => {
      if (r.done || G().loading >= 1 || G().zone !== zone) return
      const next = Math.max(G().loadProgress, Math.min(99, Math.round(pct)))
      if (next !== G().loadProgress) useGame.setState({ loadProgress: next })
    }
    if (r.done || G().zone !== zone) return
    boot.current++
    if (live.playerZone !== zone) {
      publish(Math.min(12, boot.current))
      return
    }
    if (active) {
      if (uploads.current) {
        // An inner Suspense boundary may reveal another model while warming up.
        generation.current++
        uploads.current = null; uploaded.current = 0
        r.compiling = r.compiled = false
        restoreCulling()
        warmup.current = { frames: 0, programs: -1, stable: 0 }
      }
      publish(12 + assetProgress * 0.28)
      return
    }
    // Textures outside the first view still need an upload before the player walks.
    // The shader compile runs during those uploads, so the loader is not the sum of both.
    uploads.current ??= sceneTextures(scene)
    const until = performance.now() + 12
    while (uploaded.current < uploads.current.length && performance.now() < until) {
      gl.initTexture(uploads.current[uploaded.current++])
    }
    const texTotal = Math.max(uploads.current.length, 1)
    if (!r.compiling) {
      r.compiling = true
      const version = generation.current
      gl.compileAsync(drawables(scene), camera, scene).catch(() => {}).finally(() => {
        if (alive.current && version === generation.current) r.compiled = true
      })
    }
    if (uploaded.current < uploads.current.length || !r.compiled) {
      publish(42 + (uploaded.current / texTotal) * 28)
      return
    }
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
    }
    w.frames++
    if (w.frames <= 2) {
      publish(72 + w.frames)
      return
    }
    restoreCulling()
    const programs = gl.info.programs ?? []
    // Three's async compile only waits for the last variant of a shared
    // material. Poll every program before its first-use diagnostics/uniforms.
    const context = gl.getContext()
    const parallel = gl.extensions.get('KHR_parallel_shader_compile')
    const pending = parallel ? programs.filter(p => !context.getProgramParameter(p.program, parallel.COMPLETION_STATUS_KHR)).length : 0
    if (pending) {
      publish(78 + (1 - pending / Math.max(programs.length, 1)) * 16)
      return
    }
    for (const program of programs) { program.getUniforms(); program.getAttributes() }
    w.stable = programs.length === w.programs ? w.stable + 1 : 0
    w.programs = programs.length
    if (w.stable < 2) {
      publish(94 + w.stable)
      return
    }
    r.done = true
    useGame.setState({ loading: 1, loadProgress: 100, cineT0: G().cine ? performance.now() : G().cineT0 })
  })
  return null
}
