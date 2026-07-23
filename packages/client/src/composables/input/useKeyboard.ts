import { onMounted, onUnmounted } from 'vue'

export interface KeyboardKeyEvent {
  code: string
  key: string
  pressed: boolean
  timestamp: number
}
export interface KeyboardSnapshotEvent {
  keys: Set<string>
  timestamp: number
}

export function useKeyboard() {
  const activeKeys = new Set<string>()

  const keyHandlers = new Set<(e: KeyboardKeyEvent) => void>()
  const snapshotHandlers = new Set<(e: KeyboardSnapshotEvent) => void>()

  const onKey = (
    handler: (e: KeyboardKeyEvent) => void,
    options?: {
      key?: string | string[]
      pressed?: boolean
    },
  ) => {
    const filtered = (e: KeyboardKeyEvent) => {
      if (options?.key) {
        const keys = Array.isArray(options.key) ? options.key : [options.key]
        if (!keys.includes(e.key)) return
      }
      if (options?.pressed !== undefined && e.pressed !== options.pressed) return
      handler(e)
    }
    keyHandlers.add(filtered)
    return () => keyHandlers.delete(filtered)
  }

  const onSnapshot = (h: (e: KeyboardSnapshotEvent) => void) => {
    snapshotHandlers.add(h)
    return () => snapshotHandlers.delete(h)
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.repeat) return
    activeKeys.add(e.code)
  }

  const handleKeyup = (e: KeyboardEvent) => {
    activeKeys.delete(e.code)
  }

  const handleBlur = () => {
    activeKeys.clear()
  }

  const start = () => {
    window.addEventListener('keydown', handleKeydown)
    window.addEventListener('keyup', handleKeyup)
    window.addEventListener('blur', handleBlur)
  }

  const stop = () => {
    window.removeEventListener('keydown', handleKeydown)
    window.removeEventListener('keyup', handleKeyup)
    window.removeEventListener('blur', handleBlur)
    activeKeys.clear()
  }

  onMounted(start)
  onUnmounted(stop)

  return {
    onKey,
    onSnapshot,
  }
}
