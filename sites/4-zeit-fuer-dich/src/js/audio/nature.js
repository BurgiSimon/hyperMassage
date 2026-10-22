/*
 * Klang: the sound of the hour, made in the browser – wind over the plain,
 * birds by day, crickets at dusk and night. No audio files.
 */
export function createNature(getLook) {
  let ctx = null
  let master = null
  let birdBus = null
  let cricketGain = null
  let windGain = null
  let on = false
  let timer = null
  let birdTimer = null
  const level = { birds: 0, crickets: 0, wind: 0.6 }

  const noiseBuffer = (seconds = 4) => {
    const len = ctx.sampleRate * seconds
    const buf = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let last = 0
    for (let i = 0; i < len; i++) {
      // brown noise: soft and low
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02
      d[i] = last * 3.2
    }
    return buf
  }

  const impulse = (seconds = 2.2) => {
    const len = ctx.sampleRate * seconds
    const buf = ctx.createBuffer(2, len, ctx.sampleRate)
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c)
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3)
    }
    return buf
  }

  const build = () => {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
    master = ctx.createGain()
    master.gain.value = 0
    const comp = ctx.createDynamicsCompressor()
    master.connect(comp).connect(ctx.destination)

    // wind
    const src = ctx.createBufferSource()
    src.buffer = noiseBuffer()
    src.loop = true
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 520
    const lfo = ctx.createOscillator()
    lfo.frequency.value = 0.07
    const lfoGain = ctx.createGain()
    lfoGain.gain.value = 260
    lfo.connect(lfoGain).connect(lp.frequency)
    windGain = ctx.createGain()
    windGain.gain.value = 0.22
    src.connect(lp).connect(windGain).connect(master)
    src.start()
    lfo.start()

    // a little space for the birds
    const verb = ctx.createConvolver()
    verb.buffer = impulse()
    const wet = ctx.createGain()
    wet.gain.value = 0.28
    birdBus = ctx.createGain()
    birdBus.gain.value = 0
    birdBus.connect(master)
    birdBus.connect(verb).connect(wet).connect(master)

    // crickets: a high tone, pulsed
    const osc = ctx.createOscillator()
    osc.frequency.value = 4650
    const am = ctx.createGain()
    am.gain.value = 0
    cricketGain = ctx.createGain()
    cricketGain.gain.value = 0
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 4650
    bp.Q.value = 8
    osc.connect(am).connect(bp).connect(cricketGain).connect(master)
    osc.start()
    const pulse = () => {
      if (!ctx) return
      if (!on) return setTimeout(pulse, 1000)
      const t = ctx.currentTime
      // chirp bursts: 3–4 quick pulses, then a pause
      const n = 3 + Math.round(Math.random())
      for (let i = 0; i < n; i++) {
        const s = t + i * 0.055
        am.gain.setValueAtTime(0, s)
        am.gain.linearRampToValueAtTime(1, s + 0.012)
        am.gain.linearRampToValueAtTime(0, s + 0.04)
      }
      setTimeout(pulse, 380 + Math.random() * 260)
    }
    pulse()
  }

  const chirp = () => {
    if (!ctx || !on) return
    const t = ctx.currentTime + 0.02
    const base = 2200 + Math.random() * 2600
    const notes = 2 + Math.floor(Math.random() * 5)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    const g = ctx.createGain()
    g.gain.value = 0
    const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null
    if (pan) pan.pan.value = Math.random() * 1.6 - 0.8
    let s = t
    for (let i = 0; i < notes; i++) {
      const d = 0.05 + Math.random() * 0.09
      const f0 = base * (0.85 + Math.random() * 0.4)
      osc.frequency.setValueAtTime(f0, s)
      osc.frequency.exponentialRampToValueAtTime(f0 * (Math.random() > 0.5 ? 1.35 : 0.72), s + d)
      g.gain.setValueAtTime(0, s)
      g.gain.linearRampToValueAtTime(0.09 + Math.random() * 0.06, s + 0.012)
      g.gain.exponentialRampToValueAtTime(0.0008, s + d)
      s += d + 0.02 + Math.random() * 0.05
    }
    osc.connect(g)
    if (pan) g.connect(pan).connect(birdBus)
    else g.connect(birdBus)
    osc.start(t)
    osc.stop(s + 0.1)
  }

  const scheduleBirds = () => {
    clearTimeout(birdTimer)
    if (!on) return
    if (level.birds > 0.05 && Math.random() < level.birds) chirp()
    birdTimer = setTimeout(scheduleBirds, 350 + Math.random() * (2200 - level.birds * 1500))
  }

  const follow = () => {
    const L = getLook()
    if (!L || !ctx) return
    const el = L.sunEl
    const smooth = (a, b, x) => {
      const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
      return t * t * (3 - 2 * t)
    }
    level.birds = smooth(-7, 1, el) * (1 - smooth(25, 40, el) * 0.5)
    level.crickets = 1 - smooth(-3, 5, el)
    const t = ctx.currentTime
    birdBus.gain.setTargetAtTime(level.birds * 0.9, t, 0.8)
    cricketGain.gain.setTargetAtTime(level.crickets * 0.045, t, 1.2)
    windGain.gain.setTargetAtTime(0.16 + 0.1 * (1 - level.birds), t, 1.5)
  }

  return {
    get on() {
      return on
    },
    toggle() {
      if (!ctx) build()
      on = !on
      if (on) {
        ctx.resume()
        master.gain.setTargetAtTime(0.85, ctx.currentTime, 0.6)
        follow()
        timer = setInterval(follow, 500)
        scheduleBirds()
      } else {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.3)
        clearInterval(timer)
        clearTimeout(birdTimer)
        setTimeout(() => !on && ctx.suspend(), 900)
      }
      return on
    },
  }
}
