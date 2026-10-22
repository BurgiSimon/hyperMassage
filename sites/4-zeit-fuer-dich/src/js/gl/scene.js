import horizon from '../../data/horizon.json'
import { sunPosition, dateAt, STORY_DAY } from './sun.js'

/*
 * The landscape: the real skyline north of the practice (swisstopo height model),
 * five distance bands deep, under a sky that follows the sun.
 * One full-screen fragment shader, WebGL2.
 */

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0.0, 1.0); }`

const FRAG = `#version 300 es
precision highp float;
out vec4 o;
uniform sampler2D uRidge;
uniform vec2 uRes;
uniform float uAzC, uFov, uHorizon, uExag, uTime;
uniform vec2 uSun;          // view azimuth, elevation (deg)
uniform vec3 uZenith, uHorizonCol, uGlowCol, uLightCol, uFogCol;
uniform float uGlowK, uAmbient, uNight, uHaze, uLights, uCloud, uSeed;

const float AZ0 = 240.0;
const float AZSPAN = 180.0;

// integer hash: stays clean at any coordinate size (float hashes turn blocky at azimuths of 300+)
uint ihash(uvec2 x) {
  x = x * 1664525u + 1013904223u;
  x.x += x.y * 1664525u; x.y += x.x * 1664525u;
  x ^= x >> 16u;
  x.x += x.y * 1664525u; x.y += x.x * 1664525u;
  x ^= x >> 16u;
  return x.x ^ x.y;
}
float hash(vec2 p) { return float(ihash(uvec2(ivec2(floor(p)) + 65536))) / 4294967295.0; }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  float a = hash(i), b = hash(i + vec2(1, 0)), c = hash(i + vec2(0, 1)), d = hash(i + vec2(1, 1));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return v;
}

vec2 ridge(float az, float band) {
  float u = (az - AZ0) / AZSPAN;
  return texture(uRidge, vec2(u, (band + 0.5) / 5.0)).rg;
}

vec3 sky(float az, float el) {
  float h = clamp(el / 70.0, 0.0, 1.0);
  vec3 c = mix(uHorizonCol, uZenith, pow(h, 0.55));
  // warm glow around the sun, wide and low near the horizon
  float daz = (az - uSun.x) * 0.9;
  float d = length(vec2(daz, (el - uSun.y) * 1.3));
  float glow = exp(-d / 26.0) * uGlowK;
  float band = exp(-abs(el) / 13.0) * exp(-abs(daz) / 100.0) * uGlowK;
  c = mix(c, uGlowCol, clamp(glow * 0.85 + band * 0.55, 0.0, 1.0));
  // the sun itself
  float disc = smoothstep(1.35, 1.05, d);
  c = mix(c, vec3(1.0, 0.97, 0.9), disc * smoothstep(-2.0, 1.0, uSun.y));
  c += uGlowCol * exp(-d / 3.5) * 0.35 * smoothstep(-3.0, 2.0, uSun.y);
  // stars
  if (uNight > 0.01) {
    vec2 sp = vec2(az * 3.2, el * 3.2);
    vec2 cell = floor(sp);
    float r = hash(cell + uSeed);
    vec2 pos = fract(sp) - vec2(hash(cell + 3.1), hash(cell + 7.7));
    float star = smoothstep(0.06, 0.0, length(pos)) * step(0.92, r);
    float tw = 0.65 + 0.35 * sin(uTime * (1.5 + r * 3.0) + r * 40.0);
    // a faint milky way
    float mw = fbm(vec2(az * 0.05 + el * 0.04, el * 0.09 - az * 0.02)) * exp(-pow((el - 32.0 + (az - 330.0) * 0.25) / 14.0, 2.0));
    c += uNight * (vec3(1.0, 0.96, 0.9) * star * tw * smoothstep(0.0, 6.0, el) + vec3(0.25, 0.27, 0.38) * mw * 0.35);
  }
  // town light from the Mittelland under the night sky
  c += vec3(0.32, 0.2, 0.12) * uLights * 0.12 * exp(-max(el, 0.0) / 7.0);
  // clouds: soft streaks, lit from the sun side
  float cl = fbm(vec2(az * 0.045 + uTime * 0.004, el * 0.16 + 3.0)) ;
  cl = smoothstep(0.55 - uCloud * 0.25, 0.95, cl) * smoothstep(1.0, 9.0, el) * (1.0 - smoothstep(40.0, 70.0, el));
  vec3 cloudCol = mix(uHorizonCol * 1.05, uLightCol, 0.55) + uGlowCol * exp(-length(vec2(daz * 0.5, el - uSun.y)) / 40.0) * 0.4;
  // at night the clouds are dim and warm (lit from below by the villages), not grey smudges
  cloudCol = mix(cloudCol, vec3(0.16, 0.13, 0.14), uNight * 0.85);
  c = mix(c, cloudCol, cl * 0.6);
  return c;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float degPx = uFov / uRes.x;
  float az = uAzC + (frag.x - uRes.x * 0.5) * degPx;
  float el = (frag.y - uRes.y * uHorizon) * degPx;
  float te = el / uExag;               // terrain elevation in real degrees
  float aa = degPx / uExag * 1.2;      // one pixel, for soft edges

  vec3 col = sky(az, el);

  const float PLAIN = -0.32;
  // the Jura, far to near so nearer ridges cover the ones behind
  // (pixels the ground plane will cover completely skip the ridges)
  bool underGround = te < ridge(az, 0.0).x - aa;
  float farTop = -10.0;
  for (int b = 4; b >= 1 && !underGround; b--) {
    vec2 rd = ridge(az, float(b));
    float km = rd.y;
    float h = rd.x;
    // forest canopy on the ridge line: finer and bumpier the nearer it is
    float fq = 34.0 / max(km, 1.5);
    h += (noise(vec2(az * fq, float(b) * 7.0)) - 0.5) * (0.07 / max(km * 0.35, 0.7));
    if (te < h + aa) {
      float depth = clamp(km / 16.0, 0.0, 1.0);
      float below = h - te;
      // texture space: isotropic on screen, finer detail on nearer hills
      vec2 tp = vec2(az - 330.0, el) * (7.0 / max(km, 2.0));
      // autumn forest: greens, gold and rust in patches
      float patchN = fbm(tp * 0.45 + float(b) * 3.0);
      vec3 forest = mix(vec3(0.16, 0.24, 0.15), vec3(0.3, 0.33, 0.17), smoothstep(0.35, 0.65, patchN));
      forest = mix(forest, vec3(0.5, 0.36, 0.14), smoothstep(0.6, 0.76, patchN) * 0.8);
      forest = mix(forest, vec3(0.45, 0.22, 0.1), smoothstep(0.72, 0.86, fbm(tp * 0.9 + 9.0)) * 0.55);
      // meadows and pastures on the lower slopes
      float pasture = smoothstep(0.52, 0.7, fbm(tp * 0.3 + float(b) * 11.0));
      forest = mix(forest, vec3(0.42, 0.46, 0.26), smoothstep(0.9, 0.1, te) * pasture * 0.75);
      float canopy = fbm(tp * 2.2);
      vec3 c = forest * (1.0 + (canopy - 0.5) * 0.9 * exp(-km / 9.0));
      // light: side facing the (virtual) sun is brighter, shadows take the sky's colour
      float dh = ridge(az + 2.5, float(b)).x - ridge(az - 2.5, float(b)).x;
      float facing = clamp(0.5 + dh * sign(uSun.x - az) * 0.35 * exp(-below / 1.2), 0.15, 0.85);
      c *= (uLightCol * (0.45 + 0.55 * facing) + uZenith * 0.3) * uAmbient;
      // rim light along the crest when the sun is low
      float rim = exp(-below / 0.05) * smoothstep(22.0, 0.0, uSun.y) * smoothstep(-5.0, 0.0, uSun.y) * smoothstep(farTop, farTop + 0.1, h);
      c += uGlowCol * rim * exp(-abs(az - uSun.x) / 25.0) * 0.5;
      // villages at the foot of the hills light up at night
      if (uLights > 0.01 && te < 0.5 && b <= 2) {
        vec2 lc = vec2(az * 3.2, te * 22.0);
        vec2 id = floor(lc);
        float hh = hash(id + float(b) * 13.0);
        float on = step(0.83, hh) * smoothstep(0.2, 0.0, length((fract(lc) - 0.5) * vec2(1.0, 1.6)));
        c += vec3(1.0, 0.76, 0.45) * on * uLights * (0.85 + 0.15 * sin(uTime * 1.7 + hh * 30.0));
      }
      // aerial perspective
      float fog = 1.0 - exp(-km / mix(14.0, 5.0, uHaze));
      c = mix(c, uFogCol, clamp(fog * 0.9 + 0.05 + depth * 0.05, 0.0, 0.94));
      // morning mist lying at the foot of the ridge
      float mist = uHaze * exp(-max(te + 0.3, 0.0) / 0.6) * (0.55 + 0.45 * fbm(vec2(az * 0.3 + uTime * 0.01, te * 3.0)));
      c = mix(c, uFogCol * 1.08, clamp(mist, 0.0, 0.85));
      col = mix(col, c, smoothstep(h + aa, h - aa, te));
    }
    farTop = max(farTop, h);
  }

  // a line of trees and farms at the near edge of the plain, in front of the hills
  float tn = fbm(vec2(az * 0.7, 3.0));
  float crowns = 0.6 + 0.4 * noise(vec2(az * 9.0, 1.0)) + 0.25 * noise(vec2(az * 23.0, 2.0));
  float trees = PLAIN + 0.01 + smoothstep(0.38, 0.62, tn) * 0.22 * crowns;
  if (te < trees + aa && te > PLAIN - 0.25) {
    vec3 tc = mix(vec3(0.15, 0.2, 0.12), vec3(0.36, 0.28, 0.12), noise(vec2(az * 3.0, te * 20.0)) * 0.7);
    tc *= (uLightCol * 0.7 + uZenith * 0.3) * uAmbient * (0.8 + 0.4 * fbm(vec2(az * 12.0, te * 60.0)));
    tc = mix(tc, uFogCol, clamp((1.0 - exp(-1.1 / mix(14.0, 3.0, uHaze))) * 0.9 + 0.08, 0.0, 0.9));
    float a = smoothstep(trees + aa, trees - aa, te) * smoothstep(PLAIN - 0.25, PLAIN - 0.05, te);
    col = mix(col, tc, a);
  }

  // ground plane: the Gäu, with fields and hedges in perspective
  vec2 r0 = ridge(az, 0.0);
  if (te < r0.x + aa) {
    float ang = max(0.015, PLAIN - te + 0.02);
    float d = 15.0 / tan(radians(ang));                // metres to that point (eye above the plain)
    float x = d * sin(radians(az - uAzC));
    // strips of fields: rows in depth, each row cut into parcels of its own width
    float rowLen = 70.0;
    float row = floor(d / rowLen);
    float pw = 60.0 + 140.0 * hash(vec2(row, 3.0));
    float col_ = floor((x + 7919.0 + hash(vec2(row, 9.0)) * 300.0) / pw);
    float parcel = hash(vec2(row, col_) + uSeed);
    vec3 meadow = mix(vec3(0.36, 0.46, 0.24), vec3(0.5, 0.5, 0.29), parcel);
    meadow = mix(meadow, vec3(0.44, 0.38, 0.27), step(0.82, parcel));    // ploughed
    meadow = mix(meadow, vec3(0.56, 0.48, 0.28), step(0.94, parcel));    // stubble
    float furrow = 0.5 + 0.5 * sin((x + parcel * 50.0) * (0.6 + parcel));
    meadow *= 0.94 + 0.06 * furrow * smoothstep(600.0, 80.0, d);
    float edgeR = smoothstep(4.0, 0.0, abs(mod(d, rowLen) - rowLen * 0.5) - rowLen * 0.5 + 4.0);
    float hedgeOn = step(0.62, hash(vec2(row, col_ * 0.5)));
    meadow = mix(meadow, vec3(0.18, 0.22, 0.14), edgeR * hedgeOn * 0.8);
    // close by, just grass
    vec3 grass = vec3(0.24, 0.32, 0.17) * (0.8 + 0.4 * fbm(vec2(x * 0.08, d * 0.3)));
    meadow = mix(meadow, grass, smoothstep(160.0, 50.0, d));
    vec3 lit = meadow * (uLightCol * 0.8 + uZenith * 0.25) * uAmbient;
    float fog = 1.0 - exp(-d / mix(3000.0, 900.0, uHaze));
    vec3 ground = mix(lit, uFogCol, clamp(fog, 0.0, 0.9));
    ground *= mix(1.0, 0.85, smoothstep(400.0, 40.0, d));   // the near ground lies in shade
    if (uLights > 0.01 && d > 120.0) {
      vec2 lc = vec2(az * 1.6, log(d) * 9.0);
      vec2 id = floor(lc);
      float h = hash(id + 11.0);
      vec2 lp = (fract(lc) - 0.5 - (vec2(hash(id + 2.0), hash(id + 5.0)) - 0.5) * 0.6) * vec2(1.0, 2.2);
      float village = smoothstep(0.55, 0.72, noise(vec2(az * 0.22, 4.0))) * step(700.0, d) + 0.15 * step(0.97, h);
      float on = step(0.78, h) * village * smoothstep(0.22, 0.0, length(lp));
      ground += vec3(1.0, 0.74, 0.42) * on * (0.8 + 0.2 * sin(uTime * 2.0 + h * 50.0)) * uLights * 1.4;
    }
    col = mix(col, ground, smoothstep(r0.x + aa, r0.x - aa, te));
  }

  // valley mist over the plain
  float vm = uHaze * exp(-abs(te + 0.25) / 0.45) * (0.6 + 0.4 * fbm(vec2(az * 0.25 - uTime * 0.008, 1.0)));
  col = mix(col, uFogCol * 1.05, clamp(vm * 0.7, 0.0, 0.7));

  // gentle film grain and vignette
  float grain = hash(frag + floor(fract(uTime * 0.5) * 61.0) * 997.0) - 0.5;
  col += grain * 0.018;
  vec2 q = frag / uRes - 0.5;
  col *= 1.0 - dot(q, q) * 0.35;
  o = vec4(pow(max(col, 0.0), vec3(1.0 / 1.08)), 1.0);
}`

// ───────────── palette by sun elevation ─────────────

const hex = (h) => [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]
const KEYS = [
  { e: -18, zen: '#04060d', hor: '#0c1324', glow: '#151b33', k: 0.0, light: '#2c3656', amb: 0.2, fog: '#141c33', night: 1 },
  { e: -11, zen: '#081028', hor: '#1a2140', glow: '#2e2c50', k: 0.25, light: '#3a4466', amb: 0.26, fog: '#1c2440', night: 0.85 },
  { e: -5, zen: '#172850', hor: '#5d5278', glow: '#d98468', k: 0.65, light: '#7a6a8c', amb: 0.26, fog: '#463f62', night: 0.3 },
  { e: -1, zen: '#2a4a80', hor: '#d98f6c', glow: '#ffa060', k: 1.0, light: '#f2a27c', amb: 0.42, fog: '#9a7f8c', night: 0.05 },
  { e: 4, zen: '#456fa8', hor: '#eebf98', glow: '#ffcb94', k: 0.85, light: '#ffd0a0', amb: 0.72, fog: '#d4b8a6', night: 0 },
  { e: 14, zen: '#4b7fbf', hor: '#cfd6dd', glow: '#ffe6c2', k: 0.5, light: '#ffe9cc', amb: 0.92, fog: '#c2cad3', night: 0 },
  { e: 40, zen: '#3a78c2', hor: '#bed6ed', glow: '#ffffff', k: 0.32, light: '#ffffff', amb: 1.0, fog: '#b4cbe2', night: 0 },
].map((k) => ({ ...k, zen: hex(k.zen), hor: hex(k.hor), glow: hex(k.glow), light: hex(k.light), fog: hex(k.fog) }))

const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]
const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]

/** All lighting parameters for one moment of the day. */
export function look(hour, day = STORY_DAY) {
  const { az, el } = sunPosition(dateAt(hour, day))
  let i = KEYS.length - 2
  for (let j = 0; j < KEYS.length - 1; j++) {
    if (el <= KEYS[j + 1].e) {
      i = j
      break
    }
  }
  const a = KEYS[Math.max(0, i)]
  const b = KEYS[Math.min(KEYS.length - 1, i + 1)]
  const t = Math.min(1, Math.max(0, (el - a.e) / (b.e - a.e || 1)))
  const s = t * t * (3 - 2 * t)
  const zen = mix3(a.zen, b.zen, s)
  const hor = mix3(a.hor, b.hor, s)
  const morning = hour < 12 ? 1 : 0
  const haze = morning * Math.max(0, 1 - Math.abs(el - 1) / 9) * 0.9
  return {
    sunAz: az,
    sunEl: el,
    zen,
    hor,
    glow: mix3(a.glow, b.glow, s),
    glowK: a.k + (b.k - a.k) * s,
    light: mix3(a.light, b.light, s),
    amb: a.amb + (b.amb - a.amb) * s,
    fog: mix3(a.fog, b.fog, s),
    night: a.night + (b.night - a.night) * s,
    haze,
    lights: Math.min(1, Math.max(0, (-el - 1) / 6)),
    // how bright is the sky behind the text (upper-middle of the screen)
    skyLum: lum(mix3(hor, zen, 0.55)),
  }
}

/** Blend two moments (used between the live «now» of the hero and the story day). */
export function mixLook(a, b, t) {
  const m = (x, y) => x + (y - x) * t
  const out = {}
  for (const k of Object.keys(a)) out[k] = Array.isArray(a[k]) ? mix3(a[k], b[k], t) : m(a[k], b[k])
  // the sun takes the short way round
  let d = b.sunAz - a.sunAz
  if (d > 180) d -= 360
  if (d < -180) d += 360
  out.sunAz = a.sunAz + d * t
  return out
}

// ───────────── renderer ─────────────

export function createScene(canvas, { reduced = false, onLook, still = null } = {}) {
  const azTable = { key: '', rows: [] }
  let lost = false
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, powerPreference: 'low-power', preserveDrawingBuffer: !!still })
  if (!gl) return null

  // (status is only asked once the program is linked: asking earlier waits for the GPU)
  const compile = (type, src) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    return s
  }
  // the shader compiles in the background where the browser can: the page stays responsive meanwhile
  // (asked for again in setup(): a restored context forgets its extensions)
  let parallel = null

  // ridge texture data: one row per distance band, R = elevation angle (deg), G = distance (km)
  const W = horizon.count
  // half floats filter linearly everywhere in WebGL2 (32-bit floats need an extension)
  const data = new Float32Array(W * 5 * 2)
  horizon.bands.forEach((band, b) => {
    for (let i = 0; i < W; i++) {
      data[(b * W + i) * 2] = band.el[i] / 100
      // distance is box-averaged over ±1.5°: a jump between neighbouring samples would draw a seam
      let sum = 0
      let n = 0
      for (let k = Math.max(0, i - 6); k <= Math.min(W - 1, i + 6); k++) {
        sum += band.dist[k]
        n++
      }
      data[(b * W + i) * 2 + 1] = ((sum / n) * 10) / 1000
    }
  })

  const U = {}
  let pending = null
  let ready = false
  /** program, triangle, texture, uniforms – again after a lost context comes back */
  const setup = () => {
    ready = false
    parallel = still ? null : gl.getExtension('KHR_parallel_shader_compile')
    const prog = gl.createProgram()
    const vs = compile(gl.VERTEX_SHADER, VERT)
    const fs = compile(gl.FRAGMENT_SHADER, FRAG)
    gl.attachShader(prog, vs)
    gl.attachShader(prog, fs)
    gl.linkProgram(prog)
    pending = { prog, vs, fs }
    // (without the extension – and for stills – it is finished right here)
    return parallel ? 'pending' : finish()
  }
  const finish = () => {
    const { prog, vs, fs } = pending
    pending = null
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('scene shader failed', gl.getShaderInfoLog(vs) || gl.getShaderInfoLog(fs) || gl.getProgramInfoLog(prog))
      return false
    }
    gl.useProgram(prog)

    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

    const tex = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, W, 5, 0, gl.RG, gl.FLOAT, data)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    for (const n of ['uRidge', 'uRes', 'uAzC', 'uFov', 'uHorizon', 'uExag', 'uTime', 'uSun', 'uZenith', 'uHorizonCol', 'uGlowCol', 'uLightCol', 'uFogCol', 'uGlowK', 'uAmbient', 'uNight', 'uHaze', 'uLights', 'uCloud', 'uSeed'])
      U[n] = gl.getUniformLocation(prog, n)
    gl.uniform1i(U.uRidge, 0)
    gl.uniform1f(U.uSeed, 3.7)
    gl.uniform1f(U.uCloud, 0.45)
    ready = true
    state.dirty = true
    canvas.dispatchEvent(new CustomEvent('scene:ready', { bubbles: true }))
    return true
  }
  /** a background compile has finished? then set up – or give up on the scene */
  const poll = () => {
    if (!pending || !gl.getProgramParameter(pending.prog, parallel.COMPLETION_STATUS_KHR)) return
    if (finish()) {
      if (!lost) draw()
      return
    }
    lost = true
    cancelAnimationFrame(raf)
    canvas.dispatchEvent(new CustomEvent('scene:lost', { bubbles: true }))
  }

  const state = { hour: 12, day: STORY_DAY, look: null, w: 0, h: 0, scale: 0.6, dirty: true, time: 0, visible: true, active: true, view: null, quality: 1, idleFps: 12, maxFps: 60 }
  if (setup() === false) return null

  // a software renderer (no GPU) draws synchronously and slowly: start small there
  const dbg = gl.getExtension('WEBGL_debug_renderer_info')
  const renderer = dbg ? String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)) : ''
  if (/swiftshader|llvmpipe|software|basic render/i.test(renderer)) {
    state.quality = 0.4
    state.idleFps = 0 // no idle animation at all: draw only when something changes
    state.maxFps = 8
  }

  // camera: centred on the Roggenflue, wider on wide screens
  const camera = () => {
    const aspect = state.w / state.h
    const fov = Math.min(150, Math.max(58, aspect * 72))
    const horizonY = aspect < 0.8 ? 0.33 : 0.2
    const exag = aspect < 0.8 ? 2.6 : 2.2
    // keep the view inside the measured skyline (255° … 45°)
    const azC = Math.min(405 - fov / 2, Math.max(255 + fov / 2, aspect < 0.8 ? 318 : 328))
    return { fov, horizonY, exag, azC }
  }

  // the real sun is south of us – fold its path into the northern view: east on the right, west on the left
  // the ridges are drawn exaggerated, so a low sun is lifted with them (and meets the real sky higher up)
  const skyEl = (el, v) => {
    if (el <= 0) return el
    const s = Math.min(1, el / 25)
    return el * (v.exag + (1 - v.exag) * s * s * (3 - 2 * s))
  }
  const sunToView = (az, view) => view.azC + ((180 - az) / 90) * (view.fov * 0.42)

  const resize = () => {
    if (still) {
      state.w = still.width
      state.h = still.height
      canvas.width = still.width
      canvas.height = still.height
      gl.viewport(0, 0, canvas.width, canvas.height)
      state.view = camera()
      state.dirty = true
      return
    }
    const r = canvas.getBoundingClientRect()
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    state.w = r.width
    state.h = r.height
    const lowEnd = (navigator.hardwareConcurrency || 4) <= 2 || (navigator.deviceMemory || 4) <= 2
    state.scale = (r.width > 900 ? 0.7 : 0.6) * (lowEnd ? 0.7 : 1) * state.quality
    canvas.width = Math.max(2, Math.round(r.width * dpr * state.scale))
    canvas.height = Math.max(2, Math.round(r.height * dpr * state.scale))
    gl.viewport(0, 0, canvas.width, canvas.height)
    state.view = camera()
    // resizing clears the canvas: paint straight away, or the next frame shows black
    if (!lost) draw()
    canvas.dispatchEvent(new CustomEvent('scene:resize', { bubbles: true }))
  }

  const setHour = (hour, day = state.day) => {
    if (Math.abs(hour - state.hour) < 1e-4 && day === state.day && state.look) return
    state.hour = hour
    state.day = day
    state.look = look(hour, day)
    state.dirty = true
    onLook?.(state.look, hour)
  }
  const setLook = (L, hour) => {
    state.look = L
    state.hour = hour
    state.dirty = true
    onLook?.(L, hour)
  }

  const draw = () => {
    const L = state.look
    const v = state.view
    if (!L || !v || !ready) return
    gl.uniform2f(U.uRes, canvas.width, canvas.height)
    gl.uniform1f(U.uAzC, v.azC)
    gl.uniform1f(U.uFov, v.fov)
    gl.uniform1f(U.uHorizon, v.horizonY)
    gl.uniform1f(U.uExag, v.exag)
    gl.uniform1f(U.uTime, state.time)
    gl.uniform2f(U.uSun, sunToView(L.sunAz, v), skyEl(L.sunEl, v))
    gl.uniform3fv(U.uZenith, L.zen)
    gl.uniform3fv(U.uHorizonCol, L.hor)
    gl.uniform3fv(U.uGlowCol, L.glow)
    gl.uniform3fv(U.uLightCol, L.light)
    gl.uniform3fv(U.uFogCol, L.fog)
    gl.uniform1f(U.uGlowK, L.glowK)
    gl.uniform1f(U.uAmbient, L.amb)
    gl.uniform1f(U.uNight, L.night)
    gl.uniform1f(U.uHaze, L.haze)
    gl.uniform1f(U.uLights, L.lights)
    const t0 = performance.now()
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    state.dirty = false
    // a CPU-bound renderer is slow right here
    noteCost(performance.now() - t0)
  }
  // too slow → lower the resolution and the frame rates (a few times at most)
  let slowFrames = 0
  const noteCost = (ms) => {
    slowFrames = ms > 14 ? slowFrames + 1 : Math.max(0, slowFrames - 1)
    if (slowFrames > 6 && state.quality > 0.3 && !still) {
      slowFrames = 0
      state.quality *= 0.75
      state.idleFps = state.idleFps > 4 ? state.idleFps / 2 : 0
      state.maxFps = Math.max(8, state.maxFps / 2)
      resize()
    }
  }

  // clouds drift slowly and stars twinkle: ~12 fps is plenty when nothing else changes;
  // changes (scrolling, dragging the sun) draw right away. Under an overlay it rests.
  let raf = 0
  let last = 0
  let acc = 0
  const overlays = new Set()
  // (a still scene – the postcard – needs none of these; destroy() removes them)
  const listen = new AbortController()
  const on = { signal: listen.signal, passive: true }
  let lastInput = performance.now()
  if (!still) {
    document.addEventListener(
      'overlay',
      (e) => {
        if (e.detail.open) overlays.add(e.detail.source)
        else overlays.delete(e.detail.source)
      },
      on,
    )
    for (const ev of ['pointermove', 'pointerdown', 'scroll', 'keydown', 'wheel', 'touchstart']) window.addEventListener(ev, () => (lastInput = performance.now()), on)
  }
  let drewLast = false
  const frame = (t) => {
    raf = requestAnimationFrame(frame)
    if (!ready) return poll()
    const gap = t - last
    const dt = Math.min(0.1, gap / 1000 || 0)
    last = t
    // (hidden tab, or the page covers the landscape completely)
    if (!state.visible || !state.active) return
    // drawing on consecutive frames and still missing frames: the GPU is the bottleneck
    if (drewLast && gap > 0 && gap < 200) noteCost(gap > 34 ? 20 : 0)
    drewLast = false
    const resting = t - lastInput > 30000
    if (!reduced && !overlays.size && !resting) state.time += dt
    acc += dt
    const idle = !reduced && !overlays.size && !resting && state.idleFps > 0 && acc > 1 / state.idleFps
    if ((state.dirty && acc >= 1 / state.maxFps - 0.002) || idle) {
      acc = 0
      draw()
      drewLast = true
    }
  }

  // a lost GPU context (driver reset, a tab long in the background) comes back without a reload
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    lost = true
    cancelAnimationFrame(raf)
    canvas.dispatchEvent(new CustomEvent('scene:lost', { bubbles: true }))
  })
  canvas.addEventListener('webglcontextrestored', () => {
    if (setup() === false) return
    lost = false
    resize()
    draw()
    if (!still) raf = requestAnimationFrame(frame)
    canvas.dispatchEvent(new CustomEvent('scene:restored', { bubbles: true }))
  })

  const ro = still ? null : new ResizeObserver(resize)
  ro?.observe(canvas)
  resize()
  setHour(12)
  if (!still) {
    raf = requestAnimationFrame(frame)
    document.addEventListener('visibilitychange', () => (state.visible = !document.hidden), on)
  }

  return {
    setHour,
    setLook,
    get hour() {
      return state.hour
    },
    get look() {
      return state.look
    },
    get view() {
      return state.view
    },
    get lost() {
      return lost
    },
    /** the shader is compiled and the landscape drawn */
    get ready() {
      return ready
    },
    /** screen position (CSS px) of a point on the skyline */
    project(az, elDeg) {
      const v = state.view
      if (!v) return null
      let a = az
      if (a < 180) a += 360
      const degPx = v.fov / state.w
      return { x: state.w / 2 + (a - v.azC) / degPx, y: state.h - (state.h * v.horizonY + (elDeg * v.exag) / degPx) }
    },
    /** screen position of the sun */
    sunScreen() {
      const L = state.look
      const v = state.view
      if (!L || !v) return null
      const degPx = v.fov / state.w
      return { x: state.w / 2 + (sunToView(L.sunAz, v) - v.azC) / degPx, y: state.h - (state.h * v.horizonY + skyEl(L.sunEl, v) / degPx) }
    },
    /** hour for a sun dragged to screen x */
    hourFromX(x, current, day = state.day) {
      const v = state.view
      const degPx = v.fov / state.w
      const viewAz = v.azC + (x - state.w / 2) * degPx
      const realAz = 180 - ((viewAz - v.azC) / (v.fov * 0.42)) * 90
      // the sun's azimuth moves ~15° per hour around noon; search the day for the best match
      // (the azimuth table is built once per day – dragging only looks it up)
      const key = `${day.y}-${day.m}-${day.d}`
      if (azTable.key !== key) {
        azTable.key = key
        azTable.rows = []
        for (let h = 4; h <= 22; h += 0.05) azTable.rows.push([h, sunPosition(dateAt(h, day)).az])
      }
      let best = current
      let bestD = Infinity
      for (const [h, az] of azTable.rows) {
        const d = Math.abs(az - realAz)
        if (d < bestD) {
          bestD = d
          best = h
        }
      }
      return best
    },
    setDay(day) {
      setHour(state.hour, day)
    },
    /** rest while nothing of the landscape is on screen */
    setActive(on) {
      if (state.active === on) return
      state.active = on
      if (on) state.dirty = true
    },
    render: draw,
    /** a still scene: change the picture size without building a new context */
    setSize(width, height) {
      if (!still) return
      still.width = width
      still.height = height
      resize()
    },
    destroy() {
      cancelAnimationFrame(raf)
      ro?.disconnect()
      listen.abort()
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    },
  }
}

/** Render one still frame of the landscape at a given hour into a 2D canvas (postcards). */
let stillCanvas = null
let stillScene = null
export function paintStill(target, hour, { day = STORY_DAY, azC = 322, fov = 64 } = {}) {
  if (!stillCanvas) {
    stillCanvas = document.createElement('canvas')
    stillScene = createScene(stillCanvas, { reduced: true, still: { width: target.width, height: target.height } })
  } else if (stillScene && (stillCanvas.width !== target.width || stillCanvas.height !== target.height)) {
    stillScene.setSize(target.width, target.height)
  }
  // (no picture while the GPU context is gone – the caller paints its plain sky)
  if (!stillScene || stillScene.lost) return false
  stillScene.setHour(hour, day)
  const v = stillScene.view
  v.azC = azC
  v.fov = fov
  v.horizonY = 0.24
  v.exag = 2.6
  stillScene.render()
  target.getContext('2d').drawImage(stillCanvas, 0, 0, target.width, target.height)
  return true
}
