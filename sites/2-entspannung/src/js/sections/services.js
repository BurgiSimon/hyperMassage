import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, qsa, clamp, canHover, onVisibility, onWidthChange } from '../utils/helpers.js'
import { Kinetic } from '../core/kinetic.js'
import { pointer } from '../core/pointer.js'

/*
 * The treatment index. Each name moves the way the treatment feels:
 * kneading waves, shoulders that sink, a single pressure point,
 * a gentle swing, and warmth that spreads.
 */
const GESTURES = {
  knead: (l, i, t) => ({ k: -0.62 * (0.5 + 0.5 * Math.sin(t * 4.2 - i * 0.55)) }),
  sink: (l, i, t) => {
    const p = clamp(t * 1.4 - i * 0.035)
    return { k: -0.5 * p, y: 9 * Math.sin((p * Math.PI) / 2) }
  },
  point: (l, i, t, n, ctx) => {
    const d = Math.abs(i - ctx.focus)
    const cycle = (t % 1.8) / 1.8
    const press = cycle < 0.35 ? cycle / 0.35 : Math.max(0, 1 - (cycle - 0.35) / 0.2)
    if (d === 0) return { k: press > 0 ? 1.1 * press - 0.5 * (1 - press) : -0.5 }
    return { k: -0.25 * Math.max(0, 1 - d / 4) * (1 - press) }
  },
  swing: (l, i, t) => {
    const env = 0.35 + 0.65 * Math.exp(-t * 0.5)
    return { k: -0.22, x: 9 * env * Math.sin(t * 5.2 - i * 0.32) }
  },
  heat: (l, i, t, n, ctx) => {
    const d = Math.abs(i - ctx.focus)
    const h = clamp(t * 0.9 - d * 0.07)
    return { k: -0.55 * h, heat: h }
  },
}

export function initServices({ reduced }) {
  const rows = qsa('[data-services] .srow')
  if (!rows.length) return
  const hover = canHover() && !reduced

  rows.forEach((row) => {
    const btn = qs('[data-srow-btn]', row)
    const body = qs('[data-srow-body]', row)
    const name = qs('[data-srow-name]', row)
    const gesture = GESTURES[row.dataset.gesture]
    body.inert = true
    let kin = null
    let started = 0
    const ctx = { focus: 0 }

    const ensure = () => {
      if (kin || reduced) return kin
      kin = new Kinetic(name, {
        knead: false,
        move: true,
        onLetter: (l, g) => {
          if (g && 'heat' in g) l.node.style.setProperty('--heat', g.heat.toFixed(3))
        },
      })
      onVisibility(name, (v) => kin.setVisible(v), '50px')
      return kin
    }

    const focusFromPointer = () => {
      if (!kin) return
      let best = 0
      let bestD = Infinity
      kin.letters.forEach((l, i) => {
        const r = l.node.getBoundingClientRect()
        const d = Math.abs(pointer.x - (r.left + r.width / 2))
        if (d < bestD) {
          bestD = d
          best = i
        }
      })
      ctx.focus = best
    }

    const play = (duration = 0) => {
      const k = ensure()
      if (!k) return
      started = k.t
      ctx.focus = Math.floor(k.letters.length / 2)
      k.gesture = (l, i, t, n) => gesture(l, i, t - started, n, ctx)
      k.wake()
      if (duration) {
        clearTimeout(row._t)
        row._t = setTimeout(stop, duration)
      }
    }
    const stop = () => {
      if (!kin) return
      kin.gesture = null
      kin.letters.forEach((l) => l.node.style.removeProperty('--heat'))
      kin.wake()
    }

    onWidthChange(() => kin?.rebuild())

    if (hover) {
      row.addEventListener('pointerenter', () => {
        play()
        focusFromPointer()
      })
      row.addEventListener('pointermove', focusFromPointer)
      row.addEventListener('pointerleave', stop)
    }

    btn.addEventListener('click', () => {
      const open = !row.classList.contains('is-open')
      row.classList.toggle('is-open', open)
      btn.setAttribute('aria-expanded', String(open))
      body.inert = !open
      // on touch screens the treatment moves once when you open it
      if (open && !hover && !reduced) play(2200)
      clearTimeout(row._r)
      row._r = setTimeout(() => ScrollTrigger.refresh(), 750)
    })
  })
}
