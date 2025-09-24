export class QueueRun {
  constructor(public _callback: () => void | Promise<void>) {}

  private _requestAnimationFrameId?: number
  queueRun(): void {
    if (this._requestAnimationFrameId)
      cancelAnimationFrame(this._requestAnimationFrameId)

    this._requestAnimationFrameId = requestAnimationFrame(() => {
      this.run()
    })
  }

  async run(): Promise<void> {
    await this._callback()
  }
}
