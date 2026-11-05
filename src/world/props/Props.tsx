import { useMemo } from 'react'
import { placeOf, roomAt } from '../../game/maps'
import type { GridMap } from '../../game/types'
import { RoomCtx } from '../materials'
import { resolveProps } from './clearance'
import { PROP_MODELS } from './models'
import { SolidProp } from './SolidProps'
import { PushableProp } from './PushableProp'
import { StaticBatch } from './StaticBatch'

// Explicit allowlist: asynchronous glTFs and animated models stay independent.
// Shelf, rack, extinguisher, suitRack and plantRack now contain async real models.
const STATIC = new Set(['bunk', 'photos', 'sockets', 'personalLocker', 'holoProjector',
  'table', 'mugs', 'counter', 'postits', 'screen', 'pipes', 'pipesBig', 'sign',
  'handrail', 'crates', 'medbed', 'cabinet', 'hazard', 'labBench',
  'microscope', 'flasks', 'ladder', 'brokenPipe', 'cables', 'console',
  'grating', 'pilotSeat', 'sideConsole', 'dockHatch', 'crewSeats', 'poster'])

export function Props({ map }: { map: GridMap }) {
  const props = useMemo(() => resolveProps(map), [map])
  const fixed = new Map<string, React.ReactNode[]>()
  const independent: React.ReactNode[] = []
  props.forEach((pr, i) => {
    const { p, r } = placeOf(pr, 0)
    const room = roomAt(map, p[0] + (pr.wall ? Math.sin(r) * 0.3 : 0), p[2] + (pr.wall ? Math.cos(r) * 0.3 : 0))
    const M = PROP_MODELS[pr.model]
    if (!M) return
    const node = <RoomCtx.Provider key={i} value={{ id: room?.id ?? '', dark: !!room?.dark }}>
      {pr.pushable ? <PushableProp id={pr.pushable} model={pr.model} position={p} rotation={r}>
        {STATIC.has(pr.model)
          ? <StaticBatch>{M({ color: pr.color, scale: pr.scale, movable: true })}</StaticBatch>
          : M({ color: pr.color, scale: pr.scale, movable: true })}
      </PushableProp> : <group name={`prop:${pr.model}`} position={p} rotation={[0, r, 0]}>
        {M({ color: pr.color, scale: pr.scale })}
        <SolidProp model={pr.model} />
      </group>}
    </RoomCtx.Provider>
    if (!pr.pushable && STATIC.has(pr.model)) {
      // Room-sized batches preserve useful frustum culling in the modular station.
      const key = room?.id ?? 'outside'
      const list = fixed.get(key) ?? []
      list.push(node); fixed.set(key, list)
    } else independent.push(node)
  })
  return (
    <group>
      {[...fixed].map(([id, nodes]) => <StaticBatch key={id}>{nodes}</StaticBatch>)}
      {independent}
    </group>
  )
}
