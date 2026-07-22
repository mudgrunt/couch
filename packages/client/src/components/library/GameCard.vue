<script setup lang="ts">
import { useRouter } from 'vue-router'
import { prefetchGame } from '../../composables/ui/useGameCache'
import { useFocusable } from '../../composables/nav/useFocusable'

const props = defineProps<{ game: Record<string, unknown> }>()
const router = useRouter()

function goToDetail() {
  router.push(`/games/${props.game.id}`)
}

const { ref: cardRef, focused } = useFocusable({
  onEnterPress: () => goToDetail(),
  onFocus: () => {
    if (props.game.id) prefetchGame(props.game.id as number)
    if (!cardRef.value) return
    const el = cardRef.value as HTMLElement
    const rect = el.getBoundingClientRect()
    const pad = 80
    if (rect.top < pad) {
      window.scrollBy({ top: rect.top - pad, behavior: 'smooth' })
    } else if (rect.bottom > window.innerHeight - pad) {
      window.scrollBy({ top: rect.bottom - window.innerHeight + pad, behavior: 'smooth' })
    }
  },
})
</script>

<template>
  <div
    ref="cardRef"
    class="game-card"
    :class="{ 'game-card--focused': focused }"
    @mousedown.left="prefetchGame(game.id as number)"
    @click="goToDetail"
  >
    <div class="game-card__cover">
      <img
        v-if="game.cover"
        :src="game.cover as string"
        :alt="(game.display_title ?? game.title) as string"
      />
      <div v-else class="game-card__cover-placeholder" />
    </div>
    <div class="game-card__title">
      {{ game.display_title ?? game.title }}
    </div>
  </div>
</template>

<style scoped>
.game-card {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  cursor: pointer;
  transition: transform 0.15s ease;
}
.game-card:hover {
  transform: scale(1.04);
}
.game-card--focused {
  transform: scale(1.04);
}
.game-card--focused .game-card__cover {
  box-shadow:
    0 0 0 4px #f5c518,
    0 0 18px rgba(245, 197, 24, 0.45);
}
.game-card__cover {
  aspect-ratio: 17 / 24;
  background: #1a1a2e;
  border-radius: 4px;
  overflow: hidden;
}
.game-card__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.game-card__cover-placeholder {
  width: 100%;
  height: 100%;
  background: #2a2a3e;
}
.game-card__title {
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.game-card--launching {
  pointer-events: none;
  opacity: 0.6;
}
.game-card__launching-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 0.9rem;
  font-weight: 600;
}
.game-card__error-overlay {
  background: rgba(180, 40, 40, 0.75);
  cursor: help;
}
.game-card__cover {
  position: relative;
}
</style>
