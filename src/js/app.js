import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, initRollText, prefersReducedMotion } from './utils/helpers.js'
import { initScroll, initAnchors, stopScroll, startScroll, scrollTo } from './core/scroll.js'
import { initThemes, initHeader, initMenu } from './core/chrome.js'
import { initCursor, initMagnetic, trackPointer, cursor } from './core/cursor.js'
import { runLoader } from './core/loader.js'
import { initBooking } from './core/booking.js'
import { initReveals, revealAllInstantly } from './sections/reveals.js'
import {
  prepareHero,
  playHeroIntro,
  initHeroScroll,
  initAbout,
  initMarquee,
  initServices,
  initChapters,
} from './sections/scenes.js'
import { initBreath } from './sections/breath.js'
import { initPrices } from './sections/prices.js'
import { initVoucher } from './sections/voucher.js'
import { initHours, initClock, initBigNumber } from './sections/contact.js'
import { initWordmark } from './sections/footer.js'
import { initMap } from './sections/map.js'
import { initSignets } from './gl/signets.js'
import { createAmbient } from './audio/ambient.js'

gsap.registerPlugin(ScrollTrigger)

const timeout = (ms) => new Promise((r) => setTimeout(r, ms))

export function initApp() {
  const html = document.documentElement
  html.classList.add('app-booted')
  const reduced = prefersReducedMotion()
  html.classList.add(reduced ? 'reduced' : 'motion')
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  if (!location.hash) window.scrollTo(0, 0)

  // ── sound + tiny event bus ──
  const ambient = createAmbient()
  const emit = (type, detail) => ambient.handle(type, detail)
  const soundBtn = qs('[data-sound]')
  soundBtn?.addEventListener('click', async () => {
    const on = await ambient.toggle()
    soundBtn.setAttribute('aria-pressed', String(on))
    soundBtn.setAttribute('aria-label', on ? 'Umgebungsklang ausschalten' : 'Umgebungsklang einschalten')
  })
  document.addEventListener('visibilitychange', () => (document.hidden ? ambient.pause() : ambient.resume()))

  // ── chrome ──
  trackPointer()
  initRollText()
  initScroll({ smooth: !reduced })
  stopScroll()
  // the pinned services track changes page height – create it before any trigger below it
  initServices({ reduced })
  initThemes()
  initHeader()
  const menu = initMenu({ reduced })
  initAnchors(() => menu.close())
  initCursor()
  initMagnetic()
  initBooking({ reduced, emit, onOpen: () => menu.close() })

  // ── hero + WebGL ──
  const heroChars = reduced ? [] : prepareHero()
  const canvas = qs('[data-hero-canvas]')
  const hint = qs('[data-hero-hint]')
  let stones = null
  const stonesReady = import('./gl/stones.js')
    .then(({ createStones }) => {
      stones = createStones(canvas, {
        reduced,
        onHover: (idx) => {
          cursor()?.label(idx >= 0 ? 'Wärmen' : null)
          if (idx >= 0) {
            hint?.classList.add('is-done')
            emit('stone:hover', idx)
          }
        },
        onTap: (idx) => {
          hint?.classList.add('is-done')
          emit('stone:tap', idx)
        },
      })
      if (!stones) document.body.classList.add('no-webgl')
    })
    .catch(() => document.body.classList.add('no-webgl'))

  ScrollTrigger.create({
    trigger: '#start',
    start: 'top top',
    end: 'bottom top',
    onUpdate: (self) => stones?.setScroll(self.progress),
  })

  // ── sections ──
  initClock()
  initHours()
  initBigNumber({ reduced })
  initSignets({ reduced })
  initBreath({ reduced, emit })
  initPrices({ emit })
  initVoucher({ reduced, emit })
  initMap({ reduced })

  if (reduced) {
    revealAllInstantly()
  } else {
    initReveals()
    initHeroScroll()
    initAbout()
    initMarquee()
    initWordmark({ reduced })
  }
  initChapters()

  // ── loader → intro ──
  const ready = Promise.race([Promise.all([document.fonts?.ready, stonesReady]), timeout(6000)])
  runLoader({ ready, reduced }).then(() => {
    startScroll()
    if (!reduced) playHeroIntro(heroChars)
    stones?.playIntro()
    ScrollTrigger.refresh()
    // deep links (e.g. /#preise) land after the layout is final
    const target = location.hash && document.querySelector(location.hash)
    if (target) scrollTo(target, { immediate: true, offset: -10 })
  })

  // small studio touches
  const title = document.title
  document.addEventListener('visibilitychange', () => {
    document.title = document.hidden ? 'Atme durch … | Massage Claudia Bürgi' : title
  })
  console.log(
    '%cLass los.%c\nMassagepraxis Claudia Bürgi, Kestenholz · Website: Simon Bürgi',
    'font: italic 300 32px Fraunces, Georgia, serif; color: #e3815a;',
    'font: 12px "Geist Mono", monospace; color: #8a7f74;',
  )

  document.fonts?.ready.then(() => ScrollTrigger.refresh())
  window.addEventListener('load', () => ScrollTrigger.refresh())
}
