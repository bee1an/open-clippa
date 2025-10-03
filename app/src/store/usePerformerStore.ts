import type { PerformerBounds, PerformerClickEvent } from '@clippa/performer'
import { Video } from '@clippa/performer'
import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

/**
 * Performer 配置选项
 */
export interface PerformerConfig {
  id: string
  start: number
  duration: number
  x: number
  y: number
  width?: number
  height?: number
  zIndex?: number
  rotation?: number
  src: string | File | Blob
  type?: 'video' | 'image' | 'audio'
}

/**
 * 选中的 performer 信息
 */
export interface SelectedPerformer {
  id: string
  bounds: PerformerBounds
  timestamp: number
}

/**
 * Performer Store
 */
export const usePerformerStore = defineStore('performer', () => {
  // 所有 performers
  const performers = ref<Video[]>([])

  // 选中的 performers
  const selectedPerformers = ref<SelectedPerformer[]>([])

  // 获取所有 performers
  const getAllPerformers = computed(() => performers.value)

  // 获取选中的 performers (包含 bounds 信息)
  const getSelectedPerformers = computed(() => {
    return selectedPerformers.value.map(selected => performers.value.find(p => p.id === selected.id)).filter(Boolean)
  })

  // 选中 performer
  const selectPerformer = (performerId: string) => {
    const performer = performers.value.find(p => p.id === performerId)
    if (performer) {
      const existingIndex = selectedPerformers.value.findIndex(s => s.id === performerId)

      if (existingIndex === -1) {
        // 单选模式：只保存选中的 performer
        const bounds = performer.getBounds()
        selectedPerformers.value = [{
          id: performerId,
          bounds,
          timestamp: Date.now(),
        }]
      }
    }
  }

  // 事件处理器
  const handlePerformerPointerDown = (performer: Video) => {
    // 避免重复选择同一个 performer
    const performerId = performer.id
    if (!selectedPerformers.value.find(s => s.id === performerId)) {
      selectPerformer(performerId)
    }
  }

  const handlePerformerPositionUpdate = (performer: Video, bounds: PerformerBounds) => {
    // 可以在这里添加位置更新的额外逻辑
    console.warn('Performer position updated:', performer.id, bounds)
  }

  // 创建新的 performer
  const createPerformer = (config: PerformerConfig): Video => {
    const performer = new Video({
      ...config,
      zIndex: config.zIndex || performers.value.length + 1,
    })

    // 监听 performer 事件
    performer.on('pointerdown', (event: PerformerClickEvent) => {
      console.warn('Performer clicked:', event)
      handlePerformerPointerDown(performer)
    })

    performer.on('positionUpdate', (bounds: PerformerBounds) => {
      handlePerformerPositionUpdate(performer, bounds)
    })

    return performer
  }

  // 添加 performer
  const addPerformer = (config: PerformerConfig): Video => {
    const performer = createPerformer(config)
    performers.value.push(performer)

    // 自动选中新添加的 performer (等待 sprite 加载完成)
    performer.on('positionUpdate', () => {
      // selectPerformer(performer.id)
    })

    return performer
  }

  // 移除 performer
  const removePerformer = (performerId: string) => {
    const index = performers.value.findIndex(p => p.id === performerId)
    if (index > -1) {
      const performer = performers.value[index]

      // 清理 performer 资源
      performer.destroy()

      // 从列表中移除
      performers.value.splice(index, 1)

      // 从选中列表中移除
      const selectedIndex = selectedPerformers.value.findIndex(s => s.id === performerId)
      if (selectedIndex > -1) {
        selectedPerformers.value.splice(selectedIndex, 1)
      }
    }
  }

  // 更新 performer
  const updatePerformer = (performerId: string, updates: Partial<PerformerConfig>) => {
    const performer = performers.value.find(p => p.id === performerId)
    if (performer) {
      if (updates.x !== undefined || updates.y !== undefined) {
        const currentBounds = performer.getBounds()
        const newX = updates.x ?? currentBounds.x
        const newY = updates.y ?? currentBounds.y
        performer.setPosition(newX, newY)
      }

      if (updates.width !== undefined || updates.height !== undefined) {
        const currentBounds = performer.getBounds()
        const newWidth = updates.width ?? currentBounds.width
        const newHeight = updates.height ?? currentBounds.height
        performer.setScale(newWidth / currentBounds.width, newHeight / currentBounds.height)
      }

      if (updates.rotation !== undefined) {
        performer.setRotation(updates.rotation)
      }

      if (updates.zIndex !== undefined) {
        performer.zIndex = updates.zIndex
      }
    }
  }

  // 取消选中 performer
  const deselectPerformer = (performerId: string) => {
    const index = selectedPerformers.value.findIndex(s => s.id === performerId)
    if (index > -1) {
      selectedPerformers.value.splice(index, 1)
    }
  }

  // 清空所有选中
  const clearSelection = () => {
    selectedPerformers.value = []
  }

  // 切换选中状态
  const togglePerformerSelection = (performerId: string) => {
    if (selectedPerformers.value.some(s => s.id === performerId)) {
      deselectPerformer(performerId)
    }
    else {
      selectPerformer(performerId)
    }
  }

  // 检查 performer 是否被选中
  const isPerformerSelected = (performerId: string) => {
    return selectedPerformers.value.some(s => s.id === performerId)
  }

  const deleteSelectedPerformers = () => {
    const idsToDelete = selectedPerformers.value.map(s => s.id)
    idsToDelete.forEach(id => removePerformer(id))
    clearSelection()
  }

  // 清理所有 performers
  const clearAllPerformers = () => {
    performers.value.forEach(performer => performer.destroy())
    performers.value = []
    selectedPerformers.value = []
  }

  return {
    // 状态
    performers,
    selectedPerformers,

    // 计算属性
    getAllPerformers,
    getSelectedPerformers,

    // 方法
    createPerformer,
    addPerformer,
    removePerformer,
    updatePerformer,
    selectPerformer,
    deselectPerformer,
    clearSelection,
    togglePerformerSelection,
    isPerformerSelected,
    deleteSelectedPerformers,
    clearAllPerformers,
  }
})
