import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, qsa, canHover, onVisibility } from '../utils/helpers.js'
import { Kinetic, lockLines } from '../core/kinetic.js'

gsap.registerPlugin(ScrollTrigger)

const instances = []

/** Re-run `fn` when the viewport width really changes (not on mobile toolbar resizes). */
export function onWidthChange(fn) {
  let w = window.innerWidth
  let t = null
  window.addEventListener('resize', () => {
    clearTimeout(t)
    t = setTimeout(() => {
      if (Math.abs(window.innerWidth - w) < 2) return
      w = window.innerWidth
      fn()
    }, 180)
  })
}

/**
 * Section headings arrive clenched and let go letter by letter – and relax
 * a little further wherever the pointer touches them.
 */
export function initKineticHeadings({ reduced }) {
  const els = qsa('[data-kin]')
  const hover = canHover() && !reduced
  const build = () => {
    els.forEach((el) => {
      const kin = new Kinetic(el, { knead: hover, radius: 150, strength: 0.75 })
      instances.push(kin)
      onVisibility(el, (v) => kin.setVisible(v), '100px')
      if (reduced) return
      kin.set(1.1)
      kin.release = null
      kin.gesture = (l, i) => {
        if (kin.release === null) return { k: 1.1 }
        return { k: kin.t < kin.release + i * 0.03 ? 1.1 : 0 }
      }
      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: () => {
          kin.release = kin.t + 0.05
          kin.wake()
          // drop the gesture once every letter has let go
          setTimeout(() => (kin.gesture = null), (0.1 + kin.letters.length * 0.03) * 1000 + 50)
        },
      })
    })
  }
  const start = () => {
    build()
    onWidthChange(() => instances.forEach((k) => k.rebuild()))
  }
  if (document.fonts?.status === 'loaded') start()
  else document.fonts.ready.then(start)
}

/** «Verspannungen» loosens up as the sentence scrolls through the reader's eye line. */
export function initWelcome({ reduced }) {
  const p = qs('[data-welcome]')
  const tw = qs('.tw', p)
  if (!p || !tw) return
  const original = p.innerHTML
  const lock = () => {
    p.innerHTML = original
    const word = qs('.tw', p)
    word.style.setProperty('--r', 1)
    const items = []
    Array.from(p.childNodes).forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent
          .split(/\s+/)
          .filter(Boolean)
          .forEach((w) => {
            const s = document.createElement('span')
            s.textContent = w
            s.className = 'ww'
            items.push(s)
          })
        node.remove()
      } else {
        items.push(node)
      }
    })
    items.forEach((it) => p.appendChild(it))
    // put the spaces back so the browser breaks lines exactly as before
    items.forEach((it, i) => i < items.length - 1 && it.after(document.createTextNode(' ')))
    lockLines(p, items)
    return qs('.tw', p)
  }
  const run = () => {
    const word = lock()
    if (reduced) {
      word.style.setProperty('--r', 1)
      return
    }
    word.style.setProperty('--r', 0)
    ScrollTrigger.getById('welcome')?.kill()
    ScrollTrigger.create({
      id: 'welcome',
      trigger: p,
      start: 'top 78%',
      end: 'bottom 38%',
      scrub: 0.6,
      onUpdate: (self) => word.style.setProperty('--r', self.progress.toFixed(3)),
    })
  }
  const start = () => {
    run()
    onWidthChange(run)
  }
  if (document.fonts?.status === 'loaded') start()
  else document.fonts.ready.then(start)
}

/** Quiet fade-ups for everything else, plus counting facts. */
export function initReveals({ reduced }) {
  if (reduced) return
  const groups = [
    '.sec__head',
    '.lead',
    '.welcome__note',
    '.welcome__foot .link-arrow',
    '.zones',
    '.bodymap__result',
    '.about__cols p',
    '.about__sign',
    '.fact',
    '.srow',
    '.pmr__steps li',
    '.stretch > *',
    '.prices__intro > p',
    '.vform > *',
    '.qa',
    '.faq__intro .link-arrow',
    '.cact',
    '.hours',
    '.visit__addr',
    '.visit__links',
    '.visit__geo',
    '.footer__cols > div',
  ]
  const els = qsa(groups.join(','))
  gsap.set(els, { opacity: 0, y: 26 })
  ScrollTrigger.batch(els, {
    start: 'top 92%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.06, overwrite: true, clearProps: 'transform' }),
  })

  // big numbers count up from tension to rest
  qsa('.fact__num').forEach((el) => {
    if (el.classList.contains('fact__num--word')) return
    const target = el.querySelector('[data-years]') || el
    const end = parseInt(target.textContent, 10)
    if (!Number.isFinite(end)) return
    const from = end > 1900 ? end - 40 : 0
    const obj = { v: from }
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: () =>
        gsap.fromTo(
          obj,
          { v: from },
          {
            v: end,
            duration: 1.8,
            ease: 'expo.out',
            onUpdate: () => (target.textContent = Math.round(obj.v)),
          },
        ),
    })
    gsap.fromTo(
      el,
      { fontStretch: '50%', fontWeight: 900 },
      {
        fontStretch: '64%',
        fontWeight: 760,
        duration: 1.8,
        ease: 'elastic.out(1, 0.45)',
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      },
    )
  })
}
