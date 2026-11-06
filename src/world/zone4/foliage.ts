import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { maxAniso } from '../quality'

type Kind = 'pine' | 'fir' | 'oak'
function random(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
}

/** Cutout fronds instead of solid cones. One atlas and one instanced draw per species. */
export function foliageMaterial(kind: Kind) {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const ctx = c.getContext('2d')!
  const rnd = random(kind === 'oak' ? 1907 : 813)
  if (kind !== 'oak') {
    for (let branch = 0; branch < 7; branch++) {
      const ox = 90 + branch * 49, oy = 375 - Math.abs(branch - 3) * 20
      ctx.strokeStyle = '#6b6046'
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(ox, oy); ctx.lineTo(ox + 30, 100 + rnd() * 60); ctx.stroke()
      for (let i = 0; i < 55; i++) {
        const t = i / 55, x = ox + 30 * t, y = oy - t * 240
        const length = 20 + (1 - t) * 29
        ctx.strokeStyle = `hsl(${88 + rnd() * 25},${19 + rnd() * 18}%,${22 + rnd() * 28}%)`
        ctx.lineWidth = 1.4 + rnd() * 1.8
        for (const side of [-1, 1]) {
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + side * length, y - 17 - rnd() * 18); ctx.stroke()
        }
      }
    }
  } else {
    for (let i = 0; i < 80; i++) {
      const a = rnd() * Math.PI * 2, radius = Math.sqrt(rnd()) * 170
      const x = 256 + Math.cos(a) * radius, y = 256 + Math.sin(a) * radius * 0.8
      ctx.save(); ctx.translate(x, y); ctx.rotate(rnd() * Math.PI * 2)
      const w = 12 + rnd() * 14, h = 23 + rnd() * 17
      const gradient = ctx.createLinearGradient(-w, 0, w, 0)
      gradient.addColorStop(0, '#263d22'); gradient.addColorStop(0.5, '#667644'); gradient.addColorStop(1, '#3c532b')
      ctx.fillStyle = gradient
      ctx.beginPath(); ctx.moveTo(0, -h)
      ctx.bezierCurveTo(w * 1.3, -h * 0.5, w, h * 0.65, 0, h)
      ctx.bezierCurveTo(-w, h * 0.65, -w * 1.3, -h * 0.5, 0, -h); ctx.fill()
      ctx.strokeStyle = 'rgba(184,182,115,0.45)'; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(0, h)
      for (let k = -2; k <= 2; k++) { ctx.moveTo(0, k * 8); ctx.lineTo(w * 0.7, k * 8 - 7); ctx.moveTo(0, k * 8); ctx.lineTo(-w * 0.7, k * 8 - 7) }
      ctx.stroke(); ctx.restore()
    }
  }
  const map = new THREE.CanvasTexture(c)
  map.colorSpace = THREE.SRGBColorSpace
  map.anisotropy = maxAniso()
  return new THREE.MeshStandardMaterial({ map, alphaTest: 0.4, side: THREE.DoubleSide,
    vertexColors: true, roughness: 0.92, metalness: 0, envMapIntensity: 0.6 })
}

export function makeTreeGeometry(kind: Kind) {
  const rnd = random(kind === 'pine' ? 313 : kind === 'fir' ? 421 : 517)
  const wood: THREE.BufferGeometry[] = [], leaves: THREE.BufferGeometry[] = []
  const up = new THREE.Vector3(0, 1, 0)
  // Firs are bluer and darker than pines; each frond gets its own shade, lighter towards the sunlit top.
  const tint = kind === 'fir' ? [0.82, 0.92, 0.95] : [1, 1, 0.92]
  function branch(a: THREE.Vector3, b: THREE.Vector3, radius: number) {
    const d = b.clone().sub(a)
    const g = new THREE.CylinderGeometry(radius * 0.4, radius, d.length(), 7, 1).toNonIndexed()
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d.clone().normalize()))
    g.translate(...a.clone().add(b).multiplyScalar(0.5).toArray())
    wood.push(g)
  }
  function card(p: THREE.Vector3, width: number, height: number, a: number, tilt: number, light = 1) {
    const g = new THREE.PlaneGeometry(width, height, 2, 2).toNonIndexed()
    // Curve each frond slightly to avoid cardboard reflections.
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.abs(pos.getX(i)) * 0.16)
    g.rotateX(tilt); g.rotateY(a); g.translate(p.x, p.y, p.z)
    g.computeVertexNormals()
    const shade = (0.7 + rnd() * 0.3) * light
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) colors.set([shade * tint[0], shade * tint[1], shade * tint[2]], i * 3)
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    leaves.push(g)
  }
  if (kind !== 'oak') {
    // A conifer: whorls of drooping branches, wide at the bottom, tapering to a spire, fronds all along them.
    const fir = kind === 'fir', height = fir ? 9 : 10, tiers = fir ? 17 : 14, base = fir ? 1.65 : 2.2
    branch(new THREE.Vector3(), new THREE.Vector3(0.06, height, 0), fir ? 0.2 : 0.24)
    for (let tier = 0; tier < tiers; tier++) {
      const k = tier / tiers, y = (fir ? 1.0 : 1.8) + k * (height - (fir ? 1.6 : 2.4))
      const spread = base * Math.pow(1 - k, 0.85) + 0.2
      const count = fir ? 9 : 7
      for (let j = 0; j < count; j++) {
        const a = j / count * Math.PI * 2 + tier * 2.1 + rnd() * 0.35
        const len = spread * (0.85 + rnd() * 0.3)
        const end = new THREE.Vector3(Math.cos(a) * len, y - len * (fir ? 0.38 : 0.22) + rnd() * 0.1, Math.sin(a) * len)
        branch(new THREE.Vector3(0, y + 0.1, 0), end, 0.032 * (1 - k * 0.7))
        const cards = fir ? 4 : 3
        for (let c = 0; c < cards; c++) {
          const t = 0.3 + c / cards * 0.75
          const center = new THREE.Vector3(0, y + 0.1, 0).lerp(end, t)
          card(center, (fir ? 0.75 : 0.95) * (1 - k * 0.45), fir ? 0.7 : 0.85, -a, -0.75 + rnd() * 0.35, 0.85 + k * 0.3)
        }
      }
    }
    // The leading shoot at the top.
    for (let i = 0; i < 3; i++) card(new THREE.Vector3(0, height - 0.25, 0), 0.5, 0.9, i * 1.05, 0, 1.15)
  } else {
    branch(new THREE.Vector3(), new THREE.Vector3(0.08, 4.8, 0), 0.22)
    for (let i = 0; i < 14; i++) {
      const a = i * 2.4, radius = 0.6 + rnd() * 1.35
      const end = new THREE.Vector3(Math.cos(a) * radius, 2.8 + rnd() * 1.7, Math.sin(a) * radius)
      branch(new THREE.Vector3(0, 1.5 + rnd(), 0), end, 0.07)
      for (let j = 0; j < 15; j++) {
        const p = end.clone().add(new THREE.Vector3((rnd() - 0.5) * 1.5, (rnd() - 0.5) * 1.2, (rnd() - 0.5) * 1.5))
        card(p, 0.95, 0.85, rnd() * Math.PI * 2, (rnd() - 0.5) * Math.PI)
      }
    }
  }
  const result = { wood: mergeGeometries(wood)!, leaves: mergeGeometries(leaves)! }
  for (const g of [...wood, ...leaves]) g.dispose()
  return result
}
