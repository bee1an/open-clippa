import { describe, expect, it, vi } from 'vitest'
import { transformSrc } from '../src/transform'

describe('transformSrc', () => {
  it('returns string source as-is', () => {
    expect(transformSrc('https://example.com/video.mp4')).toBe('https://example.com/video.mp4')
  })

  it('converts Blob/File source to object URL', () => {
    const createObjectURLSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:converted')
    const blob = new Blob(['binary'], { type: 'video/mp4' })

    expect(transformSrc(blob)).toBe('blob:converted')
    expect(createObjectURLSpy).toHaveBeenCalledWith(blob)

    createObjectURLSpy.mockRestore()
  })
})
