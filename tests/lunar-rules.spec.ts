import { expect, test } from '@playwright/test'
import { BUS_TARGETS, FUEL, LOADS, ORDER_LABELS, TASKS, THERMAL, available, initialDraft, lunarNotes, newLunarProgress, roverPath, transfer, validAnswer, values } from '../src/game/lunar/puzzles'
import { HUB, MODULES, inModule, localPoint, lunarGate, lunarMap, lunarRoomAt } from '../src/game/lunar/map'

export function pressureSolution() {
  const queue = [{ a: [8, 0, 0], moves: [] as number[][] }], seen = new Set(['8,0,0'])
  while (queue.length) {
    const { a, moves } = queue.shift()!
    if (a.join() === '4,4,0') return moves
    for (let from = 0; from < 3; from++) for (let to = 0; to < 3; to++) {
      const b = transfer(a, from, to), key = b.join()
      if (!seen.has(key)) { seen.add(key); queue.push({ a: b, moves: [...moves, [from, to]] }) }
    }
  }
  throw Error('Banc de pression insoluble')
}

test('300 tirages donnent douze épreuves résolubles, distinctes de leur état initial', () => {
  for (let seed = 0; seed < 300; seed++) {
    const v = values(seed), progress = newLunarProgress(seed)
    const answers: Record<string, number[]> = { manifest: v.digits, circuit: Array(16).fill(0), loads: [0, 2, 1, 2, 1, 0], thermal: v.thermal,
      identity: [0, 1, 2, 3], signal: v.signal, filters: [0, 1, 2, 3, 4], pressure: [4, 4, 0], checklist: [0, 1, 2, 3, 4, 5],
      route: [1, 0, 0, 1, 0, 0, 1, 1], fuel: v.fuel, launch: [v.digits[2], v.thermal[2], v.signal[1], 4] }
    for (const task of TASKS) {
      expect(available(progress, task.id)).toBe(true)
      expect(validAnswer(task.id, initialDraft(task.id, seed), seed), `${seed}:${task.id} déjà résolu`).toBe(false)
      expect(validAnswer(task.id, answers[task.id], seed), `${seed}:${task.id} insoluble`).toBe(true)
      expect(lunarNotes(seed)[task.note].text.length).toBeGreaterThan(80)
      progress.solved.push(task.id)
    }
    expect(lunarGate('exterior', progress.solved)).toBe(true)
  }
})

test('les relevés et les ordres ont une solution unique, toutes les répartitions valides sont acceptées', () => {
  for (const seed of [0, 1, 42, 999999]) {
    const v = values(seed), thermal: number[][] = [], fuel: number[][] = [], radio: number[][] = []
    for (let a = 0; a <= 9; a++) for (let b = 0; b <= 9; b++) for (let c = 0; c <= 9; c++) {
      if (a <= 6 && b <= 6 && c <= 6 && THERMAL([a,b,c]).join() === THERMAL(v.thermal).join()) thermal.push([a,b,c])
      if (a <= 8 && b <= 8 && c <= 8 && FUEL([a,b,c]).join() === FUEL(v.fuel).join()) fuel.push([a,b,c])
      if (a+b === v.signal[0]+v.signal[1] && b+c === v.signal[1]+v.signal[2] && a+c === v.signal[0]+v.signal[2]) radio.push([a,b,c])
    }
    expect(thermal).toEqual([v.thermal]); expect(fuel).toEqual([v.fuel]); expect(radio).toEqual([v.signal])
  }
  const permute = (a: number[]): number[][] => a.length ? a.flatMap((v,i) => permute(a.filter((_,j) => i !== j)).map(p => [v,...p])) : [[]]
  for (const id of Object.keys(ORDER_LABELS)) {
    const solutions = permute(ORDER_LABELS[id].map((_,i) => i)).filter(a => {
      const p = (n: number) => a.indexOf(n)
      if (id === 'identity') return p(0) < 2 && p(3) === p(2)+1 && p(1)>p(0) && p(1)<p(3) && p(2)!==1
      if (id === 'filters') return p(4)===4 && p(3)===p(2)+1 && p(1)>p(0) && p(1)<p(2)
      return p(0)<p(1) && p(1)<p(2) && p(2)<p(3) && p(3)<p(4) && p(5)===5
    })
    expect(solutions).toEqual([ORDER_LABELS[id].map((_,i) => i)])
  }
  const buses: number[][] = []
  for (let i=0; i<729; i++) { const a = LOADS.map((_,j) => Math.floor(i / 3**j)%3); if (BUS_TARGETS.every((t,b) => a.filter(n=>n===b).length===2 && a.reduce((s,n,j)=>s+(n===b?LOADS[j]:0),0)===t)) buses.push(a) }
  expect(buses).toHaveLength(2)
  for (const a of buses) expect(validAnswer('loads', a, 42)).toBe(true)
})

test('la pression conserve le gaz et le rover ne traverse pas les obstacles', () => {
  let a = [8,0,0]
  for (const [from,to] of pressureSolution()) { a=transfer(a,from,to); expect(a.reduce((s,n)=>s+n,0)).toBe(8); expect(a.every((n,i)=>n>=0 && n<=[8,5,3][i])).toBe(true) }
  expect(a).toEqual([4,4,0])
  expect(roverPath([0]).valid).toBe(false)
  expect(validAnswer('route',[1,0,0,1,0,0,1,1],42)).toBe(true)
  expect(validAnswer('route',[1,1,1,1,0,0,0,0],42)).toBe(false)
  for (const t of TASKS) for (const bad of [[NaN],[Infinity],[-1],Array(30).fill(0)]) expect(validAnswer(t.id,bad,42)).toBe(false)
  const broken = Array(16).fill(0); broken[0]=1
  expect(validAnswer('circuit',broken,42)).toBe(false)
  expect(available(newLunarProgress(),'launch')).toBe(false)
  expect(lunarGate('exterior',[])).toBe(false)
})

test('le plan et les modules partagent leurs transformations, avec cinq accès distincts', () => {
  expect(MODULES).toHaveLength(5)
  for (const m of MODULES) {
    const entry = localPoint(m.id,0,0,-m.depth/2), inner = localPoint(m.id,0,0,-m.depth/2+.5)
    expect(Math.hypot(entry[0]-HUB[0],entry[2]-HUB[1])).toBeCloseTo(m.distance-m.depth/2)
    expect(inModule(m,inner[0],inner[2])).toBe(true)
    expect(lunarRoomAt(inner[0],inner[2])?.id).toBe(m.id)
    expect(m.distance-m.depth/2).toBeGreaterThan(7)
  }
  expect(new Set(lunarMap.ents.map(e=>e.id)).size).toBe(lunarMap.ents.length)
  expect(lunarMap.ents.filter(e=>e.id.startsWith('l_'))).toHaveLength(12)
})
