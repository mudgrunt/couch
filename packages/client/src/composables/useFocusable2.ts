import {
  ref,
  onMounted,
  onUnmounted,
  watch,
  toValue,
  type Ref,
  type MaybeRefOrGetter,
  inject,
} from 'vue'
import {
  SpatialNavigation,
  ROOT_FOCUS_KEY,
  type FocusableComponentLayout,
  type FocusDetails,
  type KeyPressDetails,
  type Direction,
} from '@noriginmedia/norigin-spatial-navigation-core'

export const FocusContextKey = Symbol('FocusContext')

export type EnterPressHandler<P = object> = (
  props: P | undefined,
  details?: KeyPressDetails,
) => void

export type EnterReleaseHandler<P = object> = (props: P | undefined) => void

export type ArrowPressHandler<P = object> = (
  direction: string,
  props: P | undefined,
  details?: KeyPressDetails,
) => boolean

export type ArrowReleaseHandler<P = object> = (direction: string, props: P | undefined) => void

export type FocusHandler<P = object> = (
  layout: FocusableComponentLayout,
  props: P | undefined,
  details: FocusDetails,
) => void

export type BlurHandler<P = object> = (
  layout: FocusableComponentLayout,
  props: P | undefined,
  details: FocusDetails,
) => void

export interface UseFocusableConfig<P = object> {
  focusable?: boolean
  saveLastFocusedChild?: boolean
  trackChildren?: boolean
  autoRestoreFocus?: boolean
  forceFocus?: boolean
  isFocusBoundary?: boolean
  focusBoundaryDirections?: Direction[]
  focusKey?: string
  preferredChildFocusKey?: string
  onEnterPress?: EnterPressHandler<P>
  onEnterRelease?: EnterReleaseHandler<P>
  onArrowPress?: ArrowPressHandler<P>
  onArrowRelease?: ArrowReleaseHandler<P>
  onFocus?: FocusHandler<P>
  onBlur?: BlurHandler<P>
  extraProps?: P
  accessibilityLabel?: string
}

export interface UseFocusableResult<E = HTMLElement> {
  ref: Ref<E | null>
  focusSelf: (focusDetails?: FocusDetails) => void
  focused: Ref<boolean>
  hasFocusedChild: Ref<boolean>
  focusKey: string
}

export function useFocusable<P = object, E = HTMLElement>(
  config: MaybeRefOrGetter<UseFocusableConfig<P>> = {},
): UseFocusableResult<E> {
  const initialConfig = toValue(config)
  const elRef = ref(null) as Ref<E | null>
  const focused = ref(false)
  const hasFocusedChild = ref(false)
  const parentFocusKey = inject<string>(FocusContextKey, ROOT_FOCUS_KEY)
  const focusKey = initialConfig.focusKey || uniqueId('sn:focusable-item-')

  const focusSelf = (focusDetails: FocusDetails = {}) => {
    SpatialNavigation.setFocus(focusKey, focusDetails)
  }

  const resolveConfig = () => toValue(config)

  // Stable handler closures that always read the latest config on each invocation,
  // equivalent to the useCallback pattern used in the original React hook.
  const onEnterPressHandler = (details?: KeyPressDetails) => {
    const c = resolveConfig()
    c.onEnterPress?.(c.extraProps, details)
  }

  const onEnterReleaseHandler = () => {
    const c = resolveConfig()
    c.onEnterRelease?.(c.extraProps)
  }

  const onArrowPressHandler = (direction: string, details?: KeyPressDetails) => {
    const c = resolveConfig()
    return c.onArrowPress?.(direction, c.extraProps, details) ?? true
  }

  const onArrowReleaseHandler = (direction: string) => {
    const c = resolveConfig()
    c.onArrowRelease?.(direction, c.extraProps)
  }

  const onFocusHandler = (layout: FocusableComponentLayout, details: FocusDetails) => {
    const c = resolveConfig()
    c.onFocus?.(layout, c.extraProps, details)
  }

  const onBlurHandler = (layout: FocusableComponentLayout, details: FocusDetails) => {
    const c = resolveConfig()
    c.onBlur?.(layout, c.extraProps, details)
  }

  onMounted(() => {
    const c = resolveConfig()
    SpatialNavigation.addFocusable({
      focusKey,
      node: elRef.value as HTMLElement,
      parentFocusKey,
      preferredChildFocusKey: c.preferredChildFocusKey,
      onEnterPress: onEnterPressHandler,
      onEnterRelease: onEnterReleaseHandler,
      onArrowPress: onArrowPressHandler,
      onArrowRelease: onArrowReleaseHandler,
      onFocus: onFocusHandler,
      onBlur: onBlurHandler,
      onUpdateFocus: (isFocused = false) => {
        focused.value = isFocused
      },
      onUpdateHasFocusedChild: (isFocused = false) => (hasFocusedChild.value = isFocused),
      saveLastFocusedChild: c.saveLastFocusedChild ?? true,
      trackChildren: c.trackChildren ?? false,
      isFocusBoundary: c.isFocusBoundary ?? false,
      focusBoundaryDirections: c.focusBoundaryDirections,
      autoRestoreFocus: c.autoRestoreFocus ?? true,
      forceFocus: c.forceFocus ?? false,
      focusable: c.focusable ?? true,
      accessibilityLabel: c.accessibilityLabel,
    })
  })

  onUnmounted(() => {
    SpatialNavigation.removeFocusable({ focusKey })
  })

  watch(
    () => toValue(config),
    () => {
      const c = resolveConfig()
      SpatialNavigation.updateFocusable(focusKey, {
        node: elRef.value as HTMLElement,
        preferredChildFocusKey: c.preferredChildFocusKey,
        focusable: c.focusable ?? true,
        isFocusBoundary: c.isFocusBoundary ?? false,
        focusBoundaryDirections: c.focusBoundaryDirections,
        onEnterPress: onEnterPressHandler,
        onEnterRelease: onEnterReleaseHandler,
        onArrowPress: onArrowPressHandler,
        onArrowRelease: onArrowReleaseHandler,
        onFocus: onFocusHandler,
        onBlur: onBlurHandler,
        accessibilityLabel: c.accessibilityLabel,
      })
    },
    { deep: true },
  )

  return {
    ref: elRef,
    focusSelf,
    focused,
    hasFocusedChild,
    focusKey,
  }
}

let idCounter = 0

function uniqueId(prefix?: string | null): string {
  const id = ++idCounter
  return String(prefix == null ? '' : prefix) + id
}
