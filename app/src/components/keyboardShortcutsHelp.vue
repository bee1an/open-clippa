<script setup lang="ts">
const showHelp = ref(false)

// 监听 ? 键显示帮助
useEventListener('keydown', (e: KeyboardEvent) => {
  if (e.code === 'Slash' && e.shiftKey) { // Shift + ?
    e.preventDefault()
    showHelp.value = !showHelp.value
  }
  if (e.code === 'Escape') {
    showHelp.value = false
  }
})

const shortcuts = [
  { key: '空格', description: '播放/暂停' },
  { key: '←', description: '快退 10 秒' },
  { key: '→', description: '快进 10 秒' },
  { key: 'F', description: '全屏/退出全屏' },
  { key: 'Esc', description: '退出全屏' },
  { key: '?', description: '显示/隐藏快捷键帮助' },
]
</script>

<template>
  <!-- 帮助按钮 -->
  <button
    fixed bottom-4 right-4 w-10 h-10 rounded-full bg="#13131b" hover:bg="#505067"
    flex items-center justify-center text-white cursor-pointer border-none outline-none
    transition-all duration-200 z-50 title="快捷键帮助 (?)"
    @click="showHelp = !showHelp"
  >
    <div class="i-carbon-help" text-lg />
  </button>

  <!-- 帮助面板 -->
  <div
    v-if="showHelp"
    class="bg-black/50 z-100"
    fixed inset-0 flex items-center justify-center
    @click="showHelp = false"
  >
    <div
      bg="#1e1e29" rounded-lg p-6 max-w-sm w-full mx-4 border="~ #505067"
      @click.stop
    >
      <div flex items-center justify-between mb-4>
        <h3 text-lg font-semibold text-white>
          快捷键
        </h3>
        <button
          w-6 h-6 rounded hover:bg="#505067" flex items-center justify-center
          text="#838398" hover:text-white transition-colors cursor-pointer
          border-none outline-none
          @click="showHelp = false"
        >
          <div class="i-carbon-close" text-sm />
        </button>
      </div>

      <div space-y-3>
        <div
          v-for="shortcut in shortcuts"
          :key="shortcut.key"
          flex items-center justify-between
        >
          <span text="#838398" text-sm>{{ shortcut.description }}</span>
          <kbd
            bg="#13131b" text-white px-2 py-1 rounded text-xs font-mono
            border="~ #505067"
          >
            {{ shortcut.key }}
          </kbd>
        </div>
      </div>
    </div>
  </div>
</template>
