import { createNoise3D } from '../utils/noise.js'
import { qsa } from '../utils/helpers.js'

/**
 * Generative line drawings – one quiet visual language per treatment.
 * Drawn on 2D canvas, animated only while visible, reacting to the pointer.
 */

const noise = createNoise3D(7)
const TAU = Math.PI * 2

const readColors = (el) => {
  const cs = getComputedStyle(el)
  return {
    fg: cs.getPropertyValue('--fg').trim() || '#1b1815',
    soft: cs.getPropertyValue('--fg-soft').trim() || 'rgba(27,24,21,.6)',
    line: cs.getPropertyValue('--line').trim() || 'rgba(27,24,21,.14)',
    accent: cs.getPropertyValue('--accent').trim() || '#b04f2c',
  }
}

const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s))

/* ───── 01 Klassische Massage: tension lines that release under the hand ───── */
function classic(ctx, w, h, t, p, c, s) {
  const lines = s.mini ? 7 : 30
  const pad = h * 0.14
  const step = (h - pad * 2) / (lines - 1)
  const tension = 0.2 + 0.8 * Math.pow(Math.sin(t * 0.22) * 0.5 + 0.5, 1.6)
  ctx.lineWidth = s.dpr * (s.mini ? 1.4 : 1.15)
  for (let i = 0; i < lines; i++) {
    const y0 = pad + i * step
    ctx.beginPath()
    ctx.strokeStyle = i === Math.floor(lines * 0.62) ? c.accent : c.fg
    ctx.globalAlpha = i === Math.floor(lines * 0.62) ? 1 : 0.55 + 0.35 * Math.sin(i * 0.7)
    for (let x = 0; x <= w; x += 4 * s.dpr) {
      const nx = x / w
      let amp = noise(nx * 3.2, i * 0.18, t * 0.18) * step * 2.6 * tension
      amp += Math.sin(nx * 22 + i + t * 2) * step * 0.12 * tension
      if (p.inside) {
        const d = Math.hypot(x - p.x, y0 - p.y) / w
        amp *= 1 - gauss(d, 0.14) * 0.95
      }
      const y = y0 + amp
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

/* ───── 02 Nacken-Schulter: silhouette with the seven cervical vertebrae ───── */
function neck(ctx, w, h, t, p, c, s) {
  const S = Math.min(w, h * 1.25)
  const ox = (w - S) / 2
  const oy = (h - S * 0.8) / 2 - S * 0.04
  const X = (v) => ox + v * S
  const Y = (v) => oy + v * S
  ctx.lineWidth = 1.5 * s.dpr
  ctx.strokeStyle = c.fg
  ctx.lineCap = 'round'

  // pressure waves from both shoulders
  for (let k = 0; k < 2; k++) {
    const cx = X(k ? 0.69 : 0.31)
    const cy = Y(0.615)
    for (let r = 0; r < 4; r++) {
      const ph = (t * 0.32 + r / 4 + k * 0.5) % 1
      ctx.beginPath()
      ctx.globalAlpha = (1 - ph) * 0.45
      ctx.arc(cx, cy, S * (0.04 + ph * 0.32), Math.PI * 1.05, Math.PI * 1.95)
      ctx.stroke()
    }
  }
  ctx.globalAlpha = 1

  // head
  ctx.beginPath()
  ctx.ellipse(X(0.5), Y(0.25), S * 0.105, S * 0.125, 0, Math.PI * 0.62, Math.PI * 2.38)
  ctx.stroke()
  // neck + shoulders (one continuous gesture per side)
  const sway = Math.sin(t * 0.6) * S * 0.004
  ctx.beginPath()
  ctx.moveTo(X(0.455), Y(0.36))
  ctx.bezierCurveTo(X(0.45), Y(0.44), X(0.445) + sway, Y(0.5), X(0.43), Y(0.54))
  ctx.bezierCurveTo(X(0.36), Y(0.58), X(0.18), Y(0.6), X(0.11), Y(0.68))
  ctx.bezierCurveTo(X(0.07), Y(0.73), X(0.055), Y(0.8), X(0.05), Y(0.86))
  ctx.moveTo(X(0.545), Y(0.36))
  ctx.bezierCurveTo(X(0.55), Y(0.44), X(0.555) - sway, Y(0.5), X(0.57), Y(0.54))
  ctx.bezierCurveTo(X(0.64), Y(0.58), X(0.82), Y(0.6), X(0.89), Y(0.68))
  ctx.bezierCurveTo(X(0.93), Y(0.73), X(0.945), Y(0.8), X(0.95), Y(0.86))
  ctx.stroke()

  // C1–C7
  for (let i = 0; i < 7; i++) {
    const y = Y(0.385 + i * 0.03)
    const phase = (t * 0.9 - i * 0.22) % 3
    const glow = phase > 0 && phase < 1 ? Math.sin(phase * Math.PI) : 0
    ctx.beginPath()
    ctx.fillStyle = c.accent
    ctx.globalAlpha = 0.35 + glow * 0.65
    ctx.arc(X(0.5), y, S * (0.0085 + glow * 0.006), 0, TAU)
    ctx.fill()
  }
  ctx.globalAlpha = 1
  if (!s.mini) {
    ctx.fillStyle = c.soft
    ctx.font = `${10 * s.dpr}px "Geist Mono", monospace`
    ctx.textAlign = 'left'
    ctx.fillText('C1', X(0.53), Y(0.39))
    ctx.fillText('C7', X(0.53), Y(0.57))
  }
}

/* ───── 03 Manuelle Schmerztherapie: one precise point of pressure ───── */
function point(ctx, w, h, t, p, c, s) {
  if (!s.target) s.target = { x: w * 0.5, y: h * 0.5 }
  const tx = p.inside ? p.x : w * (0.5 + Math.sin(t * 0.3) * 0.08)
  const ty = p.inside ? p.y : h * (0.5 + Math.cos(t * 0.23) * 0.08)
  s.target.x += (tx - s.target.x) * 0.06
  s.target.y += (ty - s.target.y) * 0.06
  const { x: cx, y: cy } = s.target
  const press = 0.6 + 0.4 * Math.sin(t * 1.2)

  // dot field pushed away from the point
  const gap = 18 * s.dpr
  ctx.fillStyle = c.fg
  for (let y = gap / 2; y < h; y += gap) {
    for (let x = gap / 2; x < w; x += gap) {
      const dx = x - cx
      const dy = y - cy
      const d = Math.hypot(dx, dy)
      const push = gauss(d / w, 0.12) * 22 * s.dpr * press
      const k = d > 0 ? push / d : 0
      const r = (0.6 + gauss(d / w, 0.2) * 1.1) * s.dpr
      ctx.globalAlpha = 0.25 + gauss(d / w, 0.25) * 0.5
      ctx.beginPath()
      ctx.arc(x + dx * k, y + dy * k, r, 0, TAU)
      ctx.fill()
    }
  }
  // converging rings
  ctx.strokeStyle = c.fg
  ctx.lineWidth = 1 * s.dpr
  for (let i = 0; i < 5; i++) {
    const ph = 1 - ((t * 0.28 + i / 5) % 1)
    ctx.globalAlpha = Math.sin(ph * Math.PI) * 0.6
    ctx.beginPath()
    ctx.arc(cx, cy, Math.min(w, h) * 0.45 * ph, 0, TAU)
    ctx.stroke()
  }
  // crosshair
  ctx.globalAlpha = 0.5
  const L = 14 * s.dpr
  ctx.beginPath()
  ctx.moveTo(cx - L * 2, cy)
  ctx.lineTo(cx - L, cy)
  ctx.moveTo(cx + L, cy)
  ctx.lineTo(cx + L * 2, cy)
  ctx.moveTo(cx, cy - L * 2)
  ctx.lineTo(cx, cy - L)
  ctx.moveTo(cx, cy + L)
  ctx.lineTo(cx, cy + L * 2)
  ctx.stroke()
  // the point
  ctx.globalAlpha = 1
  ctx.fillStyle = c.accent
  ctx.beginPath()
  ctx.arc(cx, cy, (4 + press * 3) * s.dpr, 0, TAU)
  ctx.fill()
  ctx.globalAlpha = 0.18
  ctx.beginPath()
  ctx.arc(cx, cy, (14 + press * 10) * s.dpr, 0, TAU)
  ctx.fill()
  ctx.globalAlpha = 1
}

/* ───── 04 Schwingkissen: gentle oscillation settling into balance ───── */
function wave(ctx, w, h, t, p, c, s) {
  const n = s.mini ? 3 : 9
  const freqBoost = p.inside ? 0.6 + (p.x / w) * 1.4 : 1
  const ampBoost = p.inside ? 0.5 + (1 - p.y / h) : 1
  ctx.lineWidth = (s.mini ? 1.6 : 1.2) * s.dpr
  for (let i = 0; i < n; i++) {
    const k = n === 1 ? 0.5 : i / (n - 1)
    const yBase = h * (s.mini ? 0.5 : 0.18 + k * 0.64)
    const amp = h * (s.mini ? 0.22 : 0.085) * (1 - Math.abs(k - 0.5) * 0.9) * ampBoost
    const freq = (2 + i * 0.35) * freqBoost
    const speed = 1.4 + i * 0.15
    ctx.beginPath()
    const accent = i === Math.floor(n / 2)
    ctx.strokeStyle = accent ? c.accent : c.fg
    ctx.globalAlpha = accent ? 1 : s.mini ? 0.55 : 0.5
    for (let x = 0; x <= w; x += 3 * s.dpr) {
      const nx = x / w
      const env = Math.sin(nx * Math.PI) // calm at the edges
      const y =
        yBase +
        Math.sin(nx * freq * TAU - t * speed + i * 0.6) * amp * env * (0.75 + 0.25 * Math.sin(t * 0.5 + i)) +
        Math.sin(nx * freq * 3.1 * TAU + t * speed * 1.7) * amp * 0.08 * env
      x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

/* ───── 05 Hot Stone: warm basalt, rising heat ───── */
function stone(ctx, w, h, t, p, c, s) {
  const S = Math.min(w, h * 1.3)
  const cx = w / 2
  const base = h * 0.74
  const near = p.inside ? 1 - Math.min(1, Math.hypot(p.x - cx, p.y - base) / (S * 0.6)) : 0
  s.warm = (s.warm ?? 0.4) + ((0.45 + near * 0.55) - (s.warm ?? 0.4)) * 0.05

  // glow
  const g = ctx.createRadialGradient(cx, base, 0, cx, base, S * 0.55)
  g.addColorStop(0, `rgba(227,129,90,${0.42 * s.warm})`)
  g.addColorStop(1, 'rgba(227,129,90,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)

  // heat shimmer
  ctx.strokeStyle = c.accent
  ctx.lineWidth = 1.2 * s.dpr
  const cols = 7
  for (let i = 0; i < cols; i++) {
    const x0 = cx + (i - (cols - 1) / 2) * S * 0.075
    ctx.beginPath()
    for (let y = base - S * 0.12; y > h * 0.06; y -= 3 * s.dpr) {
      const k = (base - y) / (base - h * 0.06)
      const x = x0 + Math.sin(y * 0.03 / s.dpr - t * 2.2 + i * 1.3) * S * 0.018 * (0.3 + k) * (0.6 + s.warm)
      ctx.globalAlpha = Math.max(0, (1 - k) * 0.7 * s.warm)
      ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1

  // stones
  const stones = [
    [-0.2, 0.0, 0.17, 0.07, -0.05],
    [0.13, 0.01, 0.2, 0.08, 0.04],
    [-0.02, -0.075, 0.13, 0.055, 0.02],
  ]
  stones.forEach(([dx, dy, rx, ry, rot], i) => {
    const x = cx + dx * S
    const y = base + dy * S + Math.sin(t * 0.8 + i) * 0.6 * s.dpr
    const grd = ctx.createRadialGradient(x - rx * S * 0.35, y - ry * S * 0.6, 0, x, y, rx * S * 1.1)
    grd.addColorStop(0, '#6b5f55')
    grd.addColorStop(0.45, '#2c2622')
    grd.addColorStop(1, '#14110e')
    ctx.fillStyle = grd
    ctx.beginPath()
    ctx.ellipse(x, y, rx * S, ry * S, rot, 0, TAU)
    ctx.fill()
    // ember rim
    ctx.strokeStyle = `rgba(255,140,80,${0.35 + 0.5 * s.warm})`
    ctx.lineWidth = 1.5 * s.dpr
    ctx.beginPath()
    ctx.ellipse(x, y, rx * S, ry * S, rot, Math.PI * 0.05, Math.PI * 0.95)
    ctx.stroke()
  })
}

const DRAW = { classic, neck, point, wave, stone }

class Signet {
  constructor(canvas) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')
    this.kind = canvas.dataset.signet
    this.draw = DRAW[this.kind]
    this.state = { mini: canvas.hasAttribute('data-signet-mini'), dpr: Math.min(window.devicePixelRatio || 1, 2) }
    this.pointer = { x: 0, y: 0, inside: false }
    this.t = Math.random() * 10
    this.running = false
    this.colors = readColors(canvas)
    this.colorTimer = 0
    this.resize()

    new ResizeObserver(() => this.resize()).observe(canvas)
    const host = canvas.closest('.service') || canvas
    host.addEventListener('pointermove', (e) => {
      const r = canvas.getBoundingClientRect()
      this.pointer.x = (e.clientX - r.left) * this.state.dpr
      this.pointer.y = (e.clientY - r.top) * this.state.dpr
      this.pointer.inside = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom
    })
    host.addEventListener('pointerleave', () => (this.pointer.inside = false))
  }

  resize() {
    const { dpr } = this.state
    const w = Math.max(1, Math.round(this.canvas.clientWidth * dpr))
    const h = Math.max(1, Math.round(this.canvas.clientHeight * dpr))
    if (w !== this.canvas.width || h !== this.canvas.height) {
      this.canvas.width = w
      this.canvas.height = h
    }
    if (!this.running) this.frame(0)
  }

  frame(dt) {
    const { ctx, canvas } = this
    this.t += dt
    this.colorTimer -= dt
    if (this.colorTimer <= 0) {
      this.colors = readColors(canvas)
      this.colorTimer = 0.5
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    this.draw?.(ctx, canvas.width, canvas.height, this.t, this.pointer, this.colors, this.state)
  }

  start() {
    if (this.running) return
    this.running = true
    let last = performance.now()
    const loop = (now) => {
      if (!this.running) return
      this.frame(Math.min(0.05, (now - last) / 1000))
      last = now
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.raf)
  }
}

export function initSignets({ reduced = false } = {}) {
  const items = qsa('canvas[data-signet]').map((c) => new Signet(c))
  if (reduced) {
    // still images: draw once, in the right colours, when they come into view
    const still = new IntersectionObserver((entries) =>
      entries.forEach((entry) => {
        const s = items.find((i) => i.canvas === entry.target)
        if (!entry.isIntersecting || !s) return
        setTimeout(() => {
          s.colorTimer = 0
          s.frame(0)
        }, 950)
      }),
    )
    items.forEach((s) => still.observe(s.canvas))
    return items
  }
  const io = new IntersectionObserver(
    (entries) =>
      entries.forEach((entry) => {
        const s = items.find((i) => i.canvas === entry.target)
        if (!s) return
        s.visible = entry.isIntersecting
        s.visible && !document.hidden ? s.start() : s.stop()
      }),
    { rootMargin: '100px' },
  )
  items.forEach((s) => io.observe(s.canvas))
  document.addEventListener('visibilitychange', () => {
    items.forEach((s) => (document.hidden || !s.visible ? s.stop() : s.start()))
  })
  return items
}
