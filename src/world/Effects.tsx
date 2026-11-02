import { useFrame } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, Effect, ToneMappingMode } from 'postprocessing'
import { forwardRef, useMemo } from 'react'
import * as THREE from 'three'
import { G, useGame } from '../game/state'
import { QUALITY } from './quality'

// Étalonnage « clair-obscur » : ombres froides, hautes lumières chaudes, contraste doux,
// grain de film, et effets d'état (O₂ bas : vignette rouge + flou ; soif : flou).

const gradeFrag = /* glsl */ `
uniform float uTime;
uniform float uWarm;
uniform float uRed;
uniform float uBlur;
uniform float uGrain;
uniform float uFade;
float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec3 c = inputColor.rgb;
  if (uBlur > 0.001) {
    vec3 acc = vec3(0.0);
    float r = uBlur * 0.006;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785;
      acc += texture2D(inputBuffer, uv + vec2(cos(a), sin(a)) * r).rgb;
    }
    c = mix(c, acc / 8.0, min(1.0, uBlur));
  }
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  // split-toning : ombres sarcelle, lumières ambrées
  vec3 shadowTint = vec3(0.86, 0.97, 1.06);
  vec3 highTint = vec3(1.08, 1.0, 0.88);
  c *= mix(shadowTint, highTint, smoothstep(0.05, 0.75, l) * uWarm + (1.0 - uWarm) * 0.5);
  // courbe en S douce
  c = mix(c, c * c * (3.0 - 2.0 * c), 0.22);
  // saturation légèrement réduite dans les ombres
  c = mix(vec3(l), c, mix(0.85, 1.08, smoothstep(0.0, 0.6, l)));
  // vignette rouge (O₂ bas)
  vec2 d = uv - 0.5;
  float v = smoothstep(0.25, 0.75, length(d * vec2(1.1, 1.0)));
  float pulse = 0.75 + 0.25 * sin(uTime * 6.0);
  c = mix(c, c * vec3(0.5, 0.05, 0.03) + vec3(0.18, 0.0, 0.0) * pulse, v * uRed);
  // grain
  c += (rnd(uv * 913.0) - 0.5) * uGrain;
  c *= 1.0 - uFade;
  outputColor = vec4(c, inputColor.a);
}`

class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', gradeFrag, {
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, THREE.Uniform>([
        ['uTime', new THREE.Uniform(0)],
        ['uWarm', new THREE.Uniform(1)],
        ['uRed', new THREE.Uniform(0)],
        ['uBlur', new THREE.Uniform(0)],
        ['uGrain', new THREE.Uniform(0.012)],
        ['uFade', new THREE.Uniform(0)],
      ]),
    })
  }
}

const Grade = forwardRef<GradeEffect>(function Grade(_, ref) {
  const effect = useMemo(() => new GradeEffect(), [])
  useFrame(({ clock }) => {
    const s = G()
    const u = effect.uniforms
    u.get('uTime')!.value = clock.elapsedTime % 100
    const lowO2 = s.zone < 4 && s.screen === 'playing' ? THREE.MathUtils.clamp(1 - s.res.o2 / 25, 0, 1) : 0
    const thirst = s.screen === 'playing' && s.res.water <= 0 ? 1 : 0
    const r = u.get('uRed')!
    r.value = THREE.MathUtils.lerp(r.value, lowO2 * 0.9, 0.05)
    const b = u.get('uBlur')!
    const breath = lowO2 > 0.6 ? (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.2)) * lowO2 : 0
    b.value = THREE.MathUtils.lerp(b.value, Math.max(thirst * 0.85, breath * 0.8), 0.05)
  })
  return <primitive ref={ref} object={effect} dispose={null} />
})

export function Effects() {
  const quality = useGame((s) => s.settings.quality)
  const zone = useGame((s) => s.zone)
  const q = QUALITY[quality]
  const outdoor = zone === 4
  const ca = useMemo(() => new THREE.Vector2(0.0006, 0.0006), [])
  const fx: JSX.Element[] = []
  if (q.ao) fx.push(<N8AO key="ao" aoRadius={outdoor ? 2.5 : 0.9} intensity={outdoor ? 2 : 3} distanceFalloff={1} halfRes={q.ao === 'half'} quality={q.ao === 'full' ? 'high' : 'medium'} color="black" />)
  if (q.bloom) fx.push(<Bloom key="bloom" mipmapBlur intensity={outdoor ? 0.55 : 0.85} luminanceThreshold={outdoor ? 1.1 : 0.85} luminanceSmoothing={0.3} radius={0.75} />)
  fx.push(<ToneMapping key="tm" mode={ToneMappingMode.ACES_FILMIC} />)
  fx.push(<Grade key="grade" />)
  fx.push(<ChromaticAberration key="ca" offset={ca} radialModulation modulationOffset={0.35} />)
  fx.push(<Vignette key="vig" offset={0.28} darkness={outdoor ? 0.45 : 0.62} />)
  if (q.smaa) fx.push(<SMAA key="smaa" />)
  return (
    <EffectComposer key={quality + zone} multisampling={0} enableNormalPass={false}>
      {fx}
    </EffectComposer>
  )
}
