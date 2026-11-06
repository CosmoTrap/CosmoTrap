import * as THREE from 'three'
import type { PBRSet } from './textures'
import { maxAniso } from './quality'

type Surface = 'metal' | 'fabric' | 'ground' | 'rock' | 'wood' | 'bark'
const sets = new Map<string, PBRSet>()
const loader = new THREE.TextureLoader()

/** Shared local CC0 scans. Repeat belongs to the cache key, never to a caller. */
export function photoSurface(name: Surface, repeat = 1): PBRSet {
  const key = `${name}:${repeat}`
  const old = sets.get(key)
  if (old) return old
  const load = (map: string, color = false) => {
    const t = loader.load(`/textures/${name}/${map}.jpg`)
    t.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(repeat, repeat)
    t.anisotropy = maxAniso()
    return t
  }
  const result = { map: load('albedo', true), normalMap: load('normal'), roughnessMap: load('roughness') }
  sets.set(key, result)
  return result
}
