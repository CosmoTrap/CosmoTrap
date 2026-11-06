// Bruitages synthétisés en Web Audio (repli tant que les fichiers ElevenLabs ne sont pas fournis).

export interface SynthCtx {
  ctx: AudioContext
  out: AudioNode // destination (bus sfx ou panner)
  noise: AudioBuffer
  brown: AudioBuffer
  riverGain?: GainNode
}

const r = (a: number, b: number) => a + Math.random() * (b - a)

function env(g: GainNode, t: number, a: number, peak: number, d: number, end = 0.0001) {
  g.gain.cancelScheduledValues(t)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + Math.max(a, 0.002))
  g.gain.exponentialRampToValueAtTime(end, t + a + d)
}

function osc(s: SynthCtx, type: OscillatorType, f: number, t: number, dur: number, peak: number, a = 0.005, dest: AudioNode = s.out) {
  const o = s.ctx.createOscillator()
  o.type = type
  o.frequency.setValueAtTime(f, t)
  const g = s.ctx.createGain()
  env(g, t, a, peak, dur)
  o.connect(g).connect(dest)
  o.start(t)
  o.stop(t + a + dur + 0.05)
  return { o, g }
}

function noise(s: SynthCtx, t: number, dur: number, peak: number, filter: BiquadFilterType, f: number, q = 1, a = 0.005, dest: AudioNode = s.out, brown = false) {
  const src = s.ctx.createBufferSource()
  src.buffer = brown ? s.brown : s.noise
  src.loop = true
  const bf = s.ctx.createBiquadFilter()
  bf.type = filter
  bf.frequency.setValueAtTime(f, t)
  bf.Q.value = q
  const g = s.ctx.createGain()
  env(g, t, a, peak, dur)
  src.connect(bf).connect(g).connect(dest)
  src.start(t, Math.random() * 1.5)
  src.stop(t + a + dur + 0.05)
  return { src, bf, g }
}

function chime(s: SynthCtx, t: number, f: number, peak = 0.18, dur = 1.2) {
  osc(s, 'sine', f, t, dur, peak, 0.004)
  osc(s, 'sine', f * 2.01, t, dur * 0.6, peak * 0.35, 0.004)
  osc(s, 'triangle', f * 3.98, t, dur * 0.3, peak * 0.12, 0.004)
}

function metalHit(s: SynthCtx, t: number, base: number, peak = 0.1, dur = 0.5) {
  for (const k of [1, 2.76, 5.4, 8.93]) osc(s, 'sine', base * k * r(0.98, 1.02), t, dur / (k * 0.6), peak / k, 0.001)
}

export type SfxName =
  | 'door_open'
  | 'door_locked'
  | 'pickup_o2'
  | 'pickup_battery'
  | 'pickup_water'
  | 'drink'
  | 'breathe_o2'
  | 'pickup_key'
  | 'pickup_bonus'
  | 'lamp_on'
  | 'lamp_off'
  | 'keypad'
  | 'success'
  | 'error'
  | 'valve'
  | 'power_up'
  | 'alarm_o2'
  | 'launch'
  | 'radio_tune'
  | 'helicopter'
  | 'steps_metal'
  | 'steps_grass'
  | 'airlock'
  | 'page'
  | 'tablet_open'
  | 'tablet_close'
  | 'flare'
  | 'faint'
  | 'holo'
  | 'rope'
  | 'click'
  | 'gasp'
  | 'tick'
  | 'impact'

export const SFX: Record<SfxName, (s: SynthCtx, t: number) => number> = {
  door_open(s, t) {
    // servo + sifflement pneumatique + choc final
    const { bf } = noise(s, t, 1.1, 0.22, 'bandpass', 3200, 0.8, 0.03)
    bf.frequency.exponentialRampToValueAtTime(700, t + 1.1)
    const o = s.ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(70, t)
    o.frequency.linearRampToValueAtTime(130, t + 0.6)
    o.frequency.linearRampToValueAtTime(90, t + 1.1)
    const lp = s.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 380
    const g = s.ctx.createGain()
    env(g, t, 0.08, 0.12, 1.0)
    o.connect(lp).connect(g).connect(s.out)
    o.start(t)
    o.stop(t + 1.3)
    osc(s, 'sine', 58, t + 1.05, 0.35, 0.35, 0.002)
    noise(s, t + 1.05, 0.12, 0.25, 'lowpass', 900, 1, 0.001)
    metalHit(s, t + 1.05, 180, 0.05, 0.4)
    return 1.6
  },
  door_locked(s, t) {
    osc(s, 'square', 196, t, 0.14, 0.07)
    osc(s, 'square', 147, t + 0.2, 0.22, 0.07)
    return 0.5
  },
  pickup_o2(s, t) {
    noise(s, t, 0.35, 0.16, 'highpass', 4000, 0.7, 0.01)
    const { o } = osc(s, 'sine', 660, t + 0.18, 0.6, 0.14, 0.01)
    o.frequency.exponentialRampToValueAtTime(1320, t + 0.5)
    chime(s, t + 0.45, 1320, 0.07, 0.6)
    return 1.1
  },
  pickup_battery(s, t) {
    noise(s, t, 0.03, 0.4, 'highpass', 3000, 1, 0.001)
    noise(s, t + 0.08, 0.03, 0.4, 'highpass', 3000, 1, 0.001)
    const { o } = osc(s, 'sawtooth', 220, t + 0.12, 0.25, 0.06, 0.002)
    o.frequency.exponentialRampToValueAtTime(1760, t + 0.35)
    osc(s, 'sine', 880, t + 0.3, 0.5, 0.1)
    osc(s, 'sine', 1320, t + 0.42, 0.5, 0.08)
    return 1
  },
  pickup_water(s, t) {
    for (let i = 0; i < 4; i++) {
      const { bf } = noise(s, t + i * 0.09, 0.14, 0.12, 'bandpass', r(500, 900), 4, 0.02)
      bf.frequency.exponentialRampToValueAtTime(r(250, 400), t + i * 0.09 + 0.14)
    }
    return 0.6
  },
  drink(s, t) {
    for (let i = 0; i < 3; i++) {
      const tt = t + 0.15 + i * 0.42
      const { o } = osc(s, 'sine', 140, tt, 0.16, 0.28, 0.01)
      o.frequency.exponentialRampToValueAtTime(70, tt + 0.16)
      noise(s, tt, 0.12, 0.08, 'bandpass', 600, 3, 0.01)
    }
    const { bf } = noise(s, t + 1.45, 0.6, 0.12, 'bandpass', 1400, 0.7, 0.1)
    bf.frequency.exponentialRampToValueAtTime(600, t + 2.0)
    return 2.1
  },
  breathe_o2(s, t) {
    noise(s, t, 0.4, 0.2, 'highpass', 3500, 0.7, 0.01)
    const { bf } = noise(s, t + 0.45, 1.1, 0.16, 'bandpass', 700, 1.2, 0.5)
    bf.frequency.linearRampToValueAtTime(1100, t + 1.2)
    noise(s, t + 1.7, 0.9, 0.1, 'bandpass', 500, 1, 0.1)
    return 2.6
  },
  pickup_key(s, t) {
    const notes = [784, 988, 1175, 1568, 1976]
    notes.forEach((f, i) => chime(s, t + i * 0.07, f, 0.09, 1.4))
    noise(s, t + 0.1, 1.0, 0.03, 'highpass', 7000, 0.5, 0.3)
    return 1.8
  },
  pickup_bonus(s, t) {
    metalHit(s, t, 1800, 0.08, 0.7)
    chime(s, t + 0.05, 2349, 0.06, 0.6)
    return 0.8
  },
  lamp_on(s, t) {
    noise(s, t, 0.02, 0.45, 'highpass', 2500, 1, 0.001)
    osc(s, 'sine', 3400, t + 0.01, 0.03, 0.05, 0.001)
    osc(s, 'sawtooth', 120, t + 0.02, 0.25, 0.015, 0.02)
    return 0.4
  },
  lamp_off(s, t) {
    noise(s, t, 0.02, 0.35, 'highpass', 2000, 1, 0.001)
    osc(s, 'sine', 2600, t + 0.01, 0.03, 0.04, 0.001)
    return 0.2
  },
  keypad(s, t) {
    osc(s, 'sine', 1250, t, 0.07, 0.12, 0.002)
    osc(s, 'square', 2500, t, 0.02, 0.01, 0.001)
    return 0.15
  },
  success(s, t) {
    chime(s, t, 880, 0.14, 0.7)
    chime(s, t + 0.12, 1318, 0.14, 1.1)
    chime(s, t + 0.24, 1760, 0.08, 1.2)
    return 1.4
  },
  error(s, t) {
    const lp = s.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 900
    lp.connect(s.out)
    osc(s, 'sawtooth', 110, t, 0.18, 0.12, 0.004, lp)
    osc(s, 'sawtooth', 116, t, 0.18, 0.12, 0.004, lp)
    osc(s, 'sawtooth', 110, t + 0.24, 0.3, 0.12, 0.004, lp)
    osc(s, 'sawtooth', 104, t + 0.24, 0.3, 0.12, 0.004, lp)
    return 0.6
  },
  valve(s, t) {
    // volant de vanne métallique + détente de pression
    for (let i = 0; i < 3; i++) {
      const tt = t + i * 0.22
      const o = s.ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.setValueAtTime(r(380, 460), tt)
      o.frequency.linearRampToValueAtTime(r(300, 340), tt + 0.18)
      const bp = s.ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1400
      bp.Q.value = 6
      const g = s.ctx.createGain()
      env(g, tt, 0.02, 0.05, 0.16)
      o.connect(bp).connect(g).connect(s.out)
      o.start(tt)
      o.stop(tt + 0.25)
      metalHit(s, tt, 240, 0.03, 0.3)
    }
    const { bf } = noise(s, t + 0.6, 0.8, 0.2, 'highpass', 2500, 0.6, 0.02)
    bf.frequency.exponentialRampToValueAtTime(6000, t + 1.4)
    return 1.5
  },
  power_up(s, t) {
    const o = s.ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(30, t)
    o.frequency.exponentialRampToValueAtTime(120, t + 2.4)
    const lp = s.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(200, t)
    lp.frequency.exponentialRampToValueAtTime(1600, t + 2.4)
    const g = s.ctx.createGain()
    env(g, t, 1.6, 0.16, 1.4)
    o.connect(lp).connect(g).connect(s.out)
    o.start(t)
    o.stop(t + 3.2)
    for (let i = 0; i < 5; i++) {
      noise(s, t + 0.5 + i * 0.35 + r(0, 0.1), 0.02, 0.35, 'highpass', 2000, 1, 0.001)
      metalHit(s, t + 0.5 + i * 0.35, 900, 0.02, 0.1)
    }
    osc(s, 'sine', 120, t + 2.3, 0.8, 0.05, 0.1)
    osc(s, 'sine', 240, t + 2.3, 0.8, 0.03, 0.1)
    return 3.2
  },
  alarm_o2(s, t) {
    osc(s, 'square', 880, t, 0.16, 0.035, 0.005)
    osc(s, 'square', 660, t + 0.2, 0.2, 0.035, 0.005)
    return 0.45
  },
  launch(s, t) {
    const { bf, g } = noise(s, t, 6.5, 0.9, 'lowpass', 120, 0.7, 1.5, s.out, true)
    bf.frequency.exponentialRampToValueAtTime(900, t + 4)
    g.gain.setValueAtTime(0.9, t + 5.5)
    osc(s, 'sine', 32, t, 6.5, 0.5, 1.2)
    osc(s, 'sine', 45, t + 0.4, 6, 0.3, 1)
    for (let i = 0; i < 26; i++) metalHit(s, t + 0.8 + i * 0.2 + r(0, 0.1), r(300, 900), 0.025, 0.12)
    return 7
  },
  radio_tune(s, t) {
    const { bf } = noise(s, t, 0.4, 0.09, 'bandpass', r(1200, 2400), 2, 0.01)
    bf.frequency.linearRampToValueAtTime(r(800, 3000), t + 0.4)
    osc(s, 'sine', r(500, 1500), t, 0.12, 0.02)
    return 0.45
  },
  helicopter(s, t) {
    // battement de rotor qui grandit
    const dur = 6
    const src = s.ctx.createBufferSource()
    src.buffer = s.noise
    src.loop = true
    const lp = s.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 500
    const am = s.ctx.createGain()
    am.gain.value = 0
    const lfo = s.ctx.createOscillator()
    lfo.frequency.value = 17
    const lfoG = s.ctx.createGain()
    lfoG.gain.value = 0.5
    lfo.connect(lfoG).connect(am.gain)
    const g = s.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.9, t + dur - 0.5)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 1)
    src.connect(lp).connect(am).connect(g).connect(s.out)
    src.start(t)
    lfo.start(t)
    src.stop(t + dur + 1.1)
    lfo.stop(t + dur + 1.1)
    const turb = osc(s, 'sawtooth', 340, t, dur, 0.02, dur * 0.8)
    turb.o.frequency.linearRampToValueAtTime(380, t + dur)
    return dur
  },
  steps_metal(s, t) {
    noise(s, t, 0.05, 0.16, 'bandpass', r(2200, 3400), 1.5, 0.002)
    noise(s, t, 0.08, 0.18, 'lowpass', 300, 1, 0.002)
    metalHit(s, t, r(400, 520), 0.012, 0.18)
    return 0.2
  },
  steps_grass(s, t) {
    noise(s, t, 0.12, 0.09, 'bandpass', r(1800, 3000), 0.8, 0.01)
    noise(s, t, 0.08, 0.1, 'lowpass', 400, 1, 0.005)
    return 0.2
  },
  airlock(s, t) {
    noise(s, t, 1.6, 0.3, 'bandpass', 1500, 0.6, 0.2)
    osc(s, 'sine', 50, t + 1.4, 0.5, 0.4, 0.004)
    metalHit(s, t + 1.4, 140, 0.06, 0.6)
    return 2
  },
  page(s, t) {
    noise(s, t, 0.12, 0.05, 'highpass', 3000, 0.5, 0.02)
    return 0.2
  },
  tablet_open(s, t) {
    osc(s, 'sine', 660, t, 0.08, 0.05)
    osc(s, 'sine', 990, t + 0.07, 0.15, 0.05)
    noise(s, t, 0.1, 0.03, 'highpass', 5000, 0.5, 0.03)
    return 0.3
  },
  tablet_close(s, t) {
    osc(s, 'sine', 990, t, 0.08, 0.04)
    osc(s, 'sine', 660, t + 0.07, 0.12, 0.04)
    return 0.25
  },
  flare(s, t) {
    noise(s, t, 0.15, 0.8, 'lowpass', 1800, 1, 0.001)
    osc(s, 'sine', 70, t, 0.3, 0.6, 0.001)
    const { bf } = noise(s, t + 0.05, 2.5, 0.25, 'bandpass', 2500, 1.5, 0.02)
    bf.frequency.exponentialRampToValueAtTime(600, t + 2.5)
    return 2.7
  },
  faint(s, t) {
    const o = osc(s, 'sine', 300, t, 2.5, 0.12, 0.3)
    o.o.frequency.exponentialRampToValueAtTime(60, t + 2.5)
    noise(s, t, 2.5, 0.08, 'lowpass', 300, 1, 1)
    return 2.8
  },
  holo(s, t) {
    const o = osc(s, 'sine', 200, t, 0.8, 0.06, 0.2)
    o.o.frequency.exponentialRampToValueAtTime(800, t + 0.8)
    noise(s, t, 0.8, 0.03, 'bandpass', 4000, 3, 0.3)
    return 1
  },
  rope(s, t) {
    for (let i = 0; i < 5; i++) noise(s, t + i * 0.18, 0.15, 0.1, 'bandpass', r(900, 1500), 2, 0.03)
    osc(s, 'sine', 90, t + 1, 0.2, 0.2)
    return 1.3
  },
  click(s, t) {
    noise(s, t, 0.015, 0.3, 'highpass', 3000, 1, 0.001)
    return 0.05
  },
  tick(s, t) {
    noise(s, t, 0.02, 0.25, 'bandpass', 3800, 6, 0.001)
    osc(s, 'sine', 1900, t, 0.03, 0.05, 0.001)
    return 0.05
  },
  impact(s, t) {
    // choc sourd + grondement + débris métalliques
    const o = osc(s, 'sine', 70, t, 2.2, 0.5, 0.004)
    o.o.frequency.exponentialRampToValueAtTime(28, t + 2)
    noise(s, t, 3.5, 0.45, 'lowpass', 500, 0.8, 0.005, s.out, true)
    noise(s, t, 1.2, 0.18, 'bandpass', 2400, 1.2, 0.002)
    for (let i = 0; i < 6; i++) osc(s, 'triangle', 900 + Math.random() * 1600, t + 0.3 + Math.random() * 1.4, 0.25, 0.025, 0.001)
    return 3.6
  },
  gasp(s, t) {
    const { bf } = noise(s, t, 0.5, 0.2, 'bandpass', 900, 1.5, 0.08)
    bf.frequency.linearRampToValueAtTime(1600, t + 0.5)
    noise(s, t + 0.7, 0.8, 0.1, 'bandpass', 600, 1, 0.1)
    return 1.5
  },
}

/** boucles continues : renvoie les noeuds à arrêter */
/** fréquence cardiaque du joueur (battements / min) */
export const heart = { bpm: 62 }

export type LoopName = 'steam' | 'heartbeat' | 'amb_station' | 'amb_wind' | 'reentry' | 'rotor' | 'static' | 'siren'

export function startLoop(s: SynthCtx, name: LoopName): { stop: () => void; out: GainNode } {
  const ctx = s.ctx
  const out = ctx.createGain()
  out.gain.value = 0
  out.connect(s.out)
  out.gain.linearRampToValueAtTime(1, ctx.currentTime + 1)
  const nodes: (AudioScheduledSourceNode)[] = []
  let timer: number | null = null
  let stopExtra: (() => void) | null = null
  const nsrc = (brown = false) => {
    const n = ctx.createBufferSource()
    n.buffer = brown ? s.brown : s.noise
    n.loop = true
    n.start(0, Math.random())
    nodes.push(n)
    return n
  }
  const filt = (type: BiquadFilterType, f: number, q = 1) => {
    const b = ctx.createBiquadFilter()
    b.type = type
    b.frequency.value = f
    b.Q.value = q
    return b
  }
  const gain = (v: number) => {
    const g = ctx.createGain()
    g.gain.value = v
    return g
  }
  const lfo = (f: number, depth: number, target: AudioParam) => {
    const o = ctx.createOscillator()
    o.frequency.value = f
    const g = gain(depth)
    o.connect(g).connect(target)
    o.start()
    nodes.push(o)
  }

  if (name === 'steam') {
    const n = nsrc()
    const hp = filt('highpass', 2200, 0.5)
    const g = gain(0.35)
    n.connect(hp).connect(g).connect(out)
    lfo(0.7, 0.07, g.gain)
    const n2 = nsrc()
    const bp = filt('bandpass', 900, 0.8)
    n2.connect(bp).connect(gain(0.15)).connect(out)
  } else if (name === 'heartbeat') {
    let alive = true
    const beat = () => {
      const t = ctx.currentTime + 0.05
      const s2 = { ...s, out }
      const a = osc(s2, 'sine', 62, t, 0.16, 0.6, 0.008)
      a.o.frequency.exponentialRampToValueAtTime(38, t + 0.16)
      const b = osc(s2, 'sine', 55, t + 0.28, 0.2, 0.45, 0.008)
      b.o.frequency.exponentialRampToValueAtTime(34, t + 0.48)
    }
    // le cœur accélère avec heart.bpm (piloté par l'oxygène)
    const loop = () => {
      if (!alive) return
      beat()
      timer = window.setTimeout(loop, 60000 / heart.bpm) as unknown as number
    }
    loop()
    stopExtra = () => (alive = false)
  } else if (name === 'amb_station') {
    const n = nsrc(true)
    n.connect(filt('lowpass', 260, 0.7)).connect(gain(0.28)).connect(out)
    const hum = ctx.createOscillator()
    hum.frequency.value = 60
    hum.connect(gain(0.012)).connect(out)
    hum.start()
    nodes.push(hum)
    const hum2 = ctx.createOscillator()
    hum2.frequency.value = 120.4
    hum2.connect(gain(0.006)).connect(out)
    hum2.start()
    nodes.push(hum2)
    const fan = nsrc()
    const bp = filt('bandpass', 1100, 0.6)
    const fg = gain(0.035)
    fan.connect(bp).connect(fg).connect(out)
    lfo(0.13, 0.012, fg.gain)
    timer = window.setInterval(() => {
      if (Math.random() < 0.35) {
        const t = ctx.currentTime + 0.05
        const s2 = { ...s, out }
        metalHit(s2, t, r(90, 200), 0.03, r(0.6, 1.4))
        const c = osc(s2, 'sawtooth', r(40, 70), t, r(0.4, 1), 0.02, 0.2)
        c.o.frequency.linearRampToValueAtTime(r(30, 90), t + 0.8)
      }
    }, 2600)
  } else if (name === 'amb_wind') {
    const n = nsrc(true)
    const bp = filt('bandpass', 500, 0.5)
    const g = gain(0.25)
    n.connect(bp).connect(g).connect(out)
    lfo(0.08, 250, bp.frequency)
    lfo(0.11, 0.12, g.gain)
    const river = nsrc()
    const rbp = filt('bandpass', 1800, 0.4)
    const rg = gain(0.05)
    river.connect(rbp).connect(rg).connect(out)
    s.riverGain = rg
    timer = window.setInterval(() => {
      if (Math.random() < 0.55) {
        const s2 = { ...s, out }
        const t = ctx.currentTime + 0.05
        const base = r(2200, 4200)
        const count = 2 + Math.floor(Math.random() * 4)
        for (let i = 0; i < count; i++) {
          const tt = t + i * r(0.09, 0.16)
          const b = osc(s2, 'sine', base, tt, r(0.05, 0.11), 0.025, 0.005)
          b.o.frequency.exponentialRampToValueAtTime(base * r(1.15, 1.5), tt + 0.06)
        }
      }
    }, 1400)
  } else if (name === 'reentry') {
    const n = nsrc(true)
    const lp = filt('lowpass', 500, 0.8)
    n.connect(lp).connect(gain(1.0)).connect(out)
    lfo(3.2, 200, lp.frequency)
    const n2 = nsrc()
    n2.connect(filt('bandpass', 1500, 0.6)).connect(gain(0.25)).connect(out)
  } else if (name === 'rotor') {
    const n = nsrc()
    const lp = filt('lowpass', 450, 0.8)
    const am = gain(0.3)
    n.connect(lp).connect(am).connect(out)
    lfo(17, 0.3, am.gain)
  } else if (name === 'siren') {
    // French two-tone emergency sirens, several vehicles slightly out of step, softened by distance.
    const lp = filt('lowpass', 1800, 0.7)
    lp.connect(gain(0.18)).connect(out)
    const oscs = [0, 1].map((i) => {
      const o = ctx.createOscillator()
      o.type = 'square'
      o.frequency.value = 435
      o.connect(gain(i ? 0.35 : 0.5)).connect(lp)
      o.start()
      nodes.push(o)
      return o
    })
    let hi = false
    timer = window.setInterval(() => {
      hi = !hi
      oscs[0].frequency.setTargetAtTime(hi ? 580 : 435, ctx.currentTime, 0.02)
      oscs[1].frequency.setTargetAtTime(hi ? 435 * 1.04 : 580 * 1.04, ctx.currentTime, 0.02)
    }, 560)
  } else if (name === 'static') {
    const n = nsrc()
    n.connect(filt('bandpass', 2000, 0.5)).connect(gain(0.15)).connect(out)
  }

  return {
    out,
    stop: () => {
      const t = ctx.currentTime
      out.gain.cancelScheduledValues(t)
      out.gain.setValueAtTime(out.gain.value, t)
      out.gain.linearRampToValueAtTime(0, t + 0.8)
      if (timer) {
        clearInterval(timer)
        clearTimeout(timer)
      }
      stopExtra?.()
      setTimeout(() => {
        nodes.forEach((n) => {
          try {
            n.stop()
          } catch {
            /* déjà arrêté */
          }
        })
        out.disconnect()
      }, 1000)
    },
  }
}

export function makeNoise(ctx: AudioContext, brown = false) {
  const len = ctx.sampleRate * 2
  const b = ctx.createBuffer(1, len, ctx.sampleRate)
  const d = b.getChannelData(0)
  let last = 0
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1
    if (brown) {
      last = (last + 0.02 * w) / 1.02
      d[i] = last * 3.5
    } else d[i] = w
  }
  return b
}

export function makeImpulse(ctx: AudioContext, seconds: number, decay: number) {
  const len = Math.floor(ctx.sampleRate * seconds)
  const b = ctx.createBuffer(2, len, ctx.sampleRate)
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay)
  }
  return b
}
