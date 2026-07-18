import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { SpatialNavigation } from '@noriginmedia/norigin-spatial-navigation-core'

import App from './App.vue'
import router from './router'
import './assets/theme.css'
import './assets/styles.css'

SpatialNavigation.init()

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')
