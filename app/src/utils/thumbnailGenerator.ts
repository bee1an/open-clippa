import type { VideoFile } from '@/store/useMediaStore'
import { FrameExtractor } from '@clippa/codec'

/**
 * 使用 codec 子包生成视频缩略图
 */
export async function generateThumbnailWithCodec(videoFile: VideoFile): Promise<string> {
  try {
    // 创建 FrameExtractor 实例
    const frameExtractor = new FrameExtractor(videoFile.url)

    // 等待加载完成
    await frameExtractor.load()

    // 获取视频元数据
    const metadata = await frameExtractor.getVideoMetadata()

    // 更新视频文件元数据
    videoFile.metadata = {
      resolution: { width: metadata.width, height: metadata.height },
      frameRate: 30, // 默认值，可以从元数据中获取更准确的信息
      codec: 'unknown',
      bitrate: 0,
      aspectRatio: calculateAspectRatio(metadata.width, metadata.height),
      colorSpace: undefined,
      audioTracks: metadata.hasAudio
        ? [{
            index: 0,
            codec: 'unknown',
            channels: metadata.audioChanCount,
            sampleRate: metadata.audioSampleRate,
            bitrate: 0,
          }]
        : [],
    }

    // 更新时长（从微秒转换为毫秒）
    videoFile.duration = metadata.duration / 1000

    // 获取视频开始时间的帧作为缩略图
    const thumbnailTime = 1000 // 1秒 = 1,000,000 微秒
    const frame = await frameExtractor.getFrameByTime(thumbnailTime)

    if (frame.video) {
      // 创建 canvas 来绘制视频帧
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        throw new Error('无法获取 canvas context')
      }

      // 设置画布尺寸，保持16:9比例
      canvas.width = 160
      canvas.height = 90

      // 绘制视频帧
      ctx.drawImage(frame.video, 0, 0, canvas.width, canvas.height)

      // 关闭视频帧
      frame.video.close()

      // 转换为 blob
      return new Promise((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            const thumbnailUrl = URL.createObjectURL(blob)
            resolve(thumbnailUrl)
          }
          else {
            reject(new Error('无法生成缩略图'))
          }
        }, 'image/jpeg', 0.9)
      })
    }
    else {
      throw new Error('无法获取视频帧')
    }
  }
  catch (error) {
    console.error('使用 codec 生成缩略图失败:', error)
    throw error
  }
}

/**
 * 计算宽高比
 */
function calculateAspectRatio(width: number, height: number): string {
  if (width === 0 || height === 0) {
    return '16:9'
  }

  const gcd = (a: number, b: number): number => {
    return b === 0 ? a : gcd(b, a % b)
  }

  const divisor = gcd(width, height)
  const aspectWidth = width / divisor
  const aspectHeight = height / divisor

  // 限制宽高比的精度
  if (aspectWidth > 9 || aspectHeight > 9) {
    // 如果比例过大，使用近似值
    const ratio = width / height
    if (ratio > 1.7)
      return '16:9'
    if (ratio > 1.5)
      return '3:2'
    if (ratio > 1.3)
      return '4:3'
    if (ratio > 0.9)
      return '1:1'
    return '9:16'
  }

  return `${aspectWidth}:${aspectHeight}`
}
