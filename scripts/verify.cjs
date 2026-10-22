// Interaction checks against the built site.
// Usage: npm run build && npm run preview  (in another terminal)  →  npm run verify
let chromium
try {
  ;({ chromium } = require('playwright'))
} catch {
  ;({ chromium } = require('/opt/node-tools/node_modules/playwright'))
}
const base = process.argv[2] || 'http://localhost:4173/'
const results = []
const ok = (name, cond, info = '') => results.push(`${cond ? 'PASS' : 'FAIL'}  ${name} ${info}`)
;(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
  const errors = []
  // desktop, short viewport → drawer must scroll with wheel
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 700 } })
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.waitForTimeout(5500)
    // hero foot after scroll down + up
    await page.mouse.move(700, 400)
    await page.mouse.wheel(0, 600)
    await page.waitForTimeout(1500)
    await page.mouse.wheel(0, -900)
    await page.waitForTimeout(2000)
    const footOpacity = await page.evaluate(() => getComputedStyle(document.querySelector('.hero__foot')).opacity)
    const spanVis = await page.evaluate(() => getComputedStyle(document.querySelector('.hero__foot span')).visibility)
    ok('hero foot visible after scrolling back', Number(footOpacity) > 0.95 && spanVis === 'visible', `(opacity ${footOpacity}, ${spanVis})`)

    await page.click('.hero__ctas [data-booking-open]')
    await page.waitForTimeout(1500)
    await page.mouse.move(1000, 400)
    await page.mouse.wheel(0, 500)
    await page.waitForTimeout(800)
    const st = await page.evaluate(() => document.querySelector('.booking__panel').scrollTop)
    ok('booking drawer scrolls with wheel', st > 50, `(scrollTop ${st})`)
    const pageY = await page.evaluate(() => window.scrollY)
    ok('page stays locked behind drawer', pageY < 5, `(scrollY ${pageY})`)

    // focus trap: shift+tab from panel itself
    await page.evaluate(() => document.querySelector('.booking__panel').focus())
    await page.keyboard.press('Shift+Tab')
    const inside1 = await page.evaluate(() => document.querySelector('.booking__panel').contains(document.activeElement))
    ok('shift+tab stays inside drawer', inside1)
    for (let i = 0; i < 40; i++) await page.keyboard.press('Tab')
    const inside2 = await page.evaluate(() => document.querySelector('.booking__panel').contains(document.activeElement))
    ok('40× tab stays inside drawer', inside2)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(900)

    // stale hot stone
    await page.evaluate(() => document.querySelector('#preise').scrollIntoView())
    await page.waitForTimeout(1200)
    await page.click('label.toggle')
    await page.click('[data-booking-from-price]')
    await page.waitForTimeout(1200)
    const svc1 = await page.evaluate(() => document.querySelector('.booking input[name="service"]:checked').value)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(900)
    await page.click('label.toggle')
    await page.click('[data-booking-from-price]')
    await page.waitForTimeout(1200)
    const svc2 = await page.evaluate(() => document.querySelector('.booking input[name="service"]:checked').value)
    ok('hot stone preselected then cleared', svc1 === 'Hot-Stone-Massage' && svc2 !== 'Hot-Stone-Massage', `(${svc1} → ${svc2})`)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(900)
    await page.mouse.wheel(0, 400)
    await page.waitForTimeout(900)
    const y2 = await page.evaluate(() => window.scrollY)
    ok('page scrolls again after drawer closes', y2 > 100, `(scrollY ${y2})`)
    // keyboard focus inside the pinned horizontal services track lands in view
    await page.evaluate(() => window.scrollTo(0, 0))
    await page.waitForTimeout(800)
    await page.evaluate(() => document.querySelector('.service--cta a').focus())
    await page.waitForTimeout(1500)
    const r = await page.evaluate(() => {
      const b = document.querySelector('.service--cta a').getBoundingClientRect()
      return { l: b.left, r: b.right, t: b.top, b: b.bottom, w: innerWidth, h: innerHeight }
    })
    ok('focused services CTA is in view', r.l >= 0 && r.r <= r.w && r.t >= 0 && r.b <= r.h, `(${Math.round(r.l)}, ${Math.round(r.t)})`)
    await page.close()
  }
  // mobile touch: drawer must scroll by swiping
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 700 }, isMobile: true, hasTouch: true })
    const page = await ctx.newPage()
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(base, { waitUntil: 'networkidle' })
    await page.waitForTimeout(5500)
    await page.tap('.hero__ctas [data-booking-open]')
    await page.waitForTimeout(1500)
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 200, y: 550 }] })
    for (let i = 1; i <= 10; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 200, y: 550 - i * 35 }] })
      await page.waitForTimeout(16)
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await page.waitForTimeout(800)
    const st = await page.evaluate(() => document.querySelector('.booking__panel').scrollTop)
    ok('booking drawer scrolls by touch', st > 50, `(scrollTop ${st})`)
    await page.close()
    await ctx.close()
  }
  // menu focus + malformed hash
  {
    const page = await browser.newPage({ viewport: { width: 900, height: 800 } })
    page.on('pageerror', (e) => errors.push(e.message))
    await page.goto(base + '#2', { waitUntil: 'networkidle' })
    await page.waitForTimeout(5500)
    await page.click('[data-menu-toggle]')
    await page.waitForTimeout(1500)
    const focused = await page.evaluate(() => document.activeElement?.closest('.menu') !== null && document.activeElement.tagName)
    ok('menu focuses its first link', focused === 'A', `(${focused})`)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(1200)
    const y0 = await page.evaluate(() => window.scrollY)
    await page.mouse.move(400, 400)
    await page.mouse.wheel(0, 500)
    await page.waitForTimeout(900)
    const y1 = await page.evaluate(() => window.scrollY)
    ok('page scrolls after menu closes', y1 > y0 + 100, `(${y0} → ${y1})`)
    await page.close()
  }
  ok('no page errors (incl. #2 hash)', errors.length === 0, errors.join(' | '))
  console.log(results.join('\n'))
  await browser.close()
  if (results.some((r) => r.startsWith('FAIL'))) process.exitCode = 1
})()
