<script setup lang="ts">
import { onMounted } from 'vue'
import GameCard from './GameCard.vue'
import { useFocusable } from '../../composables/nav/useFocusable.ts'
import { provideFocusContext } from '../../composables/nav/useFocusContext.ts'
import { useGamepad } from '../../composables/input/useGamepad.ts'

defineProps<{ games: Record<string, unknown>[] }>()

const { ref: gridRef, focusKey, focusSelf } = useFocusable({ trackChildren: true })

provideFocusContext(focusKey)

onMounted(() => focusSelf())

useGamepad({
  onScroll: (dx, dy) => window.scrollBy({ left: dx, top: dy, behavior: 'instant' }),
})
</script>

<template>
  <div ref="gridRef" class="game-grid">
    <div v-for="game in games" :key="game.id as number" class="game-card-wrapper">
      <GameCard :game="game" />
    </div>
  </div>
</template>

<style scoped>
.game-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 1.25rem;
}

/* focus ring is handled via the focused prop in GameCard */
</style>
