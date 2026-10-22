import gsap from 'gsap'
import { qs } from '../utils/helpers.js'
import { EMAIL, PHONE } from '../core/booking.js'

const GIFTS = {
  30: { text: '30 Minuten Massage', value: 'CHF 45' },
  45: { text: '45 Minuten Massage', value: 'CHF 65' },
  60: { text: '60 Minuten Massage', value: 'CHF 85' },
  hotstone: { text: 'Hot-Stone-Massage, 60 Minuten', value: 'CHF 100' },
}

/**
 * A Swiss poster voucher. The recipient's name always fills the line:
 * short names stretch wide, long names pull themselves together.
 */
export function initVoucher({ reduced }) {
  const form = qs('[data-voucher-form]')
  const poster = qs('[data-poster]')
  if (!form || !poster) return
  const nameEl = qs('[data-poster-name]', poster)
  const nameBox = nameEl.parentElement
  const gift = qs('[data-poster-gift]', poster)
  const value = qs('[data-poster-value]', poster)
  const from = qs('[data-poster-from]', poster)
  qs('[data-poster-no]', poster).textContent = `Nº ${String(new Date().getFullYear()).slice(2)}${String(Math.floor(Math.random() * 900) + 100)}`

  // binary-search the width axis until the name fits; shrink the size only as a last resort
  const fit = () => {
    const avail = nameBox.clientWidth
    if (!avail) return
    nameEl.style.fontSize = ''
    let lo = 50
    let hi = 150
    for (let i = 0; i < 9; i++) {
      const mid = (lo + hi) / 2
      nameEl.style.fontStretch = `${mid}%`
      if (nameEl.getBoundingClientRect().width > avail) hi = mid
      else lo = mid
    }
    nameEl.style.fontStretch = `${lo}%`
    nameEl.style.fontWeight = Math.round(900 - ((lo - 50) / 100) * 640)
    const w = nameEl.getBoundingClientRect().width
    if (w > avail) nameEl.style.fontSize = `${(parseFloat(getComputedStyle(nameEl).fontSize) * avail) / w}px`
  }

  let lastGift = null
  const update = () => {
    const d = new FormData(form)
    nameEl.textContent = String(d.get('to') || '').trim() || 'Dich'
    from.textContent = String(d.get('from') || '').trim() || '…'
    const key = String(d.get('gift') || '60')
    const g = GIFTS[key] ?? GIFTS[60]
    gift.textContent = g.text
    value.textContent = g.value
    poster.dataset.gift = key
    fit()
    if (lastGift !== null && key !== lastGift && !reduced) {
      gsap.fromTo(poster, { rotate: -1.5, scale: 0.985 }, { rotate: 0, scale: 1, duration: 1.2, ease: 'elastic.out(1, 0.45)' })
    }
    lastGift = key
  }
  form.addEventListener('input', update)
  new ResizeObserver(fit).observe(nameBox)
  document.fonts?.ready.then(fit)
  update()

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const d = new FormData(form)
    const g = GIFTS[d.get('gift')] ?? GIFTS[60]
    const to = String(d.get('to') || '').trim()
    const sender = String(d.get('from') || '').trim()
    if (e.submitter?.dataset.send === 'sms') {
      const sms = [`Hallo Claudia, ich möchte gerne einen Gutschein bestellen: ${g.text} (${g.value})`, to ? `Für: ${to}` : null, sender ? `Von: ${sender}` : null]
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
        to ? `• Für: ${to}` : null,
        sender ? `• Von: ${sender}` : null,
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
    if (!reduced) gsap.fromTo(poster, { y: 0 }, { y: -16, duration: 0.3, yoyo: true, repeat: 1, ease: 'power2.out' })
  })
}
