export function transformSrc(src: string | File | Blob): string {
  if (typeof src === 'string')
    return src

  return URL.createObjectURL(src)
}
