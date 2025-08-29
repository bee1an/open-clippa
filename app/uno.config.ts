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
})
