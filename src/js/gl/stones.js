import * as THREE from 'three'
import gsap from 'gsap'
import { createNoise3D } from '../utils/noise.js'
import { pointer } from '../core/cursor.js'
import { GLSL_SIMPLEX } from './glsl.js'

/**
 * A floating cairn of oiled basalt stones – the hot stones of the practice.
 * The stack slowly breathes; touching a stone warms it to an ember glow.
 */

const SPECS = [
  { size: [1.42, 0.55, 1.12], seed: 11, rot: [0.03, 0.35, -0.02] },
  { size: [1.08, 0.46, 0.88], seed: 23, rot: [-0.05, -0.55, 0.06] },
  { size: [0.8, 0.38, 0.66], seed: 37, rot: [0.06, 0.95, -0.05] },
  { size: [0.55, 0.3, 0.47], seed: 51, rot: [-0.03, -0.25, 0.08] },
]

function stoneGeometry({ size, seed }, detail) {
  const geo = new THREE.SphereGeometry(1, detail * 4, detail * 3)
  const noise = createNoise3D(seed)
  const pos = geo.attributes.position
  const v = new THREE.Vector3()
  const p = 2.25 // slightly superelliptic → soft, river-worn faces
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    const r =
      1 / Math.pow(Math.pow(Math.abs(v.x), p) + Math.pow(Math.abs(v.y), p) + Math.pow(Math.abs(v.z), p), 1 / p)
    const n1 = noise(v.x * 0.7 + seed, v.y * 0.7, v.z * 0.7)
    const n2 = noise(v.x * 1.6, v.y * 1.6 + seed, v.z * 1.6)
    const k = r * (1 + n1 * 0.07 + n2 * 0.012)
    // asymmetry: one end a little fuller, belly slightly lower
    const egg = 1 + v.x * 0.06
    const sag = v.y < 0 ? 0.92 : 1
    pos.setXYZ(i, v.x * k * size[0], v.y * k * size[1] * egg * sag, v.z * k * size[2] * egg)
  }
  geo.computeVertexNormals()
  return geo
}

function stoneMaterial(seed, time) {
  const mat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#171615'),
    roughness: 0.52,
    metalness: 0,
    clearcoat: 0.75,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1,
  })
  mat.userData.heat = { value: 0 }
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uHeat = mat.userData.heat
    shader.uniforms.uTime = time
    shader.uniforms.uSeed = { value: seed * 0.37 }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjPos = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vObjPos;
        uniform float uHeat;
        uniform float uTime;
        uniform float uSeed;
        ${GLSL_SIMPLEX}`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float mottle = snoise(vObjPos * 1.6 + uSeed) * 0.5 + 0.5;
        float grain = snoise(vObjPos * 42.0 + uSeed * 3.0);
        float fleck = smoothstep(0.72, 0.95, snoise(vObjPos * 17.0 - uSeed));
        diffuseColor.rgb *= 0.8 + 0.3 * mottle;
        diffuseColor.rgb += vec3(0.012, 0.011, 0.01) * (grain * 0.5 + 0.5);
        diffuseColor.rgb += vec3(0.05, 0.048, 0.046) * fleck;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + 0.16 * snoise(vObjPos * 4.0 + uSeed), 0.2, 1.0);`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        vec3 vdir = normalize(vViewPosition);
        float fres = pow(1.0 - clamp(abs(dot(normal, vdir)), 0.0, 1.0), 2.4);
        float flicker = 0.8 + 0.2 * snoise(vObjPos * 2.2 + vec3(0.0, uTime * 0.7, uSeed));
        float core = smoothstep(0.35, 0.9, snoise(vObjPos * 1.3 + vec3(uTime * 0.12, 0.0, uSeed)) * 0.5 + 0.5);
        vec3 ember = mix(vec3(0.75, 0.16, 0.03), vec3(1.0, 0.55, 0.24), fres);
        float h = uHeat * uHeat * (3.0 - 2.0 * uHeat);
        totalEmissiveRadiance += ember * h * (0.05 + 0.16 * core + 1.4 * fres) * flicker;`,
      )
  }
  return mat
}

function blobMaterial(color, additive) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uColor: { value: new THREE.Color(color) }, uOpacity: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `varying vec2 vUv; uniform vec3 uColor; uniform float uOpacity;
      void main(){ float d = length(vUv - 0.5) * 2.0; float a = pow(1.0 - smoothstep(0.0, 1.0, d), 2.2);
      gl_FragColor = vec4(uColor, a * uOpacity); }`,
  })
}

/** A dark studio with two soft boxes: crisp highlights, no glowing edges. */
function studioEnvironment(renderer) {
  const env = new THREE.Scene()
  env.background = new THREE.Color('#060504')
  const box = (w, h, color, intensity, pos, look) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }),
    )
    m.position.set(...pos)
    m.lookAt(...look)
    env.add(m)
  }
  box(6, 3, '#fff1e2', 3.2, [-4, 6, 4], [0, 0, 0]) // key soft box, top left
  box(1.2, 8, '#ffe2cc', 1.5, [7, 1, -3], [0, 0, 0]) // strip, back right
  box(10, 1.5, '#ffe9d6', 0.9, [0, 9, -2], [0, 0, 0]) // faint top bar
  box(4, 4, '#140e0b', 1, [0, -6, 2], [0, 0, 0]) // dim bounce from below
  const pmrem = new THREE.PMREMGenerator(renderer)
  const tex = pmrem.fromScene(env, 0.02).texture
  pmrem.dispose()
  return tex
}

export function createStones(canvas, { reduced = false, onHover, onTap } = {}) {
  let renderer
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' })
  } catch (e) {
    return null
  }
  const isSmall = window.matchMedia('(max-width: 720px)').matches
  const lowEnd = (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 3
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowEnd ? 1.25 : isSmall ? 1.5 : 1.75))
  renderer.outputColorSpace = THREE.SRGBColorSpace
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure = 0.95
  renderer.setClearColor(0x000000, 0)

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100)
  camera.position.set(0, 0.9, 11)
  camera.lookAt(0, 0, 0)

  scene.environment = studioEnvironment(renderer)

  // light: warm key, ember rim, soft fill
  const key = new THREE.DirectionalLight('#fff3e8', 1.0)
  key.position.set(-4, 6, 5)
  scene.add(key)
  const rim = new THREE.DirectionalLight('#ff8a4c', 0.5)
  rim.position.set(5, 2, -4)
  scene.add(rim)
  const rim2 = new THREE.DirectionalLight('#e8e4f0', 0.6)
  rim2.position.set(-5, -1, -3)
  scene.add(rim2)
  scene.add(new THREE.HemisphereLight('#f4f0ea', '#1a1410', 0.1))

  const time = { value: 0 }
  const root = new THREE.Group()
  const cairn = new THREE.Group()
  root.add(cairn)
  scene.add(root)

  const detail = lowEnd ? 22 : isSmall ? 26 : 40
  const hitGeo = new THREE.SphereGeometry(1, 16, 12)
  const hitMat = new THREE.MeshBasicMaterial({ visible: false })

  const stones = SPECS.map((spec, i) => {
    const mesh = new THREE.Mesh(stoneGeometry(spec, detail), stoneMaterial(spec.seed, time))
    mesh.rotation.set(...spec.rot)
    const holder = new THREE.Group()
    holder.add(mesh)
    const hit = new THREE.Mesh(hitGeo, hitMat)
    hit.scale.set(spec.size[0] * 1.05, spec.size[1] * 1.15, spec.size[2] * 1.05)
    hit.userData.index = i
    holder.add(hit)
    cairn.add(holder)
    return {
      spec,
      mesh,
      holder,
      hit,
      heat: 0,
      target: 0,
      intro: 0,
      bob: Math.random() * Math.PI * 2,
      spin: (i % 2 ? -1 : 1) * (0.05 + i * 0.025),
      hop: 0,
    }
  })

  // shadow + ember glow on an imaginary floor
  const floorY = -2.05
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(6.5, 6.5), blobMaterial('#000000', false))
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = floorY
  root.add(shadow)
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), blobMaterial('#ff6a2a', true))
  glow.rotation.x = -Math.PI / 2
  glow.position.y = floorY + 0.01
  root.add(glow)

  // warm air: a few motes drifting upwards like steam over hot stones
  let motes = null
  if (!reduced) {
    const count = isSmall ? 70 : 150
    const pos = new Float32Array(count * 3)
    const seed = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12
      pos[i * 3 + 1] = (Math.random() - 0.5) * 10
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6
      seed[i] = Math.random()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    motes = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: time,
          uHeat: { value: 0 },
          uScale: { value: renderer.getPixelRatio() * 85 },
          uColor: { value: new THREE.Color('#ffc9a0') },
        },
        vertexShader: /* glsl */ `
          attribute float aSeed;
          uniform float uTime;
          uniform float uScale;
          varying float vAlpha;
          void main() {
            vec3 p = position;
            float speed = 0.12 + aSeed * 0.22;
            p.y = mod(p.y + 5.0 + uTime * speed, 10.0) - 5.0;
            p.x += sin(uTime * 0.25 + aSeed * 6.2831) * 0.35;
            p.z += cos(uTime * 0.2 + aSeed * 12.0) * 0.25;
            vec4 mv = modelViewMatrix * vec4(p, 1.0);
            gl_Position = projectionMatrix * mv;
            gl_PointSize = uScale * (0.35 + aSeed * 0.9) / -mv.z;
            float edge = smoothstep(-5.0, -3.0, p.y) * (1.0 - smoothstep(2.5, 5.0, p.y));
            vAlpha = edge * (0.25 + 0.75 * fract(aSeed * 7.31));
          }`,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uHeat;
          varying float vAlpha;
          void main() {
            float d = length(gl_PointCoord - 0.5);
            float a = smoothstep(0.5, 0.0, d);
            gl_FragColor = vec4(uColor, a * a * vAlpha * (0.26 + uHeat * 0.55));
          }`,
      }),
    )
    scene.add(motes)
  }

  // layout
  const layout = () => {
    const w = canvas.clientWidth || window.innerWidth
    const h = canvas.clientHeight || window.innerHeight
    renderer.setSize(w, h, false)
    camera.aspect = w / h
    const portrait = w / h < 0.9
    camera.fov = portrait ? 34 : 30
    camera.updateProjectionMatrix()
    // frame the cairn: share of screen height + vertical centre, per layout
    const STACK_H = 3.7
    const STACK_W = 3.1
    const aspect = w / h
    const phone = aspect < 0.62
    const heightShare = phone ? 0.28 : portrait ? 0.36 : 0.55
    const centreY = phone ? 0.39 : portrait ? 0.43 : 0.475
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
    let visibleH = STACK_H / heightShare
    visibleH = Math.max(visibleH, STACK_W / (0.62 * camera.aspect))
    const dist = visibleH / (2 * tan)
    camera.position.z = dist
    camera.position.y = dist * 0.08
    camera.lookAt(0, 0, 0)
    root.position.y = (0.5 - centreY) * visibleH
  }
  layout()
  window.addEventListener('resize', layout)

  // interaction
  const raycaster = new THREE.Raycaster()
  const ndc = new THREE.Vector2()
  let hovered = -1
  let pointerInside = false

  const pick = (clientX, clientY) => {
    const rect = canvas.getBoundingClientRect()
    ndc.x = ((clientX - rect.left) / rect.width) * 2 - 1
    ndc.y = -((clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(ndc, camera)
    const hits = raycaster.intersectObjects(
      stones.map((s) => s.hit),
      false,
    )
    return hits.length ? hits[0].object.userData.index : -1
  }

  const onMove = (e) => {
    pointerInside = true
    const idx = pick(e.clientX, e.clientY)
    if (idx !== hovered) {
      hovered = idx
      canvas.style.cursor = idx >= 0 ? 'pointer' : ''
      onHover?.(idx)
    }
  }
  const onLeave = () => {
    pointerInside = false
    if (hovered !== -1) {
      hovered = -1
      onHover?.(-1)
    }
  }
  const onDown = (e) => {
    const idx = pick(e.clientX, e.clientY)
    if (idx < 0) return
    const s = stones[idx]
    s.target = 1
    s.heat = Math.min(1, s.heat + 0.35)
    s.hop = 1
    gsap.fromTo(s, { hop: 1 }, { hop: 0, duration: 1.6, ease: 'elastic.out(1, 0.35)' })
    onTap?.(idx)
  }
  canvas.addEventListener('pointermove', onMove)
  canvas.addEventListener('pointerleave', onLeave)
  canvas.addEventListener('pointerdown', onDown)

  // scroll-driven state
  const state = { scroll: 0, spread: 0, visible: true, running: false, introDone: false }

  // intro: stones settle from above, one after another
  stones.forEach((s) => (s.intro = 1))
  const playIntro = () => {
    const tl = gsap.timeline({ onComplete: () => (state.introDone = true) })
    stones.forEach((s, i) => {
      tl.to(s, { intro: 0, duration: reduced ? 0.01 : 2.2, ease: 'expo.out' }, i * 0.16)
    })
    // a warm wave rolls up the stack to show what touch does
    if (!reduced) {
      stones.forEach((s, i) => {
        tl.to(s, { heat: 0.9, duration: 0.7, ease: 'sine.out' }, 1.3 + i * 0.22)
      })
    }
    return tl
  }

  // adaptive quality: if the first seconds run slow, render fewer pixels
  const perf = { frames: 0, total: 0, done: false }
  const adapt = (frameMs) => {
    if (perf.done) return
    perf.frames++
    perf.total += frameMs
    if (perf.frames < 90) return
    perf.done = true
    const avg = perf.total / perf.frames
    if (avg > 24 && renderer.getPixelRatio() > 1) {
      renderer.setPixelRatio(1)
      layout()
    }
  }

  let rafId = 0
  let last = performance.now()
  let rotY = 0
  let rotX = 0

  const render = (now) => {
    rafId = requestAnimationFrame(render)
    if (!state.visible) return
    const rawDt = (now - last) / 1000
    if (state.introDone) adapt(rawDt * 1000)
    const dt = Math.min(0.05, rawDt)
    const heatDt = Math.min(0.25, rawDt) // warmth follows wall-clock time, even on slow frames
    last = now
    time.value += dt

    const t = time.value
    const breath = reduced ? 0.5 : Math.sin((t / 9) * Math.PI * 2) * 0.5 + 0.5 // ~9s breath cycle
    const gap = 0.1 + breath * 0.16 + state.scroll * 1.3

    // pointer parallax
    const px = pointer.moved ? pointer.nx : 0
    const py = pointer.moved ? pointer.ny : 0
    rotY += (px * 0.32 - rotY) * 0.04
    rotX += (-py * 0.08 - rotX) * 0.04
    cairn.rotation.y = rotY + t * 0.04 + state.scroll * 0.9
    cairn.rotation.x = rotX

    // stack
    let y = 0
    const heights = stones.map((s) => s.spec.size[1])
    const totalH = heights.reduce((a, b) => a + b * 2, 0) + gap * (stones.length - 1)
    y = -totalH / 2
    let heatSum = 0
    stones.forEach((s, i) => {
      const h = s.spec.size[1]
      y += h
      const bob = reduced ? 0 : Math.sin(t * 0.8 + s.bob) * 0.025
      const introOffset = s.intro * (4.5 + i * 0.9)
      s.holder.position.y = y + bob + introOffset + s.hop * 0.18
      s.holder.position.x = Math.sin(t * 0.3 + i) * 0.03 * (1 + state.scroll * 6) * (i % 2 ? 1 : -1)
      s.holder.rotation.y += s.spin * dt * (1 + state.scroll * 3)
      s.holder.rotation.z = Math.sin(t * 0.5 + s.bob) * 0.02 + s.hop * 0.08
      s.mesh.material.opacity = 1
      y += h + gap

      // heat: warms fast under the hand, cools slowly like real stone
      const want = i === hovered ? 1 : 0
      if (want) s.heat += (1 - s.heat) * Math.min(1, heatDt * 2.4)
      else if (state.introDone || reduced) s.heat += (0 - s.heat) * Math.min(1, heatDt * 0.45)
      s.mesh.material.userData.heat.value = s.heat
      heatSum += s.heat
    })

    const avgHeat = heatSum / stones.length
    shadow.position.y = -totalH / 2 - 0.55
    glow.position.y = shadow.position.y + 0.01
    shadow.material.uniforms.uOpacity.value = 0.55 * (1 - stones[0].intro) * (1 - state.scroll)
    glow.material.uniforms.uOpacity.value = avgHeat * 0.45 * (1 - state.scroll)
    rim.intensity = 0.5 + avgHeat * 3.2
    if (motes) motes.material.uniforms.uHeat.value = avgHeat * (1 - state.scroll)

    renderer.render(scene, camera)
  }

  const start = () => {
    if (state.running) return
    state.running = true
    last = performance.now()
    rafId = requestAnimationFrame(render)
  }
  const stop = () => {
    state.running = false
    cancelAnimationFrame(rafId)
  }

  // pause when off-screen, covered by the menu / booking drawer, or the tab is hidden
  const overlays = new Set()
  const sync = () => (state.visible && !overlays.size && !document.hidden ? start() : stop())
  const io = new IntersectionObserver(([entry]) => {
    state.visible = entry.isIntersecting
    sync()
  })
  io.observe(canvas)
  document.addEventListener('visibilitychange', sync)
  document.addEventListener('overlay', (e) => {
    e.detail.open ? overlays.add(e.detail.source) : overlays.delete(e.detail.source)
    // let the opening transition finish over a live frame, then rest
    setTimeout(sync, e.detail.open ? 900 : 0)
  })

  // compile shaders off the main thread where supported, then draw a first frame
  const ready = (renderer.compileAsync ? renderer.compileAsync(scene, camera) : Promise.resolve())
    .catch(() => {})
    .then(() => renderer.render(scene, camera))

  return {
    ready,
    playIntro,
    setScroll(p) {
      state.scroll = p
    },
    warm(index, amount = 1) {
      if (stones[index]) stones[index].heat = Math.max(stones[index].heat, amount)
    },
    get pointerInside() {
      return pointerInside
    },
    destroy() {
      stop()
      io.disconnect()
      window.removeEventListener('resize', layout)
      renderer.dispose()
    },
  }
}
