## Why

当前视频表演者直接使用 Pixi.js 的 HTMLVideoElement 进行视频播放，这种实现方式存在以下关键问题：

### 核心问题

1. **导出性能瓶颈**: 导出功能高度依赖 performer 的 seek 功能。HTMLVideoElement 的 seeked 事件监听会导致 seek 函数等待时间过长，直接影响导出速度。当前的实现通过监听 seeked 事件来确认视频已经跳转到正确帧，但这种方式在高频 seek 操作时性能极差，导致导出过程缓慢。

2. **帧精确性问题**: 使用 HTMLVideoElement 无法确保 seek 后一定在正确的帧上，特别是在快速跳转时可能出现帧对齐问题，这对需要精确帧级控制的导出功能是致命的。

3. **视频格式支持有限**: 受浏览器原生 HTMLVideoElement 支持限制，部分视频格式可能无法正常播放或性能较差。

### 解决方案

mediabunny 是高性能的零依赖 JavaScript 媒体处理库，已在项目中用于帧提取。该库：

- 提供微秒级精度的帧提取能力
- 解码速度极快，显著优于 HTMLVideoElement 的 seek 机制
- 支持直接获取指定时间点的帧，无需等待异步事件
- 支持更多视频格式和编解码器

通过重构视频表演者使用 mediabunny：

1. **解决导出性能问题**: seek 操作将变为同步的帧提取，大幅提升导出速度
2. **确保帧精确性**: 每个时间点都能精确获取对应帧，无帧对齐问题
3. **提升整体性能**: 利用 mediabunny 的硬件加速解码能力
4. **增强格式兼容性**: 支持更广泛的视频格式和编解码器

## What Changes

- **重构 Video 表演者类**：将基于 HTMLVideoElement 的实现替换为基于 mediabunny 的实现
- **替换视频加载逻辑**：使用 mediabunny 的 Input 和 InputVideoTrack API
- **重写播放控制逻辑**：基于 mediabunny 的帧提取实现 play/pause/seek 功能
- **更新纹理生成**：将 mediabunny 的 VideoFrame 转换为 Pixi.js 纹理
- **保持接口兼容性**：确保现有的 Performer 接口保持不变

**BREAKING**: 无破坏性变更，保持向后兼容

## Impact

- 受影响的代码：
  - `packages/performer/src/video/index.ts` - 核心实现
- 依赖关系：
  - mediabunny（已在项目中使用）
  - Pixi.js（继续使用）
- 性能影响：预期提升，特别是对于大量视频处理场景
- 风险：需要测试确保各种视频格式的兼容性

## 技术架构设计

### 核心设计决策

1. **保留现有接口**
   - 所有 public API 保持不变（VideoOption、PerformerEvents 等）
   - 保持与现有代码的完全兼容
   - 事件系统继续使用 EventBus

2. **内部实现替换**
   - 移除：HTMLVideoElement + Pixi Assets
   - 替换为：mediabunny Input/VideoSampleSink
   - 保留：Sprite 结构（用于交互和位置）

3. **帧管理策略**
   - 实现帧缓存 Map（time → VideoSample）
   - 使用 `VideoSampleSink.getSample(time)` 同步获取帧
   - 通过 `VideoSample.toBitmap()` 转换为 ImageBitmap
   - 创建/更新 Pixi Texture 基于 ImageBitmap

4. **播放控制优化**
   - `seek(time)`：直接同步提取帧，无需等待事件
   - `update(time)`：提取对应帧并更新渲染
   - `play(time)`：启动播放循环，定期调用 update
   - `pause(time)`：停止播放循环，保持当前帧

5. **资源生命周期**
   - `load()`：初始化 Input、VideoTrack、VideoSampleSink
   - `destroy()`：关闭所有 mediabunny 资源，清理缓存
   - 内存管理：VideoSample 使用后及时 close()
