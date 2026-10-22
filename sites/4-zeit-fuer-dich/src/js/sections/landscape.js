import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, qsa, clamp, smoothstep, openStatus, fmtTime, canHover, zurichNow, HOURS, fontsReady } from '../utils/helpers.js'
import { look, mixLook } from '../gl/scene.js'
import { nowHour, zurichDay, STORY_DAY } from '../gl/sun.js'

gsap.registerPlugin(ScrollTrigger)

// the closing scene: from the last light after sunset into the first deep night (mid-October)
const DUSK = 18.5
const NIGHT = 20.4

/**
 * The real landscape north of the practice, in two takes.
 * Opening: the sky over Kestenholz right now (drag the sun to see any hour).
 * Closing: the same view from dusk into night, while the footer rises.
 * In between, the warm sheet covers it and the renderer rests.
 */
export function initLandscape({ scene, reduced }) {
  const html = document.documentElement
  const hero = qs('.hero')
  const footer = qs('[data-footer]')
  const veil = qs('[data-scene-veil]')
  const fallback = qs('[data-scene-fallback]')
  let today = zurichDay()

  const live = { hour: nowHour(), override: null }
  let heroLook = look(live.hour, today)
  const nightLooks = new Map()
  const nightLook = (h) => {
    const k = Math.round(h * 60)
    if (!nightLooks.has(k)) nightLooks.set(k, look(k / 60, STORY_DAY))
    return nightLooks.get(k)
  }

  // ───── colours that read on the current sky ─────
  const rgb = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(' ')})`
  const paintFallback = (L) => {
    // (only while there is no live scene – the layer sits behind the canvas otherwise)
    if (!fallback || (scene && !scene.lost)) return
    const k = 0.2 + 0.8 * L.amb
    const land = [0.2, 0.27, 0.19].map((v, i) => v * k * 0.75 + L.fog[i] * 0.25 * k)
    fallback.style.setProperty('--fb-zen', rgb(L.zen))
    fallback.style.setProperty('--fb-hor', rgb(L.hor))
    fallback.style.setProperty('--fb-land', rgb(land))
  }
  let lastSky = ''
  let lastBg = ''
  const paintSky = (L) => {
    paintFallback(L)
    // the page behind the sheet (and the browser bar while the sky shows) follows the sky
    const zen = `rgb(${L.zen.map((v) => Math.round(v * 31) * 8).join(',')})`
    if (zen !== lastBg) {
      lastBg = zen
      html.style.backgroundColor = zen
    }
    // dark or light ink – never a grey in between (CSS cross-fades the switch)
    const light = L.skyLum > 0.5
    const sky = light ? 'light' : 'dark'
    if (sky === lastSky) return
    lastSky = sky
    html.dataset.sky = sky
    html.style.setProperty('--sky-ink', light ? '#1d1916' : '#f3ead9')
    html.style.setProperty('--sky-ink-soft', light ? 'rgb(29 25 22 / 0.72)' : 'rgb(243 234 217 / 0.78)')
    html.style.setProperty('--chrome-sky', light ? 'rgb(241 233 221 / 0.62)' : 'rgb(23 19 15 / 0.42)')
    html.style.setProperty('--sky-halo', light ? 'rgb(255 250 240 / 0.35)' : 'rgb(10 8 6 / 0.35)')
    document.dispatchEvent(new CustomEvent('sky:tone', { detail: sky }))
  }

  // ───── which take is on screen ─────
  const m = { heroH: 0, footTop: 0 }
  const measure = () => {
    m.heroH = hero.offsetHeight
    m.footTop = footer.getBoundingClientRect().top + window.scrollY
  }
  const current = { look: heroLook, hour: live.hour, take: 'hero' }
  const update = () => {
    const y = window.scrollY
    const vh = window.innerHeight
    const footIn = m.footTop - y < vh + 2
    const heroIn = y < m.heroH
    scene?.setActive(footIn || heroIn)
    if (footIn) {
      // the footer rises: dusk turns to night
      const p = smoothstep(0, 1, clamp(1 - (m.footTop - y) / vh))
      const hour = DUSK + (NIGHT - DUSK) * p
      const L = nightLook(hour)
      scene?.setLook(L, hour)
      if (veil) veil.style.opacity = 0
      Object.assign(current, { look: L, hour, take: 'night' })
      paintSky(L)
      return
    }
    const L = heroLook
    const h = live.override ?? live.hour
    scene?.setLook(L, h)
    // the warm sheet rises: the evening light dims the view behind it
    if (veil) veil.style.opacity = (clamp(y / Math.max(1, m.heroH)) * 0.85).toFixed(3)
    Object.assign(current, { look: L, hour: h, take: 'hero' })
    paintSky(L)
  }

  measure()
  update()
  ScrollTrigger.addEventListener('refresh', () => {
    measure()
    update()
  })
  window.addEventListener('scroll', update, { passive: true })

  // ───── the practice, right now: greeting, header status, footer clock ─────
  const greet = qs('[data-greeting]')
  const nowEl = qs('[data-now]')
  const nowTime = qs('[data-now-time]')
  const nowText = qs('[data-now-text]')
  const paintStatus = () => {
    const n = zurichNow()
    const h = n.decimal
    // (no «Gute Nacht» – that is a goodbye)
    if (greet)
      greet.textContent =
        h >= 5 && h < 11 ? 'Guten Morgen aus Kestenholz' : h >= 11 && h < 17 ? 'Guten Tag aus Kestenholz' : h >= 17 ? 'Guten Abend aus Kestenholz' : 'Spät noch wach? Grüsse aus Kestenholz'
    const st = openStatus(n)
    if (nowTime) nowTime.textContent = `${String(n.hour).padStart(2, '0')}:${String(n.minute).padStart(2, '0')}`
    if (nowText) nowText.textContent = st.text
    nowEl?.classList.toggle('is-open', st.open)
    nowEl?.setAttribute('aria-label', `Kestenholz, ${fmtTime(h)} Uhr: ${st.text}`)
  }
  paintStatus()
  setInterval(() => {
    live.hour = nowHour()
    today = zurichDay()
    paintStatus()
    if (live.override === null) heroLook = look(live.hour, today)
    update()
  }, 30000)

  // ───── summit labels on the real peaks ─────
  const peaks = qs('[data-peaks]')
  const blockers = () => qsa('.hero__title .kw, .hero__card, .hero__greet, .hero__hint, .hero__down')
  const placePeaks = () => {
    if (!scene || !peaks) return
    const W = window.innerWidth
    const items = qsa('li', peaks)
    peaks.classList.add('is-ready') // (labels must be displayable to be measured)
    const hr = hero.getBoundingClientRect()
    const pad = 12
    const taken = blockers()
      .filter((b) => b.offsetParent !== null)
      .map((b) => b.getBoundingClientRect())
      .map((r) => ({ l: r.left - pad, r: r.right + pad, t: r.top - hr.top - pad, b: r.bottom - hr.top + pad }))
    const clash = (a) => taken.some((r) => a.l < r.r && a.r > r.l && a.t < r.b && a.b > r.t)
    items.forEach((li) => {
      li.classList.remove('is-on')
      const p = scene.project(parseFloat(li.dataset.az), parseFloat(li.dataset.el))
      if (!p || p.x < 8 || p.x > W - 8 || p.y < window.innerHeight * 0.25) return
      // measure the label, then try it centred over its summit, then nudged to either side
      li.classList.add('is-on')
      const lw = li.offsetWidth
      const lh = li.offsetHeight
      const bottom = p.y - 16
      const box = (left) => ({ l: left, r: left + lw, t: bottom - lh, b: p.y })
      const lo = 8
      const hi = W - lw - 8
      const tries = [p.x - lw / 2, p.x - 18, p.x - lw + 18].map((x) => Math.min(hi, Math.max(lo, x)))
      const left = tries.find((x) => !clash(box(x)))
      if (left === undefined) {
        li.classList.remove('is-on')
        return
      }
      taken.push(box(left))
      li.style.left = `${left}px`
      li.style.top = `${bottom}px`
      // the leader line still points at the summit
      li.style.setProperty('--lx', `${(p.x - left).toFixed(1)}px`)
    })
  }
  if (scene) {
    // (after the scene has measured its new size – not on the window's resize event)
    document.addEventListener('scene:resize', placePeaks)
    fontsReady().then(placePeaks)
  }

  // ───── drag the sun across the sky ─────
  const hint = qs('[data-sun-hint]')
  const hintText = qs('[data-sun-hint-text]')
  const canDrag = !!(scene && hero && !reduced)
  if (canDrag) {
    let dragging = false
    const isInteractive = (el) => el.closest('a, button, input, label, .peaks li, .hero__card')
    const setFromX = (x) => {
      // (the sun is drawn for today: search today's path)
      const hr = scene.hourFromX(x, live.override ?? live.hour, today)
      live.override = hr
      heroLook = look(hr, today)
      update()
      const dayOpen = HOURS[zurichNow().day]
      const isOpen = dayOpen && hr >= dayOpen[0] && hr < dayOpen[1]
      hintText.textContent = `${fmtTime(hr)} Uhr${dayOpen ? (isOpen ? ' · Praxis offen' : ' · Praxis geschlossen') : ''}`
    }
    // the sun moves once the pointer does: a stray click changes nothing, and a finger
    // only takes the sun when it moves sideways (a vertical swipe just scrolls)
    let start = null
    hero.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || isInteractive(e.target) || window.scrollY > 40) return
      start = { x: e.clientX, y: e.clientY, mouse: e.pointerType === 'mouse' }
    })
    hero.addEventListener('pointermove', (e) => {
      if (!dragging && start) {
        const dx = Math.abs(e.clientX - start.x)
        if (start.mouse ? Math.hypot(dx, e.clientY - start.y) < 4 : dx < 8 || dx < Math.abs(e.clientY - start.y)) return
        dragging = true
        hero.classList.add('is-dragging')
        hero.setPointerCapture(e.pointerId)
        gsap.to(hint, { opacity: 1, duration: 0.4, overwrite: true })
      }
      if (dragging) setFromX(e.clientX)
    })
    const end = () => {
      start = null
      if (!dragging) return
      dragging = false
      hero.classList.remove('is-dragging')
    }
    hero.addEventListener('pointerup', end)
    hero.addEventListener('pointercancel', end)
    // back to the real «now»
    hero.addEventListener('dblclick', (e) => {
      if (isInteractive(e.target) || live.override === null) return
      live.override = null
      heroLook = look(live.hour, today)
      update()
      hintText.textContent = 'Zieh die Sonne über den Himmel'
    })
    hero.classList.add('can-drag')
    // the cursor offers the sun only where it can be dragged
    if (canHover()) {
      const offer = () => (window.scrollY > 40 ? hero.removeAttribute('data-cursor') : hero.setAttribute('data-cursor', 'Sonne ziehen'))
      offer()
      window.addEventListener('scroll', offer, { passive: true })
    }
  }

  return {
    /** after the loader: offer the sun to drag */
    showHint() {
      if (!hint || !canDrag) return
      gsap.to(hint, { opacity: 1, duration: 1, delay: 2.2 })
      // once the visitor scrolls on, the hint has done its job
      const onScroll = () => {
        if (window.scrollY < 120) return
        gsap.to(hint, { opacity: 0, duration: 0.6, overwrite: true })
        window.removeEventListener('scroll', onScroll)
      }
      window.addEventListener('scroll', onScroll, { passive: true })
    },
    get look() {
      return current.look
    },
    get hour() {
      return current.hour
    },
    get take() {
      return current.take
    },
    /** the opening and the closing look, blended (sound) */
    mix: (t) => mixLook(heroLook, nightLook(NIGHT), t),
    refresh: () => {
      measure()
      update()
      placePeaks()
    },
  }
}
