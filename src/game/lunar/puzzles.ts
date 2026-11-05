/** Pure mission rules: shared by terminals, saves and the exhaustive solver tests. */
export type LunarKind = 'code' | 'circuit' | 'loads' | 'thermal' | 'order' | 'signal' | 'pressure' | 'route' | 'fuel'
export interface LunarProgress { seed: number; solved: string[]; drafts: Record<string, number[]>; current: string | null }
export const newLunarProgress = (seed = Math.floor(Math.random() * 1000000)): LunarProgress => ({ seed, solved: [], drafts: {}, current: null })
export const TASKS = [
  { id: 'manifest', room: 'habitat', name: 'Le coffre de relève', kind: 'code', needs: [], item: null, note: 'relief', hint: 'Le manifeste de la chambre classe les quatre cratères par altitude, du plus bas au plus haut.', minutes: 1.5 },
  { id: 'circuit', room: 'power', name: 'La liaison solaire', kind: 'circuit', needs: ['manifest'], item: 'fuse', note: 'solar', hint: 'Installe le fusible de la chambre. Tourne les coudes pour joindre les deux bornes sans laisser de branche ouverte.', minutes: 2 },
  { id: 'loads', room: 'power', name: 'Les trois bus électriques', kind: 'loads', needs: ['circuit'], item: null, note: 'solar', hint: 'Chaque bus reçoit exactement deux équipements. Cherche d’abord les paires dont la somme atteint sa capacité.', minutes: 1.5 },
  { id: 'thermal', room: 'power', name: 'Les échangeurs couplés', kind: 'thermal', needs: ['loads'], item: null, note: 'thermal', hint: 'La fiche de maintenance de la sécurité indique les trois températures cibles. Chaque commande agit sur deux échangeurs.', minutes: 1.5 },
  { id: 'identity', room: 'security', name: 'Les habilitations croisées', kind: 'order', needs: ['loads'], item: null, note: 'crew', hint: 'Recoupe les contraintes du registre : les quatre techniciens occupent chacun un créneau différent.', minutes: 1.5 },
  { id: 'signal', room: 'security', name: 'La triangulation radio', kind: 'signal', needs: ['identity'], item: 'antenna', note: 'radio', hint: 'Les trois sommes du relevé radio permettent de retrouver chaque canal : additionne deux sommes et soustrais la troisième.', minutes: 1.5 },
  { id: 'filters', room: 'eva', name: 'La chaîne de filtration', kind: 'order', needs: ['signal'], item: null, note: 'filters', hint: 'Reconstitue le trajet de l’air depuis la grille. Les contraintes de voisinage comptent autant que l’ordre général.', minutes: 1 },
  { id: 'pressure', room: 'eva', name: 'Les réservoirs de pression', kind: 'pressure', needs: ['filters'], item: 'wrench', note: 'pressure', hint: 'Le transfert s’arrête seulement quand la source est vide ou la destination pleine. Utilise le petit réservoir pour mesurer.', minutes: 2.5 },
  { id: 'checklist', room: 'eva', name: 'La certification EVA', kind: 'order', needs: ['pressure', 'thermal'], item: null, note: 'eva', hint: 'Les dépendances du protocole imposent un ordre précis. Le test ne peut précéder la mise en route de la pompe.', minutes: 1 },
  { id: 'route', room: 'airlock', name: 'Le trajet du rover ravitailleur', kind: 'route', needs: ['checklist'], item: null, note: 'route', hint: 'Programme les déplacements du rover en passant par les deux relais avant d’atteindre la fusée.', minutes: 1.5 },
  { id: 'fuel', room: 'airlock', name: 'Le calcul des cartouches', kind: 'fuel', needs: ['route'], item: 'cell', note: 'fuel', hint: 'Les trois compteurs utilisent les mêmes cartouches. Résous les trois contraintes ensemble, pas séparément.', minutes: 1.5 },
  { id: 'launch', room: 'rocket', name: 'L’autorisation de décollage', kind: 'code', needs: ['fuel'], item: null, note: 'departure', hint: 'Rassemble les résultats archivés de la relève, du réglage thermique et de la radio. Le protocole de départ donne leur ordre.', minutes: 1 },
] as const
export type LunarTaskId = typeof TASKS[number]['id']
export const taskById = (id: string) => TASKS.find(t => t.id === id)
export function strongHint(id: string, seed: number) {
  const v = values(seed)
  const hints: Record<string, string> = {
    manifest: 'Classe les caisses : Shackleton, Copernic, Tycho, Kepler. Lis ensuite leurs chiffres sur le manifeste.',
    circuit: 'Un trajet possible, de case en case : 1 → 2 → 6 → 5 → 9 → 10 → 11 → 7 → 8 → 12 → 16. Tourne les segments pour raccorder chaque voisin.',
    loads: 'Une répartition possible : A reçoit 2 + 7, B reçoit 4 + 6, C reçoit 3 + 5 unités.',
    thermal: `La commande A vaut ${v.thermal[0]}. Déduis C avec la lecture III, puis B avec la lecture II. Vérifie ensuite la lecture I.`,
    identity: 'Maya passe la première. Inès doit suivre Sam immédiatement ; Kenji occupe donc le deuxième créneau.',
    signal: 'A = ((A+B) + (A+C) − (B+C)) / 2. Soustrais ensuite A des deux sommes où il apparaît.',
    filters: 'L’air suit Grille → Cyclone → Ioniseur → Tamis → Carbone.',
    pressure: 'Depuis la remise à zéro : A→B, B→C, C→A, B→C, A→B, B→C, C→A. Chaque transfert doit aller jusqu’à sa butée.',
    checklist: 'Balise → Clapet → Pompe → Test → Visière → Purge. N’oublie pas le banc thermique de la centrale.',
    route: 'Depuis le départ, un trajet passe par E, N, N, E, N, N, E, E. Il visite les deux relais sans toucher les cases hachurées.',
    fuel: `La cartouche C vaut ${v.fuel[2]}. Utilise le compteur II pour trouver B, puis le compteur III pour A. Vérifie le compteur I.`,
    launch: 'Ouvre Messages dans la tablette : troisième chiffre du coffre, commande C du thermique, canal B de la radio, puis 4 unités dans le réservoir A.',
  }
  return hints[id] ?? taskById(id)?.hint ?? null
}
export const done = (p: LunarProgress, id: string) => p.solved.includes(id)
export const available = (p: LunarProgress, id: string) => !!taskById(id)?.needs.every(k => done(p, k))
export function values(seed: number) {
  const n = Math.abs(Math.floor(seed))
  return { digits: [2 + n % 7, 1 + Math.floor(n / 7) % 8, 1 + Math.floor(n / 53) % 8, 2 + Math.floor(n / 173) % 7],
    thermal: [2 + n % 3, 1 + Math.floor(n / 3) % 4, 2 + Math.floor(n / 13) % 3],
    signal: [2 + n % 5, 2 + Math.floor(n / 5) % 5, 2 + Math.floor(n / 29) % 5],
    fuel: [1 + n % 4, 2 + Math.floor(n / 4) % 3, 1 + Math.floor(n / 17) % 4] }
}
export const CIRCUIT_PATH = [0, 1, 5, 4, 8, 9, 10, 6, 7, 11, 15]
export function pipePorts(cell: number, rotation: number) {
  const at = CIRCUIT_PATH.indexOf(cell)
  if (at < 0) return [] // Unused sockets are blank, never misleading loose wires.
  const direction = (from: number, to: number) => to === from - 4 ? 0 : to === from + 1 ? 1 : to === from + 4 ? 2 : 3
  const ports = [at === 0 ? 3 : direction(cell, CIRCUIT_PATH[at - 1]), at === CIRCUIT_PATH.length - 1 ? 1 : direction(cell, CIRCUIT_PATH[at + 1])]
  return ports.map(d => (d + rotation) % 4)
}
/** Trace the actual connections from the supply, stopping at the first break. */
export function inspectCircuit(rotations: number[]) {
  const connected: number[] = []
  const fail = (fault: number) => ({ connected, fault, complete: false })
  if (rotations.length !== 16 || rotations.some(n => !Number.isInteger(n) || n < 0 || n > 3)) return fail(0)
  if (!pipePorts(0, rotations[0]).includes(3)) return fail(0)
  const seen = new Set<number>(), todo = [0]
  while (todo.length) {
    const cell = todo.pop()!
    if (seen.has(cell)) continue
    seen.add(cell); connected.push(cell)
    for (const d of pipePorts(cell, rotations[cell])) {
      if (cell === 0 && d === 3 || cell === 15 && d === 1) continue
      const next = cell + [-4, 1, 4, -1][d]
      if (next < 0 || next > 15 || d === 1 && cell % 4 === 3 || d === 3 && cell % 4 === 0 || !pipePorts(next, rotations[next]).includes((d + 2) % 4)) return fail(cell)
      todo.push(next)
    }
  }
  return { connected, fault: null, complete: seen.has(15) && seen.size === CIRCUIT_PATH.length && pipePorts(15, rotations[15]).includes(1) }
}
export const LOADS = [2, 3, 4, 5, 6, 7]
export const BUS_TARGETS = [9, 10, 8]
export const ORDER_LABELS: Record<string, string[]> = {
  identity: ['Maya', 'Kenji', 'Sam', 'Inès'],
  filters: ['Grille', 'Cyclone', 'Ioniseur', 'Tamis', 'Carbone'],
  checklist: ['Balise', 'Clapet', 'Pompe', 'Test', 'Visière', 'Purge'],
}
export const THERMAL = (a: number[]) => [a[0] + 2 * a[1], a[1] + 2 * a[2], a[2] + 2 * a[0]]
export const FUEL = (a: number[]) => [a[0] + 2 * a[1] + a[2], a[1] + 3 * a[2], 2 * a[0] + a[1]]
export const CAPACITIES = [8, 5, 3]
export function transfer(a: number[], from: number, to: number) {
  if (a.length !== 3 || from === to || !CAPACITIES[from] || !CAPACITIES[to]) return a
  const next = [...a], amount = Math.min(next[from], CAPACITIES[to] - next[to])
  next[from] -= amount; next[to] += amount
  return next
}
export const ROUTE_BLOCKS = [6, 8, 13, 15, 17, 18, 22]
export function roverPath(commands: number[]) {
  let cell = 20; const path = [cell]
  for (const d of commands) {
    const x = cell % 5, z = Math.floor(cell / 5)
    const nx = x + (d === 1 ? 1 : d === 3 ? -1 : 0), nz = z + (d === 2 ? 1 : d === 0 ? -1 : 0)
    const next = nz * 5 + nx
    if (nx < 0 || nx > 4 || nz < 0 || nz > 4 || ROUTE_BLOCKS.includes(next)) return { path, valid: false }
    cell = next; path.push(cell)
  }
  return { path, valid: true }
}
export function initialDraft(id: string, seed: number): number[] {
  const task = taskById(id)
  if (task?.kind === 'circuit') return Array.from({ length: 16 }, (_, i) => 1 + (seed + i * 7) % 3)
  if (task?.kind === 'loads') return [0, 0, 0, 0, 0, 0]
  if (task?.kind === 'order') return ORDER_LABELS[id].map((_, i, a) => (i + 1 + seed % (a.length - 1)) % a.length)
  if (task?.kind === 'pressure') return [8, 0, 0]
  if (['thermal', 'signal', 'fuel'].includes(task?.kind ?? '')) return [0, 0, 0]
  return []
}
const equal = (a: number[], b: number[]) => a.length === b.length && a.every((v, i) => v === b[i])
export function validAnswer(id: string, a: number[], seed: number) {
  if (!a.every(n => Number.isInteger(n) && n >= 0 && n <= 9)) return false
  const v = values(seed)
  switch (id) {
    case 'manifest': return equal(a, v.digits)
    case 'launch': return equal(a, [v.digits[2], v.thermal[2], v.signal[1], 4])
    case 'thermal': return a.length === 3 && a.every(n => n <= 6) && equal(THERMAL(a), THERMAL(v.thermal))
    case 'signal': return equal(a, v.signal)
    case 'fuel': return a.length === 3 && a.every(n => n <= 8) && equal(FUEL(a), FUEL(v.fuel))
    case 'pressure': return equal(a, [4, 4, 0])
    case 'identity': case 'filters': case 'checklist': return equal(a, ORDER_LABELS[id].map((_, i) => i))
    case 'loads': return a.length === 6 && a.every(n => n < 3) && BUS_TARGETS.every((target, bus) => a.filter(n => n === bus).length === 2 && a.reduce((sum, b, i) => sum + (b === bus ? LOADS[i] : 0), 0) === target)
    case 'route': { const r = roverPath(a); return a.every(d => d < 4) && a.length <= 12 && r.valid && r.path.at(-1) === 4 && r.path.includes(12) && r.path.includes(2) }
    case 'circuit': return inspectCircuit(a).complete
  }
  return false
}

export function lunarNotes(seed: number): Record<string, { title: string; text: string }> {
  const v = values(seed), t = THERMAL(v.thermal), f = FUEL(v.fuel), s = v.signal
  return {
    relief: { title: 'Relève · manifeste des cratères', text: `Quatre caisses portent un chiffre et une altitude : Tycho, +1200 m, ${v.digits[2]} ; Shackleton, −900 m, ${v.digits[0]} ; Kepler, +2100 m, ${v.digits[3]} ; Copernic, +300 m, ${v.digits[1]}. Le coffre attend les chiffres dans l’ordre des altitudes CROISSANTES, sans les noms. Archivez le résultat : il sera utile au départ.` },
    solar: { title: 'Centrale · schéma de secours', text: 'Le fusible de relève est dans la chambre. Tourner les segments pour relier l’entrée gauche en haut à la sortie droite en bas. Tous les câbles doivent être raccordés ; les cases barrées sont inutilisées. Ensuite : deux équipements par bus ; capacités A = 9, B = 10, C = 8. Aucun équipement ne peut être abandonné.' },
    thermal: { title: 'Maintenance · échangeurs couplés', text: `Le banc thermique de la centrale doit afficher ${t.join(' / ')}. Avec les trois commandes A, B, C : lecture I = A + 2B ; lecture II = B + 2C ; lecture III = C + 2A. Les commandes vont de 0 à 6. Consigner C pour le départ.` },
    crew: { title: 'Sécurité · registre de relève', text: 'Les quatre créneaux vont de 1 à 4. Maya n’est ni au troisième ni au quatrième. Inès intervient juste après Sam. Kenji est après Maya et avant Inès. Sam n’est pas au deuxième créneau. Chaque nom apparaît une seule fois.' },
    radio: { title: 'Radio · relevé des balises', text: `Les canaux entiers A, B, C vont de 0 à 9. La station mesure A + B = ${s[0] + s[1]}, B + C = ${s[1] + s[2]}, A + C = ${s[0] + s[2]}. Installer l’antenne avant l’étalonnage. Consigner la valeur B pour l’autorisation finale.` },
    filters: { title: 'EVA · chaîne de filtration', text: 'De l’entrée vers la sortie : le Carbone termine le circuit. Le Tamis suit immédiatement l’Ioniseur. Le Cyclone vient après la Grille, mais avant l’Ioniseur. Aucun étage ne doit être contourné.' },
    pressure: { title: 'EVA · banc de transfert', text: 'Trois réservoirs de capacités 8, 5 et 3 unités. Départ : 8 / 0 / 0. Objectif : 4 / 4 / 0. Un transfert se poursuit jusqu’à vider la source ou remplir la destination. Impossible de jeter du gaz : le total reste 8. La clé de maintenance de la chambre est requise.' },
    eva: { title: 'EVA · protocole de certification', text: 'Activer la Balise avant d’ouvrir le Clapet. La Pompe vient après le Clapet. Le Test vient après la Pompe et avant la fermeture de la Visière. La Purge est la dernière opération. Les échangeurs thermiques doivent aussi être réglés avant de certifier la combinaison.' },
    route: { title: 'Sas · ravitaillement autonome', text: 'Le rover part de la case inférieure gauche. Atteindre la fusée en haut à droite en passant par les relais R1 et R2. Les cases hachurées sont impraticables. Programmer au maximum 12 déplacements cardinaux. Le trajet est simulé avant son exécution.' },
    fuel: { title: 'Sas · calculateur de cartouches', text: `Cartouches scellées A, B, C, de 0 à 8 chacune. Les trois compteurs doivent atteindre ${f.join(' / ')}. Compteur I = A + 2B + C ; II = B + 3C ; III = 2A + B. Apporter la cellule d’énergie de la centrale pour alimenter le transfert vers LV-1.` },
    departure: { title: 'Départ · autorisation à quatre chiffres', text: 'La fusée vérifie quatre résultats, dans cet ordre : le TROISIÈME chiffre du coffre de relève ; la commande C du banc thermique ; le canal B de la radio ; la quantité finale du réservoir A. Les résultats validés restent consultables sur leurs terminaux et dans les transmissions. Le sas ne s’ouvre qu’après le ravitaillement et la certification EVA.' },
  }
}
