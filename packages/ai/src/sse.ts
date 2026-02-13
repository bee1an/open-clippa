interface SseParserHandlers {
  onEvent: (data: string) => void
  onDone?: () => void
}

export interface SseParser {
  feed: (chunk: string) => void
  end: () => void
}

function normalizeLineEnd(line: string): string {
  return line.endsWith('\r') ? line.slice(0, -1) : line
}

export function createSseParser(handlers: SseParserHandlers): SseParser {
  let buffer = ''
  let eventDataLines: string[] = []

  const flushEvent = (): void => {
    if (eventDataLines.length === 0)
      return

    const payload = eventDataLines.join('\n')
    eventDataLines = []

    if (payload === '[DONE]') {
      handlers.onDone?.()
      return
    }

    handlers.onEvent(payload)
  }

  const processLine = (rawLine: string): void => {
    const line = normalizeLineEnd(rawLine)
    if (line === '') {
      flushEvent()
      return
    }

    if (line.startsWith(':'))
      return

    if (line.startsWith('data:')) {
      eventDataLines.push(line.slice(5).trimStart())
    }
  }

  return {
    feed(chunk: string): void {
      if (!chunk)
        return

      buffer += chunk
      while (true) {
        const lineBreakIndex = buffer.indexOf('\n')
        if (lineBreakIndex === -1)
          break

        const rawLine = buffer.slice(0, lineBreakIndex)
        buffer = buffer.slice(lineBreakIndex + 1)
        processLine(rawLine)
      }
    },
    end(): void {
      if (buffer.length > 0) {
        processLine(buffer)
        buffer = ''
      }
      flushEvent()
    },
  }
}

export async function parseSseStream(
  stream: ReadableStream<Uint8Array>,
  handlers: SseParserHandlers,
): Promise<void> {
  const parser = createSseParser(handlers)
  const reader = stream.getReader()
  const decoder = new TextDecoder()

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done)
        break

      if (value)
        parser.feed(decoder.decode(value, { stream: true }))
    }

    parser.feed(decoder.decode())
    parser.end()
  }
  finally {
    reader.releaseLock()
  }
}
