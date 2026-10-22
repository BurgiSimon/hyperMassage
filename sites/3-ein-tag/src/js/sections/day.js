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
  const today = zurichDay()

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
  const paintChrome = (L) => {
    const t = smoothstep(0.26, 0.46, L.skyLum)
    const c = INK_LIGHT.map((v, i) => Math.round(v + (INK_DARK[i] - v) * t))
    const ink = `rgb(${c.join(' ')})`
    if (ink !== lastInk) {
      lastInk = ink
      html.style.setProperty('--sky-ink', ink)
      html.style.setProperty('--sky-ink-soft', `rgb(${c.join(' ')} / 0.72)`)
      html.style.setProperty('--chrome-bg', t > 0.5 ? `rgb(246 241 231 / ${(0.35 + 0.3 * t).toFixed(2)})` : `rgb(16 21 36 / ${(0.55 - 0.25 * t).toFixed(2)})`)
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', `rgb(${L.zen.map((v) => Math.round(v * 255)).join(',')})`)
    }
  }

  let shownMinute = -1
  const paintClock = (hour, isLive) => {
    const minute = Math.round((((hour % 24) + 24) % 24) * 60)
    if (minute === shownMinute) return
    shownMinute = minute
    clockTime.textContent = fmtTime(minute / 60, true)
    clockLabel.textContent = isLive ? `${partOfDay(hour)} · jetzt` : partOfDay(hour)
    const open = isLive ? openStatus().open && live.override === null : hour >= 7.5 && hour < 19
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
    html.style.setProperty('--night', L.night.toFixed(3))
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
  // keep «now» current
  setInterval(() => {
    live.hour = nowHour()
    if (live.override === null) {
      heroLook = look(live.hour, today)
      update()
    }
  }, 60000)

  // greeting and opening status in the hero
  const greet = qs('[data-greeting]')
  const statusText = qs('[data-status-text]')
  const status = qs('.hero__status')
  const n = zurichNow()
  const h = n.decimal
  if (greet) greet.textContent = h >= 5 && h < 11 ? 'Guten Morgen aus Kestenholz' : h < 17 && h >= 11 ? 'Guten Tag aus Kestenholz' : h >= 17 && h < 22 ? 'Guten Abend aus Kestenholz' : 'Gute Nacht aus Kestenholz'
  const s = openStatus(n)
  if (statusText) statusText.textContent = s.text
  status?.classList.toggle('is-open', s.open)

  // panorama labels on the real summits
  const peaks = qs('[data-peaks]')
  const blockers = qsa('.hero__line > span, .hero__card, .hero__greet, .hero__hint')
  const placePeaks = () => {
    if (!scene || !peaks) return
    const w = window.innerWidth
    const items = qsa('li', peaks)
    const boxes = blockers.map((b) => b.getBoundingClientRect())
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
      const dayOpen = HOURS[n.day]
      const isOpen = dayOpen && hr >= dayOpen[0] && hr < dayOpen[1]
      hintText.textContent = `${fmtTime(hr)} Uhr${dayOpen ? (isOpen ? ' · Praxis offen' : ' · Praxis geschlossen') : ''}`
    }
    hero.addEventListener('pointerdown', (e) => {
      if (e.button > 0 || isInteractive(e.target) || window.scrollY > 40) return
      dragging = true
      hero.classList.add('is-dragging')
      hero.setPointerCapture(e.pointerId)
      setFromX(e.clientX)
    })
    hero.addEventListener('pointermove', (e) => dragging && setFromX(e.clientX))
    const end = () => {
      if (!dragging) return
      dragging = false
      hero.classList.remove('is-dragging')
    }
    hero.addEventListener('pointerup', end)
    hero.addEventListener('pointercancel', end)
    if (canHover()) hero.setAttribute('data-cursor', 'Sonne ziehen')
    if (hint) gsap.to(hint, { opacity: 1, duration: 1, delay: 2.6 })
  }

  return {
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
