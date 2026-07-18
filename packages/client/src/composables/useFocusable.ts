import {
  ref,
  computed,
  onMounted,
  onUnmounted,
  watch,
  toValue,
  type Ref,
  type ShallowRef,
  type MaybeRefOrGetter,
  shallowRef,
} from 'vue'

import {
  SpatialNavigation,
  type FocusableComponentLayout,
  type FocusDetails,
  type KeyPressDetails,
  type Direction,
} from '@noriginmedia/norigin-spatial-navigation-core'

import { uniqueId } from 'lodash-es'
import { useFocusContext } from './useFocusContext'

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

export interface UseFocusableResult<E extends HTMLElement = HTMLElement> {
  ref: ShallowRef<E | null>
  focusSelf: (focusDetails?: FocusDetails) => void
  focused: Ref<boolean>
  hasFocusedChild: Ref<boolean>
  focusKey: string
}

export function useFocusable<P = object, E extends HTMLElement = HTMLElement>(
  config: MaybeRefOrGetter<UseFocusableConfig<P>> = {},
): UseFocusableResult<E> {
  const elRef = shallowRef<E | null>(null)
  const focused = ref(false)
  const hasFocusedChild = ref(false)

  const parentFocusKey = useFocusContext()
  const focusKey = toValue(config).focusKey ?? uniqueId('sn:focusable-item-')

  let isRegistered = false

  const focusSelf = (focusDetails: FocusDetails = {}) => {
    SpatialNavigation.setFocus(focusKey, focusDetails)
  }

  const resolvedConfig = computed(() => {
    const c = toValue(config)
    return {
      focusable: c.focusable ?? true,
      saveLastFocusedChild: c.saveLastFocusedChild ?? true,
      trackChildren: c.trackChildren ?? false,
      autoRestoreFocus: c.autoRestoreFocus ?? true,
      forceFocus: c.forceFocus ?? false,
      isFocusBoundary: c.isFocusBoundary ?? false,
      focusBoundaryDirections: c.focusBoundaryDirections,
      preferredChildFocusKey: c.preferredChildFocusKey,
      accessibilityLabel: c.accessibilityLabel,
      extraProps: c.extraProps,
      onEnterPress: c.onEnterPress,
      onEnterRelease: c.onEnterRelease,
      onArrowPress: c.onArrowPress,
      onArrowRelease: c.onArrowRelease,
      onFocus: c.onFocus,
      onBlur: c.onBlur,
    }
  })

  const onEnterPressHandler = (details?: KeyPressDetails) => {
    resolvedConfig.value.onEnterPress?.(resolvedConfig.value.extraProps, details)
  }

  const onEnterReleaseHandler = () => {
    resolvedConfig.value.onEnterRelease?.(resolvedConfig.value.extraProps)
  }

  const onArrowPressHandler = (direction: string, details?: KeyPressDetails) => {
    return (
      resolvedConfig.value.onArrowPress?.(direction, resolvedConfig.value.extraProps, details) ??
      true
    )
  }

  const onArrowReleaseHandler = (direction: string) => {
    resolvedConfig.value.onArrowRelease?.(direction, resolvedConfig.value.extraProps)
  }

  const onFocusHandler = (layout: FocusableComponentLayout, details: FocusDetails) => {
    resolvedConfig.value.onFocus?.(layout, resolvedConfig.value.extraProps, details)
  }

  const onBlurHandler = (layout: FocusableComponentLayout, details: FocusDetails) => {
    resolvedConfig.value.onBlur?.(layout, resolvedConfig.value.extraProps, details)
  }

  const onUpdateFocus = (isFocused = false) => {
    focused.value = isFocused
  }

  const onUpdateHasFocusedChild = (isFocused = false) => {
    hasFocusedChild.value = isFocused
  }

  const addFocusable = (node: E) => {
    SpatialNavigation.addFocusable({
      focusKey,
      node,
      parentFocusKey: parentFocusKey.value,
      preferredChildFocusKey: resolvedConfig.value.preferredChildFocusKey,
      onEnterPress: onEnterPressHandler,
      onEnterRelease: onEnterReleaseHandler,
      onArrowPress: onArrowPressHandler,
      onArrowRelease: onArrowReleaseHandler,
      onFocus: onFocusHandler,
      onBlur: onBlurHandler,
      onUpdateFocus,
      onUpdateHasFocusedChild,
      saveLastFocusedChild: resolvedConfig.value.saveLastFocusedChild,
      trackChildren: resolvedConfig.value.trackChildren,
      isFocusBoundary: resolvedConfig.value.isFocusBoundary,
      focusBoundaryDirections: resolvedConfig.value.focusBoundaryDirections,
      autoRestoreFocus: resolvedConfig.value.autoRestoreFocus,
      forceFocus: resolvedConfig.value.forceFocus,
      focusable: resolvedConfig.value.focusable,
      accessibilityLabel: resolvedConfig.value.accessibilityLabel,
    })
    isRegistered = true
  }

  const updateFocusable = (node: E) => {
    SpatialNavigation.updateFocusable(focusKey, {
      node,
      preferredChildFocusKey: resolvedConfig.value.preferredChildFocusKey,
      focusable: resolvedConfig.value.focusable,
      isFocusBoundary: resolvedConfig.value.isFocusBoundary,
      focusBoundaryDirections: resolvedConfig.value.focusBoundaryDirections,
      onEnterPress: onEnterPressHandler,
      onEnterRelease: onEnterReleaseHandler,
      onArrowPress: onArrowPressHandler,
      onArrowRelease: onArrowReleaseHandler,
      onFocus: onFocusHandler,
      onBlur: onBlurHandler,
      accessibilityLabel: resolvedConfig.value.accessibilityLabel,
    })
  }

  onMounted(() => {
    if (!elRef.value) {
      console.warn(
        `[useFocusable] ref is null on mount for focusKey "${focusKey}". ` +
          `Ensure :ref is bound in your template.`,
      )
      return
    }
    addFocusable(elRef.value)
  })

  onUnmounted(() => {
    SpatialNavigation.removeFocusable({ focusKey })
    isRegistered = false
  })

  watch(
    [elRef, resolvedConfig],
    () => {
      const node = elRef.value

      if (!node) {
        if (isRegistered) {
          SpatialNavigation.removeFocusable({ focusKey })
          isRegistered = false
        }
        return
      }

      if (isRegistered) {
        updateFocusable(node)
      } else {
        addFocusable(node)
      }
    },
    { flush: 'post' },
  )

  return {
    ref: elRef as ShallowRef<E | null>,
    focusSelf,
    focused,
    hasFocusedChild,
    focusKey,
  }
}
