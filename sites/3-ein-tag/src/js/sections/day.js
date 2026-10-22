import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { qs, qsa, clamp, smoothstep, openStatus, partOfDay, fmtTime, canHover, zurichNow, HOURS, fontsReady } from '../utils/helpers.js'
import { look, mixLook } from '../gl/scene.js'
import { nowHour, zurichDay, STORY_DAY } from '../gl/sun.js'

gsap.registerPlugin(ScrollTrigger)

const INK_DARK = [28, 30, 36]
const INK_LIGHT = [244, 236, 220]

/**
 * The day as you scroll: the hero shows the real sky over Kestenholz right now,
 * every section further down is an hour of a quiet October day.
 */
export function initDay({ scene, reduced }) {
  const html = document.documentElement
  const anchors = qsa('[data-hour]').map((el) => ({ el, hour: el.dataset.hour === 'now' ? null : parseFloat(el.dataset.hour), y: 0 }))
  const clockTime = qs('[data-clock-time]')
  const clockLabel = qs('[data-clock-label]')
  const clock = qs('[data-scene-clock]')
  const hero = qs('.hero')
  let today = zurichDay()

  const live = { hour: nowHour(), override: null }
  let heroLook = look(live.hour, today)
  const storyLooks = new Map()
  const storyLook = (h) => {
    const k = Math.round(h * 60)
    if (!storyLooks.has(k)) storyLooks.set(k, look(k / 60, STORY_DAY))
    return storyLooks.get(k)
  }

  const measure = () => {
    const vh = window.innerHeight
    const max = Math.max(1, document.documentElement.scrollHeight - vh)
    anchors.forEach((a, i) => {
      const r = a.el.getBoundingClientRect()
      const top = r.top + window.scrollY
      a.y = i === 0 ? 0 : i === anchors.length - 1 ? max : clamp(top + r.height / 2 - vh / 2, 0, max)
    })
  }

  // CSS colours that read well on the current sky
  let lastInk = ''
  let lastBg = ''
  const fallback = qs('[data-scene-fallback]')
  const rgb = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(' ')})`
  const paintFallbackSky = (L) => {
    // (only while there is no live scene – the layer sits behind the canvas otherwise)
    if (!fallback || (scene && !scene.lost)) return
    const k = 0.2 + 0.8 * L.amb
    const land = [0.2, 0.27, 0.19].map((v, i) => v * k * 0.75 + L.fog[i] * 0.25 * k)
    fallback.style.setProperty('--fb-zen', rgb(L.zen))
    fallback.style.setProperty('--fb-hor', rgb(L.hor))
    fallback.style.setProperty('--fb-land', rgb(land))
  }
  const paintChrome = (L) => {
    paintFallbackSky(L)
    // page background and browser bar follow the sky (a plain property on <html>: no restyle cascade)
    const zen = `rgb(${L.zen.map((v) => Math.round(v * 31) * 8).join(',')})`
    if (zen !== lastBg) {
      lastBg = zen
      html.style.backgroundColor = zen
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', zen)
    }
    // dark or light ink – never a grey in between (CSS cross-fades the switch)
    const t = L.skyLum > 0.5 ? 1 : 0
    const c = t ? INK_DARK : INK_LIGHT
    const ink = `rgb(${c.join(' ')})`
    if (ink !== lastInk) {
      lastInk = ink
      html.style.setProperty('--sky-ink', ink)
      html.style.setProperty('--sky-ink-soft', `rgb(${c.join(' ')} / 0.72)`)
      // (dark pills stay dense: light cards scroll under the header in the evening)
      html.style.setProperty('--chrome-bg', t ? 'rgb(246 241 231 / 0.62)' : 'rgb(16 21 36 / 0.8)')
    }
  }

  let shownMinute = -1
  const paintClock = (hour, isLive) => {
    const minute = Math.round((((hour % 24) + 24) % 24) * 60)
    if (minute === shownMinute) return
    shownMinute = minute
    clockTime.textContent = fmtTime(minute / 60, true)
    const now = isLive && live.override === null
    clockLabel.textContent = now ? `${partOfDay(hour)} · jetzt` : partOfDay(hour)
    // the story day is a Thursday; a dragged sun is today at that hour
    const span = isLive ? HOURS[zurichNow().day] : HOURS[4]
    const open = now ? openStatus().open : !!span && hour >= span[0] && hour < span[1]
    clock.classList.toggle('is-open', open)
  }

  const update = () => {
    const y = window.scrollY
    let i = 0
    while (i < anchors.length - 2 && y > anchors[i + 1].y) i++
    const a = anchors[i]
    const b = anchors[i + 1]
    const t = clamp((y - a.y) / Math.max(1, b.y - a.y))
    let L
    let hour
    if (a.hour === null) {
      // from the real «now» into the story day
      const e = smoothstep(0.05, 0.95, t)
      const h = live.override ?? live.hour
      L = e <= 0 ? heroLook : mixLook(heroLook, storyLook(b.hour), e)
      hour = e < 0.5 ? h : b.hour
      paintClock(e < 0.5 ? h : b.hour, e < 0.5)
    } else {
      hour = a.hour + (b.hour - a.hour) * t
      L = storyLook(hour)
      paintClock(hour, false)
    }
    scene?.setLook(L, hour)
    paintChrome(L)
    current.look = L
    current.hour = hour
  }
  const current = { look: heroLook, hour: live.hour }

  measure()
  update()
  ScrollTrigger.addEventListener('refresh', () => {
    measure()
    update()
  })
  window.addEventListener('scroll', update, { passive: true })
  // greeting and opening status in the hero
  const greet = qs('[data-greeting]')
  const statusText = qs('[data-status-text]')
  const status = qs('.hero__status')
  const paintStatus = () => {
    const n = zurichNow()
    const h = n.decimal
    if (greet) greet.textContent = h >= 5 && h < 11 ? 'Guten Morgen aus Kestenholz' : h < 17 && h >= 11 ? 'Guten Tag aus Kestenholz' : h >= 17 && h < 22 ? 'Guten Abend aus Kestenholz' : 'Gute Nacht aus Kestenholz'
    const st = openStatus(n)
    if (statusText) statusText.textContent = st.text
    status?.classList.toggle('is-open', st.open)
  }
  paintStatus()

  // keep «now» current (also across midnight)
  setInterval(() => {
    live.hour = nowHour()
    today = zurichDay()
    paintStatus()
    shownMinute = -1
    if (live.override === null) heroLook = look(live.hour, today)
    update()
  }, 60000)

  // panorama labels on the real summits
  const peaks = qs('[data-peaks]')
  const blockers = qsa('.hero__line > span, .hero__card, .hero__greet, .hero__hint')
  // the hero lines may still be mid-rise: take x from the words, y from their (unmoved) line
  const boxOf = (b) => {
    const r = b.getBoundingClientRect()
    if (!b.parentElement.matches('.hero__line')) return r
    const l = b.parentElement.getBoundingClientRect()
    return { left: r.left, right: r.right, top: l.top, bottom: l.bottom }
  }
  const placePeaks = () => {
    if (!scene || !peaks) return
    const w = window.innerWidth
    const items = qsa('li', peaks)
    const boxes = blockers.map(boxOf)
    const scrollY = window.scrollY
    let lastX = -Infinity
    items.forEach((li) => {
      const p = scene.project(parseFloat(li.dataset.az), parseFloat(li.dataset.el))
      // keep labels clear of the hero text
      const hit = p && boxes.some((r) => p.x > r.left - 90 && p.x < r.right + 90 && p.y - scrollY > r.top - 16 && p.y - scrollY - 40 < r.bottom + 8)
      const visible = p && !hit && p.x > 60 && p.x < w - 60 && p.y > window.innerHeight * 0.3
      const crowded = p && p.x - lastX < (w < 640 ? 110 : 150)
      li.classList.toggle('is-on', !!visible && !crowded)
      if (visible && !crowded) {
        li.style.left = `${p.x}px`
        li.style.top = `${p.y - 6}px`
        lastX = p.x
      }
    })
    peaks.classList.add('is-ready')
  }
  if (scene) {
    placePeaks()
    window.addEventListener('resize', () => requestAnimationFrame(placePeaks))
    fontsReady().then(placePeaks)
  }

  // drag the sun across the sky (hero only)
  const hint = qs('[data-sun-hint]')
  const hintText = qs('[data-sun-hint-text]')
  if (scene && hero && !reduced) {
    let dragging = false
    const isInteractive = (el) => el.closest('a, button, input, label, .peaks li')
    const setFromX = (x) => {
      const hr = scene.hourFromX(x, live.override ?? live.hour)
      live.override = hr
      heroLook = look(hr, today)
      shownMinute = -1
      update()
      const dayOpen = HOURS[zurichNow().day]
      const isOpen = dayOpen && hr >= dayOpen[0] && hr < dayOpen[1]
      hintText.textContent = `${fmtTime(hr)} Uhr${dayOpen ? (isOpen ? ' · Praxis offen' : ' · Praxis geschlossen') : ''}`
    }
    // a mouse grabs the sun at once; a finger only once it moves sideways (a vertical swipe just scrolls)
    let start = null
    hero.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || isInteractive(e.target) || window.scrollY > 40) return
      start = { x: e.clientX, y: e.clientY }
      if (e.pointerType !== 'mouse') return
      dragging = true
      hero.classList.add('is-dragging')
      hero.setPointerCapture(e.pointerId)
      setFromX(e.clientX)
    })
    hero.addEventListener('pointermove', (e) => {
      if (!dragging && start) {
        const dx = Math.abs(e.clientX - start.x)
        if (dx < 8 || dx < Math.abs(e.clientY - start.y)) return
        dragging = true
        hero.classList.add('is-dragging')
        hero.setPointerCapture(e.pointerId)
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
    if (canHover()) hero.setAttribute('data-cursor', 'Sonne ziehen')
  }
  const canDrag = !!(scene && hero && !reduced)

  return {
    /** after the loader: offer the sun to drag */
    showHint() {
      if (!hint || !canDrag) return
      // only where it has room: never over the hero card or its buttons
      const h = hint.getBoundingClientRect()
      const c = qs('.hero__card')?.getBoundingClientRect()
      if (c && h.top < c.bottom + 8 && h.bottom > c.top - 8 && h.left < c.right && h.right > c.left) return
      gsap.to(hint, { opacity: 1, duration: 1, delay: 1.6 })
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
    /** temporarily show a given hour of the story day (e.g. while planning an appointment) */
    preview(hour) {
      if (!scene) return
      if (hour === null) return update()
      const L = storyLook(hour)
      scene.setLook(L, hour)
      paintChrome(L)
      paintClock(hour, false)
    },
    refresh: () => {
      measure()
      update()
      placePeaks()
    },
  }
}
