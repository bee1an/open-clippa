import type { RouteRecordRaw } from 'vue-router'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
import { initializeThemeColor } from '@/composables/useThemeColor'
import { isFileSystemAccessSupported } from '@/persistence/fileSystemAccess'
import { useProjectStore } from '@/store/useProjectStore'
import { buildRouteWithProjectId, resolveRouteProjectId } from '@/utils/projectRoute'
import App from './App.vue'
import 'virtual:uno.css'
import '@/styles/globals.css'

const PROJECT_SCOPED_PATH_PREFIXES = ['/editor', '/export', '/play']

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

function shouldScopeRoutePath(path: string): boolean {
  return PROJECT_SCOPED_PATH_PREFIXES.some(prefix => path === prefix || path.startsWith(`${prefix}/`))
}

function reloadToHome(): false {
  window.location.replace(import.meta.env.BASE_URL)
  return false
}

function ensureProjectScopedPaths(records: RouteRecordRaw[]): RouteRecordRaw[] {
  return records.map((route) => {
    const nextRoute: RouteRecordRaw = {
      ...route,
    }

    if (nextRoute.children)
      nextRoute.children = ensureProjectScopedPaths(nextRoute.children)

    if (shouldScopeRoutePath(nextRoute.path))
      nextRoute.path = `/:projectId${nextRoute.path}`

    return nextRoute
  })
}

const baseRouteRecords = import.meta.env.DEV ? routes : filterDevRoutes(routes as RouteRecordRaw[])
const routeRecords = ensureProjectScopedPaths(baseRouteRecords as RouteRecordRaw[])
const pinia = createPinia()
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: routeRecords,
})

router.beforeEach(async (to) => {
  const supported = isFileSystemAccessSupported()
  if (!supported && to.path !== '/unsupported')
    return '/unsupported'

  if (supported && to.path === '/unsupported')
    return reloadToHome()

  if (!supported)
    return true

  const projectStore = useProjectStore(pinia)
  const isUnscopedProjectPath = PROJECT_SCOPED_PATH_PREFIXES.some(prefix => to.path === prefix || to.path.startsWith(`${prefix}/`))
  if (isUnscopedProjectPath) {
    if (!projectStore.activeProjectId)
      return reloadToHome()

    return buildRouteWithProjectId(to.path, projectStore.activeProjectId, to.query)
  }

  const routeProjectId = resolveRouteProjectId(to.params.projectId as string | string[] | undefined)
  if (routeProjectId) {
    if (projectStore.activeProjectId !== routeProjectId) {
      try {
        await projectStore.openProject(routeProjectId)
      }
      catch {
        return reloadToHome()
      }
    }
  }

  return true
})

initializeThemeColor()

createApp(App)
  .use(router)
  .use(pinia)
  .mount('#app')
