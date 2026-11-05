// Importe le mobilier d'intérieur de la base depuis Poly Haven (CC0), la combinaison spatiale
// depuis NASA 3D Resources, et compresse le tout pour le web.
// Résultat : public/assets/models/<id>.glb. Les sources restent dans asset-src/ (non versionné).
// La partie n'appelle jamais Poly Haven : tout est servi localement.
// Usage : node scripts/fetch-interior-models.mjs [id…]   (ajouter un modèle : compléter MODELS)
import { createWriteStream, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune, simplify, textureCompress, weld } from '@gltf-transform/functions'
import draco3d from 'draco3dgltf'
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import * as THREE from 'three'
import sharp from 'sharp'

const SRC = join(process.cwd(), 'asset-src', 'models')
const OUT = join(process.cwd(), 'public', 'assets', 'models')
const HEADERS = { 'User-Agent': 'CosmoTrap-asset-import' }

/** Taille maximale des textures : 1024 pour le mobilier, 512 pour ce qui tient dans la main. */
export const MODELS = {
  // réfectoire et cuisine
  pot_enamel_01: 512, metal_jug: 512, plastic_bottle_gallon: 512,
  // coin détente
  sofa_02: 1024, modern_coffee_table_01: 1024, modern_arm_chair_01: 1024,
  // dortoir
  side_table_01: 512, desk_lamp_arm_01: 512, standing_picture_frame_01: 512, cassette_player: 512, dartboard: 512, drawer_cabinet: 1024,
  // infirmerie
  wheelchair_01: 1024, multi_cleaner_bottle: 512, multi_cleaner_5_litre: 512,
  // réserve
  cardboard_box_01: 512, steel_frame_shelves_02: 1024, barrel_03: 512,
  // laboratoire
  dining_chair_02: 512, magnifying_glass_01: 512, spray_paint_bottles: 512,
  // serre
  planter_box_02: 512, planter_pot_clay: 512, watering_can_metal_01: 512, trowel_01: 512, garden_gloves_01: 512, compost_bag_02: 512,
  // serre
  potted_plant_04: 512,
  // objets ramassables
  seadogs_compass: 512,
  // coin détente du nœud central
  chess_set: 512,
  // détails : cuisine, bureau, entretien
  vintage_electric_kettle: 512, long_life_food: 512, russian_food_cans_01: 512, plastic_thermos: 512, wooden_cutting_board: 512, clipboard: 512, binder_notebook: 512, stationery_supplies: 512, plastic_broom: 512, dustpan: 512, trashbag: 512, fire_alarm: 512, vintage_crutches_01: 512, metal_stool_02: 512, bunsen_burner: 512,
  // rangement et transport
  plastic_crate_02: 512, plastic_container: 512, metal_toolbox: 512, metal_jerrycan_green: 512, plastic_jerrycan: 512, small_lpg_tank: 512, hand_truck: 1024, industrial_storage_cart: 1024,
  // atelier
  utility_box_02: 1024, circuit_board: 512, retro_multimeter: 512, pliers: 512, screwdrivers_02: 512, combination_wrench: 512, old_drill_press: 1024, portable_welding_cart: 1024, exterior_aircon_unit: 1024,
  // machinerie et atelier
  bench_vice_01: 512, small_oil_can_01: 512, measuring_tape_01: 512, Drill_01: 512, ladder_sectioned_01: 1024, lubricant_spray: 512, industrial_wall_lamp: 512,
}

/** Modèles de la NASA (https://github.com/nasa/NASA-3D-Resources) : nom publié et taille de texture. */
const NASA = {
  z2_spacesuit: {
    name: 'Z2 Spacesuit',
    size: 1024,
    // NASA insignia are not public domain: the flag and round patches are painted over, in texture fractions.
    hide: [[0.025, 0.635, 0.045, 0.045], [0.005, 0.85, 0.09, 0.05]],
    // Arms reach forward in the source: swung down from the shoulders (model space, height along -z).
    arms: { shoulder: [0.33, -0.03, -1.5], hanging: [0.09, 0.02, 0.85] },
  },
}

/** Part des triangles conservés, pour les modèles très détaillés posés en décor. */
const SIMPLIFY = { chess_set: 0.25, potted_plant_04: 0.22 }

/** Swing each arm of an unrigged model around its shoulder, easing the bend in where the arm meets the body. */
function lowerArms(doc, { shoulder, hanging }) {
  for (const mesh of doc.getRoot().listMeshes()) for (const prim of mesh.listPrimitives()) {
    const position = prim.getAttribute('POSITION'), normal = prim.getAttribute('NORMAL')
    const p = position.getArray(), n = normal.getArray()
    for (const side of [-1, 1]) {
      const pivot = new THREE.Vector3(side * shoulder[0], shoulder[1], shoulder[2])
      // The hand is what lies furthest forward on this side.
      const hand = new THREE.Vector3()
      let count = 0
      for (let i = 0; i < p.length; i += 3) if (p[i] * side > 0.2 && p[i + 1] > 0.5) { hand.add(new THREE.Vector3(p[i], p[i + 1], p[i + 2])); count++ }
      hand.divideScalar(count)
      const axis = hand.clone().sub(pivot), length = axis.length()
      axis.normalize()
      const target = new THREE.Vector3(side * hanging[0], hanging[1], hanging[2]).normalize()
      const full = new THREE.Quaternion().setFromUnitVectors(axis, target)
      const none = new THREE.Quaternion(), q = new THREE.Quaternion(), v = new THREE.Vector3()
      for (let i = 0; i < p.length; i += 3) {
        if (p[i] * side < 0.17) continue
        v.set(p[i], p[i + 1], p[i + 2]).sub(pivot)
        const along = v.dot(axis)
        const away = v.clone().addScaledVector(axis, -along).length()
        if (along < 0 || along > length + 0.16 || away > 0.2) continue
        const t = Math.min(along / 0.16, 1)
        q.copy(none).slerp(full, t * t * (3 - 2 * t))
        v.applyQuaternion(q).add(pivot)
        p[i] = v.x; p[i + 1] = v.y; p[i + 2] = v.z
        v.set(n[i], n[i + 1], n[i + 2]).applyQuaternion(q)
        n[i] = v.x; n[i + 1] = v.y; n[i + 2] = v.z
      }
    }
    position.setArray(p); normal.setArray(n)
  }
}

async function get(url, file) {
  if (existsSync(file)) return
  mkdirSync(dirname(file), { recursive: true })
  const r = await fetch(url, { headers: HEADERS })
  if (!r.ok) throw new Error(`${r.status} ${url}`)
  await pipeline(r.body, createWriteStream(file))
}

await MeshoptEncoder.ready
await MeshoptSimplifier.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'meshopt.encoder': MeshoptEncoder,
  'draco3d.decoder': await draco3d.createDecoderModule(),
})
const wanted = process.argv.slice(2)
const ids = wanted.length ? wanted : [...Object.keys(MODELS), ...Object.keys(NASA)]
let failed = 0

for (const id of ids) {
  try {
    let source
    if (NASA[id]) {
      const path = encodeURIComponent(NASA[id].name)
      source = join(SRC, id, `${id}.glb`)
      await get(`https://raw.githubusercontent.com/nasa/NASA-3D-Resources/master/3D%20Models/${path}/${path}.glb`, source)
    } else {
      const files = await (await fetch(`https://api.polyhaven.com/files/${id}`, { headers: HEADERS })).json()
      const g = files.gltf?.['1k']?.gltf
      if (!g) throw new Error('pas de glTF 1K')
      source = join(SRC, id, `${id}.gltf`)
      await get(g.url, source)
      for (const [rel, inc] of Object.entries(g.include ?? {})) await get(inc.url, join(SRC, id, rel))
    }
    const doc = await io.read(source)
    // The source may be Draco-compressed; it is written back out with meshopt only.
    doc.getRoot().listExtensionsUsed().filter((e) => e.extensionName === 'KHR_draco_mesh_compression').forEach((e) => e.dispose())
    const size = NASA[id]?.size ?? MODELS[id] ?? 512
    if (NASA[id]?.arms) lowerArms(doc, NASA[id].arms)
    if (NASA[id]) for (const material of doc.getRoot().listMaterials()) {
      // Without stored tangents this normal map shades into black blotches in the game's renderer.
      material.setNormalTexture(null)
      const base = material.getBaseColorTexture()
      if (base && NASA[id].hide) {
        const image = sharp(Buffer.from(base.getImage()))
        const { width, height } = await image.metadata()
        const patches = await Promise.all(NASA[id].hide.map(async ([x, y, w, h]) => ({
          left: Math.round(x * width), top: Math.round(y * height),
          input: await sharp({ create: { width: Math.round(w * width), height: Math.round(h * height), channels: 3, background: '#d8d5cb' } }).png().toBuffer(),
        })))
        base.setImage(new Uint8Array(await image.composite(patches).png().toBuffer())).setMimeType('image/png')
      }
    }
    if (SIMPLIFY[id]) await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio: SIMPLIFY[id], error: 0.002 }))
    // Layered suits have shells millimetres apart: welding or coarse quantization makes the inner, darker one show through.
    const layered = !!NASA[id]
    await doc.transform(prune(), dedup(), ...(layered ? [] : [weld()]), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size] }),
      meshopt({ encoder: MeshoptEncoder, level: 'medium', ...(layered ? { quantizePosition: 16, quantizeNormal: 12, quantizeTexcoord: 16 } : {}) }))
    mkdirSync(OUT, { recursive: true })
    await io.write(join(OUT, `${id}.glb`), doc)
    console.log('ok', id)
  } catch (e) {
    failed++
    console.warn('échec', id, e.message)
  }
}
console.log(`Terminé : ${ids.length - failed} modèle(s), ${failed} échec(s).`)
if (failed) process.exitCode = 1
