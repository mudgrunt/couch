import { ref, readonly } from 'vue'

export type InputSource = 'keyboard' | 'gamepad'

const inputSource = ref<InputSource>('keyboard')

let cleanup: (() => void) | null = null

export function useInputSource() {
  return {
    source: readonly(inputSource),
  }
}

export function setupInputDetection() {
  if (cleanup) return cleanup
  if (typeof window === 'undefined') return () => {}

  const setKeyboard = () => {
    if (inputSource.value !== 'keyboard') inputSource.value = 'keyboard'
  }

  window.addEventListener('mousemove', setKeyboard, { passive: true })
  window.addEventListener('keydown', setKeyboard, { passive: true })
  window.addEventListener('mousedown', setKeyboard, { passive: true })
  window.addEventListener('wheel', setKeyboard, { passive: true })

  let rafId: number
  function poll() {
    const gamepads = navigator.getGamepads()
    for (const gp of gamepads) {
      if (!gp) continue
      let active = false
      for (const b of gp.buttons) {
        if (b.pressed) active = true
      }
      for (const a of gp.axes) {
        if (Math.abs(a) > 0.2) active = true
      }
      if (active && inputSource.value !== 'gamepad') {
        inputSource.value = 'gamepad'
      }
    }
    rafId = requestAnimationFrame(poll)
  }
  rafId = requestAnimationFrame(poll)

  cleanup = () => {
    window.removeEventListener('mousemove', setKeyboard)
    window.removeEventListener('keydown', setKeyboard)
    window.removeEventListener('mousedown', setKeyboard)
    window.removeEventListener('wheel', setKeyboard)
    cancelAnimationFrame(rafId)
    cleanup = null
  }

  return cleanup
}
