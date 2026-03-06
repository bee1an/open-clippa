import type { Filter } from 'pixi.js'
import type { PerformerAnimationSpec } from '../animation'
import type { Performer, PerformerBounds, PerformerOption } from '../performer'
import { EventBus, transformSrc } from '@clippc/utils'
import { PlayState, ShowState } from '../performer'

export interface AudioOption extends PerformerOption {
  id: string
  src: string | File | Blob
  zIndex: number
  sourceStart?: number
  sourceDuration?: number
  waveformPeaks?: number[]
  volume?: number
  muted?: boolean
  timelineLane?: number
  linkGroupId?: string | null
}

export interface AudioStateChange {
  muted: boolean
  volume: number
}

export type AudioEvents = {
  audioStateChange: [AudioStateChange]
  waveformChange: [number[]]
}

const EMPTY_BOUNDS: PerformerBounds = {
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  rotation: 0,
}

export class Audio extends EventBus<AudioEvents> implements Performer {
  id: string
  start: number
  duration: number
  zIndex: number
  src: string
  showState: ShowState = ShowState.UNPLAYED
  playState: PlayState = PlayState.PAUSED
  currentTime: number = 0
  sourceStart: number = 0
  sourceDuration: number = 0
  waveformPeaks: number[] = []
  volume: number = 1
  muted: boolean = false
  timelineLane: number
  linkGroupId: string | null
  renderless = true

  private _audio?: HTMLAudioElement
  private _loader?: Promise<void>

  constructor(option: AudioOption) {
    super()
    this.id = option.id
    this.start = option.start
    this.duration = option.duration
    this.zIndex = option.zIndex
    this.src = transformSrc(option.src)
    this.sourceStart = Math.max(0, option.sourceStart ?? 0)
    this.sourceDuration = Math.max(0, option.sourceDuration ?? option.duration)
    this.waveformPeaks = [...(option.waveformPeaks ?? [])]
    this.volume = Math.max(0, Math.min(1, option.volume ?? 1))
    this.muted = option.muted ?? false
    this.timelineLane = option.timelineLane ?? option.zIndex
    this.linkGroupId = option.linkGroupId ?? null
  }

  get sprite(): undefined {
    return undefined
  }

  async load(): Promise<void> {
    if (this._loader)
      return await this._loader

    this._loader = new Promise<void>((resolve, reject) => {
      const audio = document.createElement('audio')
      audio.preload = 'auto'
      audio.crossOrigin = 'anonymous'
      audio.src = this.src
      audio.volume = this.volume
      audio.muted = this.muted

      const handleLoaded = (): void => {
        if (this.sourceDuration <= 0 && Number.isFinite(audio.duration))
          this.sourceDuration = Math.max(0, Math.round(audio.duration * 1000))
        cleanup()
        this._audio = audio
        resolve()
      }

      const handleError = (): void => {
        cleanup()
        reject(new Error('audio load error'))
      }

      const cleanup = (): void => {
        audio.removeEventListener('loadedmetadata', handleLoaded)
        audio.removeEventListener('error', handleError)
      }

      audio.addEventListener('loadedmetadata', handleLoaded)
      audio.addEventListener('error', handleError)
    })

    return await this._loader
  }

  private _resolvePlaybackTimeSeconds(localTimeMs: number): number {
    const boundedLocalTime = Math.max(0, Math.min(this.duration, localTimeMs))
    return Math.max(0, (this.sourceStart + boundedLocalTime) / 1000)
  }

  private _resolvePlaybackEndSeconds(): number {
    return Math.max(
      this._resolvePlaybackTimeSeconds(0),
      (this.sourceStart + Math.max(0, this.duration)) / 1000,
    )
  }

  private _syncPlaybackPosition(force: boolean = false): void {
    if (!this._audio)
      return

    const nextTime = this._resolvePlaybackTimeSeconds(this.currentTime)
    if (force || Math.abs(this._audio.currentTime - nextTime) > 0.08)
      this._audio.currentTime = nextTime
  }

  private _applyAudioState(): void {
    if (!this._audio)
      return

    this._audio.volume = this.volume
    this._audio.muted = this.muted
  }

  play(time: number): void {
    this.update(time)
    if (this.playState === PlayState.PLAYING)
      return

    this.playState = PlayState.PLAYING
    this._syncPlaybackPosition(true)
    this._applyAudioState()
    void this._audio?.play().catch(() => {})
  }

  update(time: number): void {
    this.currentTime = time

    if (time < 0) {
      this.showState = ShowState.UNPLAYED
      this._audio?.pause()
      return
    }

    if (time > this.duration) {
      this.showState = ShowState.PLAYED
      this.playState = PlayState.PAUSED
      this._audio?.pause()
      this._syncPlaybackPosition(true)
      return
    }

    this.showState = ShowState.PLAYING
    this._applyAudioState()
    this._syncPlaybackPosition()
    if (this._audio && this._audio.currentTime >= this._resolvePlaybackEndSeconds()) {
      this._audio.pause()
      this._audio.currentTime = this._resolvePlaybackTimeSeconds(this.duration)
    }
  }

  pause(time: number): void {
    this.update(time)
    if (this.playState === PlayState.PAUSED)
      return

    this.playState = PlayState.PAUSED
    this._audio?.pause()
    this._syncPlaybackPosition(true)
  }

  async seek(time: number): Promise<void> {
    await this.load()
    this.currentTime = time
    this.update(time)
    this._syncPlaybackPosition(true)
  }

  containsPoint(): boolean {
    return false
  }

  getBounds(): PerformerBounds {
    return { ...EMPTY_BOUNDS }
  }

  getBaseBounds(): PerformerBounds {
    return { ...EMPTY_BOUNDS }
  }

  setPosition(): void {}

  setScale(): void {}

  setRotation(): void {}

  setAlpha(): void {}

  setAnimation(_spec: PerformerAnimationSpec | null): void {}

  setFilters(_filters: Filter[] | null): void {}

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume))
    this._applyAudioState()
    this.emit('audioStateChange', { muted: this.muted, volume: this.volume })
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    this._applyAudioState()
    this.emit('audioStateChange', { muted: this.muted, volume: this.volume })
  }

  setWaveformPeaks(peaks: number[]): void {
    this.waveformPeaks = [...peaks]
    this.emit('waveformChange', [...this.waveformPeaks])
  }

  destroy(): void {
    this._audio?.pause()
    if (this._audio) {
      this._audio.src = ''
      this._audio.load()
    }
    this._audio = undefined
    this.showState = ShowState.UNPLAYED
    this.playState = PlayState.PAUSED
  }
}
