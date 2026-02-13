import path from 'node:path'
import Vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AgentSync from 'unplugin-agent-sync/rollup'
import AutoImport from 'unplugin-auto-import/vite'
import VueComponents from 'unplugin-vue-components/vite'
import VueRouter from 'unplugin-vue-router/vite'
import { defineConfig, loadEnv } from 'vite'
import VueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname), '')
  const kimiUpstream = env.KIMI_UPSTREAM || 'https://integrate.api.nvidia.com'

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
