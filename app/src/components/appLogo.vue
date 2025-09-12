<script setup lang="ts">
import { useRouter } from 'vue-router'

// Logo 组件，可以接收尺寸参数
interface Props {
  size?: 'sm' | 'md' | 'lg'
  clickable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  clickable: true,
})

const router = useRouter()

const sizeClasses = {
  sm: 'text-lg',
  md: 'text-xl',
  lg: 'text-2xl',
}

function handleClick() {
  if (props.clickable) {
    router.push('/')
  }
}
</script>

<template>
  <div class="logo-container" :class="{ 'cursor-pointer': clickable }" @click="handleClick">
    <span :class="sizeClasses[size]" class="font-light text-gray-300">clippa</span>
  </div>
</template>

<style scoped>
.logo-container {
  user-select: none;
  font-family:
    'Inter',
    -apple-system,
    BlinkMacSystemFont,
    sans-serif;
  letter-spacing: -0.02em;
}

.logo-container.cursor-pointer {
  cursor: pointer;
}

.logo-container.cursor-pointer:hover span:first-child {
  color: #60a5fa;
}
</style>
