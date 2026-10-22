// Renders the favicons and the social share image («Zeit für dich.» over the real Jura skyline at the golden hour).
// Usage: npm run build && npm run preview  (other terminal)  →  npm run assets
const path = require('node:path')
const fs = require('node:fs')
let chromium
try {
  ;({ chromium } = require('playwright'))
} catch {
  ;({ chromium } = require('/opt/node22/lib/node_modules/playwright'))
}
const base = process.argv[2] || 'http://localhost:4178/'
const pub = path.join(__dirname, '..', 'public')

;(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] })
  const svg = fs.readFileSync(path.join(pub, 'favicon.svg'), 'utf8')
  for (const [name, size] of [
    ['favicon-32.png', 32],
    ['apple-touch-icon.png', 180],
    ['icon-192.png', 192],
    ['icon-512.png', 512],
  ]) {
    const page = await browser.newPage({ viewport: { width: size, height: size } })
    const inner = name === 'apple-touch-icon.png' ? svg.replace('rx="16"', 'rx="0"') : svg
    await page.setContent(`<html><body style="margin:0;background:transparent">${inner.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`)
    await page.screenshot({ path: path.join(pub, name), omitBackground: true })
    await page.close()
  }

  // share image: the hero at the golden hour, with the title
  const ogCtx = await browser.newContext({ viewport: { width: 1200, height: 630 } })
  await ogCtx.addInitScript(() => {
    const delta = new Date('2026-10-15T18:02:00+02:00').getTime() - Date.now()
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
  const og = await ogCtx.newPage()
  await og.goto(base + '?debug', { waitUntil: 'networkidle' })
  await og.waitForTimeout(8000)
  await og.addStyleTag({
    content: `html{scrollbar-gutter:auto!important}
      .header,.hero__hint,.hero__card,.hero__greet,.hero__down,.peaks,.cursor,.dock{display:none!important}
      .og-brand{position:fixed;left:56px;right:56px;bottom:44px;display:flex;justify-content:space-between;font:500 15px 'Geist Mono',monospace;letter-spacing:.14em;text-transform:uppercase;color:#fff7ea;text-shadow:0 1px 12px rgb(0 0 0 / .45)}
      .hero__inner{padding:78px 56px!important}
      .hero__title{font-size:168px!important;color:#fff7ea!important;--sky-halo:rgb(60 25 10 / .4)}`,
  })
  await og.evaluate(() => {
    // a full-resolution still of the landscape (the live scene runs at a low resolution on a software GPU)
    const c = document.createElement('canvas')
    c.width = 1200
    c.height = 630
    window.__paintStill(c, 17.8, { day: { y: 2026, m: 10, d: 15 }, azC: 326, fov: 118 })
    c.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:-1'
    document.body.appendChild(c)
    const b = document.createElement('div')
    b.className = 'og-brand'
    b.innerHTML = '<span>Massage Claudia Bürgi · Kestenholz</span><span>078 224 91 97</span>'
    document.body.appendChild(b)
  })
  await og.waitForTimeout(800)
  await og.screenshot({ path: path.join(pub, 'og-image.jpg'), type: 'jpeg', quality: 88 })
  await ogCtx.close()
  await browser.close()
  console.log('assets rendered')
})()
