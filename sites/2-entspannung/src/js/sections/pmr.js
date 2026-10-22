import gsap from 'gsap'
import { qs, qsa, clamp, onVisibility } from '../utils/helpers.js'

/*
 * Progressive muscle relaxation in three steps. Hold the button: the muscle
 * group – and the whole page with it – tenses. Let go: everything springs loose.
 */
const STEPS = [
  { cue: 'Hände', tense: 'Balle die Hände zu Fäusten …', short: 'Hände zu Fäusten ballen' },
  { cue: 'Schultern', tense: 'Zieh die Schultern hoch zu den Ohren …', short: 'Schultern zu den Ohren ziehen' },
  { cue: 'Gesicht', tense: 'Kneif das Gesicht zusammen …', short: 'Gesicht zusammenkneifen' },
]
const HOLD = 5 // seconds
const MIN_HOLD = 2.5

export function initPmr({ reduced }) {
  const root = qs('[data-pmr]')
  if (!root) return
  const btn = qs('[data-pmr-btn]', root)
  const fill = qs('[data-pmr-fill]', root)
  const label = qs('[data-pmr-label]', root)
  const status = qs('[data-pmr-status]', root)
  const cue = qs('[data-pmr-cue] span', root)
  const steps = qsa('[data-pmr-steps] li', root)
  const html = document.documentElement
  const C = 2 * Math.PI * 92

  const state = { step: 0, holding: false, held: 0, press: 0, vel: 0, target: 0, resting: false, done: false, t: 0 }
  let restTimer = null
  let running = false

  const vibrate = (p) => {
    try {
      navigator.vibrate?.(p)
    } catch {}
  }

  const setStep = (i) => {
    state.step = i
    steps.forEach((li, j) => {
      li.classList.toggle('is-current', j === i && !state.done)
      li.classList.toggle('is-done', j < i || state.done)
    })
    cue.textContent = state.done ? 'Locker' : STEPS[i].cue
    if (!state.done) status.textContent = `Schritt ${i + 1} von 3: ${STEPS[i].short}. Halte den Knopf gedrückt.`
    label.textContent = state.done ? 'Nochmals' : 'Gedrückt halten'
  }

  const tick = (_, deltaMs) => {
    const dt = Math.min(deltaMs / 1000, 1 / 30)
    state.t += dt
    if (state.holding) {
      state.held += dt
      state.target = clamp(state.held / 1.2) * (reduced ? 1 : 1 + 0.04 * Math.sin(state.t * 38))
      if (state.held >= HOLD && !state.prompted) {
        state.prompted = true
        status.textContent = 'Und jetzt: loslassen.'
        label.textContent = 'Loslassen'
        vibrate([30, 60, 30])
      }
    }
    // underdamped spring: letting go overshoots into "extra loose" and settles
    const a = -110 * (state.press - state.target) - (state.holding ? 22 : 7) * state.vel
    state.vel += a * dt
    state.press += state.vel * dt
    const p = clamp(state.press, -0.6, 1.1)
    html.style.setProperty('--press', p.toFixed(3))
    html.classList.toggle('is-squeezing', !reduced && Math.abs(p) > 0.005)
    fill.style.strokeDashoffset = (C * (1 - clamp(state.held / HOLD))).toFixed(1)
    const settled = !state.holding && Math.abs(state.press) < 0.002 && Math.abs(state.vel) < 0.002
    if (settled) {
      html.style.setProperty('--press', 0)
      html.classList.remove('is-squeezing')
      stop()
    }
  }
  const start = () => {
    if (running) return
    running = true
    gsap.ticker.add(tick)
  }
  const stop = () => {
    running = false
    gsap.ticker.remove(tick)
  }

  const press = () => {
    if (state.holding) return
    clearTimeout(restTimer)
    if (state.done) {
      state.done = false
      setStep(0)
    }
    state.holding = true
    state.held = 0
    state.prompted = false
    state.resting = false
    root.classList.add('is-holding')
    status.textContent = STEPS[state.step].tense
    label.textContent = 'Halten …'
    vibrate(25)
    start()
  }

  const release = () => {
    if (!state.holding) return
    state.holding = false
    root.classList.remove('is-holding')
    state.target = 0
    vibrate(0)
    start()
    if (state.held < MIN_HOLD) {
      status.textContent = 'Etwas länger halten – ein paar Sekunden, bis es richtig spannt.'
      label.textContent = 'Gedrückt halten'
      gsap.to(state, { held: 0, duration: 0.5, onUpdate: () => (fill.style.strokeDashoffset = (C * (1 - clamp(state.held / HOLD))).toFixed(1)) })
      return
    }
    // the release: a little kick into "extra loose"
    state.vel = -6
    state.resting = true
    status.textContent = 'Loslassen. Spüre, wie die Spannung abfliesst.'
    label.textContent = 'Spüren …'
    gsap.to(state, { held: 0, duration: 2.2, ease: 'power2.inOut' })
    restTimer = setTimeout(() => {
      state.resting = false
      if (state.step < STEPS.length - 1) setStep(state.step + 1)
      else {
        state.done = true
        setStep(state.step)
        status.textContent = 'Geschafft. So fühlt sich der Anfang einer Massage an.'
      }
    }, 3600)
  }

  btn.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return
    e.preventDefault()
    btn.setPointerCapture?.(e.pointerId)
    press()
  })
  btn.addEventListener('pointerup', release)
  btn.addEventListener('pointercancel', release)
  btn.addEventListener('lostpointercapture', release)
  btn.addEventListener('contextmenu', (e) => e.preventDefault())
  btn.addEventListener('keydown', (e) => {
    if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
      e.preventDefault()
      press()
    }
  })
  btn.addEventListener('keyup', (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      release()
    }
  })
  btn.addEventListener('blur', release)
  // scrolling away mid-exercise lets go too
  onVisibility(root, (v) => !v && release())

  setStep(0)
}
