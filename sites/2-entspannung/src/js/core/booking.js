import gsap from 'gsap'
import { qs, qsa } from '../utils/helpers.js'
import { startScroll, stopScroll } from './scroll.js'

export const PHONE = '+41782249197'
export const EMAIL = 'massage_buergi@ggs.ch'
const PRICES = { 30: 45, 45: 65, 60: 85 }
const HOTSTONE = 15

/** Bottom sheet: call, or compose the request as one friendly sentence and send it by SMS or e-mail. */
export function initBooking({ reduced, beforeOpen }) {
  const root = qs('[data-sheet]')
  if (!root) return { open() {} }
  const panel = qs('.sheet__panel', root)
  const backdrop = qs('.sheet__backdrop', root)
  const form = qs('[data-booking-form]', root)
  const note = qs('[data-booking-note]', form)
  let isOpen = false
  let lastFocus = null
  let tl = null
  let autoNote = ''
  gsap.set(panel, { yPercent: 102 })

  // the blanks in the sentence are only as wide as what's written in them
  const ruler = document.createElement('span')
  ruler.setAttribute('aria-hidden', 'true')
  ruler.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;left:-9999px;top:0'
  form.appendChild(ruler)
  const autosize = (el) => {
    const cs = getComputedStyle(el)
    // (the `font` shorthand serialises to "" when font-stretch is a percentage)
    for (const k of ['fontFamily', 'fontSize', 'fontWeight', 'fontStretch', 'fontStyle', 'letterSpacing']) ruler.style[k] = cs[k]
    const text = el.tagName === 'SELECT' ? el.options[el.selectedIndex]?.textContent || '' : el.value || el.placeholder
    ruler.textContent = text
    const extra = el.tagName === 'SELECT' ? 1.35 : 0.4
    const max = form.clientWidth || window.innerWidth - 40
    el.style.width = `${Math.min(max, Math.ceil(ruler.getBoundingClientRect().width + parseFloat(cs.fontSize) * extra))}px`
  }
  // the duration list shows the Hot Stone price when that is chosen
  const durSelect = form.elements.dur
  const labelPrices = () => {
    const hs = form.elements.service.value === 'Hot-Stone-Massage'
    Array.from(durSelect.options).forEach((o) => (o.textContent = `${o.value} Minuten (CHF ${PRICES[o.value] + (hs ? HOTSTONE : 0)})`))
    autosize(durSelect)
  }
  form.elements.service.addEventListener('change', labelPrices)

  const slots = qsa('.slot select, .slot input', form)
  const sizeAll = () => slots.forEach(autosize)
  slots.forEach((el) => el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', () => autosize(el)))
  window.addEventListener('resize', sizeAll)

  const select = (name, value) => {
    const el = form.elements[name]
    if (!el || value == null) return
    const opt = Array.from(el.options).find((o) => (o.value || o.textContent) === String(value) || o.value === String(value))
    if (opt) el.value = opt.value
  }

  let behind = []
  const open = (prefill = {}) => {
    if (isOpen) return
    isOpen = true
    lastFocus = document.activeElement
    beforeOpen?.()
    if (prefill.service !== undefined) select('service', prefill.service)
    else if (prefill.fromPrice && form.elements.service.value === 'Hot-Stone-Massage') select('service', 'Klassische Massage')
    if (prefill.dur) select('dur', prefill.dur)
    // replace a note we filled in earlier, never one the visitor wrote
    // (an empty suggestion clears an earlier automatic note, too)
    if (prefill.note !== undefined && note && (!note.value.trim() || note.value === autoNote)) {
      note.value = prefill.note
      autoNote = prefill.note
    }
    labelPrices()
    // the page behind the sheet is out of reach while it is open
    behind = qsa('header, main, footer, [data-dock]').map((el) => [el, el.inert])
    behind.forEach(([el]) => (el.inert = true))
    root.inert = false
    root.classList.add('is-open')
    sizeAll()
    document.dispatchEvent(new CustomEvent('overlay', { detail: { open: true, source: 'booking' } }))
    stopScroll('booking')
    panel.scrollTop = 0
    tl?.kill()
    if (reduced) {
      gsap.set(backdrop, { opacity: 1 })
      gsap.set(panel, { yPercent: 0, y: 0 })
    } else {
      tl = gsap
        .timeline()
        .to(backdrop, { opacity: 1, duration: 0.5 })
        .fromTo(panel, { yPercent: 102 }, { yPercent: 0, duration: 0.9, ease: 'expo.out' }, 0)
        .fromTo(
          qs('.sheet__title', panel),
          { fontStretch: '50%', fontWeight: 900 },
          { fontStretch: '64%', fontWeight: 780, duration: 1.4, ease: 'elastic.out(1, 0.45)', clearProps: 'fontStretch,fontWeight' },
          0.25,
        )
        .fromTo(qsa('.sheet__quick, .madlib > *', panel), { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, stagger: 0.05, ease: 'expo.out' }, 0.3)
    }
    setTimeout(() => qs('.sheet__close', panel).focus({ preventScroll: true }), 60)
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
      gsap.set(backdrop, { opacity: 0 })
      done()
    } else {
      tl = gsap
        .timeline({ onComplete: done })
        .to(panel, { yPercent: 102, duration: 0.6, ease: 'expo.in' })
        .to(backdrop, { opacity: 0, duration: 0.4 }, 0.2)
    }
    lastFocus?.focus?.({ preventScroll: true })
  }

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-booking-open]')
    if (trigger) {
      e.preventDefault()
      open({
        service: trigger.dataset.service,
        dur: trigger.dataset.dur,
        note: trigger.dataset.note,
        fromPrice: trigger.hasAttribute('data-booking-from-price'),
      })
      return
    }
    if (isOpen && e.target.closest('[data-sheet-close]')) close()
  })

  document.addEventListener('keydown', (e) => {
    if (!isOpen) return
    if (e.key === 'Escape') close()
    if (e.key === 'Tab') {
      const f = qsa('a[href], button, input, select, textarea', panel).filter((el) => el.offsetParent !== null && !el.disabled)
      const first = f[0]
      const last = f[f.length - 1]
      const outside = !panel.contains(document.activeElement)
      if (e.shiftKey && (document.activeElement === first || outside)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (document.activeElement === last || outside)) {
        e.preventDefault()
        first.focus()
      }
    }
  })

  // Enter in a field: SMS on phones, e-mail on computers
  let implicit = false
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') implicit = e.key === 'Enter' && e.target.matches('input')
  })
  // (a blocked Enter submit – e.g. the name still empty – must not decide the next click)
  form.addEventListener('pointerdown', () => (implicit = false))
  // the browser's own message would say «Sie» – this site says «du»
  const nameField = form.elements.name
  nameField?.addEventListener('invalid', () => nameField.setCustomValidity(nameField.value.trim() ? '' : 'Wie heisst du? Dann kann ich dich zurückrufen.'))
  nameField?.addEventListener('input', () => nameField.setCustomValidity(''))
  form.addEventListener('submit', (e) => {
    e.preventDefault()
    const viaEnter = implicit
    implicit = false
    if (!form.reportValidity()) return
    const d = new FormData(form)
    const service = d.get('service')
    // (the sentence uses the option's text: «eine klassische Massage», «eine Massage nach Absprache»)
    const serviceText = form.elements.service.selectedOptions[0]?.textContent.trim() || 'Massage nach Absprache'
    const dur = Number(d.get('dur'))
    const price = PRICES[dur] + (service === 'Hot-Stone-Massage' ? HOTSTONE : 0)
    const name = String(d.get('name') || '').trim()
    const phone = String(d.get('phone') || '').trim()
    const extra = String(d.get('note') || '').trim()
    const day = d.get('day')
    const when = `${day === 'beliebigen Tag' ? 'an einem beliebigen Tag' : `an einem ${day}`}, ${d.get('time')}`
    const sentence = `Hallo Claudia, ich hätte gerne einen Termin für eine ${serviceText} von ${dur} Minuten (CHF ${price}). Am liebsten ${when}.`
    const body = [
      sentence,
      '',
      `Name: ${name}`,
      phone ? `Telefon: ${phone}` : null,
      extra ? `Bemerkung: ${extra}` : null,
      '',
      'Danke und herzliche Grüsse',
      name,
    ]
      .filter((l) => l !== null)
      .join('\n')
    const channel = viaEnter ? (window.matchMedia('(hover: hover) and (pointer: fine)').matches ? 'mail' : 'sms') : e.submitter?.dataset.send
    if (channel === 'mail') {
      window.location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(`Terminanfrage – ${name}`)}&body=${encodeURIComponent(body)}`
    } else {
      const sms = [sentence, `${name}${phone ? `, ${phone}` : ''}`, extra || null].filter(Boolean).join('\n')
      window.location.href = `sms:${PHONE}?&body=${encodeURIComponent(sms)}`
    }
  })

  return { open, close, get isOpen() { return isOpen } }
}
