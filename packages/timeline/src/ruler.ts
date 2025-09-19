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
    const bg = new Graphics({ label: 'bg' })
    bg.rect(0, 0, Math.max(this.width, this.screenWidth - this.offsetX), TIMELINE_RULER_HEIGHT)
    bg.fill(TIMELINE_RULER_FILL)

    if (this._bg) {
      this.container.replaceChild(this._bg, bg)
    }
    else {
      this.container.addChild(bg)
    }

    this._bg = bg
  }

  private _bgByDuration?: Graphics
  // TODO
  /**
   * @deprecated
   *
   * 后面可以重构为对应选中的train
   */
  private _drawBgByDuration(): void {
    const bg = new Graphics()
    bg.roundRect(0, 0, this.width, TIMELINE_RULER_HEIGHT, 8)
    bg.fill(TIMELINE_RULER_FILL)

    if (this._bgByDuration) {
      this.container.replaceChild(this._bgByDuration, bg)
    }
    else {
      this.container.addChild(bg)
    }

    this._bgByDuration = bg
  }

  private _drawDot(x: number): Graphics {
    const graphics = new Graphics()

    graphics.circle(0, 0, TIMELINE_DOT_RADIUS)
    graphics.position.set(x, TIMELINE_RULER_HEIGHT / 2)
    graphics.fill(TIMELINE_DOT_FILL)

    return graphics
  }

  private _drawTextTime(x: number, content: string): Text {
    const text = new Text({
      style: {
        fontSize: TIMELINE_TICK_FONT_SIZE,
        fill: TIMELINE_TICK_COLOR,
      },
      x,
      y: TIMELINE_RULER_HEIGHT / 2,
      text: content,
    })

    text.anchor.set(0.5)

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

    let x = 0
    const tick = this._tick
    const gap = getPxByMs(tick, this.state.pxPerMs)

    const dotGap = gap / (TIMELINE_DOT_NUM + 1)

    const rightLimitX = Math.max(this.screenWidth - this.offsetX, this.width)

    const drawDotGroup = (): void => {
      for (let index = 0; index < TIMELINE_DOT_NUM; index++) {
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
