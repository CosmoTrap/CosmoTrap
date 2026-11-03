import { useFrame } from '@react-three/fiber'
import { useMemo } from 'react'
import * as THREE from 'three'
import { NOISE } from './glsl'
import { tex } from '../assets'

// Terre procédurale : continents, océans spéculaires, calottes, nuages animés,
// lumières des villes côté nuit, atmosphère diffusante (bleu au limbe, orangé au terminateur).

const vert = /* glsl */ `
varying vec3 vObjN;
varying vec3 vWorldN;
varying vec3 vWorldPos;
void main(){
  vObjN = normalize(position);
  vWorldN = normalize(mat3(modelMatrix) * normal);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`

const frag = /* glsl */ `
uniform vec3 uSun;
uniform float uTime;
uniform float uIntensity;
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform sampler2D uClouds;
varying vec3 vObjN;
varying vec3 vWorldN;
varying vec3 vWorldPos;
${NOISE}
vec2 equi(vec3 n){ return vec2(0.5 + atan(n.z, -n.x) / 6.2831853, 0.5 + asin(clamp(n.y, -1.0, 1.0)) / 3.1415926); }
void main(){
  vec3 n = normalize(vObjN);
  vec2 uv = equi(n);
  vec3 alb = texture2D(uDay, uv).rgb;
  alb = pow(alb, vec3(1.15));
  // océan : bleu dominant et sombre
  float land = 1.0 - smoothstep(0.02, 0.12, (alb.b - max(alb.r, alb.g)) * 2.0 + (0.25 - dot(alb, vec3(0.33))) * 0.6);
  vec3 N = normalize(vWorldN);
  vec3 L = normalize(uSun);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float ndl = dot(N, L);
  float day = smoothstep(-0.12, 0.2, ndl);

  // nuages (rotation lente)
  float ca = uTime * 0.004;
  vec3 cn = vec3(n.x * cos(ca) - n.z * sin(ca), n.y, n.x * sin(ca) + n.z * cos(ca));
  float cl = smoothstep(0.15, 0.9, texture2D(uClouds, equi(cn)).r);
  vec3 col = alb * max(ndl, 0.0) * 1.4;
  // reflet du soleil sur l'océan
  vec3 H = normalize(L + V);
  float spec = pow(max(dot(N, H), 0.0), 90.0) * (1.0 - land) * (1.0 - cl) * step(0.0, ndl);
  col += vec3(1.0, 0.9, 0.75) * spec * 2.5;
  col = mix(col, vec3(1.0) * max(ndl, 0.0) * 1.25, cl * 0.92);
  // villes la nuit
  vec3 city = texture2D(uNight, uv).rgb;
  col += city * vec3(1.0, 0.75, 0.45) * (1.0 - day) * (1.0 - cl) * 1.6;
  // atmosphère : limbe bleu, terminateur chaud
  float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
  vec3 atm = mix(vec3(0.95, 0.45, 0.2), vec3(0.3, 0.55, 1.0), smoothstep(-0.1, 0.35, ndl));
  col += atm * fres * smoothstep(-0.3, 0.2, ndl) * 1.6;
  col = mix(col, col + vec3(0.08, 0.14, 0.3) * day, 0.35);
  gl_FragColor = vec4(col * uIntensity, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

const atmoFrag = /* glsl */ `
uniform vec3 uSun;
uniform float uIntensity;
varying vec3 vWorldN;
varying vec3 vWorldPos;
varying vec3 vObjN;
void main(){
  vec3 N = normalize(vWorldN);
  vec3 V = normalize(cameraPosition - vWorldPos);
  float rim = 1.0 - abs(dot(N, V));
  float a = pow(rim, 5.0) * 1.8;
  float ndl = dot(N, normalize(uSun));
  vec3 c = mix(vec3(1.0, 0.45, 0.15), vec3(0.35, 0.6, 1.0), smoothstep(-0.15, 0.3, ndl));
  float lit = smoothstep(-0.35, 0.25, ndl);
  gl_FragColor = vec4(c * a * lit * uIntensity, 1.0);
}`

export function Earth({ radius, position, sun, intensity = 3.2 }: { radius: number; position: [number, number, number]; sun: THREE.Vector3; intensity?: number }) {
  const { mat, atmo } = useMemo(() => {
    const u = {
      uSun: { value: sun.clone() },
      uTime: { value: 0 },
      uIntensity: { value: intensity },
      uDay: { value: tex('/assets/planets/earth_day.jpg') },
      uNight: { value: tex('/assets/planets/earth_night.jpg') },
      uClouds: { value: tex('/assets/planets/earth_clouds.jpg', false) },
    }
    return {
      mat: new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms: u }),
      atmo: new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: atmoFrag,
        uniforms: u,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    }
  }, [sun, intensity])
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime
  })
  return (
    <group position={position} rotation={[0.41, 2.2, 0]}>
      <mesh material={mat}>
        <sphereGeometry args={[radius, 128, 96]} />
      </mesh>
      <mesh material={atmo} scale={1.045}>
        <sphereGeometry args={[radius, 96, 64]} />
      </mesh>
    </group>
  )
}
