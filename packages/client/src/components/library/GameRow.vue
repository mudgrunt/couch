<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { prefetchGame } from '../../composables/ui/useGameCache'

const props = defineProps<{ game: Record<string, unknown> }>()
const router = useRouter()
const launching = ref(false)
const launchError = ref('')

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

async function launch() {
  if (launching.value) return
  launching.value = true
  launchError.value = ''
  try {
    const res = await fetch(`/api/games/${props.game.id}/launch`, { method: 'POST' })
    if (!res.ok) throw new Error(await res.text())
    const { hwnd } = await res.json()
    router.push(`/stream?hwnd=${hwnd}`)
  } catch (err) {
    launchError.value = err instanceof Error ? err.message : 'Launch failed'
    console.error('Launch failed:', err)
  } finally {
    launching.value = false
  }
}
</script>

<template>
  <tr class="game-row">
    <td>
      <span
        class="game-row__title"
        @mousedown.left="prefetchGame(game.id as number)"
        @click="router.push(`/games/${game.id}`)"
      >
        {{ game.display_title ?? game.title }}
      </span>
    </td>
    <td>{{ game.libraries ?? '—' }}</td>
    <td>{{ game.release_date ?? '—' }}</td>
    <td>{{ game.size_bytes ? formatBytes(game.size_bytes as number) : '—' }}</td>
    <td>{{ game.status_id ?? '—' }}</td>
    <td>
      <button
        v-if="game.launch_target"
        class="game-row__play"
        :class="{ 'game-row__play--error': launchError }"
        :disabled="launching"
        :title="launchError || undefined"
        @click="launch"
      >
        {{ launching ? '…' : launchError ? '⚠' : '▶' }}
      </button>
    </td>
  </tr>
</template>

<style scoped>
.game-row {
  transition: background 0.12s;
}
.game-row:hover {
  background: rgba(124, 124, 255, 0.06);
}
.game-row td {
  padding: 0.5rem 0.75rem;
  border-bottom: 1px solid #2a2a3e;
}
.game-row__title {
  cursor: pointer;
  color: inherit;
}
.game-row__title:hover {
  color: #7c7cff;
  text-decoration: underline;
}
.game-row__play {
  background: none;
  border: none;
  color: #7c7cff;
  cursor: pointer;
  font-size: 1rem;
  padding: 0 0.25rem;
  opacity: 0.7;
  transition: opacity 0.15s;
}
.game-row__play:hover:not(:disabled) {
  opacity: 1;
}
.game-row__play:disabled {
  cursor: default;
  opacity: 0.4;
}
.game-row__play--error {
  color: #e05555;
  opacity: 1;
}
</style>
