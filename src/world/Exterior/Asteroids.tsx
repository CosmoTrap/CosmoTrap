import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { rockSet } from '../textures'

// Champ d'astéroïdes : rochers irréguliers déplacés au bruit, instanciés, qui dérivent et tournent.
// Une météorite incandescente traverse de temps en temps.

function hash(x: number, y: number, z: number) {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
  return s - Math.floor(s)
}
function vnoise(x: number, y: number, z: number) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const xf = x - xi
  const yf = y - yi
  const zf = z - zi
  const s = (t: number) => t * t * (3 - 2 * t)
  const u = s(xf)
  const v = s(yf)
  const w = s(zf)
  const l = (a: number, b: number, t: number) => a + (b - a) * t
  return l(
    l(l(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v),
    l(l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u), v),
    w,
  )
}

export function rockGeometry(seed: number, detail = 4, rough = 0.35) {
  const g = new THREE.IcosahedronGeometry(1, detail)
  const p = g.attributes.position as THREE.BufferAttribute
  const v = new THREE.Vector3()
  const st = [0.8 + hash(seed, 1, 2) * 0.6, 0.6 + hash(seed, 3, 4) * 0.5, 0.7 + hash(seed, 5, 6) * 0.6]
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i)
    let d = 0
    let a = 1
    let f = 1.3
    for (let o = 0; o < 5; o++) {
      d += (vnoise(v.x * f + seed * 7, v.y * f, v.z * f) - 0.5) * a
      a *= 0.5
      f *= 2.1
    }
    // cratères grossiers
    const c = vnoise(v.x * 2.2 + seed, v.y * 2.2, v.z * 2.2)
    d -= Math.max(0, c - 0.68) * 1.2
    v.multiplyScalar(1 + d * rough)
    v.set(v.x * st[0], v.y * st[1], v.z * st[2])
    p.setXYZ(i, v.x, v.y, v.z)
  }
  g.computeVertexNormals()
  return g
}

export function Asteroids({ center, count = 220 }: { center: THREE.Vector3; count?: number }) {
  const variants = 4
  const geos = useMemo(() => Array.from({ length: variants }, (_, i) => rockGeometry(i + 1)), [])
  const mat = useMemo(() => {
    const s = rockSet(512, '#5e5650')
    return new THREE.MeshStandardMaterial({ ...s, roughness: 1, metalness: 0, envMapIntensity: 0.05, fog: false })
  }, [])
  const per = Math.ceil(count / variants)
  const data = useMemo(
    () =>
      Array.from({ length: variants * per }, (_, i) => {
        // coquille autour de la station, plus dense dans un plan
        const r = 45 + Math.pow(Math.random(), 1.6) * 420
        const a = Math.random() * Math.PI * 2
        const y = (Math.random() - 0.5) * 120 * (r / 300)
        const s = Math.pow(Math.random(), 3) * 14 + 0.6 + (r > 200 ? Math.random() * 10 : 0)
        return {
          p: new THREE.Vector3(center.x + Math.cos(a) * r, center.y + y, center.z + Math.sin(a) * r),
          v: new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.4),
          rot: new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6),
          spin: new THREE.Vector3((Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 0.3),
          s,
        }
      }),
    [center, per],
  )
  const refs = useRef<(THREE.InstancedMesh | null)[]>([])
  const m4 = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const sc = useMemo(() => new THREE.Vector3(), [])
  useFrame((_, dt) => {
    for (let k = 0; k < variants; k++) {
      const im = refs.current[k]
      if (!im) continue
      for (let i = 0; i < per; i++) {
        const d = data[k * per + i]
        d.p.addScaledVector(d.v, dt)
        d.rot.x += d.spin.x * dt
        d.rot.y += d.spin.y * dt
        d.rot.z += d.spin.z * dt
        q.setFromEuler(d.rot)
        sc.setScalar(d.s)
        m4.compose(d.p, q, sc)
        im.setMatrixAt(i, m4)
      }
      im.instanceMatrix.needsUpdate = true
    }
  })
  return (
    <group>
      {geos.map((g, k) => (
        <instancedMesh key={k} ref={(r) => (refs.current[k] = r)} args={[g, mat, per]} castShadow={false} frustumCulled={false} />
      ))}
      <Meteor center={center} />
    </group>
  )
}

function Meteor({ center }: { center: THREE.Vector3 }) {
  const g = useRef<THREE.Group>(null)
  const st = useRef({ t: 99, dur: 4, from: new THREE.Vector3(), dir: new THREE.Vector3() })
  const trail = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uA: { value: 1 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float uA; varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 2.5); gl_FragColor = vec4(vec3(1.0, 0.55, 0.2) * a * 8.0 * uA, 1.0); }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  )
  useFrame((_, dt) => {
    const s = st.current
    s.t += dt
    if (s.t > s.dur + 6 + Math.random() * 8) {
      s.t = 0
      const a = Math.random() * Math.PI * 2
      s.from.set(center.x + Math.cos(a) * 500, center.y + 60 + Math.random() * 80, center.z + Math.sin(a) * 500)
      s.dir.set(-Math.cos(a) + (Math.random() - 0.5), -0.25, -Math.sin(a) + (Math.random() - 0.5)).normalize()
    }
    if (!g.current) return
    const vis = s.t < s.dur
    g.current.visible = vis
    if (!vis) return
    const p = s.from.clone().addScaledVector(s.dir, s.t * 260)
    g.current.position.copy(p)
    g.current.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), s.dir)
  })
  return (
    <group ref={g} visible={false}>
      <mesh>
        <sphereGeometry args={[1.6, 12, 8]} />
        <meshBasicMaterial color={new THREE.Color(9, 4, 1.5)} fog={false} />
      </mesh>
      <mesh position={[0, 30, 0]} material={trail}>
        <cylinderGeometry args={[2.5, 0.5, 60, 12, 1, true]} />
      </mesh>
    </group>
  )
}
