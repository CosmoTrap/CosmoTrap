import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { CEIL, TILE } from '../../game/maps'
import { G, live } from '../../game/state'
import type { GridMap } from '../../game/types'
import { QUALITY } from '../quality'
import { Asteroids } from './Asteroids'
import { Earth } from './Earth'
import { NOISE } from './glsl'
import { Moon } from './Moon'
import { MilkyWay, ShootingStars, Stars, Sun } from './Space'

/** tout ce qu'on voit par les hublots, selon la zone */
export function Exterior({ map }: { map: GridMap }) {
  const q = QUALITY[G().settings.quality]
  const W = Math.max(...map.grid.map((r) => r.length))
  const H = map.grid.length
  const c = useMemo(() => new THREE.Vector3(W, 0, H), [W, H])
  // Boîte de la station (TILE = 2 : le centre (W, 0, H) est déjà le centre monde).
  const keepOut = useMemo(() => {
    const hx = (W * TILE) / 2
    const hz = (H * TILE) / 2
    return { cx: hx, cy: CEIL / 2, cz: hz, hx, hy: CEIL / 2, hz }
  }, [W, H])
  const sun = useMemo(() => new THREE.Vector3(...map.sun).normalize(), [map])
  // Le flux est perpendiculaire au soleil : les rochers traversent son disque.
  const flow = useMemo(() => {
    const f = new THREE.Vector3(-sun.z, 0, sun.x)
    if (f.lengthSq() < 1e-6) f.set(1, 0, 0)
    return f.normalize()
  }, [sun])
  const group = useRef<THREE.Group>(null)
  useFrame(() => {
    if (group.current) group.current.position.y = live.ext.y
  })
  return (
    <>
      <MilkyWay />
      <Stars count={q.particles > 400 ? 9000 : 5000} />
      <Sun dir={sun} />
      <group ref={group}>
        {map.exterior === 'moon' && (
          <>
            <Moon radius={1500} position={[c.x - 200, -1525, c.z + 150]} sun={sun} detail={q.moonDetail} />
            <Earth radius={75} position={c.clone().add(new THREE.Vector3(-0.55, 0.14, -0.82).normalize().multiplyScalar(3200)).toArray()} sun={sun} />
            <ShootingStars />
            <Asteroids center={c} keepOut={keepOut} minY={-2} flow={flow} count={q.particles > 400 ? 260 : 160} />
          </>
        )}
        {map.exterior === 'asteroids' && (
          <>
            <Moon radius={320} position={c.clone().add(new THREE.Vector3(0.45, -0.3, -0.84).normalize().multiplyScalar(2600)).toArray()} sun={sun} detail={2} />
            <Earth radius={60} position={c.clone().add(new THREE.Vector3(-0.7, 0.1, 0.7).normalize().multiplyScalar(3600)).toArray()} sun={sun} />
            <Asteroids center={c} keepOut={keepOut} flow={flow} count={q.particles > 400 ? 260 : 160} />
          </>
        )}
        {map.exterior === 'earthrise' && (
          <>
            <Moon radius={1500} position={[c.x, -1516, c.z - 300]} sun={sun} detail={q.moonDetail} />
            <Earth radius={240} position={[c.x + 120, 110, c.z - 2400]} sun={sun} />
          </>
        )}
      </group>
      {map.exterior === 'earthrise' && <Reentry center={c} />}
    </>
  )
}

/** plasma de rentrée atmosphérique autour de la fusée */
function Reentry({ center }: { center: THREE.Vector3 }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uA: { value: 0 } },
        vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float uTime; uniform float uA; varying vec3 vP; ${NOISE}
          void main(){ vec3 d = normalize(vP); float n = fbm(d * 4.0 + vec3(0.0, uTime * 3.0, uTime * 1.5));
            float streak = fbm(vec3(d.x * 10.0, d.y * 2.0 - uTime * 6.0, d.z * 10.0));
            vec3 c = mix(vec3(1.0, 0.25, 0.05), vec3(1.0, 0.75, 0.35), n) * (0.6 + streak * 1.4);
            gl_FragColor = vec4(c * uA * 5.0, 1.0); }`,
        side: THREE.BackSide,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime
    mat.uniforms.uA.value = live.ext.plasma
    if (ref.current) ref.current.visible = live.ext.plasma > 0.01
  })
  return (
    <mesh ref={ref} position={[center.x, 1.5, center.z]} material={mat} visible={false}>
      <sphereGeometry args={[40, 48, 32]} />
    </mesh>
  )
}
