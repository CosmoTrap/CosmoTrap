import { Environment } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { BallCollider, CuboidCollider, CylinderCollider, RigidBody, TrimeshCollider } from '@react-three/rapier'
import { Suspense, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { audio } from '../../game/audio/audio'
import { BOUNDS, BRIDGE_X, RIVER_HALF, riverCenter, terrainHeight, zone4Props } from '../../game/maps/zone4'
import { G, live, useGame } from '../../game/state'
import { QUALITY } from '../quality'
import { EntModels } from '../props/EntModels'
import { Box, Cyl } from '../props/models'
import { RealModel } from '../props/RealModel'
import { RoomCtx, useMats } from '../materials'
import { drawTexture } from '../textures'
import { pbr, pbrMaterial } from '../assets'
import { rockGeometry } from '../Exterior/Asteroids'
import { CloudLayer, FOG4, Grass, Mountains, River, SUN4, SunLight, Terrain, buildTerrain, placeTrees } from './Nature'
import { Impostors, Instanced, SUN_FOR_IMPOSTOR, scatter, splitTrees, useHdri } from './RealNature'
import { woodMat } from './Zone4Ents'
import { capsulePos, crash } from '../FilmScenes'

// Zone 4 — Terre, vallée de l'atterrissage, fin d'après-midi.

export const heli = { x: 60, y: 60, z: -120, yaw: 0, visible: false, rotor: 0 }

/** la capsule pendant le crash : elle tombe du ciel en tournoyant, puis se pose à sa place */
function Falling({ children }: { children: React.ReactNode }) {
  const g = useRef<THREE.Group>(null)
  useFrame(() => {
    if (!g.current) return
    if (!crash.active || crash.k >= 1) {
      g.current.position.set(0, 0, 0)
      g.current.rotation.set(0, 0, 0)
      return
    }
    const c = capsulePos(crash.k)
    const end = capsulePos(1)
    g.current.position.set(c[0] - end[0], c[1] - end[1], c[2] - end[2])
    // bouclier thermique vers l'avant, roulis
    const a = 1 - crash.k
    g.current.rotation.set(-1.1 * a - 0.2, crash.t * 0.8, 0.9 * a)
  })
  return <group ref={g}>{children}</group>
}

function Capsule() {
  const m = useMats()
  const open = useGame((s) => s.flags.capsule)
  const hatch = useRef<THREE.Group>(null)
  const { geo, mat } = useMemo(() => {
    const pts = [
      [0, 0.2],
      [1.85, 0.3],
      [2.0, 0.5],
      [1.85, 0.72],
      [0.85, 2.9],
      [0.7, 3.1],
      [0.55, 3.3],
      [0.001, 3.38],
    ].map(([r, y]) => new THREE.Vector2(r, y))
    const geo = new THREE.LatheGeometry(pts, 64)
    const tex = drawTexture(512, 512, (c) => {
      const g = c.createLinearGradient(0, 512, 0, 0)
      g.addColorStop(0, '#120d0a')
      g.addColorStop(0.18, '#2a1d14')
      g.addColorStop(0.3, '#6b5a4a')
      g.addColorStop(0.65, '#c9c6bf')
      g.addColorStop(1, '#e6e4de')
      c.fillStyle = g
      c.fillRect(0, 0, 512, 512)
      for (let i = 0; i < 400; i++) {
        const x = Math.random() * 512
        const y = 512 - Math.random() * 380
        c.strokeStyle = `rgba(${30 + Math.random() * 40},${20 + Math.random() * 20},10,${0.1 + Math.random() * 0.35})`
        c.lineWidth = 1 + Math.random() * 4
        c.beginPath()
        c.moveTo(x, y)
        c.lineTo(x + (Math.random() - 0.5) * 6, y - 30 - Math.random() * 120)
        c.stroke()
      }
      for (let y = 0; y < 512; y += 64) {
        c.fillStyle = 'rgba(0,0,0,0.2)'
        c.fillRect(0, y, 512, 2)
      }
    })
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.65, metalness: 0.35 })
    return { geo, mat }
  }, [])
  useFrame((_, dt) => {
    if (hatch.current) hatch.current.rotation.y = THREE.MathUtils.damp(hatch.current.rotation.y, open ? 1.6 : 0, 2, dt)
  })
  return (
    <group rotation={[0.12, 0, -0.06]}>
      <mesh geometry={geo} material={mat} castShadow receiveShadow position={[0, -0.25, 0]} />
      {/* écoutille côté nord */}
      <group position={[0, 1.25, -1.2]} rotation={[-0.42, Math.PI, 0]}>
        <group ref={hatch} position={[-0.38, 0, 0]}>
          <Box s={[0.76, 0.9, 0.06]} p={[0.38, 0, 0]} m={m.painted('#bdbab2', 0.5, 0.4)} />
          <Box s={[0.2, 0.06, 0.06]} p={[0.62, 0, 0.05]} m={m.metal('#55595e')} />
        </group>
        <Box s={[0.7, 0.84, 0.02]} p={[0, 0, -0.04]} m={m.plastic('#0d0d0d', 0.8)} cast={false} />
      </group>
      <mesh position={[0.9, 2.0, -0.55]} rotation={[0.3, -0.9, 0]} material={m.glass('#334455', 0.8)}>
        <circleGeometry args={[0.16, 20]} />
      </mesh>
      {/* motte de terre retournée */}
      <mesh position={[0, -0.1, 0.8]} rotation={[-Math.PI / 2, 0, 0]} scale={[1.6, 1, 1]} receiveShadow>
        <circleGeometry args={[2.6, 32]} />
        <meshStandardMaterial color="#3a2c1e" roughness={1} />
      </mesh>
    </group>
  )
}

function Parachute() {
  const { geo, mat, lines } = useMemo(() => {
    const g = new THREE.SphereGeometry(6, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2)
    const p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const z = p.getZ(i)
      const y = p.getY(i)
      const w = Math.sin(x * 1.3) * Math.cos(z * 1.1) * 0.25 + Math.sin(Math.atan2(z, x) * 14) * 0.12
      p.setXYZ(i, x * 1.1, y * 0.12 + w + 0.15, z)
    }
    g.computeVertexNormals()
    const tex = drawTexture(512, 64, (c) => {
      for (let i = 0; i < 16; i++) {
        c.fillStyle = i % 2 ? '#f2f0ea' : '#e2541f'
        c.fillRect((i * 512) / 16, 0, 512 / 16, 64)
      }
    })
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide })
    const lines = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(Math.cos(a) * 6, 0.2, Math.sin(a) * 6), new THREE.Vector3(Math.cos(a) * 3 + 2, 0.05, Math.sin(a) * 3 - 3), new THREE.Vector3(5.5, 0.6, -6.5)])
      return new THREE.TubeGeometry(curve, 20, 0.012, 4)
    })
    return { geo: g, mat, lines }
  }, [])
  return (
    <group>
      <mesh geometry={geo} material={mat} castShadow receiveShadow />
      {lines.map((l, i) => (
        <mesh key={i} geometry={l}>
          <meshStandardMaterial color="#d8d2c0" roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
}

function Cabin() {
  const m = useMats()
  const wood = useMemo(() => pbrMaterial('brown_planks_05', { repeat: [2, 2], metal: 0, color: '#c9b8a0' }), [])
  const roof = m.painted('#5a3a2a', 0.8, 0.1)
  return (
    <group>
      <Box s={[4.4, 0.25, 3.4]} p={[0, 0.12, 0]} m={wood} />
      <Box s={[4.2, 2.4, 0.15]} p={[0, 1.45, -1.6]} m={wood} />
      <Box s={[0.15, 2.4, 3.2]} p={[-2.05, 1.45, 0]} m={wood} />
      <Box s={[0.15, 2.4, 3.2]} p={[2.05, 1.45, 0]} m={wood} />
      <Box s={[1.4, 2.4, 0.15]} p={[-1.4, 1.45, 1.6]} m={wood} />
      <Box s={[1.4, 2.4, 0.15]} p={[1.4, 1.45, 1.6]} m={wood} />
      <Box s={[1.4, 0.5, 0.15]} p={[0, 2.4, 1.6]} m={wood} />
      <Box s={[4.8, 0.12, 2.3]} p={[0, 3.05, -0.85]} r={[0.55, 0, 0]} m={roof} />
      <Box s={[4.8, 0.12, 2.3]} p={[0, 3.05, 0.85]} r={[-0.55, 0, 0]} m={roof} />
      <Box s={[1.4, 0.06, 0.8]} p={[-0.5, 0.95, -0.9]} m={wood} />
      <Box s={[0.08, 0.7, 0.08]} p={[-1.1, 0.6, -0.6]} m={wood} />
      <Box s={[0.08, 0.7, 0.08]} p={[0.1, 0.6, -0.6]} m={wood} />
      <mesh position={[1.2, 1.6, -1.5]} material={m.glass('#9fc3d9', 0.4)}>
        <planeGeometry args={[0.8, 0.6]} />
      </mesh>
    </group>
  )
}

function Helipad() {
  const { mat, edge } = useMemo(() => {
    const real = pbr('concrete_floor_02', [3, 3])
    const deco = drawTexture(1024, 1024, (c) => {
      c.fillStyle = '#8d8a84'
      c.fillRect(0, 0, 1024, 1024)
      c.scale(2, 2)
      c.strokeStyle = '#e8c12a'
      c.lineWidth = 18
      c.beginPath()
      c.arc(256, 256, 200, 0, Math.PI * 2)
      c.stroke()
      c.fillStyle = '#f2f0ea'
      c.fillRect(176, 140, 40, 232)
      c.fillRect(296, 140, 40, 232)
      c.fillRect(176, 236, 160, 40)
    })
    return {
      mat: (() => {
        // marquage H sur béton réel : la peinture module la texture photo
        const m = new THREE.MeshStandardMaterial({ map: real.map, normalMap: real.normalMap, roughnessMap: real.arm, roughness: 1 })
        m.onBeforeCompile = (sh) => {
          sh.uniforms.tPaint = { value: deco }
          sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nuniform sampler2D tPaint;')
            .replace('#include <map_fragment>', '#include <map_fragment>\nvec3 paint = texture2D(tPaint, vMapUv / 3.0).rgb;\nfloat pm = smoothstep(0.08, 0.2, distance(paint, vec3(0.553, 0.541, 0.518)));\ndiffuseColor.rgb = mix(diffuseColor.rgb, paint * 0.9, pm * 0.85);')
        }
        return m
      })(),
      edge: new THREE.MeshStandardMaterial({ color: '#77746e', roughness: 1 }),
    }
  }, [])
  const sock = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (sock.current) sock.current.rotation.y = -0.8 + Math.sin(clock.elapsedTime * 0.7) * 0.25
  })
  return (
    <group>
      <mesh position={[0, 0.1, 0]} material={edge} receiveShadow castShadow>
        <cylinderGeometry args={[6.2, 6.4, 0.35, 48]} />
      </mesh>
      <mesh position={[0, 0.28, 0]} rotation={[-Math.PI / 2, 0, 0]} material={mat} receiveShadow>
        <circleGeometry args={[6, 48]} />
      </mesh>
      {Array.from({ length: 8 }).map((_, i) => (
        <mesh key={i} position={[Math.cos((i / 8) * Math.PI * 2) * 6.05, 0.32, Math.sin((i / 8) * Math.PI * 2) * 6.05]}>
          <sphereGeometry args={[0.06, 8, 6]} />
          <meshStandardMaterial color="#000" emissive="#3cff6a" emissiveIntensity={4} />
        </mesh>
      ))}
      <group position={[7.5, 0, 2]}>
        <mesh position={[0, 2, 0]} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 4, 8]} />
          <meshStandardMaterial color="#c9c6bf" metalness={0.7} roughness={0.4} />
        </mesh>
        <group ref={sock} position={[0, 3.9, 0]}>
          <mesh position={[0.7, 0, 0]} rotation={[0, 0, Math.PI / 2 + 0.25]} castShadow>
            <coneGeometry args={[0.22, 1.4, 16, 1, true]} />
            <meshStandardMaterial color="#ff6b1a" side={THREE.DoubleSide} roughness={0.8} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

function BigRock({ scale = 1 }: { scale?: number }) {
  const { geo, mat } = useMemo(() => ({ geo: rockGeometry(Math.floor(scale * 10), 4, 0.35), mat: new THREE.MeshStandardMaterial({ color: '#7d766c', roughness: 1 }) }), [scale])
  return <mesh geometry={geo} material={mat} scale={[scale * 1.3, scale, scale * 1.1]} castShadow receiveShadow />
}

/** pont de cordes : cassé ou réparé */
function Bridge() {
  const fixed = useGame((s) => s.flags.bridge)
  const wood = useMemo(() => pbrMaterial('brown_planks_05', { repeat: [0.6, 0.3], metal: 0, color: '#d8c8b0' }), [])
  const zs = riverCenter(BRIDGE_X) + RIVER_HALF + 1.6
  const zn = riverCenter(BRIDGE_X) - RIVER_HALF - 1.6
  const ys = terrainHeight(BRIDGE_X, zs) + 0.15
  const yn = terrainHeight(BRIDGE_X, zn) + 0.15
  const span = zs - zn
  const N = Math.floor(span / 0.32)
  const ropes = useMemo(() => {
    const mk = (x: number, top: number, slack: number) => {
      const pts: THREE.Vector3[] = []
      for (let i = 0; i <= 20; i++) {
        const t = i / 20
        pts.push(new THREE.Vector3(x, THREE.MathUtils.lerp(ys, yn, t) + top - Math.sin(Math.PI * t) * slack, THREE.MathUtils.lerp(zs, zn, t)))
      }
      return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 40, 0.025, 6)
    }
    return fixed
      ? [mk(BRIDGE_X - 0.8, 1.0, 0.25), mk(BRIDGE_X + 0.8, 1.0, 0.25), mk(BRIDGE_X - 0.7, 0.0, 0.35), mk(BRIDGE_X + 0.7, 0.0, 0.35)]
      : [mk(BRIDGE_X + 0.8, 1.0, 1.9), mk(BRIDGE_X - 0.7, 0.0, 1.7)]
  }, [fixed, ys, yn, zs, zn])
  return (
    <group>
      {[zs, zn].map((z, k) =>
        [-0.9, 0.9].map((dx) => <Cyl key={`${k}${dx}`} a={[0.1, 0.13, 1.6]} p={[BRIDGE_X + dx, (k ? yn : ys) + 0.5, z]} m={wood} seg={10} />),
      )}
      {ropes.map((g, i) => (
        <mesh key={i} geometry={g} castShadow>
          <meshStandardMaterial color="#a8916a" roughness={0.95} />
        </mesh>
      ))}
      {Array.from({ length: N }).map((_, i) => {
        const t = (i + 0.5) / N
        if (!fixed && i > 3 && i < N - 2) return null
        const sag = Math.sin(Math.PI * t) * 0.35
        const hang = !fixed && i <= 3 ? (3 - i) * 0.0 : 0
        return (
          <mesh key={i} position={[BRIDGE_X, THREE.MathUtils.lerp(ys, yn, t) - sag - hang, THREE.MathUtils.lerp(zs, zn, t)]} rotation={[0, (i % 3) * 0.02, !fixed && i >= N - 2 ? 1.2 : 0]} material={wood} castShadow receiveShadow>
            <boxGeometry args={[1.5, 0.05, 0.24]} />
          </mesh>
        )
      })}
      {fixed && (
        <RigidBody type="fixed" colliders={false}>
          <CuboidCollider position={[BRIDGE_X, Math.min(ys, yn) - 0.15, (zs + zn) / 2]} args={[0.75, 0.12, span / 2 + 0.6]} />
          <CuboidCollider position={[BRIDGE_X - 0.9, Math.min(ys, yn) + 0.6, (zs + zn) / 2]} args={[0.05, 0.8, span / 2]} />
          <CuboidCollider position={[BRIDGE_X + 0.9, Math.min(ys, yn) + 0.6, (zs + zn) / 2]} args={[0.05, 0.8, span / 2]} />
        </RigidBody>
      )}
    </group>
  )
}

/** hélicoptère de secours (cinématique de fin) */
export function Helicopter() {
  const g = useRef<THREE.Group>(null)
  const rotor = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Group>(null)
  const m = useMats()
  const red = m.painted('#c7261d', 0.35, 0.4)
  const white = m.painted('#ecebe6', 0.35, 0.3)
  useFrame((_, dt) => {
    if (!g.current) return
    g.current.visible = heli.visible
    g.current.position.set(heli.x, heli.y, heli.z)
    g.current.rotation.y = heli.yaw
    if (rotor.current) rotor.current.rotation.y += dt * 38
    if (tail.current) tail.current.rotation.x += dt * 60
  })
  return (
    <group ref={g} visible={false}>
      <mesh scale={[1.25, 1.1, 2.4]} position={[0, 1.4, 0]} material={red} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
      </mesh>
      <mesh scale={[1.2, 0.5, 1.6]} position={[0, 1.0, 0.3]} material={white} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
      </mesh>
      <mesh scale={[1.05, 0.8, 1.2]} position={[0, 1.65, 1.45]} material={m.glass('#1d2a35', 0.75)}>
        <sphereGeometry args={[1, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <Cyl a={[0.18, 0.35, 5]} p={[0, 1.8, -3.8]} r={[Math.PI / 2, 0, 0]} m={white} />
      <Box s={[0.1, 1.2, 0.8]} p={[0, 2.3, -6.1]} m={red} />
      <group ref={tail} position={[0.15, 2.3, -6.2]}>
        {[0, 1].map((k) => (
          <Box key={k} s={[0.03, 1.3, 0.12]} r={[(k * Math.PI) / 2, 0, 0]} m={m.metal('#2a2c30')} />
        ))}
      </group>
      <Cyl a={[0.12, 0.12, 0.5]} p={[0, 2.65, 0]} m={m.metal('#3b3e42')} />
      <group ref={rotor} position={[0, 2.95, 0]}>
        {[0, 1, 2, 3].map((k) => (
          <Box key={k} s={[10.5, 0.04, 0.32]} r={[0, (k * Math.PI) / 4, 0]} m={m.metal('#1e2023', 0.6)} cast={false} />
        ))}
      </group>
      {[-1, 1].map((s) => (
        <group key={s}>
          <Cyl a={[0.06, 0.06, 3.6]} p={[s * 1.1, 0.05, 0.2]} r={[Math.PI / 2, 0, 0]} m={m.metal('#3b3e42')} seg={8} />
          <Box s={[0.06, 0.6, 0.06]} p={[s * 1.0, 0.35, 1.0]} m={m.metal('#3b3e42')} />
          <Box s={[0.06, 0.6, 0.06]} p={[s * 1.0, 0.35, -0.6]} m={m.metal('#3b3e42')} />
        </group>
      ))}
      <mesh position={[0, 0.55, 2.2]}>
        <sphereGeometry args={[0.12, 8, 6]} />
        <meshStandardMaterial color="#000" emissive="#fff6dd" emissiveIntensity={12} />
      </mesh>
      <spotLight position={[0, 0.5, 2.3]} angle={0.5} penumbra={0.6} intensity={heli.visible ? 60 : 0} distance={60} color="#fff2d8" />
    </group>
  )
}

function Colliders() {
  const { verts, idx } = useMemo(() => {
    const g = buildTerrain(110, 110, 0, -26)
    const verts = new Float32Array(g.attributes.position.array)
    const idx = new Uint32Array(g.index!.array)
    return { verts, idx }
  }, [])
  const bridge = useGame((s) => s.flags.bridge)
  const banks = useMemo(() => {
    const out: { p: [number, number, number]; r: number; gap: boolean }[] = []
    for (let x = BOUNDS.x0; x < BOUNDS.x1; x += 2) {
      const xm = x + 1
      const gap = Math.abs(xm - BRIDGE_X) < 1.2
      for (const s of [-1, 1]) {
        const z0 = riverCenter(x) + s * (RIVER_HALF + 0.35)
        const z1 = riverCenter(x + 2) + s * (RIVER_HALF + 0.35)
        out.push({ p: [xm, 0.5, (z0 + z1) / 2], r: -Math.atan2(z1 - z0, 2), gap })
      }
    }
    return out
  }, [])
  const { x0, x1, z0, z1 } = BOUNDS
  return (
    <RigidBody type="fixed" colliders={false}>
      <TrimeshCollider args={[verts, idx]} />
      {banks.map((b, i) => (b.gap && bridge ? null : <CuboidCollider key={i} position={b.p} rotation={[0, b.r, 0]} args={[1.05, 2.5, 0.2]} />))}
      <CuboidCollider position={[x0, 5, (z0 + z1) / 2]} args={[0.5, 10, (z1 - z0) / 2]} />
      <CuboidCollider position={[x1, 5, (z0 + z1) / 2]} args={[0.5, 10, (z1 - z0) / 2]} />
      <CuboidCollider position={[(x0 + x1) / 2, 5, z0]} args={[(x1 - x0) / 2, 10, 0.5]} />
      <CuboidCollider position={[(x0 + x1) / 2, 5, z1]} args={[(x1 - x0) / 2, 10, 0.5]} />
      {/* capsule */}
      <CylinderCollider position={[0, terrainHeight(0, 2.2) + 1.5, 2.2]} args={[1.5, 1.8]} />
      {/* refuge (murs, porte au sud) */}
      <group position={[-15, terrainHeight(-15, -44), -44]} rotation={[0, 0.2, 0]}>
        <CuboidCollider position={[0, 1.4, -1.6]} args={[2.1, 1.4, 0.1]} />
        <CuboidCollider position={[-2.05, 1.4, 0]} args={[0.1, 1.4, 1.6]} />
        <CuboidCollider position={[2.05, 1.4, 0]} args={[0.1, 1.4, 1.6]} />
        <CuboidCollider position={[-1.4, 1.4, 1.6]} args={[0.7, 1.4, 0.1]} />
        <CuboidCollider position={[1.4, 1.4, 1.6]} args={[0.7, 1.4, 0.1]} />
      </group>
      {zone4Props
        .filter((p) => p.model === 'bigRock')
        .map((p, i) => (
          <BallCollider key={`r${i}`} position={p.pos} args={[(p.scale ?? 1) * 1.05]} />
        ))}
    </RigidBody>
  )
}

function TreeColliders({ trees }: { trees: { x: number; z: number }[] }) {
  return (
    <RigidBody type="fixed" colliders={false}>
      {trees
        .filter((t) => t.x > BOUNDS.x0 && t.x < BOUNDS.x1 && t.z > BOUNDS.z0 && t.z < BOUNDS.z1)
        .map((t, i) => (
          <CylinderCollider key={i} position={[t.x, terrainHeight(t.x, t.z) + 1.5, t.z]} args={[1.5, 0.35]} />
        ))}
    </RigidBody>
  )
}

function Ambience() {
  useEffect(() => {
    const t = setTimeout(() => audio.loop('amb_wind', 'amb_wind', { vol: 0.9 }), 300)
    audio.setInterior(false)
    return () => {
      clearTimeout(t)
      audio.stopLoop('amb_wind')
    }
  }, [])
  useFrame(() => {
    const d = Math.abs(live.pos[2] - riverCenter(live.pos[0]))
    audio.setRiver(THREE.MathUtils.clamp(0.25 - d * 0.012, 0.02, 0.25))
  })
  return null
}

const REAL_TREES = { low: 3, medium: 6, high: 10, ultra: 16 } as const

function RealVegetation({ near, q }: { near: ReturnType<typeof placeTrees>; q: (typeof QUALITY)['high'] }) {
  const pines = near.filter((t, i) => t.kind === 'pine' && i % 2 === 0)
  const firs = near.filter((t, i) => t.kind === 'pine' && i % 2 === 1)
  const oaks = near.filter((t) => t.kind === 'oak')
  // rien sur le chemin du joueur ni autour des lieux clés
  const spots: [number, number, number][] = [[0, -2, 7], [-7, 9, 7], [6, -60, 8], [15, -35, 4], [-14, -43, 5], [-17, -5, 3], [4, -15, 2.5], [BRIDGE_X, riverCenter(BRIDGE_X), 5]]
  const keyOk = (x: number, z: number) =>
    Math.abs(z - riverCenter(x)) > RIVER_HALF + 0.6 && Math.abs(x - BRIDGE_X + 4 - Math.sin(z * 0.08) * 3) > 2 && spots.every(([sx, sz, r]) => Math.hypot(x - sx, z - sz) > r)
  const area = { x0: -34, x1: 34, z0: -68, z1: 16 }
  const few = q.grass < 30000
  const shrubs = useMemo(() => scatter(11, few ? 12 : 28, area, keyOk, [0.7, 1.3]), [few])
  const shrubs2 = useMemo(() => scatter(12, few ? 8 : 20, area, keyOk, [0.7, 1.2]), [few])
  const ferns = useMemo(() => scatter(13, few ? 14 : 36, area, (x, z) => keyOk(x, z) && Math.abs(z - riverCenter(x)) < RIVER_HALF + 9, [0.8, 1.4]), [few])
  const clumps = useMemo(() => scatter(14, few ? 16 : 40, area, keyOk, [0.8, 1.5]), [few])
  const rocks = useMemo(() => scatter(15, few ? 10 : 22, area, keyOk, [0.4, 1.2]), [few])
  const boulders = useMemo(() => scatter(16, few ? 4 : 9, { x0: -36, x1: 36, z0: -70, z1: 18 }, keyOk, [0.6, 1.1]), [few])
  return (
    <>
      <Instanced id="pine_tree_01" items={pines.map((t) => ({ ...t, s: t.s }))} height={13} wind={0.012} />
      <Instanced id="fir_tree_01" items={firs.map((t) => ({ ...t, s: t.s }))} height={11} wind={0.012} />
      <Instanced id="island_tree_02" items={oaks.map((t) => ({ ...t, s: t.s }))} height={8} wind={0.018} />
      <Instanced id="shrub_01" items={shrubs} height={1.2} wind={0.05} />
      <Instanced id="shrub_02" items={shrubs2} height={1.0} wind={0.05} />
      <Instanced id="fern_02" items={ferns} height={0.7} wind={0.08} shadows={false} />
      <Instanced id="grass_medium_01" items={clumps} height={0.55} wind={0.12} shadows={false} />
      <Instanced id="rock_moss_set_01" items={rocks} height={0.7} />
      <Instanced id="namaqualand_boulder_02" items={boulders} height={1.6} />
    </>
  )
}

/** arbres lointains : versions allégées des mêmes arbres photoscannés */
function FarTrees({ far }: { far: ReturnType<typeof placeTrees> }) {
  const pines = far.filter((t, i) => t.kind === 'pine' && i % 2 === 0)
  const firs = far.filter((t, i) => t.kind === 'pine' && i % 2 === 1)
  const oaks = far.filter((t) => t.kind === 'oak')
  return (
    <>
      <Impostors id="pine_tree_01" items={pines} height={13} />
      <Impostors id="fir_tree_01" items={firs} height={11} />
      <Impostors id="island_tree_02" items={oaks} height={8} />
    </>
  )
}

export function Zone4() {
  const q = QUALITY[G().settings.quality]
  const hdri = useHdri()
  // le soleil, le brouillard et les ombres suivent le vrai ciel photographié
  useMemo(() => {
    SUN4.copy(hdri.sun)
    SUN_FOR_IMPOSTOR.copy(hdri.sun)
    FOG4.copy(hdri.horizon).lerp(new THREE.Color('#9fb0c4'), 0.45)
  }, [hdri])
  const trees = useMemo(() => placeTrees(q.trees), [q.trees])
  const { near, far } = useMemo(() => splitTrees(trees, REAL_TREES[G().settings.quality]), [trees])
  return (
    <group>
      <fogExp2 attach="fog" args={[FOG4, 0.0026]} />
      <Environment map={hdri.texture} background environmentIntensity={0.9} backgroundIntensity={1} />
      <hemisphereLight args={['#a9c2e6', '#5a4a30', 0.25]} />
      <SunLight size={q.sunShadow} />
      <Terrain />
      <Mountains />
      {q.clouds && <CloudLayer />}
      <River />
      <Grass count={q.grass} />
      <Suspense fallback={null}>
        <RealVegetation near={near} q={q} />
        <FarTrees far={far} />
      </Suspense>
      <RoomCtx.Provider value={{ id: 'out', dark: false }}>
        {zone4Props.map((p, i) => (
          <group key={i} position={p.pos} rotation={[0, p.rot ?? 0, 0]}>
            {p.model === 'capsule' && (
              <Falling>
                <Capsule />
              </Falling>
            )}
            {p.model === 'parachute' && <Parachute />}
            {p.model === 'cabin' && <Cabin />}
            {p.model === 'helipad' && <Helipad />}
            {p.model === 'bigRock' && <RealModel id={i % 2 ? 'boulder_01' : 'namaqualand_boulder_02'} height={(p.scale ?? 1) * 1.7} p={[0, -0.25, 0]} />}
          </group>
        ))}
        <Bridge />
        <Helicopter />
      </RoomCtx.Provider>
      <EntModels zone={4} />
      <Colliders />
      <TreeColliders trees={trees} />
      <Ambience />
    </group>
  )
}
