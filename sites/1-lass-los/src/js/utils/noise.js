// Compact 3D simplex noise (after Stefan Gustavson's public-domain reference).
const grad3 = new Float32Array([
  1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1,
])

export function createNoise3D(seed = 1) {
  const perm = new Uint8Array(512)
  const p = new Uint8Array(256)
  let s = seed >>> 0 || 1
  const rand = () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
  for (let i = 0; i < 256; i++) p[i] = i
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[p[i], p[j]] = [p[j], p[i]]
  }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255]

  const F3 = 1 / 3
  const G3 = 1 / 6

  return function noise3D(x, y, z) {
    const sk = (x + y + z) * F3
    const i = Math.floor(x + sk)
    const j = Math.floor(y + sk)
    const k = Math.floor(z + sk)
    const t = (i + j + k) * G3
    const x0 = x - (i - t)
    const y0 = y - (j - t)
    const z0 = z - (k - t)
    let i1, j1, k1, i2, j2, k2
    if (x0 >= y0) {
      if (y0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 1, 0]
      else if (x0 >= z0) [i1, j1, k1, i2, j2, k2] = [1, 0, 0, 1, 0, 1]
      else [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 1, 0, 1]
    } else {
      if (y0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 0, 1, 0, 1, 1]
      else if (x0 < z0) [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 0, 1, 1]
      else [i1, j1, k1, i2, j2, k2] = [0, 1, 0, 1, 1, 0]
    }
    const x1 = x0 - i1 + G3
    const y1 = y0 - j1 + G3
    const z1 = z0 - k1 + G3
    const x2 = x0 - i2 + 2 * G3
    const y2 = y0 - j2 + 2 * G3
    const z2 = z0 - k2 + 2 * G3
    const x3 = x0 - 1 + 3 * G3
    const y3 = y0 - 1 + 3 * G3
    const z3 = z0 - 1 + 3 * G3
    const ii = i & 255
    const jj = j & 255
    const kk = k & 255
    const corner = (gi, xx, yy, zz) => {
      let tt = 0.6 - xx * xx - yy * yy - zz * zz
      if (tt < 0) return 0
      const g = (gi % 12) * 3
      tt *= tt
      return tt * tt * (grad3[g] * xx + grad3[g + 1] * yy + grad3[g + 2] * zz)
    }
    const n0 = corner(perm[ii + perm[jj + perm[kk]]], x0, y0, z0)
    const n1 = corner(perm[ii + i1 + perm[jj + j1 + perm[kk + k1]]], x1, y1, z1)
    const n2 = corner(perm[ii + i2 + perm[jj + j2 + perm[kk + k2]]], x2, y2, z2)
    const n3 = corner(perm[ii + 1 + perm[jj + 1 + perm[kk + 1]]], x3, y3, z3)
    return 32 * (n0 + n1 + n2 + n3)
  }
}

export function createNoise2D(seed = 1) {
  const n3 = createNoise3D(seed)
  return (x, y) => n3(x, y, 0.5)
}
