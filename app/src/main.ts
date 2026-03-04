import type { RouteRecordRaw } from 'vue-router'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
import { initializeThemeColor } from '@/composables/useThemeColor'
import { isFileSystemAccessSupported } from '@/persistence/fileSystemAccess'
import { useProjectStore } from '@/store/useProjectStore'
import App from './App.vue'
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
const pinia = createPinia()
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: routeRecords,
})

router.beforeEach((to) => {
  const supported = isFileSystemAccessSupported()
  if (!supported && to.path !== '/unsupported')
    return '/unsupported'

  if (supported && to.path === '/unsupported')
    return '/'

  if (!supported)
    return true

  const projectStore = useProjectStore(pinia)
  if (to.path.startsWith('/editor') && !projectStore.activeProjectId)
    return '/'

  return true
})

initializeThemeColor()

createApp(App)
  .use(router)
  .use(pinia)
  .mount('#app')
