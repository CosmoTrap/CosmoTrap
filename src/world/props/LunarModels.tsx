import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useGame } from '../../game/state'
import { taskById } from '../../game/lunar/puzzles'
import { useMats } from '../materials'
import { Box, Screen } from './models'
import { TerminalBody } from './EntModels'

export function LunarTerminal({ id }: { id: string }) {
  const m = useMats(), key = id.slice(2), solved = useGame(s => s.lunar.solved.includes(key))
  const task = taskById(key)
  // Same diagnostic desk as the station's machine room, centred on its placement and facing +z.
  return <group position={[0, 0, -.3]}>
    <TerminalBody lit={solved}>
      <Screen w={.94} h={.57} lines={['SELENE-7 // ' + (task?.room.toUpperCase() ?? 'NAV'), task?.name ?? 'POSTE', solved ? 'SYSTEME VALIDE' : 'INTERVENTION REQUISE', 'E : OUVRIR LE TERMINAL']} fg={solved ? '#7de8ba' : '#ffbd8b'} intensity={.9} />
    </TerminalBody>
    <RigidBody type="fixed" colliders={false}><CuboidCollider args={[.7, .9, .32]} position={[0, .9, .3]} /></RigidBody>
  </group>
}
export function LunarNote({ id }: { id: string }) {
  const m = useMats()
  return <group><Box s={[.7, .5, .06]} m={m.metal('#5b6b76')} /><Screen w={.64} h={.44} p={[0, 0, .035]} lines={['SELENE-7 / CONSIGNE', id.slice(3).toUpperCase(), 'E : LIRE ET ARCHIVER']} fg="#9cdbff" intensity={.7} /></group>
}
