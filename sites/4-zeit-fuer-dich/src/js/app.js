import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, qsa, prefersReducedMotion } from './utils/helpers.js'
import { initScroll, stopScroll, startScroll, initAnchors, releaseAllScrollLocks, scrollTo } from './core/scroll.js'
import { runLoader } from './core/loader.js'
import { initCursor } from './core/cursor.js'
import { trackPointer } from './core/pointer.js'
import { initHeader, initMenu } from './core/chrome.js'
import { initBooking } from './core/booking.js'
import { initLandscape } from './sections/landscape.js'
import { prepareHero, initReveals } from './sections/reveals.js'
import { initBodyMap } from './sections/bodymap.js'
import { initSignets } from './sections/signets.js'
import { initBreath } from './sections/breath.js'
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

  // the landscape (opening and closing)
  const canvas = qs('[data-scene]')
  let scene = null
  try {
    scene = createScene(canvas, { reduced })
  } catch (err) {
    console.warn(err)
  }
  // (without WebGL the silhouette in .scene__fallback stays, coloured by the hour)
  if (scene) qs('.scene').classList.add('is-live')

  trackPointer()
  initCursor()
  const hero = prepareHero({ reduced })
  const land = initLandscape({ scene, reduced })
  // the GPU may drop the scene for a moment: show the silhouette meanwhile
  canvas.addEventListener('scene:lost', () => {
    qs('.scene').classList.remove('is-live')
    land.refresh()
  })
  canvas.addEventListener('scene:restored', () => {
    qs('.scene').classList.add('is-live')
    land.refresh()
  })
  const chrome = initHeader()
  const menu = initMenu({ reduced })
  initAnchors(() => menu.close())
  const booking = initBooking({ reduced, beforeOpen: () => menu.close() })

  const run = (fn) => {
    try {
      return fn()
    } catch (err) {
      console.error(err)
    }
  }
  const reveals = run(() => initReveals({ reduced }))
  run(() => initBodyMap({ reduced }))
  run(() => initSignets({ reduced }))
  // the breath drives the Atempause headline (once its letters exist)
  const breathTitle = qs('[data-breath-title]')
  const breathKin = {
    set offset(v) {
      const k = reveals?.kinetics.get(breathTitle)
      if (!k) return
      k.offset = v
      k.wake()
    },
  }
  run(() => initBreath({ reduced, title: reduced ? null : breathKin }))
  run(() => initPlanner({ webgl: !!scene }))
  run(() => initPostcard({ reduced, webgl: !!scene }))
  run(() => initHours())
  run(() => initFaq())
  run(() => initMap({ reduced }))
  if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __land: land, __scene: scene, __reveals: reveals })

  // Klang – one switch in the header, one in the menu on phones; they stay in step
  const soundBtns = qsa('[data-sound]')
  const nature = createNature(() => land.look)
  soundBtns.forEach((btn) =>
    btn.addEventListener('click', () => {
      const on = nature.toggle()
      soundBtns.forEach((b) => b.setAttribute('aria-pressed', String(on)))
    }),
  )

  runLoader({ reduced, revisit }).then(() => {
    try {
      sessionStorage.setItem('cb4-visited', '1')
    } catch {}
    startScroll('loader')
    hero.play()
    ScrollTrigger.refresh()
    land.refresh()
    chrome?.refresh()
    land.showHint()
    // a link to /#termin opens the request dialog
    if (location.hash === '#termin') booking.open()
    else if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)))
      if (target) scrollTo(target, { immediate: true, offset: -8 })
    }
  })

  console.log('%cZeit für dich.%c\nMassage Claudia Bürgi, Kestenholz – 078 224 91 97', 'font: italic 300 24px Georgia, serif; color: #a8471f', 'font: 13px sans-serif')
}
