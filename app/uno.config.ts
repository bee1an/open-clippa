import {
  defineConfig,
  presetAttributify,
  presetIcons,
  presetWind4,
} from 'unocss'

export default defineConfig({
  presets: [presetWind4(), presetAttributify(), presetIcons({
    scale: 1.2,
    warn: true,
  })],

  shortcuts: [
    ['center', 'flex items-center justify-center'],
  ],

  animations: {
    shimmer: 'shimmer 2s infinite',
  },

  keyframes: {
    shimmer: {
      '0%': { transform: 'translateX(-100%)' },
      '100%': { transform: 'translateX(100%)' },
    },
  },
})
