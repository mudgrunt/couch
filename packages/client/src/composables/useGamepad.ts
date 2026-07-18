import { onMounted, onUnmounted } from 'vue'

export type ControllerType = 'xbox' | 'playstation' | 'nintendo' | 'steam' | 'generic'

export const StandardButton = {
  SOUTH: 0,
  EAST: 1,
  WEST: 2,
  NORTH: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  SELECT: 8,
  START: 9,
  L3: 10,
  R3: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
  HOME: 16,
} as const

export type StandardButtonName = keyof typeof StandardButton

export const StandardAxis = {
  LEFT_X: 0,
  LEFT_Y: 1,
  RIGHT_X: 2,
  RIGHT_Y: 3,
} as const

export type StandardAxisName = keyof typeof StandardAxis

// precomputed O(1) reverse lookups
const BUTTON_NAME_MAP: (StandardButtonName | 'UNKNOWN')[] = Array(17).fill('UNKNOWN')
Object.entries(StandardButton).forEach(([name, index]) => {
  BUTTON_NAME_MAP[index] = name as StandardButtonName
})

const AXIS_NAME_MAP: (StandardAxisName | 'UNKNOWN')[] = Array(4).fill('UNKNOWN')
Object.entries(StandardAxis).forEach(([name, index]) => {
  AXIS_NAME_MAP[index] = name as StandardAxisName
})

const resolveButtonName = (index: number): StandardButtonName | 'UNKNOWN' =>
  BUTTON_NAME_MAP[index] ?? 'UNKNOWN'

const resolveAxisName = (index: number): StandardAxisName | 'UNKNOWN' =>
  AXIS_NAME_MAP[index] ?? 'UNKNOWN'

const ANALOG_BUTTONS = new Set<number>([StandardButton.LT, StandardButton.RT])

const DEADZONE = 0.1
const CHANGE_THRESHOLD = 0.05
const TRIGGER_THRESHOLD = 0.02

export interface GamepadButtonState {
  pressed: boolean
  value: number
}

export interface GamepadConnectEvent {
  gamepadIndex: number
  gamepad: Gamepad
  type: ControllerType
}

export interface GamepadDisconnectEvent {
  gamepadIndex: number
}

export interface GamepadButtonEvent {
  gamepadIndex: number
  buttonIndex: number
  button: StandardButtonName | 'UNKNOWN'
  pressed: boolean
  value: number
}

export interface GamepadAxisEvent {
  gamepadIndex: number
  axisIndex: number
  axis: StandardAxisName | 'UNKNOWN'
  value: number
}

export interface GamepadSnapshotEvent {
  gamepadIndex: number
  axes: number[]
  buttons: GamepadButtonState[]
  timestamp: number
}

export function useGamepad() {
  let rafId: number | null = null
  let isPolling = false

  const prevButtons = new Map<number, GamepadButtonState[]>()
  const prevAxes = new Map<number, number[]>()

  const connectHandlers = new Set<(e: GamepadConnectEvent) => void>()
  const disconnectHandlers = new Set<(e: GamepadDisconnectEvent) => void>()
  const buttonHandlers = new Set<(e: GamepadButtonEvent) => void>()
  const axisHandlers = new Set<(e: GamepadAxisEvent) => void>()
  const snapshotHandlers = new Set<(e: GamepadSnapshotEvent) => void>()

  const onConnect = (h: (e: GamepadConnectEvent) => void) => {
    connectHandlers.add(h)
    return () => connectHandlers.delete(h)
  }

  const onDisconnect = (h: (e: GamepadDisconnectEvent) => void) => {
    disconnectHandlers.add(h)
    return () => disconnectHandlers.delete(h)
  }

  const onButton = (
    handler: (e: GamepadButtonEvent) => void,
    options?: {
      button?: StandardButtonName | StandardButtonName[]
      pressed?: boolean
    },
  ) => {
    const filtered = (e: GamepadButtonEvent) => {
      if (options?.button) {
        const buttons = Array.isArray(options.button) ? options.button : [options.button]
        if (!buttons.includes(e.button as StandardButtonName)) return
      }
      if (options?.pressed !== undefined && e.pressed !== options.pressed) return
      handler(e)
    }
    buttonHandlers.add(filtered)
    return () => buttonHandlers.delete(filtered)
  }

  const onAxis = (
    handler: (e: GamepadAxisEvent) => void,
    options?: {
      axis?: StandardAxisName | StandardAxisName[]
    },
  ) => {
    const filtered = (e: GamepadAxisEvent) => {
      if (options?.axis) {
        const axes = Array.isArray(options.axis) ? options.axis : [options.axis]
        if (!axes.includes(e.axis as StandardAxisName)) return
      }
      handler(e)
    }
    axisHandlers.add(filtered)
    return () => axisHandlers.delete(filtered)
  }

  const onSnapshot = (h: (e: GamepadSnapshotEvent) => void) => {
    snapshotHandlers.add(h)
    return () => snapshotHandlers.delete(h)
  }

  const detectControllerType = (gamepad: Gamepad): ControllerType => {
    const id = gamepad.id.toLowerCase()
    if (id.includes('28de') || id.includes('valve') || id.includes('steam')) return 'steam'
    if (id.includes('045e') || id.includes('xbox')) return 'xbox'
    if (
      id.includes('054c') ||
      id.includes('dualsense') ||
      id.includes('dualshock') ||
      id.includes('sony') ||
      id.includes('playstation')
    )
      return 'playstation'
    if (
      id.includes('057e') ||
      id.includes('switch') ||
      id.includes('pro controller') ||
      id.includes('joy-con') ||
      id.includes('nintendo')
    )
      return 'nintendo'
    return 'generic'
  }

  const initGamepadState = (gamepad: Gamepad) => {
    prevButtons.set(
      gamepad.index,
      gamepad.buttons.map((b) => ({ pressed: b.pressed, value: b.value })),
    )
    prevAxes.set(
      gamepad.index,
      [...gamepad.axes].map((v) => (Math.abs(v) < DEADZONE ? 0 : v)),
    )
  }

  const poll = (timestamp: number) => {
    // self-check — exits cleanly if blur fired mid-frame
    if (!isPolling) return

    const gamepads = navigator.getGamepads()

    for (const gamepad of gamepads) {
      if (!gamepad) continue
      if (gamepad.mapping !== 'standard') continue

      // cold boot defensive guard — initialize with real hardware state
      if (!prevButtons.has(gamepad.index)) {
        initGamepadState(gamepad)
      }

      const prevButtons_ = prevButtons.get(gamepad.index)!
      const prevAxes_ = prevAxes.get(gamepad.index)!

      // --- button diffing ---
      const currentButtons: GamepadButtonState[] = gamepad.buttons.map((b) => ({
        pressed: b.pressed,
        value: b.value,
      }))

      currentButtons.forEach(({ pressed, value }, buttonIndex) => {
        const prev = prevButtons_[buttonIndex]
        const isAnalog = ANALOG_BUTTONS.has(buttonIndex)

        const pressedChanged = pressed !== prev?.pressed
        const valueChanged =
          isAnalog && (pressedChanged || Math.abs(value - (prev?.value ?? 0)) > TRIGGER_THRESHOLD)

        if (pressedChanged || valueChanged) {
          buttonHandlers.forEach((h) =>
            h({
              gamepadIndex: gamepad.index,
              buttonIndex,
              button: resolveButtonName(buttonIndex),
              pressed,
              value,
            }),
          )
        }
      })

      prevButtons.set(gamepad.index, currentButtons)

      // --- axis diffing ---
      const currentAxes = [...gamepad.axes]
      const processedAxes: number[] = []

      currentAxes.forEach((value, axisIndex) => {
        const deadzonedValue = Math.abs(value) < DEADZONE ? 0 : value
        const prevProcessed = prevAxes_[axisIndex] ?? 0

        if (Math.abs(deadzonedValue - prevProcessed) > CHANGE_THRESHOLD) {
          axisHandlers.forEach((h) =>
            h({
              gamepadIndex: gamepad.index,
              axisIndex,
              axis: resolveAxisName(axisIndex),
              value: deadzonedValue,
            }),
          )
        }

        processedAxes.push(deadzonedValue)
      })

      prevAxes.set(gamepad.index, processedAxes)

      // --- snapshot — always emit, consumer decides ---
      snapshotHandlers.forEach((h) =>
        h({
          gamepadIndex: gamepad.index,
          axes: currentAxes,
          buttons: currentButtons,
          timestamp,
        }),
      )
    }

    rafId = requestAnimationFrame(poll)
  }

  const handleConnect = (e: GamepadEvent) => {
    if (e.gamepad.mapping !== 'standard') return
    const type = detectControllerType(e.gamepad)
    initGamepadState(e.gamepad)
    connectHandlers.forEach((h) => h({ gamepadIndex: e.gamepad.index, gamepad: e.gamepad, type }))
  }

  const handleDisconnect = (e: GamepadEvent) => {
    prevButtons.delete(e.gamepad.index)
    prevAxes.delete(e.gamepad.index)
    disconnectHandlers.forEach((h) => h({ gamepadIndex: e.gamepad.index }))
  }

  const handleBlur = () => {
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
    isPolling = false
    prevButtons.clear()
    prevAxes.clear()
  }

  const handleFocus = () => {
    if (isPolling) return
    isPolling = true
    rafId = requestAnimationFrame(poll)
  }

  const start = () => {
    window.addEventListener('gamepadconnected', handleConnect)
    window.addEventListener('gamepaddisconnected', handleDisconnect)
    window.addEventListener('blur', handleBlur)
    window.addEventListener('focus', handleFocus)
    isPolling = true
    rafId = requestAnimationFrame(poll)
  }

  const stop = () => {
    window.removeEventListener('gamepadconnected', handleConnect)
    window.removeEventListener('gamepaddisconnected', handleDisconnect)
    window.removeEventListener('blur', handleBlur)
    window.removeEventListener('focus', handleFocus)
    if (rafId !== null) cancelAnimationFrame(rafId)
    rafId = null
    isPolling = false
    prevButtons.clear()
    prevAxes.clear()
  }

  onMounted(start)
  onUnmounted(stop)

  return {
    onConnect,
    onDisconnect,
    onButton,
    onAxis,
    onSnapshot,
  }
}
