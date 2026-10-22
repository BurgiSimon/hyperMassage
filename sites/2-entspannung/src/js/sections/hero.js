import gsap from 'gsap'
import { qs, qsa, clamp, smoothstep, onVisibility } from '../utils/helpers.js'
import { pointer } from '../core/pointer.js'
import { spring } from '../core/kinetic.js'

const W_TENSE = 50
const W_LOOSE = 140
const G_TENSE = 900
const G_LOOSE = 200

// cheap smooth noise for the tremor
const noise = (t, seed) => Math.sin(t * 1.7 + seed) * 0.5 + Math.sin(t * 3.1 + seed * 2.3) * 0.3 + Math.sin(t * 5.3 + seed * 0.7) * 0.2

/**
 * «SPANNUNG» → «ENTSPANNUNG».
 * The word starts clenched and trembling; scrolling releases it, the missing
 * «ENT» breathes in, and every letter relaxes into a wide, light cut.
 * Touching the letters relaxes them locally – you can knead the word.
 */
export function initHero({ reduced }) {
  const hero = qs('[data-hero]')
  const word = qs('[data-hero-word]')
  const inner = qs('[data-kword-in]')
  const title = qs('.hero__title')
  const hint = qs('[data-hero-hint]')
  if (!hero || !word || !inner) return { playIntro() {} }

  const letters = qsa('.kl', inner).map((node, i) => ({
    node,
    ent: node.classList.contains('is-ent'),
    local: { v: 0, vel: 0 },
    intro: { y: reduced || node.classList.contains('is-ent') ? 0 : 1.15 },
    seed: i * 12.9898,
    cx: 0,
  }))

  const state = { m: reduced ? 1 : 0, target: reduced ? 1 : 0, visible: true, intro: reduced, t: 0 }
  word.setAttribute('data-cursor', 'Massieren')

  const progress = () => {
    const dist = Math.max(1, hero.offsetHeight - window.innerHeight)
    return clamp(window.scrollY / (dist * 0.82))
  }

  const ease = (x) => x * x * (3 - 2 * x)

  let lastFont = 0
  const render = (dt) => {
    state.t += dt
    // pointer kneading
    const near = pointer.active && state.intro
    if (near) {
      for (const l of letters) {
        const r = l.node.getBoundingClientRect()
        l.cx = r.left + r.width / 2
        l.cy = r.top + r.height / 2
        l.h = r.height
      }
    }
    const m = state.m
    const tremor = reduced ? 0 : (1 - m) * 1
    let maxMove = 0
    for (const l of letters) {
      let target = 0
      if (near) {
        const dx = (pointer.x - l.cx) / Math.max(120, l.h * 0.9)
        const dy = (pointer.y - l.cy) / Math.max(160, l.h * 1.2)
        target = Math.max(0, 1 - Math.hypot(dx, dy)) ** 1.5
      }
      spring(l.local, target, dt, { stiffness: 120, damping: 11 })
      maxMove = Math.max(maxMove, Math.abs(l.local.v - target) + Math.abs(l.local.vel))
      const r = clamp(1 - (1 - m) * (1 - clamp(l.local.v, -0.3, 1.2)), -0.2, 1.15)
      const e = ease(clamp(r))
      const over = r - clamp(r) // springs may overshoot past fully relaxed
      const wdth = clamp(W_TENSE + (W_LOOSE - W_TENSE) * e + over * 30, 50, 150)
      const wght = clamp(G_TENSE + (G_LOOSE - G_TENSE) * e - over * 60, 100, 900)
      l.node.style.fontStretch = `${wdth.toFixed(1)}%`
      l.node.style.fontWeight = wght.toFixed(0)
      let presence = 1
      if (l.ent) {
        presence = smoothstep(0.08, 0.62, m)
        l.node.style.fontSize = `${presence.toFixed(3)}em`
        l.node.style.opacity = presence.toFixed(3)
      }
      const amp = tremor * (1 - clamp(l.local.v)) * 1.6
      const jx = amp * noise(state.t * 9, l.seed)
      const jy = amp * noise(state.t * 11, l.seed + 4.1)
      l.node.style.transform = `translate(${jx.toFixed(2)}px, calc(${(l.intro.y * 100).toFixed(2)}% + ${jy.toFixed(2)}px))`
    }
    inner.style.color = `color-mix(in oklch, var(--tense), var(--ink) ${(smoothstep(0.1, 0.75, m) * 100).toFixed(1)}%)`
    inner.style.letterSpacing = `${(-0.02 + 0.03 * m).toFixed(4)}em`

    // fit the word to the stage: full width, but never taller than the room it has
    const fs = parseFloat(inner.style.fontSize) || 100
    const w = inner.getBoundingClientRect().width
    const avail = word.clientWidth * 0.985
    const maxByHeight = (title.clientHeight * 0.98) / 0.8
    if (w) {
      const next = Math.min((fs * avail) / w, maxByHeight)
      if (Math.abs(next - lastFont) > 0.1) {
        inner.style.fontSize = `${next.toFixed(2)}px`
        lastFont = next
      }
    }
    return maxMove
  }

  let idleFrames = 0
  const tick = (_, deltaMs) => {
    if (!state.visible) return
    const dt = Math.min(deltaMs / 1000, 1 / 30)
    if (!reduced) state.target = progress()
    const prev = state.m
    state.m += (state.target - state.m) * (1 - Math.exp(-dt * 7))
    if (Math.abs(state.target - state.m) < 0.0005) state.m = state.target
    hero.classList.toggle('is-released', state.m > 0.92)
    const moving = render(dt)
    // fully relaxed and nobody touching: no need to keep rendering every frame
    if (state.m >= 0.999 && Math.abs(prev - state.m) < 1e-4 && moving < 0.001 && !pointer.active) idleFrames++
    else idleFrames = 0
  }

  const loop = (time, deltaMs) => {
    if (idleFrames > 30 && !pointer.active && Math.abs(progress() - state.m) < 0.001) return
    tick(time, deltaMs)
  }
  gsap.ticker.add(loop)
  onVisibility(hero, (v) => (state.visible = v))

  const refit = () => {
    lastFont = 0
    render(0)
  }
  window.addEventListener('resize', refit)
  document.fonts?.ready.then(refit)
  render(0)

  return {
    playIntro() {
      if (reduced) {
        state.intro = true
        return
      }
      gsap.to(
        letters.filter((l) => !l.ent).map((l) => l.intro),
        {
          y: 0,
          duration: 1.3,
          ease: 'expo.out',
          stagger: 0.055,
          onComplete: () => (state.intro = true),
        },
      )
      if (hint) gsap.fromTo(hint, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1, delay: 1.1 })
    },
    get m() {
      return state.m
    },
  }
}
