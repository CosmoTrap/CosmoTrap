import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { drawTexture } from '../textures'

// The Hermès, a return vehicle built to come home through the atmosphere: a pointed nose, a dark belly of
// heat tiles, swept fins and three rocket engines. Local axes: nose towards +z, its belly towards -y.

export const HERMES = { radius: 2.2, tail: -8.5, nose: 8 }
/** The three engines' nozzle exits, where the plumes start. */
export const ENGINES: [number, number][] = [[0, 0.75], [-0.85, -0.55], [0.85, -0.55]]

function heatTiles() {
  const t = drawTexture(256, 256, (c) => {
    c.fillStyle = '#16181b'
    c.fillRect(0, 0, 256, 256)
    for (let x = 0; x < 8; x++) for (let y = 0; y < 8; y++) {
      const v = 28 + ((x * 11 + y * 7) % 6) * 4
      c.fillStyle = `rgb(${v},${v},${v + 2})`
      c.fillRect(x * 32 + 1, y * 32 + 1, 30, 30)
    }
  })
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.repeat.set(6, 8)
  return t
}

function nameplate() {
  return drawTexture(512, 100, (c) => {
    c.clearRect(0, 0, 512, 100)
    c.fillStyle = '#23304a'
    c.font = '800 74px Inter, Arial, sans-serif'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillText('HERMÈS', 256, 54)
  })
}

/** A profile turned around the rocket's axis, from [radius, position along the axis] points. */
function turned(profile: [number, number][], phiStart = 0, phiLength = Math.PI * 2) {
  const g = new THREE.LatheGeometry(profile.map(([r, z]) => new THREE.Vector2(r, z)), 40, phiStart, phiLength)
  g.rotateX(Math.PI / 2)
  return g
}

function fin(angle: number, span: number) {
  const r = HERMES.radius - 0.05
  const s = new THREE.Shape()
  s.moveTo(HERMES.tail + 0.4, r)
  s.lineTo(HERMES.tail + 4.6, r)
  s.lineTo(HERMES.tail + 1.5, r + span)
  s.lineTo(HERMES.tail + 0.5, r + span)
  s.closePath()
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.14, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 1 })
  g.translate(0, 0, -0.07)
  // Shape drawn in (along, out): along goes to +z, out to +y, then turned around the axis.
  g.rotateY(-Math.PI / 2)
  g.rotateZ(angle)
  return g
}

export function HermesModel({ glow = 0 }: { glow?: number }) {
  const parts = useMemo(() => {
    const { radius: R, tail, nose } = HERMES
    const shoulder = 1.4
    const ogive: [number, number][] = []
    for (let i = 1; i <= 14; i++) {
      const k = i / 14
      ogive.push([Math.max(0.28, R * Math.sqrt(1 - k * k * 0.97) * (1 - 0.12 * k)), shoulder + (nose - shoulder) * Math.pow(k, 0.9)])
    }
    const body: [number, number][] = [[R * 0.86, tail], [R, tail + 0.7], [R, shoulder], ...ogive]
    const tiles = heatTiles(), label = nameplate()
    const std = (o: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial({ envMapIntensity: 0.4, ...o })
    const mats = {
      paint: std({ color: '#f3f2ee', roughness: 0.4, metalness: 0.05, emissive: '#c9cfd6', emissiveIntensity: 0.06, side: THREE.DoubleSide }),
      tile: std({ map: tiles, roughness: 0.82, side: THREE.DoubleSide }),
      accent: std({ color: '#e8602a', roughness: 0.45, metalness: 0.1, emissive: '#e8602a', emissiveIntensity: 0.1 }),
      nozzle: std({ color: '#4a4e53', roughness: 0.36, metalness: 0.85, side: THREE.DoubleSide }),
      glass: new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.9, 0.7) }),
      frame: std({ color: '#2f3338', roughness: 0.5, metalness: 0.65 }),
      label: std({ map: label, transparent: true, roughness: 0.5 }),
    }
    const bell: [number, number][] = Array.from({ length: 9 }, (_, i) => [0.72 - 0.42 * Math.pow(i / 8, 0.6), tail - 1.5 + 1.25 * (i / 8)])
    return {
      mats, tiles, label,
      // The belly, which meets the atmosphere first, wears black heat tiles; the back is white.
      top: turned(body, Math.PI / 2, Math.PI),
      belly: turned(body, -Math.PI / 2, Math.PI),
      bands: [tail + 0.75, -2.6, shoulder].map((at) => turned([[R + 0.015, at - 0.13], [R + 0.015, at + 0.13]])),
      skirt: turned([[R * 0.8, tail - 0.25], [R * 0.86, tail + 0.02]]),
      bell: turned(bell),
      fins: [fin(-Math.PI / 2, 2.2), fin(Math.PI / 2, 2.2), fin(0, 1.9)],
    }
  }, [])
  useEffect(() => () => {
    Object.values(parts.mats).forEach((m) => m.dispose())
    parts.tiles.dispose(); parts.label.dispose()
    ;[parts.top, parts.belly, parts.skirt, parts.bell, ...parts.bands, ...parts.fins].forEach((g) => g.dispose())
  }, [parts])
  const m = parts.mats
  return (
    <group name="hermes">
      <mesh geometry={parts.top} material={m.paint} castShadow />
      <mesh geometry={parts.belly} material={m.tile} castShadow />
      {parts.bands.map((g, i) => <mesh key={i} geometry={g} material={m.accent} />)}
      <mesh geometry={parts.skirt} material={m.nozzle} />
      {parts.fins.map((g, i) => <mesh key={i} geometry={g} material={m.paint} castShadow />)}
      {ENGINES.map(([x, y], i) => <mesh key={i} geometry={parts.bell} material={m.nozzle} position={[x, y, 0]} />)}
      {/* Crew windows on each flank, and the pilots' windows on the nose. */}
      {[1, -1].flatMap((side) => [-5, -3.9, 0.4, 1.3].map((z) => (
        <group key={`${side}:${z}`} position={[side * (HERMES.radius - 0.01), 0.5, z]} rotation={[0, side * Math.PI / 2, 0]}>
          <mesh material={m.frame} position={[0, 0, 0.02]}><ringGeometry args={[0.2, 0.28, 20]} /></mesh>
          <mesh material={m.glass} position={[0, 0, 0.015]}><circleGeometry args={[0.2, 18]} /></mesh>
        </group>
      )))}
      {[1, -1].map((side) => (
        <group key={side}>
          <mesh material={m.glass} position={[side * 0.7, 1.35, 3.6]} rotation={[-0.9, side * 0.42, 0]} scale={[1, 0.62, 1]}><circleGeometry args={[0.42, 20]} /></mesh>
          <mesh material={m.label} position={[side * (HERMES.radius + 0.02), 0.9, -1.4]} rotation={[0, side * Math.PI / 2, 0]}><planeGeometry args={[3.4, 0.68]} /></mesh>
        </group>
      ))}
      {/* Inner glow of the cabin windows at night, and the engines' hot throats. */}
      {glow > 0 && ENGINES.map(([x, y], i) => <mesh key={`g${i}`} position={[x, y, HERMES.tail - 1.45]} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.6, 20]} />
        <meshBasicMaterial color={new THREE.Color(1 * glow, 0.55 * glow, 0.22 * glow)} side={THREE.DoubleSide} />
      </mesh>)}
    </group>
  )
}
