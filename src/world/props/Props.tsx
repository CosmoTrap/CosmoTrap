import { memo, useMemo } from 'react'
import { useGame } from '../../game/state'
import { placeOf, roomAt } from '../../game/maps'
import type { GridMap } from '../../game/types'
import { RoomCtx } from '../materials'
import { resolveProps } from './clearance'
import { PROP_MODELS } from './models'
import { SolidProp } from './SolidProps'
import { PushableProp } from './PushableProp'
import { StaticBatch } from './StaticBatch'

// Explicit allowlist: only immutable scenery. Async models notify their batch
// when mounted; actors, screens with animation and puzzle machinery stay separate.
const STATIC = new Set(['bunk', 'photos', 'sockets', 'personalLocker', 'holoProjector',
  'table', 'mugs', 'counter', 'postits', 'screen', 'workstation', 'pipes', 'pipesBig', 'sign',
  'handrail', 'crates', 'medbed', 'cabinet', 'hazard', 'labBench',
  'microscope', 'flasks', 'ladder', 'brokenPipe', 'cables', 'console',
  'grating', 'pilotSeat', 'sideConsole', 'dockHatch', 'crewSeats', 'poster',
  'shelf', 'rack', 'extinguisher', 'suitRack', 'plantRack', 'plant', 'planterLong', 'stack',
  'counterSink', 'counterLow', 'fridge', 'bin', 'conduit', 'medWall', 'curtain', 'washBasin', 'medCart', 'nook', 'nookMeal',
  'toolChest', 'toolCart', 'generator', 'camera', 'utilityBox', 'stool', 'clock', 'seeding', 'container',
  'cookPot', 'jug', 'waterGallon', 'sofa', 'coffeeTable', 'armchair', 'nightTable', 'deskLamp', 'frame', 'cassette',
  'dartboard', 'drawers', 'desk', 'workTable', 'chair', 'wheelchair', 'cleanerBottle', 'cleanerCan', 'cardboard',
  'storageShelf', 'barrel', 'magnifier', 'sprays', 'clayPot', 'wateringCan', 'trowel', 'gloves', 'compost',
  'vice', 'oilCan', 'drill', 'tapeMeasure', 'ladderRack', 'lubricant', 'wallLamp', 'powerBox', 'medicalBox',
  'kettle', 'foodBox', 'foodCans', 'thermos', 'cuttingBoard', 'toolbox', 'crateSmall', 'containerLow', 'jerrycan',
  'plasticCan', 'gasBottle', 'elecBox', 'clipboard', 'binder', 'stationery', 'circuit', 'multimeter', 'pliers',
  'screwdrivers', 'spanner', 'bunsen', 'broom', 'dustpan', 'trashBag', 'fireAlarm', 'handTruck', 'storageCart',
  'drillPress', 'weldCart', 'hvac', 'crutches', 'metalStool', 'chemSet', 'gasTank', 'shelfUnit'])

export const Props = memo(function Props({ map }: { map: GridMap }) {
  // Quest flags must not reconstruct every fixed prop and its render batches.
  // A graphics setting change still rebuilds the appropriate materials.
  useGame(s => s.settings.quality)
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
})
