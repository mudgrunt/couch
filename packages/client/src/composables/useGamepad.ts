import { onMounted, onUnmounted } from 'vue'
import { SpatialNavigation } from '@noriginmedia/norigin-spatial-navigation-core'

export type Direction = 'up' | 'down' | 'left' | 'right'
export type ActionButton = 'confirm' | 'back'

export interface GamepadHandlers {
  onAction?: (btn: ActionButton) => void
  onScroll?: (dx: number, dy: number) => void
}

// rAF is the correct poll mechanism: the browser refreshes gamepad state
// synchronously before each rAF callback. setInterval can stack up when the
// main thread is busy, causing the same state to be read multiple times.
const INITIAL_DELAY = 300
const REPEAT_INTERVAL = 80
const STICK_PRESS_THRESHOLD = 0.65
const STICK_RELEASE_THRESHOLD = 0.35
const BUTTON_PRESS_THRESHOLD = 0.5
// Right stick: ignore small deflections to avoid drift noise, scale px/frame
const SCROLL_DEADZONE = 0.12
const SCROLL_SPEED = 20

const ALL_DIRS: Direction[] = ['up', 'down', 'left', 'right']
const ALL_ACTIONS: ActionButton[] = ['confirm', 'back']

function isButtonPressed(gp: Gamepad, index: number): boolean {
  const button = gp.buttons[index]
  return Boolean(button?.pressed || (button?.value ?? 0) >= BUTTON_PRESS_THRESHOLD)
}

function getAxisDirection(value: number, negativeWasActive: boolean, positiveWasActive: boolean) {
  const negativeActive = negativeWasActive
    ? value <= -STICK_RELEASE_THRESHOLD
    : value <= -STICK_PRESS_THRESHOLD
  const positiveActive = positiveWasActive
    ? value >= STICK_RELEASE_THRESHOLD
    : value >= STICK_PRESS_THRESHOLD

  return {
    negativeActive,
    positiveActive,
  }
}

function getActiveDirections(gp: Gamepad, prevDirs: Map<Direction, boolean>): Set<Direction> {
  const dirs = new Set<Direction>()

  if (isButtonPressed(gp, 12)) dirs.add('up')
  if (isButtonPressed(gp, 13)) dirs.add('down')
  if (isButtonPressed(gp, 14)) dirs.add('left')
  if (isButtonPressed(gp, 15)) dirs.add('right')

  if (dirs.size > 0) return dirs

  const ax = gp.axes[0] ?? 0
  const ay = gp.axes[1] ?? 0

  const horizontal = getAxisDirection(
    ax,
    prevDirs.get('left') ?? false,
    prevDirs.get('right') ?? false,
  )
  const vertical = getAxisDirection(ay, prevDirs.get('up') ?? false, prevDirs.get('down') ?? false)

  const horizontalMagnitude = Math.abs(ax)
  const verticalMagnitude = Math.abs(ay)

  if (
    !horizontal.negativeActive &&
    !horizontal.positiveActive &&
    !vertical.negativeActive &&
    !vertical.positiveActive
  ) {
    return dirs
  }

  // Treat the left stick as one navigation source. This avoids diagonal drift or
  // slight off-axis deflection producing two direction presses in the same frame.
  if (horizontalMagnitude >= verticalMagnitude) {
    if (horizontal.negativeActive) dirs.add('left')
    else if (horizontal.positiveActive) dirs.add('right')
    else if (vertical.negativeActive) dirs.add('up')
    else if (vertical.positiveActive) dirs.add('down')
  } else {
    if (vertical.negativeActive) dirs.add('up')
    else if (vertical.positiveActive) dirs.add('down')
    else if (horizontal.negativeActive) dirs.add('left')
    else if (horizontal.positiveActive) dirs.add('right')
  }

  return dirs
}

function dispatchSpatialKey(type: 'keydown' | 'keyup', key: string, code: string, keyCode: number) {
  const event = new KeyboardEvent(type, {
    key,
    code,
    bubbles: true,
    cancelable: true,
  })

  for (const [name, value] of [
    ['keyCode', keyCode],
    ['which', keyCode],
  ] as const) {
    Object.defineProperty(event, name, {
      configurable: true,
      enumerable: true,
      get: () => value,
    })
  }

  window.dispatchEvent(event)
}

function resolveActiveGamepad(currentIndex: number | null): Gamepad | null {
  const gamepads = navigator.getGamepads()

  if (currentIndex !== null) {
    const active = gamepads[currentIndex]
    if (active?.connected) return active
  }

  for (const gp of gamepads) {
    if (gp?.connected) return gp
  }

  return null
}

export function useGamepad(handlers: GamepadHandlers) {
  let rafId: number
  let activeGamepadIndex: number | null = null
  let isPolling = false
  // Explicit previous-frame state — true rising-edge detection
  const prevDirs = new Map<Direction, boolean>()
  const prevActions = new Map<ActionButton, boolean>()
  // Hold-repeat timing
  const pressedAt = new Map<Direction, number>()
  const lastFired = new Map<Direction, number>()

  function poll(now: number) {
    const gamepad = resolveActiveGamepad(activeGamepadIndex)

    if (!gamepad) {
      for (const dir of ALL_DIRS) {
        prevDirs.set(dir, false)
      }
      for (const btn of ALL_ACTIONS) {
        prevActions.set(btn, false)
      }
      rafId = requestAnimationFrame(poll)
      return
    }

    activeGamepadIndex = gamepad.index

    const activeActions = new Set<ActionButton>()
    const activeDirs = getActiveDirections(gamepad, prevDirs)
    let scrollX = 0
    let scrollY = 0

    if (isButtonPressed(gamepad, 0)) activeActions.add('confirm')
    if (isButtonPressed(gamepad, 1)) activeActions.add('back')

    // Right stick: axes 2 (X) and 3 (Y)
    const rx = gamepad.axes[2] ?? 0
    const ry = gamepad.axes[3] ?? 0
    if (Math.abs(rx) > SCROLL_DEADZONE) scrollX = rx
    if (Math.abs(ry) > SCROLL_DEADZONE) scrollY = ry

    if (scrollX !== 0 || scrollY !== 0) {
      handlers.onScroll?.(scrollX * SCROLL_SPEED, scrollY * SCROLL_SPEED)
    }

    // Directions: fire on rising edge, then hold-repeat after initial delay
    for (const dir of ALL_DIRS) {
      const isDown = activeDirs.has(dir)
      const wasDown = prevDirs.get(dir) ?? false

      if (isDown && !wasDown) {
        // Rising edge — fire immediately
        pressedAt.set(dir, now)
        lastFired.set(dir, now)
        SpatialNavigation.navigateByDirection(dir)
      } else if (isDown && wasDown) {
        // Held — fire repeat once past initial delay
        const pt = pressedAt.get(dir) ?? now
        if (now - pt >= INITIAL_DELAY) {
          const lf = lastFired.get(dir) ?? now
          if (now - lf >= REPEAT_INTERVAL) {
            lastFired.set(dir, now)
            SpatialNavigation.navigateByDirection(dir)
          }
        }
      } else if (!isDown && wasDown) {
        // Falling edge — clean up
        pressedAt.delete(dir)
        lastFired.delete(dir)
      }

      prevDirs.set(dir, isDown)
    }

    // Actions: fire exactly once on rising edge, no repeat
    for (const btn of ALL_ACTIONS) {
      const isDown = activeActions.has(btn)
      const wasDown = prevActions.get(btn) ?? false
      if (isDown && !wasDown) {
        if (btn === 'confirm') {
          dispatchSpatialKey('keydown', 'Enter', 'Enter', 13)
        }
        handlers.onAction?.(btn)
      } else if (!isDown && wasDown && btn === 'confirm') {
        dispatchSpatialKey('keyup', 'Enter', 'Enter', 13)
      }

      prevActions.set(btn, isDown)
    }

    rafId = requestAnimationFrame(poll)
  }

  onMounted(() => {
    resume()
    window.addEventListener('blur', pause)
    window.addEventListener('focus', resume)
  })

  onUnmounted(() => {
    pause()
    window.removeEventListener('blur', pause)
    window.removeEventListener('focus', resume)
  })

  function pause() {
    if (!isPolling) {
      activeGamepadIndex = null
      prevDirs.clear()
      prevActions.clear()
      pressedAt.clear()
      lastFired.clear()
      return
    }

    cancelAnimationFrame(rafId)
    isPolling = false
    activeGamepadIndex = null
    prevDirs.clear()
    prevActions.clear()
    pressedAt.clear()
    lastFired.clear()
  }

  function resume() {
    if (isPolling) return

    isPolling = true
    rafId = requestAnimationFrame(poll)
  }
}
