import { useEffect, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { G, useGame } from '../game/state'

const margin = 0.00001
type Triangle = [number, number, number, number, number, number, number]
type Polygon = { points: number[]; depth: number }

function coveredByPolygon(rect: number[], polygon: Polygon) {
  if (polygon.depth >= rect[4] - margin) return false
  const p = polygon.points
  for (const x of [rect[0], rect[2]]) for (const y of [rect[1], rect[3]]) {
    for (let i = 0; i < p.length; i += 2) {
      const j = (i + 2) % p.length
      if ((p[j] - p[i]) * (y - p[i + 1]) - (p[j + 1] - p[i + 1]) * (x - p[i]) <= margin) return false
    }
  }
  return true
}

/** Adjacent triangles may cover a box that straddles their shared diagonal.
 * Accept their union only when they share an exact edge and form a convex quad. */
function joinedQuad(a: Triangle, b: Triangle): Polygon | null {
  const points: number[][] = []
  for (const t of [a, b]) for (let i = 0; i < 6; i += 2) {
    if (!points.some(p => p[0] === t[i] && p[1] === t[i + 1])) points.push([t[i], t[i + 1]])
  }
  if (points.length !== 4) return null
  const cx = points.reduce((n, p) => n + p[0], 0) / 4, cy = points.reduce((n, p) => n + p[1], 0) / 4
  points.sort((a, b) => Math.atan2(a[1] - cy, a[0] - cx) - Math.atan2(b[1] - cy, b[0] - cx))
  const common = points.map((p, i) => [a, b].every(t => [0, 2, 4].some(k => t[k] === p[0] && t[k + 1] === p[1])) ? i : -1).filter(i => i >= 0)
  if (common.length !== 2 || Math.abs(common[0] - common[1]) !== 2) return null
  for (let i = 0; i < 4; i++) {
    const p = points[i], q = points[(i + 1) % 4], r = points[(i + 2) % 4]
    if ((q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]) <= margin) return null
  }
  return { points: points.flat(), depth: Math.max(a[6], b[6]) }
}

/** A projected box is hidden only if a single opaque triangle covers its whole
 * rectangle AND is entirely nearer. This deliberately rejects uncertain cases
 * (near-plane crossings, gaps, windows, partial overlap), never approximates them. */
export function coveredByTriangle(rect: number[], t: Triangle) {
  if (t[6] >= rect[4] - margin) return false
  const cross = (x: number, y: number, ax: number, ay: number, bx: number, by: number) => (bx - ax) * (y - ay) - (by - ay) * (x - ax)
  const winding = Math.sign(cross(t[4], t[5], t[0], t[1], t[2], t[3]))
  if (!winding) return false
  for (const x of [rect[0], rect[2]]) for (const y of [rect[1], rect[3]]) {
    if (winding * cross(x, y, t[0], t[1], t[2], t[3]) <= margin ||
      winding * cross(x, y, t[2], t[3], t[4], t[5]) <= margin ||
      winding * cross(x, y, t[4], t[5], t[0], t[1]) <= margin) return false
  }
  return true
}

export function installTransmissionCulling(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera,
  root: THREE.Object3D, enabled = () => true) {
  const surfaces: THREE.Mesh[] = [], glass: THREE.Mesh[] = []
  root.traverse(object => {
    const mesh = object as THREE.Mesh
    if (!mesh.isMesh || (mesh as THREE.SkinnedMesh).isSkinnedMesh || (mesh as THREE.InstancedMesh).isInstancedMesh) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    if (materials.some(m => (m as THREE.MeshPhysicalMaterial).transmission > 0)) glass.push(mesh)
    const structure = mesh.renderOrder === -1 || ['hull', 'hub-hull', 'hub-sun-stop'].includes(mesh.name)
    if (structure && materials.every(m => m.visible && !m.transparent && m.depthWrite && m.depthTest && m.side === THREE.DoubleSide &&
      !m.alphaTest && !m.alphaHash && !m.clippingPlanes?.length && !(m as THREE.MeshStandardMaterial).displacementMap)) surfaces.push(mesh)
  })
  const projected: Triangle[] = []
  const quads: Polygon[] = []
  const matrix = new THREE.Matrix4(), vp = new THREE.Matrix4(), p = new THREE.Vector4()
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  const hidden: THREE.Mesh[] = []
  const visible = (mesh: THREE.Object3D) => {
    for (let o: THREE.Object3D | null = mesh; o; o = o.parent) if (!o.visible) return false
    return mesh.layers.test(camera.layers)
  }
  const project = (x: number, y: number, z: number, out: THREE.Vector3) => {
    p.set(x, y, z, 1).applyMatrix4(matrix)
    if (p.w <= 0 || p.z <= -p.w) return false
    out.set(p.x / p.w, p.y / p.w, p.z / p.w)
    return true
  }
  const restore = () => { hidden.forEach(o => { o.visible = true }) }
  const render = renderer.render
  const shadow = renderer.shadowMap.render
  const wrappedShadow: typeof shadow = function (...args) {
    // Render lists are already built. Restore glass before shadow traversal so
    // hiding it from the eye cannot change any shadow cast in the scene.
    restore()
    return shadow.apply(renderer.shadowMap, args)
  }
  const wrappedRender: typeof render = function (world, view) {
    if (world !== scene || view !== camera || scene.overrideMaterial || !enabled() || !glass.length) return render.call(renderer, world, view)
    camera.updateWorldMatrix(true, false)
    vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    const candidates: {mesh: THREE.Mesh; rect: number[]}[] = []
    for (const mesh of glass) {
      if (!visible(mesh)) continue
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
      const box = mesh.geometry.boundingBox!
      mesh.updateWorldMatrix(true, false)
      matrix.multiplyMatrices(vp, mesh.matrixWorld)
      const rect = [Infinity, Infinity, -Infinity, -Infinity, Infinity]
      let safe = true
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        if (!project(x, y, z, a)) { safe = false; continue }
        rect[0] = Math.min(rect[0], a.x); rect[1] = Math.min(rect[1], a.y)
        rect[2] = Math.max(rect[2], a.x); rect[3] = Math.max(rect[3], a.y); rect[4] = Math.min(rect[4], a.z)
      }
      if (!safe) continue
      if (rect[2] < -1 || rect[0] > 1 || rect[3] < -1 || rect[1] > 1 || rect[4] > 1) hidden.push(mesh)
      else candidates.push({ mesh, rect })
    }
    projected.length = 0
    quads.length = 0
    for (const mesh of candidates.length ? surfaces : []) {
      if (!visible(mesh)) continue
      mesh.updateWorldMatrix(true, false)
      matrix.multiplyMatrices(vp, mesh.matrixWorld)
      const geometry = mesh.geometry, pos = geometry.attributes.position, index = geometry.index
      const end = Math.min(index?.count ?? pos.count, geometry.drawRange.start + geometry.drawRange.count)
      let previous: Triangle | null = null
      for (let i = geometry.drawRange.start; i + 2 < end; i += 3) {
        const ia = index ? index.getX(i) : i, ib = index ? index.getX(i + 1) : i + 1, ic = index ? index.getX(i + 2) : i + 2
        if (!project(pos.getX(ia), pos.getY(ia), pos.getZ(ia), a) || !project(pos.getX(ib), pos.getY(ib), pos.getZ(ib), b) || !project(pos.getX(ic), pos.getY(ic), pos.getZ(ic), c)) { previous = null; continue }
        const triangle: Triangle = [a.x, a.y, b.x, b.y, c.x, c.y, Math.max(a.z, b.z, c.z)]
        projected.push(triangle)
        if (previous) { const quad = joinedQuad(previous, triangle); if (quad) quads.push(quad) }
        previous = triangle
      }
    }
    for (const { mesh, rect } of candidates) {
      if (quads.some(q => coveredByPolygon(rect, q)) || projected.some(t => coveredByTriangle(rect, t))) hidden.push(mesh)
    }
    try { hidden.forEach(mesh => { mesh.visible = false }); return render.call(renderer, world, view) }
    finally { restore(); hidden.length = 0 }
  }
  renderer.render = wrappedRender
  renderer.shadowMap.render = wrappedShadow
  return () => {
    restore()
    if (renderer.render === wrappedRender) renderer.render = render
    if (renderer.shadowMap.render === wrappedShadow) renderer.shadowMap.render = shadow
  }
}

export function TransmissionCulling({ root }: { root: RefObject<THREE.Group> }) {
  const { gl, scene, camera } = useThree()
  const loaded = useGame(s => s.loading === 1)
  const quality = useGame(s => s.settings.quality)
  useEffect(() => {
    if (!loaded || !root.current) return
    return installTransmissionCulling(gl, scene, camera, root.current, () => G().loading === 1)
  }, [gl, scene, camera, root, loaded, quality])
  return null
}
