import type { PersistedProjectMeta, PersistedProjectState } from './types'
import { openIndexedDb, requestAsPromise, transactionAsPromise } from './indexedDb'

const DB_NAME = 'open-clippa.project-db.v1'
const DB_VERSION = 1
const PROJECTS_STORE = 'projects'
const PROJECT_STATE_STORE = 'project_state'
const SCHEMA_VERSION = 2

let databasePromise: Promise<IDBDatabase> | null = null

function buildDefaultProjectName(): string {
  const now = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')

  return `项目 ${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}`
}

function createProjectId(): string {
  return globalThis.crypto.randomUUID()
}

function ensureProjectStores(database: IDBDatabase): void {
  if (!database.objectStoreNames.contains(PROJECTS_STORE))
    database.createObjectStore(PROJECTS_STORE, { keyPath: 'id' })

  if (!database.objectStoreNames.contains(PROJECT_STATE_STORE))
    database.createObjectStore(PROJECT_STATE_STORE, { keyPath: 'projectId' })
}

async function getDatabase(): Promise<IDBDatabase> {
  if (!databasePromise) {
    databasePromise = openIndexedDb(DB_NAME, DB_VERSION, (database) => {
      ensureProjectStores(database)
    })
  }

  return await databasePromise
}

async function readProjectMeta(projectId: string): Promise<PersistedProjectMeta | null> {
  const database = await getDatabase()
  const transaction = database.transaction(PROJECTS_STORE, 'readonly')
  const store = transaction.objectStore(PROJECTS_STORE)
  const result = await requestAsPromise<PersistedProjectMeta | undefined>(store.get(projectId))
  await transactionAsPromise(transaction)
  return result ?? null
}

export async function listProjects(): Promise<PersistedProjectMeta[]> {
  const database = await getDatabase()
  const transaction = database.transaction(PROJECTS_STORE, 'readonly')
  const store = transaction.objectStore(PROJECTS_STORE)
  const records = await requestAsPromise<PersistedProjectMeta[]>(store.getAll())
  await transactionAsPromise(transaction)

  return records
    .slice()
    .sort((left, right) => {
      if (left.lastOpenedAt !== right.lastOpenedAt)
        return right.lastOpenedAt - left.lastOpenedAt
      if (left.updatedAt !== right.updatedAt)
        return right.updatedAt - left.updatedAt
      return right.createdAt - left.createdAt
    })
}

export async function createProject(name?: string): Promise<PersistedProjectMeta> {
  const database = await getDatabase()
  const now = Date.now()
  const project: PersistedProjectMeta = {
    id: createProjectId(),
    name: name?.trim() || buildDefaultProjectName(),
    createdAt: now,
    updatedAt: now,
    lastOpenedAt: now,
    schemaVersion: SCHEMA_VERSION,
  }

  const transaction = database.transaction(PROJECTS_STORE, 'readwrite')
  const store = transaction.objectStore(PROJECTS_STORE)
  store.put(project)
  await transactionAsPromise(transaction)

  return project
}

export async function deleteProject(projectId: string): Promise<void> {
  const database = await getDatabase()
  const transaction = database.transaction([PROJECTS_STORE, PROJECT_STATE_STORE], 'readwrite')
  transaction.objectStore(PROJECTS_STORE).delete(projectId)
  transaction.objectStore(PROJECT_STATE_STORE).delete(projectId)
  await transactionAsPromise(transaction)
}

export async function touchProject(projectId: string): Promise<PersistedProjectMeta | null> {
  const current = await readProjectMeta(projectId)
  if (!current)
    return null

  const next: PersistedProjectMeta = {
    ...current,
    updatedAt: Date.now(),
    lastOpenedAt: Date.now(),
  }

  const database = await getDatabase()
  const transaction = database.transaction(PROJECTS_STORE, 'readwrite')
  const store = transaction.objectStore(PROJECTS_STORE)
  store.put(next)
  await transactionAsPromise(transaction)

  return next
}

export async function saveProjectState(state: PersistedProjectState): Promise<void> {
  const database = await getDatabase()
  const now = Date.now()
  const currentMeta = await readProjectMeta(state.projectId)
  const persistedState: PersistedProjectState = {
    ...state,
    savedAt: now,
    schemaVersion: SCHEMA_VERSION,
  }

  const transaction = database.transaction([PROJECTS_STORE, PROJECT_STATE_STORE], 'readwrite')
  const projectStore = transaction.objectStore(PROJECTS_STORE)
  const stateStore = transaction.objectStore(PROJECT_STATE_STORE)

  stateStore.put(persistedState)

  if (currentMeta) {
    projectStore.put({
      ...currentMeta,
      updatedAt: now,
    })
  }

  await transactionAsPromise(transaction)
}

export async function loadProjectState(projectId: string): Promise<PersistedProjectState | null> {
  const database = await getDatabase()
  const transaction = database.transaction(PROJECT_STATE_STORE, 'readonly')
  const store = transaction.objectStore(PROJECT_STATE_STORE)
  const result = await requestAsPromise<PersistedProjectState | undefined>(store.get(projectId))
  await transactionAsPromise(transaction)
  return result ?? null
}
