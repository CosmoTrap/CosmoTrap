import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

type Kind = 'pine' | 'oak'
function random(seed: number) {
  return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
}

/** Cutout fronds instead of solid cones. One atlas and one instanced draw per species. */
export function foliageMaterial(kind: Kind) {
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const ctx = c.getContext('2d')!
  const rnd = random(kind === 'pine' ? 813 : 1907)
  if (kind === 'pine') {
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
  map.anisotropy = 8
  return new THREE.MeshStandardMaterial({ map, alphaTest: 0.4, side: THREE.DoubleSide,
    vertexColors: true, roughness: 0.92, metalness: 0, envMapIntensity: 0.6 })
}

export function makeTreeGeometry(kind: Kind) {
  const rnd = random(kind === 'pine' ? 313 : 517)
  const wood: THREE.BufferGeometry[] = [], leaves: THREE.BufferGeometry[] = []
  const up = new THREE.Vector3(0, 1, 0)
  function branch(a: THREE.Vector3, b: THREE.Vector3, radius: number) {
    const d = b.clone().sub(a)
    const g = new THREE.CylinderGeometry(radius * 0.4, radius, d.length(), 8, 2).toNonIndexed()
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, d.clone().normalize()))
    g.translate(...a.clone().add(b).multiplyScalar(0.5).toArray())
    wood.push(g)
  }
  function card(p: THREE.Vector3, width: number, height: number, a: number, tilt: number) {
    const g = new THREE.PlaneGeometry(width, height, 2, 2).toNonIndexed()
    // Curve each frond slightly to avoid cardboard reflections.
    const pos = g.attributes.position
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.abs(pos.getX(i)) * 0.16)
    g.rotateX(tilt); g.rotateY(a); g.translate(p.x, p.y, p.z)
    g.computeVertexNormals()
    const shade = 0.75 + rnd() * 0.35
    const colors = new Float32Array(pos.count * 3).fill(shade)
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    leaves.push(g)
  }
  branch(new THREE.Vector3(), new THREE.Vector3(0.08, kind === 'pine' ? 7 : 4.8, 0), 0.22)
  if (kind === 'pine') {
    for (let tier = 0; tier < 10; tier++) {
      const y = 1.35 + tier * 0.55, spread = 1.75 * (1 - tier / 11)
      for (let j = 0; j < 7; j++) {
        const a = j / 7 * Math.PI * 2 + tier * 1.7 + rnd() * 0.25
        const end = new THREE.Vector3(Math.cos(a) * spread, y - 0.16 + rnd() * 0.15, Math.sin(a) * spread)
        branch(new THREE.Vector3(0, y + 0.15, 0), end, 0.028 * (1 - tier / 14))
        for (let k = 0; k < 3; k++) {
          const center = end.clone().multiplyScalar(0.45 + k * 0.25)
          center.y = y + k * 0.08
          card(center, 0.85 - tier * 0.035, 0.8, -a, -0.65 + rnd() * 0.3)
        }
      }
    }
  } else {
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
