import { createContext, useContext } from 'react'
import * as THREE from 'three'
import { G } from '../game/state'
import { QUALITY } from './quality'
import { ceilingSet, wallSet, type PBRSet, type WallTheme } from './textures'
import { pbr, pbrMaterial } from './assets'

// Matériaux partagés, mis en cache. Les pièces sombres ont leurs propres instances
// (réflexions d'environnement quasi nulles) pour que la lampe frontale compte vraiment.

/** texture blanche 1×1 : donne des UV aux matériaux unis pour y poser un détail photo */
const WHITE = (() => {
  const t = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1)
  t.needsUpdate = true
  return t
})()

export const ENV_LIT = 0.42
export const ENV_DARK = 0.025

export const RoomCtx = createContext<{ id: string; dark: boolean }>({ id: '', dark: false })

const cache = new Map<string, THREE.Material>()
const sets = new Map<string, PBRSet>()

function texSize() {
  return QUALITY[G().settings.quality].tex
}

function getSet(key: string, mk: () => PBRSet) {
  const k = `${key}@${texSize()}`
  if (!sets.has(k)) sets.set(k, mk())
  return sets.get(k)!
}

export function cached<T extends THREE.Material>(key: string, dark: boolean, roomId: string, mk: () => T): T {
  const k = dark ? `${key}|${roomId}` : key
  let m = cache.get(k) as T | undefined
  if (!m) {
    m = mk()
    if ('envMapIntensity' in m) (m as any).envMapIntensity = dark ? ENV_DARK : ENV_LIT
    m.userData.roomDark = dark
    cache.set(k, m)
  }
  return m
}

/**
 * Détail photo réel superposé à un matériau dessiné (« detail map ») : on garde le dessin des panneaux
 * (joints, bandes, aérations) et on ajoute l'usure, le micro-relief et la rugosité d'une vraie texture.
 */
export function withDetail(m: THREE.MeshStandardMaterial, id: string, scale: number, k = 0.6, mean = 0.45) {
  const d = pbr(id)
  m.onBeforeCompile = (sh) => {
    sh.uniforms.tDetail = { value: d.map }
    sh.uniforms.tDetailN = { value: d.normalMap }
    sh.uniforms.tDetailR = { value: d.arm }
    sh.uniforms.uDetail = { value: new THREE.Vector3(scale, k, mean) }
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tDetail; uniform sampler2D tDetailN; uniform sampler2D tDetailR; uniform vec3 uDetail;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
         vec2 dUv = vMapUv * uDetail.x;
         vec3 dCol = texture2D(tDetail, dUv).rgb;
         float dL = dot(dCol, vec3(0.3333)) / uDetail.z;
         diffuseColor.rgb *= mix(vec3(1.0), dCol / max(dot(dCol, vec3(0.3333)), 1e-3) * clamp(dL, 0.55, 1.35), uDetail.y);`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
         roughnessFactor = clamp(roughnessFactor * mix(1.0, texture2D(tDetailR, vMapUv * uDetail.x).g * 1.6, uDetail.y), 0.08, 1.0);`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
         vec3 dN = texture2D(tDetailN, vMapUv * uDetail.x).xyz * 2.0 - 1.0;
         // repère tangent par dérivées (indépendant de la présence d'une normalMap)
         vec3 dq0 = dFdx(-vViewPosition); vec3 dq1 = dFdy(-vViewPosition);
         vec2 dst0 = dFdx(vMapUv * uDetail.x); vec2 dst1 = dFdy(vMapUv * uDetail.x);
         vec3 dq1p = cross(dq1, normal); vec3 dq0p = cross(normal, dq0);
         vec3 dT = dq1p * dst0.x + dq0p * dst1.x; vec3 dB = dq1p * dst0.y + dq0p * dst1.y;
         float dDet = max(dot(dT, dT), dot(dB, dB));
         float dSc = dDet == 0.0 ? 0.0 : faceDirection * inversesqrt(dDet);
         normal = normalize(normal + mat3(dT * dSc, dB * dSc, normal) * vec3(dN.xy * uDetail.y * 0.8, 0.0));`,
      )
  }
  m.customProgramCacheKey = () => `detail:${id}`
  return m
}

const WALL_DETAIL: Record<WallTheme, [string, number, number]> = {
  station: ['concrete_floor_worn_001', 3, 0.55],
  lab: ['concrete_floor_worn_001', 3, 0.45],
  machine: ['rusty_painted_metal', 2, 0.5],
  rocket: ['metal_plate_02', 2, 0.6],
  green: ['concrete_floor_worn_001', 3, 0.5],
}

export function wallMaterial(theme: WallTheme, dark: boolean, roomId: string) {
  return cached(`wall:${theme}`, dark, roomId, () => {
    const s = getSet(`wall:${theme}`, () => wallSet(theme, texSize()))
    const m = new THREE.MeshStandardMaterial({ ...s, metalness: 1, roughness: 1, normalScale: new THREE.Vector2(0.9, 0.9) })
    const [id, sc, k] = WALL_DETAIL[theme]
    return withDetail(m, id, sc, k)
  })
}

export function floorMaterial(kind: 'plate' | 'rubber' | 'grate', dark: boolean, roomId: string) {
  return cached(`floor:${kind}`, dark, roomId, () => {
    if (kind === 'grate') return pbrMaterial('metal_plate', { repeat: [2, 2], metal: 0.9, color: '#a8aaa6' })
    if (kind === 'rubber') return pbrMaterial('concrete_floor_worn_001', { repeat: [1, 1], metal: 0, color: '#a19d95' })
    return pbrMaterial('metal_plate_02', { repeat: [1, 1], metal: 0.75, color: '#c3c0b8' })
  })
}

export function ceilingMaterial(dark: boolean, roomId: string) {
  return cached('ceil', dark, roomId, () => {
    const s = getSet('ceil', () => ceilingSet(texSize()))
    return withDetail(new THREE.MeshStandardMaterial({ ...s, metalness: 0.1, roughness: 1 }), 'concrete_floor_worn_001', 2, 0.5)
  })
}

/** hook pour les accessoires : matériau adapté à la pièce courante */
export function useMats() {
  const room = useContext(RoomCtx)
  const d = room.dark
  const id = room.id
  return {
    dark: d,
    painted: (color: string, rough = 0.55, metal = 0.25) =>
      cached(`painted:${color}:${rough}:${metal}`, d, id, () => {
        // couleur voulue + vraie usure photo (rayures, micro-relief)
        const m = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, map: WHITE })
        return withDetail(m, 'metal_plate_02', 1.5, 0.55)
      }),
    metal: (color = '#9aa0a6', rough = 0.35) => cached(`metal:${color}:${rough}`, d, id, () => new THREE.MeshStandardMaterial({ color, metalness: 1, roughness: rough })),
    plastic: (color: string, rough = 0.45) => cached(`plastic:${color}:${rough}`, d, id, () => new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: rough })),
    rubber: (color = '#1b1c1e') => cached(`rubber:${color}`, d, id, () => new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.9 })),
    fabric: (color: string) => cached(`fabric:${color}`, d, id, () => new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.95 })),
    glow: (color: string, intensity = 3) =>
      cached(`glow:${color}:${intensity}`, false, '', () => new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveIntensity: intensity, toneMapped: true })),
    glass: (tint = '#a8c6d8', opacity = 0.18) =>
      cached(`glass:${tint}:${opacity}`, false, '', () => new THREE.MeshPhysicalMaterial({ color: tint, metalness: 0, roughness: 0.05, transparent: true, opacity, envMapIntensity: 1.2, clearcoat: 1, depthWrite: false })),
  }
}

/** met à jour l'intensité d'environnement des matériaux d'une pièce (ex. machinerie rallumée) */
export function setRoomLit(roomId: string, lit: boolean) {
  for (const [k, m] of cache) if (k.endsWith(`|${roomId}`) && 'envMapIntensity' in m) (m as any).envMapIntensity = lit ? ENV_LIT : ENV_DARK
}

export function clearMaterialCache() {
  cache.forEach((m) => m.dispose())
  cache.clear()
}
