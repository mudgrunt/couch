<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useToolbar } from '../composables/ui/useToolbar'

interface Settings {
  steamPath?: string
  steamApiKey?: string
  steamId?: string
  gogPath?: string
  epicPath?: string
  romsPath?: string
  launchFullscreen?: boolean
  bootVideo?: string
  theme?: string
}

type Section = 'library' | 'account' | 'streaming' | 'appearance'

const THEMES = [
  { value: 'dark', label: 'Dark' },
  { value: 'light', label: 'Light' },
  { value: 'midnight', label: 'Midnight' },
  { value: 'forest', label: 'Forest' },
]

const saving = ref(false)
const savedSection = ref<string | null>(null)
const error = ref<string | null>(null)

const settings = ref<Settings>({})
const { setActions, clearActions } = useToolbar()

onMounted(() => {
  setActions([
    { id: 'select', label: 'Select', gamepadButton: 'a', keyboardKey: 'Enter' },
    {
      id: 'back',
      label: 'Back',
      gamepadButton: 'b',
      keyboardKey: 'Esc',
      action: () => {
        history.back()
      },
    },
  ])
  load()
})

onUnmounted(() => {
  clearActions()
})

async function load() {
  try {
    const res = await fetch('/api/settings')
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    settings.value = await res.json()
    applyTheme(settings.value.theme)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load settings'
  }
}

async function save(section: Section, keys: (keyof Settings)[]) {
  saving.value = true
  error.value = null
  try {
    const patch: Partial<Settings> = {}
    for (const k of keys) {
      ;(patch as Record<string, unknown>)[k] = settings.value[k]
    }
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    })
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
    settings.value = await res.json()
    applyTheme(settings.value.theme)
    savedSection.value = section
    setTimeout(() => (savedSection.value = null), 2000)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to save settings'
  } finally {
    saving.value = false
  }
}

function applyTheme(theme?: string) {
  document.documentElement.setAttribute('data-theme', theme ?? 'dark')
}

const navItems: { id: Section; label: string }[] = [
  { id: 'library', label: 'Library' },
  { id: 'account', label: 'Account' },
  { id: 'streaming', label: 'Streaming' },
  { id: 'appearance', label: 'Appearance' },
]

onMounted(load)
</script>

<template>
  <div class="settings">
    <nav class="settings__nav">
      <a v-for="item in navItems" :key="item.id" :href="`#${item.id}`" class="settings__nav-link">
        {{ item.label }}
      </a>
    </nav>

    <div class="settings__content">
      <p v-if="error" class="settings__error">{{ error }}</p>

      <!-- Library -->
      <section id="library" class="settings__section">
        <h2 class="settings__heading">Library</h2>
        <p class="settings__desc">Paths to your game library folders.</p>

        <div class="settings__row">
          <label class="settings__label" for="steamPath">Steam path</label>
          <input
            id="steamPath"
            v-model="settings.steamPath"
            type="text"
            class="settings__input"
            placeholder="C:\Program Files (x86)\Steam"
          />
        </div>

        <div class="settings__row">
          <label class="settings__label" for="gogPath">GOG path</label>
          <input
            id="gogPath"
            v-model="settings.gogPath"
            type="text"
            class="settings__input"
            placeholder="C:\Program Files (x86)\GOG Galaxy"
          />
        </div>

        <div class="settings__row">
          <label class="settings__label" for="epicPath">Epic Games path</label>
          <input
            id="epicPath"
            v-model="settings.epicPath"
            type="text"
            class="settings__input"
            placeholder="C:\Program Files\Epic Games"
          />
        </div>

        <div class="settings__row">
          <label class="settings__label" for="romsPath">ROMs path</label>
          <input
            id="romsPath"
            v-model="settings.romsPath"
            type="text"
            class="settings__input"
            placeholder="D:\ROMs"
          />
        </div>

        <div class="settings__footer">
          <span v-if="savedSection === 'library'" class="settings__saved">Saved</span>
          <button
            class="settings__save"
            :disabled="saving"
            @click="save('library', ['steamPath', 'gogPath', 'epicPath', 'romsPath'])"
          >
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </section>

      <hr class="settings__divider" />

      <!-- Account -->
      <section id="account" class="settings__section">
        <h2 class="settings__heading">Account</h2>
        <p class="settings__desc">API credentials used for game enrichment.</p>

        <div class="settings__row">
          <label class="settings__label" for="steamApiKey">Steam API key</label>
          <input
            id="steamApiKey"
            v-model="settings.steamApiKey"
            type="password"
            autocomplete="off"
            class="settings__input"
            placeholder="••••••••••••••••"
          />
        </div>

        <div class="settings__row">
          <label class="settings__label" for="steamId">Steam ID</label>
          <input
            id="steamId"
            v-model="settings.steamId"
            type="text"
            class="settings__input"
            placeholder="76561198000000000"
          />
        </div>

        <div class="settings__footer">
          <span v-if="savedSection === 'account'" class="settings__saved">Saved</span>
          <button
            class="settings__save"
            :disabled="saving"
            @click="save('account', ['steamApiKey', 'steamId'])"
          >
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </section>

      <hr class="settings__divider" />

      <!-- Streaming -->
      <section id="streaming" class="settings__section">
        <h2 class="settings__heading">Streaming</h2>
        <p class="settings__desc">Options for game streaming behaviour.</p>

        <div class="settings__row">
          <div class="settings__label-group">
            <span class="settings__label">Launch stream fullscreen</span>
            <span class="settings__hint">Automatically enter fullscreen when a stream starts.</span>
          </div>
          <button
            class="settings__toggle"
            :class="{ 'settings__toggle--on': settings.launchFullscreen }"
            role="switch"
            :aria-checked="settings.launchFullscreen"
            @click="settings.launchFullscreen = !settings.launchFullscreen"
          >
            <span class="settings__toggle-thumb" />
          </button>
        </div>

        <div class="settings__row">
          <div class="settings__label-group">
            <label class="settings__label" for="bootVideo">Boot video</label>
            <span class="settings__hint">Video played on startup (leave blank to disable).</span>
          </div>
          <input
            id="bootVideo"
            v-model="settings.bootVideo"
            type="text"
            class="settings__input"
            placeholder="C:\Videos\intro.mp4"
          />
        </div>

        <div class="settings__footer">
          <span v-if="savedSection === 'streaming'" class="settings__saved">Saved</span>
          <button
            class="settings__save"
            :disabled="saving"
            @click="save('streaming', ['launchFullscreen', 'bootVideo'])"
          >
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </section>

      <hr class="settings__divider" />

      <!-- Appearance -->
      <section id="appearance" class="settings__section">
        <h2 class="settings__heading">Appearance</h2>
        <p class="settings__desc">Customise how Screenskip looks.</p>

        <div class="settings__row settings__row--theme">
          <span class="settings__label">Theme</span>
          <div class="settings__themes">
            <button
              v-for="t in THEMES"
              :key="t.value"
              class="settings__theme-btn"
              :class="{ 'settings__theme-btn--active': (settings.theme ?? 'dark') === t.value }"
              :data-theme-preview="t.value"
              @click="settings.theme = t.value"
            >
              <span class="settings__theme-swatch" />
              {{ t.label }}
            </button>
          </div>
        </div>

        <div class="settings__footer">
          <span v-if="savedSection === 'appearance'" class="settings__saved">Saved</span>
          <button class="settings__save" :disabled="saving" @click="save('appearance', ['theme'])">
            {{ saving ? 'Saving…' : 'Save' }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.settings {
  display: flex;
  min-height: 100vh;
  color: #e0e0e0;
  background: #111;
}

/* Sidebar */
.settings__nav {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  width: 180px;
  flex-shrink: 0;
  padding: 2rem 1rem;
  border-right: 1px solid #222;
  background: #0e0e0e;
  position: sticky;
  top: 0;
  height: 100vh;
}

.settings__nav-link {
  color: #888;
  cursor: pointer;
  font-size: 0.9rem;
  padding: 0.55rem 0.75rem;
  border-radius: 6px;
  text-decoration: none;
  transition:
    background 0.15s,
    color 0.15s;
}

.settings__nav-link:hover {
  background: #1c1c1c;
  color: #e0e0e0;
}

/* Content area */
.settings__content {
  flex: 1;
  padding: 2.5rem 3rem;
  max-width: 680px;
  display: flex;
  flex-direction: column;
  gap: 0;
}

.settings__section {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding: 2rem 0;
  scroll-margin-top: 2rem;
}

.settings__divider {
  border: none;
  border-top: 1px solid #1e1e1e;
  margin: 0;
}

.settings__heading {
  font-size: 1.2rem;
  font-weight: 600;
  color: #fff;
  margin-bottom: 0;
}

.settings__desc {
  font-size: 0.85rem;
  color: #666;
  margin-top: -0.5rem;
}

/* Rows */
.settings__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1.5rem;
}

.settings__row--theme {
  align-items: flex-start;
}

.settings__label-group {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.settings__label {
  font-size: 0.9rem;
  color: #c0c0c0;
  white-space: nowrap;
  min-width: 160px;
}

.settings__hint {
  font-size: 0.78rem;
  color: #555;
}

/* Input */
.settings__input {
  flex: 1;
  background: #1a1a1a;
  border: 1px solid #2e2e2e;
  border-radius: 6px;
  color: #e0e0e0;
  font-size: 0.88rem;
  padding: 0.5rem 0.75rem;
  transition: border-color 0.15s;
  min-width: 0;
}

.settings__input:focus {
  outline: none;
  border-color: #7c7cff;
}

.settings__input::placeholder {
  color: #3e3e3e;
}

/* Toggle */
.settings__toggle {
  position: relative;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
  background: #2e2e2e;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.2s;
  padding: 0;
}

.settings__toggle--on {
  background: #7c7cff;
}

.settings__toggle-thumb {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  background: #fff;
  border-radius: 50%;
  transition: transform 0.2s;
}

.settings__toggle--on .settings__toggle-thumb {
  transform: translateX(20px);
}

/* Theme picker */
.settings__themes {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.settings__theme-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  background: #1a1a1a;
  border: 2px solid #2e2e2e;
  border-radius: 8px;
  color: #888;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0.6rem 0.9rem;
  transition:
    border-color 0.15s,
    color 0.15s;
}

.settings__theme-btn:hover {
  border-color: #555;
  color: #e0e0e0;
}

.settings__theme-btn--active {
  border-color: #7c7cff;
  color: #e0e0e0;
}

.settings__theme-swatch {
  width: 32px;
  height: 20px;
  border-radius: 4px;
}

.settings__theme-btn[data-theme-preview='dark'] .settings__theme-swatch {
  background: linear-gradient(135deg, #111 50%, #222 50%);
}
.settings__theme-btn[data-theme-preview='light'] .settings__theme-swatch {
  background: linear-gradient(135deg, #f0f0f0 50%, #e0e0e0 50%);
}
.settings__theme-btn[data-theme-preview='midnight'] .settings__theme-swatch {
  background: linear-gradient(135deg, #0a0a1a 50%, #1a1a3e 50%);
}
.settings__theme-btn[data-theme-preview='forest'] .settings__theme-swatch {
  background: linear-gradient(135deg, #0d1a0d 50%, #1a3a1a 50%);
}

/* Footer */
.settings__footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1rem;
  padding-top: 0.5rem;
  border-top: 1px solid #1e1e1e;
  margin-top: 0.5rem;
}

.settings__saved {
  font-size: 0.82rem;
  color: #5fba7d;
}

.settings__save {
  background: #7c7cff;
  border: none;
  border-radius: 6px;
  color: #fff;
  cursor: pointer;
  font-size: 0.88rem;
  font-weight: 600;
  padding: 0.5rem 1.25rem;
  transition: background 0.15s;
}

.settings__save:hover:not(:disabled) {
  background: #6060e0;
}

.settings__save:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Error */
.settings__error {
  color: #ff6b6b;
  font-size: 0.85rem;
  margin-bottom: 1rem;
}
</style>
