import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, qsa } from '../utils/helpers.js'

/** Accordion on native <details>: works without JS, glides with it. */
export function initFaq({ reduced, emit }) {
  const items = qsa('[data-faq-item]')
  if (!items.length) return
  let refreshTimer = 0
  const refresh = () => {
    clearTimeout(refreshTimer)
    refreshTimer = setTimeout(() => ScrollTrigger.refresh(), 120)
  }

  const close = (item) => {
    const body = qs('.faq__a', item)
    if (reduced) {
      item.open = false
      return refresh()
    }
    gsap.fromTo(
      body,
      { height: body.offsetHeight },
      {
        height: 0,
        duration: 0.6,
        ease: 'expo.inOut',
        onComplete: () => {
          item.open = false
          gsap.set(body, { clearProps: 'height' })
          refresh()
        },
      },
    )
  }

  const open = (item) => {
    item.open = true
    const body = qs('.faq__a', item)
    if (reduced) return refresh()
    gsap.fromTo(
      body,
      { height: 0 },
      { height: 'auto', duration: 0.8, ease: 'expo.out', onComplete: refresh },
    )
    gsap.fromTo(qs('p', body), { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.8, ease: 'expo.out', delay: 0.05 })
  }

  items.forEach((item) => {
    qs('summary', item).addEventListener('click', (e) => {
      e.preventDefault()
      if (item.open) {
        close(item)
      } else {
        items.filter((other) => other !== item && other.open).forEach(close)
        open(item)
      }
      emit?.('ui:tick')
    })
  })
}
