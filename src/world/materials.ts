import { createContext, useContext } from 'react'
import * as THREE from 'three'
import { G } from '../game/state'
import { QUALITY } from './quality'
import { ceilingSet, floorSet, paintedMetal, wallSet, type PBRSet, type WallTheme } from './textures'
import { photoSurface } from './photomaterials'

// Matériaux partagés, mis en cache. Les pièces sombres ont leurs propres instances
// (réflexions d'environnement quasi nulles) pour que la lampe torche compte vraiment.

export const ENV_LIT = 0.65
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
  const k = `${key}@${texSize()}${dark ? `|${roomId}` : ''}`
  let m = cache.get(k) as T | undefined
  if (!m) {
    m = mk()
    if ('envMapIntensity' in m) (m as any).envMapIntensity = dark ? ENV_DARK : ENV_LIT
    m.userData.roomDark = dark
    cache.set(k, m)
  }
  return m
}

export function wallMaterial(theme: WallTheme, dark: boolean, roomId: string) {
  return cached(`wall:${theme}`, dark, roomId, () => {
    const s = getSet(`wall:${theme}`, () => wallSet(theme, texSize()))
    // The hull uses inward-facing surfaces, with actual holes for windows.
    // Its back must also occlude rooms seen through another module's window.
    // Keep the existing shadow face to preserve the interior sun lighting.
    return new THREE.MeshStandardMaterial({ ...s, metalness: 1, roughness: 1, normalScale: new THREE.Vector2(0.9, 0.9), side: THREE.DoubleSide, shadowSide: THREE.BackSide })
  })
}

export function floorMaterial(kind: 'plate' | 'rubber' | 'grate', dark: boolean, roomId: string) {
  return cached(`floor:${kind}`, dark, roomId, () => {
    const s = getSet(`floor:${kind}`, () => floorSet(kind, texSize()))
    return new THREE.MeshStandardMaterial({ ...s, metalness: 1, roughness: 1, normalScale: new THREE.Vector2(1, 1), side: THREE.DoubleSide, shadowSide: THREE.BackSide })
  })
}

export function ceilingMaterial(dark: boolean, roomId: string) {
  return cached('ceil', dark, roomId, () => {
    const s = getSet('ceil', () => ceilingSet(texSize()))
    return new THREE.MeshStandardMaterial({ ...s, metalness: 0.1, roughness: 1, side: THREE.DoubleSide, shadowSide: THREE.BackSide })
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
        const s = getSet(`pm:${color}`, () => paintedMetal(color, 256))
        const detail = photoSurface('metal')
        return new THREE.MeshPhysicalMaterial({ map: s.map, normalMap: detail.normalMap, normalScale: new THREE.Vector2(0.16, 0.16), roughnessMap: detail.roughnessMap,
          color: '#ffffff', roughness: Math.min(1, rough * 1.35), metalness: metal * 0.75, clearcoat: 0.18, clearcoatRoughness: 0.4 })
      }),
    metal: (color = '#9aa0a6', rough = 0.35) => cached(`metal:${color}:${rough}`, d, id, () => {
      const s = photoSurface('metal', 2)
      return new THREE.MeshStandardMaterial({ color, metalness: 0.92, roughness: Math.min(1, rough * 1.5), normalMap: s.normalMap,
        normalScale: new THREE.Vector2(0.08, 0.08), roughnessMap: s.roughnessMap })
    }),
    plastic: (color: string, rough = 0.45) => cached(`plastic:${color}:${rough}`, d, id, () => new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: rough })),
    rubber: (color = '#1b1c1e') => cached(`rubber:${color}`, d, id, () => new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.9 })),
    fabric: (color: string) => cached(`fabric:${color}`, d, id, () => {
      const s = photoSurface('fabric', 3)
      const m = new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: 0.96, roughnessMap: s.roughnessMap,
        normalMap: s.normalMap, normalScale: new THREE.Vector2(0.3, 0.3), sheen: 0.45, sheenColor: color, sheenRoughness: 0.8 })
      m.userData.fabric = true
      return m
    }),
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
