import path from 'node:path'

export const root = path.resolve(import.meta.dirname, '..', '..')

export const workspaceYaml = path.resolve(root, 'pnpm-workspace.yaml')
