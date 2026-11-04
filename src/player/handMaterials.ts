import * as THREE from 'three'
import { photoSurface } from '../world/photomaterials'

const cache = new Map<string, THREE.MeshPhysicalMaterial>()

/** Close-up fabric: broad wear and folds remain visible even at the lowest DPR. */
export function handFabric(color: string, leather = false) {
  const key = color + leather
  if (cache.has(key)) return cache.get(key)!
  const c = document.createElement('canvas')
  c.width = c.height = 512
  const ctx = c.getContext('2d')!
  ctx.fillStyle = color
  ctx.fillRect(0, 0, 512, 512)
  let seed = 613
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
  for (let i = 0; i < 6500; i++) {
    const x = rnd() * 512, y = rnd() * 512
    ctx.fillStyle = `rgba(${rnd() > 0.5 ? '240,235,214' : '21,27,24'},${0.02 + rnd() * 0.09})`
    ctx.fillRect(x, y, leather ? 1.5 : 2, leather ? 1.5 : 5)
  }
  for (let i = 0; i < 26; i++) {
    const x = rnd() * 512, y = rnd() * 512, r = 25 + rnd() * 100
    const stain = ctx.createRadialGradient(x, y, 0, x, y, r)
    stain.addColorStop(0, 'rgba(38,30,19,0.18)')
    stain.addColorStop(1, 'rgba(38,30,19,0)')
    ctx.fillStyle = stain
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }
  for (let i = 0; i < 13; i++) {
    const y = i * 42 + rnd() * 18
    ctx.strokeStyle = 'rgba(25,32,30,0.13)'
    ctx.lineWidth = leather ? 1 : 3
    ctx.beginPath(); ctx.moveTo(0, y); ctx.bezierCurveTo(130, y + 22, 300, y - 13, 512, y + 2); ctx.stroke()
    ctx.strokeStyle = 'rgba(238,234,210,0.15)'
    ctx.lineWidth = 1
    ctx.stroke()
  }
  const map = new THREE.CanvasTexture(c)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.anisotropy = 8
  const detail = photoSurface('fabric', leather ? 1 : 2)
  const material = new THREE.MeshPhysicalMaterial({ map, normalMap: detail.normalMap,
    normalScale: new THREE.Vector2(0.5, 0.5), roughnessMap: detail.roughnessMap,
    roughness: leather ? 0.85 : 0.96, sheen: leather ? 0.12 : 0.3, sheenRoughness: 0.8, envMapIntensity: 0.65 })
  material.userData.fabric = true
  cache.set(key, material)
  return material
}

let braid: THREE.CanvasTexture | null = null
export function ropeBraid() {
  if (braid) return braid
  const c = document.createElement('canvas')
  c.width = 1024; c.height = 128
  const g = c.getContext('2d')!
  g.fillStyle = '#a49671'; g.fillRect(0, 0, c.width, c.height)
  for (let x = -128; x < 1152; x += 16) {
    g.lineWidth = 5; g.strokeStyle = x % 64 === 0 ? '#544c37' : '#c3b895'
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 80, 64); g.lineTo(x, 128); g.stroke()
    g.lineWidth = 1; g.strokeStyle = '#7d7354'
    g.beginPath(); g.moveTo(x + 5, 0); g.lineTo(x + 85, 64); g.lineTo(x + 5, 128); g.stroke()
  }
  braid = new THREE.CanvasTexture(c)
  braid.colorSpace = THREE.SRGBColorSpace
  braid.wrapS = braid.wrapT = THREE.RepeatWrapping
  braid.anisotropy = 8
  return braid
}
