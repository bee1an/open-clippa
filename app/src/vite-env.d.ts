/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_KIMI_BASE_URL?: string
  readonly VITE_KIMI_MODEL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
