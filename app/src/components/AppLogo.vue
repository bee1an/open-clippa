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
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
}

const iconSizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
}

function handleClick() {
  if (props.clickable) {
    router.push('/')
  }
}
</script>

<template>
  <div
    select-none tracking-tight font-sans flex items-end transition-opacity duration-200
    :class="[clickable ? 'cursor-pointer hover:opacity-80' : '']"
    @click="handleClick"
  >
    <img src="/logo.svg" alt="Logo" class="object-contain" :class="iconSizeClasses[size]">
    <span
      font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent tracking-tight
      :class="sizeClasses[size]"
    >
      lippc
    </span>
  </div>
</template>
