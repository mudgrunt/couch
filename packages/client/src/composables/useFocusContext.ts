import {
  computed,
  inject,
  provide,
  toValue,
  type InjectionKey,
  type MaybeRefOrGetter,
  type ComputedRef,
} from 'vue'
import { ROOT_FOCUS_KEY } from '@noriginmedia/norigin-spatial-navigation-core'

export const FocusContextKey: InjectionKey<MaybeRefOrGetter<string>> = Symbol('FocusContext')

export function provideFocusContext(focusKey: MaybeRefOrGetter<string>) {
  provide(FocusContextKey, focusKey)
}

/** @internal */

export function useFocusContext(): ComputedRef<string> {
  const context = inject(FocusContextKey, ROOT_FOCUS_KEY)
  return computed(() => toValue(context))
}

// React
// import { useContext, createContext } from 'react'
// import { ROOT_FOCUS_KEY } from '@noriginmedia/norigin-spatial-navigation-core'

// export const FocusContext = createContext(ROOT_FOCUS_KEY)
// FocusContext.displayName = 'FocusContext'

// /** @internal */
// export const useFocusContext = () => useContext(FocusContext)
