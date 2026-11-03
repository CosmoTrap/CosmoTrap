// Prépare les arbres photoscannés pour le temps réel.
// - garde un seul arbre par fichier (les fichiers Poly Haven en contiennent plusieurs côte à côte)
// - feuillage : garde une partie des grappes ENTIÈRES (composantes connexes) et les grossit un peu,
//   au lieu d'une simplification qui déchiquette les aiguilles
// - tronc et branches : simplification classique
// Usage : node scripts/decimate-trees.mjs
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { dedup, meshopt, prune, resample, simplifyPrimitive, textureCompress, weld } from '@gltf-transform/functions'
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer'
import sharp from 'sharp'

const TREES = [
  { id: 'fir_tree_01', keepNode: 'NurbsPath.001', foliage: /twig/, keep: 0.05, grow: 1.7 },
  { id: 'pine_tree_01', keepNode: 'NurbsPath.022', foliage: /twig/, keep: 0.04, grow: 1.8 },
  { id: 'island_tree_02', keepNode: null, foliage: /leaves/, keep: 0.42, grow: 1.22 },
  // versions lointaines (LOD) : beaucoup moins de grappes, plus grosses
  { id: 'fir_tree_01', out: 'fir_tree_01_far', keepNode: 'NurbsPath.001', foliage: /twig/, keep: 0.005, grow: 3.4, trunk: 0.06 },
  { id: 'pine_tree_01', out: 'pine_tree_01_far', keepNode: 'NurbsPath.022', foliage: /twig/, keep: 0.004, grow: 3.6, trunk: 0.06 },
  { id: 'island_tree_02', out: 'island_tree_02_far', keepNode: null, foliage: /leaves/, keep: 0.05, grow: 2.0, trunk: 0.06 },
]
const only = process.argv[2]

await MeshoptSimplifier.ready
await MeshoptEncoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder })

function decimateComponents(prim, keep, grow, doc) {
  const pos = prim.getAttribute('POSITION')
  const idxAcc = prim.getIndices()
  const n = pos.getCount()
  const index = idxAcc ? idxAcc.getArray() : Uint32Array.from({ length: n }, (_, i) => i)
  // union-find sur les sommets reliés par un triangle
  const parent = new Int32Array(n)
  for (let i = 0; i < n; i++) parent[i] = i
  const find = (a) => {
    while (parent[a] !== a) a = parent[a] = parent[parent[a]]
    return a
  }
  for (let t = 0; t < index.length; t += 3) {
    const a = find(index[t])
    const b = find(index[t + 1])
    const c = find(index[t + 2])
    parent[b] = a
    parent[c] = a
  }
  // tirage déterministe des composantes conservées
  const keepRoot = new Map()
  const hash = (x) => {
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b)
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296
  }
  const kept = (v) => {
    const r = find(v)
    let k = keepRoot.get(r)
    if (k === undefined) keepRoot.set(r, (k = hash(r) < keep))
    return k
  }
  // centre de chaque composante (pour la grossir autour d'elle-même)
  const sums = new Map()
  const p = pos.getArray()
  for (let v = 0; v < n; v++) {
    if (!kept(v)) continue
    const r = find(v)
    const s = sums.get(r) ?? [0, 0, 0, 0]
    s[0] += p[v * 3]
    s[1] += p[v * 3 + 1]
    s[2] += p[v * 3 + 2]
    s[3]++
    sums.set(r, s)
  }
  for (let v = 0; v < n; v++) {
    if (!kept(v)) continue
    const s = sums.get(find(v))
    for (let k = 0; k < 3; k++) {
      const c = s[k] / s[3]
      p[v * 3 + k] = c + (p[v * 3 + k] - c) * grow
    }
  }
  pos.setArray(p)
  const out = []
  for (let t = 0; t < index.length; t += 3) if (kept(index[t])) out.push(index[t], index[t + 1], index[t + 2])
  const acc = doc.createAccessor().setType('SCALAR').setArray(n > 65535 ? new Uint32Array(out) : new Uint16Array(out)).setBuffer(doc.getRoot().listBuffers()[0])
  prim.setIndices(acc)
  return out.length / 3
}

for (const t of TREES) {
  if (only && (t.out ?? t.id) !== only && !(only === 'far' && t.out)) continue
  const doc = await io.read(`asset-src/models/${t.id}/${t.id}.gltf`)
  const root = doc.getRoot()
  if (t.keepNode) {
    for (const node of root.listNodes()) if (node.getMesh() && node.getMesh().getName() !== t.keepNode) node.dispose()
    const kept = root.listNodes().find((x) => x.getMesh()?.getName() === t.keepNode)
    if (kept) {
      const tr = kept.getTranslation()
      kept.setTranslation([0, tr[1], 0])
    }
  }
  await doc.transform(prune())
  let tris = 0
  for (const mesh of root.listMeshes())
    for (const prim of mesh.listPrimitives()) {
      const name = prim.getMaterial()?.getName() ?? ''
      if (t.foliage.test(name)) tris += decimateComponents(prim, t.keep, t.grow, doc)
      else simplifyPrimitive(prim, { simplifier: MeshoptSimplifier, ratio: t.trunk ?? 0.2, error: t.trunk ? 0.02 : 0.003 })
    }
  await doc.transform(
    prune(),
    dedup(),
    weld(),
    resample(),
    textureCompress({ encoder: sharp, targetFormat: 'webp', resize: t.out ? [512, 512] : [1024, 1024] }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium' }),
  )
  await io.write(`public/assets/models/${t.out ?? t.id}.glb`, doc)
  let total = 0
  for (const mesh of root.listMeshes()) for (const prim of mesh.listPrimitives()) total += (prim.getIndices()?.getCount() ?? 0) / 3
  console.log(`${t.out ?? t.id} : feuillage ${Math.round(tris)} tris, total ${Math.round(total)} tris`)
}
