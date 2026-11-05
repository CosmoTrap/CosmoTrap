import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { NOISE } from './glsl'

// Ciel étoilé : étoiles ponctuelles (magnitudes, températures) + Voie lactée + soleil.

const R = 9000

export function Stars({ count = 9000 }: { count?: number }) {
  const geo = useMemo(() => {
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const size = new Float32Array(count)
    const galN = new THREE.Vector3(0.3, 0.9, 0.3).normalize()
    const c = new THREE.Color()
    for (let i = 0; i < count; i++) {
      let v = new THREE.Vector3()
      // concentration le long du plan galactique
      for (let k = 0; k < 4; k++) {
        v.set(Math.random() * 2 - 1, Math.random() * 2 - 1, Math.random() * 2 - 1).normalize()
        if (Math.random() > 0.45 || Math.abs(v.dot(galN)) < 0.25) break
      }
      v = v.multiplyScalar(R * 0.95)
      pos.set([v.x, v.y, v.z], i * 3)
      const t = Math.random()
      c.set(t < 0.1 ? '#9bb5ff' : t < 0.55 ? '#fff4e8' : t < 0.85 ? '#ffe3b0' : '#ffb27a')
      const mag = Math.pow(Math.random(), 7)
      const b = 0.35 + mag * 3.5
      col.set([c.r * b, c.g * b, c.b * b], i * 3)
      size[i] = 1.2 + mag * 4.5
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    g.setAttribute('size', new THREE.BufferAttribute(size, 1))
    return g
  }, [count])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uPx: { value: Math.min(window.devicePixelRatio, 2) } },
        vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; uniform float uTime; uniform float uPx;
          void main(){ vC = color * (0.85 + 0.15 * sin(uTime * 2.0 + position.x * 0.01));
            vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * uPx; }`,
        fragmentShader: `varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d);
          float a = exp(-r * r * 40.0) + 0.15 * exp(-r * r * 6.0); gl_FragColor = vec4(vC * a, 1.0); }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )
  useFrame(({ clock }) => (mat.uniforms.uTime.value = clock.elapsedTime))
  const ref = useRef<THREE.Points>(null)
  useFrame(({ camera }) => ref.current?.position.copy(camera.position))
  return <points ref={ref} geometry={geo} material={mat} frustumCulled={false} renderOrder={-10} />
}

const skyFrag = /* glsl */ `
varying vec3 vDir;
${NOISE}
void main(){
  vec3 d = normalize(vDir);
  vec3 gN = normalize(vec3(0.3, 0.9, 0.3));
  float b = dot(d, gN);
  float band = exp(-b * b * 18.0);
  float core = exp(-pow(length(d - normalize(vec3(-0.6, 0.15, -0.78))), 2.0) * 2.0);
  float n = fbm(d * 6.0);
  float dust = smoothstep(0.45, 0.7, fbm(d * 9.0 + 3.0));
  float glow = band * (0.35 + 0.65 * n) * (1.0 - dust * 0.75) + core * band * 0.8;
  vec3 col = mix(vec3(0.35, 0.4, 0.55), vec3(0.95, 0.8, 0.6), core) * glow * 0.09;
  col += vec3(0.006, 0.008, 0.016);
  gl_FragColor = vec4(col, 1.0);
}`

export function MilkyWay() {
  const ref = useRef<THREE.Mesh>(null)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: skyFrag,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [],
  )
  useFrame(({ camera }) => ref.current?.position.copy(camera.position))
  return (
    // Let opaque walls/planets fill depth first: the procedural sky is only
    // shaded in the remaining pixels, including the real window openings.
    <mesh ref={ref} material={mat} renderOrder={101} frustumCulled={false}>
      <sphereGeometry args={[R, 48, 32]} />
    </mesh>
  )
}

/** disque solaire très lumineux (bloom) */
export function Sun({ dir }: { dir: THREE.Vector3 }) {
  const ref = useRef<THREE.Group>(null)
  const mat = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const ctx = c.getContext('2d')!
    const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.08, 'rgba(255,250,235,1)')
    g.addColorStop(0.12, 'rgba(255,220,170,0.5)')
    g.addColorStop(0.35, 'rgba(255,190,130,0.08)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 256, 256)
    return new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), color: new THREE.Color(14, 13, 12), blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, fog: false })
  }, [])
  // Assez près pour que le tampon de profondeur distingue un rocher du disque : un astéroïde devant le soleil le masque.
  const dist = 420
  const scale = 1100 * (dist / (R * 0.8))
  useFrame(({ camera }) => ref.current?.position.copy(camera.position).addScaledVector(dir, dist))
  return (
    <group ref={ref}>
      <sprite material={mat} scale={[scale, scale, 1]} />
    </group>
  )
}

/** étoiles filantes toutes les 6 à 10 s */
export function ShootingStars() {
  const ref = useRef<THREE.Mesh>(null)
  const st = useRef({ t: 0, next: 3, from: new THREE.Vector3(), dir: new THREE.Vector3(), len: 1 })
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uA: { value: 0 } },
        vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform float uA; varying vec2 vUv; void main(){ float a = pow(vUv.x, 3.0) * (1.0 - pow(abs(vUv.y - 0.5) * 2.0, 2.0)); gl_FragColor = vec4(vec3(1.0,0.95,0.85) * a * uA * 6.0, 1.0); }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )
  useFrame(({ camera }, dt) => {
    const s = st.current
    s.t += dt
    if (s.t > s.next) {
      s.t = 0
      s.next = 6 + Math.random() * 4
      const a = Math.random() * Math.PI * 2
      s.from.set(Math.cos(a), 0.05 + Math.random() * 0.25, Math.sin(a)).normalize().multiplyScalar(4000)
      s.dir.set(-Math.sin(a), -0.2 - Math.random() * 0.3, Math.cos(a)).normalize()
      s.len = 300 + Math.random() * 300
    }
    const k = s.t / 1.1
    const m = ref.current
    if (!m) return
    if (k > 1) {
      mat.uniforms.uA.value = 0
      return
    }
    mat.uniforms.uA.value = Math.sin(k * Math.PI)
    const p = s.from.clone().addScaledVector(s.dir, k * 1400).add(camera.position)
    m.position.copy(p)
    m.lookAt(p.clone().add(s.dir))
    m.rotateY(-Math.PI / 2)
    m.scale.set(s.len, 3.5, 1)
  })
  return (
    <mesh ref={ref} material={mat} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
    </mesh>
  )
}
