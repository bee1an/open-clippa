import type { Filter, Texture } from 'pixi.js'
import type { Rail } from 'clippc'
import type { GlTransitionParamValue } from '@/utils/glTransitions'
import type { TransitionCandidate, TransitionSpec } from '@/utils/transition'
import { Image, Video } from 'clippc'
import { storeToRefs } from 'pinia'
import { Container, Filter as PixiFilter, RenderTexture, Texture as PixiTexture, Sprite } from 'pixi.js'
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

type NumericUniformType = 'f32' | 'vec2<f32>' | 'vec3<f32>' | 'vec4<f32>'
type TransitionDebugMatrix = { a: number, b: number, c: number, d: number, tx: number, ty: number }

const TRANSITION_DEBUG_ENABLED = import.meta.env.VITE_TRANSITION_DEBUG === 'true'
const TRANSITION_DEBUG_PREFIX = 'TRANSITION_DEBUG_JSON'
const TRANSITION_DEBUG_BUFFER_KEY = '__OPEN_CLIPPA_TRANSITION_LOGS__'
const TRANSITION_DEBUG_MAX_BUFFER = 2000

const TRANSITION_FILTER_VERTEX_SHADER = `
in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition(void) {
  vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;

  position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
  position.y = position.y * (2.0 * uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;

  return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord(void) {
  // Transition shaders expect normalized UV in [0, 1].
  return aPosition;
}

void main(void) {
  gl_Position = filterVertexPosition();
  vTextureCoord = filterTextureCoord();
}
`.trim()

function resolveNumericUniformDescriptor(value: GlTransitionParamValue): { value: number | number[], type: NumericUniformType } {
  if (!Array.isArray(value))
    return { value, type: 'f32' }

  if (value.length === 2)
    return { value: [...value], type: 'vec2<f32>' }
  if (value.length === 3)
    return { value: [...value], type: 'vec3<f32>' }
  if (value.length === 4)
    return { value: [...value], type: 'vec4<f32>' }

  return { value: value[0] ?? 0, type: 'f32' }
}

function createNumericUniformResource(
  name: string,
  value: GlTransitionParamValue,
): Record<string, { value: number | number[], type: NumericUniformType }> {
  const descriptor = resolveNumericUniformDescriptor(value)

  return {
    [name]: descriptor,
  }
}

function updateNumericUniformResource(resources: Record<string, unknown>, name: string, value: number): boolean {
  const resource = resources[name] as { uniforms?: Record<string, unknown> } | undefined
  if (!resource?.uniforms)
    return false

  resource.uniforms[name] = value
  return true
}

function isRenderableTexture(texture: Texture | undefined): texture is Texture {
  if (!texture)
    return false

  const target = texture as Texture & { destroyed?: boolean, source?: { destroyed?: boolean, alphaMode?: unknown } | null }
  if (target.destroyed)
    return false

  const source = target.source
  if (!source || source.destroyed)
    return false

  return source.alphaMode !== null && source.alphaMode !== undefined
}

function roundDebugNumber(value: number): number {
  if (!Number.isFinite(value))
    return value
  return Math.round(value * 1000) / 1000
}

function serializeMatrix(matrix: { a: number, b: number, c: number, d: number, tx: number, ty: number } | null | undefined): TransitionDebugMatrix | null {
  if (!matrix)
    return null

  return {
    a: roundDebugNumber(matrix.a),
    b: roundDebugNumber(matrix.b),
    c: roundDebugNumber(matrix.c),
    d: roundDebugNumber(matrix.d),
    tx: roundDebugNumber(matrix.tx),
    ty: roundDebugNumber(matrix.ty),
  }
}

function serializeSpriteDebugState(sprite: Sprite | undefined): Record<string, unknown> | null {
  if (!sprite)
    return null

  return {
    local: {
      x: roundDebugNumber(sprite.x),
      y: roundDebugNumber(sprite.y),
      width: roundDebugNumber(sprite.width),
      height: roundDebugNumber(sprite.height),
      scaleX: roundDebugNumber(sprite.scale.x),
      scaleY: roundDebugNumber(sprite.scale.y),
      rotation: roundDebugNumber(sprite.angle ?? 0),
      visible: sprite.visible,
      renderable: sprite.renderable,
    },
    world: serializeMatrix(sprite.worldTransform),
    parentWorld: serializeMatrix(sprite.parent?.worldTransform),
  }
}

function debugLogTransition(event: string, payload: Record<string, unknown>): void {
  if (!TRANSITION_DEBUG_ENABLED)
    return

  const line = JSON.stringify({
    tag: 'transition-debug',
    event,
    ...payload,
  })

  const scope = globalThis as Record<string, unknown>
  const current = scope[TRANSITION_DEBUG_BUFFER_KEY]
  const buffer = Array.isArray(current) ? current as string[] : []
  buffer.push(line)
  if (buffer.length > TRANSITION_DEBUG_MAX_BUFFER) {
    buffer.splice(0, buffer.length - TRANSITION_DEBUG_MAX_BUFFER)
  }
  scope[TRANSITION_DEBUG_BUFFER_KEY] = buffer

  console.info(`${TRANSITION_DEBUG_PREFIX} ${line}`)
}

export function useTransitionEngine(options: TransitionEngineOptions = {}): void {
  if (!TRANSITION_FEATURE_AVAILABLE)
    return

  const editorStore = useEditorStore()
  const performerStore = usePerformerStore()
  const transitionStore = useTransitionStore()
  const { clippa } = editorStore
  const { currentTime, isPlaying } = storeToRefs(editorStore)
  const { transitions, transitionsSignature } = storeToRefs(transitionStore)

  let ready = false
  let destroyed = false
  let rendering = false
  let pending = false
  let renderVersion = 0
  let lastDebugFrameLogAt = 0

  let transitionContainer: Container | null = null
  let transitionSprite: Sprite | null = null
  let fallbackFromSprite: Sprite | null = null
  let fallbackToSprite: Sprite | null = null
  let transitionFilter: Filter | null = null
  let hiddenPair: HiddenPair | null = null
  let transitionFromSnapshotTexture: RenderTexture | null = null
  let transitionToSnapshotTexture: RenderTexture | null = null
  let snapshotCaptureContainer: Container | null = null
  let snapshotCaptureSprite: Sprite | null = null
  const transitionFilterCache = new Map<string, Filter>()
  const railDisposers = new Map<Rail, () => void>()
  const performerDisposers = new Map<RenderablePerformer, () => void>()
  const renderIdleWaiters = new Set<() => void>()

  const handleRailChanged = (): void => {
    requestRender()
  }

  function bindRail(rail: Rail): void {
    if (railDisposers.has(rail))
      return

    rail.on('insertTrain', handleRailChanged)
    rail.on('trainMoveEnd', handleRailChanged)
    rail.on('trainRightResizeEnd', handleRailChanged)
    rail.on('trainsPosUpdated', handleRailChanged)

    railDisposers.set(rail, () => {
      rail.off('insertTrain', handleRailChanged)
      rail.off('trainMoveEnd', handleRailChanged)
      rail.off('trainRightResizeEnd', handleRailChanged)
      rail.off('trainsPosUpdated', handleRailChanged)
    })
  }

  function bindRails(): void {
    const rails = clippa.timeline.rails?.rails ?? []
    rails.forEach(bindRail)
  }

  function bindPerformer(performer: unknown): void {
    if (!isRenderablePerformer(performer) || performerDisposers.has(performer))
      return

    const eventTarget = performer as unknown as {
      on?: (event: 'positionUpdate', handler: () => void) => void
      off?: (event: 'positionUpdate', handler: () => void) => void
    }

    if (!eventTarget.on || !eventTarget.off)
      return

    const handlePositionUpdate = (): void => {
      requestRender()
    }

    eventTarget.on('positionUpdate', handlePositionUpdate)
    performerDisposers.set(performer, () => {
      eventTarget.off?.('positionUpdate', handlePositionUpdate)
    })
  }

  function bindPerformers(): void {
    clippa.theater.performers.forEach(bindPerformer)
  }

  function handlePerformerHire(performer: unknown): void {
    bindRails()
    bindPerformer(performer)
    requestRender()
  }

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

  function clampVideoSourceTime(video: Video, sourceTime: number): number {
    const max = Math.max(0, video.sourceDuration)
    return Math.min(max, Math.max(0, sourceTime))
  }

  function resolveTransitionVideoSourceTime(context: ActiveTransitionContext, video: Video, role: 'from' | 'to'): number {
    const duration = Math.max(0, context.transition.durationMs)
    const half = duration / 2
    if (half <= 0) {
      const cutBase = role === 'from'
        ? video.sourceStart + video.duration
        : video.sourceStart
      return clampVideoSourceTime(video, cutBase)
    }

    const progress = Math.max(0, Math.min(1, context.progress))
    let startOffset = -half
    let endOffset = half

    if (role === 'from') {
      const tail = Math.max(0, video.sourceDuration - (video.sourceStart + video.duration))
      endOffset = Math.min(half, tail)
    }
    else {
      const head = Math.max(0, video.sourceStart)
      startOffset = -Math.min(half, head)
    }

    const offset = startOffset + (endOffset - startOffset) * progress

    if (role === 'from') {
      return clampVideoSourceTime(
        video,
        video.sourceStart + video.duration + offset,
      )
    }

    return clampVideoSourceTime(
      video,
      video.sourceStart + offset,
    )
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
    uniformParams: Record<string, GlTransitionParamValue>,
  ): Filter | null {
    try {
      const emptySource = (PixiTexture.EMPTY as any).source ?? PixiTexture.EMPTY
      const resources: Record<string, unknown> = {
        uFrom: emptySource,
        uTo: emptySource,
        uProgress: createNumericUniformResource('uProgress', 0),
        uRatio: createNumericUniformResource('uRatio', getStageRatio()),
      }

      Object.entries(uniformParams).forEach(([key, value]) => {
        resources[key] = createNumericUniformResource(key, value)
      })

      return PixiFilter.from({
        gl: {
          vertex: TRANSITION_FILTER_VERTEX_SHADER,
          fragment: fragmentShader,
          name: 'transition-filter',
        },
        resources,
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

  function isRenderStale(version: number): boolean {
    if (destroyed)
      return true

    if (isPlaying.value)
      return false

    return version !== renderVersion
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

  function ensureTransitionSnapshotResources(): boolean {
    if (!ready)
      return false

    const app = clippa.stage.app
    const width = Math.max(1, Math.round(app.renderer.width))
    const height = Math.max(1, Math.round(app.renderer.height))
    const resolution = app.renderer.resolution

    if (!transitionFromSnapshotTexture) {
      transitionFromSnapshotTexture = RenderTexture.create({
        width,
        height,
        resolution,
      })
    }
    else if (
      transitionFromSnapshotTexture.width !== width
      || transitionFromSnapshotTexture.height !== height
      || transitionFromSnapshotTexture.source.resolution !== resolution
    ) {
      transitionFromSnapshotTexture.resize(width, height, resolution)
    }

    if (!transitionToSnapshotTexture) {
      transitionToSnapshotTexture = RenderTexture.create({
        width,
        height,
        resolution,
      })
    }
    else if (
      transitionToSnapshotTexture.width !== width
      || transitionToSnapshotTexture.height !== height
      || transitionToSnapshotTexture.source.resolution !== resolution
    ) {
      transitionToSnapshotTexture.resize(width, height, resolution)
    }

    return true
  }

  function ensureSnapshotCaptureLayer(): boolean {
    if (snapshotCaptureContainer && snapshotCaptureSprite)
      return true

    snapshotCaptureContainer = new Container({ label: 'transition-snapshot-capture', visible: true })
    snapshotCaptureSprite = new Sprite()
    snapshotCaptureContainer.addChild(snapshotCaptureSprite)
    return true
  }

  function captureSpriteSnapshot(source: Sprite, targetTexture: RenderTexture): boolean {
    if (!isRenderableTexture(source.texture))
      return false

    if (!ensureSnapshotCaptureLayer() || !snapshotCaptureContainer || !snapshotCaptureSprite)
      return false

    const app = clippa.stage.app
    const snapshotSprite = snapshotCaptureSprite
    const worldTransform = source.getGlobalTransform(undefined, false)

    snapshotSprite.texture = source.texture
    snapshotSprite.anchor.copyFrom(source.anchor)
    snapshotSprite.tint = source.tint
    snapshotSprite.alpha = source.getGlobalAlpha(false)
    snapshotSprite.blendMode = source.blendMode
    snapshotSprite.filters = source.filters ? [...source.filters] : null
    snapshotSprite.visible = true
    snapshotSprite.renderable = true
    snapshotSprite.setFromMatrix(worldTransform)

    app.renderer.render({
      container: snapshotCaptureContainer,
      target: targetTexture,
      clear: true,
    })

    return true
  }

  function resolveTransitionTextures(context: ActiveTransitionContext): { fromTexture: Texture, toTexture: Texture } | null {
    const fromSprite = context.from.sprite
    const toSprite = context.to.sprite
    const fromTexture = fromSprite?.texture
    const toTexture = toSprite?.texture

    if (!fromSprite || !toSprite)
      return null

    if (!isRenderableTexture(fromTexture) || !isRenderableTexture(toTexture))
      return null

    if (!ensureTransitionSnapshotResources()) {
      return {
        fromTexture,
        toTexture,
      }
    }

    if (!transitionFromSnapshotTexture || !transitionToSnapshotTexture) {
      return {
        fromTexture,
        toTexture,
      }
    }

    const fromCaptured = captureSpriteSnapshot(fromSprite, transitionFromSnapshotTexture)
    const toCaptured = captureSpriteSnapshot(toSprite, transitionToSnapshotTexture)

    if (!fromCaptured || !toCaptured) {
      return {
        fromTexture,
        toTexture,
      }
    }

    return {
      fromTexture: transitionFromSnapshotTexture,
      toTexture: transitionToSnapshotTexture,
    }
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

    const resources = (filter as any).resources as Record<string, unknown> | undefined
    if (!resources)
      return false

    if (!isRenderableTexture(fromTexture) || !isRenderableTexture(toTexture))
      return false

    resources.uFrom = fromTexture.source
    resources.uTo = toTexture.source

    if (!updateNumericUniformResource(resources, 'uProgress', progress))
      return false

    if (!updateNumericUniformResource(resources, 'uRatio', getStageRatio()))
      return false

    return true
  }

  async function renderCurrentTransition(version: number): Promise<void> {
    if (!ready || destroyed || isRenderStale(version))
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

    const fromVideo = context.from instanceof Video ? context.from : null
    const toVideo = context.to instanceof Video ? context.to : null
    const fromSourceTime = fromVideo
      ? resolveTransitionVideoSourceTime(context, fromVideo, 'from')
      : 0
    const toSourceTime = toVideo
      ? resolveTransitionVideoSourceTime(context, toVideo, 'to')
      : 0

    if (fromVideo && toVideo && fromVideo !== toVideo) {
      await Promise.all([
        fromVideo.renderFrameAtSourceTime(fromSourceTime),
        toVideo.renderFrameAtSourceTime(toSourceTime),
      ])
      if (isRenderStale(version))
        return
    }
    else {
      if (fromVideo) {
        await fromVideo.renderFrameAtSourceTime(fromSourceTime)
        if (isRenderStale(version))
          return
      }

      if (toVideo) {
        await toVideo.renderFrameAtSourceTime(toSourceTime)
        if (isRenderStale(version))
          return
      }
    }

    const transitionTextures = resolveTransitionTextures(context)
    if (!transitionTextures) {
      restoreHiddenPair()
      hideTransitionLayer()
      return
    }

    const { fromTexture, toTexture } = transitionTextures

    if (isRenderStale(version))
      return

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

    if (TRANSITION_DEBUG_ENABLED) {
      const now = Date.now()
      if (now - lastDebugFrameLogAt >= 80) {
        const fromSprite = context.from.sprite
        const toSprite = context.to.sprite
        debugLogTransition('frame', {
          ts: now,
          version,
          pairKey: context.pairKey,
          transitionType: context.transition.type,
          currentTime: roundDebugNumber(time),
          cutTime: roundDebugNumber(context.candidate.cutTime),
          progress: roundDebugNumber(progress),
          usingFilter,
          filterUpdated,
          usingSnapshotTextures: fromTexture === transitionFromSnapshotTexture && toTexture === transitionToSnapshotTexture,
          stage: {
            width: clippa.stage.app.renderer.width,
            height: clippa.stage.app.renderer.height,
            resolution: clippa.stage.app.renderer.resolution,
          },
          snapshot: {
            from: transitionFromSnapshotTexture
              ? {
                  width: transitionFromSnapshotTexture.width,
                  height: transitionFromSnapshotTexture.height,
                  resolution: transitionFromSnapshotTexture.source.resolution,
                }
              : null,
            to: transitionToSnapshotTexture
              ? {
                  width: transitionToSnapshotTexture.width,
                  height: transitionToSnapshotTexture.height,
                  resolution: transitionToSnapshotTexture.source.resolution,
                }
              : null,
          },
          from: {
            id: context.from.id,
            sprite: serializeSpriteDebugState(fromSprite),
            sourceTime: fromVideo
              ? roundDebugNumber(fromSourceTime)
              : null,
          },
          to: {
            id: context.to.id,
            sprite: serializeSpriteDebugState(toSprite),
            sourceTime: toVideo
              ? roundDebugNumber(toSourceTime)
              : null,
          },
        })
        lastDebugFrameLogAt = now
      }
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
        const version = renderVersion
        await renderCurrentTransition(version)
      }
    }
    finally {
      rendering = false
      if (!pending && renderIdleWaiters.size > 0) {
        const waiters = [...renderIdleWaiters]
        renderIdleWaiters.clear()
        waiters.forEach(resolve => resolve())
      }
    }
  }

  function requestRender(): void {
    renderVersion += 1
    pending = true
    void flushRender()
  }

  async function waitForRenderIdle(): Promise<void> {
    if (!pending && !rendering)
      return

    await new Promise<void>((resolve) => {
      renderIdleWaiters.add(resolve)
      void flushRender()
    })
  }

  async function syncTransitionFrame(): Promise<void> {
    if (!ready || destroyed)
      return

    if (!pending && !rendering)
      requestRender()
    await waitForRenderIdle()
  }

  onMounted(async () => {
    await clippa.ready
    if (destroyed)
      return

    ready = true
    editorStore.registerTransitionFrameSyncer(syncTransitionFrame)
    bindRails()
    bindPerformers()
    clippa.timeline.on('durationChanged', bindRails)
    clippa.theater.on('hire', handlePerformerHire)
    ensureTransitionLayer()
    requestRender()
  })

  onUnmounted(() => {
    destroyed = true
    editorStore.registerTransitionFrameSyncer(null)
    pending = false

    if (renderIdleWaiters.size > 0) {
      const waiters = [...renderIdleWaiters]
      renderIdleWaiters.clear()
      waiters.forEach(resolve => resolve())
    }

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

    if (transitionFromSnapshotTexture) {
      transitionFromSnapshotTexture.destroy(true)
      transitionFromSnapshotTexture = null
    }

    if (transitionToSnapshotTexture) {
      transitionToSnapshotTexture.destroy(true)
      transitionToSnapshotTexture = null
    }

    if (snapshotCaptureContainer) {
      snapshotCaptureContainer.destroy({ children: true })
      snapshotCaptureContainer = null
    }
    snapshotCaptureSprite = null

    transitionFilterCache.forEach((filter) => {
      (filter as any).destroy?.()
    })
    transitionFilterCache.clear()

    clippa.timeline.off('durationChanged', bindRails)
    clippa.theater.off('hire', handlePerformerHire)
    railDisposers.forEach(dispose => dispose())
    railDisposers.clear()
    performerDisposers.forEach(dispose => dispose())
    performerDisposers.clear()
  })

  watch(
    () => [currentTime.value, transitionsSignature.value, transitions.value.length],
    () => {
      requestRender()
    },
    { immediate: true },
  )
}
