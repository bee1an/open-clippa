import type { PersistedProjectMeta, PersistedProjectState } from '@/persistence/types'
import { defineStore } from 'pinia'
import {
  createProject,
  deleteProject,
  listProjects,
  loadProjectState,
  saveProjectState,
  touchProject,
} from '@/persistence/projectRepository'

const ACTIVE_PROJECT_STORAGE_KEY = 'open-clippa.active-project-id'

function readPersistedActiveProjectId(): string | null {
  if (typeof localStorage === 'undefined')
    return null

  const value = localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY)?.trim()
  if (!value)
    return null
  return value
}

function persistActiveProjectId(projectId: string | null): void {
  if (typeof localStorage === 'undefined')
    return

  if (!projectId) {
    localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY)
    return
  }

  localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, projectId)
}

export const useProjectStore = defineStore('project', () => {
  const projects = ref<PersistedProjectMeta[]>([])
  const activeProjectId = ref<string | null>(readPersistedActiveProjectId())
  const loading = ref(false)
  const errorMessage = ref('')

  const hasActiveProject = computed(() => Boolean(activeProjectId.value))

  async function refreshProjects(): Promise<void> {
    projects.value = await listProjects()
  }

  async function bootstrapProjects(): Promise<void> {
    loading.value = true
    errorMessage.value = ''

    try {
      await refreshProjects()
    }
    catch (error) {
      errorMessage.value = error instanceof Error ? error.message : 'Failed to load projects'
    }
    finally {
      loading.value = false
    }
  }

  async function createAndOpenProject(name?: string): Promise<PersistedProjectMeta> {
    loading.value = true
    errorMessage.value = ''

    try {
      const created = await createProject(name)
      activeProjectId.value = created.id
      persistActiveProjectId(created.id)
      await refreshProjects()
      return created
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create project'
      errorMessage.value = message
      throw new Error(message)
    }
    finally {
      loading.value = false
    }
  }

  async function openProject(projectId: string): Promise<void> {
    loading.value = true
    errorMessage.value = ''

    try {
      const touched = await touchProject(projectId)
      if (!touched)
        throw new Error(`Project not found: ${projectId}`)

      activeProjectId.value = projectId
      persistActiveProjectId(projectId)
      await refreshProjects()
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open project'
      errorMessage.value = message
      throw new Error(message)
    }
    finally {
      loading.value = false
    }
  }

  async function removeProject(projectId: string): Promise<void> {
    loading.value = true
    errorMessage.value = ''

    try {
      await deleteProject(projectId)
      if (activeProjectId.value === projectId) {
        activeProjectId.value = null
        persistActiveProjectId(null)
      }

      await refreshProjects()
    }
    catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete project'
      errorMessage.value = message
      throw new Error(message)
    }
    finally {
      loading.value = false
    }
  }

  function clearActiveProject(): void {
    activeProjectId.value = null
    persistActiveProjectId(null)
  }

  async function loadActiveProjectState(): Promise<PersistedProjectState | null> {
    const projectId = activeProjectId.value
    if (!projectId)
      return null

    return await loadProjectState(projectId)
  }

  async function saveActiveProjectState(state: PersistedProjectState): Promise<void> {
    const projectId = activeProjectId.value
    if (!projectId)
      throw new Error('No active project')

    if (state.projectId !== projectId)
      throw new Error('Project state id mismatch')

    await saveProjectState(state)
  }

  return {
    projects,
    activeProjectId,
    loading,
    errorMessage,
    hasActiveProject,
    bootstrapProjects,
    createAndOpenProject,
    openProject,
    removeProject,
    clearActiveProject,
    loadActiveProjectState,
    saveActiveProjectState,
  }
})
