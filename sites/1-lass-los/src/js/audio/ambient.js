/**
 * Procedural ambient sound – a warm, slowly breathing pad with a hint of
 * flowing water, plus soft stone and chime accents. No audio files, off by default.
 */

const PENTA = [0, 2, 4, 7, 9, 12, 14, 16]
const BASE = 220 // A3

export function createAmbient() {
  let ctx = null
  let master = null
  let pad = null
  let padFilter = null
  let on = false

  const build = () => {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    master = ctx.createGain()
    master.gain.value = 0
    const comp = ctx.createDynamicsCompressor()
    comp.threshold.value = -18
    comp.ratio.value = 3
    master.connect(comp).connect(ctx.destination)

    // pad
    padFilter = ctx.createBiquadFilter()
    padFilter.type = 'lowpass'
    padFilter.frequency.value = 700
    padFilter.Q.value = 0.4
    pad = ctx.createGain()
    pad.gain.value = 0.16
    padFilter.connect(pad).connect(master)
    const chord = [110, 164.81, 220, 277.18, 329.63]
    chord.forEach((f, i) => {
      ;[-4, 4].forEach((cents) => {
        const o = ctx.createOscillator()
        o.type = i < 2 ? 'sine' : 'triangle'
        o.frequency.value = f
        o.detune.value = cents + (Math.random() - 0.5) * 3
        const g = ctx.createGain()
        g.gain.value = (i < 2 ? 0.22 : 0.07) / 2
        // each voice breathes at its own pace
        const lfo = ctx.createOscillator()
        lfo.frequency.value = 0.05 + Math.random() * 0.07
        const lfoGain = ctx.createGain()
        lfoGain.gain.value = g.gain.value * 0.6
        lfo.connect(lfoGain).connect(g.gain)
        o.connect(g).connect(padFilter)
        o.start()
        lfo.start()
      })
    })
    const filterLfo = ctx.createOscillator()
    filterLfo.frequency.value = 1 / 11
    const filterDepth = ctx.createGain()
    filterDepth.gain.value = 260
    filterLfo.connect(filterDepth).connect(padFilter.frequency)
    filterLfo.start()

    // water / air
    const len = ctx.sampleRate * 4
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const data = buf.getChannelData(0)
    let b0 = 0
    let b1 = 0
    let b2 = 0
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1
      b0 = 0.99765 * b0 + white * 0.099046
      b1 = 0.963 * b1 + white * 0.2965164
      b2 = 0.57 * b2 + white * 1.0526913
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.11
    }
    const noise = ctx.createBufferSource()
    noise.buffer = buf
    noise.loop = true
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 520
    bp.Q.value = 0.7
    const ng = ctx.createGain()
    ng.gain.value = 0.05
    const nlfo = ctx.createOscillator()
    nlfo.frequency.value = 0.08
    const nlfoG = ctx.createGain()
    nlfoG.gain.value = 0.03
    nlfo.connect(nlfoG).connect(ng.gain)
    noise.connect(bp).connect(ng).connect(master)
    noise.start()
    nlfo.start()
  }

  const chime = (step = 0, vol = 0.08, dur = 2.4) => {
    if (!on) return
    const t = ctx.currentTime
    const f = BASE * Math.pow(2, PENTA[((step % PENTA.length) + PENTA.length) % PENTA.length] / 12)
    ;[1, 2.01].forEach((mult, i) => {
      const o = ctx.createOscillator()
      o.type = 'sine'
      o.frequency.value = f * mult
      const g = ctx.createGain()
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(vol / (i + 1), t + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur / (i + 1))
      o.connect(g).connect(master)
      o.start(t)
      o.stop(t + dur)
    })
  }

  const stone = () => {
    if (!on) return
    const t = ctx.currentTime
    // soft knock of stone on stone
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(190, t)
    o.frequency.exponentialRampToValueAtTime(90, t + 0.18)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.35)
    const click = ctx.createOscillator()
    click.type = 'triangle'
    click.frequency.value = 1650
    const cg = ctx.createGain()
    cg.gain.setValueAtTime(0.0001, t)
    cg.gain.exponentialRampToValueAtTime(0.06, t + 0.002)
    cg.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
    click.connect(cg).connect(master)
    click.start(t)
    click.stop(t + 0.08)
  }

  const tick = () => {
    if (!on) return
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.value = 1320
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.03, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09)
    o.connect(g).connect(master)
    o.start(t)
    o.stop(t + 0.1)
  }

  const breathe = (dir, secs) => {
    if (!on) return
    const t = ctx.currentTime
    padFilter.frequency.cancelScheduledValues(t)
    padFilter.frequency.setValueAtTime(padFilter.frequency.value, t)
    padFilter.frequency.linearRampToValueAtTime(dir > 0 ? 1500 : 600, t + secs)
    pad.gain.cancelScheduledValues(t)
    pad.gain.setValueAtTime(pad.gain.value, t)
    pad.gain.linearRampToValueAtTime(dir > 0 ? 0.24 : 0.14, t + secs)
  }

  return {
    get on() {
      return on
    },
    async toggle() {
      if (!ctx) build()
      if (ctx.state === 'suspended') await ctx.resume()
      on = !on
      const t = ctx.currentTime
      master.gain.cancelScheduledValues(t)
      master.gain.setValueAtTime(master.gain.value, t)
      master.gain.linearRampToValueAtTime(on ? 0.55 : 0, t + (on ? 2.5 : 0.8))
      if (on) setTimeout(() => chime(4, 0.06, 3), 300)
      return on
    },
    handle(type, detail) {
      if (!on) return
      switch (type) {
        case 'stone:hover':
          chime(detail + 2, 0.045, 2.6)
          break
        case 'stone:tap':
          stone()
          chime(detail + 5, 0.05, 3)
          break
        case 'breath:in':
          breathe(1, detail)
          chime(4, 0.035, detail)
          break
        case 'breath:out':
          breathe(-1, detail)
          break
        case 'breath:end':
          breathe(-1, 2)
          break
        case 'ui:tick':
          tick()
          break
        case 'ui:open':
          chime(7, 0.035, 1.8)
          break
        case 'ui:send':
          chime(0, 0.05, 2)
          chime(4, 0.04, 2.4)
          break
      }
    },
    pause() {
      if (ctx && on) ctx.suspend()
    },
    resume() {
      if (ctx && on) ctx.resume()
    },
  }
}
