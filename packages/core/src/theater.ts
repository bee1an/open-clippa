import type { Performer } from '@clippa/performer'
import { EventBus } from '@clippa/utils'
import { Application } from 'pixi.js'

export type TheaterEvents = {
  hire: [Performer]
}

export class Theater extends EventBus<TheaterEvents> {
  private _app!: Application

  private _performers: Performer[] = []

  constructor(siteId: string) {
    super()
    this._initial(siteId)
  }

  private async _initial(siteId: string): Promise<Application> {
    const app = new Application()
    this._app = app

    await app.init()

    const theaterWrapper = document.getElementById(siteId)

    if (theaterWrapper) {
      theaterWrapper.appendChild(app.canvas)
    }
    else {
      console.error('theaterWrapper not found')
    }

    return app
  }

  hire(p: Performer): void {
    this._performers.push(p)
    this.emit('hire', p)
  }

  fire(p: Performer): void {
    this._performers = this._performers.filter(item => item !== p)
  }

  filterPerformerByTime(time: number): Performer[] {
    return this._performers.filter(item => item.start <= time && time < item.start + item.duration)
  }

  performance(
    preformers: Performer[],
  ): void {
    preformers.forEach(async (p) => {
      this._app.stage.addChild(p.sprite!)
    })
  }
}
