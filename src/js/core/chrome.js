import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, qsa } from '../utils/helpers.js'
import { getLenis, startScroll, stopScroll } from './scroll.js'

const THEME_COLORS = {
  dark: '#15120f',
  light: '#efe8dd',
  moss: '#1d2620',
  clay: '#b04f2c',
}

/** Lift the theme of the section in the middle of the viewport to :root. */
export function initThemes() {
  const root = document.documentElement
  const meta = qs('meta[name="theme-color"]')
  const set = (theme) => {
    if (root.dataset.activeTheme === theme) return
    root.dataset.activeTheme = theme
    meta?.setAttribute('content', THEME_COLORS[theme] ?? THEME_COLORS.dark)
  }
  set('dark')

  qsa('[data-theme]').forEach((section) => {
    ScrollTrigger.create({
      trigger: section,
      start: 'top 55%',
      end: 'bottom 55%',
      onToggle: (self) => self.isActive && set(section.dataset.theme),
    })
  })
}

export function initHeader() {
  const header = qs('[data-header]')
  if (!header) return
  const bar = qs('[data-progress]', header)
  const dock = qs('[data-dock]')
  const hero = qs('#start')
  let lastY = 0

  const update = (y) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    header.classList.toggle('is-scrolled', y > 40)
    const goingDown = y > lastY + 2
    const goingUp = y < lastY - 2
    if (y > window.innerHeight * 0.9 && goingDown && !document.body.classList.contains('menu-open')) {
      header.classList.add('is-hidden')
    } else if (goingUp || y < 100) {
      header.classList.remove('is-hidden')
    }
    lastY = y
    if (bar) bar.style.transform = `scaleX(${max > 0 ? y / max : 0})`
    if (dock && hero) dock.classList.toggle('is-visible', y > hero.offsetHeight * 0.6)
  }

  const lenis = getLenis()
  if (lenis) lenis.on('scroll', ({ scroll }) => update(scroll))
  else window.addEventListener('scroll', () => update(window.scrollY), { passive: true })
  update(window.scrollY)

  // active nav link
  const links = qsa('.nav__list a')
  links.forEach((link) => {
    const section = qs(link.getAttribute('href'))
    if (!section) return
    ScrollTrigger.create({
      trigger: section,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => link.classList.toggle('is-active', self.isActive),
    })
  })
}

export function initMenu({ reduced }) {
  const menu = qs('[data-menu]')
  const toggle = qs('[data-menu-toggle]')
  if (!menu || !toggle) return { close() {} }
  const bg = qs('.menu__bg', menu)
  const items = qsa('.menu__list li', menu)
  const aside = qs('.menu__aside', menu)
  let open = false
  let tl = null

  const setOpen = (value) => {
    if (open === value) return
    open = value
    toggle.setAttribute('aria-expanded', String(open))
    menu.setAttribute('aria-hidden', String(!open))
    document.body.classList.toggle('menu-open', open)
    tl?.kill()
    if (open) {
      stopScroll()
      menu.classList.add('is-open')
      const r = toggle.getBoundingClientRect()
      const origin = `${r.left + r.width / 2}px ${r.top + r.height / 2}px`
      tl = gsap
        .timeline()
        .fromTo(
          bg,
          { clipPath: `circle(0% at ${origin})` },
          { clipPath: `circle(150% at ${origin})`, duration: reduced ? 0.01 : 1.1, ease: 'expo.inOut' },
        )
        .fromTo(
          items,
          { yPercent: 60, autoAlpha: 0 },
          { yPercent: 0, autoAlpha: 1, duration: 0.9, stagger: 0.05, ease: 'expo.out' },
          '-=0.55',
        )
        .fromTo(aside, { autoAlpha: 0, y: 20 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out' }, '<0.2')
      qs('a', menu)?.focus({ preventScroll: true })
    } else {
      startScroll()
      const r = toggle.getBoundingClientRect()
      const origin = `${r.left + r.width / 2}px ${r.top + r.height / 2}px`
      tl = gsap
        .timeline({ onComplete: () => menu.classList.remove('is-open') })
        .to([...items, aside], { autoAlpha: 0, y: -10, duration: 0.3, stagger: 0.02, ease: 'power2.in' })
        .to(bg, { clipPath: `circle(0% at ${origin})`, duration: reduced ? 0.01 : 0.8, ease: 'expo.inOut' }, '-=0.1')
    }
  }

  toggle.addEventListener('click', () => setOpen(!open))
  document.addEventListener('keydown', (e) => e.key === 'Escape' && open && setOpen(false))

  return { close: () => setOpen(false) }
}
