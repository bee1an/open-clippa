import path from 'node:path'
import Vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import VueComponents from 'unplugin-vue-components/vite'

import VueRouter from 'unplugin-vue-router/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      '@clippa/': `${path.resolve(__dirname, '../packages')}/`,
    },
  },

  plugins: [
    VueRouter({
      dts: 'types/typed-router.d.ts',
    }),

    Vue(),

    AutoImport({
      imports: ['vue'],
      dts: 'types/auto-imports.d.ts',
    }),

    VueComponents({
      dts: 'types/components.d.ts',
    }),
  ],
})
