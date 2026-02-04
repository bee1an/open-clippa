import type { ExtendTrainEvents, ExtendTrainOption } from '.'
import { TIMELINE_TRAIN_RADIUS } from '@clippa/constants'
import { Graphics, Text } from 'pixi.js'
import { Train } from '.'

// eslint-disable-next-line ts/no-empty-object-type
type TextTrainEvents = ExtendTrainEvents<{}>

type TextTrainOption = ExtendTrainOption<{
  label: string
  fill?: string | number
  textColor?: string | number
}>

export const TEXT_TRAIN_HEIGHT = 45

const DEFAULT_TEXT_TRAIN_FILL = '#2b3747'
const DEFAULT_TEXT_COLOR = '#f8fafc'
const LABEL_PADDING_X = 8

export class TextTrain extends Train<TextTrainEvents> {
  label: string
  fill: string | number
  textColor: string | number

  private _bg?: Graphics
  private _label?: Text

  constructor(option: TextTrainOption) {
    super(Object.assign(option, { height: TEXT_TRAIN_HEIGHT }))

    this.label = normalizeLabel(option.label)
    this.fill = option.fill ?? DEFAULT_TEXT_TRAIN_FILL
    this.textColor = option.textColor ?? DEFAULT_TEXT_COLOR

    this._draw()
  }

  updateWidth(width: number): void {
    super.updateWidth(width)
    this._drawBg()
    this._layoutLabel()
  }

  private _draw(): void {
    this._drawBg()
    this._drawLabel()
    this._layoutLabel()
  }

  private _drawBg(): void {
    if (!this._bg) {
      this._bg = new Graphics({ label: 'text-train-bg' })
      this._bg.eventMode = 'none'
      this._slot.addChild(this._bg)
    }

    this._bg.clear()
      .roundRect(0, 0, this.width, this.height, TIMELINE_TRAIN_RADIUS)
      .fill(this.fill)
  }

  private _drawLabel(): void {
    if (this._label) {
      this._label.text = this.label
      return
    }

    this._label = new Text({
      text: this.label,
      style: {
        fontSize: 12,
        fill: this.textColor,
      },
      label: 'text-train-label',
    })
    this._label.anchor.set(0, 0.5)
    this._label.eventMode = 'none'

    this._slot.addChild(this._label)
  }

  private _layoutLabel(): void {
    if (!this._label)
      return

    this._label.x = LABEL_PADDING_X
    this._label.y = this.height / 2
  }
}

function normalizeLabel(label: string): string {
  const normalized = label.replace(/\s+/g, ' ').trim()
  return normalized.length > 0 ? normalized : 'Text'
}
