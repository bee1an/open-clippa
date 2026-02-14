import type { EditorControlActionResult } from './types'

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
}

export function asString(value: unknown): string | null {
  if (typeof value !== 'string')
    return null

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
}

export function asOptionalString(value: unknown): string | undefined {
  const next = asString(value)
  return next === null ? undefined : next
}

export function asFiniteNumber(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value))
    return null
  return value
}

export function asOptionalFiniteNumber(value: unknown): number | undefined {
  const next = asFiniteNumber(value)
  return next === null ? undefined : next
}

export function asOptionalBoolean(value: unknown): boolean | undefined {
  if (typeof value !== 'boolean')
    return undefined
  return value
}

export function normalizeLimit(
  value: unknown,
  fallback: number,
  max: number,
): number {
  const parsed = asFiniteNumber(value)
  if (parsed === null)
    return fallback

  return Math.max(1, Math.min(max, Math.floor(parsed)))
}

export function invalidArgument(message: string): EditorControlActionResult {
  return {
    ok: false,
    error: {
      code: 'INVALID_ARGUMENT',
      message,
    },
  }
}
