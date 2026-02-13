interface ImportMetaEnv {
  readonly VITE_ENABLE_TRANSITION?: string
  readonly VITE_TRANSITION_DEBUG?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
