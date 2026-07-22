<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getGameFromCache } from '../composables/ui/useGameCache'
import { useToolbar } from '../composables/ui/useToolbar'

const route = useRoute()
const router = useRouter()
const { setActions, clearActions } = useToolbar()

onMounted(() => {
  setActions([
    { id: 'select', label: 'Select', gamepadButton: 'a', keyboardKey: 'Enter' },
    {
      id: 'back',
      label: 'Back',
      gamepadButton: 'b',
      keyboardKey: 'Esc',
      action: () => router.back(),
    },
  ])
})

onUnmounted(() => {
  clearActions()
})

const game = ref<Record<string, unknown> | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)
const launching = ref(false)
const launchError = ref('')

const id = computed(() => route.params.id as string)

const cover = computed(() => {
  if (!game.value) return null
  const media = game.value.media as Array<{ type: string; path: string }> | string
  const parsed = typeof media === 'string' ? JSON.parse(media) : media
  return parsed?.find((m: { type: string; path: string }) => m.type === 'cover')?.path ?? null
})

const hero = computed(() => {
  if (!game.value) return null
  const media = game.value.media as Array<{ type: string; path: string }> | string
  const parsed = typeof media === 'string' ? JSON.parse(media) : media
  return parsed?.find((m: { type: string; path: string }) => m.type === 'hero')?.path ?? null
})

const logo = computed(() => {
  if (!game.value) return null
  const media = game.value.media as Array<{ type: string; path: string }> | string
  const parsed = typeof media === 'string' ? JSON.parse(media) : media
  return parsed?.find((m: { type: string; path: string }) => m.type === 'logo')?.path ?? null
})

const title = computed(() => (game.value?.display_title ?? game.value?.title ?? '') as string)

function parseJson<T>(val: unknown): T[] {
  if (!val) return []
  if (typeof val === 'string') return JSON.parse(val)
  return val as T[]
}

const genres = computed(() => parseJson<{ id: number; name: string }>(game.value?.genres))
const developers = computed(() => parseJson<{ id: number; name: string }>(game.value?.developers))
const publishers = computed(() => parseJson<{ id: number; name: string }>(game.value?.publishers))
const features = computed(() => parseJson<{ id: number; name: string }>(game.value?.features))

function hltbLabel(minutes: unknown): string {
  if (!minutes) return '—'
  const h = Math.floor((minutes as number) / 60)
  const m = (minutes as number) % 60
  return h > 0 ? `${h}h ${m > 0 ? m + 'm' : ''}`.trim() : `${m}m`
}

async function fetchGame() {
  loading.value = true
  error.value = null
  try {
    const cached = getGameFromCache(Number(id.value))
    if (cached) {
      game.value = await cached
    } else {
      const res = await fetch(`/api/games/${id.value}`)
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
      game.value = await res.json()
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load game'
  } finally {
    loading.value = false
  }
}

async function launch() {
  if (launching.value || !game.value?.launch_target) return
  launching.value = true
  launchError.value = ''
  try {
    const res = await fetch(`/api/games/${id.value}/launch`, { method: 'POST' })
    if (!res.ok) throw new Error(await res.text())
    const { hwnd } = await res.json()
    router.push(`/stream?hwnd=${hwnd}`)
  } catch (err) {
    launchError.value = err instanceof Error ? err.message : 'Launch failed'
  } finally {
    launching.value = false
  }
}

onMounted(fetchGame)
</script>

<template>
  <div class="detail">
    <button class="detail__back" @click="router.back()">← Back</button>

    <div v-if="loading" class="detail__loading">Loading…</div>
    <div v-else-if="error" class="detail__error">{{ error }}</div>

    <template v-else-if="game">
      <div v-if="hero" class="detail__hero">
        <img :src="hero" :alt="title" />
        <img v-if="logo" :src="logo" :alt="title" class="detail__logo--hero" />
      </div>

      <div class="detail__layout" :class="{ 'detail__layout--overlap': hero }">
        <aside class="detail__sidebar">
          <div class="detail__cover">
            <img v-if="cover" :src="cover" :alt="title" />
            <div v-else class="detail__cover-placeholder" />
          </div>

          <button
            v-if="game?.launch_target"
            class="detail__launch"
            :disabled="launching"
            @click="launch"
          >
            {{ launching ? 'Launching…' : '▶ Play' }}
          </button>
          <p v-if="launchError" class="detail__launch-error">{{ launchError }}</p>
        </aside>

        <main class="detail__main">
          <img v-if="logo && !hero" :src="logo" :alt="title" class="detail__logo" />
          <h1 v-if="!logo" class="detail__title">{{ title }}</h1>

          <div class="detail__meta">
            <span v-if="game?.release_date">{{ game.release_date }}</span>
            <span v-if="genres.length" class="detail__tags">
              <span v-for="g in genres" :key="g.id" class="detail__tag">{{ g.name }}</span>
            </span>
          </div>

          <p v-if="game?.description" class="detail__description" v-html="game.description" />

          <div class="detail__info-grid">
            <template v-if="developers.length">
              <span class="detail__label">Developer</span>
              <span>{{ developers.map((d) => d.name).join(', ') }}</span>
            </template>
            <template v-if="publishers.length">
              <span class="detail__label">Publisher</span>
              <span>{{ publishers.map((p) => p.name).join(', ') }}</span>
            </template>
            <template v-if="game?.hltb_main_min">
              <span class="detail__label">Main Story</span>
              <span>{{ hltbLabel(game.hltb_main_min) }}</span>
            </template>
            <template v-if="game?.hltb_main_extra_min">
              <span class="detail__label">Main + Extras</span>
              <span>{{ hltbLabel(game.hltb_main_extra_min) }}</span>
            </template>
            <template v-if="game?.hltb_completionist_min">
              <span class="detail__label">Completionist</span>
              <span>{{ hltbLabel(game.hltb_completionist_min) }}</span>
            </template>
            <template v-if="game?.size_bytes">
              <span class="detail__label">Size</span>
              <span>{{ ((game.size_bytes as number) / 1024 ** 3).toFixed(1) }} GB</span>
            </template>
          </div>

          <div v-if="features.length" class="detail__features">
            <span v-for="f in features" :key="f.id" class="detail__tag detail__tag--muted">
              {{ f.name }}
            </span>
          </div>
        </main>
      </div>
    </template>
  </div>
</template>

<style scoped>
h2 {
  font-size: 1.1rem;
}
.detail {
  padding: 2rem;
  max-width: 1100px;
  margin: 0 auto;
}
.detail__back {
  background: none;
  border: none;
  color: #7c7cff;
  cursor: pointer;
  font-size: 0.9rem;
  margin-bottom: 1.5rem;
  padding: 0;
}
.detail__back:hover {
  text-decoration: underline;
}
.detail__loading,
.detail__error {
  color: #aaa;
  margin-top: 2rem;
}
.detail__layout {
  display: flex;
  gap: 2.5rem;
  align-items: flex-start;
}
.detail__sidebar {
  flex: 0 0 220px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.detail__cover {
  aspect-ratio: 17 / 24;
  border-radius: 6px;
  overflow: hidden;
  background: #1a1a2e;
}
.detail__cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.detail__hero {
  position: relative;
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 96 / 31;
  background: #1a1a2e;
}
.detail__hero img:first-child {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.detail__hero::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, transparent 40%, rgba(0, 0, 0, 0.55) 100%);
  pointer-events: none;
}
.detail__logo--hero {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  max-height: 120px;
  max-width: 55%;
  object-fit: contain;
  filter: drop-shadow(0 2px 12px rgba(0, 0, 0, 0.9));
  z-index: 1;
  pointer-events: none;
}
.detail__layout--overlap {
  margin-top: -80px;
  position: relative;
  z-index: 1;
  padding-left: 1.5rem;
}
.detail__layout--overlap .detail__main {
  padding-top: 160px;
}
.detail__cover-placeholder {
  width: 100%;
  height: 100%;
  background: #2a2a3e;
}
.detail__launch {
  width: 100%;
  padding: 0.6rem;
  background: #7c7cff;
  border: none;
  border-radius: 4px;
  color: #fff;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.15s;
}
.detail__launch:hover:not(:disabled) {
  background: #9a9aff;
}
.detail__launch:disabled {
  opacity: 0.6;
  cursor: default;
}
.detail__launch-error {
  color: #ff6b6b;
  font-size: 0.8rem;
}
.detail__main {
  flex: 1;
  min-width: 0;
}
.detail__title {
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  line-height: 1.2;
}
.detail__logo {
  display: block;
  max-height: 100px;
  max-width: 100%;
  width: auto;
  object-fit: contain;
  object-position: left center;
  margin-bottom: 0.75rem;
}
.detail__meta {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1rem;
  color: #aaa;
  font-size: 0.9rem;
  flex-wrap: wrap;
}
.detail__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.detail__tag {
  background: #2a2a3e;
  border-radius: 3px;
  padding: 0.2rem 0.5rem;
  font-size: 0.8rem;
}
.detail__tag--muted {
  background: #1e1e2e;
  color: #888;
}
.detail__description {
  color: black;
  line-height: 1.6;
  margin-bottom: 1.5rem;
  font-size: 0.95rem;
}
.detail__description :deep(img) {
  max-width: 100%;
  height: auto;
  display: block;
  border-radius: 4px;
}
.detail__description :deep(* + *) {
  margin-top: 1rem;
}
.detail__info-grid {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.4rem 1.5rem;
  margin-bottom: 1.5rem;
  font-size: 0.9rem;
}
.detail__label {
  color: #888;
  white-space: nowrap;
}
.detail__features {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
</style>
