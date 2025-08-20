export class QueueRun {
  constructor(public _callback: () => void) {}

  private _requestAnimationFrameId?: number
  queueRun(): void {
    if (this._requestAnimationFrameId)
      cancelAnimationFrame(this._requestAnimationFrameId)

    this._requestAnimationFrameId = requestAnimationFrame(() => {
      this.run()
    })
  }

  run(): void {
    this._callback()
  }
}
