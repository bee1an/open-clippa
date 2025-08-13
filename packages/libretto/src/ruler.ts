import { ms2TimeStr } from '@clippa/utils'
import { Container, Graphics, Text } from 'pixi.js'

export const RULER_HEIGHT = 28

export const DOT_RADIUS = 1.5

export const DOT_NUM = 3

export const TICK_FONT_SIZE = 10

export interface RulerOption {
  width: number

  duration: number
}

export class Ruler {
  container: Container
  private _bg?: Graphics
  duration: number

  scale: number = 1

  width: number

  constructor(option: RulerOption) {
    this.duration = Math.max(option.duration, 2500)
    this.width = option.width
    const container = new Container()
    container.cursor = 'pointer'
    container.eventMode = 'static'

    this.container = container

    this.render()
  }

  /**
   * Updates the width of the ruler and re-renders the component.
   *
   * @param width - The new width to set for the ruler.
   */
  updateWidth(width: number): void {
    this.width = width
    this.render()
  }

  /**
   * Renders the ruler component.
   *
   * This method removes all the children of the container and then re-renders the
   * background and tick elements.
   */
  render(): void {
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
    this._bg.fill('transparent')
    this.container.addChild(this._bg)
  }

  private _drawDot(x: number, color: string = '#505067'): void {
    const graphics = new Graphics()

    graphics.circle(x, RULER_HEIGHT / 2, DOT_RADIUS)
    graphics.fill(color)

    this.container.addChild(graphics)
  }

  private _drawTextTime(x: number): Text {
    const text = new Text({
      style: {
        fontSize: TICK_FONT_SIZE,
        fill: '#9595ac',
      },
      x,
      y: RULER_HEIGHT / 2,
    })

    text.anchor.set(0.5)

    this.container.addChild(text)

    return text
  }

  private _minTickSpacingPx = 120
  private get _tickGap(): number {
    if (this.duration < 9000) {
      return Math.max(this.width / (Math.floor((this.duration) / 1000)) * this.scale, this._minTickSpacingPx)
    }

    return Math.max(this.width / 9 * this.scale, this._minTickSpacingPx)
  }

  private _timeTexts: Text[] = []
  private _drawTick(): void {
    this._timeTexts.length = 0

    const gap = this._tickGap
    let x = 0
    let i = 0

    const dotGap = gap / (DOT_NUM + 1)
    for (; i < (this.width / gap) - 1; i++) {
      Array.from({ length: DOT_NUM }, (_, index): void => {
        this._drawDot(x + dotGap * (index + 1))
        return void 0
      })

      x += gap
      const timeText = this._drawTextTime(x)
      this._timeTexts.push(timeText)
    }

    Array.from({ length: DOT_NUM }, (_, index): void => {
      this._drawDot(x + dotGap * (index + 1))
      return void 0
    })

    this._timeTexts.forEach((text) => {
      text.text = ms2TimeStr(text.x / this.width * this.duration)
    })
  }
}
