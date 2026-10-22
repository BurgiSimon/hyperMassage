import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, qsa, splitChars } from '../utils/helpers.js'
import { getLenis } from '../core/scroll.js'

gsap.registerPlugin(ScrollTrigger)

/* ───────────── Hero intro + scroll-out ───────────── */
export function prepareHero() {
  const words = qsa('[data-hero-word]')
  const chars = words.flatMap((w) => splitChars(w, 'hero__char'))
  gsap.set(chars, { yPercent: 118, rotate: 6 })
  gsap.set('[data-hero-fade]', { autoAlpha: 0, y: 24 })
  // the lead stays painted (it is the page's largest text) and only rises into place
  gsap.set('[data-hero-rise]', { y: 28 })
  gsap.set('[data-hero-hint]', { autoAlpha: 0 })
  return chars
}

export function playHeroIntro(chars) {
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } })
  tl.to(chars, {
    yPercent: 0,
    rotate: 0,
    duration: 1.8,
    stagger: 0.06,
    onComplete: () => gsap.set(chars, { willChange: 'auto' }),
  })
    .to('[data-hero-rise]', { y: 0, duration: 1.6 }, 0.4)
    .to('[data-hero-fade]', { autoAlpha: 1, y: 0, duration: 1.4, stagger: 0.1 }, 0.5)
    .to('[data-hero-hint]', { autoAlpha: 1, duration: 1.2 }, 1.4)
  return tl
}

export function initHeroScroll() {
  const hero = qs('#start')
  if (!hero) return

  // the hand brings warmth: a soft ember light follows the pointer
  const glow = qs('.hero__glow', hero)
  if (glow && window.matchMedia('(hover: hover)').matches) {
    const pos = { x: 58, y: 50 }
    const xTo = gsap.quickTo(pos, 'x', { duration: 1.4, ease: 'power3.out' })
    const yTo = gsap.quickTo(pos, 'y', { duration: 1.4, ease: 'power3.out' })
    hero.addEventListener('pointermove', (e) => {
      const r = hero.getBoundingClientRect()
      xTo(((e.clientX - r.left) / r.width) * 100)
      yTo(((e.clientY - r.top) / r.height) * 100)
    })
    let active = true
    ScrollTrigger.create({ trigger: hero, start: 'top bottom', end: 'bottom top', onToggle: (self) => (active = self.isActive) })
    gsap.ticker.add(() => {
      if (!active) return
      glow.style.setProperty('--cx', `${pos.x.toFixed(2)}%`)
      glow.style.setProperty('--cy', `${pos.y.toFixed(2)}%`)
    })
  }
  const title = qs('.hero__title', hero)
  // pause the breathing words while the hero is out of view
  ScrollTrigger.create({
    trigger: hero,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => hero.classList.toggle('is-away', !self.isActive),
  })
  gsap
    .timeline({
      scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true },
    })
    .to(title, { yPercent: 18, ease: 'none' }, 0)
    .to(qs('.hero__line--1', hero), { xPercent: -6, ease: 'none' }, 0)
    .to(qs('.hero__line--2', hero), { xPercent: 6, ease: 'none' }, 0)
    .fromTo(['.hero__meta', '.hero__foot'], { opacity: 1, yPercent: 0 }, { opacity: 0, yPercent: -30, ease: 'none' }, 0)
}

/* ───────────── About ───────────── */
export function initAbout() {
  const frame = qs('.portrait__frame')
  const img = qs('.portrait__img')
  if (!frame || !img) return
  gsap.fromTo(
    frame,
    { clipPath: 'inset(100% 0% 0% 0% round 999px 999px 20px 20px)' },
    {
      clipPath: 'inset(0% 0% 0% 0% round 999px 999px 20px 20px)',
      duration: 1.8,
      ease: 'expo.inOut',
      scrollTrigger: { trigger: frame, start: 'top 85%', once: true },
    },
  )
  gsap.fromTo(
    img,
    { yPercent: -8, scale: 1.15 },
    {
      yPercent: 0,
      scale: 1,
      ease: 'none',
      scrollTrigger: { trigger: '#ueber-mich', start: 'top bottom', end: 'bottom top', scrub: true },
    },
  )
  const seal = qs('[data-seal]')
  if (seal) {
    gsap.from(seal, {
      scale: 0,
      rotate: -90,
      duration: 1.6,
      ease: 'expo.out',
      scrollTrigger: { trigger: frame, start: 'top 55%', once: true },
    })
  }
}

/* ───────────── Marquee (velocity reactive) ───────────── */
export function initMarquee() {
  const wrap = qs('[data-marquee]')
  const track = qs('[data-marquee-track]')
  if (!wrap || !track) return
  // duplicate content for a seamless loop
  const original = track.innerHTML
  track.innerHTML = original + original + original
  let x = 0
  let speed = 1
  let width = track.scrollWidth / 3
  const lenis = getLenis()
  window.addEventListener('resize', () => (width = track.scrollWidth / 3))

  let visible = false
  ScrollTrigger.create({
    trigger: wrap,
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => (visible = self.isActive),
  })

  gsap.ticker.add((_, delta) => {
    if (!visible) return
    const v = lenis ? lenis.velocity : 0
    const target = 1 + Math.min(Math.abs(v) * 0.12, 6)
    speed += (target * Math.sign(v || 1) - speed) * 0.08
    x -= speed * (delta / 16.67) * 0.9
    if (x <= -width) x += width
    if (x > 0) x -= width
    track.style.transform = `translate3d(${x}px,0,0)`
  })
}

/* ───────────── Services: pinned horizontal journey ───────────── */
export function initServices({ reduced = false } = {}) {
  const section = qs('#angebot')
  const pin = qs('[data-services-pin]')
  const track = qs('[data-services-track]')
  const bar = qs('[data-services-bar]')
  const counter = qs('[data-services-count]')
  if (!section || !track) return

  const cards = qsa('.service', track)
  const total = qsa('[data-service]', track).length

  if (reduced) return
  const mm = gsap.matchMedia()
  mm.add('(min-width: 1024px)', () => {
    const distance = () => track.scrollWidth - window.innerWidth
    const tween = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      scrollTrigger: {
        trigger: pin,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 0.8,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          if (bar) bar.style.transform = `scaleX(${self.progress})`
          if (counter) {
            const i = Math.min(total, Math.floor(self.progress * total * 0.999) + 1)
            counter.textContent = `${String(i).padStart(2, '0')} / ${String(total).padStart(2, '0')}`
          }
        },
      },
    })

    // subtle depth: cards drift and art scales as they travel
    cards.forEach((card) => {
      const art = qs('.service__art', card)
      if (!art) return
      gsap.fromTo(
        art,
        { scale: 0.86 },
        {
          scale: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: card,
            containerAnimation: tween,
            start: 'left right',
            end: 'center center',
            scrub: true,
          },
        },
      )
    })
    return () => gsap.set(track, { clearProps: 'transform' })
  })

  mm.add('(max-width: 1023px)', () => {
    cards.forEach((card) => {
      gsap.from(card, {
        y: 60,
        autoAlpha: 0,
        duration: 1.2,
        ease: 'expo.out',
        scrollTrigger: { trigger: card, start: 'top 90%', once: true },
      })
    })
  })
}

/* ───────────── Chapter indicator (desktop) ───────────── */
export function initChapters() {
  const el = qs('[data-chapter]')
  if (!el) return
  const label = qs('[data-chapter-label]', el)
  const sections = qsa('main > section[id], main > [data-chapter-name]')
  let current = ''
  const set = (text) => {
    if (text === current) return
    current = text
    gsap.to(label, {
      yPercent: -100,
      autoAlpha: 0,
      duration: 0.3,
      ease: 'power2.in',
      onComplete: () => {
        label.textContent = text
        gsap.fromTo(label, { yPercent: 100, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.6, ease: 'expo.out' })
      },
    })
  }
  sections.forEach((section) => {
    const eyebrow = qs('.eyebrow', section)
    const text = section.id === 'start' ? '(00) Lass los' : eyebrow?.textContent.replace(/\s+/g, ' ').trim()
    if (!text) return
    ScrollTrigger.create({
      trigger: section,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => self.isActive && set(text),
    })
  })
  // the hero and the footer have their own way-finding
  const toggle = (show) => gsap.to(el, { autoAlpha: show ? 1 : 0, duration: 0.6, overwrite: 'auto' })
  ScrollTrigger.create({
    trigger: '#start',
    start: 'top top',
    end: 'bottom 40%',
    onLeave: () => toggle(true),
    onEnterBack: () => toggle(false),
  })
  ScrollTrigger.create({
    trigger: '.footer',
    start: 'top 70%',
    onEnter: () => toggle(false),
    onLeaveBack: () => toggle(true),
  })
}
