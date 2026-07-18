<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { setupInputDetection } from './composables/useInputSource'

let cleanupInput: (() => void) | null = null

onMounted(() => {
  cleanupInput = setupInputDetection()
})

onUnmounted(() => {
  if (cleanupInput) cleanupInput()
})
</script>

<template>
  <RouterView v-slot="{ Component }">
    <Transition name="page" mode="out-in">
      <KeepAlive include="LibraryView">
        <component :is="Component" :key="$route.path" />
      </KeepAlive>
    </Transition>
  </RouterView>
  <ActionToolbar />
</template>

<style global>
* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}
body {
  padding-bottom: 48px; /* Room for the toolbar */
}
</style>
