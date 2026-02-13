import type { Rail, Timeline } from 'clippc'
import type { Application, Filter, RenderTexture, Texture } from 'pixi.js'
import type { GlTransitionParamValue } from './glTransitions'
import type { ActiveTransitionContext, TransitionRenderablePerformer } from './runtimeCore'
import type { TransitionSpec } from './transition'
import { Container, Filter as PixiFilter, RenderTexture as PixiRenderTexture, Texture as PixiTexture, Sprite } from 'pixi.js'
import {
  buildGlTransitionFragment,
  getGlTransitionPresetByType,
  normalizeGlTransitionParams,
} from './glTransitions'
import {
  isTransitionRenderablePerformer,
  isTransitionVideoPerformer,
  resolveActiveTransition,
  resolveTransitionVideoSourceTime,
} from './runtimeCore'
import { TRANSITION_FEATURE_AVAILABLE } from './transition'

interface NumericUniformResourceDescriptor {
  value: number | number[]
  type: NumericUniformType
}

type NumericUniformType = 'f32' | 'vec2<f32>' | 'vec3<f32>' | 'vec4<f32>'
type TransitionDebugMatrix = { a: number, b: number, c: number, d: number, tx: number, ty: number }

type HiddenPair = {
  pairKey: string
  from: TransitionRenderablePerformer
  to: TransitionRenderablePerformer
}

export interface TransitionRuntimeAdapter {
  ready: Promise<void>
  timeline: Timeline
  getCurrentTime: () => number
  isPlaying: () => boolean
  getTransitions: () => TransitionSpec[]
  getPerformerById: (performerId: string) => unknown
  getPerformers: () => unknown[]
  getApp: () => Application
  onTimelineDurationChanged: (handler: () => void) => () => void
  onPerformerHire: (handler: (performer: unknown) => void) => () => void
}

export interface TransitionRuntimeOptions {
  fragmentShader?: string
  createFilter?: (input: {
    vertexShader: string
    fragmentShader: string
    uniformParams: Record<string, GlTransitionParamValue>
    ratio: number
  }) => Filter | null
  createRenderTexture?: (input: {
    width: number
    height: number
    resolution: number
  }) => RenderTexture
  debugEnabled?: boolean
  debugLog?: (event: string, payload: Record<string, unknown>) => void
}

export interface TransitionRuntimeDebugState {
  ready: boolean
  pending: boolean
  rendering: boolean
  started: boolean
  filterCacheSize: number
  hasTransitionLayer: boolean
  hasSnapshotTextures: boolean
}

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

function resolveNumericUniformDescriptor(value: GlTransitionParamValue): NumericUniformResourceDescriptor {
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
): Record<string, NumericUniformResourceDescriptor> {
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

export class TransitionRuntime {
  private readonly debugEnabled: boolean
  private ready = false
  private started = false
  private stopped = false
  private rendering = false
  private pending = false
  private renderVersion = 0
  private lastDebugFrameLogAt = 0

  private transitionContainer: Container | null = null
  private transitionSprite: Sprite | null = null
  private fallbackFromSprite: Sprite | null = null
  private fallbackToSprite: Sprite | null = null
  private transitionFilter: Filter | null = null
  private hiddenPair: HiddenPair | null = null
  private transitionFromSnapshotTexture: RenderTexture | null = null
  private transitionToSnapshotTexture: RenderTexture | null = null
  private snapshotCaptureContainer: Container | null = null
  private snapshotCaptureSprite: Sprite | null = null

  private readonly transitionFilterCache = new Map<string, Filter>()
  private readonly railDisposers = new Map<Rail, () => void>()
  private readonly performerDisposers = new Map<TransitionRenderablePerformer, () => void>()
  private readonly renderIdleWaiters = new Set<() => void>()

  private durationChangedDisposer: (() => void) | null = null
  private performerHireDisposer: (() => void) | null = null

  constructor(
    private readonly adapter: TransitionRuntimeAdapter,
    private readonly options: TransitionRuntimeOptions = {},
  ) {
    this.debugEnabled = options.debugEnabled ?? (import.meta.env.VITE_TRANSITION_DEBUG === 'true')
  }

  getDebugState(): TransitionRuntimeDebugState {
    return {
      ready: this.ready,
      pending: this.pending,
      rendering: this.rendering,
      started: this.started,
      filterCacheSize: this.transitionFilterCache.size,
      hasTransitionLayer: Boolean(this.transitionContainer),
      hasSnapshotTextures: Boolean(this.transitionFromSnapshotTexture || this.transitionToSnapshotTexture),
    }
  }

  async start(): Promise<void> {
    if (this.started || this.stopped)
      return

    if (!TRANSITION_FEATURE_AVAILABLE)
      return

    await this.adapter.ready
    if (this.stopped)
      return

    this.ready = true
    this.started = true

    this.bindRails()
    this.bindPerformers()

    this.durationChangedDisposer = this.adapter.onTimelineDurationChanged(() => {
      this.bindRails()
      this.requestRender()
    })

    this.performerHireDisposer = this.adapter.onPerformerHire((performer) => {
      this.bindRails()
      this.bindPerformer(performer)
      this.requestRender()
    })

    this.ensureTransitionLayer()
    this.requestRender()
  }

  stop(): void {
    if (this.stopped)
      return

    this.stopped = true
    this.started = false
    this.ready = false
    this.pending = false

    if (this.renderIdleWaiters.size > 0) {
      const waiters = [...this.renderIdleWaiters]
      this.renderIdleWaiters.clear()
      waiters.forEach(resolve => resolve())
    }

    this.durationChangedDisposer?.()
    this.durationChangedDisposer = null
    this.performerHireDisposer?.()
    this.performerHireDisposer = null

    this.restoreHiddenPair()
    this.hideTransitionLayer()

    const app = this.adapter.getApp()
    if (this.transitionContainer) {
      app.stage.removeChild(this.transitionContainer)
      ;(this.transitionContainer as any).destroy?.({ children: true })
      this.transitionContainer = null
    }

    this.transitionSprite = null
    this.fallbackFromSprite = null
    this.fallbackToSprite = null
    this.transitionFilter = null

    if (this.transitionFromSnapshotTexture) {
      this.transitionFromSnapshotTexture.destroy(true)
      this.transitionFromSnapshotTexture = null
    }

    if (this.transitionToSnapshotTexture) {
      this.transitionToSnapshotTexture.destroy(true)
      this.transitionToSnapshotTexture = null
    }

    if (this.snapshotCaptureContainer) {
      ;(this.snapshotCaptureContainer as any).destroy?.({ children: true })
      this.snapshotCaptureContainer = null
    }
    this.snapshotCaptureSprite = null

    this.transitionFilterCache.forEach((filter) => {
      (filter as any).destroy?.()
    })
    this.transitionFilterCache.clear()

    this.railDisposers.forEach(dispose => dispose())
    this.railDisposers.clear()

    this.performerDisposers.forEach(dispose => dispose())
    this.performerDisposers.clear()
  }

  requestRender(): void {
    if (this.stopped)
      return

    this.renderVersion += 1
    this.pending = true
    void this.flushRender()
  }

  async syncFrame(): Promise<void> {
    if (!this.ready || this.stopped)
      return

    if (!this.pending && !this.rendering)
      this.requestRender()

    await this.waitForRenderIdle()
  }

  private debugLog(event: string, payload: Record<string, unknown>): void {
    if (!this.debugEnabled)
      return

    if (this.options.debugLog) {
      this.options.debugLog(event, payload)
      return
    }

    const line = JSON.stringify({
      tag: 'transition-debug',
      event,
      ...payload,
    })

    const scope = globalThis as Record<string, unknown>
    const current = scope[TRANSITION_DEBUG_BUFFER_KEY]
    const buffer = Array.isArray(current) ? current as string[] : []
    buffer.push(line)
    if (buffer.length > TRANSITION_DEBUG_MAX_BUFFER)
      buffer.splice(0, buffer.length - TRANSITION_DEBUG_MAX_BUFFER)

    scope[TRANSITION_DEBUG_BUFFER_KEY] = buffer
    console.warn(`${TRANSITION_DEBUG_PREFIX} ${line}`)
  }

  private bindRails(): void {
    const rails = this.adapter.timeline.rails?.rails ?? []
    rails.forEach((rail) => {
      this.bindRail(rail)
    })
  }

  private bindRail(rail: Rail): void {
    if (this.railDisposers.has(rail))
      return

    const handleRailChanged = (): void => {
      this.requestRender()
    }

    rail.on('insertTrain', handleRailChanged)
    rail.on('trainMoveEnd', handleRailChanged)
    rail.on('trainRightResizeEnd', handleRailChanged)
    rail.on('trainsPosUpdated', handleRailChanged)

    this.railDisposers.set(rail, () => {
      rail.off('insertTrain', handleRailChanged)
      rail.off('trainMoveEnd', handleRailChanged)
      rail.off('trainRightResizeEnd', handleRailChanged)
      rail.off('trainsPosUpdated', handleRailChanged)
    })
  }

  private bindPerformers(): void {
    this.adapter.getPerformers().forEach((performer) => {
      this.bindPerformer(performer)
    })
  }

  private bindPerformer(performer: unknown): void {
    if (!isTransitionRenderablePerformer(performer) || this.performerDisposers.has(performer))
      return

    const eventTarget = performer as TransitionRenderablePerformer & {
      on?: (event: 'positionUpdate', handler: () => void) => void
      off?: (event: 'positionUpdate', handler: () => void) => void
    }

    if (!eventTarget.on || !eventTarget.off)
      return

    const handlePositionUpdate = (): void => {
      this.requestRender()
    }

    eventTarget.on('positionUpdate', handlePositionUpdate)
    this.performerDisposers.set(performer, () => {
      eventTarget.off?.('positionUpdate', handlePositionUpdate)
    })
  }

  private getStageRatio(): number {
    const renderer = this.adapter.getApp().renderer
    if (!renderer.height)
      return 1

    return renderer.width / renderer.height
  }

  private serializeUniformValue(value: unknown): string {
    if (Array.isArray(value))
      return `[${value.join(',')}]`

    return String(value)
  }

  private createTransitionFilter(
    fragmentShader: string,
    uniformParams: Record<string, GlTransitionParamValue>,
  ): Filter | null {
    try {
      if (this.options.createFilter) {
        return this.options.createFilter({
          vertexShader: TRANSITION_FILTER_VERTEX_SHADER,
          fragmentShader,
          uniformParams,
          ratio: this.getStageRatio(),
        })
      }

      const emptySource = (PixiTexture.EMPTY as any).source ?? PixiTexture.EMPTY
      const resources: Record<string, unknown> = {
        uFrom: emptySource,
        uTo: emptySource,
        uProgress: createNumericUniformResource('uProgress', 0),
        uRatio: createNumericUniformResource('uRatio', this.getStageRatio()),
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

  private resolveTransitionFilter(transition: TransitionSpec): Filter | null {
    const preset = getGlTransitionPresetByType(transition.type)
    const uniformParams = normalizeGlTransitionParams(preset.type, transition.params)

    const paramsSignature = Object.keys(uniformParams)
      .sort()
      .map(key => `${key}:${this.serializeUniformValue(uniformParams[key])}`)
      .join('|')

    const cacheKey = `${preset.type}:${paramsSignature}`
    const cached = this.transitionFilterCache.get(cacheKey)
    if (cached)
      return cached

    const fragmentShader = this.options.fragmentShader ?? buildGlTransitionFragment(preset.glsl)
    const filter = this.createTransitionFilter(fragmentShader, uniformParams)
    if (!filter)
      return null

    this.transitionFilterCache.set(cacheKey, filter)
    return filter
  }

  private isRenderStale(version: number): boolean {
    if (this.stopped)
      return true

    if (this.adapter.isPlaying())
      return false

    return version !== this.renderVersion
  }

  private ensureTransitionLayer(): boolean {
    if (!this.ready || this.transitionContainer)
      return Boolean(this.transitionContainer)

    const app = this.adapter.getApp()

    this.transitionContainer = new Container({ label: 'transition-container', visible: false })
    this.transitionSprite = new Sprite(PixiTexture.WHITE)
    this.fallbackFromSprite = new Sprite(PixiTexture.WHITE)
    this.fallbackToSprite = new Sprite(PixiTexture.WHITE)

    this.transitionSprite.filters = null

    this.transitionContainer.addChild(this.transitionSprite)
    this.transitionContainer.addChild(this.fallbackFromSprite)
    this.transitionContainer.addChild(this.fallbackToSprite)

    app.stage.addChild(this.transitionContainer)
    this.syncLayerSize()
    return true
  }

  private syncLayerSize(): void {
    if (!this.transitionSprite || !this.fallbackFromSprite || !this.fallbackToSprite)
      return

    const app = this.adapter.getApp()
    const width = app.renderer.width
    const height = app.renderer.height

    this.transitionSprite.width = width
    this.transitionSprite.height = height

    this.fallbackFromSprite.width = width
    this.fallbackFromSprite.height = height

    this.fallbackToSprite.width = width
    this.fallbackToSprite.height = height
  }

  private createRenderTexture(input: { width: number, height: number, resolution: number }): RenderTexture {
    if (this.options.createRenderTexture)
      return this.options.createRenderTexture(input)

    return PixiRenderTexture.create(input)
  }

  private ensureTransitionSnapshotResources(): boolean {
    if (!this.ready)
      return false

    const app = this.adapter.getApp()
    const width = Math.max(1, Math.round(app.renderer.width))
    const height = Math.max(1, Math.round(app.renderer.height))
    const resolution = app.renderer.resolution

    if (!this.transitionFromSnapshotTexture) {
      this.transitionFromSnapshotTexture = this.createRenderTexture({ width, height, resolution })
    }
    else {
      const currentResolution = (this.transitionFromSnapshotTexture.source as any)?.resolution
      if (
        this.transitionFromSnapshotTexture.width !== width
        || this.transitionFromSnapshotTexture.height !== height
        || currentResolution !== resolution
      ) {
        this.transitionFromSnapshotTexture.resize(width, height, resolution)
      }
    }

    if (!this.transitionToSnapshotTexture) {
      this.transitionToSnapshotTexture = this.createRenderTexture({ width, height, resolution })
    }
    else {
      const currentResolution = (this.transitionToSnapshotTexture.source as any)?.resolution
      if (
        this.transitionToSnapshotTexture.width !== width
        || this.transitionToSnapshotTexture.height !== height
        || currentResolution !== resolution
      ) {
        this.transitionToSnapshotTexture.resize(width, height, resolution)
      }
    }

    return true
  }

  private ensureSnapshotCaptureLayer(): boolean {
    if (this.snapshotCaptureContainer && this.snapshotCaptureSprite)
      return true

    this.snapshotCaptureContainer = new Container({ label: 'transition-snapshot-capture', visible: true })
    this.snapshotCaptureSprite = new Sprite()
    this.snapshotCaptureContainer.addChild(this.snapshotCaptureSprite)
    return true
  }

  private captureSpriteSnapshot(source: Sprite, targetTexture: RenderTexture): boolean {
    if (!isRenderableTexture(source.texture))
      return false

    if (!this.ensureSnapshotCaptureLayer() || !this.snapshotCaptureContainer || !this.snapshotCaptureSprite)
      return false

    const app = this.adapter.getApp()
    const snapshotSprite = this.snapshotCaptureSprite
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
      container: this.snapshotCaptureContainer,
      target: targetTexture,
      clear: true,
    })

    return true
  }

  private resolveTransitionTextures(context: ActiveTransitionContext): { fromTexture: Texture, toTexture: Texture } | null {
    const fromSprite = context.from.sprite
    const toSprite = context.to.sprite
    const fromTexture = fromSprite?.texture
    const toTexture = toSprite?.texture

    if (!fromSprite || !toSprite)
      return null

    if (!isRenderableTexture(fromTexture) || !isRenderableTexture(toTexture))
      return null

    if (!this.ensureTransitionSnapshotResources()) {
      return {
        fromTexture,
        toTexture,
      }
    }

    if (!this.transitionFromSnapshotTexture || !this.transitionToSnapshotTexture) {
      return {
        fromTexture,
        toTexture,
      }
    }

    const fromCaptured = this.captureSpriteSnapshot(fromSprite, this.transitionFromSnapshotTexture)
    const toCaptured = this.captureSpriteSnapshot(toSprite, this.transitionToSnapshotTexture)

    if (!fromCaptured || !toCaptured) {
      return {
        fromTexture,
        toTexture,
      }
    }

    return {
      fromTexture: this.transitionFromSnapshotTexture,
      toTexture: this.transitionToSnapshotTexture,
    }
  }

  private restoreHiddenPair(): void {
    if (!this.hiddenPair)
      return

    this.hiddenPair.from.sprite && (this.hiddenPair.from.sprite.visible = true)
    this.hiddenPair.to.sprite && (this.hiddenPair.to.sprite.visible = true)
    this.hiddenPair = null
  }

  private hidePair(context: ActiveTransitionContext): void {
    if (this.hiddenPair && this.hiddenPair.pairKey !== context.pairKey)
      this.restoreHiddenPair()

    context.from.sprite && (context.from.sprite.visible = false)
    context.to.sprite && (context.to.sprite.visible = false)
    this.hiddenPair = {
      pairKey: context.pairKey,
      from: context.from,
      to: context.to,
    }
  }

  private hideTransitionLayer(): void {
    if (this.transitionContainer)
      this.transitionContainer.visible = false
  }

  private updateFallbackTextures(fromTexture: Texture, toTexture: Texture, progress: number): void {
    if (!this.fallbackFromSprite || !this.fallbackToSprite)
      return

    this.fallbackFromSprite.visible = true
    this.fallbackToSprite.visible = true
    this.fallbackFromSprite.texture = fromTexture
    this.fallbackToSprite.texture = toTexture
    this.fallbackFromSprite.alpha = 1 - progress
    this.fallbackToSprite.alpha = progress
  }

  private updateFilterUniforms(filter: Filter, fromTexture: Texture, toTexture: Texture, progress: number): boolean {
    const resources = (filter as any).resources as Record<string, unknown> | undefined
    if (!resources)
      return false

    if (!isRenderableTexture(fromTexture) || !isRenderableTexture(toTexture))
      return false

    resources.uFrom = fromTexture.source
    resources.uTo = toTexture.source

    if (!updateNumericUniformResource(resources, 'uProgress', progress))
      return false

    if (!updateNumericUniformResource(resources, 'uRatio', this.getStageRatio()))
      return false

    return true
  }

  private async renderCurrentTransition(version: number): Promise<void> {
    if (!this.ready || this.stopped || this.isRenderStale(version))
      return

    if (!this.ensureTransitionLayer()) {
      this.restoreHiddenPair()
      return
    }

    const time = this.adapter.getCurrentTime()
    const context = resolveActiveTransition({
      time,
      transitions: this.adapter.getTransitions(),
      timeline: this.adapter.timeline,
      getPerformerById: this.adapter.getPerformerById,
      isRenderablePerformer: isTransitionRenderablePerformer,
    })

    if (!context) {
      this.restoreHiddenPair()
      this.hideTransitionLayer()
      return
    }

    const fromVideo = isTransitionVideoPerformer(context.from) ? context.from : null
    const toVideo = isTransitionVideoPerformer(context.to) ? context.to : null

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

      if (this.isRenderStale(version))
        return
    }
    else {
      if (fromVideo) {
        await fromVideo.renderFrameAtSourceTime(fromSourceTime)
        if (this.isRenderStale(version))
          return
      }

      if (toVideo) {
        await toVideo.renderFrameAtSourceTime(toSourceTime)
        if (this.isRenderStale(version))
          return
      }
    }

    const transitionTextures = this.resolveTransitionTextures(context)
    if (!transitionTextures) {
      this.restoreHiddenPair()
      this.hideTransitionLayer()
      return
    }

    const { fromTexture, toTexture } = transitionTextures
    if (this.isRenderStale(version))
      return

    this.syncLayerSize()
    this.hidePair(context)

    if (!this.transitionContainer || !this.transitionSprite || !this.fallbackFromSprite || !this.fallbackToSprite)
      return

    const app = this.adapter.getApp()
    app.stage.setChildIndex(this.transitionContainer, app.stage.children.length - 1)

    const progress = Math.max(0, Math.min(1, context.progress))
    this.transitionFilter = this.resolveTransitionFilter(context.transition)
    const usingFilter = Boolean(this.transitionFilter)

    if (usingFilter) {
      if (this.transitionSprite.filters?.[0] !== this.transitionFilter)
        this.transitionSprite.filters = [this.transitionFilter!]
    }
    else {
      this.transitionSprite.filters = null
    }

    const filterUpdated = this.transitionFilter
      ? this.updateFilterUniforms(this.transitionFilter, fromTexture, toTexture, progress)
      : false

    this.transitionSprite.visible = usingFilter && filterUpdated
    this.fallbackFromSprite.visible = !(usingFilter && filterUpdated)
    this.fallbackToSprite.visible = !(usingFilter && filterUpdated)

    if (usingFilter && filterUpdated) {
      this.fallbackFromSprite.alpha = 0
      this.fallbackToSprite.alpha = 0
    }
    else {
      this.updateFallbackTextures(fromTexture, toTexture, progress)
    }

    if (this.debugEnabled) {
      const now = Date.now()
      if (now - this.lastDebugFrameLogAt >= 80) {
        const fromSprite = context.from.sprite
        const toSprite = context.to.sprite
        this.debugLog('frame', {
          ts: now,
          version,
          pairKey: context.pairKey,
          transitionType: context.transition.type,
          currentTime: roundDebugNumber(time),
          cutTime: roundDebugNumber(context.candidate.cutTime),
          progress: roundDebugNumber(progress),
          usingFilter,
          filterUpdated,
          usingSnapshotTextures: fromTexture === this.transitionFromSnapshotTexture && toTexture === this.transitionToSnapshotTexture,
          stage: {
            width: app.renderer.width,
            height: app.renderer.height,
            resolution: app.renderer.resolution,
          },
          snapshot: {
            from: this.transitionFromSnapshotTexture
              ? {
                  width: this.transitionFromSnapshotTexture.width,
                  height: this.transitionFromSnapshotTexture.height,
                  resolution: (this.transitionFromSnapshotTexture.source as any)?.resolution,
                }
              : null,
            to: this.transitionToSnapshotTexture
              ? {
                  width: this.transitionToSnapshotTexture.width,
                  height: this.transitionToSnapshotTexture.height,
                  resolution: (this.transitionToSnapshotTexture.source as any)?.resolution,
                }
              : null,
          },
          from: {
            id: context.from.id,
            sprite: serializeSpriteDebugState(fromSprite),
            sourceTime: fromVideo ? roundDebugNumber(fromSourceTime) : null,
          },
          to: {
            id: context.to.id,
            sprite: serializeSpriteDebugState(toSprite),
            sourceTime: toVideo ? roundDebugNumber(toSourceTime) : null,
          },
        })

        this.lastDebugFrameLogAt = now
      }
    }

    this.transitionContainer.visible = true
  }

  private async flushRender(): Promise<void> {
    if (this.rendering)
      return

    this.rendering = true
    try {
      while (this.pending) {
        if (this.stopped)
          break

        this.pending = false
        const version = this.renderVersion
        await this.renderCurrentTransition(version)
      }
    }
    finally {
      this.rendering = false
      if (!this.pending && this.renderIdleWaiters.size > 0) {
        const waiters = [...this.renderIdleWaiters]
        this.renderIdleWaiters.clear()
        waiters.forEach(resolve => resolve())
      }
    }
  }

  private async waitForRenderIdle(): Promise<void> {
    if (!this.pending && !this.rendering)
      return

    await new Promise<void>((resolve) => {
      this.renderIdleWaiters.add(resolve)
      void this.flushRender()
    })
  }
}
