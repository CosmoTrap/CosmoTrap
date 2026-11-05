import { useFrame, useThree } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing'
import { BlendFunction, Effect, EffectComposer as Composer, ToneMappingMode } from 'postprocessing'
import { forwardRef, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { G, useGame } from '../game/state'
import { QUALITY } from './quality'
import { film } from './FilmScenes'

// Étalonnage « clair-obscur » : ombres froides, hautes lumières chaudes, contraste doux,
// grain de film, et effets d'état (O₂ bas : vignette rouge + flou ; soif : flou).

const gradeFrag = /* glsl */ `
uniform float uTime;
uniform float uWarm;
uniform float uRed;
uniform float uBlur;
uniform float uGrain;
uniform float uFade;
uniform float uBright;
uniform float uLens;
float rnd(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor){
  vec3 c = inputColor.rgb * uBright;
  // objectif de cinéma : bords de l'image légèrement flous pendant les plans
  float edge = smoothstep(0.28, 0.8, length((uv - 0.5) * vec2(1.25, 1.0)));
  float blurAmt = max(uBlur, uLens * edge);
  if (blurAmt > 0.001) {
    vec3 acc = vec3(0.0);
    float r = uBlur * 0.006 + uLens * edge * 0.0045;
    for (int i = 0; i < 8; i++) {
      float a = float(i) * 0.785;
      acc += texture2D(inputBuffer, uv + vec2(cos(a), sin(a)) * r).rgb;
    }
    c = mix(c, acc / 8.0 * uBright, min(1.0, blurAmt));
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
        ['uGrain', new THREE.Uniform(0.0015)],
        ['uFade', new THREE.Uniform(0)],
        ['uBright', new THREE.Uniform(1)],
        ['uLens', new THREE.Uniform(0)],
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
    u.get('uBright')!.value = s.settings.brightness ?? 1
    const lowO2 = s.zone < 4 && s.screen === 'playing' ? THREE.MathUtils.clamp(1 - s.res.o2 / 25, 0, 1) : 0
    const r = u.get('uRed')!
    r.value = THREE.MathUtils.lerp(r.value, lowO2 * 0.9, 0.05)
    const b = u.get('uBlur')!
    const breath = lowO2 > 0.6 ? (0.5 + 0.5 * Math.sin(clock.elapsedTime * 2.2)) * lowO2 : 0
    // Cinematic blur must disappear on the very first gameplay frame. Smoothing
    // the previous film value left the image blurred for seconds on slower GPUs.
    const filmic = s.cine === 'tour' || s.cine === 'heli' || s.cine === 'launch' || s.screen === 'prologue'
    b.value = Math.max(filmic ? film.blur : 0, breath * 0.8)
    // Preserve the subtle K12 grading alongside main's cinematic lens effects.
    u.get('uGrain')!.value = filmic ? 0.003 : 0.0015
    const l = u.get('uLens')!
    l.value = filmic ? THREE.MathUtils.lerp(l.value, 1, 0.05) : 0
  })
  return <primitive ref={ref} object={effect} dispose={null} />
})

export function Effects() {
  const composer = useRef<Composer>(null)
  const dpr = useThree((s) => s.viewport.dpr)
  const size = useThree((s) => s.size)
  const quality = useGame((s) => s.settings.quality)
  const zone = useGame((s) => s.zone)
  // This version of the React composer only observes CSS size. Its render
  // targets must also follow dynamic resolution and fixed-resolution changes.
  useEffect(() => { composer.current?.setSize(size.width, size.height) }, [dpr, size, quality, zone])
  const q = QUALITY[quality]
  const outdoor = zone === 4
  const ca = useMemo(() => new THREE.Vector2(0.00012, 0.00012), [])
  const fx: JSX.Element[] = []
  if (q.ao) fx.push(<N8AO key="ao" aoRadius={outdoor ? 1.2 : 0.45} intensity={outdoor ? 1.1 : 1.55} distanceFalloff={0.7} halfRes={q.ao === 'half'} quality={q.ao === 'full' ? 'high' : 'medium'} color="black" />)
  if (q.bloom) fx.push(<Bloom key="bloom" mipmapBlur intensity={outdoor ? 0.24 : 0.32} luminanceThreshold={1.25} luminanceSmoothing={0.4} radius={0.65} />)
  fx.push(<ToneMapping key="tm" mode={ToneMappingMode.ACES_FILMIC} />)
  fx.push(<Grade key="grade" />)
  fx.push(<ChromaticAberration key="ca" offset={ca} radialModulation modulationOffset={0.35} />)
  fx.push(<Vignette key="vig" offset={0.22} darkness={outdoor ? 0.28 : 0.38} />)
  if (q.smaa) fx.push(<SMAA key="smaa" />)
  return (
    <EffectComposer ref={composer} key={quality + zone} multisampling={0} enableNormalPass={false}>
      {fx}
    </EffectComposer>
  )
}
