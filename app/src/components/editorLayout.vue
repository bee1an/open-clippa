<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, toRefs, watch } from 'vue'
import { useKeyboardShortcuts } from '@/composables/useKeyboardShortcuts'
import { useEditorStore } from '@/store'
import AppLogo from './appLogo.vue'
import Canvas from './canvas.vue'
import KeyboardShortcutsHelp from './keyboardShortcutsHelp.vue'
import TimelineWrapper from './timelineWrapper.vue'
import VideoExporter from './videoExporter.vue'
import VideoPreviewList from './videoPreviewList.vue'

// Store
const editorStore = useEditorStore()
const { clippa, currentTime, duration, isPlaying, selectedVideo } = toRefs(editorStore)

// 状态
const showSettings = ref(false)
const showHelp = ref(false)

// 视频属性
const selectedVideoProperties = ref({
  width: 1920,
  height: 1080,
  x: 0,
  y: 0,
})

// 计算属性
const hasVideos = computed(() => clippa.value?.theater.performers.length > 0)
const videoCount = computed(() => clippa.value?.theater.performers.length || 0)

const statusText = computed(() => {
  if (isPlaying.value)
    return '播放中'
  if (hasVideos.value)
    return '就绪'
  return '等待视频'
})

const currentTimeFormatted = computed(() => {
  return formatTime(currentTime.value)
})

const durationFormatted = computed(() => {
  return formatTime(duration.value)
})

// 方法
function formatTime(microseconds: number): string {
  const seconds = Math.floor(microseconds / 1000000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
}

function handlePlay() {
  clippa.value?.play()
}

function handlePause() {
  clippa.value?.pause()
}

function handleStop() {
  clippa.value?.seek(0)
  clippa.value?.pause()
}

function updateVideoProperties() {
  if (selectedVideo.value && selectedVideo.value.sprite) {
    selectedVideo.value.sprite.width = selectedVideoProperties.value.width
    selectedVideo.value.sprite.height = selectedVideoProperties.value.height
    selectedVideo.value.sprite.x = selectedVideoProperties.value.x
    selectedVideo.value.sprite.y = selectedVideoProperties.value.y
  }
}

// 监听选中视频变化
watch(selectedVideo, (newVideo) => {
  if (newVideo && newVideo.sprite) {
    selectedVideoProperties.value = {
      width: newVideo.sprite.width || 1920,
      height: newVideo.sprite.height || 1080,
      x: newVideo.sprite.x || 0,
      y: newVideo.sprite.y || 0,
    }
  }
  else {
    selectedVideoProperties.value = {
      width: 1920,
      height: 1080,
      x: 0,
      y: 0,
    }
  }
})

// 键盘快捷键
const { setupShortcuts, cleanupShortcuts } = useKeyboardShortcuts()

// 生命周期
onMounted(() => {
  setupShortcuts()

  // 初始化键盘快捷键
  const handleKeydown = (e: KeyboardEvent) => {
    if (e.key === 'h' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      showHelp.value = !showHelp.value
    }

    if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      showSettings.value = !showSettings.value
    }
  }

  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  cleanupShortcuts()
  document.removeEventListener('keydown', localStorage.getItem('keydown-handler') as any)
})
</script>

<template>
  <div class="editor-layout">
    <!-- 顶部工具栏 -->
    <div class="toolbar">
      <div class="toolbar-left">
        <AppLogo :size="32" />
        <h1 class="app-title">
          Open Clippa
        </h1>
      </div>

      <div class="toolbar-center">
        <!-- 播放控制 -->
        <div class="playback-controls">
          <button :disabled="isPlaying || !hasVideos" class="control-btn" @click="handlePlay">
            <span v-if="!isPlaying">▶️</span>
            <span v-else>⏸️</span>
          </button>
          <button :disabled="!isPlaying" class="control-btn" @click="handlePause">
            ⏹️
          </button>
          <button :disabled="!hasVideos" class="control-btn" @click="handleStop">
            ⏹️ 停止
          </button>
        </div>
      </div>

      <div class="toolbar-right">
        <!-- 导出按钮 -->
        <VideoExporter :clippa="clippa" />

        <!-- 设置按钮 -->
        <button class="icon-btn" @click="showSettings = true">
          ⚙️
        </button>
      </div>
    </div>

    <!-- 主要内容区域 -->
    <div class="main-content">
      <!-- 左侧视频列表 -->
      <div class="side-panel">
        <VideoPreviewList />
      </div>

      <!-- 中间编辑区域 -->
      <div class="editor-area">
        <!-- 画布区域 -->
        <div class="canvas-container">
          <Canvas v-if="editorStore.clippa" />
        </div>

        <!-- 时间轴区域 -->
        <div class="timeline-container">
          <TimelineWrapper />
        </div>
      </div>

      <!-- 右侧属性面板 -->
      <div class="properties-panel">
        <div class="panel-header">
          <h3>属性</h3>
        </div>
        <div class="panel-content">
          <div v-if="selectedVideo" class="video-properties">
            <div class="property-item">
              <label>宽度</label>
              <input v-model.number="selectedVideoProperties.width" type="number" @change="updateVideoProperties">
            </div>
            <div class="property-item">
              <label>高度</label>
              <input v-model.number="selectedVideoProperties.height" type="number" @change="updateVideoProperties">
            </div>
            <div class="property-item">
              <label>X 位置</label>
              <input v-model.number="selectedVideoProperties.x" type="number" @change="updateVideoProperties">
            </div>
            <div class="property-item">
              <label>Y 位置</label>
              <input v-model.number="selectedVideoProperties.y" type="number" @change="updateVideoProperties">
            </div>
          </div>
          <div v-else class="no-selection">
            <p>选择一个视频以编辑属性</p>
          </div>
        </div>
      </div>
    </div>

    <!-- 状态栏 -->
    <div class="status-bar">
      <div class="status-left">
        <span>状态: {{ statusText }}</span>
      </div>
      <div class="status-center">
        <span>时间: {{ currentTimeFormatted }} / {{ durationFormatted }}</span>
      </div>
      <div class="status-right">
        <span>视频: {{ videoCount }} 个</span>
      </div>
    </div>

    <!-- 键盘快捷键帮助 -->
    <KeyboardShortcutsHelp v-if="showHelp" @close="showHelp = false" />
  </div>
</template>

<style scoped>
.editor-layout {
  width: 100vw;
  height: 100vh;
  background: #0f0f23;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.toolbar {
  height: 60px;
  background: #1a1a2e;
  border-bottom: 1px solid #2d3748;
  display: flex;
  align-items: center;
  padding: 0 20px;
  justify-content: space-between;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.app-title {
  margin: 0;
  color: #e2e8f0;
  font-size: 20px;
  font-weight: 600;
}

.toolbar-center {
  display: flex;
  align-items: center;
}

.toolbar-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.playback-controls {
  display: flex;
  gap: 8px;
}

.control-btn {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: 1px solid #4a5568;
  background: #2d3748;
  color: #e2e8f0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 14px;
  transition: all 0.2s ease;
}

.control-btn:hover:not(:disabled) {
  background: #4a5568;
  border-color: #667eea;
}

.control-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.icon-btn {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  border: 1px solid #4a5568;
  background: #2d3748;
  color: #e2e8f0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  font-size: 16px;
  transition: all 0.2s ease;
}

.icon-btn:hover {
  background: #4a5568;
  border-color: #667eea;
}

.main-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.side-panel {
  width: 280px;
  background: #1a1a2e;
  border-right: 1px solid #2d3748;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.editor-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #0f0f23;
}

.canvas-container {
  flex: 1;
  background: #0a0a0f;
  border-bottom: 1px solid #2d3748;
  position: relative;
  min-height: 400px;
}

.timeline-container {
  height: 200px;
  background: #1a1a2e;
  border-top: 1px solid #2d3748;
}

.properties-panel {
  width: 300px;
  background: #1a1a2e;
  border-left: 1px solid #2d3748;
  display: flex;
  flex-direction: column;
}

.panel-header {
  height: 50px;
  border-bottom: 1px solid #2d3748;
  display: flex;
  align-items: center;
  padding: 0 20px;
}

.panel-header h3 {
  margin: 0;
  color: #e2e8f0;
  font-size: 16px;
  font-weight: 500;
}

.panel-content {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.video-properties {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.property-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.property-item label {
  color: #a0aec0;
  font-size: 14px;
  font-weight: 500;
}

.property-item input {
  padding: 8px 12px;
  background: #2d3748;
  border: 1px solid #4a5568;
  border-radius: 6px;
  color: #e2e8f0;
  font-size: 14px;
  transition: all 0.2s ease;
}

.property-item input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.no-selection {
  color: #a0aec0;
  text-align: center;
  margin-top: 40px;
}

.status-bar {
  height: 30px;
  background: #1a1a2e;
  border-top: 1px solid #2d3748;
  display: flex;
  align-items: center;
  padding: 0 20px;
  justify-content: space-between;
}

.status-left,
.status-center,
.status-right {
  display: flex;
  align-items: center;
  gap: 20px;
}

.status-left span,
.status-center span,
.status-right span {
  color: #a0aec0;
  font-size: 12px;
}

/* 响应式设计 */
@media (max-width: 1200px) {
  .side-panel {
    width: 240px;
  }

  .properties-panel {
    width: 250px;
  }
}

@media (max-width: 768px) {
  .side-panel,
  .properties-panel {
    position: absolute;
    z-index: 100;
    height: 100%;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
  }

  .side-panel.open,
  .properties-panel.open {
    transform: translateX(0);
  }

  .toolbar {
    padding: 0 12px;
  }

  .app-title {
    font-size: 16px;
  }

  .timeline-container {
    height: 150px;
  }
}
</style>
