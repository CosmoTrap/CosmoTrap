import type { ItemId, ItemKind } from './types'

export const ITEM_KIND: Record<ItemId, ItemKind> = {
  o2: 'resource',
  battery: 'resource',
  water: 'resource',
  medkit: 'resource',
  lamp: 'key',
  badge: 'key',
  fuse: 'key',
  wrench: 'key',
  cell: 'key',
  rope: 'key',
  plank: 'key',
  carBattery: 'key',
  antenna: 'key',
  manual: 'key',
  flareGun: 'key',
  ration: 'survival',
  blanket: 'survival',
  multitool: 'survival',
  purifier: 'survival',
  tape: 'survival',
  compass: 'survival',
  whistle: 'survival',
  mirror: 'survival',
  lighter: 'survival',
  map: 'survival',
}

export const SURVIVAL_ITEMS = (Object.keys(ITEM_KIND) as ItemId[]).filter((k) => ITEM_KIND[k] === 'survival')

export function dotFor(item: ItemId) {
  const k = ITEM_KIND[item]
  return k === 'resource' ? 'res' : k === 'survival' ? 'surv' : 'key'
}
