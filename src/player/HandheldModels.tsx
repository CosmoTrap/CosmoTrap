import { Suspense, useEffect, useMemo } from 'react'
import * as THREE from 'three'
import type { ItemId } from '../game/types'
import { useModel } from '../world/assets'
import { useMats } from '../world/materials'
import { photoSurface } from '../world/photomaterials'
import { BoxExact as Box, Cyl } from '../world/props/models'
import { textTexture } from '../world/textures'
import { ropeBraid } from './handMaterials'

type V3 = [number, number, number]

function Label({ lines, size, p, color = '#cbc6ae', ink = '#242c2f', r }: {
  lines: string[]; size: [number, number]; p: V3; color?: string; ink?: string; r?: V3
}) {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    map: textTexture(lines, { w: 512, h: 256, bg: color, fg: ink, size: 42, pad: 24 }),
    roughness: 0.72, metalness: 0, polygonOffset: true, polygonOffsetFactor: -1,
  }), [lines.join('|'), color, ink])
  useEffect(() => () => { mat.map?.dispose(); mat.dispose() }, [mat])
  return <mesh position={p} rotation={r} material={mat}><planeGeometry args={size} /></mesh>
}

function Cable({ points, radius = 0.004, material, closed = false }: { points: V3[]; radius?: number; material: THREE.Material; closed?: boolean }) {
  const geo = useMemo(() => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed), 64, radius, 8, closed), [JSON.stringify(points), radius, closed])
  useEffect(() => () => geo.dispose(), [geo])
  return <mesh geometry={geo} material={material} receiveShadow />
}

function Screw({ p, r }: { p: V3; r?: V3 }) {
  const m = useMats()
  return <group position={p} rotation={r}>
    <Cyl a={[0.003, 0.003, 0.0015]} r={[Math.PI / 2, 0, 0]} m={m.metal('#aaa9a1', 0.26)} seg={12} />
    <Box s={[0.004, 0.0007, 0.001]} p={[0, 0, 0.001]} m={m.rubber()} />
  </group>
}

function ScannedWrench() {
  const obj = useModel('adjustable_wrench', { shadows: false, envIntensity: 0.65 })
  const fit = useMemo(() => {
    const b = new THREE.Box3().setFromObject(obj)
    const k = 0.31 / b.getSize(new THREE.Vector3()).y
    const c = b.getCenter(new THREE.Vector3())
    return { k, offset: [-c.x, -b.min.y - 0.08 / k, -c.z] as V3 }
  }, [obj])
  useEffect(() => () => obj.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose())
  }), [obj])
  return <group rotation={[0.14, -0.28, -0.28]} scale={fit.k}><primitive object={obj} position={fit.offset} /></group>
}

function Fuse() {
  const m = useMats()
  return <group rotation={[0.12, 0.15, -0.25]} position={[0, 0.055, 0]}>
    <Cyl a={[0.021, 0.021, 0.095]} m={m.plastic('#d0cdbb', 0.74)} seg={32} />
    {[-1, 1].map((s) => <group key={s} position={[0, s * 0.057, 0]}>
      <Cyl a={[0.024, 0.024, 0.025]} m={m.metal('#b2a786', 0.27)} seg={32} />
      <Cyl a={[0.0245, 0.0245, 0.003]} p={[0, s * 0.009, 0]} m={m.metal('#6e6c62')} seg={32} />
      <Box s={[0.012, 0.026, 0.004]} p={[0, s * 0.022, 0]} m={m.metal('#aba494', 0.23)} />
    </group>)}
    <Label lines={['HRC 40A', '500V AC']} size={[0.032, 0.025]} p={[0, 0.005, 0.0212]} />
  </group>
}

function PowerCell() {
  const m = useMats()
  return <group rotation={[0.12, 0, -0.16]} position={[0, 0.065, 0]}>
    <Cyl a={[0.042, 0.042, 0.21]} m={m.metal('#3b454a', 0.38)} seg={32} />
    <Cyl a={[0.043, 0.043, 0.135]} m={m.painted('#355258', 0.4, 0.5)} seg={32} />
    {[-0.094, 0.094].map((y) => <group key={y} position={[0, y, 0]}>
      <Cyl a={[0.05, 0.05, 0.027]} m={m.metal('#8b9193', 0.3)} seg={32} />
      <Cyl a={[0.051, 0.051, 0.004]} m={m.rubber()} seg={32} />
    </group>)}
    {[0, 1, 2, 3, 4, 5].map((i) => <group key={i} rotation={[0, i * Math.PI / 3, 0]}>
      <Box s={[0.007, 0.15, 0.004]} p={[0, 0, 0.044]} m={m.glow('#55bcb8', 0.7)} />
      <Box s={[0.012, 0.19, 0.006]} p={[0.017, 0, 0.042]} m={m.metal('#555f63')} />
    </group>)}
    <Cyl a={[0.024, 0.032, 0.012]} p={[0, 0.116, 0]} m={m.plastic('#313939')} />
    {[-0.012, 0.012].map((x) => <Cyl key={x} a={[0.004, 0.004, 0.017]} p={[x, 0.128, 0]} m={m.metal('#a48d55')} seg={16} />)}
    <Label lines={['HERMÈS', '48V • Li-ion']} size={[0.039, 0.034]} p={[0, -0.023, 0.049]} />
  </group>
}

function Battery() {
  const m = useMats()
  return <group position={[0, 0.005, 0]} rotation={[0.1, -0.22, 0]}>
    <Box s={[0.21, 0.135, 0.12]} m={m.plastic('#363a38', 0.68)} />
    <Box s={[0.22, 0.016, 0.13]} p={[0, 0.072, 0]} m={m.plastic('#202727', 0.5)} />
    {[-0.081, 0.081].map((x) => <group key={x} position={[x, 0.09, 0]}>
      <Cyl a={[0.008, 0.011, 0.02]} m={m.metal('#a49d89', 0.45)} seg={24} />
      <Cyl a={[0.015, 0.015, 0.006]} p={[0, -0.007, 0]} m={m.plastic(x < 0 ? '#96352b' : '#161d20')} />
    </group>)}
    {[-0.082, -0.05, 0.05, 0.082].map((x) => <Box key={x} s={[0.004, 0.11, 0.004]} p={[x, -0.006, 0.061]} m={m.plastic('#272e2d')} />)}
    <Cable points={[[-0.058, 0.08, 0], [-0.054, 0.125, 0], [0.054, 0.125, 0], [0.058, 0.08, 0]]} radius={0.007} material={m.rubber()} />
    <Label lines={['AUXILIARY', '12V / 18Ah']} size={[0.092, 0.065]} p={[0, -0.005, 0.061]} color="#b4a779" />
    <Label lines={['+', 'POS']} size={[0.024, 0.024]} p={[-0.08, 0.051, 0.066]} color="#96352b" ink="#e3d7c1" />
  </group>
}

function Antenna() {
  const m = useMats()
  return <group rotation={[0.13, 0, -0.22]}>
    <Cyl a={[0.023, 0.026, 0.13]} m={m.rubber('#303636')} seg={32} />
    {Array.from({ length: 7 }, (_, i) => <Cyl key={i} a={[0.025, 0.025, 0.003]} p={[0, -0.045 + i * 0.015, 0]} m={m.plastic('#444a47', 0.7)} seg={32} />)}
    <Cyl a={[0.012, 0.02, 0.035]} p={[0, 0.078, 0]} m={m.metal('#8c8e89')} seg={32} />
    {[0, 1, 2].map((i) => <group key={i} position={[0, 0.16 + i * 0.135, 0]}>
      <Cyl a={[0.007 - i * 0.0016, 0.009 - i * 0.0016, 0.14]} m={m.metal('#a6aaa7', 0.23)} seg={24} />
      <Cyl a={[0.01 - i * 0.0016, 0.01 - i * 0.0016, 0.008]} p={[0, -0.065, 0]} m={m.metal('#646d6e')} seg={24} />
    </group>)}
    <mesh position={[0, 0.502, 0]} material={m.rubber()}><sphereGeometry args={[0.008, 16, 12]} /></mesh>
    <Cyl a={[0.009, 0.009, 0.017]} p={[0, -0.073, 0]} m={m.metal('#a48d55')} />
  </group>
}

function Rope() {
  const m = useMats()
  const rope = useMemo(() => {
    const s = photoSurface('fabric', 12)
    return new THREE.MeshStandardMaterial({ map: ropeBraid(), roughness: 0.96, normalMap: s.normalMap,
      normalScale: new THREE.Vector2(0.55, 0.55), roughnessMap: s.roughnessMap })
  }, [])
  useEffect(() => () => rope.dispose(), [rope])
  return <group position={[0, 0.05, 0]} rotation={[0.12, -0.12, -0.22]}>
    {[0, 1, 2, 3, 4].map((i) => <Cable key={i} radius={0.006} closed material={rope}
      points={Array.from({ length: 20 }, (_, j) => { const a = j / 20 * Math.PI * 2; return [Math.cos(a) * (0.053 + i * 0.0015), Math.sin(a) * (0.115 + i * 0.0015), (i - 2) * 0.011] })} />)}
    <Cable points={[[0.05, 0.04, 0.03], [0.08, -0.03, 0.02], [0.048, -0.1, 0.02], [0.07, -0.16, 0.01]]} radius={0.006} material={rope} />
    <Box s={[0.105, 0.022, 0.068]} p={[0, 0.045, 0]} m={m.fabric('#414c42')} />
    <Box s={[0.027, 0.027, 0.007]} p={[0.014, 0.045, 0.037]} m={m.metal('#929183')} />
    <Box s={[0.014, 0.014, 0.008]} p={[0.014, 0.045, 0.039]} m={m.rubber()} />
  </group>
}

function Badge() {
  const m = useMats()
  return <group rotation={[0.14, -0.18, 0.04]} position={[0, 0.055, 0]}>
    <Box s={[0.092, 0.136, 0.005]} m={m.plastic('#ddd8c7', 0.46)} />
    <Box s={[0.096, 0.14, 0.002]} p={[0, 0, -0.003]} m={m.plastic('#222d36', 0.7)} />
    <Label lines={['SELENE-7', 'CREW / ACCESS 02', 'ID 084 • AUTHORIZED']} size={[0.082, 0.102]} p={[0, 0, 0.0026]} color="#c4c9be" ink="#173441" />
    <Box s={[0.082, 0.015, 0.001]} p={[0, 0.052, 0.003]} m={m.painted('#845137')} />
    <Box s={[0.021, 0.018, 0.002]} p={[-0.027, -0.048, 0.003]} m={m.metal('#bba567', 0.4)} />
    {[-0.032, -0.026, -0.02].map((x) => <Box key={x} s={[0.0007, 0.014, 0.0005]} p={[x, -0.048, 0.0042]} m={m.rubber()} />)}
    <Box s={[0.014, 0.027, 0.005]} p={[0, 0.075, 0]} m={m.metal('#9b9e97')} />
    <Cable points={[[0, 0.087, 0], [-0.025, 0.14, -0.01], [-0.01, 0.2, -0.025], [0.025, 0.14, -0.01], [0, 0.087, 0]]} radius={0.003} material={m.fabric('#3d565a')} />
  </group>
}

function FlareGun() {
  const m = useMats()
  const steel = m.metal('#747a78', 0.3)
  return <group rotation={[0.08, -0.15, -0.06]}>
    <group rotation={[-0.24, 0, 0]}>
      <Box s={[0.041, 0.125, 0.051]} p={[0, -0.015, 0.018]} m={m.painted('#963c24', 0.7, 0.12)} />
      {[-1, 1].map((s) => <group key={s} position={[s * 0.022, -0.01, 0.02]} rotation={[0, s * Math.PI / 2, 0]}>
        <Box s={[0.037, 0.091, 0.005]} m={m.rubber('#332e28')} />
        {Array.from({ length: 6 }, (_, i) => <Box key={i} s={[0.03, 0.002, 0.002]} p={[0, -0.03 + i * 0.012, 0.003]} m={m.plastic('#51493e', 0.8)} />)}
        <Screw p={[0, 0.035, 0.004]} />
        <Screw p={[0, -0.035, 0.004]} />
      </group>)}
    </group>
    <Box s={[0.048, 0.036, 0.11]} p={[0, 0.061, -0.017]} m={m.painted('#9e4228', 0.53, 0.4)} />
    <Cyl a={[0.023, 0.025, 0.18]} p={[0, 0.085, -0.063]} r={[Math.PI / 2, 0, 0]} m={steel} seg={40} />
    <mesh position={[0, 0.085, -0.154]} rotation={[0, Math.PI, 0]} material={m.metal('#aba99d', 0.25)}><ringGeometry args={[0.017, 0.0235, 40]} /></mesh>
    <mesh position={[0, 0.085, -0.1541]} rotation={[0, Math.PI, 0]} material={m.rubber('#080b0b')}><circleGeometry args={[0.017, 40]} /></mesh>
    <Box s={[0.006, 0.008, 0.014]} p={[0, 0.112, -0.134]} m={steel} />
    <Cyl a={[0.009, 0.009, 0.055]} p={[0, 0.058, -0.043]} r={[0, 0, Math.PI / 2]} m={steel} seg={24} />
    <Cable points={[[0, 0.048, -0.023], [0, 0.029, -0.066], [0, -0.009, -0.062], [0, -0.012, 0.002]]} radius={0.004} material={steel} />
    <Cable points={[[0, 0.05, -0.027], [0, 0.023, -0.025], [0, 0.012, -0.035]]} radius={0.003} material={steel} />
    <Box s={[0.012, 0.022, 0.016]} p={[0, 0.1, 0.037]} r={[0.35, 0, 0]} m={steel} />
    <Label lines={['SIGNAL', '26.5 mm']} size={[0.06, 0.018]} p={[-0.025, 0.06, -0.015]} r={[0, -Math.PI / 2, 0]} color="#943e26" ink="#cbbda2" />
  </group>
}

function Document({ map }: { map: boolean }) {
  const m = useMats()
  return <group rotation={[0.15, -0.18, -0.08]} position={[0, 0.06, 0]}>
    <Box s={[0.15, 0.205, 0.013]} m={m.fabric(map ? '#536153' : '#45535d')} />
    <Box s={[0.142, 0.196, 0.008]} p={[0.003, 0, 0.004]} m={m.plastic('#cac4ae', 0.92)} />
    {[-0.002, 0, 0.002].map((z) => <Box key={z} s={[0.142, 0.0006, 0.0007]} p={[0.003, -0.098, z + 0.004]} m={m.plastic('#817e70', 0.95)} />)}
    <Label lines={map ? ['SELENE-7', 'SURFACE MAP', 'RECOVERY SECTOR'] : ['HERMÈS', 'FLIGHT MANUAL', 'EMERGENCY PROCEDURES']} size={[0.133, 0.18]} p={[0.003, 0, 0.009]} />
    <Box s={[0.012, 0.208, 0.017]} p={[-0.072, 0, 0]} m={m.fabric('#36434b')} />
  </group>
}

/** Meter-scale props, with the same PBR surfaces and reflections as the world. */
export function HeldItem({ item }: { item: ItemId }) {
  switch (item) {
    case 'wrench': return <Suspense fallback={null}><ScannedWrench /></Suspense>
    case 'fuse': return <Fuse />
    case 'cell': return <PowerCell />
    case 'carBattery': return <Battery />
    case 'antenna': return <Antenna />
    case 'rope': return <Rope />
    case 'badge': return <Badge />
    case 'flareGun': return <FlareGun />
    case 'manual': case 'map': return <Document map={item === 'map'} />
    default: return null
  }
}
