import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, qsa } from '../utils/helpers.js'
import { startScroll, stopScroll } from './scroll.js'

gsap.registerPlugin(ScrollTrigger)

const THEME_TONE = { linen: 'light', sand: 'light', basalt: 'dark', clay: 'clay' }
const TONE_BAR = { light: '#f1e9dd', dark: '#17130f', clay: '#9c4320' }

/**
 * Header and dock. The header hides on the way down on phones; its colours follow
 * what lies under it – the sky, a light or a dark section, the night.
 * The sheet takes the theme of the section in the middle of the screen, so its
 * colours cross-fade as you scroll.
 */
export function initHeader() {
  const html = document.documentElement
  const header = qs('[data-header]')
  const dock = qs('[data-dock]')
  const sheet = qs('[data-sheet]')
  const hero = qs('.hero')
  const footer = qs('[data-footer]')
  const bar = qs('meta[name="theme-color"]')
  if (!header) return
  const sections = qsa('.sec[data-theme]')

  // regions in page coordinates, measured on refresh
  let regions = []
  const measure = () => {
    const y = window.scrollY
    const box = (el) => {
      const r = el.getBoundingClientRect()
      return { top: r.top + y, bottom: r.bottom + y }
    }
    regions = [
      { ...box(hero), tone: 'sky' },
      ...sections.map((el) => ({ ...box(el), tone: THEME_TONE[el.dataset.theme] || 'light', theme: el.dataset.theme })),
      { ...box(footer), tone: 'night' },
    ]
  }
  const at = (y) => regions.find((r) => y >= r.top && y < r.bottom) || regions[regions.length - 1]

  let tone = ''
  let theme = ''
  let lastY = window.scrollY
  let footerOn = false
  const update = () => {
    const y = window.scrollY
    const vh = window.innerHeight
    // header colours: what is under the header's middle
    const under = at(y + header.offsetHeight / 2)
    let t = under?.tone || 'light'
    if (t === 'sky') t = html.dataset.sky === 'dark' ? 'dark' : 'light'
    if (t === 'night') t = 'dark'
    if (t !== tone) {
      tone = t
      html.dataset.tone = t
    }
    // the sheet's theme: the section in the middle of the screen
    const mid = at(y + vh * 0.5)
    const th = mid?.theme || theme || 'linen'
    if (th !== theme) {
      theme = th
      sheet?.setAttribute('data-active-theme', th)
    }
    // the browser bar: the sky while it shows, the section otherwise
    if (bar) {
      const c = under?.tone === 'sky' || under?.tone === 'night' ? html.style.backgroundColor || '#17130f' : TONE_BAR[THEME_TONE[under?.theme] || 'light']
      if (bar.getAttribute('content') !== c) bar.setAttribute('content', c)
    }
    // phones need the room: the header hides on the way down
    const phone = window.innerWidth <= 900
    if (phone && y > lastY + 4 && y > vh * 0.8 && !html.classList.contains('menu-open')) header.classList.add('is-hidden')
    else if (!phone || y < lastY - 4 || y < vh * 0.8) header.classList.remove('is-hidden')
    lastY = y
    dock?.classList.toggle('is-visible', y > vh * 0.7 && !footerOn)
  }
  measure()
  update()
  window.addEventListener('scroll', update, { passive: true })
  ScrollTrigger.addEventListener('refresh', () => {
    measure()
    update()
  })
  document.addEventListener('sky:tone', update)
  if (footer) ScrollTrigger.create({ trigger: footer, start: 'top 80%', onToggle: (s) => ((footerOn = s.isActive), update()) })
  return { refresh: () => (measure(), update()) }
}

/** The menu: nine numbered places on the page. */
export function initMenu({ reduced }) {
  const menu = qs('[data-menu]')
  const btn = qs('[data-menu-toggle]')
  const label = qs('[data-menu-label]')
  if (!menu || !btn) return { close() {} }
  let open = false
  let tl = null
  const behind = qsa('main, footer, [data-dock]')
  const set = (state) => {
    if (state === open) return
    open = state
    behind.forEach((el) => (el.inert = open))
    btn.setAttribute('aria-expanded', String(open))
    label.textContent = open ? 'Schliessen' : 'Menü'
    document.documentElement.classList.toggle('menu-open', open)
    document.dispatchEvent(new CustomEvent('overlay', { detail: { open, source: 'menu' } }))
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
          .fromTo(qsa('.menu__list li, .menu__foot > *', menu), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, stagger: 0.04, ease: 'expo.out' }, 0.1)
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
      const header = qs('[data-header]')
      const shown = (el) => el.offsetParent !== null
      const f = [...qsa('a[href], button', header).filter(shown), ...qsa('a[href], button', menu).filter(shown)]
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
