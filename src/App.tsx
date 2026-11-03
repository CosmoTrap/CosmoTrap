import { Canvas } from '@react-three/fiber'
import { setLanguage } from './i18n'
import { Component, useEffect, type ReactNode } from 'react'
import * as THREE from 'three'
import { audio } from './game/audio/audio'
import { useGame } from './game/state'
import { isTouch } from './player/Player'
import { startGamepadLoop } from './player/gamepad'
import { Hud } from './ui/Hud'
import { MobileControls } from './ui/Mobile'
import { CharSelect, End, Leaderboard, NoteReader, Pause, Prologue, PuzzleHost, RotatePhone, SkipCine, Title } from './ui/Screens/Screens'
import { Login } from './ui/Screens/Login'
import { MainMenu } from './ui/Screens/Menu'
import { SettingsPage } from './ui/Screens/SettingsPage'
import { Tablet } from './ui/Tablet/Tablet'
import { Scene } from './world/Scene'

/** si le rendu 3D plante, on affiche un message clair plutôt qu'un écran noir */
class CrashGuard extends Component<{ children: ReactNode }, { err: string | null }> {
  state = { err: null as string | null }
  static getDerivedStateFromError(e: Error) {
    return { err: e.message }
  }
  componentDidCatch(e: Error) {
    console.error('Cosmotrap — erreur de rendu :', e)
  }
  render() {
    if (!this.state.err) return this.props.children
    return (
      <div className="modal-bg" style={{ zIndex: 90 }}>
        <div className="panel" style={{ width: 'min(460px, 92vw)', textAlign: 'center' }}>
          <h2>Problème d’affichage 3D</h2>
          <p className="sub">Ta progression est sauvegardée. Recharge la page pour reprendre (bouton Continuer).</p>
          <button className="btn primary" onClick={() => location.reload()}>
            Recharger
          </button>
        </div>
      </div>
    )
  }
}

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
    audio.browserVoice = vols.browserVoice
    audio.lang = vols.lang
    setLanguage(vols.lang)
  }, [vols.browserVoice, vols.lang])
  useEffect(() => {
    const unlock = () => audio.init()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    audio.playMusic('title')
    const stopPad = startGamepadLoop()
    const padOn = () => {
      audio.init()
      document.body.classList.add('pad')
    }
    window.addEventListener('gamepadconnected', padOn)
    return () => {
      stopPad()
      window.removeEventListener('gamepadconnected', padOn)
    }
  }, [])
  const touch = isTouch()
  const playing = screen === 'playing'
  return (
    <>
      <CrashGuard>
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
      </CrashGuard>
      <div key={vols.lang} style={{ display: 'contents' }}>
      {screen === 'login' && <Login />}
      {screen === 'title' && <MainMenu />}
      {screen === 'settings' && <SettingsPage />}
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
          {settingsOpen && <SettingsPage overlay onClose={() => useGame.setState({ settingsOpen: false })} />}
        </>
      )}
      <RotatePhone />
      </div>
    </>
  )
}
