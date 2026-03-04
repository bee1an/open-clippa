<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { useProjectStore } from '@/store/useProjectStore'

const projectStore = useProjectStore()
const router = useRouter()
const newProjectName = ref('')
const creating = ref(false)
const openingProjectId = ref<string | null>(null)
const deletingProjectId = ref<string | null>(null)
const pendingDeleteProjectId = ref<string | null>(null)

const { projects, loading, errorMessage } = storeToRefs(projectStore)

onMounted(async () => {
  await projectStore.bootstrapProjects()
})

async function handleCreateProject(): Promise<void> {
  if (creating.value)
    return

  creating.value = true
  try {
    await projectStore.createAndOpenProject(newProjectName.value)
    newProjectName.value = ''
    await router.push('/editor/media')
  }
  catch {}
  finally {
    creating.value = false
  }
}

async function handleOpenProject(projectId: string): Promise<void> {
  if (openingProjectId.value)
    return

  openingProjectId.value = projectId
  try {
    await projectStore.openProject(projectId)
    await router.push('/editor/media')
  }
  catch {}
  finally {
    openingProjectId.value = null
  }
}

function requestDeleteProject(projectId: string): void {
  pendingDeleteProjectId.value = projectId
}

async function handleDeleteProject(): Promise<void> {
  const projectId = pendingDeleteProjectId.value
  if (!projectId)
    return

  pendingDeleteProjectId.value = null
  deletingProjectId.value = projectId
  try {
    await projectStore.removeProject(projectId)
  }
  catch {}
  finally {
    deletingProjectId.value = null
  }
}

function formatTime(value: number): string {
  return new Date(value).toLocaleString()
}

function handleDeleteModalUpdate(value: boolean): void {
  if (!value)
    pendingDeleteProjectId.value = null
}
</script>

<template>
  <div class="h-full w-full bg-background text-foreground p-6 md:p-10 overflow-auto">
    <div class="max-w-4xl mx-auto space-y-6">
      <header class="space-y-2">
        <h1 class="text-2xl md:text-3xl font-semibold">
          Projects
        </h1>
        <p class="text-sm text-foreground-muted">
          Create or open a project to continue editing.
        </p>
      </header>

      <section class="rounded-xl border border-border bg-background-elevated p-4 md:p-5 space-y-3">
        <div class="flex flex-col md:flex-row gap-3">
          <input
            v-model="newProjectName"
            type="text"
            class="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:border-primary"
            placeholder="Project name (optional)"
            @keydown.enter.prevent="handleCreateProject"
          >
          <Button
            class="h-9 px-4"
            :disabled="creating || loading"
            @click="handleCreateProject"
          >
            {{ creating ? 'Creating...' : 'Create Project' }}
          </Button>
        </div>
        <p v-if="errorMessage" class="text-sm text-red-400">
          {{ errorMessage }}
        </p>
      </section>

      <section class="rounded-xl border border-border bg-background-elevated p-4 md:p-5">
        <div v-if="loading" class="text-sm text-foreground-muted">
          Loading projects...
        </div>

        <div v-else-if="projects.length === 0" class="text-sm text-foreground-muted">
          No project yet. Create your first project above.
        </div>

        <div v-else class="space-y-2">
          <article
            v-for="project in projects"
            :key="project.id"
            class="rounded-lg border border-border bg-background p-3 md:p-4 flex flex-col md:flex-row md:items-center gap-3 md:gap-4"
          >
            <div class="min-w-0 flex-1">
              <h2 class="text-sm font-medium truncate" :title="project.name">
                {{ project.name }}
              </h2>
              <p class="text-xs text-foreground-muted mt-1">
                Updated {{ formatTime(project.updatedAt) }}
              </p>
            </div>

            <div class="flex items-center gap-2">
              <Button
                variant="secondary"
                class="h-8 px-3 text-xs"
                :disabled="openingProjectId === project.id || deletingProjectId === project.id"
                @click="handleOpenProject(project.id)"
              >
                {{ openingProjectId === project.id ? 'Opening...' : 'Open' }}
              </Button>
              <Button
                variant="outline"
                class="h-8 px-3 text-xs text-red-400"
                :disabled="deletingProjectId === project.id || openingProjectId === project.id"
                @click="requestDeleteProject(project.id)"
              >
                {{ deletingProjectId === project.id ? 'Deleting...' : 'Delete' }}
              </Button>
            </div>
          </article>
        </div>
      </section>

      <Modal
        :model-value="pendingDeleteProjectId !== null"
        title="确认删除工程"
        size="sm"
        @update:model-value="handleDeleteModalUpdate"
      >
        <p class="text-sm text-foreground-muted">
          Delete this project and all saved states?
        </p>
        <template #footer>
          <div class="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              @click="pendingDeleteProjectId = null"
            >
              Cancel
            </Button>
            <Button
              variant="secondary"
              size="sm"
              class="text-red-400"
              @click="handleDeleteProject"
            >
              Delete
            </Button>
          </div>
        </template>
      </Modal>
    </div>
  </div>
</template>
