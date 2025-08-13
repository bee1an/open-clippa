import { ms2TimeStr } from '@clippa/utils'
import { Container, Graphics, Text } from 'pixi.js'

export const RULER_HEIGHT = 28

export const DOT_RADIUS = 2

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

    this.container = container

    this._drawBg()

    this.buildTime()
  }

  private _drawBg(): void {
    if (this._bg) {
      this._bg.width = this.width
      return
    }

    this._bg = new Graphics()
    this._bg.rect(0, 0, this.width, RULER_HEIGHT)
    this._bg.fill('#ff000022')
    this.container.addChild(this._bg)
  }

  private _drawDot(x: number, color: string = '#505067'): void {
    const graphics = new Graphics()

    graphics.circle(x, RULER_HEIGHT / 2, DOT_RADIUS)
    graphics.fill(color)

    this.container.addChild(graphics)
  }

  private _drawTime(x: number): Text {
    const text = new Text({
      style: {
        fontSize: 12,
        fill: '#9595ac',
      },
      x,
      y: RULER_HEIGHT / 2,
    })

    text.anchor.set(0.5)

    this.container.addChild(text)

    return text
  }

  private _timeTexts: Text[] = []

  private _minTickSpacingPx = 120

  private get _tickGap(): number {
    if (this.duration < 9000) {
      return Math.max(this.width / (Math.floor((this.duration) / 1000)) * this.scale, this._minTickSpacingPx)
    }

    return Math.max(this.width / 9 * this.scale, this._minTickSpacingPx)
  }

  buildTime(): void {
    let i = 0
    let x = 0

    const gap = this._tickGap

    for (; i < (this.width / gap) - 1; i++) {
      x += gap
      const timeText = this._drawTime(x)
      this._drawDot(x)
      this._timeTexts.push(timeText)
    }

    for (let index = 0; index < i; index++) {
      this._timeTexts[index].text = ms2TimeStr(this._timeTexts[index].x / this.width * this.duration)
    }
  }
}
