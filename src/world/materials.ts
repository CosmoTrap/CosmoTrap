import { createContext, useContext } from 'react'
import * as THREE from 'three'
import { G } from '../game/state'
import { QUALITY } from './quality'
import { ceilingSet, drawTexture, floorSet, paintedMetal, wallSet, type PBRSet, type WallTheme } from './textures'
import { photoSurface } from './photomaterials'
import { maxAniso } from './quality'

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
/** Whether the current preset affords the costlier material layers (clearcoat, sheen). */
const rich = () => QUALITY[G().settings.quality].richMaterials

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

/** Exterior panels reuse the interior PBR detail, with a permanent material.
 * Both shadow faces seal seams; the window openings remain in the geometry. */
/** The station's outer skin, as seen through the windows: white shield panels, not interior walls. */
function exteriorSkin() {
  return cached('hull:exterior', false, '', () => {
    const map = drawTexture(512, 512, (c) => {
      c.fillStyle = '#d7d9d7'
      c.fillRect(0, 0, 512, 512)
      // Each tile carries two rows of panels, each a slightly different white, with their bolts.
      for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) {
        const v = 208 + ((x * 7 + y * 13) % 5) * 6
        c.fillStyle = `rgb(${v},${v},${v - 3})`
        c.fillRect(x * 256 + 4, y * 256 + 4, 248, 248)
        c.fillStyle = '#85888b'
        for (const px of [16, 128, 240]) for (const py of [16, 128, 240]) if (px !== 128 || py !== 128) c.fillRect(x * 256 + px - 2, y * 256 + py - 2, 4, 4)
      }
      c.fillStyle = 'rgba(58,60,64,.8)'
      c.fillRect(0, 0, 512, 4); c.fillRect(0, 0, 4, 512); c.fillRect(254, 0, 4, 512); c.fillRect(0, 254, 512, 4)
    })
    map.anisotropy = maxAniso()
    const detail = photoSurface('metal')
    const material = new THREE.MeshStandardMaterial({ map, normalMap: detail.normalMap, normalScale: new THREE.Vector2(0.12, 0.12), roughnessMap: detail.roughnessMap, roughness: 0.75, metalness: 0.06, envMapIntensity: 0.35, emissive: '#c9cfd6', emissiveIntensity: 0.06, fog: false })
    material.name = 'station-exterior-skin'
    material.shadowSide = THREE.DoubleSide
    return material
  })
}

export function hullMaterial(kind: 'wall' | 'roof' = 'wall', theme: WallTheme = 'station') {
  if (theme !== 'rocket') return exteriorSkin()
  return cached(`hull:${kind}:${theme}`, false, '', () => {
    const source = kind === 'wall' ? wallMaterial(theme, false, '') : ceilingMaterial(false, '')
    const material = source.clone()
    material.name = `station-hull-${kind}`
    material.shadowSide = THREE.DoubleSide
    return material
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
      cached(`painted:${color}:${rough}:${metal}:${rich()}`, d, id, () => {
        const s = getSet(`pm:${color}`, () => paintedMetal(color, 256))
        const detail = photoSurface('metal')
        const base = { map: s.map, normalMap: detail.normalMap, normalScale: new THREE.Vector2(0.16, 0.16), roughnessMap: detail.roughnessMap,
          color: '#ffffff', roughness: Math.min(1, rough * 1.35), metalness: metal * 0.75 }
        // The thin varnish is a second BRDF per light and per pixel: only where the GPU has room for it.
        return rich() ? new THREE.MeshPhysicalMaterial({ ...base, clearcoat: 0.18, clearcoatRoughness: 0.4 }) : new THREE.MeshStandardMaterial(base)
      }),
    metal: (color = '#9aa0a6', rough = 0.35) => cached(`metal:${color}:${rough}`, d, id, () => {
      const s = photoSurface('metal', 2)
      return new THREE.MeshStandardMaterial({ color, metalness: 0.92, roughness: Math.min(1, rough * 1.5), normalMap: s.normalMap,
        normalScale: new THREE.Vector2(0.08, 0.08), roughnessMap: s.roughnessMap })
    }),
    plastic: (color: string, rough = 0.45) => cached(`plastic:${color}:${rough}`, d, id, () => new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: rough })),
    rubber: (color = '#1b1c1e') => cached(`rubber:${color}`, d, id, () => new THREE.MeshStandardMaterial({ color, metalness: 0, roughness: 0.9 })),
    fabric: (color: string) => cached(`fabric:${color}:${rich()}`, d, id, () => {
      const s = photoSurface('fabric', 3)
      const base = { color, metalness: 0, roughness: 0.96, roughnessMap: s.roughnessMap, normalMap: s.normalMap, normalScale: new THREE.Vector2(0.3, 0.3) }
      // Sheen, like clearcoat, adds a BRDF per light: kept for the higher presets.
      const m = rich() ? new THREE.MeshPhysicalMaterial({ ...base, sheen: 0.45, sheenColor: color, sheenRoughness: 0.8 }) : new THREE.MeshStandardMaterial(base)
      m.userData.fabric = true
      return m
    }),
    glow: (color: string, intensity = 3) =>
      cached(`glow:${color}:${intensity}`, false, '', () => new THREE.MeshStandardMaterial({ color: '#000000', emissive: color, emissiveIntensity: intensity, toneMapped: true })),
    glass: (tint = '#a8c6d8', opacity = 0.18) =>
      cached(`glass:${tint}:${opacity}:${rich()}`, false, '', () => new THREE.MeshPhysicalMaterial({ color: tint, metalness: 0, roughness: 0.05, transparent: true, opacity, envMapIntensity: 1.2, clearcoat: rich() ? 1 : 0, depthWrite: false })),
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
