import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, prefersReducedMotion } from './utils/helpers.js'
import { trackPointer } from './core/pointer.js'
import { initScroll, stopScroll, startScroll, initAnchors, releaseAllScrollLocks, scrollTo } from './core/scroll.js'
import { runLoader } from './core/loader.js'
import { initHeader, initMenu, initPress } from './core/chrome.js'
import { initCursor } from './core/cursor.js'
import { initBooking } from './core/booking.js'
import { initHero } from './sections/hero.js'
import { initKineticHeadings, initWelcome, initReveals } from './sections/reveals.js'
import { initBodyMap } from './sections/bodymap.js'
import { initPortrait } from './sections/portrait.js'
import { initServices } from './sections/services.js'
import { initPmr } from './sections/pmr.js'
import { initPrices } from './sections/prices.js'
import { initVoucher } from './sections/voucher.js'
import { initFaq } from './sections/faq.js'
import { initContact } from './sections/contact.js'
import { initMap } from './sections/map.js'
import { initFooter } from './sections/footer.js'

gsap.registerPlugin(ScrollTrigger)

const html = document.documentElement

function recover(err) {
  console.error(err)
  qs('[data-loader]')?.remove()
  html.classList.remove('motion')
  releaseAllScrollLocks()
}

export function initApp() {
  // the inline safety net already gave up on us: stay on the static page
  const late = html.classList.contains('no-js')
  if (late) {
    qs('[data-loader]')?.remove()
    return
  }
  try {
    boot()
    html.classList.add('app-booted')
  } catch (err) {
    recover(err)
  }
}

function boot() {
  const reduced = prefersReducedMotion()
  const revisit = html.classList.contains('is-revisit')
  html.classList.add(reduced ? 'reduced' : 'motion')

  trackPointer()
  initScroll({ smooth: !reduced })
  stopScroll('loader')
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  if (!location.hash) window.scrollTo(0, 0)

  const years = qs('[data-years]')
  if (years) years.textContent = new Date().getFullYear() - 2004

  initCursor()
  initPress()
  const hero = initHero({ reduced })
  initHeader()
  const menu = initMenu({ reduced })
  initAnchors(() => menu.close())
  initBooking({ reduced, beforeOpen: () => menu.close() })

  const sections = [
    () => initWelcome({ reduced }),
    () => initBodyMap({ reduced }),
    () => initPortrait({ reduced }),
    () => initServices({ reduced }),
    () => initPmr({ reduced }),
    () => initPrices({ reduced }),
    () => initVoucher({ reduced }),
    () => initFaq(),
    () => initContact({ reduced }),
    () => initMap({ reduced }),
    () => initFooter({ reduced }),
    () => initKineticHeadings({ reduced }),
    () => initReveals({ reduced }),
  ]
  // one broken section must never take the whole page down
  sections.forEach((init) => {
    try {
      init()
    } catch (err) {
      console.error(err)
    }
  })

  runLoader({ reduced, revisit }).then(() => {
    try {
      sessionStorage.setItem('cb2-visited', '1')
    } catch {}
    startScroll('loader')
    hero.playIntro()
    ScrollTrigger.refresh()
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)))
      if (target) scrollTo(target, { immediate: true, offset: -8 })
    }
  })

  console.log(
    '%cEntspannung.%c\nMassage Claudia Bürgi, Kestenholz – 078 224 91 97',
    'font: 700 22px sans-serif; color: #ff4521',
    'font: 13px sans-serif; color: inherit',
  )
}
