import { useMemo } from 'react'
import * as THREE from 'three'
import { NOISE } from './glsl'
import { tex } from '../assets'

// Lune procédurale : cratères multi-échelles (relief analytique), mers sombres,
// photométrie lunaire (Lommel-Seeliger) → terminateur jour/nuit marqué.

const vert = /* glsl */ `
varying vec3 vObjN;
varying vec3 vWorldPos;
void main(){
  vObjN = normalize(position);
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`

const frag = /* glsl */ `
uniform vec3 uSun;
uniform float uDetail;
uniform float uIntensity;
uniform mat3 uRot;
uniform sampler2D uAlbedo;
varying vec3 vObjN;
varying vec3 vWorldPos;
${NOISE}
// hauteur + gradient (espace p) d'un champ de cratères
vec4 craters(vec3 p, float density){
  vec3 cell = floor(p); vec3 f = fract(p);
  float h = 0.0; vec3 g = vec3(0.0);
  for (int i=-1;i<=1;i++) for (int j=-1;j<=1;j++) for (int k=-1;k<=1;k++){
    vec3 o = vec3(float(i),float(j),float(k));
    vec3 r = hash3(cell + o);
    if (r.x > density) continue;
    vec3 c = o + 0.2 + 0.6 * hash3(cell + o + 17.0);
    float R = 0.07 + 0.4 * r.y * r.y * r.y;
    vec3 d = f - c; float dist = length(d); float x = dist / R;
    if (x > 1.8) continue;
    float depth = 0.32 + 0.2 * r.z;
    float rimW = 0.24;
    float e = exp(-pow((x - 1.0) / rimW, 2.0));
    float bowl = x < 1.0 ? (x * x - 1.0) * depth : 0.0;
    float rim = 0.2 * e;
    h += (bowl + rim) * R;
    float dbowl = x < 1.0 ? 2.0 * x * depth : 0.0;
    float drim = 0.2 * e * (-2.0 * (x - 1.0) / (rimW * rimW));
    vec3 dir = dist > 1e-4 ? d / dist : vec3(0.0);
    g += (dbowl + drim) * dir;
  }
  return vec4(h, g);
}
vec2 equi(vec3 n){ return vec2(0.5 + atan(n.z, n.x) / 6.2831853, 0.5 + asin(clamp(n.y, -1.0, 1.0)) / 3.1415926); }
float lum(vec3 n){ return dot(texture2D(uAlbedo, equi(n)).rgb, vec3(0.333)); }
void main(){
  vec3 n = normalize(vObjN);
  // relief de la vraie carte lunaire (LRO, NASA) : gradient de la luminance
  vec3 t1 = normalize(cross(abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0), n));
  vec3 t2 = cross(n, t1);
  float e = 0.0012;
  float l0 = lum(n);
  vec3 G = (t1 * (lum(normalize(n + t1 * e)) - l0) + t2 * (lum(normalize(n + t2 * e)) - l0)) / e * 0.0045;
  vec4 c2 = craters(n * 9.0 + 7.3, 0.12);
  G += c2.yzw * 0.25;
  float h = c2.x / 9.0;
  if (uDetail > 1.5) { vec4 c3 = craters(n * 27.0 + 3.1, 0.5); G += c3.yzw * 0.55; h += c3.x / 27.0; }
  if (uDetail > 2.5) { vec4 c4 = craters(n * 81.0 + 1.7, 0.6); G += c4.yzw * 0.4; }
  // régolithe fin
  float e2 = 0.02;
  float r0 = fbm3(n * 160.0);
  vec3 Gr = vec3(fbm3(n*160.0 + vec3(e2*160.0,0,0)) - r0, fbm3(n*160.0 + vec3(0,e2*160.0,0)) - r0, fbm3(n*160.0 + vec3(0,0,e2*160.0)) - r0) / e2 * 0.004;
  G += Gr;
  vec3 Np = normalize(n - (G - dot(G, n) * n) * 0.45);
  vec3 N = normalize(uRot * Np);
  vec3 L = normalize(uSun);
  vec3 V = normalize(cameraPosition - vWorldPos);
  // albédo : hautes terres claires, mers sombres, éjectas frais
  float alb = l0 * 0.26;
  alb *= 0.9 + 0.2 * fbm(n * 60.0);
  alb += max(0.0, -h) * 0.0;
  float mu0 = max(dot(N, L), 0.0);
  float mu = max(dot(N, V), 0.02);
  float ls = mu0 / (mu0 + mu);
  float shade = mix(mu0, 2.0 * ls, 0.45);
  // terminateur adouci sur la sphère géométrique
  float geo = smoothstep(-0.02, 0.06, dot(normalize(uRot * n), L));
  vec3 col = vec3(alb) * vec3(1.0, 0.97, 0.93) * shade * geo * uIntensity;
  // lumière cendrée (clair de Terre) côté nuit
  col += vec3(0.25, 0.35, 0.5) * alb * 0.025 * (1.0 - geo);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`

export function Moon({ radius, position, sun, detail = 3, intensity = 4.2 }: { radius: number; position: [number, number, number]; sun: THREE.Vector3; detail?: number; intensity?: number }) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: vert,
        fragmentShader: frag,
        uniforms: {
          uSun: { value: sun.clone() },
          uDetail: { value: detail },
          uIntensity: { value: intensity },
          uRot: { value: new THREE.Matrix3().setFromMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.3, 0.8, 0))) },
          uAlbedo: { value: tex('/assets/planets/moon.jpg') },
        },
      }),
    [sun, detail, intensity],
  )
  return (
    <mesh position={position} material={mat} rotation={[0.3, 0.8, 0]}>
      <sphereGeometry args={[radius, 256, 160]} />
    </mesh>
  )
}
