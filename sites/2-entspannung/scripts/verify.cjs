// Interaction checks against the built site.
// Usage: npm run build && npm run preview  (in another terminal)  →  npm run verify
let chromium
try {
  ;({ chromium } = require('playwright'))
} catch {
  ;({ chromium } = require('/opt/node22/lib/node_modules/playwright'))
}
const base = process.argv[2] || 'http://localhost:4174/'
const results = []
const ok = (name, cond, info = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name} ${info}`)
const wait = (p, ms) => p.waitForTimeout(ms)

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  const open = async (opts = {}, url = base) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 }, ...opts })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(`${url}: ${e.message}`))
    await page.goto(url, { waitUntil: 'networkidle' })
    await wait(page, 3600)
    return { ctx, page }
  }
  const jump = (page, sel, off = -90) =>
    page.evaluate(
      ([sel, off]) => {
        const y = sel === 0 ? 0 : document.querySelector(sel).getBoundingClientRect().top + window.scrollY + off
        window.scrollTo(0, y)
        window.dispatchEvent(new Event('scroll'))
      },
      [sel, off],
    )

  // ── hero: clenched at the top, relaxed after scrolling, clenched again on the way back
  {
    const { ctx, page } = await open()
    const stretch = () => page.evaluate(() => parseFloat(document.querySelector('.kl:not(.is-ent)').style.fontStretch))
    const top = await stretch()
    await page.mouse.move(640, 700)
    for (let i = 0; i < 8; i++) {
      await page.mouse.wheel(0, 180)
      await wait(page, 120)
    }
    await wait(page, 1600)
    const mid = await stretch()
    for (let i = 0; i < 12; i++) {
      await page.mouse.wheel(0, -200)
      await wait(page, 100)
    }
    await wait(page, 1800)
    const back = await stretch()
    ok('hero word relaxes on scroll and tenses again', top < 60 && mid > 110 && back < 60, `(${top} → ${mid} → ${back})`)

    // headings: every locked line fits its heading at rest
    const overflow = await page.evaluate(() =>
      [...document.querySelectorAll('.h2')].flatMap((h) => {
        h.querySelectorAll('.kc').forEach((c) => c.style.setProperty('--k', 0))
        const w = h.getBoundingClientRect().width
        return [...h.querySelectorAll('.kline')].filter((l) => l.scrollWidth > w + 2).map((l) => l.textContent)
      }),
    )
    ok('headings keep their line breaks inside the column', overflow.length === 0, overflow.join(' | '))
    await ctx.close()
  }

  // ── booking sheet: open, focus, scroll lock, inner scroll, escape
  {
    const { ctx, page } = await open({ viewport: { width: 1280, height: 620 } })
    await page.click('.hero__ctas [data-booking-open]')
    await wait(page, 1100)
    const state = await page.evaluate(() => ({
      open: document.querySelector('[data-sheet]').classList.contains('is-open'),
      inert: document.querySelector('[data-sheet]').inert,
      focusInside: document.querySelector('.sheet__panel').contains(document.activeElement),
      locked: document.documentElement.style.overflow === 'hidden',
    }))
    ok('sheet opens with focus inside and page locked', state.open && !state.inert && state.focusInside && state.locked, JSON.stringify(state))
    const box = await page.locator('.sheet__panel').boundingBox()
    await page.mouse.move(box.x + 300, box.y + 200)
    await page.mouse.wheel(0, 500)
    await wait(page, 500)
    const panelScroll = await page.evaluate(() => document.querySelector('.sheet__panel').scrollTop)
    ok('sheet scrolls with the mouse wheel on a short screen', panelScroll > 50, `(scrollTop ${panelScroll})`)
    for (let i = 0; i < 25; i++) await page.keyboard.press('Tab')
    const trapped = await page.evaluate(() => document.querySelector('.sheet__panel').contains(document.activeElement))
    ok('focus stays inside the sheet', trapped)
    await page.keyboard.press('Escape')
    await wait(page, 900)
    const after = await page.evaluate(() => ({
      open: document.querySelector('[data-sheet]').classList.contains('is-open'),
      focusBack: document.activeElement?.matches('.hero__ctas [data-booking-open]'),
      unlocked: document.documentElement.style.overflow === '',
    }))
    ok('escape closes, focus returns, scroll unlocked', !after.open && after.focusBack && after.unlocked, JSON.stringify(after))
    await ctx.close()
  }

  // ── menu
  {
    const { ctx, page } = await open()
    await page.click('[data-menu-toggle]')
    await wait(page, 900)
    const focused = await page.evaluate(() => document.querySelector('[data-menu]').contains(document.activeElement))
    await page.click('[data-menu-link][href="#preise"]')
    await wait(page, 2200)
    const st = await page.evaluate(() => ({
      expanded: document.querySelector('[data-menu-toggle]').getAttribute('aria-expanded'),
      inert: document.querySelector('[data-menu]').inert,
      unlocked: document.documentElement.style.overflow === '',
      near: Math.abs(document.getElementById('preise').getBoundingClientRect().top) < 120,
    }))
    ok('menu opens, focuses, navigates and closes', focused && st.expanded === 'false' && st.inert && st.unlocked && st.near, JSON.stringify(st))
    await ctx.close()
  }

  // ── body map → suggestion → prefilled request
  {
    const { ctx, page } = await open()
    await jump(page, '#wo-drueckts')
    await wait(page, 900)
    await page.click('[data-zone="neck"]')
    await page.click('[data-zone="shoulders"]')
    await wait(page, 300)
    const rec = await page.evaluate(() => document.querySelector('[data-rec-title]').textContent)
    ok('body map suggests a treatment', /Nacken-Schultermassage/.test(rec) && /45 Minuten/.test(rec), `(${rec})`)
    await page.click('[data-rec-cta]')
    await wait(page, 1000)
    const pre = await page.evaluate(() => {
      const f = document.querySelector('[data-booking-form]')
      return [f.elements.service.value, f.elements.dur.value, f.elements.note.value]
    })
    ok('suggestion prefills the request', pre[0] === 'Nacken-Schultermassage' && pre[1] === '45' && /Schultern/.test(pre[2]), JSON.stringify(pre))
    await ctx.close()
  }

  // ── prices, PMR (keyboard), voucher, FAQ
  {
    const { ctx, page } = await open()
    await jump(page, '#preise')
    await wait(page, 800)
    await page.click('label.seg__opt:has(input[name="dur"][value="45"])')
    await page.check('[data-hotstone]', { force: true })
    await wait(page, 1300)
    const price = await page.evaluate(() => [document.querySelector('[data-price]').textContent, document.querySelector('[data-booking-from-price]').dataset.service])
    ok('price: 45 min + Hot Stone = CHF 80', price[0] === '80' && price[1] === 'Hot-Stone-Massage', JSON.stringify(price))

    await jump(page, '#spannen-loesen')
    await wait(page, 800)
    await page.focus('[data-pmr-btn]')
    await page.keyboard.down('Space')
    await wait(page, 3200)
    const pressed = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('.pmr')).getPropertyValue('--press')))
    await page.keyboard.up('Space')
    await wait(page, 4400)
    const step = await page.evaluate(() => document.querySelector('.pmr__steps .is-current')?.dataset.step)
    const settled = await page.evaluate(() => getComputedStyle(document.querySelector('.pmr')).getPropertyValue('--press').trim())
    ok('exercise works with the keyboard (hold space)', pressed > 0.8 && step === '1' && Number(settled) === 0, `(press ${pressed}, step ${step}, after ${settled})`)

    await jump(page, '#gutschein')
    await wait(page, 600)
    await page.fill('input[name="to"]', 'Annemarie Muster-Gerber')
    await wait(page, 300)
    const fits = await page.evaluate(() => {
      const n = document.querySelector('[data-poster-name]')
      return [n.getBoundingClientRect().width, n.parentElement.clientWidth]
    })
    ok('voucher: a long name fits the poster', fits[0] <= fits[1] + 1, JSON.stringify(fits))

    await jump(page, '#gut-zu-wissen')
    await wait(page, 600)
    await page.click('.qa summary')
    await wait(page, 700)
    ok('FAQ opens', await page.evaluate(() => document.querySelector('.qa').open))
    await ctx.close()
  }

  // ── no horizontal overflow at common sizes
  {
    const sizes = [
      [360, 740],
      [390, 844],
      [768, 1024],
      [1024, 768],
      [1440, 900],
      [1920, 1080],
    ]
    const bad = []
    for (const [w, h] of sizes) {
      const mobile = w < 800
      const { ctx, page } = await open({ viewport: { width: w, height: h }, isMobile: mobile, hasTouch: mobile })
      const sw = await page.evaluate(async () => {
        // walk the page so lazy parts mount
        for (let y = 0; y < document.documentElement.scrollHeight; y += 700) {
          window.scrollTo(0, y)
          await new Promise((r) => setTimeout(r, 40))
        }
        return document.documentElement.scrollWidth
      })
      if (sw > w) bad.push(`${w}px → ${sw}px`)
      await ctx.close()
    }
    ok('no horizontal scrolling at 360–1920 px', bad.length === 0, bad.join(', '))
  }

  // ── reduced motion, legal pages
  {
    const { ctx, page } = await open({ reducedMotion: 'reduce' })
    const st = await page.evaluate(() => ({
      loader: !!document.querySelector('[data-loader]'),
      stretch: parseFloat(document.querySelector('.kl').style.fontStretch),
      unlocked: document.documentElement.style.overflow === '',
    }))
    ok('reduced motion: relaxed word, no loader, page scrolls', !st.loader && st.stretch > 130 && st.unlocked, JSON.stringify(st))
    await ctx.close()
    for (const path of ['impressum/', '404.html']) {
      const { ctx: c2, page: p2 } = await open({}, base + path)
      ok(`${path} renders`, await p2.evaluate(() => !!document.querySelector('h1')))
      await c2.close()
    }
  }


  // ── regressions from the code review
  {
    // a hanging font must not keep the loader up
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } })
    const page = await ctx.newPage()
    await page.route('**/fonts/mona-sans.woff2', async (route) => {
      await new Promise((r) => setTimeout(r, 15000))
      route.continue().catch(() => {})
    })
    page.on('pageerror', (e) => errors.push(`slow font: ${e.message}`))
    await page.goto(base, { waitUntil: 'domcontentloaded' })
    await wait(page, 8000)
    const st = await page.evaluate(() => ({ loader: !!document.querySelector('[data-loader]:not(.is-done)'), locked: document.documentElement.style.overflow === 'hidden' }))
    ok('a hanging font does not lock the page', !st.loader && !st.locked, JSON.stringify(st))
    await ctx.close()
  }
  {
    const { ctx, page } = await open()
    // menu: Tab never lands behind the overlay
    await page.click('[data-menu-toggle]')
    await wait(page, 900)
    let leaked = 0
    for (let i = 0; i < 16; i++) {
      await page.keyboard.press(i % 2 ? 'Tab' : 'Shift+Tab')
      if (await page.evaluate(() => !!document.activeElement.closest('main, footer, [data-dock]'))) leaked++
    }
    for (let i = 0; i < 14; i++) {
      await page.keyboard.press('Tab')
      if (await page.evaluate(() => !!document.activeElement.closest('main, footer, [data-dock]'))) leaked++
    }
    ok('menu keeps keyboard focus out of the page behind it', leaked === 0, `(${leaked} leaks)`)
    await page.keyboard.press('Escape')
    await wait(page, 700)
    // collapsed treatment rows are not in the tab order
    const hidden = await page.evaluate(() => [...document.querySelectorAll('.srow:not(.is-open) .srow__body a')].every((a) => a.closest('[inert]')))
    ok('collapsed treatment rows are skipped by Tab', hidden)
    // stale prefilled note is replaced, a typed one is kept
    await jump(page, '#wo-drueckts')
    await wait(page, 700)
    await page.click('[data-zone="neck"]')
    await page.click('[data-rec-cta]')
    await wait(page, 900)
    await page.keyboard.press('Escape')
    await wait(page, 800)
    await page.click('[data-zone="neck"]')
    await page.click('[data-zone="legs"]')
    await page.click('[data-rec-cta]')
    await wait(page, 900)
    const note = await page.evaluate(() => document.querySelector('[data-booking-note]').value)
    ok('a suggestion replaces its own earlier note', /Beine/.test(note) && !/Kopf/.test(note), `(${note})`)
    await page.keyboard.press('Escape')
    await wait(page, 800)
    // pressing the exercise again during the rest moves on instead of breaking
    await jump(page, '#spannen-loesen')
    await wait(page, 800)
    await page.focus('[data-pmr-btn]')
    await page.keyboard.down('Space')
    await wait(page, 3000)
    await page.keyboard.up('Space')
    await wait(page, 700)
    await page.keyboard.down('Space')
    await wait(page, 400)
    const re = await page.evaluate(() => ({ step: document.querySelector('.pmr__steps .is-current')?.dataset.step, status: document.querySelector('[data-pmr-status]').textContent }))
    await page.keyboard.up('Space')
    ok('pressing again while resting starts the next step', re.step === '1' && !/loslassen/.test(re.status), JSON.stringify(re))
    await ctx.close()
  }
  {
    // booking sheet never scrolls sideways on a phone, even with the longest option
    const { ctx, page } = await open({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true })
    await page.evaluate(() => document.querySelector('.hero__ctas [data-booking-open]').click())
    await wait(page, 1200)
    await page.selectOption('select[name="service"]', { index: 5 })
    await wait(page, 300)
    const sw = await page.evaluate(() => [document.querySelector('.sheet__panel').scrollWidth, document.querySelector('.sheet__panel').clientWidth])
    ok('booking sheet fits a 360 px phone', sw[0] <= sw[1] + 1, JSON.stringify(sw))
    await ctx.close()
  }

  ok('no JavaScript errors', errors.length === 0, errors.join(' | '))
  await browser.close()
  console.log(results.join('\n'))
  const failed = results.filter((r) => r.startsWith('FAIL')).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
})()
