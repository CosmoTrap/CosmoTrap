import { CineActor, CrashFx } from './FilmScenes'
import { RescueScene } from './cine/Rescue'
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
import { SceneGate, SceneReady } from './SceneReady'
import { LunarWorld } from './LunarWorld'
import { stationPowerDown } from './roomPower'

/** soleil pour les intérieurs : n'entre que par les hublots (ombres) */
function InteriorSun({ map }: { map: GridMap }) {
  const light = useRef<THREE.DirectionalLight>(null)
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
  // Le volume d'ombre englobe les rochers qui rasent la coque, pour qu'ils coupent le soleil intérieur.
  const ext = Math.max(W, H) * 0.95 + 28
  useFrame(() => {
    const sunLight = light.current
    if (!sunLight) return
    sunLight.intensity = size && !stationPowerDown(map.zone) ? 6 : 0
    // Keep the light/shader layout stable, but do not redraw the entire station
    // into a shadow map whose light contributes nothing during the outage.
    sunLight.shadow.autoUpdate = sunLight.intensity > 0
    sunLight.shadow.needsUpdate = sunLight.shadow.map === null
  })
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={light}
        name="interior-sun"
        target={target}
        position={center.clone().addScaledVector(sun, 200)}
        color="#fff2e0"
        intensity={size && !stationPowerDown(map.zone) ? 6 : 0}
        castShadow={size > 0}
        shadow-mapSize={[size || 512, size || 512]}
        shadow-camera-left={-ext}
        shadow-camera-right={ext}
        shadow-camera-top={ext}
        shadow-camera-bottom={-ext}
        shadow-camera-near={8}
        shadow-camera-far={340}
        shadow-bias={-0.0008}
        shadow-normalBias={0.08}
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
  const mission = useGame(s => s.map)
  const map = gridMap(zone)
  const quality = useGame((s) => s.settings.quality)
  const shadows = QUALITY[quality].sunShadow > 0
  return (
    <Physics key={`${mission}:${zone}`} gravity={[0, mission === 'base' ? -1.62 : -9.81, 0]} timeStep="vary">
      {map ? (
        <>
          <fogExp2 attach="fog" args={['#10151b', mission === 'base' ? 0 : 0.018]} />
          <InteriorEnv zone={zone} />
          <InteriorSun map={map} />
          {mission === 'base' ? <LunarWorld shadows={shadows} /> : <><Level map={map} shadows={shadows} /><Exterior map={map} /></>}
        </>
      ) : (
        <>
          <Zone4 />
          <EndAvatar />
          <Flare />
          <CrashFx />
          <RescueScene />
        </>
      )}
      <CineActor />
      <Player key={zone} />
      {mission !== 'base' && <Ghost />}
      <SceneReady zone={zone} />
    </Physics>
  )
}

/** ajuste le DPR si les performances chutent (tous types de PC) */
/** résolution de rendu : automatique (baisse si les images/s chutent) ou fixée par le joueur */
function AdaptiveDpr() {
  const quality = useGame((s) => s.settings.quality)
  const resolution = useGame((s) => s.settings.resolution)
  const acc = useRef({ t: 0, n: 0, dpr: 0 })
  useFrame(({ gl, size, setDpr }, dt) => {
    const a = acc.current
    a.t += dt
    a.n++
    if (resolution !== 'auto') {
      // hauteur de rendu choisie (720p, 1080p, 4K…) quelle que soit la taille de la fenêtre
      const want = THREE.MathUtils.clamp(resolution / Math.max(1, size.height), 0.25, 3)
      if (Math.abs(gl.getPixelRatio() - want) > 0.01) setDpr(want)
      if (a.t > 2) {
        live.fps = a.n / a.t
        a.t = 0
        a.n = 0
      }
      return
    }
    const [lo, hi] = QUALITY[quality].dpr
    const target = Math.min(window.devicePixelRatio || 1, hi)
    if (!a.dpr) {
      a.dpr = target
      setDpr(a.dpr)
    }
    if (a.t > 2) {
      const fps = a.n / a.t
      live.fps = fps
      if (fps < 42 && a.dpr > lo + 0.01) a.dpr = Math.max(lo, a.dpr - 0.15)
      else if (fps > 58 && a.dpr < target - 0.01) a.dpr = Math.min(target, a.dpr + 0.1)
      if (Math.abs(gl.getPixelRatio() - a.dpr) > 0.01) setDpr(a.dpr)
      a.t = 0
      a.n = 0
    }
  })
  useEffect(() => {
    acc.current.dpr = 0
  }, [quality, resolution])
  return null
}

export function Scene() {
  const screen = useGame((s) => s.screen)
  const zone = useGame((s) => s.zone)
  useInputListeners()
  useLoadGhost()
  return (
    <>
      <AdaptiveDpr />
      {screen === 'playing' ? (
        <SceneGate key={zone}>
        <Suspense fallback={null}>
          <PhysicsWorld />
          <Hands />
          <GameLoop />
          <CineDirector />
          <ZoneAudioWatcher />
        </Suspense>
        </SceneGate>
      ) : screen === 'prologue' ? (
        <TitleScene />
      ) : null}
      {(screen === 'playing' || screen === 'prologue') && <Effects />}
    </>
  )
}

function ZoneAudioWatcher() {
  const zone = useGame((s) => s.zone)
  return <ZoneAudio key={zone} zone={zone} />
}
