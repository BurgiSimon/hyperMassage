import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, splitChars } from '../utils/helpers.js'

gsap.registerPlugin(ScrollTrigger)

/** Giant wordmark whose letters soften and swell under the cursor. */
export function initWordmark({ reduced }) {
  const el = qs('[data-wordmark]')
  if (!el) return
  const chars = splitChars(el, 'wm-char')

  // fit the wordmark edge to edge
  const fit = () => {
    const cs = getComputedStyle(el)
    // leave headroom: letters swell (and widen) under the cursor
    const target = (el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) * 0.93
    let size = 100
    for (let pass = 0; pass < 3; pass++) {
      el.style.fontSize = `${size}px`
      const natural = chars[chars.length - 1].getBoundingClientRect().right - chars[0].getBoundingClientRect().left
      if (natural <= 0) return
      size *= target / natural
    }
    el.style.fontSize = `${size}px`
  }
  fit()
  window.addEventListener('resize', fit)
  document.fonts?.ready.then(fit)
  if (reduced) return

  gsap.from(chars, {
    yPercent: 100,
    autoAlpha: 0,
    duration: 1.6,
    stagger: 0.04,
    ease: 'expo.out',
    scrollTrigger: { trigger: el, start: 'top 95%', once: true },
  })

  if (!window.matchMedia('(hover: hover)').matches) return
  const weights = chars.map(() => ({ w: 300, y: 0 }))
  let centers = []
  const measure = () => {
    centers = chars.map((c) => {
      const r = c.getBoundingClientRect()
      return r.left + r.width / 2
    })
  }
  measure()
  window.addEventListener('resize', () => requestAnimationFrame(measure))
  ScrollTrigger.create({ trigger: el, start: 'top bottom', onEnter: measure })

  const apply = (i) => {
    const { w, y } = weights[i]
    chars[i].style.fontVariationSettings = `"wght" ${w.toFixed(0)}, "SOFT" 100, "WONK" ${w > 480 ? 1 : 0}, "opsz" 144`
    chars[i].style.transform = `translateY(${y.toFixed(2)}%)`
  }

  const footer = el.closest('footer')
  footer.addEventListener('pointermove', (e) => {
    const radius = window.innerWidth * 0.12
    chars.forEach((_, i) => {
      const d = Math.abs(e.clientX - centers[i])
      const k = Math.max(0, 1 - d / radius)
      const ease = k * k * (3 - 2 * k)
      gsap.to(weights[i], {
        w: 300 + ease * 450,
        y: -ease * 6,
        duration: 0.6,
        ease: 'power3.out',
        overwrite: true,
        onUpdate: () => apply(i),
      })
    })
  })
  footer.addEventListener('pointerleave', () => {
    chars.forEach((_, i) =>
      gsap.to(weights[i], { w: 300, y: 0, duration: 1.2, ease: 'expo.out', overwrite: true, onUpdate: () => apply(i) }),
    )
  })
}
