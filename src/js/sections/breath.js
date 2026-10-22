import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, qsa, setRollText } from '../utils/helpers.js'

gsap.registerPlugin(ScrollTrigger)

const IN = 4
const HOLD = 2
const OUT = 6
const CYCLES = 5

/** A one-minute guided breathing moment. */
export function initBreath({ reduced, emit }) {
  const stage = qs('[data-breath]')
  if (!stage) return
  const orb = qs('[data-breath-orb]', stage)
  const label = qs('[data-breath-label]', stage)
  const count = qs('[data-breath-count]', stage)
  const arc = qs('[data-breath-arc]', stage)
  const rings = qsa('.breath__rings circle:not(.breath__track):not(.breath__arc)', stage)
  const btn = qs('[data-breath-start]')
  const btnLabel = qs('[data-breath-btn-label]')
  const progress = qs('[data-breath-progress]')
  const ARC = 2 * Math.PI * 270

  const SMALL = 0.58
  const BIG = 1

  const setLabel = (text) => {
    if (label.textContent === text) return
    gsap.to(label, {
      autoAlpha: 0,
      y: -8,
      duration: 0.35,
      ease: 'power2.in',
      onComplete: () => {
        label.textContent = text
        gsap.fromTo(label, { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'expo.out' })
      },
    })
  }

  // idle breathing while the section is on screen
  let idle = null
  const startIdle = () => {
    if (reduced || idle) return
    idle = gsap
      .timeline({ repeat: -1 })
      .call(() => setLabel('Atme ein'))
      .to(orb, { scale: 0.86, duration: 4.5, ease: 'sine.inOut' })
      .to(rings, { scale: 1.04, duration: 4.5, ease: 'sine.inOut', stagger: 0.1 }, '<')
      .call(() => setLabel('Atme aus'))
      .to(orb, { scale: SMALL, duration: 5.5, ease: 'sine.inOut' })
      .to(rings, { scale: 1, duration: 5.5, ease: 'sine.inOut', stagger: 0.1 }, '<')
  }
  const stopIdle = () => {
    idle?.kill()
    idle = null
  }

  ScrollTrigger.create({
    trigger: stage,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => {
      if (session) return
      self.isActive ? startIdle() : stopIdle()
    },
  })

  let session = null
  let countTimer = null

  const countdown = (secs) => {
    clearInterval(countTimer)
    let n = secs
    count.textContent = n
    countTimer = setInterval(() => {
      n -= 1
      count.textContent = n > 0 ? n : ''
      if (n <= 0) clearInterval(countTimer)
    }, 1000)
  }

  const end = (completed) => {
    session?.kill()
    session = null
    clearInterval(countTimer)
    count.textContent = ''
    btn.setAttribute('aria-pressed', 'false')
    setRollText(btnLabel, completed ? 'Nochmals' : 'Atemübung starten')
    progress.textContent = completed ? 'Schön. Genau so fühlt sich eine Auszeit an.' : ''
    setLabel(completed ? 'Danke' : 'Atme ein')
    gsap.to(arc, { strokeDashoffset: ARC, duration: 1.2, ease: 'expo.inOut' })
    gsap.to(orb, { scale: SMALL, duration: 2, ease: 'sine.inOut', onComplete: () => !session && startIdle() })
    emit?.('breath:end')
  }

  const start = () => {
    stopIdle()
    btn.setAttribute('aria-pressed', 'true')
    setRollText(btnLabel, 'Beenden')
    progress.textContent = `Atemzug 1 von ${CYCLES}`
    const total = (IN + HOLD + OUT) * CYCLES
    session = gsap.timeline({ onComplete: () => end(true) })
    session.set(arc, { strokeDashoffset: ARC })
    session.to(arc, { strokeDashoffset: 0, duration: total, ease: 'none' }, 0)
    gsap.to(orb, { scale: SMALL, duration: 0.6 })
    for (let i = 0; i < CYCLES; i++) {
      const t0 = i * (IN + HOLD + OUT)
      session.call(
        () => {
          setLabel('Atme ein')
          countdown(IN)
          progress.textContent = `Atemzug ${i + 1} von ${CYCLES}`
          emit?.('breath:in', IN)
        },
        null,
        t0,
      )
      session.to(orb, { scale: BIG, duration: IN, ease: 'sine.inOut' }, t0)
      session.to(rings, { scale: 1.06, duration: IN, ease: 'sine.inOut', stagger: 0.08 }, t0)
      session.call(
        () => {
          setLabel('Halte')
          countdown(HOLD)
        },
        null,
        t0 + IN,
      )
      session.call(
        () => {
          setLabel('Atme aus')
          countdown(OUT)
          emit?.('breath:out', OUT)
        },
        null,
        t0 + IN + HOLD,
      )
      session.to(orb, { scale: SMALL, duration: OUT, ease: 'sine.inOut' }, t0 + IN + HOLD)
      session.to(rings, { scale: 1, duration: OUT, ease: 'sine.inOut', stagger: 0.08 }, t0 + IN + HOLD)
    }
    emit?.('breath:start')
  }

  btn?.addEventListener('click', () => (session ? end(false) : start()))
}
