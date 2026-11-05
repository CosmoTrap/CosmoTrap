import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { useMemo } from 'react'
import * as THREE from 'three'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { BRIDGE_X, RIVER_HALF, riverCenter, terrainHeight } from '../../game/maps/zone4'
import { pbr, useModelParts } from '../assets'
import type { TreeInst } from './Nature'

// Nature photoréaliste : ciel HDRI réel (le soleil est calé sur sa position), terrain en textures photo,
// arbres, buissons et rochers photoscannés instanciés.

export const HDRI = '/assets/hdri/qwantani_sunset_puresky.hdr'

/** charge l'HDRI et en déduit la direction du soleil (pixel le plus lumineux) et la couleur de l'horizon */
export function useHdri() {
  const t = useLoader(RGBELoader, HDRI)
  return useMemo(() => {
    t.mapping = THREE.EquirectangularReflectionMapping
    const img = t.image as unknown as { data: Uint16Array | Float32Array; width: number; height: number }
    const { width: W, height: H, data } = img
    const half = data instanceof Uint16Array
    const val = (i: number) => (half ? THREE.DataUtils.fromHalfFloat(data[i]) : data[i])
    let best = -1
    let bx = 0
    let by = 0
    const hz = [0, 0, 0]
    let hn = 0
    for (let y = 0; y < H; y += 2)
      for (let x = 0; x < W; x += 2) {
        const i = (y * W + x) * 4
        const l = val(i) * 0.2126 + val(i + 1) * 0.7152 + val(i + 2) * 0.0722
        if (l > best) {
          best = l
          bx = x
          by = y
        }
        if (Math.abs(y - H / 2) < H * 0.03) {
          hz[0] += val(i)
          hz[1] += val(i + 1)
          hz[2] += val(i + 2)
          hn++
        }
      }
    // repère équirectangulaire de three.js (texture retournée : ligne 0 = haut)
    const u = (bx + 0.5) / W
    const v = t.flipY ? 1 - (by + 0.5) / H : (by + 0.5) / H
    const lat = (v - 0.5) * Math.PI
    const lon = (u - 0.5) * Math.PI * 2
    const sun = new THREE.Vector3(Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)).normalize()
    if (sun.y < 0.04) sun.y = 0.04
    sun.normalize()
    const horizon = new THREE.Color(hz[0] / hn, hz[1] / hn, hz[2] / hn)
    const m = Math.max(horizon.r, horizon.g, horizon.b)
    horizon.multiplyScalar(0.85 / Math.max(m, 1e-3))
    return { texture: t, sun, horizon }
  }, [t])
}

/** terrain : mélange herbe / boue / roche en textures photo, selon les poids sommet par sommet */
export function splatMaterial() {
  const g = pbr('leafy_grass', [70, 70])
  const m = pbr('brown_mud', [80, 80])
  const r = pbr('gray_rocks', [50, 50])
  const mat = new THREE.MeshStandardMaterial({ map: g.map, normalMap: g.normalMap, roughness: 1, metalness: 0, envMapIntensity: 0.6 })
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.tMud = { value: m.map }
    sh.uniforms.tRock = { value: r.map }
    sh.uniforms.nMud = { value: m.normalMap }
    sh.uniforms.nRock = { value: r.normalMap }
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec3 aSplat;\nvarying vec3 vSplat;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSplat = aSplat;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tMud; uniform sampler2D tRock; uniform sampler2D nMud; uniform sampler2D nRock; varying vec3 vSplat;')
      .replace(
        '#include <map_fragment>',
        `vec4 cG = texture2D(map, vMapUv);
         vec4 cM = texture2D(tMud, vMapUv * 1.33);
         vec4 cR = texture2D(tRock, vMapUv * 0.83);
         vec3 w = vSplat / max(vSplat.x + vSplat.y + vSplat.z, 1e-3);
         diffuseColor *= cG * w.x + cM * w.y + cR * w.z;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `vec3 nG = texture2D(normalMap, vNormalMapUv).xyz * 2.0 - 1.0;
         vec3 nM = texture2D(nMud, vNormalMapUv * 1.33).xyz * 2.0 - 1.0;
         vec3 nR = texture2D(nRock, vNormalMapUv * 0.83).xyz * 2.0 - 1.0;
         vec3 mapN = normalize(nG * w.x + nM * w.y + nR * w.z);
         mapN.xy *= normalScale;
         normal = normalize(tbn * mapN);`,
      )
  }
  return mat
}

/** poids de mélange du terrain : herbe, boue (berges, sentier), roche (pentes) */
export function splatWeights(geo: THREE.BufferGeometry) {
  const p = geo.attributes.position as THREE.BufferAttribute
  const n = geo.attributes.normal as THREE.BufferAttribute
  const w = new Float32Array(p.count * 3)
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i)
    const z = p.getZ(i)
    const slope = 1 - n.getY(i)
    const dr = Math.abs(z - riverCenter(x))
    const path = Math.abs(x - (BRIDGE_X - 4 + Math.sin(z * 0.08) * 3))
    let mud = THREE.MathUtils.smoothstep(RIVER_HALF + 1.6 - dr, 0, 1.6)
    if (path < 1.2 && z > -64) mud = Math.max(mud, 0.85 * (1 - path / 1.2))
    const rock = THREE.MathUtils.smoothstep(slope, 0.5, 0.78)
    const grass = Math.max(0, 1 - mud - rock)
    w.set([grass, mud, rock], i * 3)
  }
  geo.setAttribute('aSplat', new THREE.BufferAttribute(w, 3))
}

/** objets photoscannés instanciés (une InstancedMesh par sous-maillage) */
export function Instanced({ id, items, wind = 0, shadows = true, height }: { id: string; items: { x: number; z: number; s: number; r: number; y?: number }[]; wind?: number; shadows?: boolean; height?: number }) {
  const { parts, box } = useModelParts(id)
  const k = height ? height / Math.max(0.01, box.max.y - box.min.y) : 1
  const meshes = useMemo(() => {
    const m4 = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    return parts.map((pt) => {
      const mat = (pt.material as THREE.MeshStandardMaterial).clone()
      if (wind) {
        mat.onBeforeCompile = (sh) => {
          sh.uniforms.uTime = { value: 0 }
          mat.userData.shader = sh
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;').replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
             float sway = max(0.0, position.y - 0.6) * ${wind.toFixed(4)};
             vec4 ip = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
             transformed.x += sin(uTime * 1.2 + ip.x * 0.21 + position.y * 0.4) * sway;
             transformed.z += cos(uTime * 0.9 + ip.z * 0.17) * sway * 0.6;`,
          )
        }
      }
      const im = new THREE.InstancedMesh(pt.geometry, mat, items.length)
      items.forEach((it, i) => {
        q.setFromAxisAngle(up, it.r)
        m4.compose(new THREE.Vector3(it.x, it.y ?? terrainHeight(it.x, it.z) - 0.05 - box.min.y * it.s * k, it.z), q, new THREE.Vector3(it.s * k, it.s * k, it.s * k))
        im.setMatrixAt(i, m4)
      })
      im.castShadow = shadows
      im.receiveShadow = true
      im.instanceMatrix.needsUpdate = true
      im.computeBoundingSphere()
      return im
    })
  }, [parts, items, wind, shadows, k, box])
  useFrame(({ clock }) => {
    for (const im of meshes) {
      const sh = (im.material as THREE.Material).userData.shader
      if (sh) sh.uniforms.uTime.value = clock.elapsedTime
    }
  })
  return (
    <group>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </group>
  )
}

/** répartit les arbres réels (proches) et garde les arbres stylisés au loin */
export function splitTrees(trees: TreeInst[], realCount: number) {
  const scored = trees.map((t) => ({ t, d: Math.hypot(t.x - 4, (t.z + 24) * 0.8) })).sort((a, b) => a.d - b.d)
  const near = scored.slice(0, realCount).map((s) => s.t)
  const far = scored.slice(realCount).map((s) => s.t)
  return { near, far }
}

/** buissons, fougères, touffes d'herbe et rochers photoscannés autour des lieux clés */
export function scatter(seed: number, n: number, area: { x0: number; x1: number; z0: number; z1: number }, ok: (x: number, z: number) => boolean, s: [number, number]) {
  let r = seed
  const rnd = () => ((r = (r * 16807) % 2147483647) - 1) / 2147483646
  const out: { x: number; z: number; s: number; r: number }[] = []
  let tries = 0
  while (out.length < n && tries < n * 30) {
    tries++
    const x = area.x0 + rnd() * (area.x1 - area.x0)
    const z = area.z0 + rnd() * (area.z1 - area.z0)
    if (!ok(x, z)) continue
    out.push({ x, z, s: s[0] + rnd() * (s[1] - s[0]), r: rnd() * Math.PI * 2 })
  }
  return out
}

/** panneaux pré-rendus (« impostors ») : le vrai modèle est photographié une fois, puis affiché sur 2 plans croisés */
export function Impostors({ id, items, height }: { id: string; items: { x: number; z: number; s: number; r: number }[]; height: number }) {
  const { parts, box } = useModelParts(id)
  const gl = useThree((s) => s.gl)
  const mesh = useMemo(() => {
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const scene = new THREE.Scene()
    for (const p of parts) scene.add(new THREE.Mesh(p.geometry, p.material))
    scene.add(new THREE.HemisphereLight('#bcd2ff', '#4a3a24', 1.4))
    const sun = new THREE.DirectionalLight('#ffd6a8', 3.2)
    sun.position.set(SUN_FOR_IMPOSTOR.x, SUN_FOR_IMPOSTOR.y + 0.4, 1)
    scene.add(sun)
    const w = Math.max(size.x, size.z) * 1.04
    const h = size.y * 1.02
    const cam = new THREE.OrthographicCamera(-w / 2, w / 2, h / 2, -h / 2, 0.1, size.z * 4 + 10)
    cam.position.set(center.x, center.y, box.max.z + size.z + 2)
    cam.lookAt(center.x, center.y, center.z)
    const rt = new THREE.WebGLRenderTarget(512, Math.round((512 * h) / w), { samples: 4 })
    const prev = gl.getRenderTarget()
    const prevColor = gl.getClearColor(new THREE.Color())
    const prevAlpha = gl.getClearAlpha()
    gl.setRenderTarget(rt)
    gl.setClearColor(0x000000, 0)
    gl.clear()
    gl.render(scene, cam)
    gl.setRenderTarget(prev)
    gl.setClearColor(prevColor, prevAlpha)
    const k = height / Math.max(0.01, size.y)
    const quad = (rot: number) => {
      const g = new THREE.PlaneGeometry(w * k, h * k)
      g.translate(0, (h * k) / 2, 0)
      g.rotateY(rot)
      return g
    }
    const geo = mergeGeometries([quad(0), quad(Math.PI / 2)])!
    const mat = new THREE.MeshBasicMaterial({ map: rt.texture, alphaTest: 0.45, side: THREE.DoubleSide, color: '#d9d9d9' })
    const im = new THREE.InstancedMesh(geo, mat, items.length)
    const m4 = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    items.forEach((it, i) => {
      q.setFromAxisAngle(up, it.r)
      m4.compose(new THREE.Vector3(it.x, terrainHeight(it.x, it.z) - 0.1, it.z), q, new THREE.Vector3(it.s, it.s, it.s))
      im.setMatrixAt(i, m4)
    })
    im.castShadow = true
    im.instanceMatrix.needsUpdate = true
    im.computeBoundingSphere()
    return im
  }, [parts, box, gl, items, height])
  return <primitive object={mesh} />
}

/** direction du soleil utilisée pour éclairer les panneaux (mise à jour par la zone 4) */
export const SUN_FOR_IMPOSTOR = new THREE.Vector3(-0.55, 0.13, -0.82)
