import type { FederatedPointerEvent } from 'pixi.js'
import type { Performer, PerformerOption } from '../performer'
import { EventBus } from '@clippa/utils'
import { Text as PixiText, TextStyle } from 'pixi.js'
import { PlayState, ShowState } from '../performer'

export interface TextStyleOption {
  fontFamily?: string | string[]
  fontSize?: number
  fontWeight?: 'normal' | 'bold' | 'bolder' | 'lighter' | number
  fontStyle?: 'normal' | 'italic' | 'oblique'
  fill?: string | number
  stroke?: { color?: string | number, width?: number }
  align?: 'left' | 'center' | 'right'
  wordWrap?: boolean
  wordWrapWidth?: number
  lineHeight?: number
  letterSpacing?: number
  dropShadow?: {
    alpha?: number
    angle?: number
    blur?: number
    color?: string | number
    distance?: number
  }
}

export interface TextOption extends PerformerOption {
  id: string
  content: string
  zIndex: number
  x?: number
  y?: number
  width?: number
  height?: number
  style?: TextStyleOption
}

export interface TextClickEvent {
  performer: Text
  canvasX: number
  canvasY: number
  timestamp: number
}

export interface TextBounds {
  x: number
  y: number
  width: number
  height: number
  rotation?: number
}

export type TextEvents = {
  pointerdown: [TextClickEvent]
  positionUpdate: [TextBounds]
}

export class Text extends EventBus<TextEvents> implements Performer {
  id: string
  start: number
  duration: number
  zIndex: number

  protected _sprite?: PixiText
  get sprite(): PixiText | undefined {
    return this._sprite
  }

  valid: boolean = false
  error: boolean = false

  currentTime: number = 0
  showState: ShowState = ShowState.UNPLAYED
  playState: PlayState = PlayState.PAUSED

  private _content: string
  private _styleOption: TextStyleOption

  constructor(option: TextOption) {
    super()
    const { id, start, duration, zIndex, content, style } = option

    this.id = id
    this.start = start
    this.duration = duration
    this.zIndex = zIndex
    this._content = content
    this._styleOption = style || {}

    this.load(option)
  }

  load(option?: TextOption): Promise<void> {
    const { height, width, x, y, content, style } = option || {}

    // Text is synchronous, no async loading needed
    if (!this._sprite) {
      const textStyle = this._createTextStyle(style || this._styleOption)
      this._sprite = new PixiText({
        text: content || this._content,
        style: textStyle,
      })
      this.setupSpriteEvents()
    }

    // Set dimensions and position
    if (width !== undefined)
      this._sprite.width = width
    if (height !== undefined)
      this._sprite.height = height
    if (x !== undefined)
      this._sprite.x = x
    if (y !== undefined)
      this._sprite.y = y

    this.valid = true

    return Promise.resolve()
  }

  private _createTextStyle(option: TextStyleOption): TextStyle {
    return new TextStyle({
      fontFamily: option.fontFamily || 'Arial',
      fontSize: option.fontSize || 26,
      fontWeight: option.fontWeight as any,
      fontStyle: option.fontStyle,
      fill: option.fill,
      stroke: option.stroke,
      align: option.align,
      wordWrap: option.wordWrap,
      wordWrapWidth: option.wordWrapWidth,
      lineHeight: option.lineHeight,
      letterSpacing: option.letterSpacing,
      dropShadow: option.dropShadow,
    })
  }

  play(time: number): void {
    this.update(time)

    if (this.playState === PlayState.PLAYING)
      return

    this.playState = PlayState.PLAYING
  }

  update(time: number): void {
    this.currentTime = time

    if (this.currentTime < 0) {
      this.showState = ShowState.UNPLAYED
      return
    }

    if (this.currentTime > this.duration) {
      this.showState = ShowState.PLAYED
      this.playState = PlayState.PAUSED
      return
    }

    this.showState = ShowState.PLAYING
  }

  pause(time: number): void {
    this.update(time)

    if (this.playState === PlayState.PAUSED)
      return

    this.playState = PlayState.PAUSED
  }

  async seek(time: number): Promise<void> {
    if (time < 0 || time > this.duration)
      return

    this.currentTime = time
    this.update(time)
  }

  // Text-specific methods

  setText(content: string): void {
    this._content = content
    if (this._sprite) {
      this._sprite.text = content
      this.notifyPositionUpdate()
    }
  }

  getText(): string {
    return this._content
  }

  setStyle(style: TextStyleOption): void {
    this._styleOption = { ...this._styleOption, ...style }
    if (this._sprite) {
      this._sprite.style = this._createTextStyle(this._styleOption)
      this.notifyPositionUpdate()
    }
  }

  getStyle(): TextStyleOption {
    return { ...this._styleOption }
  }

  // Event handling (same as Video)

  protected setupSpriteEvents(): void {
    if (!this._sprite)
      return

    this._sprite.eventMode = 'static'
    this._sprite.cursor = 'pointer'

    this._sprite.on('pointerdown', this.handleSpriteClick.bind(this))
  }

  protected handleSpriteClick(event: FederatedPointerEvent): void {
    if (!this._sprite)
      return

    const globalPosition = event.global
    const clickEvent: TextClickEvent = {
      performer: this,
      canvasX: globalPosition.x,
      canvasY: globalPosition.y,
      timestamp: Date.now(),
    }

    this.emit('pointerdown', clickEvent)
  }

  protected notifyPositionUpdate(): void {
    if (!this._sprite)
      return

    const bounds = this.getBounds()
    this.emit('positionUpdate', bounds)
  }

  // Transform methods (same as Video)

  containsPoint(canvasX: number, canvasY: number): boolean {
    const bounds = this.getBounds()
    if (bounds.rotation === 0) {
      return canvasX >= bounds.x && canvasX <= bounds.x + bounds.width
        && canvasY >= bounds.y && canvasY <= bounds.y + bounds.height
    }

    const centerX = bounds.x + bounds.width / 2
    const centerY = bounds.y + bounds.height / 2
    const angle = -bounds.rotation * Math.PI / 180

    const cos = Math.cos(angle)
    const sin = Math.sin(angle)

    const dx = canvasX - centerX
    const dy = canvasY - centerY

    const rotatedX = dx * cos - dy * sin
    const rotatedY = dx * sin + dy * cos

    const halfWidth = bounds.width / 2
    const halfHeight = bounds.height / 2

    return Math.abs(rotatedX) <= halfWidth && Math.abs(rotatedY) <= halfHeight
  }

  getBounds(): Required<TextBounds> {
    if (!this._sprite) {
      return {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        rotation: 0,
      }
    }

    return {
      x: this._sprite.x,
      y: this._sprite.y,
      width: this._sprite.width,
      height: this._sprite.height,
      rotation: this._sprite.angle || 0,
    }
  }

  setPosition(x: number, y: number): void {
    if (this._sprite) {
      this._sprite.x = x
      this._sprite.y = y
      this.notifyPositionUpdate()
    }
  }

  setRotation(angle: number): void {
    if (this._sprite) {
      this._sprite.angle = angle
      this.notifyPositionUpdate()
    }
  }

  setScale(scaleX: number, scaleY: number): void {
    if (this._sprite) {
      this._sprite.scale.x = scaleX
      this._sprite.scale.y = scaleY
      this.notifyPositionUpdate()
    }
  }

  destroy(): void {
    // Clean up Sprite
    if (this._sprite) {
      this._sprite.removeAllListeners()
      this._sprite.destroy()
      this._sprite = undefined
    }

    // Reset state
    this.valid = false
    this.error = false
    this.showState = ShowState.UNPLAYED
    this.playState = PlayState.PAUSED
  }
}
