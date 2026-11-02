// Fonctions GLSL partagées (bruit, fbm).
export const NOISE = /* glsl */ `
float hash1(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
vec3 hash3(vec3 p){
  p = vec3(dot(p,vec3(127.1,311.7,74.7)), dot(p,vec3(269.5,183.3,246.1)), dot(p,vec3(113.5,271.9,124.6)));
  return fract(sin(p) * 43758.5453123);
}
float vnoise(vec3 p){
  vec3 i = floor(p); vec3 f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(hash1(i),hash1(i+vec3(1,0,0)),f.x),mix(hash1(i+vec3(0,1,0)),hash1(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(hash1(i+vec3(0,0,1)),hash1(i+vec3(1,0,1)),f.x),mix(hash1(i+vec3(0,1,1)),hash1(i+vec3(1,1,1)),f.x),f.y),f.z);
}
float fbm(vec3 p){
  float s = 0.0; float a = 0.5;
  for (int i = 0; i < 6; i++){ s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s;
}
float fbm3(vec3 p){
  float s = 0.0; float a = 0.5;
  for (int i = 0; i < 3; i++){ s += a * vnoise(p); p = p * 2.03 + vec3(1.7, 9.2, 3.1); a *= 0.5; }
  return s;
}
float ridged(vec3 p){
  float s = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++){ float n = 1.0 - abs(vnoise(p) * 2.0 - 1.0); s += a * n * n; p *= 2.1; a *= 0.5; }
  return s;
}
`
