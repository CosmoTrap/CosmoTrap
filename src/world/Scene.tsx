import { Environment, Lightformer } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Physics } from '@react-three/rapier'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { audio } from '../game/audio/audio'
import { gridMap } from '../game/maps'
import { G, live, useGame } from '../game/state'
import type { GridMap } from '../game/types'
import { Hands } from '../player/Hands'
import { Player, useInputListeners } from '../player/Player'
import { CineDirector, EndAvatar, Flare, GameLoop } from './Cinematics'
import { Effects } from './Effects'
import { Exterior } from './Exterior'
import { Level } from './Level'
import { QUALITY } from './quality'
import { TitleScene } from './TitleScene'
import { Zone4 } from './zone4/Zone4'
import { Ghost, useLoadGhost } from './Ghost'

/** soleil pour les intérieurs : n'entre que par les hublots (ombres) */
function InteriorSun({ map }: { map: GridMap }) {
  const size = QUALITY[G().settings.quality].sunShadow
  const W = Math.max(...map.grid.map((r) => r.length)) * 2
  const H = map.grid.length * 2
  const sun = new THREE.Vector3(...map.sun).normalize()
  const center = new THREE.Vector3(W / 2, 1.4, H / 2)
  const target = useMemo(() => {
    const o = new THREE.Object3D()
    o.position.copy(center)
    return o
  }, [map])
  const ext = Math.max(W, H) * 0.75 + 4
  return (
    <>
      <primitive object={target} />
      <directionalLight
        target={target}
        position={center.clone().addScaledVector(sun, 60)}
        color="#fff2e0"
        intensity={size ? 6 : 0}
        castShadow={size > 0}
        shadow-mapSize={[size || 512, size || 512]}
        shadow-camera-left={-ext}
        shadow-camera-right={ext}
        shadow-camera-top={ext}
        shadow-camera-bottom={-ext}
        shadow-camera-near={1}
        shadow-camera-far={140}
        shadow-bias={-0.0006}
        shadow-normalBias={0.05}
      />
    </>
  )
}

/** reflets d'environnement intérieurs (bandeaux lumineux) */
function InteriorEnv({ zone }: { zone: number }) {
  const warm = zone === 3 ? '#ffc79a' : '#ffe7cc'
  return (
    <Environment frames={1} resolution={128} background={false}>
      <color attach="background" args={['#0b0d12']} />
      <Lightformer form="rect" intensity={2.2} color="#ffffff" position={[0, 5, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 1.2, 1]} />
      <Lightformer form="rect" intensity={1.2} color={warm} position={[-6, 1, 0]} rotation={[0, Math.PI / 2, 0]} scale={[8, 3, 1]} />
      <Lightformer form="rect" intensity={0.8} color="#7fb2ff" position={[6, 1, 2]} rotation={[0, -Math.PI / 2, 0]} scale={[8, 3, 1]} />
      <Lightformer form="ring" intensity={1.5} color="#ffffff" position={[0, 3, -6]} scale={2} />
    </Environment>
  )
}

function ZoneAudio({ zone }: { zone: number }) {
  useEffect(() => {
    audio.playMusic(zone === 1 ? 'orion' : zone === 2 ? 'machinerie' : zone === 3 ? 'hermes' : 'terre')
    if (zone < 4) {
      audio.setInterior(true)
      const t = setTimeout(() => audio.loop('amb', 'amb_station', { vol: 0.7 }), 500)
      return () => {
        clearTimeout(t)
        audio.stopLoop('amb')
      }
    }
  }, [zone])
  return null
}

function PhysicsWorld() {
  const zone = useGame((s) => s.zone)
  const map = gridMap(zone)
  const quality = useGame((s) => s.settings.quality)
  const shadows = QUALITY[quality].sunShadow > 0
  return (
    <Physics key={zone} gravity={[0, -9.81, 0]} timeStep="vary">
      {map ? (
        <>
          <fogExp2 attach="fog" args={['#05070a', 0.034]} />
          <InteriorEnv zone={zone} />
          <InteriorSun map={map} />
          <Level map={map} shadows={shadows} />
          <Exterior map={map} />
        </>
      ) : (
        <>
          <Zone4 />
          <EndAvatar />
          <Flare />
        </>
      )}
      <Player key={zone} />
      <Ghost />
    </Physics>
  )
}

/** ajuste le DPR si les performances chutent (tous types de PC) */
function AdaptiveDpr() {
  const quality = useGame((s) => s.settings.quality)
  const acc = useRef({ t: 0, n: 0, dpr: 0 })
  useFrame(({ gl }, dt) => {
    const a = acc.current
    const [lo, hi] = QUALITY[quality].dpr
    const target = Math.min(window.devicePixelRatio || 1, hi)
    if (!a.dpr) {
      a.dpr = target
      gl.setPixelRatio(a.dpr)
    }
    a.t += dt
    a.n++
    if (a.t > 2) {
      const fps = a.n / a.t
      live.fps = fps
      if (fps < 42 && a.dpr > lo + 0.01) a.dpr = Math.max(lo, a.dpr - 0.15)
      else if (fps > 58 && a.dpr < target - 0.01) a.dpr = Math.min(target, a.dpr + 0.1)
      gl.setPixelRatio(a.dpr)
      a.t = 0
      a.n = 0
    }
  })
  useEffect(() => {
    acc.current.dpr = 0
  }, [quality])
  return null
}

export function Scene() {
  const screen = useGame((s) => s.screen)
  useInputListeners()
  useLoadGhost()
  return (
    <>
      <AdaptiveDpr />
      {screen === 'playing' ? (
        <Suspense fallback={null}>
          <PhysicsWorld />
          <Hands />
          <GameLoop />
          <CineDirector />
          <ZoneAudioWatcher />
        </Suspense>
      ) : (
        <TitleScene />
      )}
      <Effects />
    </>
  )
}

function ZoneAudioWatcher() {
  const zone = useGame((s) => s.zone)
  return <ZoneAudio key={zone} zone={zone} />
}
