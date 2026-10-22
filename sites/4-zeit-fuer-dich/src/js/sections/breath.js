import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs } from '../utils/helpers.js'
import { scrollTo } from '../core/scroll.js'

gsap.registerPlugin(ScrollTrigger)

const IN = 4
const HOLD = 2
const OUT = 6
const CYCLES = 5
const ARC = 2 * Math.PI * 96

/**
 * Atempause – one minute with the hot stones (after site 1, «Lass los.»).
 * Breathing in, the stones lift apart and the ember below them glows;
 * breathing out, they settle and cool, and the headline lets go with you.
 */
export function initBreath({ reduced, title }) {
  const stage = qs('[data-breath]')
  if (!stage) return
  const section = stage.closest('section')
  const label = qs('[data-breath-label]', stage)
  const count = qs('[data-breath-count]', stage)
  const arc = qs('[data-breath-arc]', stage)
  const btn = qs('[data-breath-start]')
  const btnLabel = qs('[data-breath-btn-label]')
  const progress = qs('[data-breath-progress]')

  // one value drives everything: 0 = exhaled, 1 = full breath
  const breath = { v: 0, heat: 0.35 }
  const touch = { v: 0 }
  const paint = () => {
    stage.style.setProperty('--lift', breath.v.toFixed(3))
    stage.style.setProperty('--heat', Math.min(1, breath.heat + touch.v).toFixed(3))
    // breathing in tenses the letters a little; breathing out lets them go
    if (title) title.offset = 0.55 - breath.v * 1.1
  }
  paint()

  // (compared with the text that is due, not the one on screen: a fade may still be running)
  let due = label.textContent
  const setLabel = (text) => {
    if (due === text) return
    due = text
    gsap.killTweensOf(label)
    if (reduced) {
      label.textContent = text
      return
    }
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

  const inhale = (d) => gsap.to(breath, { v: 1, heat: 1, duration: d, ease: 'sine.inOut', onUpdate: paint, overwrite: true })
  const exhale = (d) => gsap.to(breath, { v: 0, heat: 0.3, duration: d, ease: 'sine.inOut', onUpdate: paint, overwrite: true })

  // a slow idle breath while the section is on screen
  let idle = null
  let onScreen = false
  const startIdle = () => {
    if (reduced || idle) return
    idle = gsap
      .timeline({ repeat: -1 })
      .call(() => setLabel('Atme ein'))
      .add(() => inhale(4.5))
      .to({}, { duration: 4.5 })
      .call(() => setLabel('Atme aus'))
      .add(() => exhale(5.5))
      .to({}, { duration: 5.5 })
  }
  const stopIdle = () => {
    idle?.kill()
    idle = null
  }

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
  const focus = (on) => document.body.classList.toggle('is-breathing', on)

  const end = (completed) => {
    session?.kill()
    session = null
    focus(false)
    clearInterval(countTimer)
    count.textContent = ''
    btnLabel.textContent = completed ? 'Nochmals' : 'Atemübung starten'
    progress.textContent = completed ? 'Schön. Genau so fühlt sich eine Auszeit an.' : ''
    setLabel(completed ? 'Danke' : 'Atme ein')
    gsap.to(arc, { strokeDashoffset: ARC, duration: 1.2, ease: 'expo.inOut' })
    exhale(2).eventCallback('onComplete', () => !session && onScreen && startIdle())
  }

  const start = () => {
    stopIdle()
    focus(true)
    // the stones in the middle of the screen
    scrollTo(section, { offset: -Math.max(0, (window.innerHeight - section.offsetHeight) / 2) })
    btnLabel.textContent = 'Beenden'
    progress.textContent = `Atemzug 1 von ${CYCLES}`
    const total = (IN + HOLD + OUT) * CYCLES
    // the stones settle first, so the first breath in lifts them all the way
    const LEAD = breath.v > 0.15 ? 1.2 : 0
    if (LEAD) {
      setLabel('Atme aus')
      exhale(LEAD)
    }
    session = gsap.timeline({ onComplete: () => end(true) })
    session.set(arc, { strokeDashoffset: ARC })
    session.to(arc, { strokeDashoffset: 0, duration: total, ease: 'none' }, LEAD)
    for (let i = 0; i < CYCLES; i++) {
      const t0 = LEAD + i * (IN + HOLD + OUT)
      session.call(
        () => {
          setLabel('Atme ein')
          countdown(IN)
          progress.textContent = `Atemzug ${i + 1} von ${CYCLES}`
          inhale(IN)
          document.dispatchEvent(new CustomEvent('breath', { detail: { phase: 'in', d: IN } }))
        },
        null,
        t0,
      )
      session.call(
        () => {
          setLabel('Halten')
          countdown(HOLD)
        },
        null,
        t0 + IN,
      )
      session.call(
        () => {
          setLabel('Atme aus')
          countdown(OUT)
          exhale(OUT)
          document.dispatchEvent(new CustomEvent('breath', { detail: { phase: 'out', d: OUT } }))
        },
        null,
        t0 + IN + HOLD,
      )
    }
  }

  btn?.addEventListener('click', () => (session ? end(false) : start()))
  // Escape ends the exercise, too – unless it is meant for an open dialog or menu
  const overlays = new Set()
  document.addEventListener('overlay', (e) => (e.detail.open ? overlays.add(e.detail.source) : overlays.delete(e.detail.source)))
  document.addEventListener('keydown', (e) => e.key === 'Escape' && session && !overlays.size && end(false))

  // (created last: on a deep link the stones are on screen at once, and the trigger toggles right away)
  ScrollTrigger.create({
    trigger: stage,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => {
      onScreen = self.isActive
      if (session) {
        if (!self.isActive) end(false)
        return
      }
      self.isActive ? startIdle() : stopIdle()
    },
  })

  // a hand over the stones warms them (like the hot stones in the practice)
  if (!reduced) {
    stage.addEventListener('pointerenter', () => gsap.to(touch, { v: 0.45, duration: 1.2, ease: 'sine.out', onUpdate: paint, overwrite: true }))
    stage.addEventListener('pointerleave', () => gsap.to(touch, { v: 0, duration: 2.4, ease: 'sine.inOut', onUpdate: paint, overwrite: true }))
  }
}
