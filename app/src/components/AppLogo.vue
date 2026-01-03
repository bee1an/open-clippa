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
  <div
    select-none tracking-tight class="font-['Inter',-apple-system,BlinkMacSystemFont,sans-serif]"
    :class="[clickable ? 'cursor-pointer hover:text-blue-400' : '']"
    @click="handleClick"
  >
    <span :class="sizeClasses[size]" font-light text-gray-300>clippa</span>
  </div>
</template>
