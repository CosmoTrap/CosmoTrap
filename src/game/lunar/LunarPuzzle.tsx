import { useState } from 'react'
import { ability, diff, useGame } from '../state'
import { lunarDraft, setLunarDraft, submitLunar } from './logic'
import { BUS_TARGETS, CAPACITIES, FUEL, LOADS, ORDER_LABELS, ROUTE_BLOCKS, THERMAL, initialDraft, inspectCircuit, lunarNotes, pipePorts, roverPath, taskById, transfer, values } from './puzzles'
import './lunar.css'

function SolarCircuit({ rotations, turn }: { rotations: number[]; turn: (i: number, value: number) => void }) {
  const trace = inspectCircuit(rotations)
  return <>
    <p>Relie la borne d’entrée à gauche de la case 1 à la borne de sortie à droite de la case 16. Toutes les cases avec un câble doivent être raccordées. Les cases barrées sont inutilisées.</p>
    <div className="lunar-grid pipes solar-circuit">{rotations.map((rotation, i) => {
      const ports = pipePorts(i, rotation), powered = trace.connected.includes(i)
      return <button key={i} data-testid={`lunar-pipe-${i}`} disabled={!ports.length}
        className={`${!ports.length ? 'unused' : ''} ${powered ? 'powered' : ''} ${trace.fault === i ? 'broken-link' : ''}`}
        aria-label={ports.length ? `Segment ${i + 1}, orientation ${rotation}${powered ? ', alimenté' : ''}` : `Case ${i + 1} inutilisée`}
        onClick={() => turn(i, (rotation + 1) % 4)}>
        {i === 0 && <span className="circuit-terminal supply" aria-hidden="true">ENTRÉE →</span>}
        {i === 15 && <span className="circuit-terminal output" aria-hidden="true">→ SORTIE</span>}
        <svg viewBox="0 0 60 60" aria-hidden="true">{ports.length ? <><circle cx="30" cy="30" r="6" />{ports.map(d => <path key={d} d={`M30 30 L${[30,60,30,0][d]} ${[0,30,60,30][d]}`} />)}</> : <path d="M18 18L42 42M42 18L18 42" />}</svg>
        <small>{i + 1}</small>
      </button>
    })}</div>
    <p data-testid="lunar-circuit-status" role="status" className={trace.complete ? 'lunar-success' : ''}>
      {trace.complete ? 'Liaison complète : la sortie est alimentée. Tu peux vérifier le système.' : !trace.connected.length ? 'Entrée déconnectée : raccorde la case 1 à la borne de gauche.' : `Alimentation interrompue à la case ${trace.fault! + 1}. Vérifie ses raccords avec les cases voisines.`}
    </p>
  </>
}

export function LunarPuzzle() {
  const progress = useGame(s => s.lunar), notes = useGame(s => s.notes)
  const [feedback, setFeedback] = useState(''), [busy, setBusy] = useState(false)
  const id = progress.current!, task = taskById(id)
  if (!task) return null
  const a = lunarDraft(id), v = values(progress.seed), solved = progress.solved.includes(id)
  const update = (next: number[]) => { setFeedback(''); setLunarDraft(id, next) }
  const set = (i: number, value: number) => update(a.map((n, j) => j === i ? value : n))
  const note = lunarNotes(progress.seed)[task.note], hasNote = notes.includes(`ln_${task.note}`)
  const submit = () => {
    if (busy || solved) return
    setBusy(true)
    if (!submitLunar(id)) setFeedback(`Les contraintes ne sont pas toutes satisfaites. +${Math.round(20 * diff().penalty * ability().errorPenalty)} secondes de pénalité.`)
    setTimeout(() => setBusy(false), 700)
  }
  const counters = (max: number) => <div className="lunar-counters">{a.map((value, i) => <label key={i}>Commande {'ABC'[i]}
    <input data-testid={`lunar-value-${i}`} aria-label={`Commande ${'ABC'[i]}`} type="number" min="0" max={max} value={value} onChange={e => set(i, Math.max(0, Math.min(max, Number(e.target.value))))} />
  </label>)}</div>
  return <section className="panel lunar-puzzle" data-testid={`lunar-puzzle-${id}`}>
    <div className="lunar-eyebrow">SELENE-7 / {task.room.toUpperCase()} / {progress.solved.length} SUR 12</div>
    <h2>{task.name}</h2>
    <p>{task.hint}</p>
    {hasNote ? <details className="lunar-clue" open><summary>{note.title}</summary><p>{note.text}</p></details> : <p className="lunar-clue">Consigne à retrouver dans la base : <b>{note.title}</b>. Lis les plaques éclairées près des postes ; elles restent dans les messages.</p>}
    {solved && <p className="lunar-success">Système validé · résultat archivé. Tu peux le consulter sans le modifier.</p>}
    <fieldset disabled={solved}>
      {task.kind === 'code' && <label className="lunar-code">Autorisation à quatre chiffres<input data-testid="lunar-code" inputMode="numeric" autoComplete="off" maxLength={4} value={a.join('')} onChange={e => update(e.target.value.replace(/\D/g, '').slice(0, 4).split('').map(Number))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); submit() } }} /></label>}
      {task.kind === 'circuit' && <SolarCircuit rotations={a} turn={set} />}
      {task.kind === 'loads' && <><div className="lunar-readings">{BUS_TARGETS.map((n, b) => <span key={b}>Bus {'ABC'[b]}<b>{a.reduce((sum, bus, i) => sum + (bus === b ? LOADS[i] : 0), 0)} / {n}</b><small>{a.filter(x => x === b).length} / 2 équipements</small></span>)}</div><div className="lunar-loads">{LOADS.map((w, i) => <label key={i}>Équipement {i + 1} · {w} unités<select data-testid={`lunar-load-${i}`} value={a[i]} onChange={e => set(i, Number(e.target.value))}>{BUS_TARGETS.map((_, b) => <option key={b} value={b}>Bus {'ABC'[b]}</option>)}</select></label>)}</div></>}
      {(task.kind === 'thermal' || task.kind === 'fuel') && <><div className="lunar-readings">{(task.kind === 'thermal' ? THERMAL(a) : FUEL(a)).map((n, i) => <span key={i}>Compteur {i + 1}<b>{n} / {hasNote ? (task.kind === 'thermal' ? THERMAL(v.thermal) : FUEL(v.fuel))[i] : '?'}</b></span>)}</div>{counters(task.kind === 'thermal' ? 6 : 8)}</>}
      {task.kind === 'signal' && counters(9)}
      {task.kind === 'order' && <ol className="lunar-order">{a.map((value, i) => <li key={value}><span>{i + 1}. {ORDER_LABELS[id][value]}</span><button aria-label={`Monter ${ORDER_LABELS[id][value]}`} disabled={i === 0} data-testid={`lunar-up-${i}`} onClick={() => { const next = [...a]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; update(next) }}>↑</button><button aria-label={`Descendre ${ORDER_LABELS[id][value]}`} disabled={i === a.length - 1} onClick={() => { const next = [...a]; [next[i + 1], next[i]] = [next[i], next[i + 1]]; update(next) }}>↓</button></li>)}</ol>}
      {task.kind === 'pressure' && <><div className="lunar-readings">{a.map((n, i) => <span key={i}>Réservoir {'ABC'[i]}<b>{n} / {CAPACITIES[i]}</b><small>Cible : {[4, 4, 0][i]}</small></span>)}</div><div className="lunar-transfers">{a.flatMap((_, from) => a.map((__, to) => from === to ? null : <button key={`${from}-${to}`} data-testid={`lunar-transfer-${from}-${to}`} disabled={!a[from] || a[to] === CAPACITIES[to]} onClick={() => update(transfer(a, from, to))}>{'ABC'[from]} → {'ABC'[to]}</button>))}</div></>}
      {task.kind === 'route' && <><div className="lunar-grid rover">{Array.from({ length: 25 }, (_, i) => <div key={i} className={`${ROUTE_BLOCKS.includes(i) ? 'blocked' : ''} ${roverPath(a).path.includes(i) ? 'visited' : ''}`}>{i === 20 ? 'DÉPART' : i === 4 ? 'FUSÉE' : i === 12 ? 'R1' : i === 2 ? 'R2' : ROUTE_BLOCKS.includes(i) ? '×' : '·'}</div>)}</div><div className="lunar-transfers">{['↑ N', '→ E', '↓ S', '← O'].map((label, d) => <button key={d} data-testid={`lunar-command-${d}`} disabled={a.length >= 12} onClick={() => update([...a, d])}>{label}</button>)}<button onClick={() => update(a.slice(0, -1))}>Annuler</button></div><p data-testid="lunar-program">{a.map(d => '↑→↓←'[d]).join(' ')} · {a.length} / 12 déplacements</p>{!roverPath(a).valid && <p className="lunar-error">La simulation rencontre un obstacle.</p>}</>}
    </fieldset>
    <p className="lunar-error" role="status">{feedback}</p>
    <div className="lunar-actions"><button className="btn ghost" disabled={solved} onClick={() => update(initialDraft(id, progress.seed))}>Réinitialiser ce poste</button><button className="btn" data-testid="lunar-submit" disabled={solved || busy} onClick={submit}>{solved ? 'Validé' : 'Vérifier le système'}</button></div>
  </section>
}
