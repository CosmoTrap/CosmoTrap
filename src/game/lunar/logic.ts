import { fr } from '../../i18n/fr'
import { audio } from '../audio/audio'
import { G, ability, diff, addNote, clearSave, has, live, recordMessage, saveGame, toast, useGame } from '../state'
import { TASKS, available, done, initialDraft, lunarNotes, taskById, validAnswer } from './puzzles'
import { lunarGate } from './map'

export const missionNote = (id: string) => id.startsWith('ln_') ? lunarNotes(G().lunar.seed)[id.slice(3)] : fr.notes[id]
export const missionPuzzles = () => G().map === 'base' ? TASKS.map(t => ({ id: `l_${t.id}`, zone: 1, name: t.name, domain: 'Exploration · systèmes lunaires' })) : fr.puzzleList
export function lunarLabel(id: string) {
  if (id.startsWith('ln_')) return `Lire · ${missionNote(id)?.title ?? 'Consigne'}`
  const task = taskById(id.slice(2))
  return task ? `${done(G().lunar, task.id) ? 'Consulter' : 'Utiliser'} · ${task.name}` : null
}
export function lunarAct(id: string) {
  if (id.startsWith('ln_')) { addNote(id); useGame.setState({ readNote: id }); audio.sfx('page'); return true }
  const task = taskById(id.slice(2)), s = G()
  if (!task) return false
  if (!lunarGate(task.room, s.lunar.solved) && task.id !== 'manifest' || !available(s.lunar, task.id)) {
    toast(`Prérequis : ${task.needs.map(k => taskById(k)?.name).join(' · ') || 'ouvrir le coffre de relève'}`, 'bad'); return false
  }
  if (task.item && !has(task.item)) { toast(`Il manque : ${fr.items[task.item].name}. Consulte les consignes et fouille les modules accessibles.`, 'bad'); return false }
  useGame.setState({ lunar: { ...s.lunar, current: task.id }, puzzle: 'lunar', tabletOpen: false })
  document.exitPointerLock?.()
  return true
}
export function lunarDraft(id: string) { return G().lunar.drafts[id] ?? initialDraft(id, G().lunar.seed) }
export function setLunarDraft(id: string, draft: number[]) {
  if (!taskById(id) || done(G().lunar, id)) return
  useGame.setState(s => ({ lunar: { ...s.lunar, drafts: { ...s.lunar.drafts, [id]: draft } } }))
}
export function submitLunar(id: string) {
  const s = G(), task = taskById(id)
  if (s.map !== 'base' || !task || s.lunar.current !== id || !available(s.lunar, id) || task.item && !has(task.item)) return false
  if (done(s.lunar, id)) return true
  if (!validAnswer(id, lunarDraft(id), s.lunar.seed)) {
    const penalty = Math.round(20 * diff().penalty * ability().errorPenalty)
    useGame.setState({ errors: s.errors + 1, penalty: s.penalty + penalty })
    live.penaltyFlash = 1
    toast(`Vérification refusée · +${penalty} s. Relis les contraintes ; aucun progrès perdu.`, 'bad'); audio.sfx('error'); return false
  }
  const draft = lunarDraft(id)
  useGame.setState({ lunar: { ...s.lunar, solved: [...s.lunar.solved, id], drafts: { ...s.lunar.drafts, [id]: draft } },
    splits: { ...s.splits, [`l_${id}`]: s.playTime + s.penalty }, puzzle: null })
  const summary = ['manifest', 'thermal', 'signal', 'pressure'].includes(id) ? ` Résultat archivé : ${draft.join(' / ')}.` : ''
  recordMessage(`${task.name} : validé.${summary}`, 'system')
  live.banner = { title: 'Système rétabli', sub: task.name, t: performance.now() }
  audio.sting('solved')
  saveGame()
  if (id === 'launch' && TASKS.every(t => done(G().lunar, t.id))) {
    useGame.setState({ cine: 'lunarLaunch', cineT0: performance.now(), tabletOpen: false })
  }
  return true
}
export function finishLunar() {
  if (G().map !== 'base' || !TASKS.every(t => done(G().lunar, t.id))) return false
  audio.stopAllLoops(); audio.stopSpeech(); audio.oneShotMusic('victory')
  live.camOverride = null; live.fade = 0; live.flash = 0; live.countdown = null
  live.card = null; live.banner = null; live.penaltyFlash = 0
  clearSave()
  useGame.setState({ cine: null, ended: true, ending: 'rescue', screen: 'end', paused: false, subtitle: null })
  return true
}
export function lunarSteps() {
  const p = G().lunar
  return [...TASKS.map(task => ({ id: task.id, text: task.name, hint: task.hint,
    status: (done(p, task.id) ? 'done' : available(p, task.id) ? 'current' : 'todo') as 'done' | 'current' | 'todo' })),
    { id: 'leave', text: 'Décoller et quitter Séléné-7', hint: 'Rejoins le calculateur de la fusée à l’extérieur du sas.', status: (G().ended ? 'done' : done(p, 'fuel') ? 'current' : 'todo') as 'done' | 'current' | 'todo' }]
}
