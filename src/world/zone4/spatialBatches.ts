/** Spatial batches allow Three to cull offscreen vegetation, including separately
 * for the shadow camera. Every instance keeps its world transform and detail. */
export function spatialBatches<T extends { x: number; z: number }>(items: readonly T[], size = 24): T[][] {
  const cells = new Map<string, T[]>()
  for (const item of items) {
    const key = `${Math.floor(item.x / size)},${Math.floor(item.z / size)}`
    const cell = cells.get(key) ?? []
    cell.push(item)
    cells.set(key, cell)
  }
  return [...cells.values()]
}
