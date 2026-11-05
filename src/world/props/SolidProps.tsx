import { CuboidCollider, CylinderCollider, RigidBody } from '@react-three/rapier'

type V3 = [number, number, number]
type Bounds = { size: V3; at: V3; rotation?: V3 }
const box = (size: V3, at: V3, rotation?: V3): Bounds => ({ size, at, rotation })

// Local-space dimensions follow the meshes, including their wall offset. Keep
// separate volumes for benches, shelves and stacked crates; a single enclosing
// box would block the passages between them. Tiny decoration remains non-solid.
const BOUNDS: Record<string, Bounds[]> = {
  bunk: [box([1.95, 2.12, 0.94], [0, 1.06, 0.48])],
  bunkMirrored: [box([1.95, 2.12, 0.94], [0, 1.06, 0.48])],
  table: [box([1.72, 0.79, 0.87], [0, 0.395, 0])],
  personalLocker: [box([0.6, 2, 0.56], [0, 1, 0.28])],
  workstation: [box([1.72, 0.2, 0.46], [0, 1.0, 0.25])],
  nook: [box([0.66, 0.74, 0.66], [0, 0.37, 0.62]), ...[-0.74, 0.74].map((x) => box([0.58, 1.3, 0.56], [x, 0.65, 0.62]))],
  nookMeal: [box([0.66, 0.74, 0.66], [0, 0.37, 0.62]), ...[-0.74, 0.74].map((x) => box([0.58, 1.3, 0.56], [x, 0.65, 0.62]))],
  curtain: [box([0.08, 2.3, 2.3], [0, 1.15, 1.15])],
  washBasin: [box([0.66, 0.2, 0.5], [0, 0.82, 0.25])],
  medCart: [box([0.78, 0.98, 0.5], [0, 0.49, 0.3])],
  counterSink: [box([2, 0.94, 0.64], [0, 0.47, 0.32])],
  counterLow: [box([2, 0.94, 0.64], [0, 0.47, 0.32])],
  fridge: [box([0.76, 1.95, 0.68], [0, 0.975, 0.34])],
  bin: [box([0.3, 0.55, 0.3], [0, 0.275, 0])],
  counter: [box([2, 0.94, 0.64], [0, 0.47, 0.32]), box([2, 0.6, 0.35], [0, 2.1, 0.18])],
  shelf: [box([1.2, 0.04, 0.3], [0, 0, 0.15])],
  crates: [box([0.82, 0.6, 0.62], [0, 0.3, 0]), box([0.6, 0.45, 0.5], [0.05, 0.825, 0.02], [0, 0.2, 0]),
    box([0.5, 0.5, 0.5], [0.75, 0.25, 0.1], [0, -0.3, 0])],
  rack: [box([1.8, 2.2, 0.52], [0, 1.1, 0.26])],
  medbed: [box([0.85, 0.87, 1.95], [0, 0.435, 0]), box([0.05, 1.7, 0.05], [0.45, 0.85, -0.9])],
  cabinet: [box([1.42, 0.93, 0.58], [0, 0.465, 0.29]), box([1.4, 0.7, 0.36], [0, 2, 0.18])],
  suitRack: [box([0.86, 2, 0.74], [0, 1, 0.38])],
  labBench: [box([1.9, 0.94, 0.75], [0, 0.47, 0.38]), ...[-0.62, 0.62].map((x) => box([0.5, 0.42, 0.26], [x, 1.72, 0.16]))],
  treadmill: [box([1.35, 0.16, 0.5], [0, 0.1, 0.32]), box([0.1, 0.72, 0.3], [0.6, 0.52, 0.32])],
  ergBike: [box([0.4, 0.12, 0.78], [0, 0.06, 0.4]), box([0.28, 0.85, 0.35], [0, 0.5, 0.4])],
  lounge: [box([0.78, 0.72, 0.58], [0, 0.36, 0.32])],
  sideTable: [box([0.36, 0.46, 0.36], [0, 0.23, 0.28])],
  plantRack: [box([1.95, 2.2, 0.7], [0, 1.1, 0.35])],
  elecCabinet: [box([1, 2, 0.54], [0, 1, 0.27])],
  console: [box([1.6, 1.07, 0.62], [0, 0.535, 0.31])],
  sideConsole: [box([1.8, 1.1, 0.62], [0, 0.55, 0.31])],
  pilotSeat: [box([0.7, 1.58, 0.7], [0, 0.79, -0.08])],
  crewSeats: [-0.6, 0.6].map((x) => box([0.6, 1.3, 0.55], [x, 0.65, 0.35])),
  engineCore: [box([1.6, 1.95, 2.2], [0, 0.975, 0])],
  grating: [-1.2, 1.2].map((x) => box([0.05, 1, 3.6], [x, 0.5, 0])),
  // Interactive furniture has physics independently of its raycast hitbox.
  locker: [box([0.8, 2, 0.56], [0, 1, 0.28])],
  dispenser: [box([0.45, 1.45, 0.52], [0, 0.725, 0.26])],
  terminal: [box([1.4, 0.96, 0.65], [0, 0.48, 0.325]), box([1, 0.65, 0.12], [0, 1.45, 0.12])],
  pilotConsole: [box([5.6, 1.12, 1], [0, 0.56, 0.5])],
  breaker: [box([1.3, 1.5, 0.32], [0, 0, 0.16])],
  engineSlot: [box([1, 1.2, 0.38], [0, 0, 0.19])],
}

export function PropColliders({ model }: { model: string }) {
  if (model === 'reactor') {
    return <CylinderCollider args={[1.35, 1.05]} position={[0, 1.35, 0]} />
  }
  const bounds = BOUNDS[model]
  if (!bounds) return null
  return <>
    {bounds.map(({ size, at, rotation }, i) => <CuboidCollider key={i} position={at} rotation={rotation}
      args={[size[0] / 2, size[1] / 2, size[2] / 2]} />)}
  </>
}

export function SolidProp({ model }: { model: string }) {
  if (!BOUNDS[model] && model !== 'reactor') return null
  return <RigidBody type="fixed" colliders={false}><PropColliders model={model} /></RigidBody>
}
