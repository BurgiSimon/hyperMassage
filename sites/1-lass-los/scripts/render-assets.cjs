// Renders favicons, the social share image and the hero poster from the built site.
// Usage: node scripts/render-assets.cjs [baseUrl]   (needs `npm run preview` running)
const path = require('node:path')
const fs = require('node:fs')
let chromium
try {
  ;({ chromium } = require('playwright'))
} catch {
  ;({ chromium } = require('/opt/node-tools/node_modules/playwright'))
}

const base = process.argv[2] || 'http://localhost:4173/'
const pub = path.join(__dirname, '..', 'public')

;(async () => {
  const browser = await chromium.launch({
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
  })

  // icons from the svg
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

  // share image: the hero itself
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await og.goto(base, { waitUntil: 'networkidle' })
  await og.waitForTimeout(16000)
  await og.addStyleTag({
    content: `.header,.hero__hint,.hero__foot,.hero__ctas,.cursor,.grain{display:none!important}
      .hero__lead{color:#efe8dd!important;font-size:22px!important;max-width:30rem!important}`,
  })
  await og.waitForTimeout(400)
  await og.screenshot({ path: path.join(pub, 'og-image.png') })
  await og.close()

  if (process.env.ONLY_OG) { await browser.close(); return console.log('og only') }
  // poster for browsers without WebGL: only the stones, transparent background
  const poster = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 })
  await poster.goto(base, { waitUntil: 'networkidle' })
  await poster.waitForTimeout(16000)
  await poster.addStyleTag({
    content: `html,body,.hero{background:transparent!important}
      body *:not(.hero):not(main):not(.hero__stage):not(.hero__canvas){visibility:hidden!important}
      .hero__glow{display:none!important}`,
  })
  await poster.waitForTimeout(400)
  const box = await poster.locator('[data-hero-canvas]').boundingBox()
  await poster.screenshot({
    path: path.join(pub, 'images', 'stones-poster.png'),
    omitBackground: true,
    clip: { x: box.x + box.width * 0.3, y: box.y + box.height * 0.08, width: box.width * 0.4, height: box.height * 0.82 },
  })
  await poster.close()
  await browser.close()
  console.log('assets rendered')
})()
