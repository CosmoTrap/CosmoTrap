import { useGLTF } from '@react-three/drei'
import { useMemo } from 'react'
import * as THREE from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'

// Ressources photoréalistes (Poly Haven CC0, cartes planétaires d'après la NASA) servies depuis /assets.

const loader = new THREE.TextureLoader()
const texCache = new Map<string, THREE.Texture>()

export function tex(url: string, srgb = true, repeat: [number, number] = [1, 1]) {
  const key = `${url}|${repeat.join(',')}`
  let t = texCache.get(key)
  if (!t) {
    t = loader.load(url)
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.anisotropy = 8
    t.repeat.set(repeat[0], repeat[1])
    texCache.set(key, t)
  }
  return t
}

export interface PBR {
  map: THREE.Texture
  normalMap: THREE.Texture
  /** R = occlusion, G = rugosité, B = métal (format ARM de Poly Haven) */
  arm: THREE.Texture
}

/** jeu de textures PBR réel (diffuse, normale, ARM) */
export function pbr(id: string, repeat: [number, number] = [1, 1]): PBR {
  const base = `/assets/tex/${id}`
  return { map: tex(`${base}/diff.jpg`, true, repeat), normalMap: tex(`${base}/nor.jpg`, false, repeat), arm: tex(`${base}/arm.jpg`, false, repeat) }
}

/** matériau standard à partir d'un jeu PBR réel */
export function pbrMaterial(id: string, o: { repeat?: [number, number]; color?: string; metal?: number; rough?: number; normal?: number; env?: number } = {}) {
  const s = pbr(id, o.repeat)
  return new THREE.MeshStandardMaterial({
    map: s.map,
    normalMap: s.normalMap,
    normalScale: new THREE.Vector2(o.normal ?? 1, o.normal ?? 1),
    aoMap: s.arm,
    aoMapIntensity: 0.9,
    roughnessMap: s.arm,
    metalnessMap: s.arm,
    roughness: o.rough ?? 1,
    metalness: o.metal ?? 1,
    color: o.color ?? '#ffffff',
    envMapIntensity: o.env ?? 1,
  })
}

export const MODEL = (id: string) => `/assets/models/${id}.glb`

/** modèle glTF compressé (meshopt) — renvoie une copie indépendante, ombres activées */
export function useModel(id: string, opts: { shadows?: boolean; envIntensity?: number; tint?: string } = {}) {
  const gltf = useGLTF(MODEL(id), false, true)
  return useMemo(() => {
    const root = cloneSkinned(gltf.scene) as THREE.Group
    root.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      m.castShadow = opts.shadows ?? true
      m.receiveShadow = true
      const mat = (m.material as THREE.MeshStandardMaterial).clone()
      if (opts.envIntensity !== undefined) mat.envMapIntensity = opts.envIntensity
      if (opts.tint) mat.color.multiply(new THREE.Color(opts.tint))
      m.material = mat
    })
    return root
  }, [gltf, opts.shadows, opts.envIntensity, opts.tint])
}

/** maillages + matériaux d'un modèle (pour l'instanciation : arbres, rochers, herbe) */
export function useModelParts(id: string) {
  const gltf = useGLTF(MODEL(id), false, true)
  return useMemo(() => {
    const parts: { geometry: THREE.BufferGeometry; material: THREE.Material }[] = []
    gltf.scene.updateMatrixWorld(true)
    gltf.scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      // les modèles compressés stockent les sommets en entiers quantifiés : on repasse en flottants
      // avant d'appliquer la transformation (sinon les valeurs hors de [-1, 1] sont écrasées)
      const g = new THREE.BufferGeometry()
      for (const [name, a] of Object.entries(m.geometry.attributes)) {
        const attr = a as THREE.BufferAttribute
        const out = new Float32Array(attr.count * attr.itemSize)
        for (let i = 0; i < attr.count; i++) for (let k = 0; k < attr.itemSize; k++) out[i * attr.itemSize + k] = attr.getComponent(i, k)
        g.setAttribute(name, new THREE.BufferAttribute(out, attr.itemSize))
      }
      if (m.geometry.index) g.setIndex(m.geometry.index.clone())
      g.applyMatrix4(m.matrixWorld)
      parts.push({ geometry: g, material: m.material as THREE.Material })
    })
    const box = new THREE.Box3()
    for (const p of parts) {
      p.geometry.computeBoundingBox()
      box.union(p.geometry.boundingBox!)
    }
    return { parts, box }
  }, [gltf])
}

export const preloadModels = (ids: string[]) => ids.forEach((id) => useGLTF.preload(MODEL(id), false, true))

export const STATION_MODELS = [
  'plastic_crate_01',
  'old_military_crate',
  'industrial_pastic_container',
  'steel_frame_shelves_01',
  'worn_metal_rack',
  'korean_fire_extinguisher_01',
  'medical_box',
  'metal_office_desk',
  'industrial_microscope',
  'chemistry_set',
  'potted_plant_02',
  'seeding_tray_01',
  'power_box_01',
  'utility_box_01',
  'security_camera_01',
  'metal_tool_chest',
  'tool_cart',
  'portable_generator',
  'propane_tank',
  'vintage_spacecraft_instrument',
  'modular_industrial_pipes_01',
  'adjustable_wrench',
  'medical_tape',
  'alarm_clock_01',
  'metal_stool_01',
]
export const EARTH_MODELS = ['pine_tree_01', 'fir_tree_01', 'island_tree_02', 'shrub_01', 'shrub_02', 'fern_02', 'grass_medium_01', 'rock_moss_set_01', 'namaqualand_boulder_02', 'boulder_01', 'dead_tree_trunk', 'wooden_military_crate', 'vintage_radio_transceiver']
export const MOON_MODELS = ['moon_rock_01', 'moon_rock_02', 'moon_rock_03', 'moon_rock_05']

/** taille d'un modèle (mètres) une fois chargé */
export function boxOf(o: THREE.Object3D) {
  return new THREE.Box3().setFromObject(o)
}
