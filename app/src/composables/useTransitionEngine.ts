import type { Filter, Texture } from 'pixi.js'
import type { TransitionCandidate, TransitionSpec } from '@/utils/transition'
import { Image, Video } from 'open-clippa'
import { storeToRefs } from 'pinia'
import { Container, Filter as PixiFilter, Texture as PixiTexture, Sprite } from 'pixi.js'
import { onMounted, onUnmounted, watch } from 'vue'
import { useEditorStore } from '@/store'
import { usePerformerStore } from '@/store/usePerformerStore'
import { useTransitionStore } from '@/store/useTransitionStore'
import {
  buildGlTransitionFragment,
  getGlTransitionPresetByType,
  normalizeGlTransitionParams,
} from '@/utils/glTransitions'
import {
  buildTransitionCandidates,
  buildTransitionPairKey,
  TRANSITION_FEATURE_AVAILABLE,
} from '@/utils/transition'

interface TransitionEngineOptions {
  fragmentShader?: string
}

type RenderablePerformer = Video | Image

interface ActiveTransitionContext {
  transition: TransitionSpec
  candidate: TransitionCandidate
  from: RenderablePerformer
  to: RenderablePerformer
  pairKey: string
  progress: number
}

interface HiddenPair {
  pairKey: string
  from: RenderablePerformer
  to: RenderablePerformer
}

export function useTransitionEngine(options: TransitionEngineOptions = {}): void {
  if (!TRANSITION_FEATURE_AVAILABLE)
    return

  const editorStore = useEditorStore()
  const performerStore = usePerformerStore()
  const transitionStore = useTransitionStore()
  const { clippa } = editorStore
  const { currentTime } = storeToRefs(editorStore)
  const { transitions, transitionsSignature } = storeToRefs(transitionStore)

  let ready = false
  let destroyed = false
  let rendering = false
  let pending = false

  let transitionContainer: Container | null = null
  let transitionSprite: Sprite | null = null
  let fallbackFromSprite: Sprite | null = null
  let fallbackToSprite: Sprite | null = null
  let transitionFilter: Filter | null = null
  let hiddenPair: HiddenPair | null = null
  const transitionFilterCache = new Map<string, Filter>()

  function isRenderablePerformer(performer: unknown): performer is RenderablePerformer {
    return performer instanceof Video || performer instanceof Image
  }

  function resolveActiveTransition(time: number): ActiveTransitionContext | null {
    if (!transitions.value.length)
      return null

    const candidates = buildTransitionCandidates(clippa.timeline)
    if (!candidates.length)
      return null

    const candidateMap = new Map<string, TransitionCandidate>()
    candidates.forEach((candidate) => {
      candidateMap.set(buildTransitionPairKey(candidate.fromId, candidate.toId), candidate)
    })

    const matched = transitions.value
      .map((transition) => {
        const pairKey = buildTransitionPairKey(transition.fromId, transition.toId)
        const candidate = candidateMap.get(pairKey)
        if (!candidate)
          return null

        const from = performerStore.getPerformerById(transition.fromId)
        const to = performerStore.getPerformerById(transition.toId)
        if (!isRenderablePerformer(from) || !isRenderablePerformer(to))
          return null

        const duration = Math.max(0, transition.durationMs)
        const half = duration / 2
        const windowStart = candidate.cutTime - half
        const windowEnd = candidate.cutTime + half
        const insideWindow = duration === 0
          ? Math.abs(time - candidate.cutTime) <= 0.5
          : time >= windowStart && time <= windowEnd

        if (!insideWindow)
          return null

        const progress = duration === 0
          ? 1
          : Math.max(0, Math.min(1, (time - windowStart) / duration))

        return {
          transition,
          candidate,
          from,
          to,
          pairKey,
          progress,
        }
      })
      .filter((item): item is ActiveTransitionContext => Boolean(item))
      .sort((a, b) => a.candidate.cutTime - b.candidate.cutTime)

    return matched[0] ?? null
  }

  function resolveVideoSourceTime(video: Video, timelineTime: number): number {
    const sourceTime = video.sourceStart + (timelineTime - video.start)
    const max = Math.max(0, video.sourceDuration)
    return Math.min(max, Math.max(0, sourceTime))
  }

  function getStageRatio(): number {
    const renderer = clippa.stage.app.renderer
    if (!renderer.height)
      return 1
    return renderer.width / renderer.height
  }

  function serializeUniformValue(value: unknown): string {
    if (Array.isArray(value))
      return `[${value.join(',')}]`
    return String(value)
  }

  function createTransitionFilter(
    fragmentShader: string,
    uniformParams: Record<string, number | number[]>,
  ): Filter | null {
    try {
      const emptySource = (PixiTexture.EMPTY as any).source ?? PixiTexture.EMPTY
      return (PixiFilter as any).from(undefined, fragmentShader, {
        uFrom: emptySource,
        uTo: emptySource,
        uProgress: 0,
        uRatio: getStageRatio(),
        ...uniformParams,
      }) as Filter
    }
    catch (error) {
      console.warn('Transition filter init failed, fallback to alpha blend.', error)
      return null
    }
  }

  function resolveTransitionFilter(transition: TransitionSpec): Filter | null {
    const preset = getGlTransitionPresetByType(transition.type)
    const uniformParams = normalizeGlTransitionParams(preset.type, transition.params)
    const paramsSignature = Object.keys(uniformParams)
      .sort()
      .map(key => `${key}:${serializeUniformValue(uniformParams[key])}`)
      .join('|')

    const cacheKey = `${preset.type}:${paramsSignature}`
    const cached = transitionFilterCache.get(cacheKey)
    if (cached)
      return cached

    const fragmentShader = options.fragmentShader ?? buildGlTransitionFragment(preset.glsl)
    const filter = createTransitionFilter(fragmentShader, uniformParams)
    if (!filter)
      return null

    transitionFilterCache.set(cacheKey, filter)
    return filter
  }

  function ensureTransitionLayer(): boolean {
    if (!ready || transitionContainer)
      return Boolean(transitionContainer)

    const app = clippa.stage.app

    transitionContainer = new Container({ label: 'transition-container', visible: false })
    transitionSprite = new Sprite(PixiTexture.WHITE)
    fallbackFromSprite = new Sprite()
    fallbackToSprite = new Sprite()

    transitionSprite.filters = null

    transitionContainer.addChild(transitionSprite)
    transitionContainer.addChild(fallbackFromSprite)
    transitionContainer.addChild(fallbackToSprite)

    app.stage.addChild(transitionContainer)
    syncLayerSize()
    return true
  }

  function syncLayerSize(): void {
    if (!transitionSprite || !fallbackFromSprite || !fallbackToSprite)
      return

    const app = clippa.stage.app
    const width = app.renderer.width
    const height = app.renderer.height

    transitionSprite.width = width
    transitionSprite.height = height

    fallbackFromSprite.width = width
    fallbackFromSprite.height = height
    fallbackToSprite.width = width
    fallbackToSprite.height = height
  }

  function restoreHiddenPair(): void {
    if (!hiddenPair)
      return

    hiddenPair.from.sprite && (hiddenPair.from.sprite.visible = true)
    hiddenPair.to.sprite && (hiddenPair.to.sprite.visible = true)
    hiddenPair = null
  }

  function hidePair(context: ActiveTransitionContext): void {
    if (hiddenPair && hiddenPair.pairKey !== context.pairKey)
      restoreHiddenPair()

    context.from.sprite && (context.from.sprite.visible = false)
    context.to.sprite && (context.to.sprite.visible = false)
    hiddenPair = {
      pairKey: context.pairKey,
      from: context.from,
      to: context.to,
    }
  }

  function hideTransitionLayer(): void {
    if (transitionContainer)
      transitionContainer.visible = false
  }

  function updateFallbackTextures(fromTexture: Texture, toTexture: Texture, progress: number): void {
    if (!fallbackFromSprite || !fallbackToSprite)
      return

    fallbackFromSprite.visible = true
    fallbackToSprite.visible = true
    fallbackFromSprite.texture = fromTexture
    fallbackToSprite.texture = toTexture
    fallbackFromSprite.alpha = 1 - progress
    fallbackToSprite.alpha = progress
  }

  function updateFilterUniforms(filter: Filter, fromTexture: Texture, toTexture: Texture, progress: number): boolean {
    if (!filter)
      return false

    const uniforms = (filter as any).uniforms as Record<string, unknown> | undefined
    if (!uniforms)
      return false

    uniforms.uFrom = (fromTexture as any).source ?? fromTexture
    uniforms.uTo = (toTexture as any).source ?? toTexture
    uniforms.uProgress = progress
    uniforms.uRatio = getStageRatio()
    return true
  }

  async function renderCurrentTransition(): Promise<void> {
    if (!ready || destroyed)
      return

    if (!ensureTransitionLayer()) {
      restoreHiddenPair()
      return
    }

    const time = currentTime.value
    const context = resolveActiveTransition(time)

    if (!context) {
      restoreHiddenPair()
      hideTransitionLayer()
      return
    }

    if (context.from instanceof Video) {
      await context.from.renderFrameAtSourceTime(resolveVideoSourceTime(context.from, time))
    }

    if (context.to instanceof Video) {
      await context.to.renderFrameAtSourceTime(resolveVideoSourceTime(context.to, time))
    }

    const fromTexture = context.from.sprite?.texture
    const toTexture = context.to.sprite?.texture
    if (!fromTexture || !toTexture) {
      restoreHiddenPair()
      hideTransitionLayer()
      return
    }

    syncLayerSize()
    hidePair(context)

    if (!transitionContainer || !transitionSprite || !fallbackFromSprite || !fallbackToSprite)
      return

    const app = clippa.stage.app
    app.stage.setChildIndex(transitionContainer, app.stage.children.length - 1)

    const progress = Math.max(0, Math.min(1, context.progress))
    transitionFilter = resolveTransitionFilter(context.transition)
    const usingFilter = Boolean(transitionFilter)

    if (usingFilter) {
      if (transitionSprite.filters?.[0] !== transitionFilter) {
        transitionSprite.filters = [transitionFilter!]
      }
    }
    else {
      transitionSprite.filters = null
    }

    const filterUpdated = transitionFilter
      ? updateFilterUniforms(transitionFilter, fromTexture, toTexture, progress)
      : false

    transitionSprite.visible = usingFilter && filterUpdated
    fallbackFromSprite.visible = !(usingFilter && filterUpdated)
    fallbackToSprite.visible = !(usingFilter && filterUpdated)

    if (usingFilter && filterUpdated) {
      fallbackFromSprite.alpha = 0
      fallbackToSprite.alpha = 0
    }
    else {
      updateFallbackTextures(fromTexture, toTexture, progress)
    }

    transitionContainer.visible = true
  }

  async function flushRender(): Promise<void> {
    if (rendering)
      return

    rendering = true
    try {
      while (pending) {
        if (destroyed)
          break

        pending = false
        await renderCurrentTransition()
      }
    }
    finally {
      rendering = false
    }
  }

  function requestRender(): void {
    pending = true
    void flushRender()
  }

  onMounted(async () => {
    await clippa.ready
    if (destroyed)
      return

    ready = true
    ensureTransitionLayer()
    requestRender()
  })

  onUnmounted(() => {
    destroyed = true
    pending = false
    restoreHiddenPair()
    hideTransitionLayer()

    if (transitionContainer) {
      clippa.stage.app.stage.removeChild(transitionContainer)
      transitionContainer.destroy({ children: true })
      transitionContainer = null
    }

    transitionSprite = null
    fallbackFromSprite = null
    fallbackToSprite = null
    transitionFilter = null

    transitionFilterCache.forEach((filter) => {
      (filter as any).destroy?.()
    })
    transitionFilterCache.clear()
  })

  watch(
    () => [currentTime.value, transitionsSignature.value, transitions.value.length],
    () => {
      requestRender()
    },
    { immediate: true },
  )
}
