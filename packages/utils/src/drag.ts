export function drag(target: {
  on: (event: 'pointerdown', callback: (e: PointerEvent) => void) => void
}, hooks: {
  down?: (e: PointerEvent) => void
  move?: (e: PointerEvent, option: { dx: number, dy: number }) => void
  up?: (e: PointerEvent) => void
}): void {
  let x: number, y: number

  const move = (e: PointerEvent): void => {
    const dx = e.x - x
    const dy = e.y - y

    x = e.x
    y = e.y

    hooks.move?.(e, { dx, dy })
  }
  const up = (e: PointerEvent): void => {
    document.removeEventListener('pointermove', move)
    document.removeEventListener('pointerup', up)
    hooks.up?.(e)
  }

  target.on('pointerdown', (e) => {
    x = e.x
    y = e.y
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerup', up)
    hooks.down?.(e)
  })
}
