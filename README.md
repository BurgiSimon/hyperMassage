# Massage Claudia Bürgi — Website

Immersive one-page website for the massage practice of **Claudia Bürgi** in Kestenholz (SO).
Static build, no backend, no cookies, no tracking.

## Concept — «Lass los.»

The whole site is built around three ideas from the practice itself: **touch, warmth and breath**.

| Moment | What happens |
| --- | --- |
| Preloader | An ember breathes in while the page loads — «Atme ein … und lass los». |
| Hero | A floating cairn of oiled basalt stones (the hot stones of the practice) rendered live in WebGL. The stack slowly breathes; **touching a stone warms it** to an ember glow. A soft warm light follows the hand. |
| Ankommen | The welcome sentence lights up word by word as you read it. |
| Über mich | Claudia's portrait in an arch frame, her story in her own words, animated facts. |
| Angebot | A pinned horizontal journey through the five treatments. Each has its own generative line drawing: tension lines that release under the cursor, the seven cervical vertebrae, a single pressure point, gentle oscillation, rising heat over warm stones. |
| Atempause | A guided one-minute breathing exercise (4 s in · 2 s hold · 6 s out). |
| Preise | A clock face: the arc *is* the length of your treatment. Toggle Hot Stone for the surcharge. |
| Gutschein | Build a voucher live — names, gift and value appear on a tilting card with a foil sheen. The request opens as a prepared e-mail. |
| Kontakt | Huge tap-to-call number, all contact options, opening hours as tiny timelines with *today* and *now* highlighted (Europe/Zurich time). |
| Anfahrt | A custom-drawn street map of Kestenholz from OpenStreetMap data — no Google embed, no tracking. |
| Footer | A giant wordmark whose letters soften and swell under the cursor, plus the local time in Kestenholz. |

Extras: smooth scrolling, theme colours that cross-fade between sections, custom cursor, magnetic buttons,
optional procedural ambient sound («Klang», generated in the browser — no audio files), a booking drawer that
composes an e-mail or SMS, chapter indicator, mobile action dock, `prefers-reduced-motion` support,
cross-document view transitions, print styles.

## Business-first details

- «Termin anfragen» is always one tap away (header, hero, sections, mobile dock).
- All real content lives in semantic HTML — readable without JavaScript, by search engines and screen readers.
- `HealthAndBeautyBusiness` JSON-LD with address, geo, opening hours, services, price range and payment.
- Open Graph image, favicons, web manifest, `sitemap.xml`, `robots.txt`.
- Fonts are self-hosted; the page makes **no third-party requests**.

## Development

```bash
npm install
npm run dev       # local dev server
npm run build     # production build → dist/
npm run preview   # serve the build on http://localhost:4173
```

The `dist/` folder is a plain static site — upload it to any static host (Netlify, Cloudflare Pages,
Vercel, GitHub Pages, a classic web host …). No server configuration is required.

## Editing content

Everything is in **`index.html`** — search for the section comments (`Hero`, `Über mich`, `Angebot`, `Preise` …).

When something changes, update it in these places:

| Change | Where |
| --- | --- |
| Prices | `index.html` (Preise + booking drawer chips), `src/js/sections/prices.js` (`PRICES`, `HOTSTONE`), `src/js/sections/voucher.js` (`GIFTS`), `src/js/core/booking.js` (`PRICES`), JSON-LD `priceRange` |
| Opening hours | `index.html` (Kontakt `data-open` / `data-close`, footer, JSON-LD) |
| Phone / e-mail | `index.html`, `impressum/index.html`, `src/js/core/booking.js`, `src/js/sections/voucher.js` |
| Portrait | `public/images/claudia-buergi.webp` |

## Assets & scripts

- `scripts/build-map.py <extract.osm>` — rebuilds `src/images/map-kestenholz.svg` from an OpenStreetMap
  extract (`https://api.openstreetmap.org/api/0.6/map?bbox=7.7380,47.2755,7.7670,47.2915`).
- `scripts/render-assets.cjs` — with `npm run preview` running, renders the favicons, the share image
  (`public/og-image.jpg`) and the stone poster used when WebGL is unavailable.

## Structure

```
index.html              one-page site (all content)
impressum/index.html    Impressum & Datenschutz
public/                 fonts, images, icons, og-image, sitemap, robots
src/main.js             entry
src/js/app.js           orchestration
src/js/core/            scroll, loader, cursor, header/menu/themes, booking drawer
src/js/sections/        reveals, hero/about/services scenes, breath, prices, voucher, contact, map, footer
src/js/gl/              WebGL stones, canvas signets, GLSL noise
src/js/audio/           procedural ambient sound
src/styles/             tokens, base, header, sections, booking, legal
```

## Credits & licences

- Typefaces: [Fraunces](https://github.com/undercasetype/Fraunces) and [Geist](https://github.com/vercel/geist-font) — SIL Open Font License.
- Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright) (ODbL).
- Libraries: three.js (MIT), GSAP (free, standard licence), Lenis (MIT).
