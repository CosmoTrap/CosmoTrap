import { useFrame } from '@react-three/fiber'
import { CuboidCollider, RigidBody } from '@react-three/rapier'
import { Suspense, useEffect, useMemo, useRef, type ReactNode } from 'react'
import * as THREE from 'three'
import { audio } from '../../game/audio/audio'
import { fr } from '../../i18n/fr'
import { gridMap, placeOf, roomAt } from '../../game/maps'
import { LunarNote, LunarTerminal } from './LunarModels'
import { allEnts, canSeeInDark, entActive } from '../../game/logic'
import { ITEM_KIND } from '../../game/items'
import { live, useGame } from '../../game/state'
import type { Ent, ZoneId } from '../../game/types'
import { RoomCtx, useMats } from '../materials'
import { textTexture } from '../textures'
import { Box, BoxExact, Cyl, DeskScreen, DockHatch, Flashlight, Keyboard, Lathe, Screen } from './models'
import { useModel } from '../assets'
import { RealModel } from './RealModel'
import { ZONE4_ENT_MODELS } from '../zone4/Zone4Ents'
import { SolidProp } from './SolidProps'
import { PickupHighlight } from './PickupHighlight'
import { stationPowerDown } from '../roomPower'

// Objets interactifs + zones de détection invisibles (raycast).

export const hitboxes = new Set<THREE.Object3D>()

function Hitbox({ e }: { e: Ent }) {
  const ref = useRef<THREE.Mesh>(null)
  const size = e.hit ?? (e.item ? [0.6, 0.55, 0.6] : [0.7, 0.7, 0.5])
  useEffect(() => {
    const m = ref.current!
    m.userData.entId = e.id
    hitboxes.add(m)
    return () => {
      hitboxes.delete(m)
    }
  }, [e.id])
  const yOff = e.y === undefined ? size[1] / 2 : 0
  return (
    <mesh ref={ref} position={[0, yOff, e.wall ? size[2] / 2 : 0]} visible={false}>
      <boxGeometry args={size as [number, number, number]} />
      <meshBasicMaterial />
    </mesh>
  )
}



function Bracket() {
  const m = useMats()
  return (
    <group>
      <Box s={[0.42, 0.025, 0.26]} p={[0, -0.012, 0.13]} m={m.painted('#6f747a', 0.4, 0.5)} />
      <Box s={[0.4, 0.012, 0.012]} p={[0, 0.006, 0.255]} m={m.metal('#a9aeb2', 0.3)} />
      {[-0.17, 0.17].map((x) => <group key={x}>
        <Cyl a={[0.008, 0.008, 0.26]} p={[x, -0.1, 0.09]} r={[-0.8, 0, 0]} m={m.metal('#55595e')} seg={8} />
        <Box s={[0.03, 0.1, 0.01]} p={[x, -0.16, 0.006]} m={m.metal('#55595e')} />
      </group>)}
    </group>
  )
}

// ——— objets ramassables ———
function O2Bottle() {
  const m = useMats()
  const label = useMemo(() => new THREE.MeshStandardMaterial({ map: textTexture(['O₂', 'MED'], { w: 128, h: 128, fg: '#14361f', bg: '#f1eee6', size: 40 }), roughness: 0.5, side: THREE.DoubleSide }), [])
  useEffect(() => () => label.dispose(), [label])
  return (
    <group position={[0, 0, 0.12]}>
      <Lathe m={m.painted('#e8e6e0', 0.3, 0.4)} profile={[[0, 0.012], [0.07, 0.012], [0.085, 0.035], [0.085, 0.43]]} />
      <Lathe m={m.painted('#2f8a4a', 0.3, 0.4)} profile={[[0.085, 0.43], [0.08, 0.47], [0.06, 0.505], [0.03, 0.53], [0.022, 0.55], [0, 0.55]]} />
      <Cyl a={[0.09, 0.09, 0.014]} p={[0, 0.007, 0]} m={m.rubber()} seg={24} />
      {/* Valve, handwheel, gauge. */}
      <Cyl a={[0.018, 0.022, 0.05]} p={[0, 0.575, 0]} m={m.metal('#c7a24e', 0.25)} seg={14} />
      <Box s={[0.05, 0.03, 0.03]} p={[0, 0.6, 0]} m={m.metal('#c0c4c8', 0.25)} />
      <mesh position={[0, 0.635, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.plastic('#2f8a4a', 0.4)}><torusGeometry args={[0.03, 0.006, 8, 18]} /></mesh>
      <Cyl a={[0.005, 0.005, 0.06]} p={[0, 0.635, 0]} r={[0, 0, Math.PI / 2]} m={m.plastic('#2f8a4a', 0.4)} seg={6} />
      <Cyl a={[0.024, 0.024, 0.016]} p={[0, 0.6, 0.032]} r={[Math.PI / 2, 0, 0]} m={m.metal('#8d9196', 0.3)} seg={18} />
      <mesh position={[0, 0.6, 0.041]} material={m.plastic('#f1eee6', 0.25)}><circleGeometry args={[0.02, 18]} /></mesh>
      <mesh position={[0, 0.25, 0.0855]} material={label}><planeGeometry args={[0.1, 0.1]} /></mesh>
    </group>
  )
}

function Batteries() {
  const m = useMats()
  return (
    <group position={[0, 0, 0.13]}>
      <Box s={[0.2, 0.02, 0.13]} p={[0, 0.01, 0]} m={m.plastic('#20242b', 0.4)} />
      {[-0.066, -0.022, 0.022, 0.066].map((x) => (
        <group key={x} position={[x, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <Cyl a={[0.02, 0.02, 0.1]} m={m.metal('#cf7a2a', 0.3)} seg={16} />
          <Cyl a={[0.0205, 0.0205, 0.04]} p={[0, 0.032, 0]} m={m.metal('#1c1e22', 0.3)} seg={16} />
          <Cyl a={[0.007, 0.007, 0.006]} p={[0, -0.053, 0]} m={m.metal('#d5d8dc', 0.2)} seg={10} />
        </group>
      ))}
      <Box s={[0.21, 0.012, 0.02]} p={[0, 0.062, 0]} m={m.plastic('#20242b', 0.4)} />
    </group>
  )
}

/** Sealed water flask: clear body with visible water, ribbed cap, carrying loop. */
function WaterPouch() {
  const m = useMats()
  return (
    <group position={[0, 0, 0.13]}>
      <Lathe m={m.glass('#cfe9f7', 0.34)} profile={[[0, 0.002], [0.043, 0.002], [0.05, 0.012], [0.05, 0.145], [0.044, 0.168], [0.026, 0.19], [0.02, 0.2], [0.02, 0.215]]} />
      <Lathe m={m.plastic('#2f8fd8', 0.15)} profile={[[0, 0.008], [0.04, 0.008], [0.045, 0.016], [0.045, 0.13], [0, 0.13]]} />
      <Cyl a={[0.024, 0.024, 0.03]} p={[0, 0.226, 0]} m={m.plastic('#e7edf0', 0.35)} seg={20} />
      <mesh position={[0, 0.25, 0]} rotation={[0, 0, 0]} material={m.plastic('#e7edf0', 0.35)}><torusGeometry args={[0.016, 0.004, 6, 16]} /></mesh>
      {[0.05, 0.1].map((y) => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.plastic('#e7edf0', 0.4)}><torusGeometry args={[0.0505, 0.0015, 4, 28]} /></mesh>)}
    </group>
  )
}

/** The flashlight resting in its cradle on the shelf. */
function ShelfFlashlight() {
  return <group position={[-0.089, -0.01, 0.14]} rotation={[0, 0, -Math.PI / 2]}><Flashlight /></group>
}

function Fuse() {
  const m = useMats()
  const brass = m.metal('#c9a14a', 0.28)
  return (
    <group position={[0, 0.032, 0.14]} rotation={[0, 0, Math.PI / 2]}>
      <Lathe m={m.plastic('#e8e2d0', 0.45)} profile={[[0.02, -0.052], [0.024, -0.045], [0.024, 0.045], [0.02, 0.052]]} seg={18} />
      {[-1, 1].map((k) => <group key={k}>
        <Cyl a={[0.028, 0.028, 0.024]} p={[0, k * 0.06, 0]} m={brass} seg={18} />
        <Cyl a={[0.012, 0.012, 0.016]} p={[0, k * 0.08, 0]} m={brass} seg={12} />
      </group>)}
      <mesh position={[0, 0, 0.0245]} material={m.glass('#d94a2a', 0.8)}><circleGeometry args={[0.008, 12]} /></mesh>
    </group>
  )
}

function Wrench() {
  return <RealModel id="adjustable_wrench" fit="raw" scale={1} p={[0, 0.012, 0.14]} shadows={false} />
}

function Cell() {
  const m = useMats()
  const ref = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.emissiveIntensity = 3 + Math.sin(clock.elapsedTime * 3) * 1.5
  })
  return (
    <group position={[0, 0, 0.2]}>
      <Box s={[0.5, 0.5, 0.4]} p={[0, -0.25, 0]} m={m.painted('#4a5a40', 0.6, 0.2)} />
      <Cyl a={[0.08, 0.08, 0.32]} p={[0, 0.16, 0]} m={m.metal('#5d6166', 0.35)} />
      <mesh position={[0, 0.16, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 0.26, 16]} />
        <meshStandardMaterial ref={ref} color="#000" emissive="#3ad7ff" emissiveIntensity={3} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <Box key={i} s={[0.015, 0.3, 0.015]} p={[Math.cos(i * 1.57) * 0.085, 0.16, Math.sin(i * 1.57) * 0.085]} m={m.metal('#2d3034')} />
      ))}
    </group>
  )
}

function MultiTool() {
  return <RealModel id="pliers" height={0.022} p={[0, 0.002, 0.14]} r={0.4} shadows={false} />
}

function Purifier() {
  const m = useMats()
  return (
    <group position={[0, 0, 0.14]}>
      <Lathe m={m.plastic('#1d4e89', 0.35)} profile={[[0, 0.002], [0.05, 0.002], [0.056, 0.012], [0.056, 0.14], [0.042, 0.165], [0.03, 0.17]]} />
      {[0.04, 0.07, 0.1].map((y) => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} material={m.plastic('#2c6bb3', 0.4)}><torusGeometry args={[0.0565, 0.003, 6, 28]} /></mesh>)}
      <Lathe m={m.plastic('#d8dce2', 0.3)} profile={[[0.034, 0.17], [0.036, 0.2], [0.03, 0.208], [0, 0.208]]} seg={20} />
      <Cyl a={[0.009, 0.009, 0.04]} p={[0.054, 0.15, 0]} r={[0, 0, Math.PI / 2]} m={m.plastic('#7ec8ff', 0.2)} seg={10} />
    </group>
  )
}

function TapeRoll() {
  return <RealModel id="medical_tape" height={0.09} p={[0, 0, 0.14]} shadows={false} />
}

function CompassItem() {
  return <RealModel id="seadogs_compass" height={0.05} p={[0, 0, 0.14]} shadows={false} />
}

function WhistleItem() {
  const m = useMats()
  const body = m.plastic('#ff6b35', 0.35)
  return (
    <group position={[0, 0.024, 0.14]} rotation={[0, 0.5, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} material={body} castShadow><cylinderGeometry args={[0.024, 0.024, 0.026, 22]} /></mesh>
      <Box s={[0.07, 0.03, 0.026]} p={[0.042, 0.009, 0]} m={body} />
      <Box s={[0.016, 0.006, 0.02]} p={[0.022, 0.026, 0]} m={m.rubber()} />
      <mesh position={[-0.026, 0.02, 0]} material={m.metal('#c0c4c8', 0.25)}><torusGeometry args={[0.009, 0.0022, 6, 14]} /></mesh>
    </group>
  )
}

function MirrorItem() {
  const m = useMats()
  return (
    <group position={[0, 0.002, 0.14]} rotation={[-1.2, 0, 0]}>
      <group position={[0, 0.09, 0]}>
        <mesh material={m.plastic('#2a2c30', 0.4)} castShadow><torusGeometry args={[0.062, 0.006, 8, 32]} /></mesh>
        <mesh material={m.metal('#e8eef2', 0.05)}><circleGeometry args={[0.062, 32]} /></mesh>
        <Cyl a={[0.008, 0.009, 0.1]} p={[0, -0.11, 0]} m={m.plastic('#2a2c30', 0.4)} seg={10} />
      </group>
    </group>
  )
}

function RationPack() {
  return <RealModel id="long_life_food" height={0.12} p={[0, 0, 0.02]} r={0.2} shadows={false} />
}

/** Survival blanket, neatly folded and strapped. */
function BlanketPack() {
  const m = useMats()
  const cloth = m.fabric('#c9843a')
  return (
    <group>
      {[0.025, 0.07, 0.115].map((y, i) => <Box key={y} s={[0.46 - i * 0.008, 0.052, 0.3 - i * 0.006]} p={[0, y, 0]} m={cloth} />)}
      <Box s={[0.44, 0.012, 0.28]} p={[0, 0.146, 0]} m={m.metal('#e9d98f', 0.18)} />
      {[-0.13, 0.13].map((x) => <Box key={x} s={[0.032, 0.16, 0.31]} p={[x, 0.078, 0]} m={m.fabric('#3b2c1f')} />)}
    </group>
  )
}

/** Real first-aid case, hung on the wall with its lid facing the room. */
function Medkit() {
  // Lid facing the room, handle on top: it hangs from the wall the right way up.
  return <group position={[0, 0.14, 0.015]} rotation={[Math.PI / 2, Math.PI, 0]}><RealModel id="medical_box" height={0.1} shadows={false} /></group>
}

// ——— éléments d'énigme ———
/** Opening angle of the emergency locker's door, in radians. */
const DOOR_OPEN = 1.5

function Locker() {
  const m = useMats()
  const open = useGame((s) => s.flags.lockerOpen)
  const door = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    // The door swings out into the room; about a right angle keeps it clear of the corner wall.
    if (door.current) door.current.rotation.y = THREE.MathUtils.damp(door.current.rotation.y, open ? DOOR_OPEN : 0, 3, dt)
  })
  const label = useMemo(() => new THREE.MeshStandardMaterial({ map: textTexture(['SECOURS', 'Équipage Selene-7'], { w: 256, h: 96, bg: '#b8231c', fg: '#ffffff', size: 26, align: 'center', pad: 14 }) }), [])
  const shell = m.painted('#5e6a74', 0.45, 0.6)
  const inside = m.painted('#343a40', 0.55, 0.4)
  const steel = m.metal('#8d9196', 0.35)
  return (
    <group>
      {/* A real hollow cabinet: back, sides, top and floor. */}
      <Box s={[0.8, 2, 0.02]} p={[0, 1, 0.012]} m={inside} />
      {[-0.39, 0.39].map((x) => <Box key={x} s={[0.022, 2, 0.55]} p={[x, 1, 0.28]} m={shell} />)}
      {[0.02, 1.99].map((y) => <Box key={y} s={[0.8, 0.03, 0.55]} p={[0, y, 0.28]} m={shell} />)}
      <mesh position={[0, 1.955, 0.42]} material={m.glow('#e8f6ff', open ? 1.6 : 0.05)}><boxGeometry args={[0.56, 0.012, 0.03]} /></mesh>

      {/* Contents: the badge was taken from the top shelf, the rest of the kit remains. */}
      {[1.5, 0.62].map((y) => <Box key={y} s={[0.75, 0.02, 0.5]} p={[0, y, 0.28]} m={steel} />)}
      <Box s={[0.14, 0.012, 0.09]} p={[0, 1.517, 0.34]} m={m.plastic('#1b1d20', 0.4)} />
      <RealModel id="signal_flashlight" height={0.14} shadows={false} p={[-0.2, 1.51, 0.26]} />
      <RealModel id="medical_tape" height={0.07} shadows={false} p={[0.22, 1.51, 0.3]} />
      <Cyl a={[0.008, 0.008, 0.74]} p={[0, 1.4, 0.28]} r={[0, 0, Math.PI / 2]} m={steel} seg={10} />
      {/* Flight jacket on its hanger. */}
      <mesh position={[0, 1.35, 0.28]} rotation={[0, 0, 0]} material={steel}><torusGeometry args={[0.16, 0.005, 6, 20, Math.PI]} /></mesh>
      <group position={[0, 1.02, 0.28]}>
        <Box s={[0.44, 0.62, 0.1]} m={m.fabric('#3e5566')} />
        {[-1, 1].map((k) => <Box key={k} s={[0.1, 0.52, 0.09]} p={[k * 0.26, 0.02, 0]} m={m.fabric('#34495a')} />)}
        <Box s={[0.012, 0.56, 0.006]} p={[0, -0.01, 0.054]} m={steel} />
        <Box s={[0.08, 0.04, 0.006]} p={[-0.11, 0.17, 0.054]} m={m.fabric('#d9673a')} />
      </group>
      <RealModel id="medical_box" height={0.1} shadows={false} p={[-0.14, 0.04, 0.28]} />
      <RealModel id="plastic_thermos" height={0.27} shadows={false} p={[0.2, 0.04, 0.3]} />

      <group ref={door} position={[0.39, 0, 0.56]}>
        <Box s={[0.78, 1.95, 0.03]} p={[-0.39, 1.0, 0]} m={m.painted('#6a7884', 0.45, 0.6)} />
        <mesh position={[-0.39, 1.65, 0.017]} material={label}>
          <planeGeometry args={[0.4, 0.15]} />
        </mesh>
        <Box s={[0.12, 0.18, 0.03]} p={[-0.18, 1.2, 0.025]} m={m.plastic('#1b1d20', 0.3)} />
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[-0.21 + (i % 2) * 0.06, 1.24 - Math.floor(i / 2) * 0.05, 0.042]} material={m.glow(open ? '#38ff7a' : '#ffb020', 1.5)}>
            <planeGeometry args={[0.04, 0.03]} />
          </mesh>
        ))}
        {[0.3, 0.5, 0.7].map((y) => (
          <Box key={y} s={[0.5, 0.012, 0.005]} p={[-0.39, y, 0.017]} m={m.metal('#3b3e42')} />
        ))}
        {[0.35, 1.0, 1.65].map((y) => <Cyl key={y} a={[0.012, 0.012, 0.07]} p={[0, y, 0]} m={steel} seg={10} />)}
      </group>
      {open && <RigidBody type="fixed" colliders={false}>
        <CuboidCollider position={[0.34, 1, 0.95]} args={[0.05, 1, 0.4]} />
      </RigidBody>}
    </group>
  )
}

const POSTITS: Record<string, string[]> = {
  postit: ['Jamais au', 'hasard. Une', 'ligne après', 'l’autre. — N.'],
  postitO2: ['Bouteille O₂', '= +55 %', 'Sous 15 % :', 'flou, visions'],
}

function Postit({ lines }: { lines: string[] }) {
  const mat = useMemo(() => {
    const t = textTexture(lines, { w: 128, h: 128, bg: '#f6e27a', fg: '#1d2a6b', size: 14, font: 'italic 600 14px Inter, sans-serif', pad: 8 })
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.8 })
  }, [lines])
  return (
    <mesh position={[0, 0, 0.02]} rotation={[0, 0, 0.1]} material={mat}>
      <planeGeometry args={[0.12, 0.12]} />
    </mesh>
  )
}

function Board() {
  const m = useMats()
  const mat = useMemo(() => {
    const t = textTexture(['RAPPEL ÉQUIPAGE', '', 'Code du casier', 'de secours changé :', "= année de mise", 'en service de la', 'station (plaque', 'de la réserve)', '', '                — Cdte'], {
      w: 512,
      h: 340,
      bg: '#f1efe8',
      fg: '#203b8a',
      size: 26,
      font: '600 26px "Inter", sans-serif',
      pad: 22,
    })
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.3 })
  }, [])
  return (
    <group>
      <Box s={[1.5, 1.0, 0.04]} p={[0, 0, 0.02]} m={m.metal('#9aa0a6', 0.3)} />
      <mesh position={[0, 0, 0.042]} material={mat}>
        <planeGeometry args={[1.42, 0.92]} />
      </mesh>
      <Box s={[0.3, 0.03, 0.06]} p={[0.4, -0.52, 0.04]} m={m.metal('#9aa0a6', 0.3)} />
      <Cyl a={[0.008, 0.008, 0.12]} p={[0.35, -0.49, 0.06]} r={[0, 0, Math.PI / 2]} m={m.plastic('#c5302a')} seg={8} />
    </group>
  )
}

function Plate() {
  const m = useMats()
  const ref = useRef<THREE.Mesh>(null)
  const { mat, hidden, revealed } = useMemo(() => {
    const make = (date: string) => textTexture(['STATION SELENE-7', 'Agence spatiale européenne', '', 'MISE EN SERVICE', date], { w: 512, h: 300, bg: '#9a7a3a', fg: '#3b2a10', size: 34, align: 'center', font: '700 34px "Rajdhani", sans-serif', pad: 30 })
    const hidden = make('2041'), revealed = make('2041')
    hidden.name = 'plate-date-unreadable'; revealed.name = 'plate-date-readable'
    const mat = new THREE.MeshStandardMaterial({ map: hidden, metalness: 0.65, roughness: 0.55, color: '#e8c98a', envMapIntensity: 0 })
    // Absorb ambient and neighbouring lights without changing the printed text.
    mat.onBeforeCompile = shader => {
      shader.uniforms.uPlateLight = { value: 0 }
      mat.userData.plateLight = shader.uniforms.uPlateLight
      shader.fragmentShader = 'uniform float uPlateLight;\n' + shader.fragmentShader
      shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight *= mix(0.00015, 1.0, uPlateLight);\n#include <opaque_fragment>')
    }
    mat.customProgramCacheKey = () => 'torch-readable-plate-v1'
    return { mat, hidden, revealed }
  }, [])
  const vectors = useMemo(() => ({ target: new THREE.Vector3(), direction: new THREE.Vector3() }), [])
  useEffect(() => () => { mat.dispose(); hidden.dispose(); revealed.dispose() }, [mat, hidden, revealed])
  useFrame(({ camera }) => {
    if (!ref.current) return
    ref.current.getWorldPosition(vectors.target).sub(camera.position)
    const distance = vectors.target.length()
    camera.getWorldDirection(vectors.direction)
    // Ambient light and alarm beacons never reveal the date. It must be in the
    // lit torch cone; keeping both textures ready avoids shader recompilation.
    const readable = canSeeInDark() && distance < 6 && vectors.target.normalize().dot(vectors.direction) > Math.cos(0.45)
    mat.map = readable ? revealed : hidden
    if (mat.userData.plateLight) mat.userData.plateLight.value = readable ? 1 : 0
    ref.current.userData.dateReadable = readable
  })
  return (
    <group>
      <mesh ref={ref} name="station-date-plate" position={[0, 0, 0.012]} material={mat}>
        <boxGeometry args={[0.5, 0.3, 0.012]} />
      </mesh>
      {[-1, 1].map((sx) =>
        [-1, 1].map((sy) => <Cyl key={`${sx}${sy}`} a={[0.008, 0.008, 0.01]} p={[sx * 0.22, sy * 0.12, 0.02]} r={[Math.PI / 2, 0, 0]} m={m.metal('#6b5426')} seg={8} />),
      )}
    </group>
  )
}

function Dispenser() {
  const m = useMats()
  return (
    <group>
      <Box s={[0.45, 1.05, 0.4]} p={[0, 0.525, 0.22]} m={m.painted('#d9dcdf', 0.35, 0.2)} />
      <Cyl a={[0.15, 0.15, 0.38]} p={[0, 1.25, 0.22]} m={m.glass('#7fc4ff', 0.45)} seg={24} />
      <Cyl a={[0.14, 0.14, 0.3]} p={[0, 1.22, 0.22]} m={m.plastic('#3a8fe0', 0.1)} seg={20} />
      <Box s={[0.3, 0.2, 0.08]} p={[0, 0.85, 0.44]} m={m.plastic('#2a2d31', 0.4)} />
      <Box s={[0.04, 0.06, 0.06]} p={[-0.06, 0.78, 0.47]} m={m.plastic('#2a7fd0')} />
      <Box s={[0.04, 0.06, 0.06]} p={[0.06, 0.78, 0.47]} m={m.plastic('#c5302a')} />
      <Box s={[0.3, 0.02, 0.15]} p={[0, 0.6, 0.45]} m={m.metal('#8d9196')} />
    </group>
  )
}

function ValvePanel() {
  const m = useMats()
  const valves = useGame((s) => s.valves)
  return (
    <group>
      <Box s={[1.1, 1.1, 0.08]} p={[0, 0, 0.04]} m={m.painted('#3a3d42', 0.5, 0.6)} />
      {valves.map((on, i) => {
        const x = ((i % 3) - 1) * 0.32
        const y = (1 - Math.floor(i / 3)) * 0.32
        return (
          <group key={i} position={[x, y, 0.1]}>
            <mesh material={m.painted(on ? '#2f8a4a' : '#b8231c', 0.4, 0.4)} castShadow>
              <torusGeometry args={[0.1, 0.018, 8, 24]} />
            </mesh>
            {[0, 1].map((k) => (
              <Box key={k} s={[0.2, 0.018, 0.018]} r={[0, 0, k * 1.57 + (on ? 0.785 : 0)]} m={m.metal('#8d9196')} />
            ))}
            <mesh position={[0.13, 0.12, -0.02]} material={m.glow(on ? '#38ff7a' : '#ff2a1a', 3)}>
              <circleGeometry args={[0.015, 10]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

function Datapad({ lines }: { lines: string[] }) {
  const m = useMats()
  const mat = useMemo(() => {
    const t = textTexture(lines, { w: 256, h: 180, size: 16, fg: '#9fe8ff', bg: '#071820', scan: true, pad: 12 })
    return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#fff', emissiveIntensity: 1.2 })
  }, [lines.join('|')])
  return (
    <group position={[0, 0.01, 0.25]} rotation={[-Math.PI / 2 + 0.25, 0, 0.1]}>
      <Box s={[0.26, 0.18, 0.015]} m={m.plastic('#1b1d20', 0.3)} />
      <mesh position={[0, 0, 0.0085]} material={mat}>
        <planeGeometry args={[0.235, 0.155]} />
      </mesh>
    </group>
  )
}

function Tag() {
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ map: textTexture(['Clé à molette', 'près des bacs', 'NE PAS EMPORTER'], { w: 256, h: 128, bg: '#f2efe6', fg: '#2f6b2c', size: 20, pad: 12 }) }), [])
  return (
    <mesh position={[0, 0, 0.02]} material={mat}>
      <planeGeometry args={[0.26, 0.13]} />
    </mesh>
  )
}

function SteamValve() {
  const m = useMats()
  const fixed = useGame((s) => s.flags.steamFixed)
  const wheel = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (wheel.current) wheel.current.rotation.z = THREE.MathUtils.damp(wheel.current.rotation.z, fixed ? -Math.PI * 3 : 0, 2, dt)
  })
  return (
    <group>
      {/* Overlaps the main on both sides, so that the pipe reads as one piece through the valve. */}
      <Cyl a={[0.09, 0.09, 2.14]} p={[0, 0, 0.18]} r={[0, 0, Math.PI / 2]} m={m.painted('#9b5a2a', 0.5, 0.6)} />
      <Box s={[0.22, 0.22, 0.22]} p={[0, 0, 0.18]} m={m.painted('#5a5f66', 0.4, 0.8)} />
      <group ref={wheel} position={[0, 0, 0.36]}>
        <mesh material={m.painted('#c5302a', 0.4, 0.4)} castShadow>
          <torusGeometry args={[0.14, 0.02, 8, 24]} />
        </mesh>
        {[0, 1, 2].map((k) => (
          <Box key={k} s={[0.28, 0.02, 0.02]} r={[0, 0, (k * Math.PI) / 3]} m={m.painted('#c5302a', 0.4, 0.4)} />
        ))}
      </group>
    </group>
  )
}

/** fuite de gaz : particules + son spatial ; on peut la traverser, au prix d'une brûlure (voir tick) */
function Steam({ e }: { e: Ent }) {
  const fixed = useGame((s) => s.flags.steamFixed)
  const light = useRef<THREE.PointLight>(null)
  const pts = useRef<THREE.Points>(null)
  const N = 220
  const { geo, mat, seeds } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3))
    const c = document.createElement('canvas')
    c.width = c.height = 64
    const ctx = c.getContext('2d')!
    const gr = ctx.createRadialGradient(32, 32, 0, 32, 32, 32)
    gr.addColorStop(0, 'rgba(255,255,255,0.55)')
    gr.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = gr
    ctx.fillRect(0, 0, 64, 64)
    const mat = new THREE.PointsMaterial({ size: 0.9, map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false, opacity: 0.55, color: '#dfe6ea' })
    return { geo: g, mat, seeds: Array.from({ length: N }, () => Math.random()) }
  }, [])
  const fade = useRef(1)
  useFrame(({ clock }, dt) => {
    fade.current = THREE.MathUtils.damp(fade.current, fixed ? 0 : 1, 1.2, dt)
    if (light.current) light.current.intensity = fixed || stationPowerDown() ? 0 : 1.5
    mat.opacity = 0.55 * fade.current
    const p = geo.attributes.position as THREE.BufferAttribute
    const t = clock.elapsedTime
    for (let i = 0; i < N; i++) {
      const life = (t * 0.6 + seeds[i]) % 1
      const a = seeds[i] * 40
      // A jet out of the tear in the pipe, spreading into the corridor and rising.
      p.setXYZ(i, -0.1 + Math.cos(a) * life * 0.75 + Math.sin(t + i) * 0.05, 1.25 + life * life * 1.25 + Math.sin(a * 3) * 0.12 * life, -0.72 + life * 1.55 + Math.sin(a) * life * 0.25)
    }
    p.needsUpdate = true
  })
  useEffect(() => {
    if (fixed) return
    const [x, , z] = placeOf(e).p
    const timer = setTimeout(() => audio.loop('steam', 'steam', { pos: [x, 1.8, z], vol: 0.9 }), 400)
    return () => {
      clearTimeout(timer)
      audio.stopLoop('steam')
    }
  }, [fixed, e])
  return (
    <group>
      <points ref={pts} geometry={geo} material={mat} frustumCulled={false} />
      {/* No collider: the gas can be crossed, at the price of a burn (see tick). */}
      <pointLight ref={light} name="steam-service-light" color="#ffd2a8" intensity={0} distance={4} position={[0, 1.6, 0]} />
    </group>
  )
}

function Breaker() {
  const m = useMats()
  const power = useGame((s) => s.flags.power)
  const lever = useRef<THREE.Group>(null)
  useFrame((_, dt) => {
    if (lever.current) lever.current.rotation.x = THREE.MathUtils.damp(lever.current.rotation.x, power ? -0.6 : 0.6, 4, dt)
  })
  return (
    <group>
      {/* Square-edged: rounded, its back would leave a gap along the wall. */}
      <BoxExact s={[1.3, 1.5, 0.3]} p={[0, 0, 0.15]} m={m.painted('#5c646c', 0.5, 0.5)} />
      <Box s={[1.2, 1.4, 0.02]} p={[0, 0, 0.31]} m={m.painted('#2e3237', 0.5, 0.5)} />
      <group ref={lever} position={[0.4, 0, 0.34]}>
        <Box s={[0.05, 0.4, 0.05]} p={[0, 0.2, 0]} m={m.metal('#8d9196')} />
        <Box s={[0.14, 0.06, 0.06]} p={[0, 0.4, 0]} m={m.plastic('#c5302a')} />
      </group>
      <Cyl a={[0.06, 0.06, 0.12]} p={[-0.3, 0.3, 0.33]} r={[0, 0, Math.PI / 2]} m={power ? m.plastic('#e8e2d0') : m.plastic('#1b1b1b')} seg={14} />
      {['LUM', 'O₂', 'TERM', 'SAS'].map((_, i) => (
        <mesh key={i} position={[-0.45 + i * 0.25, -0.45, 0.33]} material={m.glow(power ? '#38ff7a' : '#300', 2)}>
          <circleGeometry args={[0.025, 10]} />
        </mesh>
      ))}
      <mesh position={[0, 0.6, 0.322]} material={useMemo(() => new THREE.MeshStandardMaterial({ map: textTexture(['DISJONCTEUR PRINCIPAL', 'Réseau de secours 3 U'], { w: 512, h: 96, bg: '#e0a92a', fg: '#14161a', size: 26, pad: 14 }) }), [])}>
        <planeGeometry args={[0.9, 0.17]} />
      </mesh>
    </group>
  )
}

function Terminal() {
  const m = useMats()
  const f = useGame((s) => s.flags)
  const on = f.power && f.pw_terminal
  const mat = useMemo(() => {
    const lines = !on
      ? ['', '', '   AUCUN SIGNAL']
      : f.readTerminal
        ? ['HERMÈS · PRÉ-VOL', '> séquence chargée', '> sas : ' + (f.pw_sas ? 'OK' : 'HORS TENSION'), '> bon vol.']
        : ['> VERROUILLÉ', 'c ← [R, J, B, V]', 'pour i de 0 à 3 :', ' j ← (3i+2) mod 4', ' émettre c[j]']
    const t = textTexture(lines, { w: 512, h: 320, fg: on ? '#7fe3ff' : '#331111', bg: on ? '#061820' : '#020202', scan: true, glow: on, size: 32 })
    return new THREE.MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#fff', emissiveIntensity: on ? 1.6 : 0 })
  }, [on, f.pw_sas, f.readTerminal])
  return (
    <group>
      <Box s={[1.4, 0.9, 0.6]} p={[0, 0.45, 0.3]} m={m.painted('#3c4046', 0.5, 0.6)} />
      <Box s={[1.4, 0.05, 0.65]} p={[0, 0.92, 0.32]} m={m.plastic('#1e2023', 0.35)} />
      <Box s={[1.0, 0.65, 0.06]} p={[0, 1.45, 0.12]} r={[-0.1, 0, 0]} m={m.plastic('#1b1d20', 0.3)} />
      <mesh position={[0, 1.45, 0.155]} rotation={[-0.1, 0, 0]} material={mat}>
        <planeGeometry args={[0.92, 0.57]} />
      </mesh>
      <Box s={[0.6, 0.02, 0.2]} p={[0, 0.955, 0.4]} m={m.plastic('#2a2c30', 0.5)} />
    </group>
  )
}

function PilotConsole() {
  const m = useMats()
  const engine = useGame((s) => s.flags.engine)
  const cols = ['#2f6bff', '#ffd23a', '#ff3a2a', '#2fd060']
  return (
    <group>
      <Box s={[5.6, 0.95, 0.9]} p={[0, 0.475, 0.45]} m={m.painted('#2c2f33', 0.5, 0.6)} />
      {/* Sloped desk: a monitor on its stand at the back of each pilot's place, a keyboard in front of it. */}
      <group position={[0, 1.0, 0.5]} rotation={[0.3, 0, 0]}>
        <Box s={[5.6, 0.08, 1.0]} m={m.plastic('#15171a', 0.3)} />
        <DeskScreen w={0.9} h={0.5} p={[-1.6, 0.04, -0.3]} lines={['TRAJECTOIRE', 'TLI → TERRE', 'T-0 : en attente']} fg="#ffb38a" />
        <DeskScreen w={0.9} h={0.5} p={[1.6, 0.04, -0.3]} lines={['MOTEUR', engine ? 'CELLULE OK' : 'SANS ÉNERGIE', engine ? 'PRÊT' : '—']} fg={engine ? '#7fffb0' : '#ff7a6b'} />
        {[-1.6, 1.6].map((x) => <Keyboard key={x} p={[x, 0.04, 0.2]} w={0.5} />)}
      </group>
      {cols.map((c, i) => (
        <group key={i} position={[-0.45 + i * 0.3, 1.07, 0.62]} rotation={[0.3, 0, 0]}>
          <Cyl a={[0.08, 0.09, 0.05]} m={m.metal('#2a2c30')} />
          <Cyl a={[0.065, 0.065, 0.04]} p={[0, 0.03, 0]} m={m.glow(c, engine ? 2.5 : 0.4)} />
        </group>
      ))}
      <Box s={[0.08, 0.25, 0.08]} p={[0.9, 1.18, 0.75]} r={[0.3, 0, 0]} m={m.plastic('#1b1d20')} />
    </group>
  )
}

/** The engine's power socket: empty and red until the cell is in, then the cell sits locked in it, glowing. */
function EngineSlot() {
  const m = useMats()
  const engine = useGame((s) => s.flags.engine)
  const steel = m.metal('#9aa3a8', 0.3)
  const label = useMemo(() => new THREE.MeshStandardMaterial({ map: textTexture([engine ? 'CELLULE ENGAGÉE' : 'INSÉRER LA CELLULE'], { w: 512, h: 80, bg: engine ? '#123d2a' : '#3d1512', fg: engine ? '#7fffb0' : '#ff9a8a', size: 34, pad: 14 }), roughness: 0.5 }), [engine])
  useEffect(() => () => { label.map?.dispose(); label.dispose() }, [label])
  return (
    <group>
      <Box s={[1.0, 1.2, 0.35]} p={[0, 0, 0.17]} m={m.painted('#3c4046', 0.5, 0.7)} />
      {/* Socket: a collar round a dark well. */}
      <Cyl a={[0.17, 0.17, 0.06]} p={[0, 0.05, 0.37]} r={[Math.PI / 2, 0, 0]} m={steel} seg={28} />
      <Cyl a={[0.12, 0.12, 0.07]} p={[0, 0.05, 0.38]} r={[Math.PI / 2, 0, 0]} m={m.metal('#111316', 0.6)} seg={24} />
      {engine && <group position={[0, 0.05, 0.4]}>
        {/* The cell, pushed home: its end cap, a lit band and the locking handle turned across. */}
        <Cyl a={[0.1, 0.1, 0.14]} p={[0, 0, 0.05]} r={[Math.PI / 2, 0, 0]} m={m.painted('#d9dde0', 0.35, 0.4)} seg={20} />
        <Cyl a={[0.103, 0.103, 0.035]} p={[0, 0, 0.06]} r={[Math.PI / 2, 0, 0]} m={m.glow('#3ad7ff', 4)} seg={20} />
        <Box s={[0.26, 0.04, 0.04]} p={[0, 0, 0.14]} r={[0, 0, Math.PI / 4]} m={m.plastic('#ffb020', 0.4)} />
      </group>}
      {/* Charge bar: empty and red, then full and green. */}
      {[0, 1, 2, 3, 4, 5].map((i) => <mesh key={i} position={[-0.25 + i * 0.1, -0.3, 0.352]} material={m.glow(engine ? '#38ff7a' : i === 0 ? '#ff2a1a' : '#2a1110', engine ? 2.4 : i === 0 ? 3 : 0.2)}>
        <planeGeometry args={[0.08, 0.06]} />
      </mesh>)}
      <mesh position={[0, 0.45, 0.352]} material={label}><planeGeometry args={[0.8, 0.125]} /></mesh>
    </group>
  )
}

/** The real suit through one material; drawing depth first leaves only its front surfaces visible. */
function HoloLayer({ material, order }: { material: THREE.Material; order: number }) {
  const suit = useModel('z2_spacesuit', { shadows: false })
  const fit = useMemo(() => {
    const box = new THREE.Box3().setFromObject(suit)
    const center = box.getCenter(new THREE.Vector3())
    const k = 1.78 / box.getSize(new THREE.Vector3()).y
    return { k, offset: [-center.x, -box.min.y, -center.z] as [number, number, number] }
  }, [suit])
  useEffect(() => {
    suit.traverse((o) => {
      o.renderOrder = order
      if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = material
    })
  }, [suit, material, order])
  return <group scale={fit.k}><primitive object={suit} position={fit.offset} /></group>
}

/** hologramme de la commandante */
function Hologram() {
  const cine = useGame((s) => s.cine)
  const depthOnly = useMemo(() => new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true }), [])
  const cone = useMemo(() => new THREE.ShaderMaterial({
    // Strongest at the projector, gone before the top: a beam of light, without a visible rim.
    vertexShader: 'varying float vH; void main(){ vH = uv.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'varying float vH; void main(){ float a = pow(1.-vH, 2.2)*.16; gl_FragColor = vec4(vec3(.35,.8,1.)*a, 1.); }',
    transparent: true, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false,
  }), [])
  useEffect(() => () => { depthOnly.dispose(); cone.dispose() }, [depthOnly, cone])
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uA: { value: 0.35 } },
        vertexShader: `varying vec3 vN; varying vec3 vV; varying vec3 vW;
          void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); vW=(modelMatrix*vec4(position,1.)).xyz; gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `uniform float uTime; uniform float uA; varying vec3 vN; varying vec3 vV; varying vec3 vW;
          void main(){ float f = pow(1.-abs(dot(vN,vV)),2.); float scan = .62+.38*sin(vW.y*120.-uTime*6.);
            float flick = .85+.15*sin(uTime*37.)*sin(uTime*13.);
            float band = smoothstep(.0,.02,fract(vW.y*.8-uTime*.35))*.4+.6;
            vec3 c = vec3(.35,.8,1.)*(f*1.6+.3)*scan*flick*band;
            gl_FragColor = vec4(c*uA*1.6, 1.); }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )
  const g = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime
    mat.uniforms.uA.value = THREE.MathUtils.lerp(mat.uniforms.uA.value, cine === 'briefing' ? 1 : 0.22, 0.05)
    if (g.current) g.current.rotation.y = -Math.PI / 2 + Math.sin(clock.elapsedTime * 0.3) * 0.2
  })
  return (
    <group ref={g} position={[0, 0.1, 0]} scale={0.95}>
      <Suspense fallback={null}>
        <HoloLayer material={depthOnly} order={1} />
        <HoloLayer material={mat} order={2} />
      </Suspense>
      <mesh position={[0, 0.9, 0]} material={cone}><cylinderGeometry args={[0.6, 0.22, 1.95, 40, 1, true]} /></mesh>
      <pointLight color="#59c8ff" intensity={cine === 'briefing' ? 3 : 0.8} distance={4} position={[0, 1.2, 0.3]} />
    </group>
  )
}

function DoorLock() {
  return null
}

const DATAPADS: Record<string, string[]> = {
  labNote: ['JOURNAL LABO', '3 unités. Sas', 'avant le terminal', 'sinon disjoncteur'],
  cargoNote: ['SOUTE · INVENTAIRE', 'Cellule énergie', 'caisse 3, au fond'],
}

export const ENT_MODELS: Record<string, (e: Ent) => ReactNode> = {
  lunarTerminal: e => <LunarTerminal id={e.id} />,
  lunarNote: e => <LunarNote id={e.id} />,
  o2: () => <O2Bottle />,
  battery: () => <Batteries />,
  water: () => <WaterPouch />,
  lamp: () => <ShelfFlashlight />,
  fuse: () => <Fuse />,
  wrench: () => <Wrench />,
  cell: () => <Cell />,
  ration: () => <RationPack />,
  medkit: () => <Medkit />,
  blanket: () => <BlanketPack />,
  multitool: () => <MultiTool />,
  purifier: () => <Purifier />,
  tape: () => <TapeRoll />,
  compass: () => <CompassItem />,
  whistle: () => <WhistleItem />,
  mirror: () => <MirrorItem />,
  holo: () => <Hologram />,
  locker: () => <Locker />,
  postit: (e) => <Postit lines={POSTITS[e.id] ?? POSTITS.postit} />,
  board: () => <Board />,
  plate: () => <Plate />,
  dispenser: () => <Dispenser />,
  valvePanel: () => <ValvePanel />,
  datapad: (e) => <Datapad lines={DATAPADS[e.id] ?? ['NOTE']} />,
  tag: () => <Tag />,
  steamValve: () => <SteamValve />,
  steam: (e) => <Steam e={e} />,
  breaker: () => <Breaker />,
  terminal: () => <Terminal />,
  dockHatch: () => <DockHatch />,
  doorLock: () => <DoorLock />,
  pilotConsole: () => <PilotConsole />,
  engineSlot: () => <EngineSlot />,
  ...ZONE4_ENT_MODELS,
}

const WALL_BRACKET = new Set(['battery', 'water', 'fuse', 'wrench', 'multitool', 'purifier', 'tape', 'compass', 'whistle', 'mirror'])

function EntNode({ e, zone }: { e: Ent; zone: ZoneId }) {
  useGame((s) => s.taken.length + Object.values(s.flags).filter(Boolean).length)
  const active = entActive(e)
  const { p, r } = placeOf(e, 0)
  const map = gridMap(zone)
  const room = map ? roomAt(map, p[0] + (e.wall ? Math.sin(r) * 0.3 : 0), p[2] + (e.wall ? Math.cos(r) * 0.3 : 0)) : null
  const model = ENT_MODELS[e.model]
  const keepWhenDone = !e.item
  // L'étagère fait partie du nœud ramassable : elle doit rester quand l'objet part.
  const shelf = !!(e.item && e.wall && (e.y ?? 0) > 0.3 && WALL_BRACKET.has(e.model))
  // Une fois fermée, la vanne reste en place : seule son interaction disparaît.
  const staysVisible = e.model === 'steamValve' || e.model === 'engineSlot'
  if (!active && !keepWhenDone && !shelf) return null
  return (
    <RoomCtx.Provider value={{ id: room?.id ?? '', dark: !!room?.dark }}>
      <group name={`ent:${e.id}`} position={p} rotation={[0, r, 0]}>
        {(active || staysVisible) && model ? (e.item ? <PickupHighlight>{model(e)}</PickupHighlight> : model(e)) : null}
        {!e.item && <SolidProp model={e.model} />}
        {shelf && <Bracket />}
        {active && <Hitbox e={e} />}
      </group>
    </RoomCtx.Provider>
  )
}

export function EntModels({ zone }: { zone: ZoneId }) {
  const ents = useMemo(() => allEnts(zone), [zone])
  return (
    <group>
      {ents.map((e) => (
        <EntNode key={e.id} e={e} zone={zone} />
      ))}
    </group>
  )
}

export function aimedEnt() {
  return live.aimed
}
