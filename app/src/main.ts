import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
import App from './App.vue'
import 'virtual:uno.css'
import '@/styles/globals.css'

createApp(App)
  .use(
    createRouter({
      history: createWebHistory(import.meta.env.BASE_URL),
      routes,
    }),
  )
  .use(createPinia())
  .mount('#app')
