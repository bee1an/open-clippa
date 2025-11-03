import path from 'node:path'
import Vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import AgentSync from 'unplugin-agent-sync/rollup'
import AutoImport from 'unplugin-auto-import/vite'
import VueComponents from 'unplugin-vue-components/vite'
import VueRouter from 'unplugin-vue-router/vite'
import { defineConfig } from 'vite'
import VueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  root: './app',
  resolve: {
    alias: {
      '@clippa/': `${path.resolve(__dirname, 'packages')}/`,
      '@/': `${path.resolve(__dirname, 'app/src')}/`,
    },
  },

  server: {
    port: 3333,
  },

  plugins: [

    VueRouter({
      routesFolder: 'src/pages',
      dts: 'types/typed-router.d.ts',
      root: './app',
    }),

    Vue(),

    AutoImport({
      imports: ['vue', '@vueuse/core', 'vue-router'],
      dts: 'types/auto-imports.d.ts',
    }),

    VueComponents({
      dts: 'types/components.d.ts',
    }),

    UnoCSS(),

    VueDevTools(),

    AgentSync(),
  ],
})
