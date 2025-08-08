import { createApp } from 'vue'
import yyCraft from 'yy-craft'
import App from './App.vue'
import 'virtual:uno.css'

createApp(App).use(
  yyCraft,
).use({
  install(_) {
    // console.log('123', _._context.components)
  },
}).mount('#app')
