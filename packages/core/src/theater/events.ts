import type { Performer } from '@clippa/performer'

export type TheaterEvents = {
  /**
   * 雇佣
   */
  hire: [Performer]

  /**
   * 延迟添加
   */
  delayedAdd: [Performer]
}
