/** Mélange de Fisher–Yates. `tooEasy` refuse les ordres trop lisibles (identité, solution déjà rangée). */
export function shuffle<T>(items: T[], tooEasy?: (order: T[]) => boolean): T[] {
  const a = [...items]
  for (let tries = 0; tries < 50; tries++) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    if (!tooEasy || !tooEasy(a)) break
  }
  return a
}
