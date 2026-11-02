import { Canvas } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three'
import { audio } from './game/audio/audio'
import { useGame } from './game/state'
import { isTouch } from './player/Player'
import { Hud } from './ui/Hud'
import { MobileControls } from './ui/Mobile'
import { CharSelect, End, Leaderboard, NoteReader, Pause, Prologue, PuzzleHost, RotatePhone, SkipCine, Title } from './ui/Screens/Screens'
import { Login } from './ui/Screens/Login'
import { Settings } from './ui/Screens/Settings'
import { Tablet } from './ui/Tablet/Tablet'
import { Scene } from './world/Scene'

export default function App() {
  const screen = useGame((s) => s.screen)
  const paused = useGame((s) => s.paused)
  const tablet = useGame((s) => s.tabletOpen)
  const settingsOpen = useGame((s) => s.settingsOpen)
  const cine = useGame((s) => s.cine)
  const vols = useGame((s) => s.settings)
  useEffect(() => {
    audio.setVolumes({ music: vols.music, sfx: vols.sfx, voice: vols.voice })
  }, [vols.music, vols.sfx, vols.voice])
  useEffect(() => {
    const unlock = () => audio.init()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    audio.playMusic('title')
  }, [])
  const touch = isTouch()
  const playing = screen === 'playing'
  return (
    <>
      <Canvas
        shadows={{ type: THREE.PCFSoftShadowMap }}
        dpr={1}
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: false }}
        camera={{ fov: 72, near: 0.05, far: 12000, position: [0, 1.6, 0] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NoToneMapping
          gl.outputColorSpace = THREE.SRGBColorSpace
        }}
        onPointerDown={() => {
          if (playing && !touch && !useGame.getState().locked && !paused && !tablet && !useGame.getState().puzzle) {
            ;(document.querySelector('canvas') as any)?.requestPointerLock?.()
          }
        }}
      >
        <Scene />
      </Canvas>
      {screen === 'login' && <Login />}
      {screen === 'title' && <Title />}
      {screen === 'leaderboard' && <Leaderboard />}
      {screen === 'charSelect' && <CharSelect />}
      {screen === 'end' && <End />}
      {screen === 'prologue' && <Prologue />}
      {playing && (
        <>
          <Hud />
          {touch && !paused && (!cine || cine === 'briefing') && <MobileControls />}
          {tablet && <Tablet />}
          <PuzzleHost />
          <NoteReader />
          <SkipCine />
          {paused && <Pause />}
          {settingsOpen && <Settings onClose={() => useGame.setState({ settingsOpen: false })} />}
        </>
      )}
      <RotatePhone />
    </>
  )
}
