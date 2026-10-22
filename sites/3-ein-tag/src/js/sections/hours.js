import { qs, qsa, zurichNow, openStatus } from '../utils/helpers.js'

const NS = 'http://www.w3.org/2000/svg'
const D0 = 6
const D1 = 21

/** Opening hours as little sun arcs: the open part of each day is drawn in warm light. */
export function initHours() {
  const root = qs('[data-hours]')
  if (!root) return
  const status = qs('[data-hours-status]', root)
  const clock = qs('[data-clock]')
  const days = qsa('.hours__days li', root)

  const point = (h) => {
    const t = (h - D0) / (D1 - D0)
    const a = Math.PI * (1 - t)
    return [50 + Math.cos(a) * 42, 50 - Math.sin(a) * 42]
  }
  const arc = (h0, h1) => {
    const [x0, y0] = point(h0)
    const [x1, y1] = point(h1)
    return `M${x0.toFixed(2)} ${y0.toFixed(2)} A42 42 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`
  }

  days.forEach((li) => {
    const svg = document.createElementNS(NS, 'svg')
    svg.setAttribute('viewBox', '0 0 100 56')
    svg.setAttribute('class', 'hours__arc')
    svg.setAttribute('aria-hidden', 'true')
    const sky = document.createElementNS(NS, 'path')
    sky.setAttribute('class', 'arc-sky')
    sky.setAttribute('d', arc(D0, D1))
    const ground = document.createElementNS(NS, 'line')
    ground.setAttribute('class', 'arc-ground')
    ground.setAttribute('x1', 4)
    ground.setAttribute('x2', 96)
    ground.setAttribute('y1', 52)
    ground.setAttribute('y2', 52)
    svg.append(sky, ground)
    const o = parseFloat(li.dataset.open)
    const c = parseFloat(li.dataset.close)
    if (Number.isFinite(o)) {
      const open = document.createElementNS(NS, 'path')
      open.setAttribute('class', 'arc-open')
      open.setAttribute('d', arc(o, c))
      svg.append(open)
    } else li.classList.add('is-closed')
    li.prepend(svg)
  })

  let sun = null
  const paint = () => {
    const now = zurichNow()
    days.forEach((li) => li.classList.toggle('is-today', Number(li.dataset.day) === now.day))
    const today = days.find((li) => Number(li.dataset.day) === now.day)
    sun?.remove()
    sun = null
    if (today && now.decimal > D0 && now.decimal < D1) {
      const [x, y] = point(now.decimal)
      sun = document.createElementNS(NS, 'circle')
      sun.setAttribute('class', 'arc-sun')
      sun.setAttribute('cx', x.toFixed(2))
      sun.setAttribute('cy', y.toFixed(2))
      sun.setAttribute('r', 5)
      qs('svg', today).append(sun)
    }
    const s = openStatus(now)
    status.textContent = s.text
    status.classList.toggle('is-open', s.open)
    if (clock) clock.textContent = `${now.hour}:${String(now.minute).padStart(2, '0')}`
  }
  paint()
  setInterval(paint, 30000)
  qsa('[data-year]').forEach((el) => (el.textContent = new Date().getFullYear()))
  qsa('[data-years]').forEach((el) => (el.textContent = new Date().getFullYear() - 2004))
}
