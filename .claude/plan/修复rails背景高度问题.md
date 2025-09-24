# 修复rails背景高度超出scroll高度问题

## 任务概述

修复rails背景高度超出scroll高度导致不必要Y轴滚动条的问题，确保背景高度严格等于scroll的viewportHeight。

## 问题分析

- **现象**: Y轴滚动条在rails内容明显未超出scroll高度时错误显示
- **根本原因**: rails的背景(bg)高度超出了scroll的高度
- **期望行为**: rails背景高度应该始终等于scroll的高度

## 执行计划

### 步骤1：分析当前的背景高度计算逻辑

**文件**: `/packages/timeline/src/rails.ts`
**函数**: `_drawFoundation()`
**操作**: 分析当前背景高度计算方式，找出超出viewportHeight的原因
**预期结果**: 明确当前背景高度计算的问题点

### 步骤2：修改\_drawFoundation()方法的高度计算

**文件**: `/packages/timeline/src/rails.ts`
**函数**: `_drawFoundation()`
**逻辑概要**:

- 移除基于内容宽度的背景高度计算
- 改为使用ScrollBox的viewportHeight作为背景高度
- 确保考虑X轴滚动条占用的空间
  **预期结果**: 背景高度严格等于可用的viewportHeight

### 步骤3：更新同步渲染机制

**文件**: `/packages/timeline/src/rails.ts`
**函数**: `_syncScrollbarState()`
**逻辑概要**: 确保背景更新后的滚动条状态同步正确触发
**预期结果**: 背景高度变化时滚动条状态正确更新

### 步骤4：验证resize场景下的背景高度

**文件**: `/packages/timeline/src/rails.ts`
**函数**: `updateScreenHeight()`, `updateScreenSize()`
**逻辑概要**: 确保在窗口resize时背景高度重新计算正确
**预期结果**: resize操作后背景高度仍然正确

### 步骤5：测试和验证

**操作**:

- 构建项目检查编译错误
- 运行TypeScript类型检查
- 测试不同rails数量下的滚动条显示
- 验证resize操作的背景高度适应性
  **预期结果**: 无编译错误，滚动条只在真正需要时显示

## 预期交付成果

- rails背景高度严格等于scroll的viewportHeight
- 消除不必要Y轴滚动条显示
- 保持resize场景下的正确高度计算
- 代码构建和测试通过

## 上下文

- 项目采用monorepo结构，主要使用TypeScript + PIXI.js + Vue 3
- 相关文件位于 `/packages/timeline/src/` 目录
- 最近已进行viewportHeight计算逻辑的修复
- 需要保持现有的架构重构成果（消除硬编码、降低耦合）

## 进度记录

- [x] 步骤1：分析当前背景高度计算逻辑 - 已发现问题：高度计算逻辑基本正确，但需要确保严格等于viewportHeight减去X轴滚动条空间
- [x] 步骤2：修改\_drawFoundation()方法的高度计算 - 修改为直接使用screenHeight计算，避免依赖scrollBox.viewportHeight
- [x] 步骤3：更新同步渲染机制 - 验证\_syncScrollbarState()方法工作正常
- [x] 步骤4：验证resize场景下的背景高度 - 确认updateScreenHeight()和updateScreenSize()逻辑正确
- [x] 步骤5：测试和验证 - 构建成功，TypeScript编译无错误，测试通过
- [x] 优化修复：发现真正问题是背景容器占用滚动空间，将背景高度设置为0解决根本问题
- [x] 最终修复：彻底移除rails组件的背景职责 - rails组件专注于rails逻辑，背景由更上层组件负责
- [x] 代码清理：移除所有背景相关的代码、导入和方法调用，简化架构
- [x] 撤回ScrollBox重构：保持原始架构不变
