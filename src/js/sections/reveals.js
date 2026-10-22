import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { qsa, splitWords } from '../utils/helpers.js'

gsap.registerPlugin(ScrollTrigger, SplitText)

export function initReveals() {
  // Headlines: line-by-line rise from behind a mask
  qsa('[data-split-lines]').forEach((el) => {
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'split-line',
      autoSplit: true,
      onSplit: (self) =>
        gsap.from(self.lines, {
          yPercent: 115,
          rotate: 2,
          duration: 1.4,
          stagger: 0.09,
          ease: 'expo.out',
          scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        }),
    })
  })

  // Simple fade-up, batched for nice staggering
  ScrollTrigger.batch('[data-reveal-fade]', {
    start: 'top 92%',
    once: true,
    onEnter: (batch) =>
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        duration: 1.2,
        stagger: 0.08,
        ease: 'expo.out',
        overwrite: true,
      }),
  })

  // Statement text that lights up word by word as you read
  qsa('[data-scrub-words]').forEach((el) => {
    const words = splitWords(el)
    gsap.to(words, {
      opacity: 1,
      stagger: 0.1,
      ease: 'none',
      scrollTrigger: {
        trigger: el,
        start: 'top 78%',
        end: 'bottom 42%',
        scrub: 0.6,
      },
    })
  })

  // Counters
  qsa('[data-count-to]').forEach((el) => {
    const to = parseFloat(el.dataset.countTo)
    const from = parseFloat(el.dataset.countFrom ?? 0)
    const obj = { v: from }
    ScrollTrigger.create({
      trigger: el,
      start: 'top 92%',
      once: true,
      onEnter: () =>
        gsap.to(obj, {
          v: to,
          duration: 2.2,
          ease: 'expo.out',
          onUpdate: () => (el.textContent = Math.round(obj.v)),
        }),
    })
  })
}

/** Show everything immediately (reduced motion). */
export function revealAllInstantly() {
  qsa('[data-reveal-fade]').forEach((el) => {
    el.style.opacity = 1
    el.style.transform = 'none'
  })
}
