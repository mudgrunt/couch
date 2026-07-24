import { onMounted, onUnmounted } from 'vue'

export interface KeyboardKeyEvent {
  code: string
  key: string
  pressed: boolean
  shift: boolean
  ctrl: boolean
  alt: boolean
  meta: boolean
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
      code?: string | string[]
      pressed?: boolean
      modifiers?: {
        shift?: boolean
        ctrl?: boolean
        alt?: boolean
        meta?: boolean
      }
    },
  ) => {
    const filtered = (e: KeyboardKeyEvent) => {
      if (options?.code) {
        const codes = Array.isArray(options.code) ? options.code : [options.code]
        if (!codes.includes(e.code)) return
      }
      if (options?.pressed !== undefined && e.pressed !== options.pressed) return
      if (options?.modifiers) {
        if (options.modifiers.shift !== undefined && e.shift !== options.modifiers.shift) return
        if (options.modifiers.ctrl !== undefined && e.ctrl !== options.modifiers.ctrl) return
        if (options.modifiers.alt !== undefined && e.alt !== options.modifiers.alt) return
        if (options.modifiers.meta !== undefined && e.meta !== options.modifiers.meta) return
      }
      handler(e)
    }
    keyHandlers.add(filtered)
    return () => keyHandlers.delete(filtered)
  }

  const onSnapshot = (h: (e: KeyboardSnapshotEvent) => void) => {
    snapshotHandlers.add(h)
    return () => snapshotHandlers.delete(h)
  }

  const emit = (e: KeyboardEvent, pressed: boolean) => {
    const event: KeyboardKeyEvent = {
      code: e.code,
      key: e.key,
      pressed,
      shift: e.shiftKey,
      ctrl: e.ctrlKey,
      alt: e.altKey,
      meta: e.metaKey,
      timestamp: e.timeStamp,
    }

    keyHandlers.forEach((h) => h(event))
    snapshotHandlers.forEach((h) =>
      h({
        keys: new Set(activeKeys),
        timestamp: event.timestamp,
      }),
    )
  }

  const handleKeydown = (e: KeyboardEvent) => {
    if (e.repeat) return
    activeKeys.add(e.code)
    emit(e, true)
  }

  const handleKeyup = (e: KeyboardEvent) => {
    if (!activeKeys.has(e.code)) return
    activeKeys.delete(e.code)
    emit(e, false)
  }

  const handleBlur = () => {
    activeKeys.clear()
    snapshotHandlers.forEach((h) =>
      h({
        keys: new Set(activeKeys),
        timestamp: performance.now(),
      }),
    )
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
