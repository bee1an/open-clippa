import { TIMELINE_AUDIO_TRAIN_HEIGHT } from '@clippc/constants'
import type { ExtendTrainEvents, ExtendTrainOption } from './types'
import { Graphics } from 'pixi.js'
import { Train } from './train'

type AudioTrainEvents = ExtendTrainEvents<Record<never, never[]>>

type AudioTrainOption = ExtendTrainOption<{
  waveformPeaks?: number[]
  assetDuration?: number
  sourceStart?: number
  sourceDuration?: number
  muted?: boolean
  volume?: number
}>

const WAVEFORM_BASE_COLOR = 0x5EEAD4
const WAVEFORM_MUTED_COLOR = 0x6B7280
const WAVEFORM_BASELINE_COLOR = 0x1F2937
const MIN_BAR_HEIGHT = 4
const BAR_WIDTH = 2
const BAR_GAP = 1

export class AudioTrain extends Train<AudioTrainEvents> {
  private _waveformLayer: Graphics
  private _waveformPeaks: number[]
  private _assetDuration: number
  private _sourceStart: number
  private _sourceDuration: number
  private _muted: boolean
  private _volume: number

  constructor(option: AudioTrainOption) {
    super({
      ...option,
      height: option.height ?? TIMELINE_AUDIO_TRAIN_HEIGHT,
      railStyle: 'audio',
    })

    this._waveformPeaks = option.waveformPeaks ?? []
    this._assetDuration = Math.max(0, option.assetDuration ?? option.duration)
    this._sourceStart = Math.max(0, option.sourceStart ?? 0)
    this._sourceDuration = Math.max(0, option.sourceDuration ?? option.duration)
    this._muted = option.muted ?? false
    this._volume = Math.max(0, Math.min(1, option.volume ?? 1))
    this._waveformLayer = new Graphics({ label: 'audio-train-waveform' })
    this._waveformLayer.eventMode = 'none'
    this._slot.addChild(this._waveformLayer)
    this._renderWaveform()
  }

  updateWidth(width: number): void {
    super.updateWidth(width)
    this._renderWaveform()
  }

  updateWaveform(peaks: number[]): void {
    this._waveformPeaks = peaks
    this._renderWaveform()
  }

  updateAudioWindow(sourceStart: number, sourceDuration: number, assetDuration?: number): void {
    this._sourceStart = Math.max(0, sourceStart)
    this._sourceDuration = Math.max(0, sourceDuration)
    if (typeof assetDuration === 'number')
      this._assetDuration = Math.max(0, assetDuration)
    this._renderWaveform()
  }

  updateAudioState(input: { muted?: boolean, volume?: number }): void {
    if (typeof input.muted === 'boolean')
      this._muted = input.muted
    if (typeof input.volume === 'number')
      this._volume = Math.max(0, Math.min(1, input.volume))
    this._renderWaveform()
  }

  private _resolveVisiblePeaks(): number[] {
    if (this._waveformPeaks.length === 0)
      return []

    if (this._assetDuration <= 0 || this._sourceDuration <= 0)
      return this._waveformPeaks

    const startRatio = this._sourceStart / this._assetDuration
    const endRatio = Math.min(1, (this._sourceStart + this._sourceDuration) / this._assetDuration)
    const startIndex = Math.max(0, Math.floor(startRatio * this._waveformPeaks.length))
    const endIndex = Math.max(startIndex + 1, Math.ceil(endRatio * this._waveformPeaks.length))
    return this._waveformPeaks.slice(startIndex, endIndex)
  }

  private _renderWaveform(): void {
    this._waveformLayer.clear()

    const baselineY = this.height / 2
    this._waveformLayer
      .rect(0, baselineY - 0.5, Math.max(1, this.width), 1)
      .fill(WAVEFORM_BASELINE_COLOR)

    const visiblePeaks = this._resolveVisiblePeaks()
    if (visiblePeaks.length === 0 || this.width <= 0)
      return

    const color = this._muted ? WAVEFORM_MUTED_COLOR : WAVEFORM_BASE_COLOR
    const barCount = Math.max(1, Math.floor(this.width / (BAR_WIDTH + BAR_GAP)))
    const step = visiblePeaks.length / barCount

    for (let barIndex = 0; barIndex < barCount; barIndex += 1) {
      const peakIndex = Math.min(visiblePeaks.length - 1, Math.floor(barIndex * step))
      const peak = Math.max(0, Math.min(1, visiblePeaks[peakIndex] ?? 0)) * this._volume
      const barHeight = Math.max(MIN_BAR_HEIGHT, peak * (this.height - 8))
      const x = barIndex * (BAR_WIDTH + BAR_GAP)
      const y = (this.height - barHeight) / 2
      this._waveformLayer.rect(x, y, BAR_WIDTH, barHeight).fill(color)
    }
  }
}
