import { useEffect, useState } from 'react'
import { audio } from '../../game/audio/audio'
import { saveSettings, useGame, type Quality, type Settings as S } from '../../game/state'
import { fr } from '../../i18n/fr'
import { ACTION_ORDER, DEFAULT_KEYS, keyName, type Action } from '../../player/input'

const T = fr.settings
const ACTION_LABEL: Record<Action, string> = {
  forward: 'Avancer',
  back: 'Reculer',
  left: 'Gauche',
  right: 'Droite',
  run: 'Courir',
  act: 'Agir',
  lamp: 'Lampe',
  o2: 'Brancher l’O₂',
  battery: 'Changer les piles',
  drink: 'Boire',
  tablet: 'Tablette',
  pause: 'Pause',
}

export function update(p: Partial<S>) {
  const s = { ...useGame.getState().settings, ...p }
  useGame.setState({ settings: s })
  saveSettings(s)
  audio.setVolumes({ music: s.music, sfx: s.sfx, voice: s.voice })
}

function KeyRow({ a }: { a: Action }) {
  const keys = useGame((s) => s.settings.keys)
  const [wait, setWait] = useState<number | null>(null)
  useEffect(() => {
    if (wait === null) return
    ;(window as any).__rebinding = true
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.code === 'Escape' && a !== 'pause') {
        setWait(null)
        return
      }
      const next = { ...keys }
      // retire la touche des autres actions pour éviter les doublons
      for (const k of ACTION_ORDER) next[k] = next[k].filter((c) => c !== e.code)
      const list = [...(keys[a] ?? [])]
      list[wait] = e.code
      next[a] = list.filter(Boolean)
      update({ keys: next })
      setWait(null)
    }
    const onMouse = (e: MouseEvent) => {
      if (e.button === 0 && (e.target as HTMLElement).classList.contains('keybind')) return
    }
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('mousedown', onMouse, true)
    return () => {
      ;(window as any).__rebinding = false
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('mousedown', onMouse, true)
    }
  }, [wait, a, keys])
  return (
    <div className="set-row">
      <span>{ACTION_LABEL[a]}</span>
      <span style={{ display: 'flex', gap: 6 }}>
        {[0, 1].map((i) => (
          <button key={i} data-testid={`bind-${a}-${i}`} className={`keybind ${wait === i ? 'wait' : ''}`} onClick={() => setWait(i)}>
            {wait === i ? 'Appuie…' : keys[a]?.[i] ? keyName(keys[a][i]) : '—'}
          </button>
        ))}
      </span>
    </div>
  )
}

export function Settings({ onClose }: { onClose: () => void }) {
  const s = useGame((st) => st.settings)
  const [tab, setTab] = useState<'gfx' | 'audio' | 'keys'>('gfx')
  return (
    <div className="modal-bg" style={{ zIndex: 40 }} onClick={onClose}>
      <div className="panel settings" onClick={(e) => e.stopPropagation()} data-testid="settings">
        <button className="close-x" onClick={onClose}>
          ×
        </button>
        <h2>{T.title}</h2>
        <div className="set-tabs">
          <button className={`btn ${tab === 'gfx' ? 'primary' : ''}`} onClick={() => setTab('gfx')}>
            Graphismes
          </button>
          <button className={`btn ${tab === 'audio' ? 'primary' : ''}`} onClick={() => setTab('audio')}>
            Son
          </button>
          <button className={`btn ${tab === 'keys' ? 'primary' : ''}`} data-testid="tab-keys" onClick={() => setTab('keys')}>
            Touches
          </button>
        </div>
        {tab === 'gfx' && (
          <>
            <div className="set-row">
              <span>
                {T.quality}
                <br />
                <small style={{ color: 'var(--muted)' }}>Ultra : ombres 4K, occlusion complète, 140 000 brins d’herbe. Basse : pour PC portables et téléphones.</small>
              </span>
              <div className="seg">
                {(['low', 'medium', 'high', 'ultra'] as Quality[]).map((q) => (
                  <button key={q} className={s.quality === q ? 'on' : ''} onClick={() => update({ quality: q })}>
                    {q === 'ultra' ? 'Ultra' : T.qualities[q]}
                  </button>
                ))}
              </div>
            </div>
            <div className="set-row">
              <span>
                {T.fov} : {s.fov}°
              </span>
              <input type="range" min={60} max={100} step={1} value={s.fov} onChange={(e) => update({ fov: +e.target.value })} />
            </div>
            <div className="set-row">
              <span>
                {T.sensitivity} : {s.sensitivity.toFixed(2)}
              </span>
              <input type="range" min={0.2} max={3} step={0.05} value={s.sensitivity} onChange={(e) => update({ sensitivity: +e.target.value })} />
            </div>
            <div className="set-row">
              <span>
                Regarder avec le pavé tactile
                <br />
                <small style={{ color: 'var(--muted)' }}>Glisser à deux doigts (ou la molette) tourne la caméra, en plus de la souris.</small>
              </span>
              <div className="seg">
                <button className={!s.trackpadLook ? 'on' : ''} onClick={() => update({ trackpadLook: false })}>
                  {T.off}
                </button>
                <button className={s.trackpadLook ? 'on' : ''} onClick={() => update({ trackpadLook: true })}>
                  {T.on}
                </button>
              </div>
            </div>
            <div className="set-row">
              <span>{T.invertY}</span>
              <div className="seg">
                <button className={!s.invertY ? 'on' : ''} onClick={() => update({ invertY: false })}>
                  {T.off}
                </button>
                <button className={s.invertY ? 'on' : ''} onClick={() => update({ invertY: true })}>
                  {T.on}
                </button>
              </div>
            </div>
            <div className="set-row">
              <span>{T.colorblind}</span>
              <div className="seg">
                <button className={!s.colorblind ? 'on' : ''} onClick={() => update({ colorblind: false })}>
                  {T.off}
                </button>
                <button className={s.colorblind ? 'on' : ''} onClick={() => update({ colorblind: true })}>
                  {T.on}
                </button>
              </div>
            </div>
            <div className="set-row">
              <span>Afficher les images/seconde</span>
              <div className="seg">
                <button className={!s.showFps ? 'on' : ''} onClick={() => update({ showFps: false })}>
                  {T.off}
                </button>
                <button className={s.showFps ? 'on' : ''} onClick={() => update({ showFps: true })}>
                  {T.on}
                </button>
              </div>
            </div>
          </>
        )}
        {tab === 'audio' && (
          <>
            {(['music', 'sfx', 'voice'] as const).map((k) => (
              <div key={k} className="set-row">
                <span>
                  {T[k]} : {Math.round(s[k] * 100)} %
                </span>
                <input type="range" min={0} max={1} step={0.01} value={s[k]} onChange={(e) => update({ [k]: +e.target.value } as Partial<S>)} />
              </div>
            ))}
          </>
        )}
        {tab === 'keys' && (
          <>
            <p className="sub" style={{ marginTop: 0 }}>
              Clique sur une case puis appuie sur la nouvelle touche. Les touches 1 à 9 utilisent les objets de la barre d’inventaire.
            </p>
            {ACTION_ORDER.map((a) => (
              <KeyRow key={a} a={a} />
            ))}
            <div style={{ marginTop: 14 }}>
              <button className="btn" onClick={() => update({ keys: DEFAULT_KEYS })}>
                Touches par défaut
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
