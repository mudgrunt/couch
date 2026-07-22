import { onMounted, onUnmounted } from 'vue'

export interface KeyboardKeyEvent {}
export interface KeyboardSnapshotEvent {}

export function useKeyboard() {
  const activeKeys = new Set<string>()

  const keyHandlers = new Set<(e: KeyboardKeyEvent) => void>()
  const snapshotHandlers = new Set<(e: KeyboardSnapshotEvent) => void>()

  const onKey = () => {}
  const onSnapshot = () => {}

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
