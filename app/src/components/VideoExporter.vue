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

function cancelExport() {
  if (currentExporter.value && isExporting.value) {
    try {
      currentExporter.value.cancel()
      console.warn('导出已取消')
    }
    catch (error) {
      console.error('取消导出失败:', error)
    }
  }

  isExporting.value = false
  resetExportState()
}

// 估算剩余时间
function estimateRemainingTime(): string {
  if (exportProgress.value <= 0 || !exportDetails.loaded || !exportDetails.total) {
    return '计算中...'
  }

  // 简单的线性估算
  const elapsed = Date.now() - (exportDetails.loaded ? Date.now() : 0)
  const rate = exportDetails.loaded / Math.max(elapsed, 1)
  const remaining = (exportDetails.total - exportDetails.loaded) / Math.max(rate, 1)

  if (remaining < 1000) {
    return '< 1秒'
  }
  else if (remaining < 60000) {
    return `${Math.round(remaining / 1000)}秒`
  }
  else {
    return `${Math.round(remaining / 60000)}分钟`
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

// 键盘事件处理
function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && showExportModal.value && !isExporting.value) {
    closeModal()
  }
}

// 生命周期
onMounted(() => {
  checkBrowserSupport()
  document.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  // 清理导出器
  resetExportState()

  // 清理事件监听器
  if (props.clippa?.theater) {
    props.clippa.theater.off('hire', updateExportState)
  }

  document.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="video-exporter">
    <!-- 导出按钮 -->
    <button
      v-if="props.clippa"
      :disabled="isExporting || !hasVideos"
      class="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-500 text-white rounded-md transition-all duration-300 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 disabled:transform-none disabled:cursor-not-allowed"
      @click="openModal"
    >
      <div v-if="!isExporting" class="i-carbon-download w-4 h-4" />
      <div v-else class="i-carbon-circle-dash animate-spin w-4 h-4" />
      <span class="font-medium">{{ isExporting ? '导出中...' : '导出视频' }}</span>
    </button>

    <!-- 加载状态 -->
    <div v-else class="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 text-gray-300 rounded-md opacity-80">
      <div class="i-carbon-circle-dash animate-spin w-4 h-4" />
      <span class="text-sm">初始化中...</span>
    </div>

    <!-- 导出模态框 -->
    <div
      v-if="showExportModal"
      class="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      @click.self="closeModal"
    >
      <div class="bg-gray-900 rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-800">
        <!-- 模态框头部 -->
        <div class="flex items-center justify-between p-6 border-b border-gray-800">
          <h3 class="text-xl font-semibold text-white flex items-center gap-2">
            <div class="i-carbon-video w-5 h-5 text-blue-400" />
            导出视频设置
          </h3>
          <button
            class="text-gray-400 hover:text-white hover:bg-gray-800 p-2 rounded-lg transition-colors"
            @click="closeModal"
          >
            <div class="i-carbon-close w-5 h-5" />
          </button>
        </div>

        <div class="p-6 space-y-6">
          <!-- 基础设置 -->
          <section>
            <h4 class="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <div class="i-carbon-settings w-4 h-4 text-blue-400" />
              基础设置
            </h4>

            <div class="space-y-4">
              <div>
                <label for="quality" class="block text-sm font-medium text-gray-300 mb-2">视频质量</label>
                <select
                  id="quality"
                  v-model="exportOptions.quality"
                  class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
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

              <div>
                <label for="resolution" class="block text-sm font-medium text-gray-300 mb-2">分辨率</label>
                <select
                  id="resolution"
                  v-model="resolutionPreset"
                  class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
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

              <div>
                <label for="filename" class="block text-sm font-medium text-gray-300 mb-2">文件名</label>
                <input
                  id="filename"
                  v-model="filename"
                  type="text"
                  placeholder="输入文件名（不含扩展名）"
                  class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                >
              </div>
            </div>
          </section>

          <!-- 高级设置 -->
          <section>
            <h4 class="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <div class="i-carbon-settings-adjust w-4 h-4 text-blue-400" />
              高级设置
            </h4>

            <div class="space-y-4">
              <div>
                <label for="bitrate" class="block text-sm font-medium text-gray-300 mb-2">
                  比特率 (Mbps)
                  <span class="text-xs text-gray-500 ml-1" title="建议：5-10 Mbps 为高质量，1-5 Mbps 为中等质量">ℹ️</span>
                </label>
                <input
                  id="bitrate"
                  v-model.number="exportOptions.bitrate"
                  type="number"
                  min="1"
                  max="50"
                  step="0.5"
                  class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  title="更高的比特率意味着更好的视频质量，但文件会更大"
                >
              </div>

              <div>
                <label for="framerate" class="block text-sm font-medium text-gray-300 mb-2">
                  帧率 (fps)
                  <span class="text-xs text-gray-500 ml-1" title="建议：24-30 fps 为标准，60 fps 为流畅">ℹ️</span>
                </label>
                <input
                  id="framerate"
                  v-model.number="exportOptions.frameRate"
                  type="number"
                  min="1"
                  max="120"
                  step="1"
                  class="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  title="更高的帧率使视频更流畅，但文件会更大"
                >
              </div>

              <div class="flex items-center gap-3">
                <input
                  id="include-audio"
                  v-model="exportOptions.audio"
                  type="checkbox"
                  class="w-4 h-4 text-blue-600 bg-gray-800 border-gray-600 rounded focus:ring-blue-500 focus:ring-2"
                >
                <label for="include-audio" class="text-sm font-medium text-gray-300 cursor-pointer">包含音频</label>
              </div>

              <div>
                <label for="bg-color" class="block text-sm font-medium text-gray-300 mb-2">背景颜色</label>
                <div class="flex items-center gap-3">
                  <input
                    id="bg-color"
                    v-model="exportOptions.bgColor"
                    type="color"
                    class="w-12 h-10 bg-gray-800 border border-gray-700 rounded cursor-pointer"
                  >
                  <span class="text-sm text-gray-400 font-mono">{{ exportOptions.bgColor }}</span>
                </div>
              </div>
            </div>
          </section>

          <!-- 导出信息 -->
          <section>
            <h4 class="text-lg font-medium text-white mb-4 flex items-center gap-2">
              <div class="i-carbon-information w-4 h-4 text-blue-400" />
              导出信息
            </h4>

            <div class="bg-gray-800 rounded-lg p-4 space-y-3">
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-400">时长:</span>
                <span class="text-sm font-medium text-white">{{ formatDuration(videoDuration) }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-400">预估大小:</span>
                <span class="text-sm font-medium text-white">{{ estimatedFileSize }}</span>
              </div>
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-400">浏览器支持:</span>
                <span class="text-sm font-medium" :class="browserSupported ? 'text-green-400' : 'text-red-400'">
                  {{ browserSupported ? '✅ 支持' : '❌ 不支持' }}
                </span>
              </div>
            </div>
          </section>
        </div>

        <!-- 导出进度 -->
        <div v-if="isExporting" class="px-6 pb-6">
          <div class="bg-gray-800 rounded-lg p-4 space-y-4">
            <div class="flex justify-between items-center">
              <span class="text-sm font-medium text-white flex items-center gap-2">
                <div class="i-carbon-circle-dash animate-spin w-4 h-4 text-blue-400" />
                导出进度
              </span>
              <div class="flex items-center gap-3">
                <span class="text-sm font-medium text-blue-400">{{ Math.round(exportProgress) }}%</span>
                <button
                  class="text-red-400 hover:text-red-300 hover:bg-red-500/20 p-1.5 rounded-md transition-all"
                  title="取消导出"
                  @click="cancelExport"
                >
                  <div class="i-carbon-close w-4 h-4" />
                </button>
              </div>
            </div>

            <div class="w-full bg-gray-700 rounded-full h-3 overflow-hidden shadow-inner">
              <div
                class="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 rounded-full transition-all duration-500 ease-out relative"
                :style="{ width: `${exportProgress}%` }"
              >
                <div class="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer" />
              </div>
            </div>

            <div class="grid grid-cols-1 gap-2 text-xs">
              <div v-if="exportDetails.stage" class="flex justify-between items-center py-1 px-2 bg-blue-500/10 rounded">
                <span class="text-blue-400 font-medium">当前阶段:</span>
                <span class="text-blue-300">{{ exportDetails.stage }}</span>
              </div>
              <div v-if="exportDetails.message" class="flex justify-between items-center py-1 px-2 bg-gray-700/50 rounded">
                <span class="text-gray-400">状态:</span>
                <span class="text-gray-300 italic">{{ exportDetails.message }}</span>
              </div>
              <div v-if="exportDetails.loaded > 0" class="flex justify-between items-center py-1 px-2 bg-gray-700/50 rounded">
                <span class="text-gray-400">处理数据:</span>
                <span class="text-gray-300 font-mono">{{ formatFileSize(exportDetails.loaded) }} / {{ formatFileSize(exportDetails.total) }}</span>
              </div>
            </div>

            <!-- 速度指示器 -->
            <div class="flex justify-center items-center gap-4 pt-2 border-t border-gray-700">
              <div class="flex items-center gap-2 text-xs text-gray-400">
                <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span>正在处理</span>
              </div>
              <div class="text-xs text-gray-500">
                预计剩余时间: {{ estimateRemainingTime() }}
              </div>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex justify-end gap-3 p-6 border-t border-gray-800">
          <button
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            :disabled="isExporting"
            @click="closeModal"
          >
            取消
          </button>
          <button
            class="px-4 py-2 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-gray-500 disabled:to-gray-600 text-white rounded-lg font-medium transition-all transform hover:scale-105 active:scale-95 disabled:scale-100 disabled:cursor-not-allowed flex items-center gap-2"
            :disabled="isExporting || !browserSupported"
            @click="startExport"
          >
            <div v-if="isExporting" class="i-carbon-circle-dash animate-spin w-4 h-4" />
            <div v-else class="i-carbon-download w-4 h-4" />
            {{ isExporting ? '导出中...' : '开始导出' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 所有样式已使用 UnoCSS 重构，无需额外 CSS */
</style>
