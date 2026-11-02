import { placeOf, roomAt } from '../../game/maps'
import type { GridMap } from '../../game/types'
import { RoomCtx } from '../materials'
import { PROP_MODELS } from './models'

export function Props({ map }: { map: GridMap }) {
  return (
    <group>
      {map.props.map((pr, i) => {
        const { p, r } = placeOf(pr, 0)
        const room = roomAt(map, p[0] + (pr.wall ? Math.sin(r) * 0.3 : 0), p[2] + (pr.wall ? Math.cos(r) * 0.3 : 0))
        const M = PROP_MODELS[pr.model]
        if (!M) return null
        return (
          <RoomCtx.Provider key={i} value={{ id: room?.id ?? '', dark: !!room?.dark }}>
            <group position={p} rotation={[0, r, 0]}>
              {M({ color: pr.color, scale: pr.scale })}
            </group>
          </RoomCtx.Provider>
        )
      })}
    </group>
  )
}
