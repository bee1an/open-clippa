# Performer 与 Selection 联动功能实现计划

## 项目背景

Open-clippa 是一个基于 TypeScript、Vue 3 和 Pixi.js 的视频剪辑库构建工具。本需求旨在实现 selection（选框）和 performer（表演者）之间的联动功能。

## 需求描述

实现 selection 和 performer 的显示联动：

- 当 performer 被点击时暴露选中事件
- 外部监听事件并根据 performer 位置信息显示 selection
- 使用 performer 边界框作为 selection 尺寸
- 支持点击空白区域取消选中
- 不支持多选

## 技术方案

采用**事件驱动 + 坐标转换**方案：

1. Performer 添加点击事件机制
2. 实现坐标转换工具
3. 创建联动管理器
4. 更新 Selection 组件支持联动

## 实施步骤

### 步骤 1：增强 Performer 接口

- 在 performer.ts 中添加点击事件类型定义
- 添加 getBounds() 和 getCanvasPosition() 方法
- 扩展 Performer 接口支持点击事件

### 步骤 2：创建坐标转换工具

- 新建 packages/utils/src/coordinate.ts
- 实现 canvasToSelectionCoords() 坐标转换函数
- 实现命中检测和边界获取函数

### 步骤 3：实现 Selection 状态管理

- 新建 packages/selection/src/composables/useSelectionState.ts
- 创建选中状态管理 composable
- 提供选中/取消选中方法

### 步骤 4：创建联动管理器

- 新建 packages/selection/src/managers/PerformerSelectionManager.ts
- 实现事件监听和联动逻辑
- 处理坐标转换和 selection 更新

### 步骤 5：更新 Selection 组件

- 修改 Selection.vue 集成状态管理
- 添加 performer 选中状态支持
- 优化位置和尺寸绑定

### 步骤 6：创建演示示例

- 新建 app/src/pages/PerformerSelectionDemo.vue
- 展示完整的联动功能

### 步骤 7：更新导出和类型定义

- 更新各包的 index.ts 导出新功能
- 确保主包包含所有新功能

### 步骤 8：添加测试用例

- 新建相关测试文件
- 确保功能质量和稳定性

## 核心技术要点

### 坐标转换逻辑

```typescript
// Canvas 坐标系 → Selection 坐标系
function canvasToSelectionCoords(canvasX: number, canvasY: number, canvasBounds: DOMRect) {
  return {
    x: canvasX - canvasBounds.left,
    y: canvasY - canvasBounds.top
  }
}
```

### 事件流程

1. 用户点击 Performer
2. Performer 触发 onClick 事件
3. PerformerSelectionManager 监听事件
4. 计算坐标并更新 Selection 显示
5. 点击空白区域时清除选中状态

## 预期交付物

- Performer 点击事件支持
- 坐标转换工具函数
- Selection 状态管理
- 联动管理器实现
- 更新的 Selection 组件
- 演示页面
- 完整的类型定义和导出
- 测试用例

## 注意事项

- 保持现有架构的事件驱动模式
- 确保组件间的解耦性
- 遵循项目的 TypeScript 和 Vue 3 规范
- 使用现有的 utils 包作为工具函数库
