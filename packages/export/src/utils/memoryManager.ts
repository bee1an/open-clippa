/**
 * 内存管理工具 - 优化大文件处理的内存使用
 */
export class MemoryManager {
  private static _instance: MemoryManager
  private _memoryThreshold = 0.8 // 内存使用阈值
  private _chunkSize = 1024 * 1024 // 1MB chunks
  private _activeStreams = new Set<ReadableStream<Uint8Array>>()

  static getInstance(): MemoryManager {
    if (!MemoryManager._instance) {
      MemoryManager._instance = new MemoryManager()
    }
    return MemoryManager._instance
  }

  /**
   * 设置内存阈值 (0-1)
   */
  setMemoryThreshold(threshold: number): void {
    this._memoryThreshold = Math.max(0.1, Math.min(0.95, threshold))
  }

  /**
   * 设置块大小
   */
  setChunkSize(size: number): void {
    this._chunkSize = Math.max(1024, Math.min(10 * 1024 * 1024, size)) // 1KB - 10MB
  }

  /**
   * 获取当前内存使用情况
   */
  getMemoryUsage(): {
    used: number
    total: number
    usage: number
    available: number
  } {
    const memory = (performance as any).memory
    if (!memory) {
      return { used: 0, total: 0, usage: 0, available: 0 }
    }

    const used = memory.usedJSHeapSize
    const total = memory.totalJSHeapSize
    const limit = memory.jsHeapSizeLimit
    const usage = used / total
    const available = limit - used

    return { used, total, usage, available }
  }

  /**
   * 检查内存是否充足
   */
  hasEnoughMemory(estimatedSize: number): boolean {
    const memory = this.getMemoryUsage()
    return memory.available > estimatedSize * 2 && memory.usage < this._memoryThreshold
  }

  /**
   * 创建内存友好的流
   */
  createMemoryEfficientStream(source: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const reader = source.getReader()
        let buffer = new Uint8Array(0)

        function pump(): Promise<void> {
          return reader.read().then(({ done, value }) => {
            if (done) {
              if (buffer.length > 0) {
                controller.enqueue(buffer)
              }
              controller.close()
              return
            }

            // 合并数据
            const newBuffer = new Uint8Array(buffer.length + value.length)
            newBuffer.set(buffer)
            newBuffer.set(value, buffer.length)
            buffer = newBuffer

            // 当缓冲区达到块大小时发送
            if (buffer.length >= MemoryManager.getInstance()._chunkSize) {
              controller.enqueue(buffer)
              buffer = new Uint8Array(0)

              // 检查内存使用
              const memoryManager = MemoryManager.getInstance()
              if (!memoryManager.hasEnoughMemory(0)) {
                console.warn('内存使用过高，建议清理缓存')
              }
            }

            return pump()
          })
        }

        return pump()
      },
    })

    this._activeStreams.add(stream)

    // 自动清理
    stream.getReader().closed.then(() => {
      this._activeStreams.delete(stream)
    }).catch(() => {
      this._activeStreams.delete(stream)
    })

    return stream
  }

  /**
   * 分块处理大数据
   */
  async processInChunks<T, R>(
    data: T[],
    processor: (chunk: T[]) => Promise<R[]>,
    chunkSize?: number,
  ): Promise<R[]> {
    const size = chunkSize || Math.max(1, Math.floor(data.length / 10))
    const results: R[] = []

    for (let i = 0; i < data.length; i += size) {
      const chunk = data.slice(i, i + size)
      const chunkResults = await processor(chunk)
      results.push(...chunkResults)

      // 检查内存使用
      if (!this.hasEnoughMemory(0)) {
        // 强制垃圾回收（如果可用）
        if ((globalThis as any).gc) {
          (globalThis as any).gc()
        }

        // 等待一段时间让内存释放
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }

    return results
  }

  /**
   * 创建内存友好的Blob转换器
   */
  async streamToBlob(stream: ReadableStream<Uint8Array>, mimeType = 'application/octet-stream'): Promise<Blob> {
    const chunks: Uint8Array[] = []
    const reader = stream.getReader()
    let totalSize = 0

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done)
          break

        chunks.push(value)
        totalSize += value.length

        // 检查内存使用
        if (!this.hasEnoughMemory(totalSize)) {
          console.warn('内存使用过高，建议使用流式处理而非内存缓存')

          // 如果内存不足，尝试释放一些资源
          if (chunks.length > 10) {
            // 合并部分chunks减少内存碎片
            const mergedChunks: Uint8Array[] = []
            for (let i = 0; i < chunks.length; i += 2) {
              if (i + 1 < chunks.length) {
                const merged = new Uint8Array(chunks[i].length + chunks[i + 1].length)
                merged.set(chunks[i])
                merged.set(chunks[i + 1], chunks[i].length)
                mergedChunks.push(merged)
              }
              else {
                mergedChunks.push(chunks[i])
              }
            }
            chunks.length = 0
            chunks.push(...mergedChunks)
          }
        }
      }
    }
    finally {
      reader.releaseLock()
    }

    return new Blob(chunks as BlobPart[], { type: mimeType })
  }

  /**
   * 清理所有活跃流
   */
  cleanup(): void {
    for (const stream of this._activeStreams) {
      try {
        stream.cancel()
      }
      catch (error) {
        console.warn('清理流时出错:', error)
      }
    }
    this._activeStreams.clear()
  }

  /**
   * 获取内存统计信息
   */
  getMemoryStats(): {
    usage: ReturnType<typeof MemoryManager.prototype.getMemoryUsage>
    activeStreams: number
    chunkSize: number
    threshold: number
  } {
    return {
      usage: this.getMemoryUsage(),
      activeStreams: this._activeStreams.size,
      chunkSize: this._chunkSize,
      threshold: this._memoryThreshold,
    }
  }
}
