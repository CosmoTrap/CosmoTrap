// Couleurs 3D des skins (mêmes teintes que les illustrations de public/skins).
export interface Skin3D {
  /** combinaison */
  suit: string
  soft: string
  /** peau, fourrure ou métal : mains et tête */
  body: string
  boots: string
  /** astronaute : casque et sac de survie */
  helmet?: boolean
  emissive?: string
}

export const SKINS_3D: Record<string, Skin3D> = {
  ines: { suit: '#e9e6de', soft: '#d8d4ca', body: '#2a2c30', boots: '#2a2c30', helmet: true },
  leo: { suit: '#2b3163', soft: '#20264f', body: '#f2823a', boots: '#f4f1e8' },
  nova: { suit: '#12395a', soft: '#0d2a45', body: '#37d6c4', boots: '#0d2a45', emissive: '#2be0cc' },
  kenji: { suit: '#3a3370', soft: '#2a2558', body: '#c7cee8', boots: '#2a2558', emissive: '#3fd8f0' },
  sam: { suit: '#e9edf5', soft: '#c9d0de', body: '#c9a15b', boots: '#6d7892' },
  maya: { suit: '#f4f7ec', soft: '#dfe6cf', body: '#8fd14f', boots: '#4a3b7e' },
}

export const skinOf = (id?: string) => SKINS_3D[id ?? 'ines'] ?? SKINS_3D.ines
