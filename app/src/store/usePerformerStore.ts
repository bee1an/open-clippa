import type {
  PerformerAnimationPatch,
  PerformerAnimationSpec,
  PerformerBounds,
  TextStyleOption,
} from '@clippc/performer'
import {
  Image,
  mergeAnimationSpec,
  normalizeAnimationSpec,
  Text,
  Video,
} from '@clippc/performer'
import { defineStore } from 'pinia'
import { useEditorStore } from '@/store/useEditorStore'

/**
 * Performer 配置选项
 */
interface PerformerConfigBase {
  id: string
  start: number
  duration: number
  x: number
  y: number
  width?: number
  height?: number
  zIndex?: number
  rotation?: number
}

export interface VideoPerformerConfig extends PerformerConfigBase {
  type?: 'video'
  src: string | File | Blob
  sourceDuration?: number
  sourceStart?: number
}

export interface ImagePerformerConfig extends PerformerConfigBase {
  type: 'image'
  src: string | File | Blob
}

export interface TextPerformerConfig extends PerformerConfigBase {
  type: 'text'
  content: string
  style?: TextStyleOption
}

export type PerformerConfig = VideoPerformerConfig | ImagePerformerConfig | TextPerformerConfig

export type CanvasPerformer = Video | Image | Text

interface PerformerPointerEvent {
  performer: CanvasPerformer
  canvasX: number
  canvasY: number
  timestamp: number
}

interface PendingSelectionDrag {
  id: string
  clientX: number
  clientY: number
  timestamp: number
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
  const editorStore = useEditorStore()

  // 所有 performers - 使用普通 Map 存储，避免响应式追踪大型对象
  const performerMap = new Map<string, CanvasPerformer>()

  const fittedPerformers = new WeakSet<CanvasPerformer>()

  // 选中的 performers
  const selectedPerformers = ref<SelectedPerformer[]>([])
  const pendingSelectionDrag = ref<PendingSelectionDrag | null>(null)
  const selectionRevision = ref(0)
  const animationMap = ref<Record<string, PerformerAnimationSpec>>({})

  const bumpSelectionRevision = () => {
    selectionRevision.value += 1
  }

  const hasTimelineTrainId = (targetId: string): boolean => {
    const rails = editorStore.clippa.timeline.rails?.rails ?? []
    return rails.some(rail => rail.trains.some(train => train.id === targetId))
  }

  const ensureUniquePerformerId = (baseId: string): string => {
    if (!performerMap.has(baseId) && !hasTimelineTrainId(baseId))
      return baseId

    let suffix = 1
    let nextId = `${baseId}-${suffix}`
    while (performerMap.has(nextId) || hasTimelineTrainId(nextId)) {
      suffix += 1
      nextId = `${baseId}-${suffix}`
    }

    return nextId
  }

  const removeTimelineTrainById = (targetId: string) => {
    const timeline = editorStore.clippa.timeline
    const rails = timeline.rails?.rails ?? []
    rails.forEach((rail) => {
      const trains = rail.trains.filter(train => train.id === targetId)
      trains.forEach((train) => {
        if (timeline.state.activeTrain === train) {
          train.updateActive(false)
        }
        rail.removeTrain(train)
      })
    })
  }

  // 获取所有 performers
  const getAllPerformers = () => Array.from(performerMap.values())

  const getPerformerById = (performerId: string): CanvasPerformer | undefined => {
    return performerMap.get(performerId)
  }

  // 获取选中的 performers (包含 bounds 信息)
  const getSelectedPerformers = () => {
    return selectedPerformers.value
      .map(selected => performerMap.get(selected.id))
      .filter(Boolean)
  }

  // 选中 performer
  const selectPerformer = (performerId: string) => {
    const performer = performerMap.get(performerId)
    if (performer) {
      // 单选模式：每次选择都刷新，避免同 id 场景下状态不同步
      const bounds = performer.getBaseBounds()
      selectedPerformers.value = [{
        id: performerId,
        bounds,
        timestamp: Date.now(),
      }]
      bumpSelectionRevision()
    }
  }

  // 事件处理器
  const handlePerformerPointerDown = (performer: CanvasPerformer, _event?: PerformerPointerEvent) => {
    // 避免重复选择同一个 performer
    const performerId = performer.id
    if (!selectedPerformers.value.find(s => s.id === performerId)) {
      selectPerformer(performerId)
    }
  }

  const handlePerformerPositionUpdate = (performer: CanvasPerformer, bounds: PerformerBounds) => {
    // 更新选中的 performer 中的 bounds 信息
    const selectedIndex = selectedPerformers.value.findIndex(s => s.id === performer.id)
    if (selectedIndex > -1) {
      selectedPerformers.value[selectedIndex] = {
        ...selectedPerformers.value[selectedIndex],
        bounds,
        timestamp: Date.now(),
      }
    }
  }

  const fitPerformerToStage = async (performer: CanvasPerformer) => {
    if (fittedPerformers.has(performer))
      return

    await editorStore.clippa.ready

    const app = editorStore.clippa.stage.app
    if (!app)
      return

    const bounds = performer.getBaseBounds()
    if (!bounds.width || !bounds.height)
      return

    const stageWidth = app.renderer.width
    const stageHeight = app.renderer.height

    if (!stageWidth || !stageHeight)
      return

    const scale = Math.min(1, stageWidth / bounds.width, stageHeight / bounds.height)
    if (scale < 1) {
      const currentScaleX = performer.sprite?.scale.x ?? 1
      const currentScaleY = performer.sprite?.scale.y ?? 1
      performer.setScale(currentScaleX * scale, currentScaleY * scale)
    }

    const updatedBounds = performer.getBaseBounds()
    const maxX = Math.max(0, stageWidth - updatedBounds.width)
    const maxY = Math.max(0, stageHeight - updatedBounds.height)
    const nextX = Math.min(Math.max(updatedBounds.x, 0), maxX)
    const nextY = Math.min(Math.max(updatedBounds.y, 0), maxY)

    if (nextX !== updatedBounds.x || nextY !== updatedBounds.y) {
      performer.setPosition(nextX, nextY)
    }

    fittedPerformers.add(performer)
  }

  // 创建新的 performer
  const createPerformer = (config: PerformerConfig): CanvasPerformer => {
    const zIndex = config.zIndex ?? performerMap.size + 1

    let performer: CanvasPerformer

    if (config.type === 'image') {
      const { type: _type, rotation: _rotation, ...imageConfig } = config
      performer = new Image({
        ...imageConfig,
        zIndex,
      })
    }
    else if (config.type === 'text') {
      const { type: _type, rotation: _rotation, ...textConfig } = config
      performer = new Text({
        ...textConfig,
        zIndex,
      })
    }
    else {
      const { type: _type, rotation: _rotation, ...videoConfig } = config
      performer = new Video({
        ...videoConfig,
        zIndex,
      })
    }

    const eventTarget = performer as {
      on:
      & ((event: 'pointerdown', handler: (event: PerformerPointerEvent) => void) => void)
      & ((event: 'positionUpdate', handler: (bounds: PerformerBounds) => void) => void)
    }

    eventTarget.on('pointerdown', (event) => {
      handlePerformerPointerDown(performer, event)
    })

    eventTarget.on('positionUpdate', (bounds) => {
      handlePerformerPositionUpdate(performer, bounds)
    })

    return performer
  }

  // 添加 performer
  const addPerformer = (config: PerformerConfig): CanvasPerformer => {
    const nextId = ensureUniquePerformerId(config.id)
    const nextConfig = nextId === config.id ? config : { ...config, id: nextId }

    if (nextId !== config.id) {
      console.warn(`[performer] duplicated id "${config.id}" detected, fallback to "${nextId}"`)
    }

    const performer = createPerformer(nextConfig)
    performerMap.set(performer.id, performer)

    const animation = animationMap.value[performer.id]
    if (animation) {
      performer.setAnimation(animation)
    }

    // 自动选中新添加的 performer (等待 sprite 加载完成)
    ;(performer as any).on?.('positionUpdate', () => {
      // selectPerformer(performer.id)
    })

    performer.load()
      .then(() => {
        if (config.rotation !== undefined) {
          performer.setRotation(config.rotation)
        }

        return fitPerformerToStage(performer)
      })
      .catch(() => {})

    return performer
  }

  const clearAnimation = (performerId: string): void => {
    const nextMap = { ...animationMap.value }
    delete nextMap[performerId]

    animationMap.value = nextMap
    performerMap.get(performerId)?.setAnimation(null)
  }

  // 移除 performer
  const removePerformer = (performerId: string) => {
    clearAnimation(performerId)

    const performer = performerMap.get(performerId)
    if (performer) {
      removeTimelineTrainById(performerId)
      editorStore.clippa.fire(performer)

      // 清理 performer 资源
      performer.destroy()

      // 从 Map 中移除
      performerMap.delete(performerId)

      // 从选中列表中移除
      const selectedIndex = selectedPerformers.value.findIndex(s => s.id === performerId)
      if (selectedIndex > -1) {
        selectedPerformers.value.splice(selectedIndex, 1)
        bumpSelectionRevision()
      }
    }
  }

  // 更新 performer
  const updatePerformer = (performerId: string, updates: Partial<PerformerConfig>) => {
    const performer = performerMap.get(performerId)
    if (performer) {
      if (updates.x !== undefined || updates.y !== undefined) {
        const currentBounds = performer.getBaseBounds()
        const newX = updates.x ?? currentBounds.x
        const newY = updates.y ?? currentBounds.y
        performer.setPosition(newX, newY)
      }

      if (updates.width !== undefined || updates.height !== undefined) {
        const currentBounds = performer.getBaseBounds()
        const newWidth = updates.width ?? currentBounds.width
        const newHeight = updates.height ?? currentBounds.height
        const currentScaleX = performer.sprite?.scale.x ?? 1
        const currentScaleY = performer.sprite?.scale.y ?? 1
        const widthRatio = currentBounds.width ? newWidth / currentBounds.width : 1
        const heightRatio = currentBounds.height ? newHeight / currentBounds.height : 1
        performer.setScale(currentScaleX * widthRatio, currentScaleY * heightRatio)
      }

      if (updates.rotation !== undefined) {
        performer.setRotation(updates.rotation)
      }

      if ((updates as any).alpha !== undefined) {
        performer.setAlpha((updates as any).alpha)
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
      bumpSelectionRevision()
    }
  }

  // 清空所有选中
  const clearSelection = () => {
    if (selectedPerformers.value.length > 0) {
      selectedPerformers.value = []
      bumpSelectionRevision()
    }
  }

  const requestSelectionDrag = (payload: PendingSelectionDrag) => {
    pendingSelectionDrag.value = payload
  }

  const consumeSelectionDrag = (performerId: string): PendingSelectionDrag | null => {
    const pending = pendingSelectionDrag.value
    if (!pending || pending.id !== performerId)
      return null

    pendingSelectionDrag.value = null
    return pending
  }

  const clearPendingSelectionDrag = () => {
    pendingSelectionDrag.value = null
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

  const getAnimation = (performerId: string): PerformerAnimationSpec | null => {
    return animationMap.value[performerId] ?? null
  }

  const setAnimation = (performerId: string, spec: PerformerAnimationSpec | null): void => {
    const normalized = normalizeAnimationSpec(spec)
    const nextMap = { ...animationMap.value }

    if (normalized) {
      nextMap[performerId] = normalized
    }
    else {
      delete nextMap[performerId]
    }

    animationMap.value = nextMap
    performerMap.get(performerId)?.setAnimation(normalized)
  }

  const updateAnimation = (performerId: string, patch: PerformerAnimationPatch): void => {
    const nextSpec = mergeAnimationSpec(getAnimation(performerId), patch)
    setAnimation(performerId, nextSpec)
  }

  // 清理所有 performers
  const clearAllPerformers = () => {
    performerMap.forEach((performer) => {
      editorStore.clippa.fire(performer)
      performer.destroy()
    })
    performerMap.clear()

    if (selectedPerformers.value.length > 0) {
      selectedPerformers.value = []
      bumpSelectionRevision()
    }

    animationMap.value = {}
  }

  return {
    // 状态
    selectedPerformers,
    pendingSelectionDrag,
    selectionRevision,
    animationMap,

    // 方法
    getAllPerformers,
    getPerformerById,
    getSelectedPerformers,
    createPerformer,
    addPerformer,
    removePerformer,
    updatePerformer,
    selectPerformer,
    deselectPerformer,
    clearSelection,
    requestSelectionDrag,
    consumeSelectionDrag,
    clearPendingSelectionDrag,
    togglePerformerSelection,
    isPerformerSelected,
    deleteSelectedPerformers,
    clearAllPerformers,
    getAnimation,
    setAnimation,
    updateAnimation,
    clearAnimation,
  }
})
