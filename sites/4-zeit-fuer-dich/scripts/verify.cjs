// Interaction checks against the built site.
// Usage: npm run build && npm run preview  (in another terminal)  →  npm run verify
let chromium
try {
  ;({ chromium } = require('playwright'))
} catch {
  ;({ chromium } = require('/opt/node22/lib/node_modules/playwright'))
}
const base = process.argv[2] || 'http://localhost:4176/'
const results = []
const ok = (name, cond, info = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name} ${info}`)
const wait = (p, ms) => p.waitForTimeout(ms)
const GL = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']

;(async () => {
  const browser = await chromium.launch({ args: GL })
  const errors = []
  const open = async (opts = {}, url = base, b = browser) => {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 760 }, ...opts })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`${url}: ${e.message}`))
    const [u, hash] = url.split('#')
    await page.goto(u + (u.includes('?') ? '&' : '?') + 'debug' + (hash ? `#${hash}` : ''), { waitUntil: 'networkidle' })
    await wait(page, 5200)
    return { ctx, page }
  }
  const jump = async (page, sel, off = -90) => {
    await page.evaluate(
      ([sel, off]) => {
        const el = document.querySelector(sel)
        const y = el.getBoundingClientRect().top + window.scrollY + off
        window.__lenis ? window.__lenis.scrollTo(y, { immediate: true }) : window.scrollTo(0, y)
      },
      [sel, off],
    )
    await wait(page, 900)
  }
  const clock = (page) => page.evaluate(() => document.querySelector('[data-clock-time]').textContent)

  // ── the day follows the scroll
  {
    const { ctx, page } = await open()
    const live = await page.evaluate(() => document.querySelector('.scene').classList.contains('is-live'))
    ok('landscape renders with WebGL', live)
    const times = []
    for (const sel of ['.interlude[data-hour="10"]', '.interlude[data-hour="15.5"]', '.interlude[data-hour="21.5"]']) {
      await page.evaluate((sel) => {
        const el = document.querySelector(sel)
        window.__lenis.scrollTo(el.getBoundingClientRect().top + scrollY + el.offsetHeight / 2 - innerHeight / 2, { immediate: true })
      }, sel)
      await wait(page, 700)
      times.push(await clock(page))
    }
    ok('the clock follows the scroll through the day', times[0] === '10:00' && times[1] === '15:30' && times[2] === '21:30', times.join(' → '))
    await wait(page, 1500) // the ink cross-fades
    const ink = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sky-ink').trim())
    const cascade = await page.evaluate(() => document.documentElement.style.getPropertyValue('--night'))
    ok('light ink on the night sky; no per-scroll restyle of the page', /244|rgb\(2[34]\d/.test(ink) && cascade === '', `(${ink})`)

    // drag the sun in the hero
    await page.evaluate(() => window.__lenis.scrollTo(0, { immediate: true }))
    await wait(page, 900)
    const before = await clock(page)
    await page.mouse.move(1180, 260)
    await page.mouse.down()
    await page.mouse.move(160, 260, { steps: 10 })
    await page.mouse.up()
    const after = await clock(page)
    ok('dragging the sun changes the time', before !== after, `(${before} → ${after})`)

    // planner: keyboard, opening hours, prefill
    await jump(page, '#preise .planner', -120)
    await page.click('label:has(input[name="p-day"][value="2"])')
    await page.focus('[data-p-slot]')
    await page.keyboard.press('Home')
    const home = await page.evaluate(() => document.querySelector('[data-p-summary]').textContent)
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    const moved = await page.evaluate(() => document.querySelector('[data-p-summary]').textContent)
    ok('planner: Tuesday starts at 8:00, arrows move by 15 min', /Dienstag, 8:00 – 9:00/.test(home) && /8:30 – 9:30/.test(moved), `(${home} | ${moved})`)
    await page.click('[data-from-planner]')
    await wait(page, 1100)
    const pre = await page.evaluate(() => ({
      when: document.querySelector('[data-booking-when]').value,
      focus: document.querySelector('.booking__card').contains(document.activeElement),
      locked: document.documentElement.style.overflow === 'hidden',
    }))
    ok('planner fills in the request; dialog takes focus and locks the page', /Dienstag, 8:30/.test(pre.when) && pre.focus && pre.locked, JSON.stringify(pre))
    for (let i = 0; i < 30; i++) await page.keyboard.press('Tab')
    ok('focus stays inside the dialog', await page.evaluate(() => document.querySelector('.booking__card').contains(document.activeElement)))
    await page.keyboard.press('Escape')
    await wait(page, 1400)
    const closed = await page.evaluate(() => ({
      open: document.querySelector('[data-booking]').classList.contains('is-open'),
      back: document.activeElement?.matches('[data-from-planner]'),
      unlocked: document.documentElement.style.overflow === '',
    }))
    ok('escape closes, focus returns, page unlocked', !closed.open && closed.back && closed.unlocked, JSON.stringify(closed))

    // postcard repaints with the mood
    await jump(page, '#gutschein .gift')
    const px = () =>
      page.evaluate(() => {
        const c = document.querySelector('[data-postcard-canvas]')
        const d = c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height * 0.2), 1, 1).data
        return d[0] + d[1] + d[2]
      })
    const evening = await px()
    await page.click('label:has(input[name="mood"][value="20.1"])')
    await wait(page, 600)
    const night = await px()
    ok('postcard paints the chosen time of day', night < evening - 60, `(${evening} → ${night})`)

    // FAQ, sound
    await jump(page, '#gut-zu-wissen')
    await page.click('.faq summary')
    await wait(page, 700)
    ok('FAQ opens', await page.evaluate(() => document.querySelector('.faq details').open))
    // (the header hides while scrolling down – scroll back up a little first)
    await page.mouse.wheel(0, -300)
    await wait(page, 900)
    await page.click('[data-sound]')
    await wait(page, 800)
    ok('sound switches on', (await page.getAttribute('[data-sound]', 'aria-pressed')) === 'true')
    await page.click('[data-sound]')
    await ctx.close()
  }

  // ── regressions from the first review
  {
    const { ctx, page } = await open()
    // the planner keeps the treatment chosen before (only Hot Stone changes it)
    await jump(page, '#angebot .treat:nth-child(2)')
    await page.click('.treat:nth-child(2) [data-booking-open]')
    await wait(page, 1100)
    await page.keyboard.press('Escape')
    await wait(page, 1300)
    await jump(page, '#preise .planner', -120)
    await page.click('[data-from-planner]')
    await wait(page, 1100)
    const svc = await page.evaluate(() => document.querySelector('[data-booking] input[name="service"]:checked')?.value)
    ok('planner request keeps the chosen treatment', svc === 'Nacken-Schultermassage', `(${svc})`)
    await page.keyboard.press('Escape')
    await wait(page, 1300)
    // a lost GPU context comes back without a reload (typed input survives)
    await jump(page, '#gutschein .gift')
    await page.fill('input[name="to"]', 'Anna')
    const gone = await page.evaluate(async () => {
      const ext = document.querySelector('[data-scene]').getContext('webgl2').getExtension('WEBGL_lose_context')
      ext.loseContext()
      await new Promise((r) => setTimeout(r, 400))
      const during = document.querySelector('.scene').classList.contains('is-live')
      ext.restoreContext()
      await new Promise((r) => setTimeout(r, 1200))
      return { during, after: document.querySelector('.scene').classList.contains('is-live'), name: document.querySelector('input[name="to"]').value }
    })
    ok('WebGL context loss: silhouette meanwhile, scene back, no reload', !gone.during && gone.after && gone.name === 'Anna', JSON.stringify(gone))
    await ctx.close()
  }
  {
    // /#termin opens the request dialog
    const { ctx, page } = await open({}, base + '#termin')
    const st = await page.evaluate(() => document.querySelector('[data-booking]').classList.contains('is-open'))
    ok('a link to /#termin opens the dialog', st)
    await ctx.close()
  }
  {
    // small phone: the drag hint never covers the hero card
    const { ctx, page } = await open({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true })
    const st = await page.evaluate(() => {
      const h = document.querySelector('[data-sun-hint]')
      const a = h.getBoundingClientRect()
      const c = document.querySelector('.hero__card').getBoundingClientRect()
      const overlap = a.top < c.bottom && a.bottom > c.top && a.left < c.right && a.right > c.left
      return { shown: getComputedStyle(h).opacity !== '0', overlap, events: getComputedStyle(h).pointerEvents }
    })
    ok('small phone: the hint stays off the hero card', !(st.shown && st.overlap) && st.events === 'none', JSON.stringify(st))
    await ctx.close()
  }

  // ── regressions from the second review
  {
    // in winter time the dragged sun still lands under the pointer
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    await ctx.addInitScript(() => {
      const delta = new Date('2026-11-10T11:00:00+01:00').getTime() - Date.now()
      const R = Date
      globalThis.Date = class extends R {
        constructor(...a) {
          a.length ? super(...a) : super(R.now() + delta)
        }
        static now() {
          return R.now() + delta
        }
      }
    })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`winter: ${e.message}`))
    await page.goto(base + '?debug', { waitUntil: 'networkidle' })
    await wait(page, 5200)
    await page.mouse.move(400, 300)
    await page.mouse.down()
    await page.mouse.move(1080, 300, { steps: 8 })
    await page.mouse.up()
    await wait(page, 400)
    const sx = await page.evaluate(() => Math.round(window.__scene.sunScreen().x))
    ok('winter time: the dragged sun follows the pointer', Math.abs(sx - 1080) < 40, `(sun at x=${sx})`)
    // summit labels follow a resize
    await page.setViewportSize({ width: 1920, height: 1080 })
    await wait(page, 1200)
    const off = await page.evaluate(() =>
      Math.max(
        0,
        // (a label sits where its leader line points at the summit)
        ...[...document.querySelectorAll('[data-peaks] li.is-on')].map((li) => Math.abs(parseFloat(li.style.left) + parseFloat(li.style.getPropertyValue('--lx')) - window.__scene.project(parseFloat(li.dataset.az), parseFloat(li.dataset.el)).x)),
      ),
    )
    ok('summit labels follow a resize', off < 3, `(off by ${Math.round(off)} px)`)
    // printing shows everything, not just what has been scrolled to
    await page.emulateMedia({ media: 'print' })
    const hidden = await page.evaluate(() => [...document.querySelectorAll('.faq details, .contact li, .tariff li')].filter((el) => getComputedStyle(el).opacity !== '1').length)
    ok('print: content not yet scrolled to is printed', hidden === 0, `(${hidden} hidden)`)
    await ctx.close()
  }
  {
    // phone: a short slot at the end of the day stays put when nudged
    const { ctx, page } = await open({ viewport: { width: 390, height: 844 } })
    await jump(page, '#preise .planner', -80)
    await page.click('label:has(input[name="p-dur"][value="30"])')
    await page.focus('[data-p-slot]')
    await page.keyboard.press('End')
    await wait(page, 700)
    const b = await page.evaluate(() => document.querySelector('[data-p-slot]').getBoundingClientRect().toJSON())
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down()
    await page.mouse.move(b.x + b.width / 2 + 2, b.y + b.height / 2, { steps: 2 })
    await page.mouse.up()
    await wait(page, 300)
    const sum = await page.evaluate(() => document.querySelector('[data-p-summary]').textContent)
    ok('planner: nudging the last short slot keeps its time', /18:30 – 19:00/.test(sum), `(${sum})`)
    await ctx.close()
  }

  // ── a finger on the hero scrolls; it only moves the sun when it moves sideways
  {
    const { ctx, page } = await open({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    const before = await clock(page)
    await page.touchscreen.tap(300, 330)
    await wait(page, 500)
    const after = await clock(page)
    const hint = await page.evaluate(() => getComputedStyle(document.querySelector('[data-sun-hint]')).opacity)
    ok('phone: a tap on the sky does not change the time; the hint shows', before === after && hint === '1', `(${before} → ${after}, hint ${hint})`)
    await ctx.close()
  }

  // ── menu
  {
    const { ctx, page } = await open()
    await page.click('[data-menu-toggle]')
    await wait(page, 800)
    let leaked = 0
    for (let i = 0; i < 24; i++) {
      await page.keyboard.press(i < 12 ? 'Tab' : 'Shift+Tab')
      if (await page.evaluate(() => !!document.activeElement.closest('main, footer, [data-dock]'))) leaked++
    }
    await page.click('[data-menu-link][href="#gutschein"]')
    await wait(page, 2000)
    const st = await page.evaluate(() => ({
      expanded: document.querySelector('[data-menu-toggle]').getAttribute('aria-expanded'),
      unlocked: document.documentElement.style.overflow === '',
      near: Math.abs(document.getElementById('gutschein').getBoundingClientRect().top) < 140,
    }))
    ok('menu traps focus, navigates and closes', leaked === 0 && st.expanded === 'false' && st.unlocked && st.near, JSON.stringify({ leaked, ...st }))
    await ctx.close()
  }

  // ── sizes
  {
    const bad = []
    for (const [w, h] of [
      [360, 740],
      [375, 667],
      [390, 844],
      [414, 896],
      [600, 900],
      [844, 390],
      [768, 1024],
      [1024, 768],
      [1440, 900],
      [1920, 1080],
    ]) {
      const mobile = w < 900 && h > w
      const { ctx, page } = await open({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile })
      const sw = await page.evaluate(async () => {
        for (let y = 0; y < document.documentElement.scrollHeight; y += 700) {
          window.scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 30))
        }
        return document.documentElement.scrollWidth
      })
      if (sw > w) bad.push(`${w}×${h} → ${sw}`)
      // the page clips sideways overflow, so check the fixed header on its own
      const hdr = await page.evaluate(() => Math.max(...[...document.querySelectorAll('.header > *')].map((el) => el.getBoundingClientRect().right)))
      if (hdr > w) bad.push(`${w}×${h} header → ${Math.round(hdr)}`)
      await ctx.close()
    }
    ok('no horizontal scrolling from 360 px to 1920 px; the header fits', bad.length === 0, bad.join(', '))
  }

  // ── a hanging font, reduced motion, no WebGL, no JS, legal pages
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } })
    const page = await ctx.newPage()
    await page.route('**/fonts/instrument-sans.woff2', async (route) => {
      await new Promise((r) => setTimeout(r, 15000))
      route.continue().catch(() => {})
    })
    await page.goto(base, { waitUntil: 'domcontentloaded' })
    await wait(page, 8500)
    const st = await page.evaluate(() => ({ loader: !!document.querySelector('[data-loader]:not(.is-done)'), locked: document.documentElement.style.overflow === 'hidden' }))
    ok('a hanging font does not lock the page', !st.loader && !st.locked, JSON.stringify(st))
    await ctx.close()
  }
  {
    const { ctx, page } = await open({ reducedMotion: 'reduce' })
    const st = await page.evaluate(() => ({ loader: !!document.querySelector('[data-loader]'), unlocked: document.documentElement.style.overflow === '' }))
    ok('reduced motion: no loader, page scrolls', !st.loader && st.unlocked, JSON.stringify(st))
    await ctx.close()
  }
  {
    const noGL = await chromium.launch({ args: ['--disable-gpu', '--disable-webgl', '--disable-webgl2'] })
    const { ctx, page } = await open({}, base, noGL)
    const st = await page.evaluate(() => ({
      live: document.querySelector('.scene').classList.contains('is-live'),
      fallback: getComputedStyle(document.querySelector('[data-scene-fallback]')).getPropertyValue('--fb-ridge').includes('url('),
      unlocked: document.documentElement.style.overflow === '',
    }))
    ok('without WebGL: painted skyline instead, page works', !st.live && st.fallback && st.unlocked, JSON.stringify(st))
    await ctx.close()
    await noGL.close()
  }
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, javaScriptEnabled: false })
    const page = await ctx.newPage()
    await page.goto(base, { waitUntil: 'load' })
    const st = await page.evaluate(() => ({
      links: [...document.querySelectorAll('[data-booking-open]')].every((a) => a.getAttribute('href') === '#kontakt'),
      loaderHidden: getComputedStyle(document.querySelector('[data-loader]')).display === 'none',
      planner: getComputedStyle(document.querySelector('.planner')).display === 'none',
      ridge: /url/.test(getComputedStyle(document.querySelector('[data-scene-fallback]'), '::after').maskImage || getComputedStyle(document.querySelector('[data-scene-fallback]'), '::after').webkitMaskImage),
    }))
    ok('without JavaScript: booking links lead to the contact section; the skyline silhouette shows', st.links && st.loaderHidden && st.planner && st.ridge, JSON.stringify(st))
    await ctx.close()
  }
  for (const path of ['impressum/', '404.html']) {
    const { ctx, page } = await open({}, base + path)
    ok(`${path} renders`, await page.evaluate(() => !!document.querySelector('h1')))
    await ctx.close()
  }

  ok('no JavaScript errors', errors.length === 0, errors.join(' | '))
  await browser.close()
  console.log(results.join('\n'))
  const failed = results.filter((r) => r.startsWith('FAIL')).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
})()
