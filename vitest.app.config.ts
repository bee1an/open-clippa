import path from 'node:path'
import Vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  root: './app',
  resolve: {
    alias: {
      '@clippc/': `${path.resolve(__dirname, 'packages')}/`,
      '@/': `${path.resolve(__dirname, 'app/src')}/`,
    },
  },
  plugins: [Vue()],
  test: {
    environment: 'node',
    include: ['src/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'json-summary'],
      reportsDirectory: '../coverage/app',
      all: true,
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.{test,spec}.ts',
        'src/**/*.d.ts',
      ],
    },
  },
})
