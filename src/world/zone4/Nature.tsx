import { useFrame } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

import { BRIDGE_X, RIVER_HALF, WATER_Y, riverCenter, terrainHeight } from '../../game/maps/zone4'
import { live } from '../../game/state'
import { NOISE } from '../Exterior/glsl'
import { rockGeometry } from '../Exterior/Asteroids'
import { photoSurface } from '../photomaterials'
import { VEHICLES } from '../cine/Rescue'
import { foliageMaterial, makeTreeGeometry } from './foliage'
import { spatialBatches } from './spatialBatches'

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
    const grass = new THREE.Color('#c2c4a6')
    const dry = new THREE.Color('#eee0c3')
    const dirt = new THREE.Color('#b7a18a')
    const rock = new THREE.Color('#d5d4ce')
    const mud = new THREE.Color('#726b5f')
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
    const s = photoSurface('ground', 85)
    const mat = new THREE.MeshStandardMaterial({ ...s, vertexColors: true, roughness: 1, metalness: 0, normalScale: new THREE.Vector2(0.85, 0.85), envMapIntensity: 0.5 })
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

// ——— sol découvert : là où poussent arbres et rochers ———
function grassOK(x: number, z: number) {
  if (Math.abs(z - riverCenter(x)) < RIVER_HALF + 0.4) return false
  if (Math.hypot(x - 6, z + 60) < 6.6) return false
  if (Math.hypot(x, z + 0.2) < 2.8) return false
  if (Math.abs(x + 15) < 2.6 && Math.abs(z + 44) < 2.2) return false
  return true
}

// ——— arbres ———
export interface TreeInst {
  x: number
  z: number
  s: number
  r: number
  kind: 'pine' | 'fir' | 'oak'
}

/** Distance from (x, z) to a polyline. */
function toRoute(x: number, z: number, route: readonly (readonly [number, number])[]) {
  let best = Infinity
  for (let i = 0; i + 1 < route.length; i++) {
    const [ax, az] = route[i], [bx, bz] = route[i + 1]
    const dx = bx - ax, dz = bz - az
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)))
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t))
  }
  return best
}

/** The rescue cinematic's camera positions and what they look at: no trunk or crown in front of the lens. */
const SIGHTLINES: (readonly (readonly [number, number])[])[] = [
  [[14, -50], [12, -48], [6, -60]], [[36, -49], [6, -60]], [[-14, -38], [-10, -42], [10, -62]], [[22, -40], [34, -30]], [[22, -40], [12, -62]],
]

/** Same forest every game (seeded), clear of the paths, key places and every rescue vehicle's road and parking spot. */
export function placeTrees(count: number): TreeInst[] {
  let seed = 7919
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646
  const out: TreeInst[] = []
  let tries = 0
  while (out.length < count && tries < count * 30) {
    tries++
    const x = (rnd() * 2 - 1) * 70
    const z = 40 - rnd() * 130
    const keep = rnd(), size = rnd(), turn = rnd(), species = rnd()
    if (!grassOK(x, z)) continue
    if (VEHICLES.some((v) => toRoute(x, z, v.route) < 6)) continue
    if (SIGHTLINES.some((line) => toRoute(x, z, line) < 5)) continue
    const inPlay = Math.abs(x) < 34 && z > -68 && z < 16
    if (inPlay) {
      if (Math.abs(x - BRIDGE_X + 4) < 6) continue
      if (Math.hypot(x - 15, z + 35) < 5 || Math.hypot(x + 15, z + 44) < 5 || Math.hypot(x + 17, z + 5) < 3) continue
      if (Math.hypot(x, z) < 9 || Math.hypot(x - 6, z + 60) < 11) continue
      if (keep < 0.55) continue
    }
    if (out.some((t) => Math.hypot(t.x - x, t.z - z) < 3)) continue
    out.push({ x, z, s: 0.8 + size * 0.5, r: turn * 6.28, kind: species < 0.4 ? 'pine' : species < 0.7 ? 'fir' : 'oak' })
  }
  return out
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
        float sway = max(0.0, position.y - 1.5) * 0.03;
        vec4 ip = instanceMatrix * vec4(0.0,0.0,0.0,1.0);
        transformed.x += sin(uTime * 1.3 + ip.x * 0.2) * sway;
        transformed.z += cos(uTime * 1.1 + ip.z * 0.2) * sway * 0.6;`,
      )
  }
  return base
}

/** One spatial cell of conifers: trunks and crowns, each a single instanced draw. */
function TreeCell({ items, wood, leaves, bark, foliage }: {
  items: TreeInst[]; wood: THREE.BufferGeometry; leaves: THREE.BufferGeometry
  bark: THREE.Material; foliage: THREE.Material
}) {
  const trunk = useRef<THREE.InstancedMesh>(null)
  const crown = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const matrix = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0)
    const position = new THREE.Vector3(), scale = new THREE.Vector3()
    for (const im of [trunk.current, crown.current]) {
      if (!im) continue
      items.forEach((t, i) => {
        q.setFromAxisAngle(up, t.r)
        im.setMatrixAt(i, matrix.compose(position.set(t.x, terrainHeight(t.x, t.z) - 0.1, t.z), q, scale.setScalar(t.s)))
      })
      im.instanceMatrix.needsUpdate = true
      im.computeBoundingSphere()
      // The crowns sway: widen their bounds so they are never culled while still on screen.
      if (im === crown.current) im.boundingSphere!.radius += 0.5 * Math.max(...items.map((t) => t.s))
    }
  }, [items, leaves])
  return <group>
    <instancedMesh ref={trunk} args={[wood, bark, items.length]} castShadow receiveShadow />
    <instancedMesh ref={crown} args={[leaves, foliage, items.length]} castShadow receiveShadow />
  </group>
}

/**
 * Built in code, three species: pines and firs (whorls of drooping branches covered in fronds) and broadleaf
 * trees. One instanced draw for trunks and one for crowns per species and 24 m cell, so offscreen ones are culled.
 */
export function Trees({ trees }: { trees: TreeInst[] }) {
  const kit = useMemo(() => {
    const bark = new THREE.MeshStandardMaterial({ ...photoSurface('bark', 2), roughness: 1, normalScale: new THREE.Vector2(0.7, 0.7) })
    return {
      bark,
      needles: windMaterial(foliageMaterial('pine')), leaves: windMaterial(foliageMaterial('oak')),
      pine: makeTreeGeometry('pine'), fir: makeTreeGeometry('fir'), oak: makeTreeGeometry('oak'),
    }
  }, [])
  useEffect(() => () => {
    for (const m of [kit.bark, kit.needles, kit.leaves]) { m.map?.dispose(); m.dispose() }
    for (const k of [kit.pine, kit.fir, kit.oak]) { k.wood.dispose(); k.leaves.dispose() }
  }, [kit])
  const cells = useMemo(() => (['pine', 'fir', 'oak'] as const).map((kind) => ({ kind, cells: spatialBatches(trees.filter((t) => t.kind === kind)) })), [trees])
  useFrame(({ clock }) => {
    for (const m of [kit.needles, kit.leaves]) { const sh = m.userData.shader; if (sh) sh.uniforms.uTime.value = clock.elapsedTime }
  })
  return <group name="trees">
    {cells.flatMap(({ kind, cells }) => cells.map((items, i) =>
      <TreeCell key={`${kind}-${i}`} items={items} wood={kit[kind].wood} leaves={kit[kind].leaves} bark={kit.bark} foliage={kind === 'oak' ? kit.leaves : kit.needles} />))}
  </group>
}

// ——— rochers ———
export function Rocks() {
  const { geos, mat, list } = useMemo(() => {
    const s = photoSurface('rock')
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
export function SunLight({ size, every = 1 }: { size: number; every?: number }) {
  const ref = useRef<THREE.DirectionalLight>(null)
  const target = useMemo(() => new THREE.Object3D(), [])
  const last = useRef({ x: NaN, z: NaN, frame: 0 })
  useFrame(() => {
    const l = ref.current
    if (!l) return
    const px = Math.round(live.pos[0] / 2) * 2
    const pz = Math.round(live.pos[2] / 2) * 2
    target.position.set(px, 0, pz)
    l.position.set(px + SUN4.x * 80, SUN4.y * 80 + 10, pz + SUN4.z * 80)
    target.updateMatrixWorld()
    // Redraw the valley's shadow map when it follows the player to a new spot; otherwise only every few
    // frames, for the trees swaying in the wind and the capsule's hatch.
    const k = last.current, moved = px !== k.x || pz !== k.z
    l.shadow.autoUpdate = false
    l.shadow.needsUpdate = moved || ++k.frame % every === 0
    k.x = px; k.z = pz
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
