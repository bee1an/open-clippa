<script setup lang="ts">
// 类型导入（按字母顺序）
import type { Clippa } from 'open-clippa'
import type { ExportOptions, ExportProgress, MediaItem } from '../../../packages/export/src/types'

// 外部依赖导入
import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue'

// 内部包导入
import { CompatibilityUtils, ExportErrorHandler, VideoExporter } from '../../../packages/export/src'

// Props
interface Props {
  clippa?: Clippa
}

const props = defineProps<Props>()

// 状态
const showExportModal = ref(false)
const isExporting = ref(false)
const browserSupported = ref(false)
const exportProgress = ref(0)
const filename = ref('')
const currentExporter = ref<VideoExporter | null>(null)

// 导出详情
const exportDetails = reactive({
  loaded: 0,
  total: 0,
  stage: '' as ExportProgress['stage'],
  message: '' as string,
})

// 导出选项
const exportOptions = reactive<ExportOptions>({
  quality: 'medium',
  width: 1920,
  height: 1080,
  bitrate: 5000000,
  frameRate: 30,
  audio: true,
  bgColor: '#000000',
  videoCodec: 'avc1.42E032',
})

// 分辨率预设
const resolutionPreset = ref('1080p')

// 预设映射
const resolutionPresets = {
  '480p': { width: 854, height: 480, bitrate: 2000000 },
  '720p': { width: 1280, height: 720, bitrate: 4000000 },
  '1080p': { width: 1920, height: 1080, bitrate: 5000000 },
  '4k': { width: 3840, height: 2160, bitrate: 20000000 },
}

// 质量预设
const qualityPresets = {
  low: { bitrate: 0.7 },
  medium: { bitrate: 1.0 },
  high: { bitrate: 1.5 },
}

// 导出相关状态（使用 ref 而非 computed）
const videoCount = ref(0)
const videoDuration = ref(0)
const mediaItems = ref<MediaItem[]>([])

// 计算属性
const hasVideos = computed(() => {
  return videoCount.value > 0
})

const estimatedFileSize = computed(() => {
  const duration = videoDuration.value / 1000 // 转换为秒
  const bitrate = (exportOptions.bitrate || 5000000) / 1000000 // 转换为 Mbps，默认 5Mbps
  const estimatedSize = (bitrate * duration) / 8 // MB
  return formatFileSize(estimatedSize * 1024 * 1024)
})

// 更新导出相关状态的方法
function updateExportState() {
  if (!props.clippa?.theater?.performers) {
    videoCount.value = 0
    videoDuration.value = 0
    mediaItems.value = []
    return
  }

  const performers = props.clippa.theater.performers

  // 更新视频数量
  videoCount.value = performers.length

  // 计算时间轴总时长
  if (performers.length === 0) {
    videoDuration.value = 0
    mediaItems.value = []
  }
  else {
    let timelineStart = Infinity
    let timelineEnd = 0

    const newMediaItems: MediaItem[] = performers.map((performer) => {
      const videoStart = performer.start || 0
      const videoEnd = videoStart + (performer.duration || 5000)

      timelineStart = Math.min(timelineStart, videoStart)
      timelineEnd = Math.max(timelineEnd, videoEnd)

      // 类型断言：performer 可能有额外的媒体属性
      const performerWithMedia = performer as any
      return {
        src: performerWithMedia.src || performerWithMedia.url || '',
        start: performer.start || 0,
        duration: performer.duration || 5000,
        position: {
          x: performerWithMedia.x || 0,
          y: performerWithMedia.y || 0,
          width: performerWithMedia.width || 1920,
          height: performerWithMedia.height || 1080,
        },
        playbackRate: performerWithMedia.playbackRate || 1,
        volume: performerWithMedia.volume || 1,
        muted: performerWithMedia.muted || false,
      }
    })

    videoDuration.value = timelineEnd - timelineStart
    mediaItems.value = newMediaItems
  }

  console.warn('导出状态已更新:', {
    videoCount: videoCount.value,
    videoDuration: videoDuration.value,
    mediaItemsCount: mediaItems.value.length,
    hasVideos: hasVideos.value,
  })
}

// 方法
function closeModal() {
  if (!isExporting.value) {
    showExportModal.value = false
    resetExportState()
  }
}

function openModal() {
  console.warn('=== 导出按钮被点击 ===')
  console.warn('打开导出模态框，调试信息:')
  console.warn('- hasVideos:', hasVideos.value)
  console.warn('- videoCount:', videoCount.value)
  console.warn('- 浏览器支持:', browserSupported.value)
  console.warn('- performers 数量:', props.clippa?.theater?.performers?.length || 0)
  console.warn('- 按钮禁用状态:', isExporting.value || !hasVideos.value)

  // 强制显示模态框进行调试
  showExportModal.value = true
  console.warn('- 模态框状态:', showExportModal.value)
}

function resetExportState() {
  exportProgress.value = 0
  exportDetails.loaded = 0
  exportDetails.total = 0
  exportDetails.stage = undefined
  exportDetails.message = ''

  // 清理导出器
  if (currentExporter.value) {
    currentExporter.value.destroy()
    currentExporter.value = null
  }
}

function formatDuration(milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function formatFileSize(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB']
  if (bytes === 0)
    return '0 B'

  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const size = Math.round(bytes / 1024 ** i * 100) / 100

  return `${size} ${sizes[i]}`
}

function updateExportOptions() {
  // 根据分辨率预设更新选项
  const preset = resolutionPresets[resolutionPreset.value as keyof typeof resolutionPresets]
  if (preset) {
    exportOptions.width = preset.width
    exportOptions.height = preset.height
  }

  // 根据质量调整比特率
  const qualityMultiplier = qualityPresets[exportOptions.quality as keyof typeof qualityPresets]
  if (qualityMultiplier) {
    const baseBitrate = resolutionPresets[resolutionPreset.value as keyof typeof resolutionPresets]?.bitrate || 5000000
    exportOptions.bitrate = Math.round(baseBitrate * qualityMultiplier.bitrate)
  }
}

// 使用新的导出API，不需要轮询机制
// 进度通过事件监听器自动更新

function downloadBlobDirectly(blob: Blob, filename: string) {
  try {
    // 创建下载链接
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename.endsWith('.mp4') ? filename : `${filename}.mp4`

    // 触发下载
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)

    // 清理URL
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }
  catch (error) {
    console.error('视频下载失败:', error)
  }
}

async function startExport() {
  console.warn('=== 开始导出被点击 ===')
  console.warn('开始导出，调试信息:')
  console.warn('- 浏览器支持:', browserSupported.value)
  console.warn('- 媒体文件数量:', mediaItems.value.length)
  console.warn('- hasVideos:', hasVideos.value)
  console.warn('- videoCount:', videoCount.value)
  console.warn('- clippa 对象:', !!props.clippa)
  console.warn('- theater 对象:', !!props.clippa?.theater)
  console.warn('- performers 数量:', props.clippa?.theater?.performers?.length || 0)
  console.warn('- VideoExporter 类:', typeof VideoExporter)

  if (!browserSupported.value) {
    const error = ExportErrorHandler.createError('UNSUPPORTED_FORMAT', '您的浏览器不支持视频导出功能')
    console.error(error.message)
    return
  }

  if (mediaItems.value.length === 0) {
    const error = ExportErrorHandler.createError('INVALID_OPTIONS', '没有有效的媒体文件')
    console.error(error.message)
    console.warn('mediaItems 为空，可能原因:')
    console.warn('- performers:', props.clippa?.theater?.performers)
    return
  }

  try {
    isExporting.value = true
    updateExportOptions()

    // 创建新的导出器实例
    currentExporter.value = new VideoExporter(mediaItems.value, exportOptions)

    // 监听进度更新
    currentExporter.value.onProgress((progress: ExportProgress) => {
      exportProgress.value = progress.progress
      exportDetails.loaded = progress.loaded
      exportDetails.total = progress.total
      exportDetails.stage = progress.stage || undefined
      exportDetails.message = progress.message || ''
    })

    // 监听状态变更
    currentExporter.value.onStatusChange((status: string) => {
      console.warn('导出状态变更:', status)
      if (status === 'completed') {
        isExporting.value = false
        showExportModal.value = false
        resetExportState()
      }
      else if (status === 'error') {
        isExporting.value = false
      }
    })

    // 监听完成事件
    const progressTracker = currentExporter.value.getProgressTracker()

    progressTracker.on('completed', (result: any) => {
      const finalFilename = filename.value.trim() || `clippa-export-${Date.now()}`
      downloadBlobDirectly(result.blob, finalFilename)

      isExporting.value = false
      showExportModal.value = false
      resetExportState()
    })

    // 监听错误事件
    progressTracker.on('error', (error: any) => {
      console.error('导出错误:', error)
      const userMessage = ExportErrorHandler.getUserFriendlyMessage(error)
      console.error('用户提示:', userMessage)
      const solutions = ExportErrorHandler.getErrorSolution(error)
      console.error('解决方案:', solutions)

      isExporting.value = false
    })

    // 开始导出
    await currentExporter.value.export()
  }
  catch (error) {
    console.error('导出启动失败:', error)
    const exportError = ExportErrorHandler.handleError(error, 'startExport')
    const userMessage = ExportErrorHandler.getUserFriendlyMessage(exportError)
    console.error('用户提示:', userMessage)

    isExporting.value = false
    resetExportState()
  }
}

// 监听分辨率和质量变化
watch(resolutionPreset, updateExportOptions)
watch(() => exportOptions.quality, updateExportOptions)

// 监听 clippa 实例变化
watch(() => props.clippa, (newClippa, oldClippa) => {
  console.warn('Clippa 实例发生变化:', { newClippa: !!newClippa, oldClippa: !!oldClippa })

  // 移除旧的事件监听器
  if (oldClippa?.theater) {
    oldClippa.theater.off('hire', updateExportState)
  }

  // 添加新的事件监听器并初始化状态
  if (newClippa) {
    checkBrowserSupport()

    // 监听 theater 的 hire 事件
    newClippa.theater.on('hire', updateExportState)

    // 初始化导出状态
    updateExportState()
  }
}, { immediate: true })

// 检查浏览器支持
async function checkBrowserSupport() {
  try {
    // 使用新的兼容性检测工具
    const report = CompatibilityUtils.getCompatibilityReport()
    browserSupported.value = report.webCodecs && report.supportedFormats.includes('mp4')

    // 输出兼容性信息用于调试
    console.warn('浏览器兼容性报告:', report)
    if (!browserSupported.value) {
      console.warn('浏览器不支持视频导出，建议:', report.recommendations)
    }
  }
  catch (error) {
    // 浏览器支持检测失败
    console.error('兼容性检测失败:', error)
    browserSupported.value = false
  }
}

// 生命周期
onMounted(() => {
  checkBrowserSupport()
})

onUnmounted(() => {
  // 清理导出器
  resetExportState()

  // 清理事件监听器
  if (props.clippa?.theater) {
    props.clippa.theater.off('hire', updateExportState)
  }
})
</script>

<template>
  <div class="video-exporter">
    <!-- 导出按钮 -->
    <button
      v-if="props.clippa"
      :disabled="isExporting || !hasVideos"
      class="export-button"
      :class="[
        {
          disabled: isExporting,
          exporting: isExporting,
        },
      ]" @click="openModal"
    >
      <span v-if="!isExporting" class="icon">📥</span>
      <span v-else class="spinner">⏳</span>
      {{ isExporting ? '导出中...' : '导出视频' }}
    </button>

    <!-- 加载状态 -->
    <div v-else class="loading-indicator">
      <span class="spinner">⏳</span>
      <span>初始化中...</span>
    </div>

    <!-- 导出模态框 -->
    <div v-if="showExportModal" class="modal-overlay" @click.self="closeModal">
      <div class="modal-content">
        <div class="modal-header">
          <h3>导出视频设置</h3>
          <button class="close-button" @click="closeModal">
            &times;
          </button>
        </div>

        <div class="modal-body">
          <!-- 基础设置 -->
          <div class="settings-section">
            <h4>基础设置</h4>

            <div class="setting-item">
              <label for="quality">视频质量</label>
              <select id="quality" v-model="exportOptions.quality" class="quality-select">
                <option value="low">
                  低质量 (小文件)
                </option>
                <option value="medium">
                  中等质量
                </option>
                <option value="high">
                  高质量 (大文件)
                </option>
              </select>
            </div>

            <div class="setting-item">
              <label for="resolution">分辨率</label>
              <select id="resolution" v-model="resolutionPreset" class="resolution-select">
                <option value="480p">
                  480p (854×480)
                </option>
                <option value="720p">
                  720p (1280×720)
                </option>
                <option value="1080p" selected>
                  1080p (1920×1080)
                </option>
                <option value="4k">
                  4K (3840×2160)
                </option>
              </select>
            </div>

            <div class="setting-item">
              <label for="filename">文件名</label>
              <input
                id="filename"
                v-model="filename"
                type="text"
                placeholder="输入文件名（不含扩展名）"
                class="filename-input"
              >
            </div>
          </div>

          <!-- 高级设置 -->
          <div class="settings-section">
            <h4>高级设置</h4>

            <div class="setting-item">
              <label for="bitrate">比特率 (Mbps)</label>
              <input
                id="bitrate"
                v-model.number="exportOptions.bitrate"
                type="number"
                min="1"
                max="50"
                step="0.5"
                class="bitrate-input"
              >
            </div>

            <div class="setting-item">
              <label for="framerate">帧率 (fps)</label>
              <input
                id="framerate"
                v-model.number="exportOptions.frameRate"
                type="number"
                min="1"
                max="120"
                step="1"
                class="framerate-input"
              >
            </div>

            <div class="setting-item checkbox-item">
              <input
                id="include-audio"
                v-model="exportOptions.audio"
                type="checkbox"
                class="audio-checkbox"
              >
              <label for="include-audio">包含音频</label>
            </div>

            <div class="setting-item">
              <label for="bg-color">背景颜色</label>
              <input
                id="bg-color"
                v-model="exportOptions.bgColor"
                type="color"
                class="color-picker"
              >
            </div>
          </div>

          <!-- 预览信息 -->
          <div class="preview-section">
            <h4>导出信息</h4>
            <div class="preview-info">
              <div class="info-item">
                <span class="label">时长:</span>
                <span class="value">{{ formatDuration(videoDuration) }}</span>
              </div>
              <div class="info-item">
                <span class="label">预估大小:</span>
                <span class="value">{{ estimatedFileSize }}</span>
              </div>
              <div class="info-item">
                <span class="label">浏览器支持:</span>
                <span class="value" :class="{ unsupported: !browserSupported }">
                  {{ browserSupported ? '✅ 支持' : '❌ 不支持' }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- 导出进度 -->
        <div v-if="isExporting" class="export-progress">
          <div class="progress-label">
            <span>导出进度</span>
            <span>{{ Math.round(exportProgress) }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${exportProgress}%` }" />
          </div>
          <div class="progress-details">
            <span v-if="exportDetails.stage" class="progress-stage">
              阶段: {{ exportDetails.stage }}
            </span>
            <span v-if="exportDetails.message" class="progress-message">
              {{ exportDetails.message }}
            </span>
            <span v-if="exportDetails.loaded > 0">
              {{ formatFileSize(exportDetails.loaded) }} / {{ formatFileSize(exportDetails.total) }}
            </span>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="modal-footer">
          <button class="cancel-button" :disabled="isExporting" @click="closeModal">
            取消
          </button>
          <button class="export-button" :disabled="isExporting || !browserSupported" @click="startExport">
            {{ isExporting ? '导出中...' : '开始导出' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.video-exporter {
  display: inline-block;
}

.export-button {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.export-button:hover:not(.disabled) {
  background: linear-gradient(135deg, #5a67d8 0%, #6b46c1 100%);
  transform: translateY(-1px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
}

.export-button.disabled {
  background: #cbd5e0;
  cursor: not-allowed;
  opacity: 0.6;
}

.export-button.exporting {
  background: linear-gradient(135deg, #f6ad55 0%, #ed8936 100%);
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #1a1a2e;
  border-radius: 12px;
  min-width: 500px;
  max-width: 600px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 24px;
  border-bottom: 1px solid #2d3748;
}

.modal-header h3 {
  margin: 0;
  color: #e2e8f0;
  font-size: 18px;
  font-weight: 600;
}

.close-button {
  background: none;
  border: none;
  color: #a0aec0;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.close-button:hover {
  background: #2d3748;
  color: #e2e8f0;
}

.modal-body {
  padding: 24px;
}

.settings-section {
  margin-bottom: 24px;
}

.settings-section h4 {
  margin: 0 0 16px 0;
  color: #e2e8f0;
  font-size: 16px;
  font-weight: 500;
}

.setting-item {
  margin-bottom: 16px;
}

.setting-item label {
  display: block;
  margin-bottom: 6px;
  color: #a0aec0;
  font-size: 14px;
  font-weight: 500;
}

.quality-select,
.resolution-select,
.filename-input,
.bitrate-input,
.framerate-input {
  width: 100%;
  padding: 8px 12px;
  background: #2d3748;
  border: 1px solid #4a5568;
  border-radius: 6px;
  color: #e2e8f0;
  font-size: 14px;
  transition: all 0.2s ease;
}

.quality-select:focus,
.resolution-select:focus,
.filename-input:focus,
.bitrate-input:focus,
.framerate-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.checkbox-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.checkbox-item label {
  margin: 0;
  cursor: pointer;
}

.audio-checkbox,
.color-picker {
  cursor: pointer;
}

.color-picker {
  width: 60px;
  height: 36px;
  border: 1px solid #4a5568;
  border-radius: 6px;
  background: #2d3748;
}

.preview-section h4 {
  margin: 0 0 12px 0;
  color: #e2e8f0;
  font-size: 16px;
  font-weight: 500;
}

.preview-info {
  background: #2d3748;
  border-radius: 8px;
  padding: 16px;
}

.info-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.info-item:last-child {
  margin-bottom: 0;
}

.info-item .label {
  color: #a0aec0;
  font-size: 14px;
  margin: 0;
}

.info-item .value {
  color: #e2e8f0;
  font-size: 14px;
  font-weight: 500;
}

.info-item .value.unsupported {
  color: #f56565;
}

.export-progress {
  margin: 24px 0;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.progress-label span {
  color: #e2e8f0;
  font-size: 14px;
  font-weight: 500;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background: #2d3748;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  transition: width 0.3s ease;
}

.progress-details {
  margin-top: 8px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.progress-stage {
  color: #667eea;
  font-size: 12px;
  font-weight: 500;
}

.progress-message {
  color: #a0aec0;
  font-size: 12px;
  font-style: italic;
}

.progress-details span:not(.progress-stage):not(.progress-message) {
  color: #a0aec0;
  font-size: 12px;
}

.modal-footer {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  padding: 20px 24px;
  border-top: 1px solid #2d3748;
}

.cancel-button {
  padding: 8px 16px;
  background: #2d3748;
  color: #e2e8f0;
  border: 1px solid #4a5568;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s ease;
}

.cancel-button:hover:not(:disabled) {
  background: #4a5568;
  transform: translateY(-1px);
}

.cancel-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.modal-footer .export-button {
  background: linear-gradient(135deg, #48bb78 0%, #38a169 100%);
}

.modal-footer .export-button:hover:not(:disabled) {
  background: linear-gradient(135deg, #38a169 0%, #2f855a 100%);
}

.loading-indicator {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: #4a5568;
  color: #a0aec0;
  border-radius: 6px;
  font-size: 14px;
  opacity: 0.8;
}

/* 响应式设计 */
@media (max-width: 640px) {
  .modal-content {
    min-width: 90vw;
    margin: 20px;
  }

  .modal-header,
  .modal-body,
  .modal-footer {
    padding: 16px;
  }
}
</style>
