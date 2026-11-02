import { createContext, useContext } from 'react'
import * as THREE from 'three'
import { G } from '../game/state'
import { QUALITY } from './quality'
import { ceilingSet, floorSet, paintedMetal, wallSet, type PBRSet, type WallTheme } from './textures'

// Matériaux partagés, mis en cache. Les pièces sombres ont leurs propres instances
// (réflexions d'environnement quasi nulles) pour que la lampe frontale compte vraiment.

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

export function wallMaterial(theme: WallTheme, dark: boolean, roomId: string) {
  return cached(`wall:${theme}`, dark, roomId, () => {
    const s = getSet(`wall:${theme}`, () => wallSet(theme, texSize()))
    return new THREE.MeshStandardMaterial({ ...s, metalness: 1, roughness: 1, normalScale: new THREE.Vector2(0.9, 0.9) })
  })
}

export function floorMaterial(kind: 'plate' | 'rubber' | 'grate', dark: boolean, roomId: string) {
  return cached(`floor:${kind}`, dark, roomId, () => {
    const s = getSet(`floor:${kind}`, () => floorSet(kind, texSize()))
    return new THREE.MeshStandardMaterial({ ...s, metalness: 1, roughness: 1, normalScale: new THREE.Vector2(1, 1) })
  })
}

export function ceilingMaterial(dark: boolean, roomId: string) {
  return cached('ceil', dark, roomId, () => {
    const s = getSet('ceil', () => ceilingSet(texSize()))
    return new THREE.MeshStandardMaterial({ ...s, metalness: 0.1, roughness: 1 })
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
        return new THREE.MeshStandardMaterial({ map: s.map, normalMap: s.normalMap, roughnessMap: s.roughnessMap, color: '#ffffff', roughness: rough * 1.8, metalness: metal })
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
