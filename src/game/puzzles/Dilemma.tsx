import { fr } from '../../i18n/fr'
import { choose } from '../logic'

// Embranchement narratif (zone 3) : garder ou larguer les échantillons du labo.
export function Dilemma() {
  return (
    <div className="panel" style={{ width: 'min(560px, 94vw)' }} data-testid="dilemma">
      <h2>{fr.dilemma.title}</h2>
      <p className="sub" style={{ whiteSpace: 'pre-line', color: 'var(--cream)', fontSize: 15, lineHeight: 1.6 }}>
        {fr.dilemma.text}
      </p>
      <div className="radio-btns">
        <button className="btn primary" data-testid="choice-keep" onClick={() => choose('keep')}>
          {fr.dilemma.keep}
        </button>
        <button className="btn" data-testid="choice-drop" onClick={() => choose('drop')}>
          {fr.dilemma.drop}
        </button>
      </div>
    </div>
  )
}
