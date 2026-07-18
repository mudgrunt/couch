<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import GameGrid from '@/components/library/GameGrid.vue'
import GameList from '@/components/library/GameList.vue'

type View = 'grid' | 'list'
type SortBy =
  | 'sort_title'
  | 'last_played'
  | 'time_played_min'
  | 'release_date'
  | 'size_bytes'
  | 'hltb_main_min'
type SortDir = 'asc' | 'desc'

const games = ref<Record<string, unknown>[]>([])
const view = ref<View>((localStorage.getItem('library-view') as View) ?? 'grid')
const loading = ref(true)
const error = ref<string | null>(null)

const searchQuery = ref('')
const searchResults = ref<Record<string, unknown>[]>([])
const searchLoading = ref(false)
const isSearching = computed(() => searchQuery.value.trim().length > 0)
const displayedGames = computed(() => (isSearching.value ? searchResults.value : games.value))

const sortBy = ref<SortBy>('sort_title')
const sortDir = ref<SortDir>('asc')
const filterInstalled = ref<boolean | null>(null)
const filterFavorite = ref<boolean | null>(null)
const filterLibraryId = ref<number | null>(null)
const filterPlatformId = ref<number | null>(null)

interface PlatformOption {
  id: number
  name: string
  code: string
}
const platforms = ref<PlatformOption[]>([])

const libraries: { value: number; label: string }[] = [
  { value: 1, label: 'Steam' },
  { value: 2, label: 'GOG' },
  { value: 3, label: 'Epic' },
]

const sortOptions: { value: SortBy; label: string }[] = [
  { value: 'sort_title', label: 'Title' },
  { value: 'last_played', label: 'Last Played' },
  { value: 'time_played_min', label: 'Time Played' },
  { value: 'release_date', label: 'Release Date' },
  { value: 'size_bytes', label: 'Size' },
  { value: 'hltb_main_min', label: 'HLTB Time' },
]

async function fetchGames() {
  loading.value = true
  error.value = null
  try {
    const endpoint = view.value === 'list' ? '/api/games/list' : '/api/games'
    const params = new URLSearchParams()
    params.set('sortBy', sortBy.value)
    params.set('sortDir', sortDir.value)
    if (filterInstalled.value !== null) params.set('isInstalled', String(filterInstalled.value))
    if (filterFavorite.value !== null) params.set('isFavorite', String(filterFavorite.value))
    if (filterLibraryId.value !== null) params.append('libraryIds', String(filterLibraryId.value))
    if (filterPlatformId.value !== null)
      params.append('platformIds', String(filterPlatformId.value))
    const res = await fetch(`${endpoint}?${params}`)
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    games.value = await res.json()
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load games'
  } finally {
    loading.value = false
  }
}

function setView(v: View) {
  view.value = v
  localStorage.setItem('library-view', v)
  fetchGames()
}

function toggleSortDir() {
  sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
}

function toggleFilter(filter: 'installed' | 'favorite') {
  if (filter === 'installed') {
    filterInstalled.value = filterInstalled.value === true ? null : true
  } else {
    filterFavorite.value = filterFavorite.value === true ? null : true
  }
}

watch(
  [sortBy, sortDir, filterInstalled, filterFavorite, filterLibraryId, filterPlatformId],
  fetchGames,
)
onMounted(async () => {
  fetchGames()
  const res = await fetch('/api/platforms')
  if (res.ok) platforms.value = await res.json()
})

const router = useRouter()
function goToRandomGame() {
  const pool = displayedGames.value
  if (!pool.length) return
  const game = pool[Math.floor(Math.random() * pool.length)]
  router.push(`/games/${game.id}`)
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(searchQuery, (q) => {
  if (searchTimer) clearTimeout(searchTimer)
  if (!q.trim()) {
    searchResults.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    searchLoading.value = true
    try {
      const res = await fetch(`/api/games/search?q=${encodeURIComponent(q)}`)
      if (res.ok) searchResults.value = await res.json()
    } finally {
      searchLoading.value = false
    }
  }, 200)
})
</script>

<template>
  <div class="library">
    <header class="library__header">
      <h1>
        Library <span class="library__count">{{ displayedGames.length }}</span>
      </h1>
      <div class="library__controls">
        <div class="library__search">
          <input
            v-model="searchQuery"
            type="search"
            placeholder="Search…"
            class="library__search-input"
            :class="{ 'library__search-input--active': isSearching }"
          />
        </div>
        <div class="library__filters">
          <button :class="{ active: filterInstalled === true }" @click="toggleFilter('installed')">
            Installed
          </button>
          <button :class="{ active: filterFavorite === true }" @click="toggleFilter('favorite')">
            Favorites
          </button>
        </div>
        <div class="library__libraries">
          <button
            v-for="lib in libraries"
            :key="lib.value"
            :class="{ active: filterLibraryId === lib.value }"
            @click="filterLibraryId = filterLibraryId === lib.value ? null : lib.value"
          >
            {{ lib.label }}
          </button>
        </div>
        <div v-if="platforms.length" class="library__platforms">
          <button
            v-for="p in platforms"
            :key="p.id"
            :class="{ active: filterPlatformId === p.id }"
            @click="filterPlatformId = filterPlatformId === p.id ? null : p.id"
          >
            {{ p.name }}
          </button>
        </div>
        <div class="library__sort">
          <select v-model="sortBy">
            <option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <button
            class="sort-dir"
            @click="toggleSortDir"
            :title="sortDir === 'asc' ? 'Ascending' : 'Descending'"
          >
            {{ sortDir === 'asc' ? '↑' : '↓' }}
          </button>
        </div>
        <div class="library__view-toggle">
          <button :class="{ active: view === 'grid' }" @click="setView('grid')">Grid</button>
          <button :class="{ active: view === 'list' }" @click="setView('list')">List</button>
        </div>
        <button
          class="library__random"
          :disabled="!displayedGames.length"
          @click="goToRandomGame"
          title="Random game"
        >
          🎲
        </button>
      </div>
    </header>

    <div v-if="loading || searchLoading">Loading...</div>
    <div v-else-if="error">{{ error }}</div>
    <template v-else>
      <GameGrid v-if="view === 'grid'" :games="displayedGames" />
      <GameList v-else :games="displayedGames" />
    </template>
  </div>
</template>

<style scoped>
.library {
  padding: 2rem;
  max-width: 1600px;
  margin: 0 auto;
}
.library__count {
  font-size: 0.9rem;
  font-weight: 400;
  color: #888;
  margin-left: 0.4rem;
}
.library__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
  gap: 0.75rem;
}
.library__controls {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}
.library__filters,
.library__libraries,
.library__platforms,
.library__sort,
.library__view-toggle {
  display: flex;
  gap: 0.5rem;
}
.library__filters button,
.library__libraries button,
.library__platforms button,
.library__view-toggle button {
  padding: 0.35rem 0.75rem;
  border: 1px solid #444;
  background: transparent;
  color: inherit;
  border-radius: 4px;
  cursor: pointer;
}
.library__filters button.active,
.library__libraries button.active,
.library__platforms button.active,
.library__view-toggle button.active {
  background: #444;
}
.library__sort select {
  padding: 0.35rem 0.5rem;
  background: transparent;
  border: 1px solid #444;
  color: inherit;
  border-radius: 4px;
  cursor: pointer;
}
.library__sort .sort-dir {
  padding: 0.35rem 0.6rem;
  border: 1px solid #444;
  background: transparent;
  color: inherit;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
}
.library__search {
  display: flex;
}
.library__search-input {
  padding: 0.35rem 0.65rem;
  background: transparent;
  border: 1px solid #444;
  border-radius: 4px;
  color: inherit;
  font-size: 0.9rem;
  width: 180px;
  transition:
    width 0.2s ease,
    border-color 0.15s ease;
  outline: none;
}
.library__search-input--active,
.library__search-input:focus {
  width: 260px;
  border-color: #888;
}
.library__random {
  padding: 0.35rem 0.6rem;
  border: 1px solid #444;
  background: transparent;
  color: inherit;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
}
.library__random:disabled {
  opacity: 0.35;
  cursor: default;
}
</style>
