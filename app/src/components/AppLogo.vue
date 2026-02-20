<script setup lang="ts">
import { useRouter } from 'vue-router'
import logoSvg from '@/assets/logo.svg?raw'

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
    <span class="app-logo__icon" :class="iconSizeClasses[size]" v-html="logoSvg" />
    <span
      class="app-logo__text"
      font-bold bg-clip-text text-transparent tracking-tight
      :class="sizeClasses[size]"
    >
      lippc
    </span>
  </div>
</template>

<style scoped>
.app-logo__icon {
  display: inline-block;
  color: hsl(var(--logo-accent-start));
}

.app-logo__icon :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}

.app-logo__text {
  background-image: linear-gradient(
    90deg,
    hsl(var(--logo-accent-start)),
    hsl(var(--logo-accent-end))
  );
}
</style>
