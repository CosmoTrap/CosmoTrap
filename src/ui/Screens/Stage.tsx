import { useEffect, useRef, type ReactNode } from 'react'
import { useGame, type Screen } from '../../game/state'
import { fr } from '../../i18n/fr'
import '../menu.css'

// Scène des menus : les maquettes font 1280 × 832. On garde ce repère et on le met à l'échelle
// de la fenêtre, tandis que l'image de fond couvre tout l'écran.

export const STAGE_W = 1280
export const STAGE_H = 832

interface StageProps {
  /** launch : image pleine · inner : voile bleu nuit des écrans intérieurs */
  kind?: 'launch' | 'inner'
  tint?: 'win' | 'fail' | 'pause'
  overlay?: boolean
  testId?: string
  children: ReactNode
}

export function Stage({ kind = 'inner', tint, overlay, testId, children }: StageProps) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const fit = () => root.current?.style.setProperty('--k', String(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H)))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return (
    <div ref={root} className={`st st-${kind} ${tint ? `st-${tint}` : ''} ${overlay ? 'overlay' : ''}`} data-testid={testId}>
      <div className="st-bg" aria-hidden />
      <div className="st-scrim" aria-hidden />
      {tint && <div className="st-tint" aria-hidden />}
      <div className="st-canvas">
        {children}
      </div>
    </div>
  )
}

/** ouvre une page (Paramètres, Succès, Crédits) en mémorisant l'écran où revenir */
export function openPage(screen: Screen, extra: Partial<ReturnType<typeof useGame.getState>> = {}) {
  useGame.setState({ menuBack: useGame.getState().screen, screen, ...extra })
}

export function closePage() {
  useGame.setState({ screen: useGame.getState().menuBack, firstRun: false, missionPick: false })
}

export function PageHead({ kicker, title, onBack }: { kicker: string; title: string; onBack: () => void }) {
  return (
    <header className="x-head">
      <button type="button" className="x-back" data-testid="page-back" onClick={onBack} aria-label={fr.menu.back}>
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M11 6l-6 6 6 6" />
        </svg>
      </button>
      <div>
        <div className="x-kicker">{kicker}</div>
        <h1>{title}</h1>
      </div>
      <img className="x-head-logo" src="/logo/badge-dark.png" alt="" />
    </header>
  )
}

/** skin d'un personnage : corps entier, ou buste pour les petites vignettes */
export function Skin({ id, bust, className }: { id: string; bust?: boolean; className?: string }) {
  return (
    <span className={`x-skin ${bust ? 'bust' : ''} ${className ?? ''}`}>
      <img src={`/skins/${id}.webp`} alt={fr.characters[id]?.species ?? ''} draggable={false} />
    </span>
  )
}

export function GearIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  )
}
