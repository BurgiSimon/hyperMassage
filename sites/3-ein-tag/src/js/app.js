import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, qsa, prefersReducedMotion } from './utils/helpers.js'
import { initScroll, stopScroll, startScroll, initAnchors, releaseAllScrollLocks, scrollTo } from './core/scroll.js'
import { runLoader } from './core/loader.js'
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
  // (without WebGL the silhouette in .scene__fallback stays; day.js colours it by the hour)
  if (scene) qs('.scene').classList.add('is-live')

  initCursor()
  const hero = prepareHero({ reduced })
  const day = initDay({ scene, reduced })
  // the GPU may drop the scene for a moment: show the silhouette meanwhile
  canvas.addEventListener('scene:lost', () => {
    qs('.scene').classList.remove('is-live')
    day.refresh()
  })
  canvas.addEventListener('scene:restored', () => {
    qs('.scene').classList.add('is-live')
    day.refresh()
  })
  if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __day: day, __scene: scene })
  initHeader()
  const menu = initMenu({ reduced })
  initAnchors(() => menu.close())
  const booking = initBooking({ reduced, beforeOpen: () => menu.close() })

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
  // (one switch in the header, one in the menu on phones – they stay in step)
  const soundBtns = qsa('[data-sound]')
  const nature = createNature(() => day.look)
  soundBtns.forEach((btn) =>
    btn.addEventListener('click', () => {
      const on = nature.toggle()
      soundBtns.forEach((b) => b.setAttribute('aria-pressed', String(on)))
    }),
  )

  runLoader({ reduced, revisit }).then(() => {
    try {
      sessionStorage.setItem('cb3-visited', '1')
    } catch {}
    startScroll('loader')
    hero.play()
    ScrollTrigger.refresh()
    day.refresh()
    day.showHint?.()
    // a link to /#termin opens the request dialog
    if (location.hash === '#termin') booking.open()
    else if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)))
      if (target) scrollTo(target, { immediate: true, offset: -8 })
    }
  })

  console.log('%cZeit für dich.%c\nMassage Claudia Bürgi, Kestenholz – 078 224 91 97', 'font: italic 22px Georgia, serif; color: #b04a26', 'font: 13px sans-serif')
}
