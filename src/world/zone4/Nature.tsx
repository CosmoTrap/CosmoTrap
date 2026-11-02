import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BRIDGE_X, RIVER_HALF, WATER_Y, riverCenter, terrainHeight } from '../../game/maps/zone4'
import { live } from '../../game/state'
import { NOISE } from '../Exterior/glsl'
import { rockGeometry } from '../Exterior/Asteroids'
import { groundSet, rockSet } from '../textures'

export const SUN4 = new THREE.Vector3(-0.55, 0.13, -0.82).normalize()
export const SUN4_COLOR = new THREE.Color('#ffbd7a')
export const SKY4 = new THREE.Color('#8fb2dc')
export const FOG4 = new THREE.Color('#d8b89a')

// ——— terrain ———
export function buildTerrain(size: number, seg: number, cx: number, cz: number) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg)
  g.rotateX(-Math.PI / 2)
  g.translate(cx, 0, cz)
  const p = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < p.count; i++) p.setY(i, terrainHeight(p.getX(i), p.getZ(i)))
  g.computeVertexNormals()
  return g
}

export function Terrain() {
  const { geo, mat } = useMemo(() => {
    const geo = buildTerrain(260, 220, 0, -26)
    const p = geo.attributes.position as THREE.BufferAttribute
    const n = geo.attributes.normal as THREE.BufferAttribute
    const col = new Float32Array(p.count * 3)
    const c = new THREE.Color()
    const grass = new THREE.Color('#7a8a3e')
    const dry = new THREE.Color('#a39256')
    const dirt = new THREE.Color('#6b5235')
    const rock = new THREE.Color('#77736c')
    const mud = new THREE.Color('#4a3d2c')
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const z = p.getZ(i)
      const y = p.getY(i)
      const slope = 1 - n.getY(i)
      const dr = Math.abs(z - riverCenter(x))
      const k = (Math.sin(x * 0.11) * Math.cos(z * 0.09) + 1) * 0.5
      c.copy(grass).lerp(dry, k * 0.6)
      // sentier vers le pont puis l'hélisurface
      const path = Math.min(Math.abs(x - (BRIDGE_X - 4 + Math.sin(z * 0.08) * 3)), 99)
      if (path < 1.1 && z > -64) c.lerp(dirt, 0.8 * (1 - path / 1.1))
      if (dr < RIVER_HALF + 1.2) c.lerp(mud, THREE.MathUtils.smoothstep(RIVER_HALF + 1.2 - dr, 0, 1.5))
      c.lerp(rock, THREE.MathUtils.smoothstep(slope, 0.25, 0.5))
      if (y > 6) c.lerp(rock, 0.5)
      col.set([c.r, c.g, c.b], i * 3)
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3))
    const s = groundSet(1024)
    for (const t of [s.map, s.normalMap, s.roughnessMap]) t.repeat.set(70, 70)
    const mat = new THREE.MeshStandardMaterial({ ...s, vertexColors: true, roughness: 1, metalness: 0, envMapIntensity: 0.4 })
    mat.color.set('#ffffff')
    return { geo, mat }
  }, [])
  return <mesh geometry={geo} material={mat} receiveShadow />
}

// ——— montagnes lointaines ———
export function Mountains() {
  const geo = useMemo(() => {
    const g = new THREE.CylinderGeometry(560, 620, 1, 220, 18, true)
    const p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      const z = p.getZ(i)
      const t = p.getY(i) + 0.5 // 0 bas, 1 haut
      const a = Math.atan2(z, x)
      let h = 0
      let amp = 1
      let f = 3
      for (let o = 0; o < 5; o++) {
        h += amp * (1 - Math.abs(Math.sin(a * f + o * 1.7 + Math.sin(a * f * 0.5 + o))))
        amp *= 0.5
        f *= 2.2
      }
      const H = 60 + h * 110
      const r = 1 - t * 0.35
      p.setXYZ(i, x * r, -10 + t * H, z * r - 26)
    }
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color="#5f6f86" roughness={1} side={THREE.DoubleSide} envMapIntensity={0.3} />
    </mesh>
  )
}

// ——— herbe instanciée, ondulant au vent ———
const grassVert = /* glsl */ `
attribute vec3 aOffset;
attribute vec2 aScale; // hauteur, angle
uniform float uTime;
varying float vH;
varying vec3 vW;
varying float vRnd;
#include <fog_pars_vertex>
void main(){
  vec3 p = position;
  float h = aScale.x;
  float t = p.y; // 0..1
  vH = t;
  vRnd = fract(aOffset.x * 13.7 + aOffset.z * 7.1);
  float c = cos(aScale.y), s = sin(aScale.y);
  p.xz = mat2(c, -s, s, c) * p.xz;
  p.y *= h;
  vec3 w = aOffset + p;
  float wind = sin(uTime * 1.6 + aOffset.x * 0.35 + aOffset.z * 0.22) * 0.5 + sin(uTime * 2.7 + aOffset.x * 1.3) * 0.2;
  float gust = smoothstep(0.3, 1.0, sin(uTime * 0.35 + aOffset.x * 0.05 - aOffset.z * 0.03));
  float bend = (wind * (0.25 + gust * 0.45) + 0.12) * t * t * h;
  w.x += bend * 0.8;
  w.z += bend * 0.5;
  w.y -= abs(bend) * 0.25 * t;
  vW = w;
  vec4 mvPosition = viewMatrix * vec4(w, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`
const grassFrag = /* glsl */ `
uniform vec3 uSun;
uniform vec3 uSunCol;
uniform vec3 uSky;
varying float vH;
varying vec3 vW;
varying float vRnd;
#include <fog_pars_fragment>
void main(){
  vec3 base = mix(vec3(0.04, 0.07, 0.02), vec3(0.12, 0.17, 0.05), vRnd);
  vec3 tip = mix(vec3(0.3, 0.44, 0.12), vec3(0.46, 0.5, 0.18), vRnd);
  vec3 alb = mix(base, tip, smoothstep(0.0, 1.0, vH));
  vec3 V = normalize(cameraPosition - vW);
  float back = pow(max(dot(-V, normalize(uSun)), 0.0), 4.0);
  vec3 col = alb * (uSunCol * (0.55 + 0.35 * vH) + uSky * 0.35) * (0.35 + 0.65 * vH);
  col += uSunCol * alb * back * 1.1 * vH;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`

function grassOK(x: number, z: number) {
  if (Math.abs(z - riverCenter(x)) < RIVER_HALF + 0.4) return false
  if (Math.hypot(x - 6, z + 60) < 6.6) return false
  if (Math.hypot(x, z + 0.2) < 2.8) return false
  if (Math.abs(x + 15) < 2.6 && Math.abs(z + 44) < 2.2) return false
  return true
}

export function Grass({ count }: { count: number }) {
  const { geo, mat } = useMemo(() => {
    const blade = new THREE.BufferGeometry()
    const w = 0.032
    // lame à 5 sommets (triangle strip en 3 tris)
    const v = [-w, 0, 0, w, 0, 0, -w * 0.7, 0.45, 0.01, w * 0.7, 0.45, 0.01, 0, 1, 0.03]
    blade.setAttribute('position', new THREE.Float32BufferAttribute(v, 3))
    blade.setIndex([0, 1, 2, 2, 1, 3, 2, 3, 4])
    const g = new THREE.InstancedBufferGeometry()
    g.index = blade.index
    g.attributes.position = blade.attributes.position
    const off = new Float32Array(count * 3)
    const sc = new Float32Array(count * 2)
    let n = 0
    let tries = 0
    while (n < count && tries < count * 3) {
      tries++
      // plus dense près du joueur : distribution concentrée sur la zone jouable
      const x = (Math.random() * 2 - 1) * 46
      const z = 24 - Math.random() * 104
      if (!grassOK(x, z)) continue
      const clump = Math.sin(x * 0.3) * Math.cos(z * 0.27)
      if (clump < -0.6 && Math.random() < 0.7) continue
      off.set([x, terrainHeight(x, z) - 0.02, z], n * 3)
      sc.set([0.25 + Math.random() * 0.55 + Math.max(0, clump) * 0.35, Math.random() * Math.PI * 2], n * 2)
      n++
    }
    g.setAttribute('aOffset', new THREE.InstancedBufferAttribute(off, 3))
    g.setAttribute('aScale', new THREE.InstancedBufferAttribute(sc, 2))
    g.instanceCount = n
    const mat = new THREE.ShaderMaterial({
      vertexShader: grassVert,
      fragmentShader: grassFrag,
      side: THREE.DoubleSide,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uTime: { value: 0 }, uSun: { value: SUN4.clone() }, uSunCol: { value: SUN4_COLOR.clone().multiplyScalar(2.2) }, uSky: { value: SKY4.clone() } },
      ]),
    })
    return { geo: g, mat }
  }, [count])
  useFrame(({ clock }) => (mat.uniforms.uTime.value = clock.elapsedTime))
  return <mesh geometry={geo} material={mat} frustumCulled={false} />
}

// ——— arbres ———
function treeGeometry(kind: 'pine' | 'oak') {
  const parts: THREE.BufferGeometry[] = []
  const colorize = (g: THREE.BufferGeometry, c: THREE.Color, jitter = 0.08) => {
    const n = g.attributes.position.count
    const col = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) {
      const k = 1 + (Math.random() - 0.5) * jitter * 2
      col.set([c.r * k, c.g * k, c.b * k], i * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    return g
  }
  const trunkH = kind === 'pine' ? 3 : 2.4
  const trunk = new THREE.CylinderGeometry(0.12, 0.22, trunkH, 7)
  trunk.translate(0, trunkH / 2, 0)
  parts.push(colorize(trunk.toNonIndexed(), new THREE.Color('#4a3524')))
  if (kind === 'pine') {
    for (let i = 0; i < 5; i++) {
      const r = 1.6 - i * 0.28
      const c = new THREE.ConeGeometry(r, 1.9, 9, 2)
      const p = c.attributes.position as THREE.BufferAttribute
      for (let k = 0; k < p.count; k++) p.setXYZ(k, p.getX(k) * (0.85 + Math.random() * 0.3), p.getY(k), p.getZ(k) * (0.85 + Math.random() * 0.3))
      c.translate(0, 2.2 + i * 1.05, 0)
      parts.push(colorize(c.toNonIndexed(), new THREE.Color(i % 2 ? '#1f3a22' : '#26452a')))
    }
  } else {
    for (let i = 0; i < 7; i++) {
      const s = new THREE.IcosahedronGeometry(1.1 + Math.random() * 0.6, 1)
      const p = s.attributes.position as THREE.BufferAttribute
      for (let k = 0; k < p.count; k++) {
        const f = 0.85 + Math.random() * 0.3
        p.setXYZ(k, p.getX(k) * f, p.getY(k) * f * 0.85, p.getZ(k) * f)
      }
      const a = (i / 7) * Math.PI * 2
      s.translate(i === 0 ? 0 : Math.cos(a) * 1.1, 3.0 + (i === 0 ? 1.0 : Math.random() * 0.8), i === 0 ? 0 : Math.sin(a) * 1.1)
      parts.push(colorize(s.toNonIndexed(), new THREE.Color(['#3d5a24', '#4a6a2a', '#56722e'][i % 3]), 0.15))
    }
  }
  const g = mergeGeometries(parts)!
  g.computeVertexNormals()
  return g
}

function windMaterial(base: THREE.MeshStandardMaterial) {
  base.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = { value: 0 }
    base.userData.shader = sh
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float sway = max(0.0, position.y - 1.5) * 0.035;
        vec4 ip = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
        transformed.x += sin(uTime * 1.3 + ip.x * 0.2) * sway;
        transformed.z += cos(uTime * 1.1 + ip.z * 0.2) * sway * 0.6;`,
      )
  }
  return base
}

export interface TreeInst {
  x: number
  z: number
  s: number
  r: number
  kind: 'pine' | 'oak'
}

export function placeTrees(count: number): TreeInst[] {
  const out: TreeInst[] = []
  let tries = 0
  while (out.length < count && tries < count * 20) {
    tries++
    const x = (Math.random() * 2 - 1) * 70
    const z = 40 - Math.random() * 130
    if (!grassOK(x, z)) continue
    // dégager le sentier central et les lieux clés
    const inPlay = Math.abs(x) < 34 && z > -68 && z < 16
    if (inPlay) {
      if (Math.abs(x - BRIDGE_X + 4) < 6) continue
      if (Math.hypot(x - 15, z + 35) < 5 || Math.hypot(x + 15, z + 44) < 5 || Math.hypot(x + 17, z + 5) < 3) continue
      if (Math.hypot(x, z) < 9 || Math.hypot(x - 6, z + 60) < 9) continue
      if (Math.random() < 0.55) continue
    }
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 2.5)) continue
    out.push({ x, z, s: 0.8 + Math.random() * 0.7, r: Math.random() * 6.28, kind: Math.random() < 0.6 ? 'pine' : 'oak' })
  }
  return out
}

export function Trees({ trees }: { trees: TreeInst[] }) {
  const pineRef = useRef<THREE.InstancedMesh>(null)
  const oakRef = useRef<THREE.InstancedMesh>(null)
  const { pine, oak, mat } = useMemo(() => {
    const mat = windMaterial(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, envMapIntensity: 0.5 }))
    return { pine: treeGeometry('pine'), oak: treeGeometry('oak'), mat }
  }, [])
  const pines = trees.filter((t) => t.kind === 'pine')
  const oaks = trees.filter((t) => t.kind === 'oak')
  useMemo(() => {
    requestAnimationFrame(() => {
      const m = new THREE.Matrix4()
      const q = new THREE.Quaternion()
      const fill = (im: THREE.InstancedMesh | null, list: TreeInst[]) => {
        if (!im) return
        list.forEach((t, i) => {
          q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), t.r)
          m.compose(new THREE.Vector3(t.x, terrainHeight(t.x, t.z) - 0.1, t.z), q, new THREE.Vector3(t.s, t.s, t.s))
          im.setMatrixAt(i, m)
        })
        im.instanceMatrix.needsUpdate = true
        im.computeBoundingSphere()
      }
      fill(pineRef.current, pines)
      fill(oakRef.current, oaks)
    })
  }, [trees])
  useFrame(({ clock }) => {
    const sh = mat.userData.shader
    if (sh) sh.uniforms.uTime.value = clock.elapsedTime
  })
  return (
    <group>
      <instancedMesh ref={pineRef} args={[pine, mat, pines.length]} castShadow receiveShadow frustumCulled={false} />
      <instancedMesh ref={oakRef} args={[oak, mat, oaks.length]} castShadow receiveShadow frustumCulled={false} />
    </group>
  )
}

// ——— rochers ———
export function Rocks() {
  const { geos, mat, list } = useMemo(() => {
    const s = rockSet(512, '#857d72')
    const mat = new THREE.MeshStandardMaterial({ ...s, roughness: 1, metalness: 0 })
    const geos = [1, 2, 3].map((i) => rockGeometry(i + 10, 3, 0.3))
    const list: { x: number; z: number; s: number; k: number; r: number }[] = []
    for (let i = 0; i < 90; i++) {
      const x = (Math.random() * 2 - 1) * 60
      const z = 30 - Math.random() * 110
      if (!grassOK(x, z) && Math.abs(z - riverCenter(x)) > RIVER_HALF) continue
      if (Math.abs(x - BRIDGE_X + 4) < 3 && z > -64) continue
      list.push({ x, z, s: 0.15 + Math.pow(Math.random(), 3) * 0.9, k: i % 3, r: Math.random() * 6 })
    }
    return { geos, mat, list }
  }, [])
  return (
    <group>
      {geos.map((g, k) => {
        const items = list.filter((l) => l.k === k)
        return <RockSet key={k} geo={g} mat={mat} items={items} />
      })}
    </group>
  )
}

function RockSet({ geo, mat, items }: { geo: THREE.BufferGeometry; mat: THREE.Material; items: { x: number; z: number; s: number; r: number }[] }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  useMemo(() => {
    requestAnimationFrame(() => {
      const im = ref.current
      if (!im) return
      const m = new THREE.Matrix4()
      items.forEach((it, i) => {
        m.compose(new THREE.Vector3(it.x, terrainHeight(it.x, it.z) - it.s * 0.3, it.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(it.r, it.r * 2, 0)), new THREE.Vector3(it.s * 1.4, it.s, it.s * 1.2))
        im.setMatrixAt(i, m)
      })
      im.instanceMatrix.needsUpdate = true
      im.computeBoundingSphere()
    })
  }, [items])
  return <instancedMesh ref={ref} args={[geo, mat, items.length]} castShadow receiveShadow />
}

// ——— rivière ———
const waterFrag = /* glsl */ `
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uSunCol;
uniform vec3 uSky;
uniform vec3 uHorizon;
varying vec3 vW;
varying vec2 vUv;
${NOISE}
#include <fog_pars_fragment>
void main(){
  vec2 flow = vec2(uTime * 0.9, 0.0);
  float e = 0.15;
  vec3 q = vec3(vW.x * 0.6 - flow.x, vW.z * 1.4, uTime * 0.3);
  float h0 = fbm3(q);
  float hx = fbm3(q + vec3(e, 0, 0));
  float hz = fbm3(q + vec3(0, e, 0));
  vec3 q2 = vec3(vW.x * 2.2 - flow.x * 2.0, vW.z * 3.0, uTime * 0.5);
  float g0 = fbm3(q2);
  vec3 N = normalize(vec3((h0 - hx) * 1.2 + (g0 - fbm3(q2 + vec3(e,0,0))) * 0.5, 1.0, (h0 - hz) * 1.2));
  vec3 V = normalize(cameraPosition - vW);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
  vec3 R = reflect(-V, N);
  vec3 sky = mix(uHorizon, uSky, smoothstep(0.0, 0.5, R.y));
  vec3 deep = vec3(0.02, 0.06, 0.06);
  vec3 col = mix(deep, sky, fres);
  float spec = pow(max(dot(R, normalize(uSun)), 0.0), 220.0);
  col += uSunCol * spec * 14.0;
  float edge = 1.0 - smoothstep(0.0, 0.12, min(vUv.y, 1.0 - vUv.y));
  float foam = edge * smoothstep(0.5, 0.75, fbm3(vec3(vW.x * 3.0 - uTime * 1.5, vW.z * 3.0, 0.0)));
  col = mix(col, vec3(0.85, 0.82, 0.75) * (uSunCol * 0.4 + 0.3), foam * 0.7);
  float alpha = mix(0.82, 0.95, fres) * (1.0 - edge * 0.35);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}`

export function River() {
  const { geo, mat } = useMemo(() => {
    const len = 260
    const segs = 260
    const g = new THREE.PlaneGeometry(len, (RIVER_HALF + 1.2) * 2, segs, 4)
    g.rotateX(-Math.PI / 2)
    const p = g.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i)
      p.setXYZ(i, x, WATER_Y, p.getZ(i) + riverCenter(x))
    }
    g.computeVertexNormals()
    const mat = new THREE.ShaderMaterial({
      vertexShader: `varying vec3 vW;
varying vec2 vUv;
#include <fog_pars_vertex>
void main(){
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vW = w.xyz;
  vec4 mvPosition = viewMatrix * w;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`,
      fragmentShader: waterFrag,
      transparent: true,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([
        THREE.UniformsLib.fog,
        { uTime: { value: 0 }, uSun: { value: SUN4.clone() }, uSunCol: { value: SUN4_COLOR.clone() }, uSky: { value: new THREE.Color('#5d86c0') }, uHorizon: { value: new THREE.Color('#f0c9a0') } },
      ]),
    })
    return { geo: g, mat }
  }, [])
  useFrame(({ clock }) => (mat.uniforms.uTime.value = clock.elapsedTime))
  return <mesh geometry={geo} material={mat} receiveShadow renderOrder={2} />
}

// ——— nuages (billboards éclairés) ———
export function CloudLayer() {
  const { tex, list } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = c.height = 256
    const ctx = c.getContext('2d')!
    for (let i = 0; i < 40; i++) {
      const x = 60 + Math.random() * 136
      const y = 90 + Math.random() * 70 - (Math.abs(x - 128) < 40 ? 20 : 0)
      const r = 20 + Math.random() * 40
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, 'rgba(255,255,255,0.35)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, 256, 256)
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    const list = Array.from({ length: 22 }, (_, i) => {
      const a = (i / 22) * Math.PI * 2 + Math.random() * 0.3
      const d = 380 + Math.random() * 250
      return { p: [Math.cos(a) * d, 70 + Math.random() * 90, Math.sin(a) * d - 26] as [number, number, number], s: 120 + Math.random() * 160 }
    })
    return { tex, list }
  }, [])
  return (
    <group>
      {list.map((c, i) => {
        const toSun = new THREE.Vector3(...c.p).normalize().dot(SUN4)
        const col = new THREE.Color('#ffd9b8').lerp(new THREE.Color('#ff9a6a'), Math.max(0, toSun)).multiplyScalar(1.1 + Math.max(0, toSun) * 1.4)
        return (
          <sprite key={i} position={c.p} scale={[c.s, c.s * 0.45, 1]}>
            <spriteMaterial map={tex} color={col} transparent depthWrite={false} fog={false} opacity={0.9} />
          </sprite>
        )
      })}
    </group>
  )
}

/** l'ombre portée suit le joueur */
export function SunLight({ size }: { size: number }) {
  const ref = useRef<THREE.DirectionalLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  useFrame(() => {
    const l = ref.current
    if (!l) return
    const px = Math.round(live.pos[0] / 2) * 2
    const pz = Math.round(live.pos[2] / 2) * 2
    target.position.set(px, 0, pz)
    l.position.set(px + SUN4.x * 80, SUN4.y * 80 + 10, pz + SUN4.z * 80)
    target.updateMatrixWorld()
  })
  return (
    <>
      <primitive object={target} />
      <directionalLight
        ref={ref}
        target={target}
        color={SUN4_COLOR}
        intensity={3.4}
        castShadow={size > 0}
        shadow-mapSize={[size || 512, size || 512]}
        shadow-camera-left={-45}
        shadow-camera-right={45}
        shadow-camera-top={45}
        shadow-camera-bottom={-45}
        shadow-camera-near={1}
        shadow-camera-far={220}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
      />
    </>
  )
}
