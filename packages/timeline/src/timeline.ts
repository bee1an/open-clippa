import { Application } from 'pixi.js'
import { Cursor } from './cursor'
import { Rails } from './rails'
import { Ruler } from './ruler'
import { ScrollBox } from './scrollBox'
import { State } from './state'

export interface TimelineOption {
  id: string
}

export class Timeline {
  app?: Application
  ruler?: Ruler
  cursor?: Cursor
  scroller: ScrollBox = new ScrollBox({ viewportWidth: 0, viewportHeight: 0 })
  rails?: Rails
  state: State = State.getInstance()

  constructor(private _option: TimelineOption) {}

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
    })

    app.stage.addChild(this.scroller.wrapper)

    // https://github.com/pixijs/pixijs/issues/11427
    new ResizeObserver(() => {
      app.resize()

      this.ruler?.updateWidth(app.stage.width)
      this.ruler?.updateScreenWidth(app.screen.width)

      this.cursor?.updateWidth(app.stage.width)
      this.cursor?.updateScreenWidth(app.screen.width)
      this.cursor?.updateHeight(app.screen.height)

      this.scroller.updateViewportSize(app.screen.width, app.screen.height)
    }).observe(wrapper)

    wrapper.appendChild(app.canvas)

    this._createRuler()

    this._crateRails()

    this._createCursor()
  }

  private _createRuler(): void {
    this.ruler = new Ruler({
      width: this.app!.stage.width,
      screenWidth: this.app!.screen.width,
      duration: 1000 * 60,
    })
    this.scroller.container.addChild(this.ruler.container)

    this.ruler.on('seek', (seekTime: number) => {
      this.cursor?.seek(seekTime)
    })
  }

  private _createCursor(): void {
    this.cursor = new Cursor({
      width: this.app!.stage.width,
      screenWidth: this.app!.screen.width,
      height: this.app!.screen.height,
      duration: 1000 * 60,
    })
    this.scroller.container.addChild(this.cursor.container)
  }

  private _crateRails(): void {
    this.rails = new Rails({ width: Math.max(this.app!.stage.width, this.app!.screen.width) })

    this.scroller.container.addChild(this.rails.container)
  }
}
