import { useProgress } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { G, live, useGame } from '../game/state'
import type { ZoneId } from '../game/types'

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
  useEffect(() => () => { alive.current = false }, [])
  useFrame(() => {
    const r = ready.current
    if (r.done || G().zone !== zone || live.playerZone !== zone) return
    if (active) { r.frames = 0; return }
    if (++r.frames < 3) return
    if (!r.compiling) {
      r.compiling = true
      // KHR_parallel_shader_compile where available; normal rendering is the
      // fallback on devices without it. No fixed five-second transition timer.
      gl.compileAsync(scene, camera).catch(() => {}).finally(() => {
        if (alive.current) { r.compiled = true; r.frames = 0 }
      })
      return
    }
    if (!r.compiled) return
    r.done = true
    useGame.setState({ loading: 1, cineT0: G().cine ? performance.now() : G().cineT0 })
  })
  return null
}
