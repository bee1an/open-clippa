import { EventBus, ms2TimeStr } from '@clippa/utils'
import { Container, Graphics, Text } from 'pixi.js'

export const RULER_HEIGHT = 28

export const DOT_RADIUS = 1.5

export const DOT_NUM = 3

export const TICK_FONT_SIZE = 10

export interface RulerOption {
  width: number
  screenWidth: number
  duration: number
}

export type RulerEvents = {
  seek: [number]
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
  private _bg?: Graphics
  duration: number

  width: number
  screenWidth: number

  constructor(option: RulerOption) {
    super()
    this.duration = option.duration
    this.width = option.width
    this.screenWidth = option.screenWidth

    const container = new Container()
    this.container = container
    container.cursor = 'pointer'
    container.eventMode = 'static'

    this._bindPointerdown()

    this.render()
  }

  /**
   * Updates the width of the ruler and re-renders the component.
   *
   * @param width - The new width to set for the ruler.
   */
  updateWidth(width: number): void {
    this.width = width
    this.queueRender()
  }

  updateScreenWidth(screenWidth: number): void {
    this.screenWidth = screenWidth
    this.queueRender()
  }

  private _requestAnimationFrameId: number | null = null
  queueRender(): void {
    this._requestAnimationFrameId && cancelAnimationFrame(this._requestAnimationFrameId)

    this._requestAnimationFrameId = requestAnimationFrame(() => {
      this.render()
    })
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

    this.container.removeChildren()
    this._drawBg()
    this._drawTick()
  }

  private _drawBg(): void {
    if (this._bg) {
      this._bg.width = this.width
      this.container.addChild(this._bg)
      return
    }

    this._bg = new Graphics()
    this._bg.rect(0, 0, this.width, RULER_HEIGHT)
    this._bg.fill('#52521101')
    this.container.addChild(this._bg)
  }

  private _drawDot(x: number, color: string = '#505067'): void {
    const graphics = new Graphics()

    graphics.circle(x, RULER_HEIGHT / 2, DOT_RADIUS)
    graphics.fill(color)

    this.container.addChild(graphics)
  }

  private _drawTextTime(x: number, content: string): Text {
    const text = new Text({
      style: {
        fontSize: TICK_FONT_SIZE,
        fill: '#9595ac',
      },
      x,
      y: RULER_HEIGHT / 2,
      text: content,
    })

    text.anchor.set(0.5)

    this.container.addChild(text)

    return text
  }

  private _getGap(tick: number): number {
    return (tick / Math.max(this.duration, MINIMUM_DURATION)) * this.width
  }

  private _minTickSpacingPx = 120
  private get _tick(): number {
    const tick = ticks.find((tick) => {
      return this._getGap(tick) >= this._minTickSpacingPx
    }) || ticks[ticks.length - 1]

    return tick
  }

  private _timeTexts: Text[] = []
  private _drawTick(): void {
    this._timeTexts.length = 0
    let x = 0
    const tick = this._tick
    const gap = this._getGap(tick)

    const dotGap = gap / (DOT_NUM + 1)

    const drawDotGroup = (): void => {
      Array.from({ length: DOT_NUM }, (_, index): void => {
        this._drawDot(x + dotGap * (index + 1))
        return void 0
      })
    }

    for (let i = 0; i < Math.max(this.screenWidth, this.width) / gap - 1; i++) {
      drawDotGroup()

      x += gap
      const timeText = this._drawTextTime(x, ms2TimeStr((i + 1) * tick))
      this._timeTexts.push(timeText)
    }

    drawDotGroup()
  }

  private _bindPointerdown(): void {
    this.container.on('pointerdown', (e) => {
      const seekTime = (e.getLocalPosition(this.container).x / this.width) * this.duration
      this.emit('seek', seekTime)
    })
  }
}
