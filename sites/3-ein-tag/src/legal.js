import './styles/main.css'
import './styles/legal.css'
import { qs, qsa } from './js/utils/helpers.js'
import { initCursor } from './js/core/cursor.js'
import { paintStill } from './js/gl/scene.js'
import { nowHour, zurichDay } from './js/gl/sun.js'

initCursor()
qsa('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()))

// a still of the landscape behind the page: right now, or a set hour
const sky = qs('[data-legal-sky]')
if (sky) {
  const c = document.createElement('canvas')
  const paint = () => {
    const w = Math.min(1600, window.innerWidth)
    const h = Math.round((w * window.innerHeight) / window.innerWidth)
    c.width = w
    c.height = h
    const hour = sky.dataset.hour ? parseFloat(sky.dataset.hour) : nowHour()
    const aspect = w / h
    if (paintStill(c, hour, { day: zurichDay(), azC: 326, fov: Math.min(130, Math.max(60, aspect * 72)) })) {
      sky.style.backgroundImage = `url(${c.toDataURL('image/jpeg', 0.85)})`
      sky.classList.add('is-painted')
    }
  }
  try {
    paint()
  } catch (err) {
    console.warn(err)
  }
}
