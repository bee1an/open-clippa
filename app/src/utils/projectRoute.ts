import type { LocationQueryRaw, RouteLocationRaw } from 'vue-router'

function normalizeProjectId(value: string | null | undefined): string | null {
  const normalized = value?.trim()
  if (!normalized)
    return null
  return normalized
}

function normalizePath(path: string): string {
  if (!path.startsWith('/'))
    return `/${path}`
  return path
}

export function resolveRouteProjectId(value: string | string[] | null | undefined): string | null {
  if (Array.isArray(value))
    return normalizeProjectId(value[0] ?? null)

  if (typeof value === 'string')
    return normalizeProjectId(value)

  return null
}

export function buildRouteWithProjectId(
  path: string,
  projectId: string | null | undefined,
  query: LocationQueryRaw = {},
): RouteLocationRaw {
  const normalizedPath = normalizePath(path)
  const normalizedProjectId = normalizeProjectId(projectId)
  if (!normalizedProjectId)
    return { path: normalizedPath, query }

  return {
    path: `/${normalizedProjectId}${normalizedPath}`,
    query,
  }
}
