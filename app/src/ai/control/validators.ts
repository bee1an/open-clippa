import type { ActionErrorCode, ActionResult } from './types'

export function success<T>(data: T): ActionResult<T> {
  return {
    ok: true,
    data,
  }
}

export function failure(
  code: ActionErrorCode,
  message: string,
  details?: unknown,
): ActionResult<never> {
  return {
    ok: false,
    error: {
      code,
      message,
      details,
    },
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function toRecord(value: unknown): Record<string, unknown> {
  return isRecord(value) ? value : {}
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

export function asBoolean(value: unknown): boolean | null {
  if (typeof value !== 'boolean')
    return null
  return value
}

export function asOptionalBoolean(value: unknown): boolean | undefined {
  const next = asBoolean(value)
  return next === null ? undefined : next
}

export function asString(value: unknown): string | null {
  if (typeof value !== 'string')
    return null

  const normalized = value.trim()
  if (normalized.length === 0)
    return null

  return normalized
}

export function asOptionalString(value: unknown): string | undefined {
  const next = asString(value)
  return next === null ? undefined : next
}

export function asArray(value: unknown): unknown[] | null {
  if (!Array.isArray(value))
    return null
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

export function ensureFiniteNumber(
  value: unknown,
  fieldName: string,
): ActionResult<never> | number {
  const parsed = asFiniteNumber(value)
  if (parsed === null)
    return failure('INVALID_ARGUMENT', `${fieldName} must be a finite number`)

  return parsed
}

export function ensureString(
  value: unknown,
  fieldName: string,
): ActionResult<never> | string {
  const parsed = asString(value)
  if (!parsed)
    return failure('INVALID_ARGUMENT', `${fieldName} must be a non-empty string`)

  return parsed
}
