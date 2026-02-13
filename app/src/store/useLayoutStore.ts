import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export const SIDER_COLLAPSED_STORAGE_KEY = 'siderCollapsed'

export const useLayoutStore = defineStore('layout', () => {
  const siderCollapsed = useStorage(SIDER_COLLAPSED_STORAGE_KEY, false)

  function setSiderCollapsed(collapsed: boolean): void {
    siderCollapsed.value = collapsed
  }

  function toggleSiderCollapsed(): void {
    siderCollapsed.value = !siderCollapsed.value
  }

  return {
    siderCollapsed,
    setSiderCollapsed,
    toggleSiderCollapsed,
  }
})
