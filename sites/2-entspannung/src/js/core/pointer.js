/** Shared pointer state. `active` is true for a hovering mouse or a finger that is down. */
export const pointer = { x: -9999, y: -9999, active: false, down: false, type: 'mouse' }

export function trackPointer() {
  const opts = { passive: true }
  window.addEventListener(
    'pointermove',
    (e) => {
      pointer.x = e.clientX
      pointer.y = e.clientY
      pointer.type = e.pointerType
      pointer.active = e.pointerType === 'mouse' || pointer.down
    },
    opts,
  )
  window.addEventListener(
    'pointerdown',
    (e) => {
      pointer.down = true
      pointer.x = e.clientX
      pointer.y = e.clientY
      pointer.type = e.pointerType
      pointer.active = true
    },
    opts,
  )
  const up = (e) => {
    pointer.down = false
    if (e.pointerType !== 'mouse') pointer.active = false
  }
  window.addEventListener('pointerup', up, opts)
  window.addEventListener('pointercancel', up, opts)
  document.documentElement.addEventListener('pointerleave', () => (pointer.active = false))
  window.addEventListener('blur', () => (pointer.active = false))
}
