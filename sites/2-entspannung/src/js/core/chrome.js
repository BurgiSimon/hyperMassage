import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, qsa, clamp, openStatus } from '../utils/helpers.js'
import { startScroll, stopScroll } from './scroll.js'

gsap.registerPlugin(ScrollTrigger)

/** Header: scrolled state, hide on the way down, theme under the bar, tension gauge, active link. */
export function initHeader() {
  const header = qs('[data-header]')
  const hero = qs('[data-hero]')
  const fill = qs('[data-gauge-fill]')
  const num = qs('[data-gauge-num]')
  const dock = qs('[data-dock]')
  const footer = qs('[data-footer]')
  if (!header) return

  let max = 1
  let heroEnd = 0
  let heroSpan = 1
  const measure = () => {
    max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight)
    heroEnd = hero ? hero.offsetHeight - window.innerHeight * 0.4 : 0
    heroSpan = Math.max(1, (hero?.offsetHeight || 0) - window.innerHeight)
  }
  measure()
  ScrollTrigger.addEventListener('refresh', measure)

  let lastY = window.scrollY
  let shown = 100
  let footerVisible = false
  const update = () => {
    const y = window.scrollY
    // (in the hero the stage has its own rule – no second line under the header)
    header.classList.toggle('is-scrolled', y > heroEnd)
    const down = y > lastY + 2
    const up = y < lastY - 2
    if (down && y > heroEnd && !document.documentElement.classList.contains('menu-open')) header.classList.add('is-hidden')
    else if (up || y < heroEnd) header.classList.remove('is-hidden')
    lastY = y
    // phones: the dock once the hero (and its own buttons) has passed; computers: while the header is away
    const phone = window.innerWidth <= 860
    dock?.classList.toggle('is-visible', y > heroEnd && !footerVisible && (phone || header.classList.contains('is-hidden')))
  }
  window.addEventListener('scroll', update, { passive: true })
  update()

  // the tension gauge: the hero lets go of the first 40 %, the rest of the page of the other 60 %
  let lastT = ''
  gsap.ticker.add(() => {
    const y = window.scrollY
    const t = y < heroSpan ? 1 - 0.4 * (y / heroSpan) : 0.6 * (1 - clamp((y - heroSpan) / Math.max(1, max - heroSpan)))
    const ts = t.toFixed(3)
    if (ts === lastT) return
    lastT = ts
    header.style.setProperty('--t', ts)
    if (fill) fill.parentElement.style.setProperty('--t', ts)
    const pct = Math.round(t * 100)
    if (num && pct !== shown) {
      num.textContent = pct
      shown = pct
    }
  })

  // header colours follow the section underneath it
  qsa('[data-theme], [data-footer]').forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec,
      start: () => `top ${header.offsetHeight}px`,
      end: () => `bottom ${header.offsetHeight}px`,
      onToggle: (self) => {
        if (self.isActive) header.dataset.headerTheme = sec.dataset.theme || 'calm'
        else if (header.dataset.headerTheme === (sec.dataset.theme || 'calm')) delete header.dataset.headerTheme
      },
    })
  })
  if (footer) {
    ScrollTrigger.create({
      trigger: footer,
      start: 'top bottom',
      onToggle: (self) => {
        footerVisible = self.isActive
        update()
      },
    })
  }

  // active nav link
  const links = qsa('.nav a')
  links.forEach((a) => {
    const sec = document.getElementById(a.getAttribute('href').slice(1))
    if (!sec) return
    ScrollTrigger.create({
      trigger: sec,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => a.classList.toggle('is-active', self.isActive),
    })
  })

  // opening status
  const status = qs('[data-status]')
  const statusText = qs('[data-status-text]')
  const tickStatus = () => {
    const s = openStatus()
    status?.classList.toggle('is-open', s.open)
    if (statusText) statusText.textContent = s.text
  }
  tickStatus()
  setInterval(tickStatus, 30000)
}

/** Full-screen index. */
export function initMenu({ reduced }) {
  const menu = qs('[data-menu]')
  const btn = qs('[data-menu-toggle]')
  const label = qs('[data-menu-label]')
  if (!menu || !btn) return { close() {} }
  const items = qsa('.menu__list li', menu)
  const foot = qs('.menu__foot', menu)
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
      if (reduced) {
        gsap.set(menu, { clipPath: 'inset(0% 0% 0% 0%)' })
      } else {
        tl = gsap
          .timeline()
          .fromTo(menu, { clipPath: 'inset(0% 0% 100% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.9, ease: 'expo.inOut' })
          .fromTo(
            qsa('.menu__w', menu),
            { fontStretch: '50%', fontWeight: 900, yPercent: 60, opacity: 0 },
            {
              fontStretch: '62%',
              fontWeight: 760,
              yPercent: 0,
              opacity: 1,
              duration: 1.1,
              ease: 'elastic.out(1, 0.6)',
              stagger: 0.035,
              clearProps: 'fontStretch,fontWeight',
            },
            0.35,
          )
          .fromTo(foot, { opacity: 0 }, { opacity: 1, duration: 0.6 }, 0.6)
      }
      setTimeout(() => qs('a', items[0])?.focus({ preventScroll: true }), reduced ? 0 : 400)
    } else {
      menu.inert = true
      startScroll('menu')
      const done = () => menu.classList.remove('is-open')
      if (reduced) {
        gsap.set(menu, { clipPath: 'inset(0% 0% 100% 0%)' })
        done()
      } else {
        tl = gsap.timeline({ onComplete: done }).to(menu, { clipPath: 'inset(100% 0% 0% 0%)', duration: 0.75, ease: 'expo.inOut' })
      }
    }
  }

  btn.addEventListener('click', () => set(!open))
  document.addEventListener('keydown', (e) => {
    if (!open) return
    if (e.key === 'Escape') {
      set(false)
      btn.focus()
    }
    if (e.key === 'Tab') {
      const header = qs('[data-header]')
      const focusables = [...qsa('a[href], button', header).filter((el) => el.offsetParent !== null), ...qsa('a[href]', menu)]
      const i = focusables.indexOf(document.activeElement)
      if (e.shiftKey && i <= 0) {
        e.preventDefault()
        focusables[focusables.length - 1].focus()
      } else if (!e.shiftKey && (i === focusables.length - 1 || i === -1)) {
        e.preventDefault()
        focusables[0].focus()
      }
    }
  })
  return { close: () => set(false), get open() { return open } }
}

/** Buttons tense up while pressed and spring back when let go. */
export function initPress() {
  const release = (el) => {
    el.classList.remove('is-pressed')
    clearTimeout(el._pressT)
    el._pressT = setTimeout(() => (el.style.width = ''), 700)
  }
  document.addEventListener('pointerdown', (e) => {
    const el = e.target.closest('[data-press]')
    if (!el || e.button > 0) return
    clearTimeout(el._pressT)
    el.style.width = `${el.getBoundingClientRect().width}px`
    el.classList.add('is-pressed')
    const up = () => {
      release(el)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  })
}
