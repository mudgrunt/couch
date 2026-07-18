import { createRouter, createWebHistory } from 'vue-router'
import LibraryView from '@/views/LibraryView.vue'
import StreamView from '@/views/StreamView.vue'
import GameDetailView from '@/views/GameDetailView.vue'
import SettingsView from '@/views/SettingsView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: '/library' },
    { path: '/library', component: LibraryView },
    { path: '/games/:id', component: GameDetailView },
    { path: '/stream', component: StreamView },
    { path: '/settings', component: SettingsView },
  ],
})

export default router
