import {
  TIMELINE_DOT_FILL,
  TIMELINE_DOT_NUM,
  TIMELINE_DOT_RADIUS,
  TIMELINE_RULER_FILL,
  TIMELINE_RULER_HEIGHT,
  TIMELINE_TICK_COLOR,
  TIMELINE_TICK_FONT_SIZE,
} from '@clippa/constants'
import { drag, EventBus, getMsByPx, getPxByMs, ms2TimeStr } from '@clippa/utils'
import { Container, Graphics, Text } from 'pixi.js'
import { State } from './state'

export interface RulerOption {
  screenWidth: number
  duration: number
}

export type RulerEvents = {
  seek: [number]

  render: []
}

/**
 * 基准刻度
 */
const basicTicks = [1000, 2000, 5000]

const ticks: number [] = []

for (let index = 0; index < 3; index++) {
  basicTicks.forEach((tick) => {
    ticks.push(tick * 10 ** index)
  })
}

export const MINIMUM_DURATION = 0 // TODO

export class Ruler extends EventBus<RulerEvents> {
  container: Container
  duration: number

  width!: number
  screenWidth: number

  state: State

  offsetX: number = 0

  constructor(option: RulerOption) {
    super()

    this.state = State.getInstance()
    this.state.on('updatedPxPerMs', () => {
      this._processWidth()

      this.render()
    })

    this.duration = option.duration
    this._processWidth()
    this.screenWidth = option.screenWidth

    const container = new Container({ label: 'ruler' })
    this.container = container
    container.cursor = 'pointer'
    container.eventMode = 'static'

    this.render()

    this._bindEvents()
  }

  private _processWidth(): void {
    this.width = getPxByMs(this.duration, this.state.pxPerMs)
  }

  private _bg?: Graphics
  private _drawBg(): void {
    if (this._bg) {
      this._bg.clear()
    }
    else {
      this._bg = new Graphics({ label: 'bg' })
      this.container.addChild(this._bg)
    }

    this._bg.rect(0, 0, Math.max(this.width, this.screenWidth - this.offsetX), TIMELINE_RULER_HEIGHT)
    this._bg.fill(TIMELINE_RULER_FILL)
  }

  private _textPool: Text[] = []

  private _drawTextTime(x: number, content: string): Text {
    let text: Text
    if (this._textPool.length > 0) {
      text = this._textPool.pop()!
      text.text = content
      text.x = x
      text.y = TIMELINE_RULER_HEIGHT / 2
      text.visible = true
    }
    else {
      text = new Text({
        style: {
          fontSize: TIMELINE_TICK_FONT_SIZE,
          fill: TIMELINE_TICK_COLOR,
        },
        x,
        y: TIMELINE_RULER_HEIGHT / 2,
        text: content,
      })
      text.anchor.set(0.5)
    }

    return text
  }

  private _minTickSpacingPx = 120
  private get _tick(): number {
    const tick = ticks.find((tick) => {
      return getPxByMs(tick, this.state.pxPerMs) >= this._minTickSpacingPx
    }) || ticks[ticks.length - 1]

    return tick
  }

  private _ticksWrapper?: Container
  private _drawTick(): void {
    const ticksWrapper = new Container()

    // Batching: One Graphics for all dots
    const dotsGraphics = new Graphics()
    ticksWrapper.addChild(dotsGraphics)

    const tick = this._tick
    const gap = getPxByMs(tick, this.state.pxPerMs)
    const dotGap = gap / (TIMELINE_DOT_NUM + 1)

    // Calculate visible range with buffer
    const buffer = 200 // 200px buffer to prevent pop-in
    const startX = -this.offsetX - buffer
    const endX = -this.offsetX + this.screenWidth + buffer

    // Calculate start index to skip invisible ticks
    const startIndex = Math.max(0, Math.floor(startX / gap))

    const rightLimitX = Math.max(this.screenWidth - this.offsetX, this.width)
    const effectiveEndX = Math.min(endX, rightLimitX)

    const drawDotGroup = (baseX: number): void => {
      for (let index = 0; index < TIMELINE_DOT_NUM; index++) {
        const dotX = baseX + dotGap * (index + 1)
        if (dotX >= startX && dotX <= effectiveEndX) {
          // Batching: Draw directly to shared graphics
          dotsGraphics.circle(dotX, TIMELINE_RULER_HEIGHT / 2, TIMELINE_DOT_RADIUS)
        }
      }
    }

    // Draw 0 tick if visible
    if (startX <= 0 && effectiveEndX >= 0) {
      const zeroText = this._drawTextTime(0, '0')
      ticksWrapper.addChild(zeroText)
    }

    // Loop through ticks, starting from visible range
    for (let i = startIndex; ; i++) {
      const currentTickX = i * gap
      if (currentTickX > effectiveEndX)
        break

      // Draw dots after this tick
      drawDotGroup(currentTickX)

      // Draw next tick text
      const nextTickX = (i + 1) * gap

      // Stop if we go beyond visible range or physical limit
      if (nextTickX > effectiveEndX) {
        break
      }

      const text = this._drawTextTime(nextTickX, ms2TimeStr((i + 1) * tick))
      ticksWrapper.addChild(text)
    }

    // Batching: Fill all dots at once
    dotsGraphics.fill(TIMELINE_DOT_FILL)

    if (this._ticksWrapper) {
      // Recycle Text objects and destroy others
      const children = this._ticksWrapper.removeChildren()
      for (const child of children) {
        if (child instanceof Text) {
          child.visible = false
          this._textPool.push(child)
        }
        else {
          child.destroy()
        }
      }

      if (!this._ticksWrapper.destroyed) {
        this._ticksWrapper.destroy()
      }
      this.container.removeChild(this._ticksWrapper)
    }

    this.container.addChild(ticksWrapper)
    this._ticksWrapper = ticksWrapper
  }

  private _bindEvents(): void {
    let x: number
    const seek = (): void => {
      let seekTime = getMsByPx(x, this.state.pxPerMs)
      if (seekTime > this.duration) {
        seekTime = this.duration
      }
      this.emit('seek', seekTime)
    }
    drag(this.container, {
      down: (e) => {
        x = e.getLocalPosition(this.container).x
        seek()
      },
      move: (_, { dx }) => {
        x += dx
        seek()
      },
    })
  }

  updateScreenWidth(screenWidth: number): void {
    this.screenWidth = screenWidth
    this.render()
  }

  updateOffsetX(offsetX: number): void {
    this.offsetX = offsetX
    this.render()
  }

  updateDuration(duration: number): void {
    this.duration = duration
    this._processWidth()

    this.render()
  }

  /**
   * Renders the ruler component.
   *
   * This method removes all the children of the container and then re-renders the
   * background and tick elements.
   */
  render(): void {
    if (this.width === 0)
      return

    this._drawBg()
    this._drawTick()

    this.emit('render')
  }
}
