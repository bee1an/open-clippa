import { Application, Container } from 'pixi.js'
import { Cursor } from './cursor'
import { Rails } from './rails'
import { Ruler } from './ruler'
import { State } from './state'
import { QueueRun } from './utils'

export interface TimelineOption {
  /**
   * mount dom id
   */
  id: string
  /**
   * total duration
   */
  duration: number
}

export class Timeline {
  /**
   * pixi application
   */
  app?: Application
  /**
   * ruler instance
   */
  ruler?: Ruler
  /**
   * cursor instance
   */
  cursor?: Cursor
  /**
   * rails instance
   */
  rails?: Rails
  /**
   * outmost container
   */
  container = new Container()
  /**
   * ruler and cursor container
   */
  adjuster = new Container()
  /**
   * timeline global state
   */
  state: State = State.getInstance()
  /**
   * total duration
   */
  duration: number
  /**
   * scale factor
   */
  scale: number = 1.2

  constructor(private _option: TimelineOption) {
    this.duration = _option.duration
  }

  /**
   * initial timeline
   */
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

    app.stage.addChild(this.container)

    const queueRun = new QueueRun(() => {
      app.resize()
      this._updateChildrenSize()
    })

    // https://github.com/pixijs/pixijs/issues/11427
    new ResizeObserver(() => queueRun.queueRun()).observe(wrapper)

    wrapper.appendChild(app.canvas)

    this._createRuler()

    this._createCursor()

    this._createRails()

    this.container.addChild(this.adjuster)

    this._updatePxPerMs((app.screen.width / this.duration) * this.scale)
  }

  /**
   * Updates the global `pxPerMs` state
   *
   * If the value is the same as the current `pxPerMs`, it does nothing
   */
  private _updatePxPerMs(pxPerMs: number): void {
    if (pxPerMs === this.state.pxPerMs)
      return

    this.state.updatePxPerMs(pxPerMs)
  }

  /**
   * Update the size of the children components based on the current screen size
   */
  private _updateChildrenSize(): void {
    if (!this.app)
      return

    const screenWidth = this.app.screen.width
    const screenHeight = this.app.screen.height

    this.ruler?.updateScreenWidth(screenWidth)

    this.cursor?.updateScreenSize(
      screenWidth,
      screenHeight,
    )

    this.rails?.updateScreenSize(
      screenWidth,
      screenHeight,
    )
  }

  /**
   * Creates a Ruler component and adds it to the adjuster container
   *
   * when the `seek` event trigger then emit cursor seek handler
   */
  private _createRuler(): void {
    this.ruler = new Ruler({
      screenWidth: this.app!.screen.width,
      duration: this.duration,
    })
    this.adjuster.addChild(this.ruler.container)

    this.ruler.on('seek', (seekTime: number) => {
      this.cursor?.seek(seekTime)
    })
  }

  /**
   * Creates a Rails component and adds it to the container
   *
   * when the `scroll` event trigger then update ruler offset x
   */
  private _createRails(): void {
    this.rails = new Rails({
      screenWidth: this.app!.screen.width,
      screenHeight: this.app!.screen.height,
      duration: this.duration,
      maxZIndex: 5,
    })

    this.container.addChild(this.rails.container)

    this.rails.on('scroll', () => {
      this.adjuster.x = this.rails!.offsetX

      this.ruler?.updateOffsetX(this.rails!.offsetX)
    })

    this.rails.on('durationOverLimit', (duration: number) => {
      this.updateDuration(duration)
    })
  }

  /**
   * Creates a Cursor component and adds it to the adjuster container
   */
  private _createCursor(): void {
    this.cursor = new Cursor({
      screenWidth: this.app!.screen.width,
      height: this.app!.screen.height,
      duration: this.duration,
    })
    this.adjuster.addChild(this.cursor.container)
  }

  /**
   * update total duration
   *
   * call ruler `updateDuration` method
   * call rails `updateDuration` method
   */
  updateDuration(duration: number): void {
    this.duration = duration
    this.ruler?.updateDuration(duration)
    this.rails?.updateDuration(duration)
  }
}
