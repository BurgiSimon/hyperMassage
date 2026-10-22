// Renders the favicons and the social share image.
// Usage: npm run build && npm run preview  (other terminal)  →  npm run assets
const path = require('node:path')
const fs = require('node:fs')
let chromium
try {
  ;({ chromium } = require('playwright'))
} catch {
  ;({ chromium } = require('/opt/node22/lib/node_modules/playwright'))
}
const base = process.argv[2] || 'http://localhost:4174/'
const pub = path.join(__dirname, '..', 'public')

;(async () => {
  const browser = await chromium.launch()
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

  // share image: the word relaxing letter by letter, from clenched red to wide and calm
  const og = await browser.newPage({ viewport: { width: 1200, height: 630 } })
  await og.goto(base, { waitUntil: 'domcontentloaded' })
  const word = 'ENTSPANNUNG'
  const letters = Array.from(word)
    .map((ch, i) => {
      const r = i / (word.length - 1)
      const e = r * r * (3 - 2 * r)
      const w = 50 + 90 * e
      const g = 900 - 700 * e
      const col = `color-mix(in oklch, #ff4521, #121212 ${Math.round(e * 100)}%)`
      return `<span style="font-stretch:${w}%;font-weight:${g};color:${col}">${ch}</span>`
    })
    .join('')
  await og.setContent(`<!doctype html><html><head><style>
    @font-face{font-family:A;src:url(${base}fonts/anybody.woff2) format('woff2');font-weight:100 900;font-stretch:50% 150%}
    @font-face{font-family:M;src:url(${base}fonts/mona-sans.woff2) format('woff2');font-weight:200 900}
    html,body{margin:0;width:1200px;height:630px;background:#ece8e1;color:#121212;font-family:M}
    .top,.bot{position:absolute;left:56px;right:56px;display:flex;justify-content:space-between;font:600 17px M;letter-spacing:.08em;text-transform:uppercase}
    .top{top:48px;padding-bottom:16px;border-bottom:1.5px solid #121212}
    .bot{bottom:48px;padding-top:16px;border-top:1px solid rgba(18,18,18,.2);color:rgba(18,18,18,.7)}
    .w{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);text-align:center;font-family:A;font-size:150px;line-height:.8;white-space:nowrap}
    .w span{display:inline-block}
  </style></head><body>
    <div class="top"><span>Massage Claudia Bürgi</span><span>Kestenholz SO</span></div>
    <div class="w"><span id="in">${letters}</span></div>
    <div class="bot"><span>Klassische Massage · Schmerztherapie · Hot Stone</span><span>078 224 91 97</span></div>
  </body></html>`)
  await og.evaluate(async () => {
    await document.fonts.ready
    const el = document.getElementById('in')
    const w = el.getBoundingClientRect().width
    el.parentElement.style.fontSize = `${(150 * 1088) / w}px`
  })
  await og.waitForTimeout(300)
  await og.screenshot({ path: path.join(pub, 'og-image.jpg'), type: 'jpeg', quality: 88 })
  await browser.close()
  console.log('assets rendered')
})()
