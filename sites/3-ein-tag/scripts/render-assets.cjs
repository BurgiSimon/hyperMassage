// Renders the favicons and the social share image (a sunset over the real Jura skyline).
// Usage: npm run build && npm run preview  (other terminal)  →  npm run assets
const path = require('node:path')
const fs = require('node:fs')
let chromium
try {
  ;({ chromium } = require('playwright'))
} catch {
  ;({ chromium } = require('/opt/node22/lib/node_modules/playwright'))
}
const base = process.argv[2] || 'http://localhost:4176/'
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
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  await og.goto(base + '?debug', { waitUntil: 'networkidle' })
  await og.waitForTimeout(6000)
  await og.addStyleTag({
    content: `html{scrollbar-gutter:auto!important}
      .header,.hero__hint,.hero__card,.hero__greet,.peaks,.cursor,.dock{display:none!important}
      .og-brand{position:fixed;left:48px;right:48px;bottom:40px;display:flex;justify-content:space-between;font:600 17px 'Instrument Sans',sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#fff7ea;text-shadow:0 1px 12px rgb(0 0 0 / .4)}
      .hero__inner{padding-top:150px!important}
      .hero__title{font-size:150px!important;color:#fff7ea!important;text-shadow:0 2px 40px rgb(40 20 30 / .45)!important}`,
  })
  await og.evaluate(() => {
    window.__day?.preview(18.15)
    const b = document.createElement('div')
    b.className = 'og-brand'
    b.innerHTML = '<span>Massage Claudia Bürgi · Kestenholz</span><span>078 224 91 97</span>'
    document.body.appendChild(b)
  })
  await og.waitForTimeout(800)
  await og.screenshot({ path: path.join(pub, 'og-image.jpg'), type: 'jpeg', quality: 88 })
  await browser.close()
  console.log('assets rendered')
})()
