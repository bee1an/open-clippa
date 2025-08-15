import { Application, Container, Graphics } from 'pixi.js'
import { Cursor } from './cursor'
import { Ruler } from './ruler'

export interface LibrettoOption {
  id: string
}

export class Libretto {
  app?: Application
  ruler?: Ruler
  cursor?: Cursor
  scroller = new Container()

  constructor(private _option: LibrettoOption) {}

  async initial(): Promise<void> {
    const { id } = this._option

    const app = new Application()
    this.app = app

    app.stage.addChild(this.scroller)

    const wrapper = document.getElementById(id)

    if (!wrapper) {
      throw new Error('wrapper not found')
    }

    await app.init({
      resizeTo: wrapper,
      backgroundColor: '#393941',
    })

    // https://github.com/pixijs/pixijs/issues/11427
    new ResizeObserver(() => {
      app.queueResize()
      this.ruler?.updateWidth(app.stage.width)
      this.ruler?.updateScreenWidth(app.screen.width)

      this.cursor?.updateWidth(app.stage.width)
      this.cursor?.updateScreenWidth(app.screen.width)
      this.cursor?.updateHeight(app.screen.height)
    }).observe(wrapper)

    wrapper.appendChild(app.canvas)

    this._createRuler()
    this._createCursor()

    this.mock()
  }

  mock(): void {
    const graphics = new Graphics()
    graphics.roundRect(5, 50, 1000, 40, 10)
    graphics.fill('#ffffffaa')

    this.scroller.addChild(graphics)
  }

  private _createRuler(): void {
    this.ruler = new Ruler({
      width: this.app!.stage.width,
      screenWidth: this.app!.screen.width,
      duration: 1000 * 60,
    })
    this.scroller.addChild(this.ruler.container)

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
    this.app!.stage.addChild(this.cursor.container)
  }
}
