import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, qsa } from '../utils/helpers.js'
import { startScroll, stopScroll } from './scroll.js'

gsap.registerPlugin(ScrollTrigger)

/** Header hides on the way down (after the hero) and returns on the way up; the mobile dock appears below the hero. */
export function initHeader() {
  const header = qs('[data-header]')
  const dock = qs('[data-dock]')
  const footer = qs('.footer')
  if (!header) return
  let lastY = window.scrollY
  let footerOn = false
  const update = () => {
    const y = window.scrollY
    const vh = window.innerHeight
    if (y > lastY + 4 && y > vh * 0.8 && !document.documentElement.classList.contains('menu-open')) header.classList.add('is-hidden')
    else if (y < lastY - 4 || y < vh * 0.8) header.classList.remove('is-hidden')
    lastY = y
    dock?.classList.toggle('is-visible', y > vh * 0.7 && !footerOn)
  }
  window.addEventListener('scroll', update, { passive: true })
  if (footer) ScrollTrigger.create({ trigger: footer, start: 'top 80%', onToggle: (s) => ((footerOn = s.isActive), update()) })
  update()
}

/** The day's schedule as a menu. */
export function initMenu({ reduced }) {
  const menu = qs('[data-menu]')
  const btn = qs('[data-menu-toggle]')
  const label = qs('[data-menu-label]')
  if (!menu || !btn) return { close() {} }
  let open = false
  let tl = null
  const set = (state) => {
    if (state === open) return
    open = state
    btn.setAttribute('aria-expanded', String(open))
    label.textContent = open ? 'Schliessen' : 'Tagesplan'
    document.documentElement.classList.toggle('menu-open', open)
    tl?.kill()
    if (open) {
      menu.inert = false
      menu.classList.add('is-open')
      stopScroll('menu')
      qs('.menu__inner', menu).scrollTop = 0
      if (reduced) gsap.set(menu, { opacity: 1 })
      else
        tl = gsap
          .timeline()
          .to(menu, { opacity: 1, duration: 0.5, ease: 'power2.out' })
          .fromTo(qsa('.menu__list li, .menu__kicker, .menu__foot', menu), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.045, ease: 'expo.out' }, 0.1)
      setTimeout(() => qs('a', menu)?.focus({ preventScroll: true }), reduced ? 0 : 250)
    } else {
      menu.inert = true
      startScroll('menu')
      const done = () => menu.classList.remove('is-open')
      if (reduced) {
        gsap.set(menu, { opacity: 0 })
        done()
      } else tl = gsap.to(menu, { opacity: 0, duration: 0.45, ease: 'power2.in', onComplete: done })
    }
  }
  btn.addEventListener('click', () => set(!open))
  menu.addEventListener('click', (e) => {
    if (e.target === menu || e.target.classList.contains('menu__inner')) set(false)
  })
  document.addEventListener('keydown', (e) => {
    if (!open) return
    if (e.key === 'Escape') {
      set(false)
      btn.focus()
    }
    if (e.key === 'Tab') {
      const f = [btn, ...qsa('a[href]', menu)]
      const i = f.indexOf(document.activeElement)
      if (e.shiftKey && i <= 0) {
        e.preventDefault()
        f[f.length - 1].focus()
      } else if (!e.shiftKey && (i === f.length - 1 || i === -1)) {
        e.preventDefault()
        f[0].focus()
      }
    }
  })
  return { close: () => set(false) }
}
