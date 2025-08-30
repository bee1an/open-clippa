import { createPinia } from 'pinia'
import { createApp } from 'vue'
import { createRouter, createWebHistory } from 'vue-router'
import { routes } from 'vue-router/auto-routes'
import yyCraft from 'yy-craft'
import App from './App.vue'
import 'virtual:uno.css'

createApp(App)
  .use(yyCraft)
  .use(
    createRouter({
      history: createWebHistory(import.meta.env.BASE_URL),
      routes,
    }),
  )
  .use({
    install(_) {
    // console.log('123', _._context.components)
    },
  })
  .use(createPinia())
  .mount('#app')
