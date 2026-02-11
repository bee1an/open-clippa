import type { ExtendTrainEvents, ExtendTrainOption } from './types'
import {
  TIMELINE_FILTER_TRAIN_ACCENT_FILL,
  TIMELINE_FILTER_TRAIN_FILL,
  TIMELINE_FILTER_TRAIN_HEIGHT,
  TIMELINE_FILTER_TRAIN_TEXT_FILL,
  TIMELINE_TEXT_TRAIN_ACCENT_FILL,
  TIMELINE_TEXT_TRAIN_FILL,
  TIMELINE_TEXT_TRAIN_HEIGHT,
  TIMELINE_TEXT_TRAIN_TEXT_FILL,
} from '@clippc/constants'
import { Graphics, Text } from 'pixi.js'
import { Train } from './train'

// eslint-disable-next-line ts/no-empty-object-type
type TextTrainEvents = ExtendTrainEvents<{}>

export type TextTrainVariant = 'text' | 'filter'

type TextTrainOption = ExtendTrainOption<{
  label: string
  fill?: string | number
  textColor?: string | number
  accentFill?: string | number
  variant?: TextTrainVariant
}>

const LABEL_PADDING_X = 12
const DEFAULT_VARIANT: TextTrainVariant = 'text'
const VARIANT_HEIGHT_MAP: Record<TextTrainVariant, number> = {
  text: TIMELINE_TEXT_TRAIN_HEIGHT,
  filter: TIMELINE_FILTER_TRAIN_HEIGHT,
}
const VARIANT_FILL_MAP: Record<TextTrainVariant, string | number> = {
  text: TIMELINE_TEXT_TRAIN_FILL,
  filter: TIMELINE_FILTER_TRAIN_FILL,
}
const VARIANT_TEXT_COLOR_MAP: Record<TextTrainVariant, string | number> = {
  text: TIMELINE_TEXT_TRAIN_TEXT_FILL,
  filter: TIMELINE_FILTER_TRAIN_TEXT_FILL,
}
const VARIANT_ACCENT_COLOR_MAP: Record<TextTrainVariant, string | number> = {
  text: TIMELINE_TEXT_TRAIN_ACCENT_FILL,
  filter: TIMELINE_FILTER_TRAIN_ACCENT_FILL,
}
const VARIANT_FONT_SIZE_MAP: Record<TextTrainVariant, number> = {
  text: 11,
  filter: 10,
}
const VARIANT_FONT_WEIGHT_MAP: Record<TextTrainVariant, '500' | '600'> = {
  text: '600',
  filter: '500',
}

export class TextTrain extends Train<TextTrainEvents> {
  variant: TextTrainVariant
  label: string
  fill: string | number
  textColor: string | number
  accentFill: string | number

  private _bg?: Graphics
  private _accent?: Graphics
  private _label?: Text

  constructor(option: TextTrainOption) {
    const variant = option.variant ?? DEFAULT_VARIANT
    const height = option.height ?? VARIANT_HEIGHT_MAP[variant]
    super(Object.assign(option, { height, railStyle: variant }))

    this.variant = variant
    this.label = normalizeLabel(option.label)
    this.fill = option.fill ?? VARIANT_FILL_MAP[variant]
    this.textColor = option.textColor ?? VARIANT_TEXT_COLOR_MAP[variant]
    this.accentFill = option.accentFill ?? VARIANT_ACCENT_COLOR_MAP[variant]

    this._draw()
  }

  updateWidth(width: number): void {
    super.updateWidth(width)
    this._drawBg()
    this._drawAccent()
    this._layoutLabel()
  }

  protected _onJoinStateUpdated(): void {
    this._drawBg()
    this._drawAccent()
  }

  private _draw(): void {
    this._drawBg()
    this._drawAccent()
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
    this._drawRoundedRectByCorner(
      this._bg,
      0,
      0,
      this.width,
      this.height,
      this._getTrainCornerRadius(),
    )
    this._bg.fill(this.fill)
  }

  private _drawAccent(): void {
    if (!this._accent) {
      this._accent = new Graphics({ label: 'text-train-accent' })
      this._accent.eventMode = 'none'
      this._slot.addChild(this._accent)
    }

    const accentWidth = 3
    const accentInsetY = Math.max(4, Math.floor(this.height * 0.18))
    const accentHeight = Math.max(8, this.height - accentInsetY * 2)
    const accentRadius = accentWidth / 2
    const accentX = 7

    this._accent.clear()
    this._accent.roundRect(accentX, accentInsetY, accentWidth, accentHeight, accentRadius)
    this._accent.fill(this.accentFill)
  }

  private _drawLabel(): void {
    if (this._label) {
      this._label.text = this.label
      return
    }

    this._label = new Text({
      text: this.label,
      style: {
        fontSize: VARIANT_FONT_SIZE_MAP[this.variant],
        fontWeight: VARIANT_FONT_WEIGHT_MAP[this.variant],
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
