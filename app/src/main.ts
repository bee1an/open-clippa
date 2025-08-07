import { createApp } from 'vue'
import yyCraft from 'yy-craft'
import App from './App.vue'
import 'virtual:uno.css'

createApp(App).use(
  yyCraft,
).mount('#app')
