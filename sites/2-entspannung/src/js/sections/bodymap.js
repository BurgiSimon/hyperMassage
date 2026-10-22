import gsap from 'gsap'
import { qs, qsa, clamp, lerp, onVisibility } from '../utils/helpers.js'
import { cursor } from '../core/cursor.js'

/*
 * «Wo drückt's?» – a body lying on the treatment table, drawn as a relief of
 * scan lines. Pick where it hurts: knots appear (red, restless lines). Rub
 * over them and they slowly let go. A suggestion for the right treatment
 * updates as you choose.
 */

// ───────────── body model (u: head → feet, v: across; body length = 1) ─────────────

const ellipse = (cu, cv, ru, rv, hh) => (u, v) => {
  const d = ((u - cu) / ru) ** 2 + ((v - cv) / rv) ** 2
  return d < 1 ? hh * Math.sqrt(1 - d) : 0
}
const capsule = (au, av, bu, bv, r0, r1, k = 0.85) => {
  const du = bu - au
  const dv = bv - av
  const len2 = du * du + dv * dv
  return (u, v) => {
    const t = clamp(((u - au) * du + (v - av) * dv) / len2)
    const r = lerp(r0, r1, t)
    const d = Math.hypot(u - (au + du * t), v - (av + dv * t))
    return d < r ? r * k * Math.sqrt(1 - (d / r) ** 2) : 0
  }
}
const smax = (a, b, k = 0.018) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.max(a, b) + h * h * k * 0.25
}

const PARTS = []
// head & neck
PARTS.push({ f: ellipse(0.066, 0, 0.064, 0.05, 0.052), zone: 'neck' })
PARTS.push({ f: capsule(0.11, 0, 0.165, 0, 0.034, 0.04, 0.75), zone: 'neck' })
// shoulders & back
PARTS.push({ f: capsule(0.185, -0.105, 0.185, 0.105, 0.05, 0.05, 0.9), zone: 'shoulders', torso: 1 })
PARTS.push({ f: ellipse(0.265, 0, 0.115, 0.122, 0.074), torso: 1 })
PARTS.push({ f: ellipse(0.375, 0, 0.085, 0.09, 0.062), torso: 1 })
PARTS.push({ f: ellipse(0.455, 0, 0.075, 0.104, 0.064), torso: 0.5 })
PARTS.push({ f: ellipse(0.5, -0.048, 0.06, 0.052, 0.078) })
PARTS.push({ f: ellipse(0.5, 0.048, 0.06, 0.052, 0.078) })
// arms along the body
for (const s of [-1, 1]) {
  PARTS.push({ f: capsule(0.2, 0.135 * s, 0.355, 0.155 * s, 0.036, 0.03) })
  PARTS.push({ f: capsule(0.355, 0.155 * s, 0.505, 0.162 * s, 0.03, 0.024) })
  PARTS.push({ f: ellipse(0.54, 0.164 * s, 0.038, 0.024, 0.02) })
  // legs
  PARTS.push({ f: capsule(0.52, 0.05 * s, 0.725, 0.056 * s, 0.06, 0.042) })
  PARTS.push({ f: capsule(0.725, 0.056 * s, 0.905, 0.05 * s, 0.043, 0.027) })
  PARTS.push({ f: ellipse(0.935, 0.05 * s, 0.038, 0.026, 0.03) })
}

const U0 = -0.04
const U1 = 1.04
const V0 = -0.29
const V1 = 0.29
const NU = 300
const NV = 132

function buildField() {
  const base = new Float32Array(NU * NV)
  const torso = new Float32Array(NU * NV)
  for (let j = 0; j < NV; j++) {
    const v = V0 + ((V1 - V0) * j) / (NV - 1)
    for (let i = 0; i < NU; i++) {
      const u = U0 + ((U1 - U0) * i) / (NU - 1)
      let h = 0
      let tor = 0
      for (const p of PARTS) {
        const hp = p.f(u, v)
        if (hp > 0) {
          h = smax(h, hp)
          if (p.torso) tor = Math.max(tor, (hp / 0.08) * p.torso)
        }
      }
      base[j * NU + i] = h
      torso[j * NU + i] = Math.min(1, tor)
    }
  }
  return { base, torso }
}

const sample = (field, u, v) => {
  const x = ((u - U0) / (U1 - U0)) * (NU - 1)
  const y = ((v - V0) / (V1 - V0)) * (NV - 1)
  if (x < 0 || y < 0 || x >= NU - 1 || y >= NV - 1) return 0
  const i = x | 0
  const j = y | 0
  const fx = x - i
  const fy = y - j
  const a = field[j * NU + i]
  const b = field[j * NU + i + 1]
  const c = field[(j + 1) * NU + i]
  const d = field[(j + 1) * NU + i + 1]
  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy
}

// ───────────── zones ─────────────

export const ZONES = {
  neck: { label: 'Kopf & Nacken', acc: 'Kopf und Nacken', pts: [[0.07, 0, 0.07], [0.14, 0, 0.05]] },
  shoulders: { label: 'Schultern', acc: 'die Schultern', pts: [[0.19, -0.095, 0.062], [0.19, 0.095, 0.062]] },
  upper: { label: 'Oberer Rücken', acc: 'den oberen Rücken', pts: [[0.27, 0, 0.085], [0.26, -0.065, 0.06], [0.26, 0.065, 0.06]] },
  lower: { label: 'Unterer Rücken', acc: 'den unteren Rücken', pts: [[0.405, 0, 0.075], [0.4, -0.05, 0.05], [0.4, 0.05, 0.05]] },
  arms: {
    label: 'Arme & Hände',
    acc: 'Arme und Hände',
    pts: [[0.28, -0.148, 0.05], [0.43, -0.158, 0.05], [0.535, -0.163, 0.04], [0.28, 0.148, 0.05], [0.43, 0.158, 0.05], [0.535, 0.163, 0.04]],
  },
  legs: {
    label: 'Beine',
    acc: 'die Beine',
    pts: [[0.6, -0.052, 0.07], [0.76, -0.053, 0.06], [0.88, -0.05, 0.05], [0.6, 0.052, 0.07], [0.76, 0.053, 0.06], [0.88, 0.05, 0.05]],
  },
}
const ZONE_KEYS = Object.keys(ZONES)

const zoneWeight = (key, u, v) => {
  let w = 0
  for (const [cu, cv, r] of ZONES[key].pts) {
    const d = Math.hypot(u - cu, v - cv) / r
    if (d < 1) w = Math.max(w, (1 - d * d) ** 2)
  }
  return w
}

const zoneAt = (u, v) => {
  let best = null
  let bestD = 1
  for (const key of ZONE_KEYS) {
    for (const [cu, cv, r] of ZONES[key].pts) {
      const d = Math.hypot(u - cu, v - cv) / (r * 1.15)
      if (d < bestD) {
        bestD = d
        best = key
      }
    }
  }
  return best
}

// ───────────── recommendation ─────────────

const PRICE = { 30: 45, 45: 65, 60: 85 }
const list = (arr) => (arr.length < 2 ? arr.join('') : `${arr.slice(0, -1).join(', ')} und ${arr[arr.length - 1]}`)

export function recommend(zones, needs) {
  const names = zones.map((z) => ZONES[z].label)
  const acc = zones.map((z) => ZONES[z].acc)
  const where = acc.length ? ` – mit Fokus auf ${list(acc)}` : ''
  let service
  let dur
  let text
  if (!zones.length && !needs.length) return null
  if (needs.includes('pain')) {
    service = 'Manuelle Schmerztherapie'
    dur = zones.length > 1 ? 45 : 30
    text = `Punktgenaue Grifftechniken bei muskulären Schmerzen, abgestimmt auf dein Empfinden${where}.`
    if (needs.includes('warm')) text += ' Wärme können wir gerne einbauen.'
  } else if (needs.includes('warm')) {
    service = 'Hot-Stone-Massage'
    dur = 60
    text = `Warme Lavasteine und ruhige Griffe: eine äusserst entspannende Ganzkörpermassage${where}.`
  } else if (needs.includes('deep')) {
    service = 'Schwingkissen-Therapie'
    dur = 45
    text = `Sanfte Schwingungen lockern auch die tiefliegende Muskulatur${where}.`
  } else if (zones.every((z) => z === 'neck' || z === 'shoulders')) {
    service = 'Nacken-Schultermassage'
    dur = zones.length > 1 ? 45 : 30
    text = 'Gezielt dort, wo sich der Alltag gerne festsetzt: Nacken, Schultern und Halswirbelsäule.'
  } else if (zones.length >= 3) {
    service = 'Klassische Massage'
    dur = 60
    text = `Eine Ganzkörpermassage löst Verspannungen, fördert die Durchblutung und lässt dich abschalten${where}.`
  } else {
    service = 'Klassische Massage'
    dur = zones.length > 1 ? 45 : 30
    text = `Eine Teilmassage löst Verspannungen und fördert die Durchblutung${where}.`
  }
  const price = PRICE[dur] + (service === 'Hot-Stone-Massage' ? 15 : 0)
  return {
    service,
    dur,
    price,
    text,
    note: names.length ? `Spannung spüre ich vor allem: ${list(names)}.` : '',
  }
}

// ───────────── drawing ─────────────

export function initBodyMap({ reduced }) {
  const root = qs('[data-bodymap]')
  if (!root) return
  const stage = qs('[data-bodymap-stage]', root)
  const canvas = qs('[data-bodymap-canvas]', root)
  const tip = qs('[data-bodymap-tip]', root)
  const hint = qs('[data-bodymap-hint]', root)
  const result = qs('[data-bodymap-result]', root)
  const recTitle = qs('[data-rec-title]', root)
  const recText = qs('[data-rec-text]', root)
  const recCta = qs('[data-rec-cta]', root)
  const recReset = qs('[data-rec-reset]', root)
  const zoneBtns = qsa('[data-zone]', root)
  const needBtns = qsa('[data-need]', root)
  const ctx = canvas.getContext('2d')
  const field = buildField()

  const css = getComputedStyle(document.documentElement)
  const INK = css.getPropertyValue('--ink').trim() || '#121212'
  const TENSE = css.getPropertyValue('--tense').trim() || '#ff4521'
  const BG = css.getPropertyValue('--paper-2').trim() || '#e3ded5'
  const CALM = css.getPropertyValue('--calm-deep').trim() || '#5544d0'

  const zones = Object.fromEntries(ZONE_KEYS.map((k) => [k, { on: false, t: 0, target: 0, vel: 0, rubbed: false }]))
  const state = { w: 0, h: 0, dpr: 1, portrait: false, visible: false, hover: null, px: -1, py: -1, time: 0, lastPx: 0, lastPy: 0 }

  const resize = () => {
    const r = stage.getBoundingClientRect()
    state.dpr = Math.min(window.devicePixelRatio || 1, 2)
    state.w = r.width
    state.h = r.height
    state.portrait = r.height > r.width * 1.05
    canvas.width = Math.round(r.width * state.dpr)
    canvas.height = Math.round(r.height * state.dpr)
    draw()
  }

  // screen ↔ body mapping. Landscape: body lies left → right, each scan line is a
  // lengthwise slice. Portrait: body lies top → bottom, each line is a cross-section.
  const layout = () => {
    const { w, h, portrait } = state
    if (!portrait) {
      const lines = Math.round(clamp(h / 7.5, 34, 64))
      return {
        lines,
        lineV: (i) => lerp(V0 + 0.04, V1 - 0.04, i / (lines - 1)),
        baseY: (i) => lerp(h * 0.16, h * 0.92, i / (lines - 1)),
        xToBody: (x, i) => [lerp(U0, U1, (x - w * 0.05) / (w * 0.9)), lerp(V0 + 0.04, V1 - 0.04, i / (lines - 1))],
        lift: h * 1.8,
        x0: 0,
        x1: w,
      }
    }
    const lines = Math.round(clamp(h / 8.5, 46, 90))
    return {
      lines,
      baseY: (i) => lerp(h * 0.1, h * 0.96, i / (lines - 1)),
      xToBody: (x, i) => [lerp(U0, U1, i / (lines - 1)), lerp(V0, V1, (x - w * 0.02) / (w * 0.96))],
      lift: w * 0.9,
      x0: 0,
      x1: w,
    }
  }

  const heightAt = (u, v, t) => {
    let hgt = sample(field.base, u, v)
    if (hgt <= 0) return { hgt: 0, k: 0, calm: 0 }
    // breathing: the back rises and falls
    const tor = sample(field.torso, u, v)
    hgt *= 1 + tor * 0.06 * Math.sin(t * 1.1)
    let k = 0
    let calm = 0
    for (const key of ZONE_KEYS) {
      const z = zones[key]
      if (z.t < 0.01 && !(z.on && z.rubbed)) continue
      const wgt = zoneWeight(key, u, v)
      if (!wgt) continue
      k = Math.max(k, z.t * wgt)
      if (z.on && z.rubbed) calm = Math.max(calm, wgt * (1 - z.t))
      if (z.t > 0.01) {
        // knots: restless, crumpled lines
        hgt += z.t * wgt * 0.0085 * (Math.sin(u * 105 + t * 3.2) * Math.cos(v * 92 - t * 2.4) + Math.sin(u * 190 - t * 5.5) * 0.35)
      }
    }
    return { hgt, k, calm }
  }

  function draw() {
    const { w, h, dpr, time } = state
    if (!w) return
    const L = layout()
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.fillStyle = BG
    ctx.fillRect(0, 0, w, h)
    const step = state.portrait ? 3 : 4
    for (let i = 0; i < L.lines; i++) {
      const by = L.baseY(i)
      const pts = []
      const ks = []
      const cs = []
      for (let x = L.x0 - step; x <= L.x1 + step; x += step) {
        const [u, v] = L.xToBody(x, i)
        const { hgt, k, calm } = heightAt(u, v, time)
        pts.push(x, by - hgt * L.lift)
        ks.push(k)
        cs.push(calm)
      }
      // occlude the lines behind
      ctx.beginPath()
      ctx.moveTo(pts[0], h)
      for (let p = 0; p < pts.length; p += 2) ctx.lineTo(pts[p], pts[p + 1])
      ctx.lineTo(pts[pts.length - 2], h)
      ctx.closePath()
      ctx.fillStyle = BG
      ctx.fill()
      // the line itself
      ctx.beginPath()
      for (let p = 0; p < pts.length; p += 2) (p ? ctx.lineTo : ctx.moveTo).call(ctx, pts[p], pts[p + 1])
      ctx.strokeStyle = INK
      ctx.globalAlpha = 0.78
      ctx.lineWidth = 1.15
      ctx.stroke()
      ctx.globalAlpha = 1
      // tension runs in red
      let run = false
      ctx.beginPath()
      for (let p = 0, q = 0; p < pts.length; p += 2, q++) {
        if (ks[q] > 0.08) {
          if (!run) ctx.moveTo(pts[p], pts[p + 1])
          else ctx.lineTo(pts[p], pts[p + 1])
          run = true
        } else run = false
      }
      ctx.strokeStyle = TENSE
      ctx.lineWidth = 2.2
      ctx.stroke()
      // released knots glow calm
      run = false
      ctx.beginPath()
      for (let p = 0, q = 0; p < pts.length; p += 2, q++) {
        if (cs[q] > 0.25) {
          if (!run) ctx.moveTo(pts[p], pts[p + 1])
          else ctx.lineTo(pts[p], pts[p + 1])
          run = true
        } else run = false
      }
      ctx.strokeStyle = CALM
      ctx.lineWidth = 2
      ctx.stroke()
    }
  }

  // pointer → body coordinates (iterate once to account for the lift)
  const pick = (px, py) => {
    const L = layout()
    let best = null
    let bestD = Infinity
    for (let i = 0; i < L.lines; i++) {
      const [u, v] = L.xToBody(px, i)
      const { hgt } = heightAt(u, v, state.time)
      const y = L.baseY(i) - hgt * L.lift
      const d = Math.abs(y - py)
      if (d < bestD && hgt > 0.002) {
        bestD = d
        best = [u, v]
      }
    }
    if (!best || bestD > 26) return null
    return zoneAt(best[0], best[1])
  }

  // ───────────── state & UI ─────────────

  const selected = () => ZONE_KEYS.filter((k) => zones[k].on)
  const needs = () => needBtns.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.dataset.need)

  const renderRec = () => {
    const rec = recommend(selected(), needs())
    result.classList.toggle('is-empty', !rec)
    recReset.hidden = !rec
    if (!rec) {
      recTitle.textContent = 'Wähle eine oder mehrere Stellen.'
      recText.textContent = 'Ganz gleich, wo es zieht: Zu Beginn jeder Behandlung nehme ich mir Zeit für ein kurzes Gespräch.'
      return
    }
    recTitle.innerHTML = `${rec.service}<br><em>${rec.dur} Minuten · CHF ${rec.price}</em>`
    recText.textContent = rec.text
    recCta.dataset.service = rec.service
    recCta.dataset.dur = rec.dur
    recCta.dataset.note = rec.note
    if (!reduced) gsap.fromTo(recTitle, { fontStretch: '56%', fontWeight: 900 }, { fontStretch: '84%', fontWeight: 700, duration: 1.2, ease: 'elastic.out(1, 0.5)', clearProps: 'fontStretch,fontWeight' })
  }

  const setZone = (key, on) => {
    const z = zones[key]
    z.on = on
    z.rubbed = false
    z.target = on ? 1 : 0
    if (reduced) z.t = z.target
    zoneBtns.find((b) => b.dataset.zone === key)?.setAttribute('aria-pressed', String(on))
    renderRec()
    wake()
  }

  zoneBtns.forEach((b) => b.addEventListener('click', () => setZone(b.dataset.zone, b.getAttribute('aria-pressed') !== 'true')))
  needBtns.forEach((b) =>
    b.addEventListener('click', () => {
      b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))
      renderRec()
    }),
  )
  recReset.addEventListener('click', () => {
    ZONE_KEYS.forEach((k) => zones[k].on && setZone(k, false))
    needBtns.forEach((b) => b.setAttribute('aria-pressed', 'false'))
    renderRec()
  })

  // canvas interaction
  let downAt = null
  stage.addEventListener('pointermove', (e) => {
    const r = stage.getBoundingClientRect()
    const px = e.clientX - r.left
    const py = e.clientY - r.top
    const key = pick(px, py)
    const c = cursor()
    if (key !== state.hover) {
      state.hover = key
      const z = key && zones[key]
      c?.label(key ? (z.on ? `${ZONES[key].label} · ${z.rubbed ? 'gelöst' : 'reiben'}` : ZONES[key].label) : null)
    }
    if (key) {
      // with a custom cursor the label rides on the cursor; on touch a small tag appears
      if (!c) {
        tip.textContent = zones[key].on ? `${ZONES[key].label} – reiben zum Lösen` : ZONES[key].label
        tip.style.left = `${px}px`
        tip.style.top = `${py}px`
        tip.classList.add('is-on')
      }
      // rubbing a knot slowly lets it go
      const speed = Math.hypot(px - state.lastPx, py - state.lastPy)
      const z = zones[key]
      if (z.on && !z.rubbed && speed > 2 && (e.pointerType === 'mouse' || downAt)) {
        z.target = Math.max(0.12, z.target - speed * 0.0026)
        if (z.target <= 0.13 && !z.rubbed) {
          z.rubbed = true
          z.target = 0
          if (c) c.label(`${ZONES[key].label} · gelöst`)
          else tip.textContent = `${ZONES[key].label} – gelöst`
        }
      }
    } else tip.classList.remove('is-on')
    state.lastPx = px
    state.lastPy = py
    wake()
  })
  stage.addEventListener('pointerleave', () => {
    state.hover = null
    tip.classList.remove('is-on')
    cursor()?.label(null)
  })
  stage.addEventListener('pointerdown', (e) => {
    const r = stage.getBoundingClientRect()
    downAt = { x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }
  })
  stage.addEventListener('pointerup', (e) => {
    if (!downAt) return
    const r = stage.getBoundingClientRect()
    const px = e.clientX - r.left
    const py = e.clientY - r.top
    const moved = Math.hypot(px - downAt.x, py - downAt.y)
    downAt = null
    if (moved > 10) return
    const key = pick(px, py)
    if (key) {
      setZone(key, !zones[key].on)
      hint.style.opacity = 0
    }
  })
  stage.addEventListener('pointercancel', () => (downAt = null))

  // ───────────── loop ─────────────

  let running = false
  let idle = 0
  const loop = (_, deltaMs) => {
    const dt = Math.min(deltaMs / 1000, 1 / 30)
    if (!reduced) state.time += dt
    let moving = false
    for (const key of ZONE_KEYS) {
      const z = zones[key]
      const a = -90 * (z.t - z.target) - 12 * z.vel
      z.vel += a * dt
      z.t = clamp(z.t + z.vel * dt, 0, 1.2)
      if (Math.abs(z.t - z.target) > 0.002 || Math.abs(z.vel) > 0.002) moving = true
    }
    draw()
    // keep breathing while visible; when reduced, stop as soon as everything settled
    if (reduced && !moving) idle++
    else idle = 0
    if (!state.visible || idle > 2) stop()
  }
  const wake = () => {
    if (running || !state.visible) return
    running = true
    idle = 0
    gsap.ticker.add(loop)
  }
  const stop = () => {
    running = false
    gsap.ticker.remove(loop)
  }

  onVisibility(stage, (v) => {
    state.visible = v
    if (v) wake()
  })
  new ResizeObserver(resize).observe(stage)
  resize()
  renderRec()
}
