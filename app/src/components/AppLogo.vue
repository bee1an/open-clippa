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

function handleClick() {
  if (props.clickable) {
    router.push('/')
  }
}
</script>

<template>
  <div
    select-none tracking-tight font-sans flex items-center gap-2 transition-opacity duration-200
    :class="[clickable ? 'cursor-pointer hover:opacity-80' : '']"
    @click="handleClick"
  >
    <span
      font-bold text-foreground tracking-tight
      :class="sizeClasses[size]"
    >
      clippa
    </span>
  </div>
</template>
