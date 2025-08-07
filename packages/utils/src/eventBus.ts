export class EventBus<T extends { [key: string | symbol]: unknown[] }> {
  /**
   * 存储事件
   * 这里使用 set 是为了去重, 因为同一个事件监听了两次, 触发是并不应该触发两次
   */
  protected events: { [k in keyof T]: Set<(...args: T[k]) => void> } = {} as any

  /** 监听器 */
  on<K extends keyof T>(eventName: K, callback: (...agrs: T[K]) => void): void {
    if (!this.events[eventName]) {
      this.events[eventName] = new Set()
    }

    this.events[eventName].add(callback)
  }

  /** 监听器(在一次触发后移除) */
  once<K extends keyof T>(eventName: K, callback: (...agrs: T[K]) => void): void {
    const onceCallback = (...args: T[K]): void => {
      callback(...args)
      this.off(eventName, onceCallback)
    }

    this.on(eventName, onceCallback)
  }

  /** 移除器 */
  off<K extends keyof T>(eventName: K, callback: (...agrs: T[K]) => void): void {
    if (!this.events[eventName]) {
      return
    }

    this.events[eventName].delete(callback)
  }

  /** 触发器 */
  emit<K extends keyof T>(eventName: K, ...agrs: T[K]): void {
    if (!this.events[eventName]) {
      return
    }

    this.events[eventName].forEach((callback) => {
      callback(...agrs)
    })
  }
}
