// Interaction checks against the built site.
// Usage: npm run build && npm run preview  (in another terminal)  →  npm run verify
let chromium
try {
  ;({ chromium } = require('playwright'))
} catch {
  ;({ chromium } = require('/opt/node22/lib/node_modules/playwright'))
}
const base = process.argv[2] || 'http://localhost:4178/'
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
    await wait(page, 6500)
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
  // (dispatches the click on the element itself: a reveal still drifting in must not make the test miss it)
  const press = (page, sel) => page.evaluate((sel) => document.querySelector(sel).click(), sel)
  const hour = (page) => page.evaluate(() => Math.round(window.__land.hour * 60))
  const dialog = (page) =>
    page.evaluate(() => {
      const f = document.querySelector('[data-booking-form]')
      return { service: f.elements.service.value, dur: f.elements.dur.value, when: f.elements.when.value, note: f.elements.note.value, open: document.querySelector('[data-booking]').classList.contains('is-open') }
    })

  // ── the opening, the inside and the closing
  {
    const { ctx, page } = await open()
    const st = await page.evaluate(() => {
      const ks = [...document.querySelectorAll('.hero__title .kc')].map((c) => parseFloat(c.style.getPropertyValue('--k') || '0'))
      return { live: document.querySelector('.scene').classList.contains('is-live'), letters: ks.length, rest: Math.max(...ks.map(Math.abs)), sr: document.querySelector('.hero__title .sr-only')?.textContent }
    })
    ok('landscape renders; the title arrives and exhales to rest', st.live && st.letters === 12 && st.rest < 0.1 && st.sr === 'Zeit für dich.', JSON.stringify(st))

    // letters near the pointer let go
    const c = await page.evaluate(() => document.querySelector('.hero__title .kc').getBoundingClientRect().toJSON())
    await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 4 })
    await wait(page, 700)
    const k = await page.evaluate(() => parseFloat(document.querySelector('.hero__title .kc').style.getPropertyValue('--k')))
    ok('kinetic letters relax under the pointer', k > 0.3, `(--k ${k})`)

    // the inside: the renderer rests, the sheet takes each section's colours, the header follows
    await jump(page, '#atempause', 0)
    await wait(page, 600)
    const mid = await page.evaluate(() => ({ theme: document.querySelector('[data-sheet]').dataset.activeTheme, tone: document.documentElement.dataset.tone, take: window.__land.take }))
    await jump(page, '#kontakt', 0)
    await wait(page, 600)
    const clay = await page.evaluate(() => ({ theme: document.querySelector('[data-sheet]').dataset.activeTheme, tone: document.documentElement.dataset.tone }))
    ok('the sheet and the header follow the sections (basalt, clay)', mid.theme === 'basalt' && mid.tone === 'dark' && clay.theme === 'clay' && clay.tone === 'clay', JSON.stringify({ mid, clay }))
    // the closing: night falls while the footer rises
    await page.evaluate(() => window.__lenis.scrollTo(document.documentElement.scrollHeight, { immediate: true }))
    await wait(page, 1200)
    const night = await page.evaluate(() => ({ take: window.__land.take, hour: window.__land.hour, tone: document.documentElement.dataset.tone, sky: document.documentElement.dataset.sky }))
    ok('the footer shows the Jura at night; light ink', night.take === 'night' && night.hour > 20 && night.tone === 'dark' && night.sky === 'dark', JSON.stringify(night))

    // drag the sun in the hero
    await page.evaluate(() => window.__lenis.scrollTo(0, { immediate: true }))
    await wait(page, 900)
    const before = await hour(page)
    await page.mouse.move(1180, 230)
    await page.mouse.down()
    await page.mouse.move(160, 230, { steps: 10 })
    await page.mouse.up()
    const after = await hour(page)
    ok('dragging the sun changes the hour', before !== after, `(${before} → ${after} min)`)
    await ctx.close()
  }

  // ── body map, treatments, breathing pause
  {
    const { ctx, page } = await open()
    await jump(page, '#wo-drueckts .bodymap__grid', -90)
    await press(page, '[data-zone="neck"]')
    await press(page, '[data-zone="shoulders"]')
    await wait(page, 400)
    const rec = await page.evaluate(() => document.querySelector('[data-rec-title]').textContent)
    await press(page, '[data-rec-cta]')
    await wait(page, 1100)
    const d1 = await dialog(page)
    ok('body map: neck + shoulders suggests a neck and shoulder massage and fills in the request', /Nacken-Schultermassage/.test(rec) && d1.open && d1.service === 'Nacken-Schultermassage' && d1.dur === '45' && /Schultern/.test(d1.note), JSON.stringify({ rec, ...d1 }))
    await page.keyboard.press('Escape')
    await wait(page, 1300)
    // a tap on the drawn body chooses a zone too
    await press(page, '[data-rec-reset]')
    await jump(page, '#wo-drueckts .bodymap__stage', -120)
    const hit = await page.evaluate(() => {
      const r = document.querySelector('[data-bodymap-stage]').getBoundingClientRect()
      return { x: r.left + r.width * 0.42, y: r.top + r.height * 0.5 }
    })
    let picked = []
    for (const dy of [0, -30, 30, -60, 60]) {
      await page.mouse.click(hit.x, hit.y + dy)
      await wait(page, 200)
      picked = await page.evaluate(() => [...document.querySelectorAll('[data-zone][aria-pressed="true"]')].map((b) => b.dataset.zone))
      if (picked.length) break
    }
    ok('body map: a click on the body selects a zone', picked.length === 1, `(${picked})`)

    await jump(page, '.service:nth-child(5)', -200)
    await press(page, '.service:nth-child(5) .service__cta')
    await wait(page, 1100)
    const d2 = await dialog(page)
    ok('a treatment card asks for that treatment', d2.open && d2.service === 'Hot-Stone-Massage', JSON.stringify(d2))
    await page.keyboard.press('Escape')
    await wait(page, 1300)

    await jump(page, '#atempause', 0)
    await press(page, '[data-breath-start]')
    await wait(page, 3200)
    const br = await page.evaluate(() => ({
      label: document.querySelector('[data-breath-label]').textContent,
      lift: parseFloat(document.querySelector('[data-breath]').style.getPropertyValue('--lift')),
      btn: document.querySelector('[data-breath-btn-label]').textContent,
      focus: document.body.classList.contains('is-breathing'),
      k: parseFloat(document.querySelector('[data-breath-title] .kc').style.getPropertyValue('--k')),
    }))
    await page.keyboard.press('Escape')
    await wait(page, 600)
    const brEnd = await page.evaluate(() => ({ btn: document.querySelector('[data-breath-btn-label]').textContent, focus: document.body.classList.contains('is-breathing') }))
    ok('breathing pause: the stones lift with the breath in, the headline tenses; Escape ends it', br.label === 'Atme ein' && br.lift > 0.3 && br.btn === 'Beenden' && br.focus && br.k < -0.05 && brEnd.btn === 'Atemübung starten' && !brEnd.focus, JSON.stringify({ br, brEnd }))
    await ctx.close()
  }

  // ── planner, dialog, postcard, FAQ, sound
  {
    const { ctx, page } = await open()
    await jump(page, '#preise .planner', -120)
    await page.click('label:has(input[name="p-day"][value="2"])')
    await page.focus('[data-p-slot]')
    await page.keyboard.press('Home')
    const home = await page.evaluate(() => document.querySelector('[data-p-summary]').textContent)
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('ArrowRight')
    await wait(page, 900)
    const moved = await page.evaluate(() => ({
      sum: document.querySelector('[data-p-summary]').textContent,
      caption: document.querySelector('[data-p-caption]').textContent,
      // the window shows a sky, not an empty canvas
      painted: (() => {
        const c = document.querySelector('[data-p-sky]')
        const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data
        let lo = 765
        let hi = 0
        for (let i = 0; i < d.length; i += 4 * 97) {
          const s = d[i] + d[i + 1] + d[i + 2]
          lo = Math.min(lo, s)
          hi = Math.max(hi, s)
        }
        return hi - lo > 120
      })(),
    }))
    ok('planner: Tuesday starts at 8:00, arrows move by 15 min, the window shows that sky', /Dienstag, 8:00 – 9:00/.test(home) && /8:30 – 9:30/.test(moved.sum) && /Dienstag, \d+\. \w+, 9:00 Uhr/.test(moved.caption) && moved.painted, JSON.stringify({ home, ...moved }))
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
    await jump(page, '#gutschein .gift__grid')
    await wait(page, 600)
    const px = () =>
      page.evaluate(() => {
        const c = document.querySelector('[data-postcard-canvas]')
        const d = c.getContext('2d').getImageData(Math.floor(c.width / 2), Math.floor(c.height * 0.2), 1, 1).data
        return d[0] + d[1] + d[2]
      })
    const evening = await px()
    await page.click('label:has(input[name="mood"][value="20.1"])')
    await wait(page, 700)
    const nightPx = await px()
    ok('postcard paints the chosen time of day', nightPx < evening - 60, `(${evening} → ${nightPx})`)

    await jump(page, '#gut-zu-wissen')
    await press(page, '.faq summary')
    await wait(page, 700)
    ok('FAQ opens', await page.evaluate(() => document.querySelector('.faq details').open))
    await press(page, '.header [data-sound]')
    await wait(page, 800)
    ok('sound switches on', (await page.getAttribute('.header [data-sound]', 'aria-pressed')) === 'true')
    await press(page, '.header [data-sound]')
    await ctx.close()
  }

  // ── the planner keeps the treatment chosen before; a lost GPU context comes back
  {
    const { ctx, page } = await open()
    await jump(page, '.service:nth-child(2)', -200)
    await press(page, '.service:nth-child(2) .service__cta')
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
    await page.evaluate(() => window.__lenis.scrollTo(0, { immediate: true }))
    await wait(page, 600)
    const gone = await page.evaluate(async () => {
      const ext = document.querySelector('[data-scene]').getContext('webgl2').getExtension('WEBGL_lose_context')
      ext.loseContext()
      await new Promise((r) => setTimeout(r, 400))
      const during = document.querySelector('.scene').classList.contains('is-live')
      ext.restoreContext()
      await new Promise((r) => setTimeout(r, 1200))
      return { during, after: document.querySelector('.scene').classList.contains('is-live') }
    })
    ok('WebGL context loss: silhouette meanwhile, scene back without a reload', !gone.during && gone.after, JSON.stringify(gone))
    await ctx.close()
  }
  {
    const { ctx, page } = await open({}, base + '#termin')
    ok('a link to /#termin opens the dialog', await page.evaluate(() => document.querySelector('[data-booking]').classList.contains('is-open')))
    await ctx.close()
  }
  {
    // small phone: the drag hint never covers the hero card; a tap on the sky changes nothing
    const { ctx, page } = await open({ viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true })
    const st = await page.evaluate(() => {
      const h = document.querySelector('[data-sun-hint]')
      const a = h.getBoundingClientRect()
      const c = document.querySelector('.hero__card').getBoundingClientRect()
      const overlap = a.top < c.bottom && a.bottom > c.top && a.left < c.right && a.right > c.left
      return { overlap, events: getComputedStyle(h).pointerEvents }
    })
    const before = await hour(page)
    await page.touchscreen.tap(300, 300)
    await wait(page, 500)
    const after = await hour(page)
    ok('small phone: the hint stays off the hero card; a tap on the sky changes nothing', !st.overlap && st.events === 'none' && before === after, JSON.stringify({ ...st, before, after }))
    await ctx.close()
  }
  {
    // in winter time the dragged sun still lands under the pointer; labels follow a resize; print shows all
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
    await wait(page, 6500)
    await page.mouse.move(1000, 200)
    await page.mouse.down()
    await page.mouse.move(1080, 200, { steps: 8 })
    await page.mouse.up()
    await wait(page, 400)
    const sx = await page.evaluate(() => Math.round(window.__scene.sunScreen().x))
    ok('winter time: the dragged sun follows the pointer', Math.abs(sx - 1080) < 40, `(sun at x=${sx})`)
    await page.setViewportSize({ width: 1920, height: 1080 })
    await wait(page, 1500)
    const off = await page.evaluate(() =>
      Math.max(
        0,
        ...[...document.querySelectorAll('[data-peaks] li.is-on')].map((li) => Math.abs(parseFloat(li.style.left) + parseFloat(li.style.getPropertyValue('--lx')) - window.__scene.project(parseFloat(li.dataset.az), parseFloat(li.dataset.el)).x)),
      ),
    )
    const shown = await page.evaluate(() => document.querySelectorAll('[data-peaks] li.is-on').length)
    ok('summit labels sit on their peaks after a resize', off < 3 && shown >= 3, `(off by ${Math.round(off)} px, ${shown} shown)`)
    await page.emulateMedia({ media: 'print' })
    const hidden = await page.evaluate(() => [...document.querySelectorAll('.faq details, .links li, .tariff li, .service, .facts > div')].filter((el) => getComputedStyle(el).opacity !== '1').length)
    ok('print: content not yet scrolled to is printed', hidden === 0, `(${hidden} hidden)`)
    await ctx.close()
  }
  {
    // phone: a short slot at the end of the day stays put when nudged
    const { ctx, page } = await open({ viewport: { width: 390, height: 844 } })
    await jump(page, '#preise .planner__day', -300)
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

  // ── menu
  {
    const { ctx, page } = await open()
    await page.click('[data-menu-toggle]')
    await wait(page, 800)
    let leaked = 0
    for (let i = 0; i < 26; i++) {
      await page.keyboard.press(i < 13 ? 'Tab' : 'Shift+Tab')
      if (await page.evaluate(() => !!document.activeElement.closest('main, footer, [data-dock]'))) leaked++
    }
    await page.click('[data-menu-link][href="#gutschein"]')
    await wait(page, 2200)
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
      // the page clips sideways overflow: check the fixed header, the headlines and the sections on their own
      const st = await page.evaluate(() => {
        const W = document.documentElement.clientWidth
        const hdr = Math.max(...[...document.querySelectorAll('.header > *')].map((el) => el.getBoundingClientRect().right))
        const wide = [...document.querySelectorAll('.kvis .kw, .statement .sw, .phone, .tariff li, .facts dd, .wrap > *, .footer__word')].filter((el) => el.getBoundingClientRect().right > W + 1).map((el) => el.textContent.trim().slice(0, 24))
        return { hdr, wide }
      })
      if (st.hdr > w) bad.push(`${w}×${h} header → ${Math.round(st.hdr)}`)
      if (st.wide.length) bad.push(`${w}×${h} wider than the screen: ${st.wide.join(' / ')}`)
      await ctx.close()
    }
    ok('no horizontal scrolling from 360 px to 1920 px; header and headlines fit', bad.length === 0, bad.join(', '))
  }

  // ── a hanging font, reduced motion, no WebGL, no JS, legal pages
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } })
    const page = await ctx.newPage()
    await page.route('**/fonts/geist.woff2', async (route) => {
      await new Promise((r) => setTimeout(r, 15000))
      route.continue().catch(() => {})
    })
    await page.goto(base, { waitUntil: 'domcontentloaded' })
    await wait(page, 9500)
    const st = await page.evaluate(() => ({
      loader: !!document.querySelector('[data-loader]:not(.is-done)'),
      locked: document.documentElement.style.overflow === 'hidden',
      title: getComputedStyle(document.querySelector('.hero__title')).opacity,
    }))
    ok('a hanging font does not lock the page or hide the title', !st.loader && !st.locked && st.title === '1', JSON.stringify(st))
    await ctx.close()
  }
  {
    const { ctx, page } = await open({ reducedMotion: 'reduce' })
    const st = await page.evaluate(() => ({ loader: !!document.querySelector('[data-loader]'), unlocked: document.documentElement.style.overflow === '', split: !!document.querySelector('.kvis') }))
    ok('reduced motion: no loader, no moving letters, page scrolls', !st.loader && st.unlocked && !st.split, JSON.stringify(st))
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
      breath: getComputedStyle(document.querySelector('.breath__actions')).display === 'none',
      themes: getComputedStyle(document.getElementById('atempause')).backgroundColor,
    }))
    ok('without JavaScript: booking links lead to the contact section; sections paint their own colours', st.links && st.loaderHidden && st.planner && st.breath && st.themes === 'rgb(23, 19, 15)', JSON.stringify(st))
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
