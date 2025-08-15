/**
 * Checks if two arrays intersect
 */
export function isIntersection(arr1: number[], arr2: number[]): boolean {
  const [left1] = arr1
  const right1 = arr1[arr1.length - 1]
  const [left2] = arr2
  const right2 = arr2[arr2.length - 1]

  return left1 < right2 && left2 < right1
}
