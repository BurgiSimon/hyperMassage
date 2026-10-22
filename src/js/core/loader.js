import gsap from 'gsap'
import { qs } from '../utils/helpers.js'

/**
 * Breathing preloader: the ember grows while assets load ("Atme ein"),
 * then exhales and opens onto the page ("und lass los").
 * Resolves when the page should start its intro animation.
 */
export function runLoader({ ready, reduced }) {
  const el = qs('[data-loader]')
  if (!el) return Promise.resolve()

  const revisit = document.documentElement.classList.contains('is-revisit')
  const orb = qs('.loader__orb', el)
  const wordIn = qs('[data-loader-in]', el)
  const wordOut = qs('[data-loader-out]', el)
  const count = qs('[data-loader-count]', el)

  try {
    sessionStorage.setItem('cb-visited', '1')
  } catch (e) {
    /* storage unavailable */
  }

  if (reduced) {
    return ready.then(() => {
      gsap.to(el, { autoAlpha: 0, duration: 0.4, onComplete: () => el.remove() })
    })
  }

  const minDuration = revisit ? 0.9 : 2.2
  const progress = { value: 0 }
  const state = { loaded: false }
  ready.then(() => (state.loaded = true))

  return new Promise((resolve) => {
    gsap.set(wordIn, { autoAlpha: 0, y: 12 })
    gsap.set(wordOut, { autoAlpha: 0, y: 12 })
    gsap.to(wordIn, { autoAlpha: 1, y: 0, duration: 1, ease: 'expo.out', delay: 0.15 })

    // inhale: progress creeps to 90% on its own, the rest waits for assets
    const inhale = gsap.to(progress, {
      value: 90,
      duration: minDuration,
      ease: 'sine.inOut',
      onUpdate: () => {
        count.textContent = String(Math.round(progress.value)).padStart(3, '0')
        gsap.set(orb, { scale: 0.18 + (progress.value / 100) * 0.82 })
      },
    })

    const finish = () => {
      gsap
        .timeline({
          onComplete: () => {
            el.remove()
          },
        })
        .to(progress, {
          value: 100,
          duration: 0.5,
          ease: 'power2.out',
          onUpdate: () => {
            count.textContent = String(Math.round(progress.value)).padStart(3, '0')
            gsap.set(orb, { scale: 0.18 + (progress.value / 100) * 0.82 })
          },
        })
        .to(wordIn, { autoAlpha: 0, y: -12, duration: 0.5, ease: 'power2.in' }, '<')
        .to(wordOut, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'expo.out' })
        .to(orb, { scale: 0.92, duration: 0.6, ease: 'sine.inOut' }, '<')
        .add(() => resolve(), '+=0.15')
        .to(orb, { scale: 9, duration: 1.4, ease: 'expo.inOut' }, '<')
        .to([wordOut, count, qs('.loader__brand', el)], { autoAlpha: 0, duration: 0.4 }, '<')
        .to(el, { autoAlpha: 0, duration: 0.9, ease: 'power2.inOut' }, '<0.55')
    }

    const waitForAssets = () => {
      if (state.loaded) return finish()
      // keep breathing gently while we wait
      const wait = gsap.to(orb, { scale: 0.86, duration: 1.2, yoyo: true, repeat: -1, ease: 'sine.inOut' })
      ready.then(() => {
        wait.kill()
        finish()
      })
    }

    inhale.eventCallback('onComplete', waitForAssets)
  })
}
