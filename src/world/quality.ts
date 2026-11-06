import { G } from '../game/state'
import type { Quality } from '../game/state'

export interface QualityCfg {
  dpr: [number, number]
  tex: number
  sunShadow: number
  lampShadow: boolean
  ao: false | 'half' | 'full'
  bloom: boolean
  smaa: boolean
  trees: number
  godrays: boolean
  particles: number
  moonDetail: number
  clouds: boolean
  /** Clearcoat on painted metal and sheen on fabric: each costs one more BRDF per light, per pixel. */
  richMaterials: boolean
  /** The sun's shadow is redrawn every N frames (the scene it covers barely moves). */
  sunShadowEvery: number
  /** Soft (PCFSoft) or plain PCF shadow filtering. */
  softShadows: boolean
  /** Anisotropic filtering of the photo textures. */
  anisotropy: number
}

export const QUALITY: Record<Quality, QualityCfg> = {
  low: { dpr: [0.55, 0.8], tex: 512, sunShadow: 0, lampShadow: false, ao: false, bloom: true, smaa: false, trees: 60, godrays: true, particles: 120, moonDetail: 1, clouds: false, richMaterials: false, sunShadowEvery: 8, softShadows: false, anisotropy: 2 },
  medium: { dpr: [0.65, 0.9], tex: 512, sunShadow: 1024, lampShadow: false, ao: false, bloom: true, smaa: true, trees: 110, godrays: true, particles: 300, moonDetail: 2, clouds: true, richMaterials: false, sunShadowEvery: 4, softShadows: false, anisotropy: 4 },
  high: { dpr: [1, 1.5], tex: 1024, sunShadow: 2048, lampShadow: true, ao: 'half', bloom: true, smaa: true, trees: 150, godrays: true, particles: 500, moonDetail: 3, clouds: true, richMaterials: true, sunShadowEvery: 2, softShadows: true, anisotropy: 8 },
  ultra: { dpr: [1.2, 2], tex: 1024, sunShadow: 4096, lampShadow: true, ao: 'full', bloom: true, smaa: true, trees: 200, godrays: true, particles: 900, moonDetail: 3, clouds: true, richMaterials: true, sunShadowEvery: 1, softShadows: true, anisotropy: 8 },
}

/** Anisotropic filtering for photo textures, following the current preset (read when a texture is made). */
export const maxAniso = () => QUALITY[G().settings.quality].anisotropy
