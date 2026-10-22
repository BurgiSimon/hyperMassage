import gsap from 'gsap'
import { qs, onVisibility } from '../utils/helpers.js'

const EMAIL = 'massage_buergi@ggs.ch'
const PHONE = '+41782249197'
const GIFTS = {
  30: { html: '30 Minuten<br><em>Massage</em>', text: '30 Minuten Massage', value: 'CHF 45' },
  45: { html: '45 Minuten<br><em>Massage</em>', text: '45 Minuten Massage', value: 'CHF 65' },
  60: { html: '60 Minuten<br><em>Massage</em>', text: '60 Minuten Massage', value: 'CHF 85' },
  hotstone: { html: 'Hot-Stone<br><em>Massage</em>', text: 'Hot-Stone-Massage, 60 Minuten', value: 'CHF 100' },
}

export function initVoucher({ reduced, emit }) {
  const form = qs('[data-voucher-form]')
  const card = qs('[data-vcard]')
  const stage = qs('[data-vcard-stage]')
  if (!form || !card) return

  const to = qs('[data-v-to]', card)
  const from = qs('[data-v-from]', card)
  const gift = qs('[data-v-gift]', card)
  const value = qs('[data-v-value]', card)
  const no = qs('[data-v-no]', card)
  no.textContent = `Nº ${String(new Date().getFullYear()).slice(2)}${String(Math.floor(Math.random() * 900) + 100)}`

  const update = () => {
    const data = new FormData(form)
    to.textContent = (data.get('to') || '').trim() || 'dich'
    from.textContent = (data.get('from') || '').trim() || '…'
    const g = GIFTS[data.get('gift')] ?? GIFTS[60]
    if (gift.dataset.key !== data.get('gift')) {
      gift.dataset.key = data.get('gift')
      gsap.fromTo(gift, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'expo.out' })
      if (!reduced) gsap.fromTo(card, { rotateZ: -2 }, { rotateZ: 0, duration: 1.2, ease: 'elastic.out(1, 0.4)' })
    }
    gift.innerHTML = g.html
    value.textContent = g.value
  }
  form.addEventListener('input', update)
  form.addEventListener('change', () => emit?.('ui:tick'))
  update()

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const data = new FormData(form)
    const g = GIFTS[data.get('gift')] ?? GIFTS[60]
    const recipient = (data.get('to') || '').trim()
    const sender = (data.get('from') || '').trim()
    const body = [
      'Liebe Claudia',
      '',
      'Ich möchte gerne einen Massagegutschein bestellen:',
      '',
      `• Geschenk: ${g.text} (${g.value})`,
      recipient ? `• Für: ${recipient}` : null,
      sender ? `• Von: ${sender}` : null,
      '',
      'Bitte melde dich bei mir für die Details.',
      '',
      'Herzliche Grüsse',
      sender || '',
    ]
      .filter((l) => l !== null)
      .join('\n')
    if (e.submitter?.dataset.send === 'sms') {
      const sms = [
        `Hallo Claudia, ich möchte gerne einen Gutschein bestellen: ${g.text} (${g.value})`,
        recipient ? `Für: ${recipient}` : null,
        sender ? `Von: ${sender}` : null,
      ]
        .filter(Boolean)
        .join('\n')
      window.location.href = `sms:${PHONE}?&body=${encodeURIComponent(sms)}`
    } else {
      window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent('Anfrage Massagegutschein')}&body=${encodeURIComponent(body)}`
    }
    if (!reduced) gsap.fromTo(card, { y: 0 }, { y: -18, duration: 0.35, yoyo: true, repeat: 1, ease: 'power2.out' })
  })

  // tilt + light
  if (reduced || !window.matchMedia('(hover: hover)').matches) {
    if (!reduced) {
      const sway = gsap.to(card, {
        '--ry': '8deg',
        '--rx': '-4deg',
        duration: 4,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
        paused: true,
      })
      onVisibility(card, (visible) => (visible ? sway.play() : sway.pause()))
    }
    return
  }
  const rx = gsap.quickTo(card, '--rx', { duration: 0.6, ease: 'power3.out', unit: 'deg' })
  const ry = gsap.quickTo(card, '--ry', { duration: 0.6, ease: 'power3.out', unit: 'deg' })
  stage.addEventListener('pointermove', (e) => {
    const r = card.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    rx((0.5 - y) * 16)
    ry((x - 0.5) * 22)
    card.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`)
    card.style.setProperty('--my', `${(y * 100).toFixed(1)}%`)
  })
  stage.addEventListener('pointerleave', () => {
    rx(0)
    ry(0)
  })
  stage.setAttribute('data-cursor', 'Bewegen')
}
