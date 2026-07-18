<script setup lang="ts">
const props = defineProps<{
  show: boolean
  persistent?: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
}>()

function onBackdropClick() {
  if (!props.persistent) {
    emit('close')
  }
}
</script>

<template>
  <Transition name="modal-fade">
    <div v-if="show" class="base-modal" @click.self="onBackdropClick">
      <div>
        <slot />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.base-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.75);
  backdrop-filter: blur(5px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.2s ease;
}

.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}
</style>
