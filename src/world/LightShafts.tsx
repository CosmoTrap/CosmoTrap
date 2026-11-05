import { alarmOn } from './roomPower'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { G } from '../game/state'
import { QUALITY } from './quality'
import type { WindowDef } from './Level'

// Rayons de soleil volumétriques (faux volumes additifs) + poussière en suspension.
// C'est ce qui donne le clair-obscur à travers les hublots.

const shaftVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
varying vec3 vW;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal);
  vV = normalize(-mv.xyz);
  vW = (modelMatrix * vec4(position, 1.0)).xyz;
  gl_Position = projectionMatrix * mv;
}`

const shaftFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uTime;
uniform float uIntensity;
varying vec2 vUv;
varying vec3 vN;
varying vec3 vV;
varying vec3 vW;
float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
float n3(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z);
}
void main() {
  // Interpolation at the cylinder rim can slightly exceed [0, 1]. A negative
  // base in pow(..., 1.8) yields NaN, which bloom spreads across the whole frame.
  float t = clamp(vUv.y, 0.0, 1.0);
  float fade = pow(1.0 - t, 1.8) * smoothstep(0.0, 0.06, t);
  float edge = pow(abs(dot(vN, vV)), 2.2);
  float dust = 0.7 + 0.6 * n3(vW * 2.5 + vec3(0.0, uTime * 0.08, uTime * 0.05));
  float a = fade * edge * dust * uIntensity;
  gl_FragColor = vec4(uColor * a, 1.0);
}`

export function LightShafts({ windows, sun }: { windows: WindowDef[]; sun: [number, number, number] }) {
  const enabled = QUALITY[G().settings.quality].godrays
  const { shafts, mat, dust } = useMemo(() => {
    const d = new THREE.Vector3(...sun).normalize().negate()
    const mat = new THREE.ShaderMaterial({
      vertexShader: shaftVert,
      fragmentShader: shaftFrag,
      uniforms: { uColor: { value: new THREE.Color('#ffe9cb') }, uTime: { value: 0 }, uIntensity: { value: 0.2 } },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    })
    const shafts: { pos: THREE.Vector3; quat: THREE.Quaternion; len: number; r: number }[] = []
    const dustPts: number[] = []
    for (const w of windows) {
      const n = new THREE.Vector3(Math.sin(w.rot), 0, Math.cos(w.rot))
      if (d.dot(n) < 0.12) continue
      const big = w.kind === 'V'
      const start = new THREE.Vector3(w.x, big ? 1.85 : 1.5, w.z)
      const len = Math.min(big ? 8 : 9, d.y < -0.01 ? start.y / -d.y : 9)
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d)
      shafts.push({ pos: start.clone().addScaledVector(d, len / 2), quat, len, r: big ? 0.95 : 0.4 })
      for (let i = 0; i < (big ? 70 : 28); i++) {
        const k = Math.random() * len * 0.85
        const p = start.clone().addScaledVector(d, k)
        p.x += (Math.random() - 0.5) * (big ? 1.6 : 0.6)
        p.y += (Math.random() - 0.5) * (big ? 1.6 : 0.6)
        p.z += (Math.random() - 0.5) * (big ? 1.6 : 0.6)
        dustPts.push(p.x, p.y, p.z)
      }
    }
    const dg = new THREE.BufferGeometry()
    dg.setAttribute('position', new THREE.Float32BufferAttribute(dustPts, 3))
    const dm = new THREE.PointsMaterial({ color: '#ffe9c9', size: 0.009, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true })
    const dust = new THREE.Points(dg, dm)
    return { shafts, mat, dust }
  }, [windows, sun])

  const fullBeam = useRef(mat.uniforms.uIntensity.value)
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime
    // With the lights out the portholes barely light anything: only a faint shaft remains.
    mat.uniforms.uIntensity.value = fullBeam.current * (alarmOn() ? 0.28 : 1)
    const p = dust.geometry.attributes.position as THREE.BufferAttribute
    const t = clock.elapsedTime
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.sin(t * 0.4 + i) * 0.0006)
    p.needsUpdate = true
  })

  if (!enabled) return null
  return (
    <group>
      {shafts.map((s, i) => (
        <mesh key={i} position={s.pos} quaternion={s.quat} material={mat} renderOrder={5}>
          <cylinderGeometry args={[s.r * 1.25, s.r, s.len, 24, 1, true]} />
        </mesh>
      ))}
      <primitive object={dust} />
    </group>
  )
}
