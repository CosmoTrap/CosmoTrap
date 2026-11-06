import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { pbrMaterial } from '../assets'
import { HUB, MODULES, ROCKET } from '../../game/lunar/map'

/** Ground level around the base: the regolith is levelled under every module so nothing floats. */
export const GROUND_Y = -0.08

/** The regolith that covers the modules as radiation shielding: one shared material. */
let regolith: THREE.MeshStandardMaterial | null = null
export function regolithMaterial() {
  return regolith ??= pbrMaterial('moon_01', { repeat: [3, 3], rough: 1, metal: 0, normal: 1.2, env: 0.12, color: '#b8b2a8' })
}

/** A vault of packed regolith: a flattened half-cylinder of the given span, along local x, closed at both ends. */
export function vaultGeometry(length: number, span: number, rise: number) {
  const r = span / 2, k = rise / r
  const shell = new THREE.CylinderGeometry(r, r, length, 28, 1, true, 0, Math.PI).rotateZ(Math.PI / 2).scale(1, k, 1)
  shell.computeVertexNormals()
  const caps = [-1, 1].map((s) => new THREE.CircleGeometry(r, 28, 0, Math.PI).scale(1, k, 1).rotateY(s * Math.PI / 2).translate(s * length / 2, 0, 0))
  const merged = mergeGeometries([shell, ...caps])!
  ;[shell, ...caps].forEach((g) => g.dispose())
  return merged
}

/** Distance from (x, z) to the nearest structure footprint: modules, tunnels, hub, pad and walkways. */
export function distanceToBase(x: number, z: number) {
  let d = Math.hypot(x - HUB[0], z - HUB[1]) - 8.5
  for (const m of MODULES) {
    const dx = x - m.center[0], dz = z - m.center[1], c = Math.cos(m.angle), s = Math.sin(m.angle)
    const lx = Math.abs(dx * c - dz * s) - m.width / 2 - 1.2, lz = Math.abs(dx * s + dz * c) - m.depth / 2 - 1.2
    d = Math.min(d, Math.hypot(Math.max(lx, 0), Math.max(lz, 0)) + Math.min(Math.max(lx, lz), 0))
    // Tunnel from the hub to the module.
    const t = Math.max(0, Math.min(m.distance, (x - HUB[0]) * Math.sin(m.angle) + (z - HUB[1]) * Math.cos(m.angle)))
    d = Math.min(d, Math.hypot(x - HUB[0] - Math.sin(m.angle) * t, z - HUB[1] - Math.cos(m.angle) * t) - 2.6)
  }
  d = Math.min(d, Math.hypot(x - ROCKET[0], z - ROCKET[1]) - 9)
  // Walkway from the airlock to the pad.
  d = Math.min(d, Math.max(Math.abs(x - 41) - 2.5, Math.abs(z - 77) - 5.5), Math.max(Math.abs(x - 32) - 11, Math.abs(z - 80.5) - 2.5))
  return d
}
