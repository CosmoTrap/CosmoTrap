// Télécharge les ressources libres de droits utilisées par le jeu dans asset-src/ (non versionné).
// Poly Haven (CC0) : textures PBR 2K, HDRI, modèles glTF 1K. Solar System Scope (CC BY 4.0, d'après NASA) : planètes.
// Usage : node scripts/fetch-assets.mjs
import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'

const OUT = join(process.cwd(), 'asset-src')

export const TEXTURES = [
  'metal_plate', 'metal_plate_02', 'blue_metal_plate', 'rusty_painted_metal', 'painted_metal_shutter', 'corrugated_iron',
  'metal_grate_rusty', 'anti_skid_tiles', 'concrete_floor_worn_001', 'concrete_floor_02',
  'forest_ground_04', 'leafy_grass', 'grass_path_2', 'brown_mud', 'dark_rock', 'gray_rocks', 'brown_planks_05', 'moon_dusted_02', 'moon_01',
]
export const HDRIS = { qwantani_sunset_puresky: '2k', aircraft_workshop_01: '1k' }
export const MODELS = [
  // Terre / Lune
  'moon_rock_01', 'moon_rock_02', 'moon_rock_03', 'moon_rock_05', 'rock_moss_set_01', 'namaqualand_boulder_02', 'boulder_01',
  'pine_tree_01', 'fir_tree_01', 'island_tree_02', 'shrub_01', 'shrub_02', 'grass_medium_01', 'fern_02', 'dead_tree_trunk',
  'wooden_military_crate', 'vintage_radio_transceiver', 'signal_flashlight',
  // station
  'metal_tool_chest', 'steel_frame_shelves_01', 'plastic_crate_01', 'industrial_pastic_container', 'modular_industrial_pipes_01',
  'mounted_fluorescent_lights', 'power_box_01', 'utility_box_01', 'security_camera_01', 'korean_fire_extinguisher_01',
  'medical_box', 'metal_office_desk', 'metal_stool_01', 'industrial_microscope', 'chemistry_set', 'potted_plant_02',
  'seeding_tray_01', 'adjustable_wrench', 'alarm_clock_01', 'portable_generator', 'propane_tank', 'old_military_crate',
  'vintage_spacecraft_instrument', 'medical_tape', 'binoculars', 'worn_metal_rack', 'tool_cart',
]
export const PLANETS = {
  '8k_moon.jpg': 'https://www.solarsystemscope.com/textures/download/8k_moon.jpg',
  '8k_earth_daymap.jpg': 'https://www.solarsystemscope.com/textures/download/8k_earth_daymap.jpg',
  '8k_earth_nightmap.jpg': 'https://www.solarsystemscope.com/textures/download/8k_earth_nightmap.jpg',
  '8k_earth_clouds.jpg': 'https://www.solarsystemscope.com/textures/download/8k_earth_clouds.jpg',
  '8k_stars_milky_way.jpg': 'https://www.solarsystemscope.com/textures/download/8k_stars_milky_way.jpg',
  '8k_saturn.jpg': 'https://www.solarsystemscope.com/textures/download/8k_saturn.jpg',
  '8k_saturn_ring_alpha.png': 'https://www.solarsystemscope.com/textures/download/8k_saturn_ring_alpha.png',
}

async function get(url, file) {
  if (existsSync(file)) return
  mkdirSync(dirname(file), { recursive: true })
  const r = await fetch(url)
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  await pipeline(r.body, createWriteStream(file))
}
const files = async (id) => (await fetch(`https://api.polyhaven.com/files/${id}`)).json()

const jobs = []
for (const id of TEXTURES)
  jobs.push(async () => {
    const f = await files(id)
    const pick = { diff: f.Diffuse ?? f.diff, nor: f.nor_gl, rough: f.Rough ?? f.rough, ao: f.AO ?? f.ao, arm: f.arm }
    for (const [k, v] of Object.entries(pick)) {
      const e = v?.['2k']?.jpg ?? v?.['2k']?.png
      if (e) await get(e.url, join(OUT, 'textures', id, `${k}.${e.url.split('.').pop()}`))
    }
  })
for (const [id, res] of Object.entries(HDRIS))
  jobs.push(async () => {
    const f = await files(id)
    await get(f.hdri[res].hdr.url, join(OUT, 'hdri', `${id}.hdr`))
  })
for (const id of MODELS)
  jobs.push(async () => {
    const f = await files(id)
    const g = f.gltf?.['1k']?.gltf
    if (!g) return console.warn('pas de glTF :', id)
    await get(g.url, join(OUT, 'models', id, `${id}.gltf`))
    for (const [rel, inc] of Object.entries(g.include ?? {})) await get(inc.url, join(OUT, 'models', id, rel))
  })
for (const [name, url] of Object.entries(PLANETS)) jobs.push(() => get(url, join(OUT, 'planets', name)))

let done = 0
let fail = 0
const run = async () => {
  while (jobs.length) {
    const j = jobs.shift()
    try {
      await j()
    } catch (e) {
      fail++
      console.warn('échec :', e.message)
    }
    done++
    if (done % 10 === 0) console.log(`${done} ressources…`)
  }
}
await Promise.all(Array.from({ length: 6 }, run))
console.log(`Terminé : ${done} ressources, ${fail} échec(s).`)
