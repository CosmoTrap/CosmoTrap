// Offline asset import only: the game never contacts Poly Haven at runtime.
// Sources and original download hashes are preserved next to the assets.
import { mkdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const assets = {
  metal: 'rusty_metal_04', fabric: 'fabric_pattern_07',
  ground: 'forest_ground_04', rock: 'rock_face', wood: 'wood_planks_grey', bark: 'pine_bark',
}
const manifest = { license: 'CC0-1.0', licenseUrl: 'https://polyhaven.com/license', assets: [] }
async function download(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(90000) })
  if (!response.ok) throw new Error(`${response.status}: ${url}`)
  return response
}
for (const [name, id] of Object.entries(assets)) {
  const files = await (await download(`https://api.polyhaven.com/files/${id}`)).json()
  const folder = new URL(`../public/textures/${name}/`, import.meta.url)
  await mkdir(folder, { recursive: true })
  const maps = { albedo: files.diff ?? files.Diffuse ?? files.col_1, normal: files.nor_gl, roughness: files.rough ?? files.Rough }
  const record = { id, source: `https://polyhaven.com/a/${id}`, files: [] }
  for (const [map, variants] of Object.entries(maps)) {
    const source = variants?.['1k']?.jpg
    if (!source) throw new Error(`Missing 1k JPG ${map}: ${id}`)
    const data = Buffer.from(await (await download(source.url)).arrayBuffer())
    await writeFile(new URL(`${map}.jpg`, folder), data)
    record.files.push({ path: `${name}/${map}.jpg`, url: source.url, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') })
  }
  manifest.assets.push(record)
  console.log(`Imported ${id}`)
}
await writeFile(new URL('../public/textures/sources.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n')
