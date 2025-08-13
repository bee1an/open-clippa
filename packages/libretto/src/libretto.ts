import { Application } from 'pixi.js'
import { Ruler } from './ruler'

export interface LibrettoOption {
  id: string
}

export class Libretto {
  app?: Application
  ruler?: Ruler

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
      app.resize()
      this.ruler?.updateWidth(app.screen.width)
    }).observe(wrapper)

    wrapper.appendChild(app.canvas)

    this._createRuler()
  }

  private _createRuler(): void {
    this.ruler = new Ruler({ width: this.app!.screen.width, duration: 3000 * 60 })
    this.app!.stage.addChild(this.ruler.container)
  }
}
