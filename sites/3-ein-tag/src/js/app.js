import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, prefersReducedMotion } from './utils/helpers.js'
import { initScroll, stopScroll, startScroll, initAnchors, releaseAllScrollLocks, scrollTo } from './core/scroll.js'
import { runLoader, skylinePath } from './core/loader.js'
import { initCursor } from './core/cursor.js'
import { initHeader, initMenu } from './core/chrome.js'
import { initBooking } from './core/booking.js'
import { initDay } from './sections/day.js'
import { prepareHero, initReveals } from './sections/reveals.js'
import { initPlanner } from './sections/planner.js'
import { initPostcard } from './sections/postcard.js'
import { initHours } from './sections/hours.js'
import { initFaq } from './sections/faq.js'
import { initMap } from './sections/map.js'
import { createScene } from './gl/scene.js'
import { createNature } from './audio/nature.js'

gsap.registerPlugin(ScrollTrigger)
const html = document.documentElement

export function initApp() {
  if (html.classList.contains('no-js')) {
    qs('[data-loader]')?.remove()
    return
  }
  try {
    boot()
    html.classList.add('app-booted')
  } catch (err) {
    console.error(err)
    qs('[data-loader]')?.remove()
    releaseAllScrollLocks()
  }
}

/** Without WebGL: the real skyline as layered SVG over a soft gradient. */
function paintFallback() {
  const host = qs('[data-scene-fallback]')
  if (!host) return
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 300" preserveAspectRatio="none"><defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6f8fbf"/><stop offset="0.75" stop-color="#ecc9a4"/></linearGradient></defs><rect width="1000" height="300" fill="url(#s)"/><path d="${skylinePath(1000, 300)}" fill="#3f4b3e"/></svg>`
  host.style.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
}

function boot() {
  const reduced = prefersReducedMotion()
  const revisit = html.classList.contains('is-revisit')
  html.classList.add(reduced ? 'reduced' : 'motion')

  initScroll({ smooth: !reduced })
  stopScroll('loader')
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
  if (!location.hash) window.scrollTo(0, 0)

  // the landscape
  const canvas = qs('[data-scene]')
  let scene = null
  try {
    scene = createScene(canvas, { reduced })
  } catch (err) {
    console.warn(err)
  }
  if (scene) qs('.scene').classList.add('is-live')
  else paintFallback()

  initCursor()
  const hero = prepareHero({ reduced })
  const day = initDay({ scene, reduced })
  if (new URLSearchParams(location.search).has('debug')) window.__day = day
  initHeader()
  const menu = initMenu({ reduced })
  initAnchors(() => menu.close())
  initBooking({ reduced, beforeOpen: () => menu.close() })

  const run = (fn) => {
    try {
      fn()
    } catch (err) {
      console.error(err)
    }
  }
  run(() => initPlanner({ day }))
  run(() => initPostcard({ reduced, webgl: !!scene }))
  run(() => initHours())
  run(() => initFaq())
  run(() => initMap({ reduced }))
  run(() => initReveals({ reduced }))

  // Klang
  const soundBtn = qs('[data-sound]')
  const nature = createNature(() => day.look)
  soundBtn?.addEventListener('click', () => {
    const on = nature.toggle()
    soundBtn.setAttribute('aria-pressed', String(on))
  })

  runLoader({ reduced, revisit }).then(() => {
    try {
      sessionStorage.setItem('cb3-visited', '1')
    } catch {}
    startScroll('loader')
    hero.play()
    ScrollTrigger.refresh()
    day.refresh()
    if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)))
      if (target) scrollTo(target, { immediate: true, offset: -8 })
    }
  })

  console.log('%cZeit für dich.%c\nMassage Claudia Bürgi, Kestenholz – 078 224 91 97', 'font: italic 22px Georgia, serif; color: #c25a32', 'font: 13px sans-serif')
}
