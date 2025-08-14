import { Application } from 'pixi.js'
import { Cursor } from './cursor'
import { Ruler } from './ruler'

export interface LibrettoOption {
  id: string
}

export class Libretto {
  app?: Application
  ruler?: Ruler
  cursor?: Cursor

  constructor(private _option: LibrettoOption) {}

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
    })

    // https://github.com/pixijs/pixijs/issues/11427
    new ResizeObserver(() => {
      app.queueResize()
      this.ruler?.updateWidth(app.screen.width)
      this.cursor?.updateHeight(app.screen.height)
    }).observe(wrapper)

    wrapper.appendChild(app.canvas)

    this._createRuler()

    this._createCursor()
  }

  private _createRuler(): void {
    this.ruler = new Ruler({ width: this.app!.screen.width, duration: 3000 * 60 })
    this.app!.stage.addChild(this.ruler.container)
  }

  private _createCursor(): void {
    this.cursor = new Cursor({ height: this.app!.screen.height, duration: 3000 * 60 })
    this.app!.stage.addChild(this.cursor.container)
  }
}
