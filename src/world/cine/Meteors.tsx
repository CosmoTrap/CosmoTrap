import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

// Meteors striking the station, in the cinematics: a burning rock with its trail, then at the impact a flash,
// a spray of debris and a cloud of dust, and a fire that keeps burning on the hull. Positions are in the
// parent group's space; sizes are in metres of that space.

export interface Strike { from: THREE.Vector3; to: THREE.Vector3; at: number; size: number; flight?: number }

const FLIGHT = 1.4
const TRAIL = 8
const DEBRIS = 16

function glowTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 64
  const x = c.getContext('2d')!
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.3, 'rgba(255,255,255,0.5)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  x.fillStyle = g
  x.fillRect(0, 0, 64, 64)
  return new THREE.CanvasTexture(c)
}

/** A fixed pseudo-random direction per debris piece, so that a strike always shatters the same way. */
function spray(i: number, j: number) {
  const a = (i * 7.31 + j * 2.399) % (Math.PI * 2), y = ((i * 13 + j * 29) % 17) / 17 * 2 - 1
  const r = Math.sqrt(1 - y * y)
  return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r).multiplyScalar(0.6 + ((i + j * 3) % 5) / 5)
}

export function Meteors({ strikes, time }: { strikes: Strike[]; time: () => number }) {
  const fx = useMemo(() => {
    const tex = glowTexture()
    const add = { map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }
    const rock = new THREE.DodecahedronGeometry(1, 1)
    const p = rock.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) * (0.85 + (i % 5) * 0.06), p.getY(i) * (0.8 + (i % 3) * 0.1), p.getZ(i))
    rock.computeVertexNormals()
    return {
      tex, rock,
      rockMat: new THREE.MeshStandardMaterial({ color: '#3a3330', roughness: 0.9, emissive: '#ff5a1a', emissiveIntensity: 0.8 }),
      trail: (k: number) => new THREE.SpriteMaterial({ ...add, color: new THREE.Color(1, 0.55 - k * 0.04, 0.2 - k * 0.02) }),
      flash: () => new THREE.SpriteMaterial({ ...add, color: new THREE.Color(1, 0.85, 0.6) }),
      fire: () => new THREE.SpriteMaterial({ ...add, color: new THREE.Color(1, 0.42, 0.12) }),
      dust: () => new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, color: '#8a8580' }),
      debris: new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#c9c6bf', roughness: 0.6, metalness: 0.4, emissive: '#ff6a2a', emissiveIntensity: 0.25 }), Math.max(1, strikes.length * DEBRIS)),
    }
  }, [strikes.length])
  const parts = useMemo(() => strikes.map(() => ({
    trail: Array.from({ length: TRAIL }, (_, k) => new THREE.Sprite(fx.trail(k))),
    flash: new THREE.Sprite(fx.flash()),
    fire: new THREE.Sprite(fx.fire()),
    dust: new THREE.Sprite(fx.dust()),
  })), [strikes, fx])
  useEffect(() => () => {
    fx.tex.dispose(); fx.rock.dispose(); fx.rockMat.dispose(); fx.debris.geometry.dispose(); (fx.debris.material as THREE.Material).dispose()
    parts.forEach((p) => [...p.trail, p.flash, p.fire, p.dust].forEach((s) => s.material.dispose()))
  }, [fx, parts])
  const rocks = useRef<(THREE.Mesh | null)[]>([])
  const light = useRef<THREE.PointLight>(null)
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3()
  useFrame(() => {
    const t = time()
    let glow = 0
    strikes.forEach((s, i) => {
      const tt = t < 0 ? -99 : t - s.at
      const F = s.flight ?? FLIGHT
      const flying = tt > -F && tt < 0
      const rock = rocks.current[i]
      const dir = s.to.clone().sub(s.from).normalize()
      const at = (u: number) => s.from.clone().lerp(s.to, THREE.MathUtils.clamp(1 + u / F, 0, 1))
      if (rock) {
        rock.visible = flying
        if (flying) {
          rock.position.copy(at(tt))
          rock.scale.setScalar(s.size * 0.5)
          rock.rotation.set(tt * 3, tt * 2, 0)
        }
      }
      parts[i].trail.forEach((sp, k) => {
        sp.visible = flying
        if (!flying) return
        sp.position.copy(at(tt)).addScaledVector(dir, -k * s.size * 0.9)
        sp.scale.setScalar(s.size * (1.6 - k * 0.15))
        sp.material.opacity = 0.9 * (1 - k / TRAIL)
      })
      // After the impact: a white-hot flash, a dust cloud spreading, and a fire that stays on the hull.
      const after = tt >= 0 && tt < 30
      const { flash, fire, dust } = parts[i]
      flash.visible = after && tt < 1.2
      fire.visible = after
      dust.visible = after && tt < 6
      if (after) {
        flash.position.copy(s.to)
        flash.scale.setScalar(s.size * (3 + tt * 14))
        flash.material.opacity = Math.max(0, 1 - tt / 1.2)
        fire.position.copy(s.to)
        fire.scale.setScalar(s.size * (2.2 + 0.4 * Math.sin(t * 9 + i)))
        fire.material.opacity = 0.7 * Math.min(1, tt * 3) * (0.8 + 0.2 * Math.sin(t * 13 + i * 2))
        dust.position.copy(s.to)
        dust.scale.setScalar(s.size * (1 + tt * 3.5))
        dust.material.opacity = 0.35 * Math.max(0, 1 - tt / 6)
        if (tt < 1.2) glow = Math.max(glow, 1 - tt / 1.2)
      }
      // Debris: hull plates thrown outwards, tumbling, drifting on in space.
      for (let j = 0; j < DEBRIS; j++) {
        const id = i * DEBRIS + j
        if (!after) { m.makeScale(0, 0, 0); fx.debris.setMatrixAt(id, m); continue }
        v.copy(spray(i, j)).multiplyScalar(s.size * 3.5 * Math.log(1 + tt * 4)).add(s.to)
        q.setFromEuler(new THREE.Euler(tt * (1 + j % 3), tt * (2 - j % 2), j))
        const k = s.size * (0.3 + (j % 4) * 0.12)
        sc.set(k, k * 0.2, k * 0.7)
        m.compose(v, q, sc)
        fx.debris.setMatrixAt(id, m)
      }
      if (flying) glow = Math.max(glow, 0.5)
    })
    fx.debris.instanceMatrix.needsUpdate = true
    if (light.current) {
      const active = strikes.findIndex((s) => t - s.at > -(s.flight ?? FLIGHT) && t - s.at < 1.2)
      light.current.intensity = active >= 0 ? 600 * glow : 0
      if (active >= 0) light.current.position.copy(strikes[active].to)
    }
  })
  return (
    <group name="meteors">
      {strikes.map((s, i) => <mesh key={i} ref={(r) => { rocks.current[i] = r }} geometry={fx.rock} material={fx.rockMat} visible={false} />)}
      {parts.map((p, i) => <group key={i}>{[...p.trail, p.flash, p.fire, p.dust].map((sp, k) => <primitive key={k} object={sp} />)}</group>)}
      <primitive object={fx.debris} frustumCulled={false} />
      <pointLight ref={light} color="#ff7a30" intensity={0} distance={140} decay={1.4} />
    </group>
  )
}
