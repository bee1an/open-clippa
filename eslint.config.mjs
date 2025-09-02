import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  rules: {
    'no-new': 'off',
  },
  type: 'lib',
  pnpm: true,
  ignores: ['app/**'],
}, {
  rules: {
    'ts/consistent-type-definitions': 'off',
  },
})
