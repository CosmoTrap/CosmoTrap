import type { Quality } from '../game/state'

export interface QualityCfg {
  dpr: [number, number]
  tex: number
  sunShadow: number
  lampShadow: boolean
  ao: false | 'half' | 'full'
  bloom: boolean
  smaa: boolean
  grass: number
  trees: number
  godrays: boolean
  particles: number
  moonDetail: number
  clouds: boolean
}

export const QUALITY: Record<Quality, QualityCfg> = {
  low: { dpr: [0.6, 0.85], tex: 512, sunShadow: 0, lampShadow: false, ao: false, bloom: true, smaa: false, grass: 12000, trees: 60, godrays: true, particles: 120, moonDetail: 1, clouds: false },
  medium: { dpr: [0.8, 1], tex: 512, sunShadow: 1024, lampShadow: false, ao: 'half', bloom: true, smaa: true, grass: 35000, trees: 110, godrays: true, particles: 300, moonDetail: 2, clouds: true },
  high: { dpr: [1, 1.5], tex: 1024, sunShadow: 2048, lampShadow: true, ao: 'half', bloom: true, smaa: true, grass: 70000, trees: 150, godrays: true, particles: 500, moonDetail: 3, clouds: true },
  ultra: { dpr: [1.2, 2], tex: 1024, sunShadow: 4096, lampShadow: true, ao: 'full', bloom: true, smaa: true, grass: 140000, trees: 200, godrays: true, particles: 900, moonDetail: 3, clouds: true },
}
