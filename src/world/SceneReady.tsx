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

/** Give the DOM a paint before constructing a new level on the main thread. */
export function SceneGate({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    let second = 0
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setMounted(true))
    })
    return () => { cancelAnimationFrame(first); cancelAnimationFrame(second) }
  }, [])
  return mounted ? children : null
}

/** Keep the loader until assets, physics and the first rendered frames are ready. */
export function SceneReady({ zone }: { zone: ZoneId }) {
  const active = useProgress((s) => s.active)
  const { gl, scene, camera } = useThree()
  const ready = useRef({ frames: 0, compiling: false, compiled: false, done: false })
  const alive = useRef(true)
  const uploads = useRef<THREE.Texture[] | null>(null)
  const uploaded = useRef(0)
  const generation = useRef(0)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useFrame(() => {
    const r = ready.current
    if (r.done || G().zone !== zone || live.playerZone !== zone) return
    if (active) {
      r.frames = 0
      if (uploads.current) {
        // An inner Suspense boundary may reveal another model while warming up.
        generation.current++
        uploads.current = null; uploaded.current = 0
        r.compiling = r.compiled = false
      }
      return
    }
    if (++r.frames < 3) return
    // Compilation alone does not upload the textures in rooms outside the
    // initial view. Do that under the loader, in short batches, before walking.
    uploads.current ??= sceneTextures(scene)
    const until = performance.now() + 6
    while (uploaded.current < uploads.current.length && performance.now() < until) {
      gl.initTexture(uploads.current[uploaded.current++])
    }
    if (uploaded.current < uploads.current.length) return
    if (!r.compiling) {
      r.compiling = true
      const version = generation.current
      // KHR_parallel_shader_compile where available; normal rendering is the
      // fallback on devices without it. No fixed five-second transition timer.
      gl.compileAsync(scene, camera).catch(() => {}).finally(() => {
        if (alive.current && version === generation.current) { r.compiled = true; r.frames = 0 }
      })
      return
    }
    if (!r.compiled) return
    r.done = true
    useGame.setState({ loading: 1, cineT0: G().cine ? performance.now() : G().cineT0 })
  })
  return null
}
