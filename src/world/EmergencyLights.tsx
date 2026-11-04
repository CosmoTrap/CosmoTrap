import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CEIL, TILE } from '../game/maps'
import { G, live } from '../game/state'
import type { GridMap, RoomDef } from '../game/types'
import { useMats } from './materials'
import { Cyl } from './props/models'
import { roomPowerCut } from './roomPower'

type BeaconDef = { room: RoomDef; pos: [number, number, number]; id: string }
function beaconsFor(room: RoomDef): BeaconDef[] {
  const [x0, z0, x1, z1] = room.rect
  const w = (x1 - x0 + 1) * TILE, h = (z1 - z0 + 1) * TILE
  const n = Math.max(1, Math.ceil(Math.max(w, h) / 8))
  return Array.from({ length: n }, (_, i) => ({ room, id: `${room.id}:${i}`, pos: [
    x0 * TILE + (w >= h ? w * (i + 0.5) / n : w / 2), CEIL - 0.32,
    z0 * TILE + (w >= h ? h / 2 : h * (i + 0.5) / n),
  ] }))
}
const angle = (room: RoomDef) => G().playTime * 1.65 + room.rect[0] * 0.7

function Beacon({ room, pos, id }: BeaconDef) {
  const rotor = useRef<THREE.Group>(null)
  const m = useMats()
  const lens = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#76100c', roughness: 0.18,
    metalness: 0.15, clearcoat: 1, emissive: '#ff1806', emissiveIntensity: 0 }), [])
  useEffect(() => () => lens.dispose(), [lens])
  useFrame(() => {
    const on = roomPowerCut(room)
    lens.emissiveIntensity = on ? 2.4 : 0
    if (rotor.current) rotor.current.rotation.y = angle(room)
  })
  return <group position={pos} name={`alert-beacon:${id}`}>
    <Cyl a={[0.14, 0.14, 0.045]} p={[0, 0.15, 0]} m={m.metal('#43494b')} />
    <Cyl a={[0.095, 0.1, 0.19]} p={[0, 0.04, 0]} m={m.glass('#a71b0d', 0.34)} seg={24} />
    <Cyl a={[0.105, 0.105, 0.025]} p={[0, -0.06, 0]} m={m.metal('#383d40')} />
    <group ref={rotor}>
      <Cyl a={[0.065, 0.065, 0.018]} r={[Math.PI / 2, 0, 0]} p={[0, 0.035, 0.044]} m={lens} seg={24} />
      <Cyl a={[0.03, 0.03, 0.14]} p={[0, 0.025, 0]} m={m.metal('#a2a19c', 0.25)} />
    </group>
  </group>
}

/** Two nearby revolving beams, a fixed light count even when the power changes. */
export function EmergencyLights({ map }: { map: GridMap }) {
  const beacons = useMemo(() => map.rooms.filter((r) => !r.noDynLight).flatMap(beaconsFor), [map])
  const beams = useMemo(() => Array.from({ length: 2 }, (_, i) => {
    const light = new THREE.SpotLight('#ff1408', 0, 25, 0.62, 0.8, 1.25)
    light.name = `alert-beam:${i}`
    // A soft beam sweeps the walls; no strobe, and no expensive extra shadow maps.
    const spill = new THREE.PointLight('#ff1808', 0, 6, 1.5)
    return { light, spill, target: new THREE.Object3D() }
  }), [])
  useEffect(() => {
    beams.forEach(({ light, target }) => { light.target = target })
    return () => beams.forEach(({ light, spill }) => { light.dispose(); spill.dispose() })
  }, [beams])
  useFrame(() => {
    const distance = (b: BeaconDef) => Math.hypot(b.pos[0] - live.pos[0], b.pos[2] - live.pos[2]) + (b.room.id === live.roomId ? 0 : 30)
    const active = beacons.filter(({ room }) => roomPowerCut(room)).sort((a, b) => distance(a) - distance(b))
    beams.forEach(({ light, spill, target }, i) => {
      const entry = active[i]
      light.intensity = entry ? 65 : 0
      spill.intensity = entry ? 1.8 : 0
      if (!entry) return
      const { room, pos } = entry
      const a = angle(room)
      light.position.set(...pos)
      spill.position.set(...pos)
      target.position.set(pos[0] + Math.sin(a) * 6, pos[1] - 1.2, pos[2] + Math.cos(a) * 6)
      target.updateMatrixWorld()
      light.distance = 14
    })
  })
  return <group>
    {beacons.map((beacon) => <Beacon key={beacon.id} {...beacon} />)}
    {beams.map(({ light, spill, target }, i) => <group key={i}><primitive object={light} /><primitive object={spill} /><primitive object={target} /></group>)}
  </group>
}
