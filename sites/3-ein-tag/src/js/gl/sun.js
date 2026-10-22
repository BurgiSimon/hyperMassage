// Solar position (NOAA approximation) for the practice in Kestenholz.
export const LAT = 47.28347
export const LON = 7.75235

const rad = Math.PI / 180

/** Sun azimuth (deg, 0 = north, 90 = east) and elevation (deg) for a Date. */
export function sunPosition(date, lat = LAT, lon = LON) {
  const jd = date.getTime() / 86400000 + 2440587.5
  const t = (jd - 2451545) / 36525
  const l0 = (280.46646 + t * (36000.76983 + t * 0.0003032)) % 360
  const m = 357.52911 + t * (35999.05029 - 0.0001537 * t)
  const e = 0.016708634 - t * (0.000042037 + 0.0000001267 * t)
  const c =
    Math.sin(m * rad) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(2 * m * rad) * (0.019993 - 0.000101 * t) +
    Math.sin(3 * m * rad) * 0.000289
  const trueLong = l0 + c
  const omega = 125.04 - 1934.136 * t
  const lambda = trueLong - 0.00569 - 0.00478 * Math.sin(omega * rad)
  const eps0 = 23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60
  const eps = eps0 + 0.00256 * Math.cos(omega * rad)
  const decl = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad))
  const y = Math.tan((eps / 2) * rad) ** 2
  const eqTime =
    (4 / rad) *
    (y * Math.sin(2 * l0 * rad) -
      2 * e * Math.sin(m * rad) +
      4 * e * y * Math.sin(m * rad) * Math.cos(2 * l0 * rad) -
      0.5 * y * y * Math.sin(4 * l0 * rad) -
      1.25 * e * e * Math.sin(2 * m * rad))
  const minutes = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60
  let tst = (minutes + eqTime + 4 * lon) % 1440
  if (tst < 0) tst += 1440
  let ha = tst / 4 - 180
  if (ha < -180) ha += 360
  const latR = lat * rad
  const cosZen = Math.sin(latR) * Math.sin(decl) + Math.cos(latR) * Math.cos(decl) * Math.cos(ha * rad)
  const zen = Math.acos(Math.min(1, Math.max(-1, cosZen)))
  const el = 90 - zen / rad
  let az = Math.acos(Math.min(1, Math.max(-1, (Math.sin(latR) * Math.cos(zen) - Math.sin(decl)) / (Math.cos(latR) * Math.sin(zen)))))
  az = az / rad
  az = ha > 0 ? (az + 180) % 360 : (540 - az) % 360
  return { az, el }
}

// formatters are expensive to build: make each one once
let fmtFull, fmtDay, fmtHour
const parts = (fmt, date) => Object.fromEntries(fmt.formatToParts(date).map((x) => [x.type, x.value]))

/** Offset of Europe/Zurich from UTC in hours on a given day. */
export function zurichOffset(date = new Date()) {
  fmtFull ??= new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Zurich',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const p = parts(fmtFull, date)
  const asUTC = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute)
  return Math.round((asUTC - date.getTime()) / 3600000)
}

/** Today's date in Kestenholz as {y, m, d}. */
export function zurichDay(date = new Date()) {
  fmtDay ??= new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', year: 'numeric', month: '2-digit', day: '2-digit' })
  const p = parts(fmtDay, date)
  return { y: +p.year, m: +p.month, d: +p.day }
}

/** A Date for a local Kestenholz hour (decimal) on a given day. */
const offsets = new Map()
export function dateAt(hour, day = zurichDay()) {
  const key = `${day.y}-${day.m}-${day.d}`
  if (!offsets.has(key)) offsets.set(key, zurichOffset(new Date(Date.UTC(day.y, day.m - 1, day.d, 12))))
  const off = offsets.get(key)
  const h = ((hour % 24) + 24) % 24
  return new Date(Date.UTC(day.y, day.m - 1, day.d, 0, 0) + (h - off) * 3600000)
}

/** Current decimal hour in Kestenholz. */
export function nowHour(date = new Date()) {
  fmtHour ??= new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Zurich', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const p = parts(fmtHour, date)
  return +p.hour + +p.minute / 60
}

/** The «story day» of the scroll narrative: a mid-October day (sunrise ≈ 7:50, sunset ≈ 18:40). */
export const STORY_DAY = { y: 2026, m: 10, d: 15 }
