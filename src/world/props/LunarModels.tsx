import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { useGame } from '../../game/state'
import { taskById } from '../../game/lunar/puzzles'
import { useMats } from '../materials'
import { Box, Screen } from './models'

export function LunarTerminal({ id }: { id: string }) {
  const m = useMats(), key = id.slice(2), solved = useGame(s => s.lunar.solved.includes(key))
  const task = taskById(key)
  return <group>
    <Box s={[1.35, .12, .65]} p={[0, .06, 0]} m={m.metal('#45545f')} />
    <Box s={[.84, .95, .42]} p={[0, .55, 0]} m={m.painted('#626c78', .45, .6)} />
    <Box s={[1.3, .72, .16]} p={[0, 1.3, -.1]} m={m.painted('#303a47', .35, .65)} />
    <Screen w={1.16} h={.56} p={[0, 1.31, -.01]} lines={['SELENE-7 // ' + (task?.room.toUpperCase() ?? 'NAV'), task?.name ?? 'POSTE', solved ? 'SYSTEME VALIDE' : 'INTERVENTION REQUISE', 'E : OUVRIR LE TERMINAL']} fg={solved ? '#7de8ba' : '#ffbd8b'} intensity={.9} />
    <Box s={[1.25, .08, .55]} p={[0, .95, .2]} m={m.metal('#606e79', .45)} />
    <RigidBody type="fixed" colliders={false}><CuboidCollider args={[.68, .87, .35]} position={[0, .87, .04]} /></RigidBody>
  </group>
}
export function LunarNote({ id }: { id: string }) {
  const m = useMats()
  return <group><Box s={[.7, .5, .06]} m={m.metal('#5b6b76')} /><Screen w={.64} h={.44} p={[0, 0, .035]} lines={['SELENE-7 / CONSIGNE', id.slice(3).toUpperCase(), 'E : LIRE ET ARCHIVER']} fg="#9cdbff" intensity={.7} /></group>
}
