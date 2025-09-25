# 修复Scrollbox Wheel事件捕获问题

**任务：** 通过添加透明Graphics对象解决scrollbox空白区域wheel事件捕获问题
**方案：** 方案1 - 添加透明Graphics作为事件捕获层
**执行时间：** 2025-09-25

## 需求概述

- **问题：** scrollbox空白区域无法触发wheel事件
- **根因：** Pixi.js容器空白区域缺乏实际的事件捕获对象
- **解决方案：** 添加透明Graphics对象作为事件捕获层
- **约束：** 事件绑定仍然绑定给container，不改变现有事件处理逻辑

## 实施步骤

### 步骤1：分析现有ScrollBox实现

- **文件：** `packages/timeline/src/scrollBox.ts`
- **目标：** 了解当前容器创建流程和层级结构
- **预期：** 确定Graphics对象的插入位置

### 步骤2：扩展ScrollBox类添加Graphics支持

- **文件：** `packages/timeline/src/scrollBox.ts`
- **操作：** 添加`_background`私有属性和相关方法
- **预期：** ScrollBox类具备Graphics背景支持

### 步骤3：实现Graphics事件捕获层

- **文件：** `packages/timeline/src/scrollBox.ts`
- **操作：** 创建`_createBackground()`方法
- **预期：** 透明Graphics覆盖整个ScrollBox区域

### 步骤4：实现尺寸动态更新机制

- **文件：** `packages/timeline/src/scrollBox.ts`
- **操作：** 创建`_updateBackground()`方法
- **预期：** Graphics尺寸与容器保持同步

### 步骤5：优化事件处理

- **文件：** `packages/timeline/src/scrollBox.ts`
- **操作：** 验证现有事件处理逻辑
- **预期：** wheel事件在空白区域正常触发

### 步骤6：测试验证

- **目标：** 验证修复效果
- **预期：** 空白区域能正常响应wheel滚动事件

## 成功标准

- ✅ 空白区域wheel事件能够触发
- ✅ 滚动功能正常工作
- ✅ 现有功能不受影响
- ✅ 性能无明显下降

## 关键要点

- 事件绑定仍然绑定给container（不改变）
- Graphics仅作为事件捕获层（透明，alpha=0）
- 保持现有功能和API不变
- 确保Graphics尺寸与容器同步
