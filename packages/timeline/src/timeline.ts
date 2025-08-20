import { Application } from 'pixi.js'
import { Cursor } from './cursor'
import { Rails } from './rails'
import { Ruler } from './ruler'
import { ScrollBox } from './scrollBox'
import { State } from './state'

export interface TimelineOption {
  id: string
  duration: number
}

export class Timeline {
  app?: Application
  ruler?: Ruler
  cursor?: Cursor
  scroller: ScrollBox = new ScrollBox({ viewportWidth: 0, viewportHeight: 0 })
  rails?: Rails

  state: State = State.getInstance()

  duration: number

  scale: number = 0.8

  width: number = 0

  constructor(private _option: TimelineOption) {
    this.duration = _option.duration
  }

  async initial(): Promise<void> {
    const { id } = this._option

    const app = new Application()
    this.app = app

    const wrapper = document.getElementById(id)

    if (!wrapper) {
      throw new Error('wrapper not found')
    }

    await app.init({
      resizeTo: wrapper,
      backgroundColor: '#393941',
      height: 200,
      antialias: true,
    })

    app.stage.addChild(this.scroller.wrapper)

    // https://github.com/pixijs/pixijs/issues/11427
    new ResizeObserver(() => {
      app.resize()

      this._updateChildrenSize()
    }).observe(wrapper)

    wrapper.appendChild(app.canvas)

    this._createRuler()

    this._createRails()

    this._createCursor()

    this._updatePxPerMs((app.screen.width / this.duration) * this.scale)
  }

  private _updatePxPerMs(pxPerMs: number): void {
    if (pxPerMs === this.state.pxPerMs)
      return

    this.state.updatePxPerMs(pxPerMs)
  }

  private _updateChildrenSize(): void {
    if (!this.app)
      return

    const screenWidth = this.app.screen.width
    const screenHeight = this.app.screen.height

    this.ruler?.updateScreenWidth(screenWidth)

    this.cursor?.updateScreenWidth(screenWidth)
    this.cursor?.updateScreenHeight(screenHeight)

    this.rails?.updateScreenWidth(screenWidth)

    requestAnimationFrame(() => {
      // container不会马上更新size
      this.scroller.updateViewportSize(screenWidth, screenHeight)
    })
  }

  private _createRuler(): void {
    this.ruler = new Ruler({
      screenWidth: this.app!.screen.width,
      duration: this.duration,
    })
    this.scroller.container.addChild(this.ruler.container)

    this.ruler.on('seek', (seekTime: number) => {
      this.cursor?.seek(seekTime)
    })

    this.ruler.on('render', () => {
      this.scroller.nextRender(() => this.scroller.update())
    })
  }

  private _createRails(): void {
    this.rails = new Rails({
      screenWidth: this.app!.screen.width,
      duration: this.duration,
      maxZIndex: 2,
    })

    this.scroller.container.addChild(this.rails.container)
  }

  private _createCursor(): void {
    this.cursor = new Cursor({
      screenWidth: this.app!.screen.width,
      height: this.app!.screen.height,
      duration: this.duration,
    })
    this.scroller.container.addChild(this.cursor.container)
  }
}
