import { ref, readonly } from 'vue'

export interface ToolbarAction {
  id: string
  label: string
  gamepadButton: 'a' | 'b' | 'x' | 'y' | 'menu' | 'options' | 'lt' | 'rt' | 'lb' | 'rb'
  keyboardKey: string
  action?: () => void
}

const actions = ref<ToolbarAction[]>([])

export function useToolbar() {
  return {
    actions: readonly(actions),
    setActions(newActions: ToolbarAction[]) {
      actions.value = newActions
    },
    clearActions() {
      actions.value = []
    },
    addAction(action: ToolbarAction) {
      if (!actions.value.find((a) => a.id === action.id)) {
        actions.value.push(action)
      }
    },
    removeAction(id: string) {
      actions.value = actions.value.filter((a) => a.id !== id)
    },
  }
}
