import type { SelectionStyle } from './types'

export interface SelectionTheme extends SelectionStyle {
  name: string
}

export const defaultTheme: SelectionTheme = {
  name: 'default',
  border: '2px solid #3b82f6',
  background: 'rgba(59, 130, 246, 0.1)',
  handleColor: '#3b82f6',
  handleSize: 10,
}

export const darkTheme: SelectionTheme = {
  name: 'dark',
  border: '2px solid #60a5fa',
  background: 'rgba(96, 165, 250, 0.15)',
  handleColor: '#60a5fa',
  handleSize: 10,
}

export const successTheme: SelectionTheme = {
  name: 'success',
  border: '2px solid #10b981',
  background: 'rgba(16, 185, 129, 0.1)',
  handleColor: '#10b981',
  handleSize: 10,
}

export const warningTheme: SelectionTheme = {
  name: 'warning',
  border: '2px solid #f59e0b',
  background: 'rgba(245, 158, 11, 0.1)',
  handleColor: '#f59e0b',
  handleSize: 10,
}

export const errorTheme: SelectionTheme = {
  name: 'error',
  border: '2px solid #ef4444',
  background: 'rgba(239, 68, 68, 0.1)',
  handleColor: '#ef4444',
  handleSize: 10,
}

export const themes = {
  default: defaultTheme,
  dark: darkTheme,
  success: successTheme,
  warning: warningTheme,
  error: errorTheme,
}

export type ThemeName = keyof typeof themes

export function getTheme(name: ThemeName = 'default'): SelectionTheme {
  return themes[name] || defaultTheme
}

export function mergeTheme(base: SelectionTheme, custom: SelectionStyle): SelectionTheme {
  return {
    ...base,
    ...custom,
  }
}
