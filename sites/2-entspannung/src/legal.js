import './styles/main.css'
import './styles/legal.css'
import gsap from 'gsap'
import { qs, qsa, prefersReducedMotion, canHover, fontsReady } from './js/utils/helpers.js'
import { trackPointer } from './js/core/pointer.js'
import { initCursor } from './js/core/cursor.js'
import { initPress } from './js/core/chrome.js'
import { Kinetic } from './js/core/kinetic.js'

const reduced = prefersReducedMotion()
document.documentElement.classList.add(reduced ? 'reduced' : 'motion')
trackPointer()
initCursor()
initPress()
qsa('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()))

fontsReady().then(() => {
  qsa('[data-kin], [data-nf]').forEach((el) => {
    const kin = new Kinetic(el, { knead: canHover() && !reduced, radius: 200, strength: 0.9 })
    kin.setVisible(true)
    if (reduced) return
    // arrive clenched, then let go
    kin.set(1.1)
    kin.release = kin.t + 0.15
    kin.gesture = (l, i) => ({ k: kin.t < kin.release + i * 0.035 ? 1.1 : 0 })
    setTimeout(() => (kin.gesture = null), 1600)
    if (el.matches('[data-nf]')) {
      // the 404 keeps trembling a little until you touch it
      const start = kin.t
      setTimeout(() => {
        kin.gesture = (l, i, t) => ({ k: 0.55 + 0.05 * Math.sin((t - start) * 40 + i * 2) })
      }, 1700)
      el.addEventListener('pointerenter', () => (kin.gesture = null))
      el.setAttribute('data-cursor', 'Lockern')
    }
  })
})

if (!reduced) gsap.from(qsa('.ltext section, .ltoc, .nf__text, .nf__main .btn'), { opacity: 0, y: 24, duration: 1, stagger: 0.08, ease: 'expo.out', delay: 0.2 })

const header = qs('.lheader')
if (header) window.addEventListener('scroll', () => header.classList.toggle('is-scrolled', window.scrollY > 20), { passive: true })
