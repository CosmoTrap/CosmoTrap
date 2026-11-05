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
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useFrame(() => {
    const r = ready.current
    if (r.done || G().zone !== zone || live.playerZone !== zone) return
    if (active) {
      if (uploads.current) {
        // An inner Suspense boundary may reveal another model while warming up.
        generation.current++
        uploads.current = null; uploaded.current = 0
        r.compiling = r.compiled = false
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
      gl.compileAsync(scene, camera).catch(() => {}).finally(() => {
        if (alive.current && version === generation.current) r.compiled = true
      })
    }
    if (uploaded.current < uploads.current.length || !r.compiled) return
    r.done = true
    useGame.setState({ loading: 1, cineT0: G().cine ? performance.now() : G().cineT0 })
  })
  return null
}
