import gsap from 'gsap'
import { qs, qsa } from '../utils/helpers.js'
import { startScroll, stopScroll } from './scroll.js'

export const PHONE = '+41782249197'
export const EMAIL = 'massage_buergi@ggs.ch'
const PRICES = { 30: 45, 45: 65, 60: 85 }

/** A card in the middle of the screen: call, or compose an SMS / e-mail. */
export function initBooking({ reduced, beforeOpen }) {
  const root = qs('[data-booking]')
  if (!root) return { open() {} }
  const card = qs('.booking__card', root)
  const backdrop = qs('.booking__backdrop', root)
  const form = qs('[data-booking-form]', root)
  const when = qs('[data-booking-when]', form)
  let isOpen = false
  let lastFocus = null
  let tl = null

  const check = (name, value) => {
    const r = qsa(`input[name="${name}"]`, form).find((i) => i.value === String(value))
    if (r) r.checked = true
  }

  let behind = []
  const open = (pre = {}) => {
    if (isOpen) return
    isOpen = true
    lastFocus = document.activeElement
    beforeOpen?.()
    if (pre.service !== undefined) check('service', pre.service)
    // a plain appointment from the planner: keep the chosen treatment, unless that was Hot Stone
    else if (pre.notHot && form.elements.service.value === 'Hot-Stone-Massage') check('service', '')
    if (pre.dur) check('dur', pre.dur)
    if (pre.when) when.value = pre.when
    // the page behind the dialog is out of reach while it is open
    behind = qsa('header, main, footer, [data-dock]').map((el) => [el, el.inert])
    behind.forEach(([el]) => (el.inert = true))
    root.inert = false
    root.classList.add('is-open')
    document.dispatchEvent(new CustomEvent('overlay', { detail: { open: true, source: 'booking' } }))
    stopScroll('booking')
    card.scrollTop = 0
    tl?.kill()
    if (reduced) gsap.set([backdrop, card], { opacity: 1, y: 0 })
    else
      tl = gsap
        .timeline()
        .to(backdrop, { opacity: 1, duration: 0.5 })
        .fromTo(card, { opacity: 0, y: 50, scale: 0.98 }, { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: 'expo.out' }, 0.05)
    setTimeout(() => qs('.booking__close', card).focus({ preventScroll: true }), 60)
  }

  const close = () => {
    if (!isOpen) return
    isOpen = false
    root.inert = true
    behind.forEach(([el, was]) => (el.inert = was))
    behind = []
    document.dispatchEvent(new CustomEvent('overlay', { detail: { open: false, source: 'booking' } }))
    startScroll('booking')
    tl?.kill()
    const done = () => root.classList.remove('is-open')
    if (reduced) {
      gsap.set([backdrop, card], { opacity: 0 })
      done()
    } else tl = gsap.timeline({ onComplete: done }).to(card, { opacity: 0, y: 30, duration: 0.4, ease: 'power2.in' }).to(backdrop, { opacity: 0, duration: 0.35 }, 0.1)
    lastFocus?.focus?.({ preventScroll: true })
  }

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-booking-open]')
    if (t) {
      e.preventDefault()
      open({ service: t.dataset.service, dur: t.dataset.dur, when: t.dataset.when, notHot: 'notHot' in t.dataset })
      return
    }
    if (isOpen && e.target.closest('[data-booking-close]')) close()
  })
  document.addEventListener('keydown', (e) => {
    if (!isOpen) return
    if (e.key === 'Escape') close()
    if (e.key === 'Tab') {
      const f = qsa('a[href], button, input, textarea', card).filter((el) => el.offsetParent !== null && !el.disabled)
      // radio groups: only the checked one is a tab stop
      const stops = f.filter((el) => el.type !== 'radio' || el.checked)
      const first = stops[0]
      const last = stops[stops.length - 1]
      const outside = !card.contains(document.activeElement)
      if (e.shiftKey && (document.activeElement === first || outside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || outside)) {
        e.preventDefault()
        first.focus()
      }
    }
  })

  // the browser's own message would say «Sie» – this site says «du»
  const nameField = form.elements.name
  nameField?.addEventListener('invalid', () => nameField.setCustomValidity(nameField.value.trim() ? '' : 'Wie heisst du? Dann kann ich dich zurückrufen.'))
  nameField?.addEventListener('input', () => nameField.setCustomValidity(''))

  // Enter in a field: SMS on phones, e-mail on computers
  let implicit = false
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') implicit = e.key === 'Enter' && e.target.matches('input')
  })
  // (a blocked Enter submit – e.g. the name still empty – must not decide the next click)
  form.addEventListener('pointerdown', () => (implicit = false))
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const viaEnter = implicit
    implicit = false
    if (!form.reportValidity()) return
    const d = new FormData(form)
    const service = d.get('service') || ''
    const dur = Number(d.get('dur'))
    const price = PRICES[dur] + (service === 'Hot-Stone-Massage' ? 15 : 0)
    const name = String(d.get('name') || '').trim()
    const phone = String(d.get('phone') || '').trim()
    const wish = String(d.get('when') || '').trim()
    const note = String(d.get('note') || '').trim()
    const what = `${service || 'eine Massage (was passt, besprechen wir zusammen)'}, ${dur} Minuten (CHF ${price})`
    const channel = viaEnter ? (window.matchMedia('(hover: hover) and (pointer: fine)').matches ? 'mail' : 'sms') : e.submitter?.dataset.send
    if (channel === 'mail') {
      const body = [
        'Hallo Claudia',
        '',
        'Ich möchte gerne einen Termin anfragen:',
        '',
        `• Behandlung: ${what}`,
        wish ? `• Wunschtermin: ${wish}` : null,
        `• Name: ${name}`,
        phone ? `• Telefon: ${phone}` : null,
        note ? `• Bemerkung: ${note}` : null,
        '',
        'Herzliche Grüsse',
        name,
      ]
        .filter((l) => l !== null)
        .join('\n')
      window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(`Terminanfrage – ${name}`)}&body=${encodeURIComponent(body)}`
    } else {
      const sms = [`Hallo Claudia, ich möchte gerne einen Termin anfragen: ${what}.`, wish ? `Wunschtermin: ${wish}.` : null, `${name}${phone ? `, ${phone}` : ''}`, note || null]
        .filter(Boolean)
        .join('\n')
      window.location.href = `sms:${PHONE}?&body=${encodeURIComponent(sms)}`
    }
  })
  return { open, close }
}
