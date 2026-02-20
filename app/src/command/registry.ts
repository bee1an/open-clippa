import type {
  CommandActionResult,
  EditorCommand,
} from '@/command/types'

export type CommandRegistryHandler = (
  command: EditorCommand,
) => Promise<CommandActionResult> | CommandActionResult

export interface CommandRegistry {
  register: (commandType: string, handler: CommandRegistryHandler) => void
  unregister: (commandType: string) => void
  resolve: (commandType: string) => CommandRegistryHandler | null
  clear: () => void
}

export function createCommandRegistry(): CommandRegistry {
  const handlers = new Map<string, CommandRegistryHandler>()

  const register = (commandType: string, handler: CommandRegistryHandler): void => {
    handlers.set(commandType, handler)
  }

  const unregister = (commandType: string): void => {
    handlers.delete(commandType)
  }

  const resolve = (commandType: string): CommandRegistryHandler | null => {
    return handlers.get(commandType) ?? null
  }

  const clear = (): void => {
    handlers.clear()
  }

  return {
    register,
    unregister,
    resolve,
    clear,
  }
}
