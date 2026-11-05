/** Lights Out 3×3 : un appui inverse la case et ses voisines orthogonales. */
export function pressValveGrid(v: boolean[], r: number, c: number) {
  const flip = (rr: number, cc: number) => {
    if (rr < 0 || rr > 2 || cc < 0 || cc > 2) return
    v[rr * 3 + cc] = !v[rr * 3 + cc]
  }
  flip(r, c)
  flip(r - 1, c)
  flip(r + 1, c)
  flip(r, c - 1)
  flip(r, c + 1)
}

/** Plus courte série d'appuis (indices 0–8) qui met les neuf vannes au vert. Vide si déjà résolu. */
export function solveValves(v: boolean[]): number[] {
  let best: number[] | null = null
  for (let m = 0; m < 512; m++) {
    const picked: number[] = []
    for (let k = 0; k < 9; k++) if (m & (1 << k)) picked.push(k)
    if (best && picked.length >= best.length) continue
    const t = [...v]
    for (const k of picked) pressValveGrid(t, Math.floor(k / 3), k % 3)
    if (t.every(Boolean)) best = picked
  }
  return best ?? []
}

/**
 * Départ aléatoire, toujours soluble : on part du tout-vert et on applique des appuis.
 * On refuse les grilles trop courtes ou trop longues (solution minimale hors de 4 à 7 appuis).
 */
export function initialValves(): boolean[] {
  for (let n = 0; n < 200; n++) {
    const v = Array(9).fill(true)
    for (let k = 0; k < 9; k++) if (Math.random() < 0.5) pressValveGrid(v, Math.floor(k / 3), k % 3)
    const sol = solveValves(v)
    if (sol.length >= 4 && sol.length <= 7) return v
  }
  const v = Array(9).fill(true)
  for (const k of [0, 2, 4, 6, 8]) pressValveGrid(v, Math.floor(k / 3), k % 3)
  return v
}

export function valveHint(v: boolean[]): string {
  const sol = solveValves(v)
  if (!sol.length) return 'Toutes les vannes sont déjà au vert.'
  const where = sol.map((i) => `ligne ${Math.floor(i / 3) + 1}, colonne ${(i % 3) + 1}`)
  return `Appuie une fois sur : ${where.join(' · ')}.`
}
