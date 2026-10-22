import { qs, qsa, zurichNow, openStatus, canHover, onVisibility, fontsReady } from '../utils/helpers.js'
import { Kinetic, fitWidth } from '../core/kinetic.js'

const START = 7
const END = 19

/** Opening hours as a timetable with a live «now» line, a clock, and a phone number you can knead. */
export function initContact({ reduced }) {
  const rows = qsa('.hrow')
  const status = qs('[data-hours-status]')
  const clock = qs('[data-clock]')

  const paint = () => {
    const now = zurichNow()
    rows.forEach((row) => {
      const open = parseFloat(row.dataset.open)
      const close = parseFloat(row.dataset.close)
      if (Number.isFinite(open)) {
        row.style.setProperty('--o', ((open - START) / (END - START)).toFixed(4))
        row.style.setProperty('--c', ((close - START) / (END - START)).toFixed(4))
      }
      const today = Number(row.dataset.day) === now.day
      row.classList.toggle('is-today', today)
      if (today) row.style.setProperty('--now', Math.min(1.01, Math.max(-0.01, (now.decimal - START) / (END - START))).toFixed(4))
    })
    const s = openStatus(now)
    if (status) {
      status.textContent = s.text
      status.classList.toggle('is-open', s.open)
    }
    if (clock) clock.textContent = `${now.hour}:${String(now.minute).padStart(2, '0')}`
  }
  paint()
  setInterval(paint, 20000)

  // the big number: fills the width, and relaxes under your finger
  const big = qs('[data-bignum]')
  const inner = qs('[data-bignum-in]')
  if (!big || !inner) return
  const fit = () => fitWidth(inner, big)
  if (reduced) {
    fontsReady().then(fit)
    window.addEventListener('resize', fit)
    return
  }
  const kin = new Kinetic(inner, {
    knead: true,
    radius: 220,
    strength: 1,
    onTick: () => fit(),
  })
  inner.style.setProperty('--fs-rest', '64%')
  inner.style.setProperty('--fw-rest', '760')
  if (canHover()) big.setAttribute('data-cursor', 'Anrufen')
  onVisibility(big, (v) => kin.setVisible(v), '100px')
  fontsReady().then(() => {
    kin.rebuild()
    fit()
  })
  window.addEventListener('resize', fit)
}
