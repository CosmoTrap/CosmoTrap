import { Canvas } from '@react-three/fiber'
import { setLanguage } from './i18n'
import { Component, useEffect, type ReactNode } from 'react'
import * as THREE from 'three'
import { audio } from './game/audio/audio'
import { toast, useGame } from './game/state'
import { fr } from './i18n/fr'
import { isTouch } from './player/Player'
import { detectPadType, startGamepadLoop } from './player/gamepad'
import { setKeyLayout } from './player/input'
import { Hud } from './ui/Hud'
import { MobileControls } from './ui/Mobile'
import { End, NoteReader, Pause, Prologue, PuzzleHost, RotatePhone, SkipCine } from './ui/Screens/Screens'
import { Launch } from './ui/Screens/Launch'
import { Achievements } from './ui/Screens/Achievements'
import { Credits } from './ui/Screens/Credits'
import { Login } from './ui/Screens/Login'
import { MainMenu } from './ui/Screens/Menu'
import { SettingsPage } from './ui/Screens/SettingsPage'
import { Tablet } from './ui/Tablet/Tablet'
import { Scene } from './world/Scene'
import { SceneLoading } from './ui/SceneLoading'

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
  const character = useGame((s) => s.character)
  useEffect(() => {
    audio.female = ['nova', 'ines', 'maya'].includes(character)
  }, [character])
  useEffect(() => {
    audio.setVolumes({ music: vols.music * vols.master, sfx: vols.sfx * vols.master, voice: vols.voice * vols.master, ambience: vols.ambience })
  }, [vols.master, vols.music, vols.sfx, vols.voice, vols.ambience])
  useEffect(() => {
    audio.spatial = vols.spatialAudio
    audio.output = vols.audioOutput
    setKeyLayout(vols.keyLayout)
    audio.onCaption = vols.soundCaptions
      ? (name) => {
          const text = fr.soundCaptions[name]
          if (text && useGame.getState().screen === 'playing') toast(text, 'info', 2000)
        }
      : null
  }, [vols.spatialAudio, vols.audioOutput, vols.keyLayout, vols.soundCaptions])
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
      // symboles de la manette branchée
      const type = detectPadType()
      if (type) useGame.setState((s) => ({ settings: { ...s.settings, padType: type } }))
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
        frameloop={playing || screen === 'prologue' ? 'always' : 'demand'}
        gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: false }}
        camera={{ fov: 72, near: 0.05, far: 12000, position: [0, 1.6, 0] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.NoToneMapping
          gl.outputColorSpace = THREE.SRGBColorSpace
        }}
        onPointerDown={() => {
          if (playing && useGame.getState().loading === 1 && !touch && !useGame.getState().locked && !paused && !tablet && !useGame.getState().puzzle && !useGame.getState().cine && !settingsOpen && !useGame.getState().readNote) {
            ;(document.querySelector('canvas') as any)?.requestPointerLock?.()?.catch?.(() => {})
          }
        }}
      >
        <Scene />
      </Canvas>
      </CrashGuard>
      <div key={vols.lang} style={{ display: 'contents' }}>
      {screen === 'launch' && <Launch />}
      {screen === 'login' && <Login />}
      {screen === 'title' && <MainMenu />}
      {screen === 'settings' && <SettingsPage />}
      {screen === 'achievements' && <Achievements />}
      {screen === 'credits' && <Credits />}
      {screen === 'end' && <End />}
      {screen === 'prologue' && <Prologue />}
      <div className={`film-bars ${screen === 'prologue' || (playing && (cine === 'tour' || cine === 'launch' || cine === 'heli' || cine === 'fail')) ? 'on' : ''}`} aria-hidden>
        <i />
        <i />
      </div>
      {playing && (
        <>
          <Hud />
          <SceneLoading />
          {touch && !paused && !tablet && !settingsOpen && !useGame.getState().puzzle && !useGame.getState().readNote && (!cine || cine === 'briefing') && <MobileControls />}
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
