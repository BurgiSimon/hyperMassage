import gsap from 'gsap'
import { qs, whenNear } from '../utils/helpers.js'
import { paintStill } from '../gl/scene.js'
import { EMAIL, PHONE } from '../core/booking.js'

const GIFTS = {
  30: { text: '30 Minuten Massage', value: 'CHF 45' },
  45: { text: '45 Minuten Massage', value: 'CHF 65' },
  60: { text: '60 Minuten Massage', value: 'CHF 85' },
  hotstone: { text: 'eine Hot-Stone-Massage (60 Minuten)', value: 'CHF 100' },
}
const MOODS = { 6.3: 'Morgen', 13: 'Mittag', 18.6: 'Abend', 22.5: 'Nacht' }

/** A postcard from Kestenholz – the picture is painted live from the landscape, at the chosen time of day. */
export function initPostcard({ reduced, webgl }) {
  const form = qs('[data-voucher-form]')
  const card = qs('[data-postcard]')
  if (!form || !card) return
  const canvas = qs('[data-postcard-canvas]', card)
  const to = qs('[data-pc-to]', card)
  const from = qs('[data-pc-from]', card)
  const gift = qs('[data-pc-gift]', card)
  const value = qs('[data-pc-value]', card)
  const date = qs('[data-pc-date]', card)
  const now = new Date()
  date.textContent = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getFullYear()).slice(2)}`

  let painted = null
  let visible = false
  const paint = () => {
    const mood = String(new FormData(form).get('mood') || '18.6')
    if (!visible || mood === painted) return
    const r = canvas.getBoundingClientRect()
    if (!r.width) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(r.width * dpr)
    canvas.height = Math.round(r.height * dpr)
    if (webgl && paintStill(canvas, parseFloat(mood))) {
      painted = mood
      if (!reduced) gsap.fromTo(canvas, { opacity: 0.4 }, { opacity: 1, duration: 0.8 })
    } else {
      // no WebGL: a simple gradient sky
      const ctx = canvas.getContext('2d')
      const g = ctx.createLinearGradient(0, 0, 0, canvas.height)
      const night = mood === '22.5'
      g.addColorStop(0, night ? '#0b1328' : '#5a7fb3')
      g.addColorStop(0.7, night ? '#1d2440' : '#e9c29b')
      g.addColorStop(0.71, night ? '#0a0d16' : '#4b5a45')
      g.addColorStop(1, night ? '#06080d' : '#2f3a2c')
      ctx.fillStyle = g
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      painted = mood
    }
    card.dataset.mood = MOODS[mood] || ''
  }

  const update = () => {
    const d = new FormData(form)
    to.textContent = String(d.get('to') || '').trim() || 'dich'
    from.textContent = String(d.get('from') || '').trim() || '…'
    const g = GIFTS[d.get('gift')] ?? GIFTS[60]
    gift.textContent = g.text
    value.textContent = g.value
    paint()
  }
  form.addEventListener('input', update)
  form.addEventListener('change', update)
  whenNear(card, () => {
    visible = true
    update()
  }, '200px')
  update()
  // repaint once the size has settled (not on every step of a window drag)
  let sizeT = null
  let lastW = 0
  new ResizeObserver(([entry]) => {
    const w = Math.round(entry.contentRect.width)
    if (w === lastW) return
    lastW = w
    clearTimeout(sizeT)
    sizeT = setTimeout(() => {
      painted = null
      paint()
    }, 250)
  }).observe(canvas)
  // after a GPU reset the picture is painted again
  document.addEventListener('scene:restored', () => {
    painted = null
    paint()
  })

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const d = new FormData(form)
    const g = GIFTS[d.get('gift')] ?? GIFTS[60]
    const recipient = String(d.get('to') || '').trim()
    const sender = String(d.get('from') || '').trim()
    const mood = MOODS[String(d.get('mood'))] || ''
    if (e.submitter?.dataset.send === 'sms') {
      const sms = [`Hallo Claudia, ich möchte gerne einen Gutschein bestellen: ${g.text} (${g.value})`, recipient ? `Für: ${recipient}` : null, sender ? `Von: ${sender}` : null]
        .filter(Boolean)
        .join('\n')
      window.location.href = `sms:${PHONE}?&body=${encodeURIComponent(sms)}`
    } else {
      const body = [
        'Liebe Claudia',
        '',
        'Ich möchte gerne einen Massagegutschein bestellen:',
        '',
        `• Geschenk: ${g.text} (${g.value})`,
        recipient ? `• Für: ${recipient}` : null,
        sender ? `• Von: ${sender}` : null,
        mood ? `• Karte: Stimmung «${mood}»` : null,
        '',
        'Bitte melde dich bei mir für die Details.',
        '',
        'Herzliche Grüsse',
        sender,
      ]
        .filter((l) => l !== null)
        .join('\n')
      window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent('Anfrage Massagegutschein')}&body=${encodeURIComponent(body)}`
    }
    if (!reduced) gsap.fromTo(card, { y: 0 }, { y: -14, duration: 0.3, yoyo: true, repeat: 1, ease: 'power2.out' })
  })
}
