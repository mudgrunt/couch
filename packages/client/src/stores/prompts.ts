import { defineStore } from 'pinia'
import { ref } from 'vue'

enum Button {
  BUTTON_DOWN = 0, // A / Cross
  BUTTON_RIGHT = 1, // B / Circle
  BUTTON_LEFT = 2, // X / Square
  BUTTON_UP = 3, // Y / Triangle
  LEFT_SHOULDER = 4,
  RIGHT_SHOULDER = 5,
  LEFT_TRIGGER = 6,
  RIGHT_TRIGGER = 7,
  SELECT = 8,
  START = 9,
  LEFT_THUMB = 10,
  RIGHT_THUMB = 11,
  DPAD_UP = 12,
  DPAD_DOWN = 13,
  DPAD_LEFT = 14,
  DPAD_RIGHT = 15,
}

interface Prompt {
  button: Button
  label: string
  action: () => void
}

export const usePrompts = defineStore('prompts', () => {
  const prompts = ref<Prompt[]>([])
  const stack = ref<{ id: string; prompts: Prompt[] }[]>([])

  function push(id: string, newPrompts: Prompt[]) {
    stack.value.push({ id, prompts: newPrompts })
    prompts.value = newPrompts
  }

  function pop(id: string) {
    stack.value = stack.value.filter((e) => e.id !== id)
    prompts.value = stack.value.at(-1)?.prompts || []
  }

  return { prompts, push, pop }
})
