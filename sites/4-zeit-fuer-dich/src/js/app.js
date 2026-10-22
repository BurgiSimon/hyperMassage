import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, qsa, prefersReducedMotion, whenNear } from './utils/helpers.js'
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
import { createScene, paintStill } from './gl/scene.js'
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

// (one task per part: the page stays responsive while it sets itself up)
const nextTask = () => new Promise((r) => (globalThis.scheduler?.yield ? globalThis.scheduler.yield().then(r) : setTimeout(r, 0)))
const run = (fn) => {
  try {
    return fn()
  } catch (err) {
    console.error(err)
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
  const loader = runLoader({ reduced, revisit })

  trackPointer()
  initCursor()
  const menu = initMenu({ reduced })
  initAnchors(() => menu.close())
  const booking = initBooking({ reduced, beforeOpen: () => menu.close() })

  const app = {}
  // Klang – one switch in the header, one in the menu on phones; they stay in step
  const soundBtns = qsa('[data-sound]')
  const nature = createNature(() => app.land?.look)
  soundBtns.forEach((btn) =>
    btn.addEventListener('click', () => {
      const on = nature.toggle()
      soundBtns.forEach((b) => b.setAttribute('aria-pressed', String(on)))
    }),
  )

  const steps = [
    // the landscape (opening and closing) and the hero
    () => {
      const canvas = qs('[data-scene]')
      try {
        app.scene = createScene(canvas, { reduced })
      } catch (err) {
        console.warn(err)
      }
      app.hero = prepareHero({ reduced })
      app.land = initLandscape({ scene: app.scene, reduced })
      // (without WebGL – and until the shader is compiled – the silhouette in .scene__fallback shows, coloured by the hour)
      const live = (on) => {
        qs('.scene').classList.toggle('is-live', on)
        app.land.refresh()
      }
      if (app.scene?.ready) live(true)
      canvas.addEventListener('scene:ready', () => live(true))
      // the GPU may drop the scene for a moment: the silhouette meanwhile
      canvas.addEventListener('scene:lost', () => live(false))
    },
    () => (app.chrome = initHeader()),
    () => (app.reveals = initReveals({ reduced })),
    // (the body's relief takes a moment to build: only when the section comes near)
    () => whenNear(qs('[data-bodymap]'), () => run(() => initBodyMap({ reduced })), '900px'),
    () => initSignets({ reduced }),
    () => {
      // the breath drives the Atempause headline (once its letters exist)
      const title = qs('[data-breath-title]')
      const breathKin = {
        set offset(v) {
          const k = app.reveals?.kinetics.get(title)
          if (!k) return
          k.offset = v
          k.wake()
        },
      }
      initBreath({ reduced, title: reduced ? null : breathKin })
    },
    () => initPlanner({ webgl: !!app.scene }),
    () => initPostcard({ reduced, webgl: !!app.scene }),
    () => initHours(),
    () => initFaq(),
    () => initMap({ reduced }),
  ]
  const ready = (async () => {
    for (const step of steps) {
      await nextTask()
      run(step)
    }
    if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { __land: app.land, __scene: app.scene, __reveals: app.reveals, __paintStill: paintStill })
  })()

  Promise.all([loader, ready]).then(() => {
    try {
      sessionStorage.setItem('cb4-visited', '1')
    } catch {}
    startScroll('loader')
    app.hero?.play()
    ScrollTrigger.refresh()
    app.land?.refresh()
    app.chrome?.refresh()
    app.land?.showHint()
    // a link to /#termin opens the request dialog
    if (location.hash === '#termin') booking.open()
    else if (location.hash) {
      const target = document.getElementById(decodeURIComponent(location.hash.slice(1)))
      if (target) scrollTo(target, { immediate: true, offset: -8 })
    }
  })

  console.log('%cZeit für dich.%c\nMassage Claudia Bürgi, Kestenholz – 078 224 91 97', 'font: italic 300 24px Georgia, serif; color: #a8471f', 'font: 13px sans-serif')
}
