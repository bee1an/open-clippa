<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@/lib/utils'

type ModalSize = 'sm' | 'md' | 'lg' | 'xl'

interface Props {
  modelValue: boolean
  title?: string
  showClose?: boolean
  closeOnOverlay?: boolean
  size?: ModalSize
  contentClass?: string
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  showClose: true,
  closeOnOverlay: true,
  size: 'md',
  contentClass: '',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'close': []
}>()

const sizeClass = computed(() => {
  const map: Record<ModalSize, string> = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-3xl',
    xl: 'max-w-5xl',
  }
  return map[props.size]
})

function closeModal() {
  emit('update:modelValue', false)
  emit('close')
}

function onOverlayClick() {
  if (props.closeOnOverlay)
    closeModal()
}
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="modelValue"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-black/70" @click="onOverlayClick" />
        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 scale-95"
          enter-to-class="opacity-100 scale-100"
          leave-active-class="transition duration-150 ease-in"
          leave-from-class="opacity-100 scale-100"
          leave-to-class="opacity-0 scale-95"
        >
          <div
            v-if="modelValue"
            :class="cn(
              'relative w-full bg-background-elevated border border-border rounded-lg shadow-lg overflow-hidden',
              sizeClass,
              contentClass,
            )"
            role="dialog"
            aria-modal="true"
            :aria-label="title || 'Dialog'"
            @click.stop
          >
            <div v-if="title || showClose" class="flex items-center justify-between px-4 py-3 border-b border-border">
              <div class="text-sm font-semibold text-foreground">
                {{ title }}
              </div>
              <button
                v-if="showClose"
                class="icon-btn icon-btn-sm"
                type="button"
                aria-label="Close"
                @click="closeModal"
              >
                <div class="i-ph-x-bold text-sm" />
              </button>
            </div>
            <div class="p-4">
              <slot />
            </div>
            <div v-if="$slots.footer" class="px-4 pb-4">
              <slot name="footer" />
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
