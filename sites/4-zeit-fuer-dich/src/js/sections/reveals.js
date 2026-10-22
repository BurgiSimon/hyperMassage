import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, qsa, clamp, smoothstep, fontsReady, onVisibility, whenNear } from '../utils/helpers.js'
import { Kinetic, splitText, freezeLines } from '../core/kinetic.js'

gsap.registerPlugin(ScrollTrigger)

/*
 * Split text measures its line breaks once. They are measured again when the width changes
 * (height-only resizes – phone toolbars – do not), and when the display font arrives late.
 */
const rebuilders = new Set()
const onWidthChange = (cb) => rebuilders.add(cb)
const rebuildAll = () => rebuilders.forEach((cb) => cb())
{
  let w = window.innerWidth
  let t = null
  window.addEventListener('resize', () => {
    if (window.innerWidth === w) return
    w = window.innerWidth
    clearTimeout(t)
    t = setTimeout(rebuildAll, 180)
  })
  const fraunces = '360 16px Fraunces'
  if (document.fonts && !document.fonts.check(fraunces)) {
    const late = () => {
      if (!document.fonts.check(fraunces)) return
      document.fonts.removeEventListener('loadingdone', late)
      rebuildAll()
    }
    document.fonts.addEventListener('loadingdone', late)
  }
  // a split that changes a heading's height moves everything below it: the triggers are measured again
  let r = null
  document.addEventListener('kinetic:resize', () => {
    clearTimeout(r)
    r = setTimeout(() => ScrollTrigger.refresh(), 120)
  })
}

/**
 * The hero: «Zeit für dich.» arrives tense and exhales. Scrolling away relaxes it
 * further while the warm sheet rises; letters near the pointer let go first.
 */
export function prepareHero({ reduced }) {
  const title = qs('[data-hero-title]')
  const fades = qsa('[data-hero-fade], .hero__greet, .hero__down')
  if (reduced || !title) return { play() {}, kinetic: null }
  gsap.set(fades, { opacity: 0, y: 18 })
  // (the title itself fades: its lines are rebuilt when the letters are split)
  gsap.set(title, { opacity: 0 })
  let kin = null
  const ready = fontsReady().then(() => {
    kin = new Kinetic(title, { radius: 260, strength: 1, start: -1, stagger: 0.05 })
    kin.setVisible(true)
    onWidthChange(() => kin.rebuild())
    onVisibility(title, (v) => kin.setVisible(v), '0px')
    // scrolling on relaxes the title further, and it drifts up a little slower than the page
    ScrollTrigger.create({
      trigger: '.hero',
      start: 'top top',
      end: 'bottom top',
      onUpdate: (self) => {
        kin.offset = smoothstep(0, 0.7, self.progress) * 0.9
        kin.wake()
      },
    })
    gsap.to(title, { yPercent: 28, ease: 'none', scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } })
  })
  return {
    play() {
      ready.then(() => {
        gsap.to(title, { opacity: 1, duration: 1.2, ease: 'power2.out' })
        kin.release(0.25)
        gsap.to(fades, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08, delay: 0.7, clearProps: 'transform' })
      })
    },
    get kinetic() {
      return kin
    },
  }
}

export function initReveals({ reduced }) {
  const kinetics = new Map()
  if (!reduced) {
    // ───── headlines exhale as they arrive ─────
    // (each is split into letters only when it comes near: the work is spread out, not done at load)
    fontsReady().then(() => {
      qsa('[data-kin]').forEach((el) =>
        whenNear(
          el,
          () => {
            const kin = new Kinetic(el, { start: -1 })
            kinetics.set(el, kin)
            onVisibility(el, (v) => kin.setVisible(v), '0px')
            ScrollTrigger.create({ trigger: el, start: 'top 86%', once: true, onEnter: () => kin.release(0.1) })
          },
          '400px',
        ),
      )
      onWidthChange(() => kinetics.forEach((k) => k.rebuild()))
    })

    // ───── the welcome statement: each word exhales as you read it ─────
    qsa('[data-scrub-words]').forEach((el) => {
      let words = []
      const split = () => {
        const h = el.offsetHeight
        const s = splitText(el, { letters: false, wordClass: 'sw' })
        words = s.words
        // (line breaks measured with every word still tense – the widest it gets)
        words.forEach((w) => w.style.setProperty('--r', 0))
        freezeLines(s.visual, words)
        paint(st?.progress ?? 0)
        if (el.offsetHeight !== h) el.dispatchEvent(new CustomEvent('kinetic:resize', { bubbles: true }))
      }
      let shown = []
      const paint = (p) => {
        const n = words.length
        const spread = 3
        words.forEach((w, i) => {
          const r = Math.round(clamp((p * (n + spread) - i) / spread) * 100) / 100
          if (shown[i] === r) return
          shown[i] = r
          w.style.setProperty('--r', r)
        })
      }
      const st = ScrollTrigger.create({ trigger: el, start: 'top 82%', end: 'bottom 48%', onUpdate: (self) => paint(self.progress) })
      fontsReady().then(() =>
        whenNear(el, () => {
          shown = []
          split()
        }),
      )
      onWidthChange(() => {
        shown = []
        split()
      })
    })

    // ───── the portrait opens like a window ─────
    const frame = qs('.about__frame')
    if (frame) {
      gsap.fromTo(frame, { clipPath: 'inset(100% 0 0 0 round 999px 999px 22px 22px)' }, { clipPath: 'inset(0% 0 0 0 round 999px 999px 22px 22px)', duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: frame, start: 'top 85%', once: true } })
      gsap.fromTo(qs('img', frame), { scale: 1.25 }, { scale: 1, duration: 2.2, ease: 'expo.out', scrollTrigger: { trigger: frame, start: 'top 85%', once: true } })
    }

    // ───── everything else drifts in ─────
    const els = qsa(
      '.sec__head, .sheet .lead, .about__text > p, .facts > div, .zones, .bodymap__stage, .bodymap__result, .service, .breath__stage, .breath__actions, .tariff li, .tariff__notes, .planner, .gift__form, .postcard, .faq details, .phone, .links li, .hours, .visit address, .visit__geo, .visit__links, .visit__map, .footer__cols > div',
    )
    gsap.set(els, { opacity: 0, y: 28 })
    const hidden = new Set(els)
    const show = (batch) => {
      batch.forEach((el) => hidden.delete(el))
      // (clear the inline styles afterwards, so CSS states apply again)
      gsap.to(batch, { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out', stagger: 0.06, overwrite: true, clearProps: 'opacity,transform' })
    }
    ScrollTrigger.batch(els, { start: 'top 92%', once: true, onEnter: show })
    // keyboard focus on something not yet faded in (e.g. right at the bottom edge): show it at once
    document.addEventListener('focusin', (e) => {
      const el = [...hidden].find((h) => h.contains(e.target))
      if (el) show([el])
    })
  }

  // ───── the footer: the words let go completely as the night comes ─────
  const word = qs('[data-footer-word]')
  if (word && !reduced) {
    fontsReady().then(() => {
      const kin = new Kinetic(word, { start: -1, stagger: 0.06, strength: 0.4 })
      onVisibility(word, (v) => kin.setVisible(v), '0px')
      onWidthChange(() => kin.rebuild())
      ScrollTrigger.create({ trigger: word, start: 'top 80%', once: true, onEnter: () => kin.release(0) })
      ScrollTrigger.create({
        trigger: '.footer',
        start: 'top bottom',
        end: 'top top',
        onUpdate: (self) => {
          kin.offset = self.progress
          kin.wake()
        },
      })
    })
  }
  return { kinetics }
}
