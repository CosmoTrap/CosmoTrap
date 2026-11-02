import { fr } from '../../i18n/fr'
import { pressPlan } from '../logic'
import { useGame } from '../state'

// Énigme de gestion de projet (zone 3) : ordonnancer les opérations pré-vol selon leurs dépendances.
export function Plan() {
  const plan = useGame((s) => s.plan)
  const tasks = fr.plan.tasks
  return (
    <div className="panel" style={{ width: 'min(680px, 94vw)' }} data-testid="plan">
      <h2>{fr.plan.title}</h2>
      <p className="sub">{fr.plan.sub}</p>
      <div className="plan-grid">
        {Object.entries(tasks).map(([id, t]) => {
          const done = plan.includes(id)
          return (
            <button key={id} data-testid={`plan-${id}`} className={`plan-task ${done ? 'done' : ''}`} onClick={() => pressPlan(id)} disabled={done}>
              <b>{done ? `${plan.indexOf(id) + 1}. ` : ''}{t.name}</b>
              <small>
                {fr.plan.needs} : {t.dep.length ? t.dep.map((d) => tasks[d].name).join(' + ') : 'aucun'}
              </small>
            </button>
          )
        })}
      </div>
      <div className="seq-dots">
        {Object.keys(tasks).map((_, i) => (
          <i key={i} style={{ background: i < plan.length ? '#4fe39a' : 'transparent' }} />
        ))}
      </div>
    </div>
  )
}
