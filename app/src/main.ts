import type { RouteRecordRaw } from 'vue-router'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
import App from './App.vue'
import { initializeThemeColor } from '@/composables/useThemeColor'
import 'virtual:uno.css'
import '@/styles/globals.css'

function filterDevRoutes(records: RouteRecordRaw[]): RouteRecordRaw[] {
  return records
    .filter(route => !route.meta?.devOnly)
    .map((route) => {
      if (!route.children)
        return route
      return {
        ...route,
        children: filterDevRoutes(route.children),
      }
    })
}

const routeRecords = import.meta.env.DEV ? routes : filterDevRoutes(routes as RouteRecordRaw[])

initializeThemeColor()

createApp(App)
  .use(
    createRouter({
      history: createWebHistory(import.meta.env.BASE_URL),
      routes: routeRecords,
    }),
  )
  .use(createPinia())
  .mount('#app')
