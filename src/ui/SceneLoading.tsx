import { useGame } from '../game/state'
import { fr } from '../i18n/fr'
import './scene-loading.css'

export function SceneLoading() {
  const loading = useGame((s) => s.loading)
  const zone = useGame((s) => s.zone)
  const lang = useGame((s) => s.settings.lang)
  if (loading === 1) return null
  return <div className="scene-loading" data-testid="scene-loading" role="status" aria-live="polite" aria-busy="true">
    <div className="scene-loading-mark" aria-hidden="true"><i /></div>
    <small>COSMOTRAP · {String(zone).padStart(2, '0')}</small>
    <h2>{fr.zones[zone].name}</h2>
    <p>{lang === 'en' ? 'Preparing your surroundings…' : 'Préparation de l’environnement…'}</p>
    <div className="scene-loading-track" aria-hidden="true"><i /></div>
    <span>{lang === 'en' ? 'Your mission resumes as soon as the scene is ready.' : 'La mission reprend dès que la scène est prête.'}</span>
  </div>
}
