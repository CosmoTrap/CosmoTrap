import { Howl, Howler } from 'howler'
import { GenerativeMusic, type ThemeId } from './music'
import { SFX, heart, makeImpulse, makeNoise, startLoop, type LoopName, type SfxName, type SynthCtx } from './synth'

// Gestionnaire audio : fichiers (howler, .ogg + .m4a) si présents dans public/audio/manifest.json,
// sinon synthèse Web Audio. Ducking de la musique, réverbération intérieure, passe-bas à O₂ < 10 %.

const DUCKED: SfxName[] = ['door_open', 'pickup_key', 'power_up', 'success', 'launch', 'valve', 'breathe_o2', 'airlock', 'flare']

const FILE_OF: Partial<Record<SfxName | LoopName, string>> = {
  door_open: 'sfx_door_open',
  door_locked: 'sfx_door_locked',
  pickup_o2: 'sfx_pickup_o2',
  pickup_battery: 'sfx_pickup_battery',
  pickup_water: 'sfx_pickup_water',
  drink: 'sfx_drink',
  breathe_o2: 'sfx_breathe_o2',
  pickup_key: 'sfx_pickup_key',
  pickup_bonus: 'sfx_pickup_bonus',
  lamp_on: 'sfx_lamp_on',
  lamp_off: 'sfx_lamp_off',
  keypad: 'sfx_keypad',
  success: 'sfx_success',
  error: 'sfx_error',
  valve: 'sfx_valve',
  power_up: 'sfx_power_up',
  alarm_o2: 'sfx_alarm_o2',
  launch: 'sfx_launch',
  radio_tune: 'sfx_radio_tune',
  helicopter: 'sfx_helicopter',
  steam: 'sfx_steam_loop',
  heartbeat: 'sfx_heartbeat_loop',
  amb_station: 'amb_station_loop',
  amb_wind: 'amb_wind_birds_loop',
}

const MUSIC_FILES: Record<ThemeId, [string, string?]> = {
  title: ['music_orion_calm'],
  orion: ['music_orion_calm', 'music_orion_tension'],
  machinerie: ['music_machinerie', 'music_orion_tension'],
  hermes: ['music_hermes'],
  terre: ['music_terre'],
}

class AudioManager {
  ctx: AudioContext | null = null
  private master!: GainNode
  private muffle!: BiquadFilterNode
  private sfxBus!: GainNode
  private musicBus!: GainNode
  private musicDuck!: GainNode
  private voiceBus!: GainNode
  private reverb!: ConvolverNode
  private reverbSend!: GainNode
  private synth!: SynthCtx
  private music!: GenerativeMusic
  private files = new Set<string>()
  private howls = new Map<string, Howl>()
  private musicHowls: { calm?: Howl; tension?: Howl } = {}
  private vols = { music: 0.7, sfx: 0.85, voice: 0.9 }
  private loops = new Map<string, { stop: () => void; out: GainNode; panner?: PannerNode; howl?: Howl; hid?: number }>()
  private listener = { pos: [0, 0, 0], fwd: [0, 0, -1] }
  private theme: ThemeId | null = null
  ready = false

  async init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume()
      return
    }
    const Ctx = window.AudioContext || (window as any).webkitAudioContext
    const ctx: AudioContext = new Ctx()
    this.ctx = ctx
    this.master = ctx.createGain()
    this.muffle = ctx.createBiquadFilter()
    this.muffle.type = 'lowpass'
    this.muffle.frequency.value = 20000
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -14
    comp.ratio.value = 3
    this.master.connect(this.muffle).connect(comp).connect(ctx.destination)
    this.sfxBus = ctx.createGain()
    this.musicBus = ctx.createGain()
    this.musicDuck = ctx.createGain()
    this.voiceBus = ctx.createGain()
    this.reverb = ctx.createConvolver()
    this.reverb.buffer = makeImpulse(ctx, 1.6, 3)
    this.reverbSend = ctx.createGain()
    this.reverbSend.gain.value = 0.28
    this.sfxBus.connect(this.master)
    this.sfxBus.connect(this.reverbSend).connect(this.reverb).connect(this.master)
    this.musicBus.connect(this.musicDuck).connect(this.master)
    this.voiceBus.connect(this.master)
    this.synth = { ctx, out: this.sfxBus, noise: makeNoise(ctx), brown: makeNoise(ctx, true) }
    this.music = new GenerativeMusic(ctx, this.musicBus)
    this.applyVolumes()
    try {
      const m = await fetch('/audio/manifest.json').then((r) => r.json())
      for (const f of m.files ?? []) this.files.add(f)
    } catch {
      /* pas de manifeste : tout en synthèse */
    }
    this.ready = true
    if (this.theme) {
      const th = this.theme
      this.theme = null
      this.playMusic(th)
    }
  }

  setVolumes(v: { music: number; sfx: number; voice: number }) {
    this.vols = v
    this.applyVolumes()
  }

  private applyVolumes() {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    this.sfxBus.gain.setTargetAtTime(this.vols.sfx, t, 0.05)
    this.musicBus.gain.setTargetAtTime(this.vols.music * 0.8, t, 0.05)
    this.voiceBus.gain.setTargetAtTime(this.vols.voice, t, 0.05)
    Howler.volume(1)
    for (const h of this.howls.values()) h.volume(this.vols.sfx)
  }

  private howl(name: string, loop = false) {
    if (!this.files.has(name)) return null
    let h = this.howls.get(name)
    if (!h) {
      h = new Howl({ src: [`/audio/${name}.ogg`, `/audio/${name}.m4a`], loop, volume: this.vols.sfx })
      this.howls.set(name, h)
    }
    return h
  }

  /** joue un bruitage, éventuellement spatialisé */
  sfx(name: SfxName, opts: { pos?: [number, number, number]; vol?: number } = {}) {
    if (!this.ctx || !this.ready) return
    const file = FILE_OF[name] ?? `sfx_${name}`
    const h = this.howl(name.startsWith('steps') ? `${file}_${1 + Math.floor(Math.random() * 4)}` : file)
    let dur = 1
    if (h) {
      const id = h.play()
      h.volume((opts.vol ?? 1) * this.vols.sfx, id)
      if (opts.pos) h.pos(opts.pos[0], opts.pos[1], opts.pos[2], id)
      dur = h.duration() || 1
    } else {
      const t = this.ctx.currentTime + 0.01
      const g = this.ctx.createGain()
      g.gain.value = opts.vol ?? 1
      let dest: AudioNode = g
      g.connect(this.sfxBus)
      if (opts.pos) {
        const p = this.panner(opts.pos)
        p.connect(g)
        dest = p
      }
      dur = SFX[name]({ ...this.synth, out: dest }, t)
      setTimeout(() => g.disconnect(), (dur + 1) * 1000)
    }
    if (DUCKED.includes(name)) this.duck(dur)
  }

  private panner(pos: [number, number, number]) {
    const p = this.ctx!.createPanner()
    p.panningModel = 'HRTF'
    p.distanceModel = 'inverse'
    p.refDistance = 1.5
    p.rolloffFactor = 1.3
    p.positionX.value = pos[0]
    p.positionY.value = pos[1]
    p.positionZ.value = pos[2]
    return p
  }

  private duck(dur: number) {
    const t = this.ctx!.currentTime
    const g = this.musicDuck.gain
    g.cancelScheduledValues(t)
    g.setTargetAtTime(0.5, t, 0.05) // −6 dB
    g.setTargetAtTime(1, t + Math.min(dur, 3), 0.4)
  }

  loop(key: string, name: LoopName, opts: { pos?: [number, number, number]; vol?: number } = {}) {
    if (!this.ctx || !this.ready || this.loops.has(key)) return
    const file = FILE_OF[name]
    const h = file ? this.howl(file, true) : null
    if (h) {
      const id = h.play()
      h.loop(true, id)
      h.volume((opts.vol ?? 1) * this.vols.sfx, id)
      if (opts.pos) h.pos(opts.pos[0], opts.pos[1], opts.pos[2], id)
      this.loops.set(key, { stop: () => h.stop(id), out: this.ctx.createGain(), howl: h, hid: id })
      return
    }
    const g = this.ctx.createGain()
    g.gain.value = opts.vol ?? 1
    g.connect(this.sfxBus)
    let dest: AudioNode = g
    let panner: PannerNode | undefined
    if (opts.pos) {
      panner = this.panner(opts.pos)
      panner.connect(g)
      dest = panner
    }
    const l = startLoop({ ...this.synth, out: dest }, name)
    this.loops.set(key, {
      out: g,
      panner,
      stop: () => {
        l.stop()
        setTimeout(() => g.disconnect(), 1200)
      },
    })
  }

  loopVol(key: string, v: number) {
    const l = this.loops.get(key)
    if (!l || !this.ctx) return
    if (l.howl && l.hid !== undefined) l.howl.volume(v * this.vols.sfx, l.hid)
    else l.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.2)
  }

  stopLoop(key: string) {
    const l = this.loops.get(key)
    if (!l) return
    l.stop()
    this.loops.delete(key)
  }

  stopAllLoops() {
    for (const k of [...this.loops.keys()]) this.stopLoop(k)
  }

  setListener(pos: [number, number, number], fwd: [number, number, number]) {
    this.listener = { pos, fwd }
    Howler.pos(pos[0], pos[1], pos[2])
    Howler.orientation(fwd[0], fwd[1], fwd[2], 0, 1, 0)
    if (!this.ctx) return
    const L = this.ctx.listener
    if (L.positionX) {
      const t = this.ctx.currentTime
      L.positionX.setTargetAtTime(pos[0], t, 0.02)
      L.positionY.setTargetAtTime(pos[1], t, 0.02)
      L.positionZ.setTargetAtTime(pos[2], t, 0.02)
      L.forwardX.setTargetAtTime(fwd[0], t, 0.02)
      L.forwardY.setTargetAtTime(fwd[1], t, 0.02)
      L.forwardZ.setTargetAtTime(fwd[2], t, 0.02)
      L.upX.value = 0
      L.upY.value = 1
      L.upZ.value = 0
    } else {
      L.setPosition(pos[0], pos[1], pos[2])
      L.setOrientation(fwd[0], fwd[1], fwd[2], 0, 1, 0)
    }
  }

  /** 0 = net, 1 = étouffé (O₂ < 10 %) */
  setMuffle(v: number) {
    if (!this.ctx) return
    this.muffle.frequency.setTargetAtTime(20000 * Math.pow(0.03, v), this.ctx.currentTime, 0.3)
  }

  setInterior(interior: boolean) {
    if (!this.ctx) return
    this.reverbSend.gain.setTargetAtTime(interior ? 0.28 : 0.05, this.ctx.currentTime, 0.5)
  }

  setRiver(v: number) {
    if (!this.ctx || !this.synth.riverGain) return
    this.synth.riverGain.gain.setTargetAtTime(v, this.ctx.currentTime, 0.3)
  }

  playMusic(theme: ThemeId | null) {
    if (theme === this.theme) return
    this.theme = theme
    if (!this.ctx || !this.ready) return
    this.musicHowls.calm?.fade(this.musicHowls.calm.volume(), 0, 1500)
    this.musicHowls.tension?.fade(this.musicHowls.tension.volume(), 0, 1500)
    const old = this.musicHowls
    setTimeout(() => {
      old.calm?.unload()
      old.tension?.unload()
    }, 1600)
    this.musicHowls = {}
    if (!theme) {
      this.music.play(null)
      return
    }
    const [calm, tension] = MUSIC_FILES[theme]
    if (this.files.has(calm)) {
      this.music.play(null)
      const mk = (n: string) => new Howl({ src: [`/audio/${n}.ogg`, `/audio/${n}.m4a`], loop: true, volume: 0 })
      this.musicHowls.calm = mk(calm)
      this.musicHowls.calm.play()
      this.musicHowls.calm.fade(0, this.vols.music, 2500)
      if (tension && this.files.has(tension)) {
        this.musicHowls.tension = mk(tension)
        this.musicHowls.tension.play()
      }
    } else this.music.play(theme)
  }

  setTension(v: number, urgency = 0) {
    if (!this.ctx || !this.ready) return
    this.music.setTension(v, urgency)
    const { calm, tension } = this.musicHowls
    const k = Math.max(v, urgency * 0.7)
    if (calm) {
      calm.volume(this.vols.music * (1 - k * 0.8))
      calm.rate(1 + 0.25 * Math.max(v, urgency * 0.8))
    }
    if (tension) {
      tension.volume(this.vols.music * k)
      tension.rate(1 + 0.25 * Math.max(v, urgency * 0.8))
    }
  }

  setHeartRate(bpm: number) {
    heart.bpm = bpm
  }

  sting(kind: 'solved' | 'discover' | 'danger') {
    if (!this.ctx || !this.ready) return
    this.music.sting(kind)
  }

  oneShotMusic(kind: 'launch' | 'victory') {
    if (!this.ctx || !this.ready) return
    const f = kind === 'launch' ? 'music_launch' : 'music_victoire'
    this.playMusic(null)
    if (this.files.has(f)) new Howl({ src: [`/audio/${f}.ogg`, `/audio/${f}.m4a`], volume: this.vols.music }).play()
    else this.music.oneShot(kind)
  }

  /** voix : fichier si fourni, sinon synthèse vocale du navigateur */
  speak(text: string, opts: { radio?: boolean; rate?: number } = {}) {
    if (!('speechSynthesis' in window) || this.vols.voice <= 0.01) return
    try {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = 'fr-FR'
      u.rate = opts.rate ?? (opts.radio ? 1.05 : 0.98)
      u.pitch = opts.radio ? 0.9 : 1
      u.volume = this.vols.voice
      const v = speechSynthesis.getVoices().find((x) => x.lang.startsWith('fr'))
      if (v) u.voice = v
      speechSynthesis.cancel()
      speechSynthesis.speak(u)
      if (opts.radio) this.sfx('radio_tune', { vol: 0.6 })
    } catch {
      /* synthèse vocale indisponible */
    }
  }

  stopSpeech() {
    try {
      speechSynthesis.cancel()
    } catch {
      /* rien */
    }
  }
}

export const audio = new AudioManager()
