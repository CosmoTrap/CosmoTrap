import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { fetchGhost } from '../game/api'
import { terrainHeight } from '../game/maps/zone4'
import { G, live, useGame } from '../game/state'
import { Astronaut } from './Astronaut'

// Réplique fantôme : l'hologramme du record de la difficulté rejoue son parcours en même temps que toi.

export function useLoadGhost() {
  const difficulty = useGame((s) => s.difficulty)
  const screen = useGame((s) => s.screen)
  useEffect(() => {
    if (screen !== 'playing') return
    live.ghost = null
    fetchGhost(difficulty).then((g) => {
      if (g && g.track?.length >= 8) live.ghost = g
    })
  }, [difficulty, screen])
}

/** position du fantôme au temps t (s) : [zone, x, z, cap] ou null */
function sample(track: number[], t: number): [number, number, number, number] | null {
  const n = track.length / 4
  if (!n || t < track[0]) return null
  let lo = 0
  let hi = n - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (track[mid * 4] <= t) lo = mid
    else hi = mid - 1
  }
  const i = lo
  const j = Math.min(n - 1, i + 1)
  const t0 = track[i * 4]
  const t1 = track[j * 4]
  const k = t1 > t0 ? Math.min(1, (t - t0) / (t1 - t0)) : 0
  const zone = track[i * 4 + 1]
  const sameZone = track[j * 4 + 1] === zone
  const x0 = track[i * 4 + 2] / 10
  const z0 = track[i * 4 + 3] / 10
  const x1 = sameZone ? track[j * 4 + 2] / 10 : x0
  const z1 = sameZone ? track[j * 4 + 3] / 10 : z0
  const heading = Math.hypot(x1 - x0, z1 - z0) > 0.05 ? Math.atan2(x1 - x0, z1 - z0) : NaN
  return [zone, x0 + (x1 - x0) * k, z0 + (z1 - z0) * k, heading]
}

export function Ghost() {
  const show = useGame((s) => s.settings.ghostReplay)
  const g = useRef<THREE.Group>(null)
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 } },
        vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY;
          void main(){ vec4 mv = modelViewMatrix*vec4(position,1.); vN=normalize(normalMatrix*normal); vV=normalize(-mv.xyz); vY=(modelMatrix*vec4(position,1.)).y; gl_Position=projectionMatrix*mv; }`,
        fragmentShader: `uniform float uTime; varying vec3 vN; varying vec3 vV; varying float vY;
          void main(){ float f = pow(1.-abs(dot(vN,vV)),2.); float scan = .7+.3*sin(vY*60.-uTime*5.);
            gl_FragColor = vec4(vec3(1.,.62,.25)*(f*1.6+.05)*scan*.9, 1.); }`,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )
  const yaw = useRef(0)
  useFrame(({ clock }, dt) => {
    mat.uniforms.uTime.value = clock.elapsedTime
    const grp = g.current
    if (!grp) return
    const s = G()
    const gh = live.ghost
    const p = show && gh && !s.cine ? sample(gh.track, s.playTime) : null
    // caché s'il est collé au joueur (sinon des morceaux traversent la caméra au départ)
    const near = p && Math.hypot(p[1] - live.pos[0], p[2] - live.pos[2]) < 1.6
    if (!p || p[0] !== s.zone || near) {
      grp.visible = false
      return
    }
    grp.visible = true
    const y = s.zone === 4 ? terrainHeight(p[1], p[2]) : 0
    grp.position.set(p[1], y, p[2])
    if (!Number.isNaN(p[3])) yaw.current = THREE.MathUtils.lerp(yaw.current, p[3], Math.min(1, dt * 8))
    grp.rotation.y = yaw.current
  })
  return (
    <group ref={g} visible={false}>
      <Astronaut override={mat} castShadow={false} />
    </group>
  )
}
