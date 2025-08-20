import { EventBus, getPxByMs, ms2TimeStr } from '@clippa/utils'
import { Container, Graphics, Text } from 'pixi.js'
import { State } from './state'

export const RULER_HEIGHT = 28

export const DOT_RADIUS = 1.5

export const DOT_NUM = 3

export const TICK_FONT_SIZE = 10

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

  constructor(option: RulerOption) {
    super()

    const processWidth = (): void => {
      this.width = getPxByMs(this.duration, this.state.pxPerMs)
    }

    this.state = State.getInstance()
    this.state.on('updatedPxPerMs', () => {
      processWidth()

      this.queueRender()
    })

    this.duration = option.duration
    processWidth()
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
   */
  // updateWidth(width: number): void {
  //   this.width = width
  //   this.queueRender()
  // }

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

    this._drawBg()
    this._drawBgByDuration()
    this._drawTick()

    this.emit('render')
  }

  private _bg?: Graphics
  private _drawBg(): void {
    const bg = new Graphics()
    bg.rect(0, 0, this.width, RULER_HEIGHT)
    bg.fill('#52521101')

    if (this._bg) {
      this.container.replaceChild(this._bg, bg)
    }
    else {
      this.container.addChild(bg)
    }

    this._bg = bg
  }

  private _bgByDuration?: Graphics
  private _drawBgByDuration(): void {
    const bg = new Graphics()
    bg.rect(0, 0, getPxByMs(this.duration, this.state.pxPerMs), RULER_HEIGHT)
    bg.fill('#2c1d47')

    if (this._bgByDuration) {
      this.container.replaceChild(this._bgByDuration, bg)
    }
    else {
      this.container.addChild(bg)
    }

    this._bgByDuration = bg
  }

  private _drawDot(x: number, color: string = '#505067'): Graphics {
    const graphics = new Graphics()

    graphics.circle(0, 0, DOT_RADIUS)
    graphics.position.set(x, RULER_HEIGHT / 2)
    graphics.fill(color)

    return graphics
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

  private _ticksWrapper?: Container
  private _drawTick(): void {
    const ticksWrapper = new Container()

    let x = 0
    const tick = this._tick
    const gap = this._getGap(tick)

    const dotGap = gap / (DOT_NUM + 1)

    const rightLimitX = Math.max(this.screenWidth, this.width)

    const drawDotGroup = (): void => {
      for (let index = 0; index < DOT_NUM; index++) {
        const dot = this._drawDot(x + dotGap * (index + 1))

        const dotRightX = dot.x + dot.width

        if (dotRightX < rightLimitX) {
          ticksWrapper!.addChild(this._drawDot(x + dotGap * (index + 1)))
        }
        else {
          break
        }
      }
    }

    // 如果width < screenWidth, 会补足screenWidth, 防止出现空隙
    for (let i = 0; i < rightLimitX / gap - 1; i++) {
      drawDotGroup()

      x += gap

      const text = this._drawTextTime(x, ms2TimeStr((i + 1) * tick))

      const textRightX = text.x + text.width

      if (textRightX < rightLimitX) {
        ticksWrapper.addChild(text)
      }
      else {
        break
      }
    }

    drawDotGroup()

    if (this._ticksWrapper) {
      this.container.replaceChild(this._ticksWrapper, ticksWrapper)
    }
    else {
      this.container.addChild(ticksWrapper)
    }

    this._ticksWrapper = ticksWrapper
  }

  private _bindPointerdown(): void {
    this.container.on('pointerdown', (e) => {
      const seekTime = (e.getLocalPosition(this.container).x / this.width) * this.duration
      this.emit('seek', seekTime)
    })
  }
}
