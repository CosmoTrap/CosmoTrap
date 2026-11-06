import { useFrame } from '@react-three/fiber'
import { CylinderCollider, RigidBody } from '@react-three/rapier'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CEIL } from '../game/maps'
import { HUB, MODULES, lunarHub, lunarMap } from '../game/lunar/map'
import { RoomCtx } from './materials'
import { roomPowerCut } from './roomPower'
import { RoundHub } from './RoundHub'
import { Door } from './Door'
import { Props } from './props/Props'
import { EntModels } from './props/EntModels'
import { EmergencyLights } from './EmergencyLights'
import { Stars, MilkyWay, Sun } from './Exterior/Space'
import { Earth } from './Exterior/Earth'
import { LunarModuleShell, LunarTunnel } from './lunar/LunarModule'
import { LunarExterior } from './lunar/LunarExterior'
import { LunarRocket } from './lunar/LunarRocket'

export function LunarWorld({ shadows }: { shadows: boolean }) {
  const sun = useMemo(() => new THREE.Vector3(...lunarMap.sun).normalize(), [])
  const hubLight = useRef<THREE.PointLight>(null)
  useFrame((_, dt) => { if (hubLight.current) hubLight.current.intensity = THREE.MathUtils.damp(hubLight.current.intensity, roomPowerCut(lunarHub) ? 0 : 18, 8, Math.min(dt, .1)) })
  return <>
    <MilkyWay /><Stars count={9000} /><Sun dir={sun} />
    <Earth radius={95} position={[-900, 320, -1800]} sun={sun} />
    <LunarExterior />
    <RoundHub room={lunarHub} zone={1} shadows={shadows} />
    <RigidBody type="fixed" colliders={false}>
      <CylinderCollider args={[.1, 7.02]} position={[HUB[0], -.1, HUB[1]]} />
      <CylinderCollider args={[.1, 7.02]} position={[HUB[0], CEIL + .1, HUB[1]]} />
    </RigidBody>
    <pointLight name="lunar-light:hub" ref={hubLight} position={[HUB[0], 2, HUB[1]]} color="#acc9ef" intensity={18} distance={12} />
    {MODULES.map(m => <RoomCtx.Provider key={m.id} value={{ id: m.id, dark: false }}><LunarModuleShell module={m} /><LunarTunnel module={m} /></RoomCtx.Provider>)}
    <Door id="lunar_exterior" room="airlock" x={41} z={73} alongZ />
    <Props map={lunarMap} /><EntModels zone={1} /><EmergencyLights map={lunarMap} />
    <LunarRocket />
  </>
}
