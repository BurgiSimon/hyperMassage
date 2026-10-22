import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, onVisibility, fontsReady } from '../utils/helpers.js'
import { Kinetic, fitWidth } from '../core/kinetic.js'

/** «Entspannung.» – fully relaxed, edge to edge, and still soft to the touch. */
export function initFooter({ reduced }) {
  const box = qs('[data-footer-word]')
  const inner = qs('[data-footer-word-in]')
  const year = qs('[data-year]')
  if (year) year.textContent = new Date().getFullYear()
  if (!box || !inner) return
  const fit = () => fitWidth(inner, box)
  inner.style.setProperty('--fs-rest', '140%')
  inner.style.setProperty('--fw-rest', '200')
  if (reduced) {
    fontsReady().then(fit)
    window.addEventListener('resize', fit)
    return
  }
  const kin = new Kinetic(inner, { knead: true, radius: 260, strength: -0.9, onTick: () => fit() })
  box.setAttribute('data-cursor', 'Locker')
  onVisibility(box, (v) => kin.setVisible(v), '100px')
  fontsReady().then(() => {
    kin.rebuild()
    fit()
  })
  window.addEventListener('resize', fit)

  // the gauge hits zero
  const zero = qs('[data-footer-zero]')
  if (zero) {
    const o = { v: 100 }
    ScrollTrigger.create({
      trigger: box,
      start: 'top 95%',
      once: true,
      onEnter: () => gsap.fromTo(o, { v: 24 }, { v: 0, duration: 1.6, ease: 'power3.out', onUpdate: () => (zero.textContent = Math.round(o.v)) }),
    })
  }
}
