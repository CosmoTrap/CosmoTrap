import { useFrame, useThree } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { NOISE } from './glsl'

// Ciel étoilé : étoiles ponctuelles (magnitudes, températures) + Voie lactée + soleil.

const R = 9000

/** Same sky at every launch: a small seeded generator instead of Math.random. */
function seeded(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const GALACTIC_POLE = new THREE.Vector3(0.3, 0.9, 0.3).normalize()
/** Star colours by temperature, weighted as seen in the sky: mostly white and pale gold, a few blue or orange. */
const STAR_TINTS: [number, string][] = [[0.08, '#a9c1ff'], [0.26, '#d6e2ff'], [0.62, '#fffaf2'], [0.86, '#ffeccb'], [1, '#ffc592']]

export function Stars({ count = 9000 }: { count?: number }) {
  const geo = useMemo(() => {
    const random = seeded(7)
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const size = new Float32Array(count)
    const c = new THREE.Color()
    const v = new THREE.Vector3()
    for (let i = 0; i < count; i++) {
      // Uniform over the sphere, with most stars gathered along the galactic plane.
      for (let k = 0; k < 6; k++) {
        const y = random() * 2 - 1, a = random() * Math.PI * 2, r = Math.sqrt(1 - y * y)
        v.set(Math.cos(a) * r, y, Math.sin(a) * r)
        if (Math.abs(v.dot(GALACTIC_POLE)) < 0.22 || random() < 0.3) break
      }
      pos.set([v.x * R * 0.95, v.y * R * 0.95, v.z * R * 0.95], i * 3)
      const t = random()
      c.set(STAR_TINTS.find(([limit]) => t <= limit)![1])
      // Real magnitudes: a sky of very faint dust, a few clear stars, a handful of bright ones.
      const mag = Math.pow(random(), 34)
      const b = 0.2 + Math.pow(random(), 2.5) * 0.65 + mag * 1.3
      col.set([c.r * b, c.g * b, c.b * b], i * 3)
      size[i] = 1.5 + Math.pow(random(), 5) * 1.1 + mag * 5.5
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
        uniforms: { uPx: { value: Math.min(window.devicePixelRatio, 2) } },
        // No twinkle: without an atmosphere, stars hold perfectly steady.
        vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; varying float vS; uniform float uPx;
          void main(){ vC = color; vS = size; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * uPx; }`,
        // A sharp core, a soft halo, and fine diffraction spikes on the brightest stars only.
        fragmentShader: `varying vec3 vC; varying float vS; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d);
          float core = exp(-r * r * 60.0); float halo = 0.08 * exp(-r * r * 12.0) * smoothstep(0.5, 0.3, r);
          float big = smoothstep(3.6, 6.5, vS);
          float spike = big * 0.5 * (exp(-abs(d.x) * 70.0) * exp(-abs(d.y) * 7.0) + exp(-abs(d.y) * 70.0) * exp(-abs(d.x) * 7.0)) * smoothstep(0.5, 0.25, r);
          gl_FragColor = vec4(vC * (core + halo + spike), 1.0); }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        fog: false,
      }),
    [],
  )
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
  // The Milky Way: a soft band, torn by dark dust lanes, swelling towards the galactic core.
  vec3 warp = d * 3.5 + fbm(d * 2.5) * 1.1;
  float n = fbm(warp);
  float band = exp(-b * b * 22.0) * (0.3 + 0.7 * n);
  float core = exp(-pow(length(d - normalize(vec3(-0.6, 0.15, -0.78))), 2.0) * 2.4);
  float dust = smoothstep(0.42, 0.68, fbm(warp * 2.6 + 3.0)) * exp(-b * b * 50.0);
  float glow = band * (1.0 - dust * 0.85) + core * exp(-b * b * 9.0) * (1.0 - dust * 0.7) * 0.9;
  vec3 col = mix(vec3(0.36, 0.43, 0.62), vec3(1.0, 0.8, 0.58), core) * glow * 0.11;
  // Faint coloured nebulae, far from the band: barely there, as to the naked eye.
  float cloud = smoothstep(0.5, 0.82, fbm(d * 1.9 + 11.0));
  col += mix(vec3(0.05, 0.11, 0.17), vec3(0.15, 0.04, 0.12), smoothstep(0.35, 0.7, fbm(d * 1.3 + 5.0))) * cloud * 0.22;
  // Deep black, with just a hint of blue: never a flat grey.
  col += vec3(0.0015, 0.002, 0.0045);
  gl_FragColor = vec4(col, 1.0);
}`

/**
 * The sky's noise is far too costly to run on every pixel of every frame, and it never changes:
 * it is painted once into a cube texture, which then only needs reading.
 */
export function MilkyWay() {
  const gl = useThree((state) => state.gl)
  const ref = useRef<THREE.Mesh>(null)
  const target = useMemo(() => new THREE.WebGLCubeRenderTarget(1024, { type: THREE.HalfFloatType, generateMipmaps: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }), [])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uSky: { value: target.texture } },
        vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
        fragmentShader: `uniform samplerCube uSky; varying vec3 vDir; void main(){ gl_FragColor = vec4(textureCube(uSky, normalize(vDir)).rgb, 1.0); }`,
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
      }),
    [target],
  )
  useLayoutEffect(() => {
    const paint = new THREE.ShaderMaterial({
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: skyFrag,
      side: THREE.BackSide,
      depthWrite: false,
    })
    const scene = new THREE.Scene()
    const dome = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 24), paint)
    scene.add(dome)
    const toneMapping = gl.toneMapping
    gl.toneMapping = THREE.NoToneMapping
    new THREE.CubeCamera(0.1, 100, target).update(gl, scene)
    gl.toneMapping = toneMapping
    dome.geometry.dispose()
    paint.dispose()
    return () => { target.dispose(); mat.dispose() }
  }, [gl, target, mat])
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
