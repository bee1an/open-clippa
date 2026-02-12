import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['packages/**/__tests__/**/*.{test,spec}.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'json-summary'],
      reportsDirectory: './coverage/packages',
      all: true,
      include: ['packages/**/*.ts'],
      exclude: [
        'packages/**/__tests__/**/*.{test,spec}.ts',
        'packages/**/*.d.ts',
      ],
    },
  },
})
