import { useEffect, useState } from 'react'
import { ACHIEVEMENTS, allAchievements, localAchievements } from '../../game/achievements'
import { fr } from '../../i18n/fr'
import { closePage, PageHead, Stage } from './Stage'

// Page Succès (maquette 08 « Carnet de mission »).

type Filter = 'all' | 'unlocked' | 'locked'

export function Achievements() {
  const P = fr.achPage
  const [have, setHave] = useState<string[]>(localAchievements())
  const [filter, setFilter] = useState<Filter>('all')
  useEffect(() => {
    allAchievements().then(setHave)
  }, [])
  const total = ACHIEVEMENTS.length
  const done = ACHIEVEMENTS.filter((a) => have.includes(a.code)).length
  const filters: [Filter, string, number][] = [
    ['all', P.all, total],
    ['unlocked', P.unlocked, done],
    ['locked', P.locked, total - done],
  ]
  const list = ACHIEVEMENTS.map((a, i) => ({ ...a, n: i + 1, on: have.includes(a.code) })).filter((a) => filter === 'all' || (filter === 'unlocked') === a.on)
  return (
    <Stage testId="achievements">
      <PageHead kicker={P.kicker} title={P.title} onBack={closePage} />
      <aside className="x-panel ac-side">
        <div className="x-kicker">{P.progress}</div>
        <div className="ac-count">
          <b>{done}</b> <span>/ {total}</span>
        </div>
        <div className="ac-label">{P.unlockedLabel}</div>
        <div className="ac-bar">
          {ACHIEVEMENTS.map((a, i) => (
            <i key={a.code} className={i < done ? 'on' : ''} />
          ))}
        </div>
        <nav className="ac-nav">
          {filters.map(([id, label, n], i) => (
            <button key={id} type="button" className={filter === id ? 'on' : ''} onClick={() => setFilter(id)}>
              <small>0{i + 1}</small>
              {label}
              <em>{n}</em>
            </button>
          ))}
        </nav>
        <div className="ac-tip">
          <div>{P.tipLabel}</div>
          {P.tip}
        </div>
      </aside>
      <section className="x-panel ac-main">
        <header>
          <h2>{filter === 'all' ? P.allTitle : filter === 'unlocked' ? P.unlockedTitle : P.lockedTitle}</h2>
          <span>{P.summary(total, done)}</span>
        </header>
        <div className="ac-grid">
          {list.map((a) => (
            <article key={a.code} className={`ac-card ${a.on ? 'on' : ''}`}>
              <span className="ac-ico">
                {a.on ? (
                  a.icon
                ) : (
                  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <rect x="5.5" y="10.5" width="13" height="10" rx="2.2" />
                    <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3M12 14.5v2" />
                  </svg>
                )}
              </span>
              <div>
                <small>
                  <i>{String(a.n).padStart(2, '0')}</i> {a.on ? P.stateUnlocked : P.stateLocked}
                </small>
                <b>{a.name}</b>
                <p>{a.desc}</p>
              </div>
            </article>
          ))}
        </div>
      </section>
    </Stage>
  )
}
