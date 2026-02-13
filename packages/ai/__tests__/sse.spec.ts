import { describe, expect, it, vi } from 'vitest'
import { createSseParser, parseSseStream } from '../src/sse'

function createTextStream(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      chunks.forEach(chunk => controller.enqueue(encoder.encode(chunk)))
      controller.close()
    },
  })
}

describe('createSseParser', () => {
  it('parses a standard SSE event', () => {
    const onEvent = vi.fn()
    const onDone = vi.fn()
    const parser = createSseParser({ onEvent, onDone })

    parser.feed('data: {"a":1}\n\n')
    parser.end()

    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith('{"a":1}')
    expect(onDone).not.toHaveBeenCalled()
  })

  it('handles payload split across chunks', () => {
    const onEvent = vi.fn()
    const parser = createSseParser({ onEvent })

    parser.feed('data: {"choices":[{"delta":{"cont')
    parser.feed('ent":"hel"}}]}\n')
    parser.feed('\n')
    parser.end()

    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent).toHaveBeenCalledWith('{"choices":[{"delta":{"content":"hel"}}]}')
  })

  it('supports multi-line data payloads', () => {
    const onEvent = vi.fn()
    const parser = createSseParser({ onEvent })

    parser.feed('data: line1\n')
    parser.feed('data: line2\n\n')
    parser.end()

    expect(onEvent).toHaveBeenCalledWith('line1\nline2')
  })

  it('triggers done when [DONE] event appears', () => {
    const onEvent = vi.fn()
    const onDone = vi.fn()
    const parser = createSseParser({ onEvent, onDone })

    parser.feed('data: [DONE]\n\n')
    parser.end()

    expect(onDone).toHaveBeenCalledTimes(1)
    expect(onEvent).not.toHaveBeenCalled()
  })
})

describe('parseSseStream', () => {
  it('reads events from a ReadableStream', async () => {
    const onEvent = vi.fn()
    const onDone = vi.fn()
    const stream = createTextStream([
      'data: {"choices":[{"delta":{"content":"A"}}]}\n\n',
      'data: [DONE]\n\n',
    ])

    await parseSseStream(stream, { onEvent, onDone })

    expect(onEvent).toHaveBeenCalledWith('{"choices":[{"delta":{"content":"A"}}]}')
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
