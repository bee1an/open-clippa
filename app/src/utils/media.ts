import {
  ALL_FORMATS,
  AudioBufferSink,
  BlobSource,
  Input,
  UrlSource,
} from 'mediabunny'

export interface ExtractedAudioTrackMetadata {
  index: number
  codec: string
  channels: number
  sampleRate: number
  bitrate: number
}

export interface ExtractedVideoTrackMetadata {
  codec: string
  width: number
  height: number
  frameRate: number
  bitrate: number
}

export interface MediaWaveformPeaks {
  sampleCount: number
  peaks: number[]
}

export interface ExtractedMediaMetadata {
  durationMs: number
  mimeType: string | null
  video: ExtractedVideoTrackMetadata | null
  audioTracks: ExtractedAudioTrackMetadata[]
  waveform: MediaWaveformPeaks | null
}

export interface VideoMetadata {
  duration: number
  width: number
  height: number
}

function isFileLike(source: string | File | Blob): source is File | Blob {
  return typeof source !== 'string'
}

function createInputSource(source: string | File | Blob): UrlSource | BlobSource {
  if (typeof source === 'string')
    return new UrlSource(source)

  return new BlobSource(source)
}

function resolveMimeType(source: string | File | Blob): string | null {
  if (typeof source === 'string')
    return null

  return source.type || null
}

function normalizeDurationMs(value: number | undefined): number {
  if (!Number.isFinite(value) || !value || value < 0)
    return 0

  return Math.max(0, Math.round(value * 1000))
}

async function resolveAudioTrackBitrate(track: Awaited<ReturnType<Input['getPrimaryAudioTrack']>>): Promise<number> {
  if (!track)
    return 0

  try {
    const stats = await track.computePacketStats(120)
    return Number.isFinite(stats.averageBitrate) ? Math.max(0, Math.round(stats.averageBitrate)) : 0
  }
  catch {
    return 0
  }
}

async function resolveVideoTrackBitrate(track: Awaited<ReturnType<Input['getPrimaryVideoTrack']>>): Promise<number> {
  if (!track)
    return 0

  try {
    const stats = await track.computePacketStats(120)
    return Number.isFinite(stats.averageBitrate) ? Math.max(0, Math.round(stats.averageBitrate)) : 0
  }
  catch {
    return 0
  }
}

function normalizeWaveformPeaks(peaks: number[]): number[] {
  if (peaks.length === 0)
    return []

  const max = peaks.reduce((value, current) => Math.max(value, current), 0)
  if (max <= 0)
    return peaks.map(() => 0)

  return peaks.map(value => Math.max(0, Math.min(1, value / max)))
}

async function extractWaveform(
  input: Input,
  durationSec: number,
  sampleCount: number,
): Promise<MediaWaveformPeaks | null> {
  if (!Number.isFinite(durationSec) || durationSec <= 0 || sampleCount <= 0)
    return null

  const audioTrack = await input.getPrimaryAudioTrack()
  if (!audioTrack)
    return null

  const sink = new AudioBufferSink(audioTrack)
  const peaks = Array.from({ length: sampleCount }, () => 0)

  for await (const wrapped of sink.buffers(0, durationSec)) {
    const buffer = wrapped.buffer
    const startBucket = Math.max(0, Math.min(sampleCount - 1, Math.floor((wrapped.timestamp / durationSec) * sampleCount)))
    const endBucket = Math.max(
      startBucket,
      Math.min(
        sampleCount - 1,
        Math.floor((((wrapped.timestamp + wrapped.duration) || wrapped.timestamp) / durationSec) * sampleCount),
      ),
    )

    let maxAmplitude = 0
    for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
      const channel = buffer.getChannelData(channelIndex)
      const stride = Math.max(1, Math.floor(channel.length / 512))
      for (let index = 0; index < channel.length; index += stride) {
        const amplitude = Math.abs(channel[index] ?? 0)
        if (amplitude > maxAmplitude)
          maxAmplitude = amplitude
      }
    }

    for (let bucketIndex = startBucket; bucketIndex <= endBucket; bucketIndex += 1) {
      peaks[bucketIndex] = Math.max(peaks[bucketIndex] ?? 0, maxAmplitude)
    }
  }

  return {
    sampleCount,
    peaks: normalizeWaveformPeaks(peaks),
  }
}

export async function inspectMediaSource(
  source: string | File | Blob,
  options: { waveformSampleCount?: number } = {},
): Promise<ExtractedMediaMetadata> {
  const input = new Input({
    formats: ALL_FORMATS,
    source: createInputSource(source),
  })

  const [videoTrack, audioTrack] = await Promise.all([
    input.getPrimaryVideoTrack(),
    input.getPrimaryAudioTrack(),
  ])

  const [videoDurationSec, audioDurationSec] = await Promise.all([
    videoTrack?.computeDuration() ?? Promise.resolve(0),
    audioTrack?.computeDuration() ?? Promise.resolve(0),
  ])
  const durationSec = Math.max(videoDurationSec, audioDurationSec, 0)

  const [videoBitrate, audioBitrate, waveform] = await Promise.all([
    resolveVideoTrackBitrate(videoTrack),
    resolveAudioTrackBitrate(audioTrack),
    extractWaveform(input, durationSec, options.waveformSampleCount ?? 96),
  ])

  return {
    durationMs: normalizeDurationMs(durationSec),
    mimeType: resolveMimeType(source),
    video: videoTrack
      ? {
          codec: videoTrack.codec ? String(videoTrack.codec) : 'unknown',
          width: Number.isFinite(videoTrack.displayWidth) ? Math.max(0, Math.round(videoTrack.displayWidth)) : 0,
          height: Number.isFinite(videoTrack.displayHeight) ? Math.max(0, Math.round(videoTrack.displayHeight)) : 0,
          frameRate: 0,
          bitrate: videoBitrate,
        }
      : null,
    audioTracks: audioTrack
      ? [{
          index: 0,
          codec: audioTrack.codec ? String(audioTrack.codec) : 'unknown',
          channels: Number.isFinite(audioTrack.numberOfChannels) ? Math.max(0, Math.round(audioTrack.numberOfChannels)) : 0,
          sampleRate: Number.isFinite(audioTrack.sampleRate) ? Math.max(0, Math.round(audioTrack.sampleRate)) : 0,
          bitrate: audioBitrate,
        }]
      : [],
    waveform,
  }
}

export async function loadVideoMetadata(source: string | File | Blob): Promise<VideoMetadata> {
  const metadata = await inspectMediaSource(source, { waveformSampleCount: 0 })

  return {
    duration: metadata.durationMs,
    width: metadata.video?.width ?? 0,
    height: metadata.video?.height ?? 0,
  }
}

export async function fetchSourceArrayBuffer(source: string | File | Blob): Promise<ArrayBuffer> {
  if (isFileLike(source))
    return await source.arrayBuffer()

  const response = await fetch(source)
  if (!response.ok)
    throw new Error(`Failed to fetch media source: ${response.status}`)

  return await response.arrayBuffer()
}
