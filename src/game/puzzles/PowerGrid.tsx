import { fr } from '../../i18n/fr'
import { POWER_SYSTEMS, togglePower } from '../logic'
import { useGame } from '../state'

// Énigme stratégique (zone 2) : 3 unités pour 4 systèmes.
export function PowerGrid() {
  const T = fr.puzzles.power
  const flags = useGame((s) => s.flags)
  const used = POWER_SYSTEMS.filter((k) => flags[k]).length
  return (
    <div className="panel" style={{ width: 'min(520px, 92vw)' }} data-testid="power">
      <h2>{T.title}</h2>
      <p className="sub">{T.sub}</p>
      <div className="units">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`unit ${i < used ? 'used' : ''}`} />
        ))}
        <span style={{ marginLeft: 8, fontFamily: 'JetBrains Mono', fontSize: 13 }}>{T.units(used)}</span>
      </div>
      {POWER_SYSTEMS.map((k) => (
        <div key={k} className="power-row">
          <div>
            {T.systems[k]}
            {(k === 'pw_sas' || k === 'pw_terminal') && <small>{T.required}</small>}
            {k === 'pw_lights' && <small style={{ color: '#7fe3ff' }}>sinon ta lampe se vide</small>}
            {k === 'pw_o2' && <small style={{ color: '#7fe3ff' }}>sinon ton oxygène baisse</small>}
          </div>
          <button data-testid={`power-${k}`} className={`switch ${flags[k] ? 'on' : ''}`} onClick={() => togglePower(k)} aria-pressed={flags[k]} />
        </div>
      ))}
    </div>
  )
}
