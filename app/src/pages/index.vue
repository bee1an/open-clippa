<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()

// 3秒后自动跳转到编辑器
onMounted(() => {
  setTimeout(() => {
    router.push('/editor/media')
  }, 3000)
})

function goToEditor() {
  router.push('/editor/media')
}
</script>

<template>
  <div
    class="welcome-page" w-screen h-screen flex items-center justify-center bg-gradient-to-br from-gray-900
    via-gray-800 to-gray-900 @click="goToEditor"
  >
    <div class="welcome-content" flex="~ col" items-center gap-8>
      <AppLogoLarge />

      <div class="welcome-actions" flex="~ col" items-center gap-4>
        <p class="text-gray-400 text-sm">
          点击任意位置或等待 3 秒自动进入
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.welcome-page {
  cursor: pointer;
  overflow: hidden;
  position: relative;
}

.welcome-page::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background:
    radial-gradient(circle at 20% 80%, rgba(59, 130, 246, 0.1) 0%, transparent 50%),
    radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.1) 0%, transparent 50%);
  pointer-events: none;
}

.welcome-content {
  position: relative;
  z-index: 1;
  animation: fadeInUp 1s ease-out;
}

.start-button {
  position: relative;
  overflow: hidden;
}

.start-button::before {
  content: '';
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.2), transparent);
  transition: left 0.5s;
}

.start-button:hover::before {
  left: 100%;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
