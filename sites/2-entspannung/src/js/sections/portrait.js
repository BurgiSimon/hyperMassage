import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, canHover, onVisibility } from '../utils/helpers.js'

gsap.registerPlugin(ScrollTrigger)

/**
 * The portrait arrives as a printed halftone and develops into the photo.
 * Under the pointer a small loupe shows the print screen again.
 */
export function initPortrait({ reduced }) {
  const fig = qs('[data-portrait]')
  const img = qs('[data-portrait-img]', fig)
  const canvas = qs('[data-portrait-canvas]', fig)
  if (!fig || !img || !canvas || reduced) return
  const ctx = canvas.getContext('2d')
  const css = getComputedStyle(document.documentElement)
  const INK = css.getPropertyValue('--ink').trim() || '#121212'
  const PAPER = css.getPropertyValue('--paper-2').trim() || '#e3ded5'

  const state = { d: 0, w: 0, h: 0, dpr: 1, lens: 0, lx: -999, ly: -999, cell: 8, lum: null, cols: 0, rows: 0, visible: false }
  let ready = false

  const prepare = () => {
    const r = fig.getBoundingClientRect()
    if (!r.width || !img.naturalWidth) return
    state.dpr = Math.min(window.devicePixelRatio || 1, 2)
    state.w = r.width
    state.h = r.height
    canvas.width = Math.round(r.width * state.dpr)
    canvas.height = Math.round(r.height * state.dpr)
    state.cell = Math.max(6, Math.round(r.width / 62))
    state.cols = Math.ceil(r.width / state.cell)
    state.rows = Math.ceil(r.height / state.cell)
    // sample luminance on a tiny canvas
    const s = document.createElement('canvas')
    s.width = state.cols
    s.height = state.rows
    const sx = s.getContext('2d', { willReadFrequently: true })
    sx.drawImage(img, 0, 0, state.cols, state.rows)
    const data = sx.getImageData(0, 0, state.cols, state.rows).data
    state.lum = new Float32Array(state.cols * state.rows)
    for (let i = 0; i < state.lum.length; i++) {
      const l = (0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2]) / 255
      // a bit of contrast so the face reads in dots
      state.lum[i] = Math.min(1, Math.max(0, (l - 0.5) * 1.25 + 0.5))
    }
    ready = true
    fig.classList.add('has-canvas')
    draw()
  }

  function draw() {
    if (!ready) return
    const { w, h, dpr, d, cell, cols, rows, lum, lens, lx, ly } = state
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.globalAlpha = 1
    ctx.fillStyle = PAPER
    ctx.fillRect(0, 0, w, h)
    if (d > 0) {
      ctx.globalAlpha = d
      ctx.drawImage(img, 0, 0, w, h)
      ctx.globalAlpha = 1
    }
    const R = Math.min(w, h) * 0.24
    // loupe: paper behind the dots
    if (lens > 0.01) {
      ctx.save()
      ctx.globalAlpha = lens * d
      ctx.beginPath()
      ctx.arc(lx, ly, R, 0, Math.PI * 2)
      ctx.fillStyle = PAPER
      ctx.fill()
      ctx.restore()
    }
    ctx.fillStyle = INK
    const grow = 1 - d
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const cx = x * cell + cell / 2
        const cy = y * cell + cell / 2
        let a = grow
        if (lens > 0.01) {
          const dist = Math.hypot(cx - lx, cy - ly)
          if (dist < R) a = Math.max(a, lens * (1 - (dist / R) ** 3))
        }
        if (a < 0.02) continue
        const L = lum[y * cols + x]
        const r = cell * 0.56 * Math.sqrt(1 - L) * Math.min(1, a * 1.4)
        if (r < 0.25) continue
        ctx.globalAlpha = Math.min(1, a * 1.6)
        ctx.beginPath()
        ctx.arc(cx, cy, r, 0, Math.PI * 2)
        ctx.fill()
      }
    }
    ctx.globalAlpha = 1
  }

  let raf = false
  const request = () => {
    if (raf) return
    raf = true
    requestAnimationFrame(() => {
      raf = false
      draw()
    })
  }

  const start = () => {
    prepare()
    ScrollTrigger.create({
      trigger: fig,
      start: 'top 75%',
      once: true,
      onEnter: () => gsap.to(state, { d: 1, duration: 2.6, ease: 'power2.inOut', delay: 0.15, onUpdate: request }),
    })
  }
  if (img.complete && img.naturalWidth) start()
  else img.addEventListener('load', start, { once: true })

  new ResizeObserver(() => ready && prepare()).observe(fig)
  onVisibility(fig, (v) => (state.visible = v))

  if (canHover()) {
    fig.setAttribute('data-cursor', 'Lupe')
    const lensTo = gsap.quickTo(state, 'lens', { duration: 0.6, ease: 'power3.out', onUpdate: request })
    fig.addEventListener('pointermove', (e) => {
      const r = fig.getBoundingClientRect()
      state.lx = e.clientX - r.left
      state.ly = e.clientY - r.top
      lensTo(1)
      request()
    })
    fig.addEventListener('pointerleave', () => lensTo(0))
  }
}
