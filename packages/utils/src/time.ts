/**
 * 将毫秒数转换为 `h:m:s` 格式的字符串
 *
 * @example
 * ms2TimeStr(1000) // "00:00:01"
 * ms2TimeStr(60000) // "00:01:00"
 * ms2TimeStr(3600000) // "01:00:00"
 *
 * @param ms 毫秒数
 * @returns `h:m:s` 格式的字符串
 */
export function ms2TimeStr(ms: number): `${string}:${string}:${string}` | `${string}:${string}` {
  // const restMs = ms % 1000
  const s = Math.floor(ms / 1000)
  const sPlace = s % 60
  const m = Math.floor(s / 60)
  const mPlace = m % 60
  const h = Math.floor(m / 60)
  const pad = (num: number): string => num.toString().padStart(2, '0')
  return h ? `${pad(h)}:${pad(mPlace)}:${pad(sPlace)}` : `${pad(m)}:${pad(sPlace)}`
}

/**
 * 将毫秒数转换为对应的像素数
 *
 * @param ms 毫秒数
 * @param pxPerMs 1毫秒对应的像素数
 */
export function getPxByMs(
  ms: number,
  pxPerMs: number,
): number {
  return ms * pxPerMs
}

/**
 * 将像素数转换为对应的毫秒数
 *
 * @param px 像素数
 * @param pxPerMs 1毫秒对应的像素数
 */
export function getMsByPx(
  px: number,
  pxPerMs: number,
): number {
  return px / pxPerMs
}
