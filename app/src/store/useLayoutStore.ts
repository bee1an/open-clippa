import { useStorage } from '@vueuse/core'
import { defineStore } from 'pinia'

export const SIDER_COLLAPSED_STORAGE_KEY = 'siderCollapsed'
export const TIMELINE_HIDDEN_STORAGE_KEY = 'timelineHidden'

export const useLayoutStore = defineStore('layout', () => {
  const storage = typeof localStorage === 'undefined' ? undefined : localStorage
  const siderCollapsed = useStorage(SIDER_COLLAPSED_STORAGE_KEY, true, storage)
  const timelineHidden = useStorage(TIMELINE_HIDDEN_STORAGE_KEY, false, storage)

  function setSiderCollapsed(collapsed: boolean): void {
    siderCollapsed.value = collapsed
  }

  function toggleSiderCollapsed(): void {
    siderCollapsed.value = !siderCollapsed.value
  }

  function setTimelineHidden(hidden: boolean): void {
    timelineHidden.value = hidden
  }

  function toggleTimelineHidden(): void {
    timelineHidden.value = !timelineHidden.value
  }

  return {
    siderCollapsed,
    timelineHidden,
    setSiderCollapsed,
    toggleSiderCollapsed,
    setTimelineHidden,
    toggleTimelineHidden,
  }
})
