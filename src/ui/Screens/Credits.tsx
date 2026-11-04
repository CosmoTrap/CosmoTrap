import { fr } from '../../i18n/fr'
import { closePage, PageHead, Skin, Stage } from './Stage'

// Page Crédits (maquette 07 « Journal de bord »).

const TEAM = ['Clément', 'Simon', 'Kilian', 'Hamza', 'Ethan', 'Loïc']
const CREW = ['leo', 'nova', 'kenji', 'ines', 'sam', 'maya']

export function Credits() {
  const P = fr.creditsPage
  return (
    <Stage testId="credits">
      <PageHead kicker={P.kicker} title={P.title} onBack={closePage} />
      <aside className="x-panel cr-team">
        <div className="x-kicker">{P.teamKicker}</div>
        <h2>{P.team}</h2>
        <p>{P.teamSub}</p>
        <ol>
          {TEAM.map((n, i) => (
            <li key={n}>
              <small>0{i + 1}</small>
              <span className="x-avatar me">{n.slice(0, 2).toUpperCase()}</span>
              {n}
            </li>
          ))}
        </ol>
        <div className="cr-foot">
          <i />
          {P.foot}
        </div>
      </aside>
      <section className="x-panel cr-sheet">
        <h2>{P.sheet}</h2>
        {P.rows.map((r, i) => (
          <div key={r.kicker} className={`cr-row r${i + 1}`}>
            <div className="cr-line">
              <div>
                <div className="x-kicker">
                  <i>0{i + 1}</i> {r.kicker}
                </div>
                <b>{r.title}</b>
              </div>
              {i === 3 ? (
                <span className="cr-crew">{P.crew}</span>
              ) : (
                <div className="cr-tags">
                  {i === 4 && <em>{P.upcoming}</em>}
                  {r.tags.map((t) => (
                    <span key={t} className={i === 0 ? 'hot' : ''}>
                      {t}
                    </span>
                  ))}
                </div>
              )}
            </div>
            {i === 3 && (
              <div className="cr-cards">
                {CREW.map((id, n) => (
                  <div key={id} className="cr-card" title={`${fr.characters[id].ability} — ${fr.characters[id].abilityDesc}`}>
                    <div className="cr-card-art">
                      <small>0{n + 1}</small>
                      <Skin id={id} bust />
                    </div>
                    <b>{fr.characters[id].name}</b>
                    <small>{fr.characters[id].ability}</small>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </section>
    </Stage>
  )
}
