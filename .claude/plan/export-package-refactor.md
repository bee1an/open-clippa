# 导出功能重构计划

## 任务概述

重构导出功能，将导出功能抽离为packages下的export子包，实现独立的通用导出功能。

## 上下文

- 基于方案1：基于现有VideoExporter的独立封装
- 迁移位置：从 packages/codec/src/videoExporter.ts 到 packages/export/
- 目标：独立、通用、支持进度监控的导出包

## 执行计划

1. 创建packages/export目录结构 ✓
2. 配置package.json和构建配置
3. 重构VideoExporter核心类
4. 创建进度追踪系统
5. 创建ExportManager管理器
6. 创建通用导出接口
7. 更新包导出引用
8. 清理codec包相关代码
9. 创建文档

## 预期结果

- 独立的@clippa/export包
- 通用视频导出功能
- 事件驱动的进度监控
- 无内部@clippa依赖
