import './styles/main.css'
import './styles/legal.css'
import { initRollText, prefersReducedMotion } from './js/utils/helpers.js'
import { initCursor, initMagnetic } from './js/core/cursor.js'
import { initScroll } from './js/core/scroll.js'

const html = document.documentElement
html.classList.add('app-booted', prefersReducedMotion() ? 'reduced' : 'motion')
initRollText()
initScroll({ smooth: !prefersReducedMotion() })
initCursor()
initMagnetic()

const header = document.querySelector('[data-header]')
const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 40)
window.addEventListener('scroll', onScroll, { passive: true })
onScroll()

const year = document.querySelector('[data-year]')
if (year) year.textContent = new Date().getFullYear()
