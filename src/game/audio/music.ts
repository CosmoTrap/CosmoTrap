// Musique adaptative générative (repli tant que les pistes Suno ne sont pas fournies).
// Deux couches par thème : calme et tension, fondues en crossfade.

export type ThemeId = 'orion' | 'machinerie' | 'hermes' | 'terre' | 'title'

interface Theme {
  bpm: number
  root: number // fréquence de la tonique (Hz)
  scale: number[] // demi-tons
  chords: number[][] // degrés (demi-tons depuis la tonique)
  bars: number // mesures par accord
  bells: number // probabilité par temps
  arp?: boolean
  pluck?: boolean
  sub?: boolean
  padCut: number
}

const THEMES: Record<ThemeId, Theme> = {
  // D dorien, 66 BPM
  orion: { bpm: 66, root: 146.83, scale: [0, 2, 3, 5, 7, 9, 10], chords: [[0, 7, 15, 21], [-2, 5, 14, 17], [3, 10, 15, 22], [-4, 3, 10, 14]], bars: 2, bells: 0.28, padCut: 1100 },
  title: { bpm: 60, root: 146.83, scale: [0, 2, 3, 5, 7, 9, 10], chords: [[0, 7, 14, 21], [-4, 3, 10, 17], [-2, 5, 12, 19], [-5, 2, 9, 14]], bars: 2, bells: 0.22, padCut: 1300 },
  // C mineur, 72 BPM
  machinerie: { bpm: 72, root: 130.81, scale: [0, 2, 3, 5, 7, 8, 10], chords: [[0, 7, 15], [-4, 3, 12], [-2, 5, 14], [-5, 2, 10]], bars: 2, bells: 0.08, sub: true, padCut: 700 },
  // E lydien, 96 BPM
  hermes: { bpm: 96, root: 164.81, scale: [0, 2, 4, 6, 7, 9, 11], chords: [[0, 7, 16, 23], [2, 9, 18, 21], [-3, 4, 11, 16], [-1, 6, 14, 18]], bars: 2, bells: 0.1, arp: true, padCut: 1600 },
  // G majeur, 84 BPM
  terre: { bpm: 84, root: 196.0, scale: [0, 2, 4, 5, 7, 9, 11], chords: [[0, 7, 16], [-3, 4, 12], [-7, 0, 9], [-5, 2, 11]], bars: 2, bells: 0.0, pluck: true, padCut: 1800 },
}

const st = (root: number, semi: number) => root * Math.pow(2, semi / 12)

export class GenerativeMusic {
  private ctx: AudioContext
  private out: GainNode
  calm: GainNode
  tension: GainNode
  private delay: DelayNode
  private theme: Theme | null = null
  private themeId: ThemeId | null = null
  private timer: number | null = null
  private nextBeat = 0
  private beat = 0
  private drone: { stop: () => void } | null = null
  tensionLevel = 0
  /** multiplicateur de tempo (accélère avec la tension) */
  rate = 1
  private targetRate = 1

  constructor(ctx: AudioContext, dest: AudioNode) {
    this.ctx = ctx
    this.out = ctx.createGain()
    this.out.gain.value = 1
    this.out.connect(dest)
    this.calm = ctx.createGain()
    this.tension = ctx.createGain()
    this.tension.gain.value = 0
    this.calm.connect(this.out)
    this.tension.connect(this.out)
    // écho stéréo pour l'espace
    this.delay = ctx.createDelay(2)
    this.delay.delayTime.value = 0.42
    const fb = ctx.createGain()
    fb.gain.value = 0.38
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 2400
    this.delay.connect(lp).connect(fb).connect(this.delay)
    lp.connect(this.calm)
  }

  play(id: ThemeId | null) {
    if (id === this.themeId) return
    this.stop()
    this.themeId = id
    if (!id) return
    this.theme = THEMES[id]
    this.beat = 0
    this.nextBeat = this.ctx.currentTime + 0.2
    this.drone = this.startDrone()
    this.timer = window.setInterval(() => this.schedule(), 100)
    this.out.gain.cancelScheduledValues(this.ctx.currentTime)
    this.out.gain.setValueAtTime(0.0001, this.ctx.currentTime)
    this.out.gain.exponentialRampToValueAtTime(1, this.ctx.currentTime + 3)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.drone?.stop()
    this.drone = null
    this.themeId = null
  }

  /** v : tension (0..1) ; urgency : chrono presque écoulé (0..1) */
  setTension(v: number, urgency = 0) {
    this.targetRate = 1 + 0.55 * Math.max(v, urgency * 0.8)
    v = Math.max(v, urgency * 0.7)
    this.tensionLevel = v
    const t = this.ctx.currentTime
    this.calm.gain.setTargetAtTime(1 - v * 0.75, t, 0.8)
    this.tension.gain.setTargetAtTime(v, t, 0.8)
  }

  private schedule() {
    const th = this.theme
    if (!th) return
    this.rate += (this.targetRate - this.rate) * 0.08
    const spb = 60 / (th.bpm * this.rate)
    while (this.nextBeat < this.ctx.currentTime + 0.3) {
      const t = this.nextBeat
      const beatsPerChord = th.bars * 4
      if (this.beat % beatsPerChord === 0) {
        const chord = th.chords[Math.floor(this.beat / beatsPerChord) % th.chords.length]
        this.pad(t, chord, beatsPerChord * spb)
      }
      if (Math.random() < th.bells) this.bell(t + (Math.random() < 0.5 ? 0 : spb / 2))
      if (th.arp) for (let k = 0; k < 4; k++) this.arp(t + (k * spb) / 4, k)
      if (th.pluck && this.beat % 2 === 0) this.pluck(t)
      if (th.sub && this.beat % 2 === 0) this.subPulse(t)
      // couche tension : pulsation et chocs métalliques
      if (this.beat % 4 === 0) this.tensionHit(t)
      if (this.tensionLevel > 0.5) this.pulse(t, this.beat % 2 === 0)
      this.nextBeat += spb
      this.beat++
    }
  }

  private pad(t: number, chord: number[], dur: number) {
    const th = this.theme!
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(th.padCut * 0.6, t)
    lp.frequency.linearRampToValueAtTime(th.padCut, t + dur * 0.5)
    lp.frequency.linearRampToValueAtTime(th.padCut * 0.6, t + dur)
    lp.Q.value = 0.5
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.05, t + 2.2)
    g.gain.setValueAtTime(0.05, t + dur - 0.5)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 2.5)
    lp.connect(g).connect(this.calm)
    g.connect(this.delay)
    for (const semi of chord) {
      for (const det of [-6, 5]) {
        const o = this.ctx.createOscillator()
        o.type = th.pluck ? 'triangle' : 'sawtooth'
        o.frequency.value = st(th.root, semi - 12)
        o.detune.value = det
        o.connect(lp)
        o.start(t)
        o.stop(t + dur + 2.6)
      }
    }
  }

  private bell(t: number) {
    const th = this.theme!
    const deg = th.scale[Math.floor(Math.random() * th.scale.length)]
    const f = st(th.root, deg + 24 + (Math.random() < 0.3 ? 12 : 0))
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.045, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6)
    g.connect(this.calm)
    g.connect(this.delay)
    for (const [k, a] of [
      [1, 1],
      [2.0, 0.3],
      [3.01, 0.12],
    ]) {
      const o = this.ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f * k
      const og = this.ctx.createGain()
      og.gain.value = a
      o.connect(og).connect(g)
      o.start(t)
      o.stop(t + 2.7)
    }
  }

  private arp(t: number, k: number) {
    const th = this.theme!
    const chord = th.chords[Math.floor(this.beat / (th.bars * 4)) % th.chords.length]
    const semi = chord[(k + this.beat) % chord.length] + 12
    const o = this.ctx.createOscillator()
    o.type = 'square'
    o.frequency.value = st(th.root, semi)
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(2200, t)
    lp.frequency.exponentialRampToValueAtTime(400, t + 0.2)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.018, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.24)
    o.connect(lp).connect(g).connect(this.calm)
    g.connect(this.delay)
    o.start(t)
    o.stop(t + 0.3)
  }

  private pluck(t: number) {
    // harmoniques de guitare / piano doux
    const th = this.theme!
    const chord = th.chords[Math.floor(this.beat / (th.bars * 4)) % th.chords.length]
    const semi = chord[Math.floor(Math.random() * chord.length)] + 12
    const f = st(th.root, semi)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.05, t + 0.006)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.2)
    g.connect(this.calm)
    g.connect(this.delay)
    for (const [k, a] of [
      [1, 1],
      [2, 0.45],
      [3, 0.18],
      [4, 0.08],
    ]) {
      const o = this.ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f * k
      const og = this.ctx.createGain()
      og.gain.value = a
      o.connect(og).connect(g)
      o.start(t)
      o.stop(t + 2.3)
    }
  }

  private subPulse(t: number) {
    const o = this.ctx.createOscillator()
    o.frequency.setValueAtTime(52, t)
    o.frequency.exponentialRampToValueAtTime(38, t + 0.4)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.02)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5)
    o.connect(g).connect(this.calm)
    o.start(t)
    o.stop(t + 0.6)
  }

  private tensionHit(t: number) {
    if (Math.random() < 0.5) return
    const base = 110 + Math.random() * 120
    for (const k of [1, 2.76, 5.4]) {
      const o = this.ctx.createOscillator()
      o.frequency.value = base * k
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.03 / k, t + 0.002)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2 / k)
      o.connect(g).connect(this.tension)
      o.start(t)
      o.stop(t + 1.3)
    }
  }

  /** basse pulsée qui suit le tempo quand la tension monte */
  private pulse(t: number, accent: boolean) {
    const th = this.theme!
    const o = this.ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = st(th.root, -24)
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.setValueAtTime(accent ? 600 : 380, t)
    lp.frequency.exponentialRampToValueAtTime(90, t + 0.25)
    const g = this.ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(accent ? 0.12 : 0.07, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
    o.connect(lp).connect(g).connect(this.tension)
    o.start(t)
    o.stop(t + 0.35)
  }

  /** courts motifs musicaux sur les événements */
  sting(kind: 'solved' | 'discover' | 'danger') {
    const t = this.ctx.currentTime + 0.02
    const root = this.theme?.root ?? 146.83
    const notes = kind === 'solved' ? [0, 7, 12, 16, 19, 24] : kind === 'discover' ? [0, 5, 12] : [0, 1, -11]
    notes.forEach((n, i) => {
      const tt = t + i * (kind === 'danger' ? 0.18 : 0.09)
      const o = this.ctx.createOscillator()
      o.type = kind === 'danger' ? 'sawtooth' : 'triangle'
      o.frequency.value = st(root, n + (kind === 'danger' ? 0 : 12))
      const lp = this.ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = kind === 'danger' ? 700 : 3200
      const g = this.ctx.createGain()
      g.gain.setValueAtTime(0.0001, tt)
      g.gain.exponentialRampToValueAtTime(kind === 'danger' ? 0.09 : 0.07, tt + 0.01)
      g.gain.exponentialRampToValueAtTime(0.0001, tt + (kind === 'solved' ? 1.6 : 0.9))
      o.connect(lp).connect(g).connect(this.out)
      g.connect(this.delay)
      o.start(tt)
      o.stop(tt + 1.8)
    })
  }

  private startDrone() {
    const th = this.theme!
    const nodes: OscillatorNode[] = []
    const lp = this.ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 240
    const g = this.ctx.createGain()
    g.gain.value = 0.09
    lp.connect(g).connect(this.tension)
    for (const det of [-9, 0, 8]) {
      const o = this.ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = st(th.root, -24)
      o.detune.value = det
      o.connect(lp)
      o.start()
      nodes.push(o)
    }
    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lg = this.ctx.createGain()
    lg.gain.value = 120
    lfo.connect(lg).connect(lp.frequency)
    lfo.start()
    nodes.push(lfo)
    return { stop: () => nodes.forEach((n) => n.stop(this.ctx.currentTime + 0.5)) }
  }

  /** morceau unique (décollage, victoire) */
  oneShot(kind: 'launch' | 'victory') {
    const t0 = this.ctx.currentTime + 0.1
    const dest = this.out
    const chords =
      kind === 'launch'
        ? [
            [0, 7, 12, 16],
            [-3, 4, 9, 12],
            [-7, 0, 5, 9],
            [-5, 2, 7, 14],
            [0, 7, 12, 16, 19],
          ]
        : [
            [0, 7, 16, 19],
            [-3, 4, 12, 16],
            [-7, 5, 9, 12],
            [-5, 2, 11, 14],
            [0, 7, 12, 16, 24],
          ]
    const root = kind === 'launch' ? 164.81 : 196
    const len = kind === 'launch' ? 4 : 3.2
    chords.forEach((ch, i) => {
      const t = t0 + i * len
      const lp = this.ctx.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.setValueAtTime(500, t)
      lp.frequency.linearRampToValueAtTime(800 + i * 700, t + len)
      const g = this.ctx.createGain()
      const peak = 0.03 + i * 0.012
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(peak, t + len * 0.4)
      g.gain.exponentialRampToValueAtTime(0.0001, t + len + (i === chords.length - 1 ? 6 : 1.2))
      lp.connect(g).connect(dest)
      g.connect(this.delay)
      for (const semi of ch)
        for (const det of [-8, 0, 7]) {
          const o = this.ctx.createOscillator()
          o.type = 'sawtooth'
          o.frequency.value = st(root, semi - 12)
          o.detune.value = det
          o.connect(lp)
          o.start(t)
          o.stop(t + len + 6.5)
        }
    })
  }
}
