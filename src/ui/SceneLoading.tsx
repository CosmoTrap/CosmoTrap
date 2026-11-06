import { useGame } from '../game/state'
import { fr } from '../i18n/fr'
import './scene-loading.css'

export function SceneLoading() {
  const loading = useGame((s) => s.loading)
  const progress = useGame((s) => s.loadProgress)
  const zone = useGame((s) => s.zone)
  const map = useGame((s) => s.map)
  if (loading === 1) return null
  const pct = Math.max(0, Math.min(100, Math.round(progress)))
  return <div className="scene-loading" data-testid="scene-loading" role="status" aria-live="polite" aria-busy="true">
    <div className="scene-loading-mark" aria-hidden="true"><i /></div>
    <small>COSMOTRAP · {String(zone).padStart(2, '0')}</small>
    <h2>{map === 'base' ? 'Séléné-7 · Base lunaire' : fr.zones[zone].name}</h2>
    <p>{fr.menu.loadingSlow}</p>
    <div className="scene-loading-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={fr.menu.loading}>
      <i style={{ width: `${pct}%` }} />
    </div>
    <strong data-testid="scene-loading-progress">{fr.menu.loadingProgress(pct)}</strong>
    <span>La mission reprend dès que la scène est prête.</span>
  </div>
}
