import gsap from 'gsap'
import { qs, qsa } from '../utils/helpers.js'
import { startScroll, stopScroll } from './scroll.js'

const PHONE = '+41782249197'
const EMAIL = 'massage_buergi@ggs.ch'
const PRICES = { 30: 45, 45: 65, 60: 85 }

/** Slide-in booking request: call directly or compose an e-mail / SMS. */
export function initBooking({ reduced, emit, onOpen }) {
  const root = qs('[data-booking]')
  if (!root) return
  const panel = qs('.booking__panel', root)
  const form = qs('[data-booking-form]', root)
  let lastFocus = null
  let isOpen = false

  const open = (prefill = {}) => {
    if (isOpen) return
    isOpen = true
    lastFocus = document.activeElement
    onOpen?.()
    if (prefill.dur) {
      const r = qs(`input[name="dur"][value="${prefill.dur}"]`, form)
      if (r) r.checked = true
    }
    if (prefill.service) {
      const r = qs(`input[name="service"][value="${prefill.service}"]`, form)
      if (r) r.checked = true
    } else if (prefill.fromPrice && qs('input[name="service"]:checked', form)?.value === 'Hot-Stone-Massage') {
      // the price dial says "no Hot Stone" – don't keep a stale choice from earlier
      qs('input[name="service"]', form).checked = true
    }
    root.classList.add('is-open')
    root.inert = false
    document.dispatchEvent(new CustomEvent('overlay', { detail: { open: true, source: 'booking' } }))
    stopScroll('booking')
    panel.scrollTop = 0
    if (!reduced) {
      gsap.fromTo(
        qsa('.booking__head, .booking__title, .booking__quick, .booking__or, .bform__group, .bform__fields, .bform__send', panel),
        { y: 30, autoAlpha: 0 },
        { y: 0, autoAlpha: 1, duration: 1, stagger: 0.05, ease: 'expo.out', delay: 0.25 },
      )
    }
    setTimeout(() => panel.focus({ preventScroll: true }), 50)
    emit?.('ui:open')
  }

  const close = () => {
    if (!isOpen) return
    isOpen = false
    root.classList.remove('is-open')
    root.inert = true
    document.dispatchEvent(new CustomEvent('overlay', { detail: { open: false, source: 'booking' } }))
    startScroll('booking')
    lastFocus?.focus?.({ preventScroll: true })
  }

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-booking-open]')
    if (trigger) {
      e.preventDefault()
      open({
        dur: trigger.dataset.dur,
        service: trigger.dataset.service,
        fromPrice: trigger.hasAttribute('data-booking-from-price'),
      })
      return
    }
    if (e.target.closest('[data-booking-close]')) close()
  })
  document.addEventListener('keydown', (e) => {
    if (!isOpen) return
    if (e.key === 'Escape') close()
    if (e.key === 'Tab') {
      // keep focus inside the dialog
      const focusables = qsa('a[href], button, input, textarea', panel).filter((el) => el.offsetParent !== null)
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      const outside = active === panel || !panel.contains(active)
      if (e.shiftKey && (active === first || outside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (active === last || outside)) {
        e.preventDefault()
        first.focus()
      }
    }
  })

  const compose = () => {
    const data = new FormData(form)
    const service = data.get('service')
    const dur = data.get('dur')
    const days = data.getAll('days')
    const times = data.getAll('time')
    const name = (data.get('name') || '').trim()
    const phone = (data.get('phone') || '').trim()
    const note = (data.get('note') || '').trim()
    const hot = service === 'Hot-Stone-Massage'
    const price = dur ? PRICES[dur] + (hot ? 15 : 0) : null
    return {
      name,
      lines: [
        `Behandlung: ${service}`,
        dur ? `Dauer: ${dur} Minuten (CHF ${price})` : null,
        days.length ? `Wunschtage: ${days.join(', ')}` : null,
        times.length ? `Tageszeit: ${times.join(', ')}` : null,
        phone ? `Telefon: ${phone}` : null,
        note ? `Bemerkung: ${note}` : null,
      ].filter(Boolean),
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const via = e.submitter?.dataset.send || 'mail'
    const { name, lines } = compose()
    if (via === 'sms') {
      const body = ['Hallo Claudia, ich möchte gerne einen Termin vereinbaren.', ...lines, name ? `Gruss, ${name}` : '']
        .filter(Boolean)
        .join('\n')
      window.location.href = `sms:${PHONE}?&body=${encodeURIComponent(body)}`
    } else {
      const body = [
        'Liebe Claudia',
        '',
        'Ich möchte gerne einen Termin bei dir vereinbaren:',
        '',
        ...lines.map((l) => `• ${l}`),
        '',
        'Herzliche Grüsse',
        name,
      ].join('\n')
      const subject = `Terminanfrage${name ? ` – ${name}` : ''}`
      window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
    }
    emit?.('ui:send')
  })

  return { open, close }
}
