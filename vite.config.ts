import path from 'node:path'
import Vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AgentSync from 'unplugin-agent-sync/rollup'
import AutoImport from 'unplugin-auto-import/vite'
import VueComponents from 'unplugin-vue-components/vite'
import VueRouter from 'unplugin-vue-router/vite'
import { defineConfig, loadEnv } from 'vite'
import VueDevTools from 'vite-plugin-vue-devtools'

const KEY_SOURCE_HEADER = 'x-clippc-key-source'

function resolveHeaderValue(value: string | string[] | undefined): string | null {
  if (typeof value === 'string') {
    const normalized = value.trim()
    return normalized.length > 0 ? normalized : null
  }

  if (Array.isArray(value)) {
    const first = value[0]?.trim()
    return first || null
  }

  return null
}

function resolveKeySource(value: string | string[] | undefined): 'managed' | 'byok' {
  const normalized = resolveHeaderValue(value)?.toLowerCase()
  return normalized === 'byok' ? 'byok' : 'managed'
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname), '')
  const kimiUpstream = env.KIMI_UPSTREAM || 'https://integrate.api.nvidia.com'
  const kimiApiKey = env.KIMI_API_KEY?.trim() || ''

  return {
    root: './app',
    envDir: path.resolve(__dirname),
    resolve: {
      alias: {
        '@clippc/': `${path.resolve(__dirname, 'packages')}/`,
        '@/': `${path.resolve(__dirname, 'app/src')}/`,
      },
    },

    server: {
      port: 3333,
      proxy: {
        '/api/kimi': {
          target: kimiUpstream,
          changeOrigin: true,
          secure: true,
          rewrite: requestPath => requestPath.replace(/^\/api\/kimi/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              const keySource = resolveKeySource(req.headers[KEY_SOURCE_HEADER])
              const authorization = resolveHeaderValue(req.headers.authorization)
              proxyReq.removeHeader(KEY_SOURCE_HEADER)

              if (keySource === 'byok' && authorization) {
                proxyReq.setHeader('authorization', authorization)
                return
              }

              if (kimiApiKey) {
                proxyReq.setHeader('authorization', `Bearer ${kimiApiKey}`)
                return
              }

              if (authorization) {
                proxyReq.setHeader('authorization', authorization)
                return
              }

              proxyReq.removeHeader('authorization')
            })
          },
        },
      },
    },

    plugins: [

      VueRouter({
        routesFolder: 'src/pages',
        root: './app',
      }),

      Vue(),

      AutoImport({
        imports: ['vue', '@vueuse/core', 'vue-router'],
      }),

      VueComponents(),

      UnoCSS(),

      VueDevTools(),

      AgentSync(),
    ],
  }
})
