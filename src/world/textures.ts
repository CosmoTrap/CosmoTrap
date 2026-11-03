import * as THREE from 'three'

// Textures PBR procédurales (albédo, normal, rugosité, métal) générées au chargement.
// Pas de dépendance réseau : tout est dessiné sur canvas puis converti.

type Mode = 'albedo' | 'height' | 'rough' | 'metal' | 'emissive'
type Painter = (c: CanvasRenderingContext2D, mode: Mode, S: number) => void

let rngSeed = 1
const rnd = () => {
  rngSeed = (rngSeed * 16807) % 2147483647
  return (rngSeed - 1) / 2147483646
}
const seed = (s: number) => (rngSeed = s)

// ——— bruit fbm en canvas (réutilisé pour la saleté) ———
const noiseCache = new Map<number, HTMLCanvasElement>()
function noiseCanvas(S: number, scale = 6, oct = 5, sd = 7) {
  const key = S * 1000 + scale * 10 + sd
  if (noiseCache.has(key)) return noiseCache.get(key)!
  const c = document.createElement('canvas')
  c.width = c.height = S
  const ctx = c.getContext('2d')!
  const img = ctx.createImageData(S, S)
  const grid: number[][] = []
  const G = 256
  seed(sd)
  for (let i = 0; i < G; i++) {
    grid[i] = []
    for (let j = 0; j < G; j++) grid[i][j] = rnd()
  }
  const val = (x: number, y: number, per: number) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)
    const g = (a: number, b: number) => grid[((a % per) + per) % per][((b % per) + per) % per]
    const a = g(xi, yi)
    const b = g(xi + 1, yi)
    const cc = g(xi, yi + 1)
    const d = g(xi + 1, yi + 1)
    return a + (b - a) * u + (cc - a) * v + (a - b - cc + d) * u * v
  }
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let s = 0
      let amp = 0.5
      let f = scale / S
      for (let o = 0; o < oct; o++) {
        // tuilable : période = scale * 2^o cellules
        const per = scale * Math.pow(2, o)
        const nx = (x * f) % per
        const ny = (y * f) % per
        s += amp * val(nx, ny, Math.min(G, per))
        amp *= 0.5
        f *= 2
      }
      const v = Math.max(0, Math.min(255, s * 255))
      const i = (y * S + x) * 4
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v
      img.data[i + 3] = 255
    }
  ctx.putImageData(img, 0, 0)
  noiseCache.set(key, c)
  return c
}

function heightToNormal(h: HTMLCanvasElement, strength: number) {
  const W = h.width, Hh = h.height
  const src = h.getContext('2d')!.getImageData(0, 0, W, Hh).data
  const out = document.createElement('canvas')
  out.width = W
  out.height = Hh
  const ctx = out.getContext('2d')!
  const img = ctx.createImageData(W, Hh)
  const H = (x: number, y: number) => src[((((y + Hh) % Hh) * W + ((x + W) % W)) * 4)] / 255
  for (let y = 0; y < Hh; y++)
    for (let x = 0; x < W; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength
      const l = Math.hypot(dx, dy, 1)
      const i = (y * W + x) * 4
      img.data[i] = ((-dx / l) * 0.5 + 0.5) * 255
      img.data[i + 1] = ((dy / l) * 0.5 + 0.5) * 255
      img.data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  ctx.putImageData(img, 0, 0)
  return out
}

function canvas(S: number, w = S, h = S) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

function tex(c: HTMLCanvasElement, srgb: boolean, repeat = true) {
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  t.generateMipmaps = true
  t.minFilter = THREE.LinearMipmapLinearFilter
  t.needsUpdate = true
  return t
}

export interface PBRSet {
  map: THREE.Texture
  normalMap: THREE.Texture
  roughnessMap: THREE.Texture
  metalnessMap?: THREE.Texture
  emissiveMap?: THREE.Texture
}

function build(S: number, paint: Painter, normalStrength: number, opts: { metal?: boolean; emissive?: boolean; w?: number; h?: number } = {}): PBRSet {
  const W = opts.w ?? S
  const Hh = opts.h ?? S
  const mk = (mode: Mode) => {
    const c = canvas(S, W, Hh)
    paint(c.getContext('2d')!, mode, S)
    return c
  }
  const hc = mk('height')
  const set: PBRSet = {
    map: tex(mk('albedo'), true),
    normalMap: tex(heightToNormal(hc, normalStrength), false),
    roughnessMap: tex(mk('rough'), false),
  }
  if (opts.metal) set.metalnessMap = tex(mk('metal'), false)
  if (opts.emissive) set.emissiveMap = tex(mk('emissive'), true)
  return set
}

const gray = (v: number) => `rgb(${v},${v},${v})`

function grime(c: CanvasRenderingContext2D, S: number, mode: Mode, amount: number, bottomBias = true, sd = 7) {
  const n = noiseCanvas(Math.min(512, S), 5, 5, sd)
  c.save()
  if (mode === 'albedo') {
    c.globalCompositeOperation = 'multiply'
    c.globalAlpha = amount
    c.drawImage(n, 0, 0, c.canvas.width, c.canvas.height)
    if (bottomBias) {
      const g = c.createLinearGradient(0, c.canvas.height, 0, c.canvas.height * 0.55)
      g.addColorStop(0, 'rgba(60,50,40,0.55)')
      g.addColorStop(1, 'rgba(60,50,40,0)')
      c.globalAlpha = amount * 1.4
      c.fillStyle = g
      c.fillRect(0, 0, c.canvas.width, c.canvas.height)
    }
  } else if (mode === 'rough') {
    c.globalCompositeOperation = 'lighter'
    c.globalAlpha = amount * 0.35
    c.drawImage(n, 0, 0, c.canvas.width, c.canvas.height)
  } else if (mode === 'height') {
    c.globalAlpha = 0.05
    c.drawImage(n, 0, 0, c.canvas.width, c.canvas.height)
  }
  c.restore()
}

function scratches(c: CanvasRenderingContext2D, mode: Mode, count: number, sd: number, color = 'rgba(255,255,255,0.18)') {
  seed(sd)
  const W = c.canvas.width
  const H = c.canvas.height
  c.save()
  c.lineCap = 'round'
  for (let i = 0; i < count; i++) {
    const x = rnd() * W
    const y = rnd() * H
    const a = rnd() * Math.PI * 2
    const l = 8 + rnd() * W * 0.08
    c.lineWidth = 0.6 + rnd() * 1.2
    c.strokeStyle = mode === 'albedo' ? color : mode === 'rough' ? 'rgba(40,40,40,0.5)' : mode === 'metal' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.15)'
    c.beginPath()
    c.moveTo(x, y)
    c.quadraticCurveTo(x + Math.cos(a + 0.3) * l * 0.5, y + Math.sin(a + 0.3) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l)
    c.stroke()
  }
  c.restore()
}

function roundRect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath()
  c.moveTo(x + r, y)
  c.arcTo(x + w, y, x + w, y + h, r)
  c.arcTo(x + w, y + h, x, y + h, r)
  c.arcTo(x, y + h, x, y, r)
  c.arcTo(x, y, x + w, y, r)
  c.closePath()
}

function rivet(c: CanvasRenderingContext2D, x: number, y: number, r: number, mode: Mode, base: string) {
  const g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r)
  if (mode === 'height') {
    g.addColorStop(0, gray(230))
    g.addColorStop(1, gray(128))
  } else if (mode === 'albedo') {
    g.addColorStop(0, '#cfd2d6')
    g.addColorStop(1, base)
  } else if (mode === 'rough') {
    g.addColorStop(0, gray(70))
    g.addColorStop(1, gray(120))
  } else {
    g.addColorStop(0, gray(255))
    g.addColorStop(1, gray(200))
  }
  c.fillStyle = g
  c.beginPath()
  c.arc(x, y, r, 0, Math.PI * 2)
  c.fill()
}

export type WallTheme = 'station' | 'lab' | 'machine' | 'rocket' | 'green'

const THEME: Record<WallTheme, { base: string; lower: string; band: string; stripe: string; rough: number; metal: number }> = {
  station: { base: '#c8c1b4', lower: '#6d6a66', band: '#8e8a84', stripe: '#d9673a', rough: 150, metal: 20 },
  lab: { base: '#d3d8db', lower: '#5f6870', band: '#9aa3aa', stripe: '#2e9fd0', rough: 120, metal: 20 },
  machine: { base: '#5c6066', lower: '#33363a', band: '#45494e', stripe: '#e3b23c', rough: 140, metal: 150 },
  rocket: { base: '#3d4146', lower: '#24272b', band: '#2f3236', stripe: '#ff6b35', rough: 130, metal: 90 },
  green: { base: '#c9cfc4', lower: '#56614f', band: '#8b9584', stripe: '#53b84a', rough: 150, metal: 20 },
}

/** panneau mural : 1 tuile = 2 m de large × 2,8 m de haut (texture W × 1,4W) */
export function wallSet(theme: WallTheme, S: number, sd = 3): PBRSet {
  const th = THEME[theme]
  const W = S
  const H = Math.round(S * 1.4)
  const paint: Painter = (c, mode) => {
    const px = W / 2 // px par mètre
    const yOf = (m: number) => H - m * px
    const fill = (alb: string, hgt: number, rgh: number, met = th.metal) =>
      mode === 'albedo' ? alb : mode === 'height' ? gray(hgt) : mode === 'rough' ? gray(rgh) : mode === 'metal' ? gray(met) : '#000'
    // fond
    c.fillStyle = fill(th.base, 128, th.rough)
    c.fillRect(0, 0, W, H)
    // plinthe
    c.fillStyle = fill(th.lower, 110, th.rough + 30, Math.min(255, th.metal + 60))
    c.fillRect(0, yOf(0.38), W, 0.38 * px)
    // bande haute technique
    c.fillStyle = fill(th.band, 118, th.rough + 10)
    c.fillRect(0, 0, W, 0.42 * px)
    // grilles d'aération dans la bande haute
    for (let i = 0; i < 2; i++) {
      const x0 = W * (0.12 + i * 0.5)
      for (let k = 0; k < 9; k++) {
        c.fillStyle = fill('#1d1f22', 70, 220)
        c.fillRect(x0 + k * W * 0.028, 0.1 * px, W * 0.012, 0.22 * px)
      }
    }
    // panneaux principaux avec chanfrein
    const panels = [
      [0.06, 0.45, 0.88, 1.15],
      [0.06, 1.66, 0.88, 0.66],
      [1.06, 0.45, 0.88, 1.85],
    ]
    for (const [x, y, w, h] of panels) {
      const X = x * px
      const Y = yOf(y + h)
      // creux du joint
      roundRect(c, X - 3, Y - 3, w * px + 6, h * px + 6, 10)
      c.fillStyle = fill('#2b2b2b', 60, 200)
      c.fill()
      roundRect(c, X, Y, w * px, h * px, 8)
      if (mode === 'height') {
        const g = c.createLinearGradient(X, Y, X, Y + h * px)
        g.addColorStop(0, gray(150))
        g.addColorStop(0.03, gray(140))
        g.addColorStop(0.97, gray(140))
        g.addColorStop(1, gray(130))
        c.fillStyle = g
      } else c.fillStyle = fill(th.base, 140, th.rough - 10)
      c.fill()
      // vis aux coins
      for (const [rx, ry] of [
        [0.05, 0.05],
        [w - 0.05, 0.05],
        [0.05, h - 0.05],
        [w - 0.05, h - 0.05],
      ])
        rivet(c, X + rx * px, Y + ry * px, px * 0.018, mode, th.lower)
    }
    // bande de couleur (repère visuel de la station)
    c.fillStyle = fill(th.stripe, 132, th.rough - 30, 10)
    c.fillRect(0, yOf(1.05), W, 0.05 * px)
    // étiquettes
    if (mode === 'albedo') {
      c.fillStyle = 'rgba(30,30,30,0.75)'
      c.font = `600 ${Math.round(px * 0.05)}px "JetBrains Mono", monospace`
      seed(sd * 13)
      c.fillText(`ORN-${100 + Math.floor(rnd() * 800)} · P${Math.floor(rnd() * 40)}`, 0.12 * px, yOf(1.95))
      c.fillStyle = 'rgba(200,60,40,0.8)'
      c.fillRect(1.12 * px, yOf(2.25), 0.12 * px, 0.04 * px)
      c.fillStyle = 'rgba(30,30,30,0.6)'
      c.fillText('NE PAS OBSTRUER', 1.12 * px, yOf(0.6))
    }
    // joint vertical en bord de tuile
    c.fillStyle = fill('#202020', 40, 230)
    c.fillRect(0, 0, 3, H)
    c.fillRect(W - 3, 0, 3, H)
    grime(c, S, mode, theme === 'machine' || theme === 'rocket' ? 0.55 : 0.32, true, sd)
    scratches(c, mode, theme === 'machine' ? 120 : 50, sd)
  }
  return build(S, paint, 3.2, { metal: true, w: W, h: H })
}

/** sol : tôle larmée + joints, 1 tuile = 2 m */
export function floorSet(kind: 'plate' | 'rubber' | 'grate', S: number): PBRSet {
  const paint: Painter = (c, mode) => {
    const px = S / 2
    const base = kind === 'rubber' ? '#2a2c2f' : kind === 'grate' ? '#3a3d41' : '#6b6e72'
    const fill = (alb: string, hgt: number, rgh: number, met: number) =>
      mode === 'albedo' ? alb : mode === 'height' ? gray(hgt) : mode === 'rough' ? gray(rgh) : mode === 'metal' ? gray(met) : '#000'
    c.fillStyle = fill(base, 128, kind === 'rubber' ? 220 : 130, kind === 'rubber' ? 0 : 210)
    c.fillRect(0, 0, S, S)
    if (kind === 'plate') {
      // motif larmé
      const step = px * 0.06
      for (let y = 0; y < S + step; y += step)
        for (let x = 0; x < S + step; x += step) {
          const o = (Math.round(y / step) % 2) * step * 0.5
          c.save()
          c.translate(x + o, y)
          c.rotate(Math.round(y / step) % 2 ? 0.8 : -0.8)
          c.beginPath()
          c.ellipse(0, 0, step * 0.32, step * 0.09, 0, 0, Math.PI * 2)
          c.fillStyle = fill('#8a8d91', 175, 95, 230)
          c.fill()
          c.restore()
        }
    } else if (kind === 'rubber') {
      for (let y = 0; y < S; y += px * 0.04) {
        c.fillStyle = fill('#232528', 100, 240, 0)
        c.fillRect(0, y, S, px * 0.012)
      }
    } else {
      const step = px * 0.1
      for (let y = 0; y < S; y += step)
        for (let x = 0; x < S; x += step) {
          c.fillStyle = fill('#0b0c0d', 20, 255, 0)
          c.fillRect(x + step * 0.15, y + step * 0.15, step * 0.7, step * 0.7)
        }
    }
    // plaques de 1 m avec joints et vis
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        c.strokeStyle = fill('#151515', 30, 240, 0)
        c.lineWidth = 4
        c.strokeRect(i * px + 2, j * px + 2, px - 4, px - 4)
        for (const [a, b] of [
          [0.04, 0.04],
          [0.96, 0.04],
          [0.04, 0.96],
          [0.96, 0.96],
        ])
          rivet(c, i * px + a * px, j * px + b * px, px * 0.014, mode, '#55585c')
      }
    grime(c, S, mode, kind === 'plate' ? 0.6 : 0.45, false, 11)
    scratches(c, mode, 160, 5, 'rgba(255,255,255,0.12)')
  }
  return build(S, paint, kind === 'plate' ? 4 : 2.5, { metal: true })
}

/** plafond : dalles perforées + caniveau technique */
export function ceilingSet(S: number): PBRSet {
  const paint: Painter = (c, mode) => {
    const px = S / 2
    const fill = (alb: string, hgt: number, rgh: number) => (mode === 'albedo' ? alb : mode === 'height' ? gray(hgt) : mode === 'rough' ? gray(rgh) : gray(30))
    c.fillStyle = fill('#a9a59d', 128, 170)
    c.fillRect(0, 0, S, S)
    for (let i = 0; i < 2; i++)
      for (let j = 0; j < 2; j++) {
        const X = i * px
        const Y = j * px
        c.fillStyle = fill('#2a2a2a', 50, 230)
        c.fillRect(X, Y, px, 4)
        c.fillRect(X, Y, 4, px)
        // perforations
        for (let y = 0.15; y < 0.85; y += 0.05)
          for (let x = 0.15; x < 0.85; x += 0.05) {
            c.fillStyle = fill('#3a3936', 80, 220)
            c.beginPath()
            c.arc(X + x * px, Y + y * px, px * 0.009, 0, Math.PI * 2)
            c.fill()
          }
      }
    grime(c, S, mode, 0.35, false, 21)
  }
  return build(S, paint, 2, {})
}

/** métal peint générique (accessoires) */
export function paintedMetal(color: string, S = 256, wear = 0.4, sd = 9): PBRSet {
  const paint: Painter = (c, mode) => {
    c.fillStyle = mode === 'albedo' ? color : mode === 'height' ? gray(128) : mode === 'rough' ? gray(140) : gray(40)
    c.fillRect(0, 0, S, S)
    grime(c, S, mode, wear, false, sd)
    scratches(c, mode, 60, sd, 'rgba(210,210,210,0.35)')
  }
  return build(S, paint, 1.5, { metal: true })
}

/** roche (astéroïdes, rochers) */
export function rockSet(S: number, tint = '#6e665e'): PBRSet {
  const paint: Painter = (c, mode) => {
    c.fillStyle = mode === 'albedo' ? tint : mode === 'height' ? gray(128) : gray(235)
    c.fillRect(0, 0, S, S)
    const n1 = noiseCanvas(Math.min(512, S), 8, 6, 31)
    const n2 = noiseCanvas(Math.min(512, S), 24, 4, 32)
    c.save()
    if (mode === 'albedo') {
      c.globalCompositeOperation = 'overlay'
      c.globalAlpha = 0.9
      c.drawImage(n1, 0, 0, S, S)
      c.globalAlpha = 0.5
      c.drawImage(n2, 0, 0, S, S)
    } else if (mode === 'height') {
      c.globalAlpha = 1
      c.drawImage(n1, 0, 0, S, S)
      c.globalAlpha = 0.6
      c.drawImage(n2, 0, 0, S, S)
    } else {
      c.globalCompositeOperation = 'multiply'
      c.globalAlpha = 0.25
      c.drawImage(n2, 0, 0, S, S)
    }
    c.restore()
    // petits cratères / pores
    seed(77)
    for (let i = 0; i < 260; i++) {
      const x = rnd() * S
      const y = rnd() * S
      const r = 1 + rnd() * rnd() * S * 0.03
      const g = c.createRadialGradient(x, y, 0, x, y, r)
      if (mode === 'height') {
        g.addColorStop(0, gray(70))
        g.addColorStop(0.8, gray(120))
        g.addColorStop(1, 'rgba(160,160,160,0)')
      } else if (mode === 'albedo') {
        g.addColorStop(0, 'rgba(20,18,16,0.5)')
        g.addColorStop(1, 'rgba(0,0,0,0)')
      } else {
        g.addColorStop(0, 'rgba(255,255,255,0.3)')
        g.addColorStop(1, 'rgba(255,255,255,0)')
      }
      c.fillStyle = g
      c.beginPath()
      c.arc(x, y, r, 0, Math.PI * 2)
      c.fill()
    }
  }
  return build(S, paint, 6, {})
}

/** herbe / terre pour le terrain */
export function groundSet(S: number): PBRSet {
  const paint: Painter = (c, mode) => {
    c.fillStyle = mode === 'albedo' ? '#4d6b2c' : mode === 'height' ? gray(128) : gray(225)
    c.fillRect(0, 0, S, S)
    seed(5)
    for (let i = 0; i < S * 9; i++) {
      const x = rnd() * S
      const y = rnd() * S
      const l = 3 + rnd() * S * 0.02
      const a = -Math.PI / 2 + (rnd() - 0.5) * 1.2
      const hue = 70 + rnd() * 40
      c.strokeStyle =
        mode === 'albedo' ? `hsl(${hue},${35 + rnd() * 30}%,${18 + rnd() * 22}%)` : mode === 'height' ? gray(110 + rnd() * 120) : gray(170 + rnd() * 80)
      c.lineWidth = 1 + rnd() * 1.5
      c.beginPath()
      c.moveTo(x, y)
      c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l)
      c.stroke()
    }
    const n = noiseCanvas(Math.min(512, S), 4, 5, 41)
    c.save()
    c.globalCompositeOperation = mode === 'albedo' ? 'multiply' : 'source-over'
    c.globalAlpha = mode === 'albedo' ? 0.45 : 0.15
    c.drawImage(n, 0, 0, S, S)
    c.restore()
  }
  return build(S, paint, 3, {})
}

/** bois (refuge, planches du pont, caisses) */
export function woodSet(S: number, tint = '#7a5634'): PBRSet {
  const paint: Painter = (c, mode) => {
    c.fillStyle = mode === 'albedo' ? tint : mode === 'height' ? gray(128) : gray(190)
    c.fillRect(0, 0, S, S)
    seed(15)
    const planks = 4
    for (let p = 0; p < planks; p++) {
      const y0 = (p * S) / planks
      for (let i = 0; i < 60; i++) {
        const y = y0 + rnd() * (S / planks)
        c.strokeStyle = mode === 'albedo' ? `rgba(40,25,12,${0.1 + rnd() * 0.25})` : mode === 'height' ? gray(100 + rnd() * 50) : gray(200 + rnd() * 40)
        c.lineWidth = 0.6 + rnd() * 2
        c.beginPath()
        c.moveTo(0, y)
        for (let x = 0; x <= S; x += S / 8) c.lineTo(x, y + Math.sin(x * 0.02 + i) * 3)
        c.stroke()
      }
      c.fillStyle = mode === 'albedo' ? 'rgba(20,12,6,0.9)' : mode === 'height' ? gray(30) : gray(255)
      c.fillRect(0, y0, S, 3)
    }
    grime(c, S, mode, 0.35, false, 17)
  }
  return build(S, paint, 2.5, {})
}

/** béton (hélisurface) */
export function concreteSet(S: number): PBRSet {
  const paint: Painter = (c, mode) => {
    c.fillStyle = mode === 'albedo' ? '#8d8a84' : mode === 'height' ? gray(128) : gray(220)
    c.fillRect(0, 0, S, S)
    const n = noiseCanvas(Math.min(512, S), 16, 5, 51)
    c.save()
    c.globalCompositeOperation = mode === 'albedo' ? 'overlay' : 'source-over'
    c.globalAlpha = mode === 'albedo' ? 0.6 : 0.3
    c.drawImage(n, 0, 0, S, S)
    c.restore()
    grime(c, S, mode, 0.4, false, 52)
  }
  return build(S, paint, 2, {})
}

/** gobo de lampe frontale : point chaud + anneaux */
export function lampCookie(S = 256) {
  const c = canvas(S)
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2)
  g.addColorStop(0, 'rgb(255,255,255)')
  g.addColorStop(0.18, 'rgb(240,240,240)')
  g.addColorStop(0.32, 'rgb(150,150,150)')
  g.addColorStop(0.42, 'rgb(190,190,190)')
  g.addColorStop(0.55, 'rgb(90,90,90)')
  g.addColorStop(0.75, 'rgb(40,40,40)')
  g.addColorStop(1, 'rgb(0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, S, S)
  const n = noiseCanvas(256, 10, 3, 61)
  ctx.globalCompositeOperation = 'multiply'
  ctx.globalAlpha = 0.25
  ctx.drawImage(n, 0, 0, S, S)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** texte sur canvas (écrans, plaques, panneaux) */
export function textTexture(lines: string[], o: { w?: number; h?: number; bg?: string; fg?: string; font?: string; size?: number; align?: CanvasTextAlign; glow?: boolean; scan?: boolean; pad?: number } = {}) {
  const W = o.w ?? 512
  const H = o.h ?? 256
  const c = canvas(W, W, H)
  const ctx = c.getContext('2d')!
  ctx.fillStyle = o.bg ?? '#0b1a22'
  ctx.fillRect(0, 0, W, H)
  if (o.scan) {
    for (let y = 0; y < H; y += 4) {
      ctx.fillStyle = 'rgba(255,255,255,0.035)'
      ctx.fillRect(0, y, W, 1)
    }
  }
  const size = o.size ?? 28
  ctx.font = o.font ?? `600 ${size}px "JetBrains Mono", monospace`
  ctx.fillStyle = o.fg ?? '#7fe3ff'
  ctx.textAlign = o.align ?? 'left'
  ctx.textBaseline = 'top'
  if (o.glow) {
    ctx.shadowColor = o.fg ?? '#7fe3ff'
    ctx.shadowBlur = 12
  }
  const pad = o.pad ?? 24
  const x = o.align === 'center' ? W / 2 : pad
  lines.forEach((l, i) => ctx.fillText(l, x, pad + i * size * 1.35))
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/** texture d'image dessinée à la main (photos de famille, post-its) */
export function drawTexture(w: number, h: number, draw: (c: CanvasRenderingContext2D) => void) {
  const c = canvas(w, w, h)
  draw(c.getContext('2d')!)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

export { seed as texSeed, rnd as texRnd }
