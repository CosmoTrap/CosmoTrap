import { useGame } from '../game/state'
import { fr } from '../i18n/fr'
import './scene-loading.css'

export function SceneLoading() {
  const loading = useGame((s) => s.loading)
  const zone = useGame((s) => s.zone)
  if (loading === 1) return null
  return <div className="scene-loading" data-testid="scene-loading" role="status" aria-live="polite" aria-busy="true">
    <div className="scene-loading-mark" aria-hidden="true"><i /></div>
    <small>COSMOTRAP · {String(zone).padStart(2, '0')}</small>
    <h2>{useGame.getState().map === 'base' ? 'Séléné-7 · Base lunaire' : fr.zones[zone].name}</h2>
    <p>Préparation de l’environnement…</p>
    <div className="scene-loading-track" aria-hidden="true"><i /></div>
    <span>La mission reprend dès que la scène est prête.</span>
  </div>
}
