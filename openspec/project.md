# Project Context

## Purpose

开源视频剪辑库构建工具，基于 TypeScript、Vue 3 和 Pixi.js 构建的高性能时间线编辑器。提供完整的视频剪辑功能抽象接口，支持拖拽轨道/列车、画布渲染、编解码等核心功能，采用 Monorepo 结构便于模块化开发和维护。

## Tech Stack

- **核心语言**: TypeScript
- **前端框架**: Vue 3 (演示应用)
- **图形渲染**: Pixi.js (高性能 2D 图形渲染)
- **状态管理**: Pinia (Vue 3 状态管理)
- **路由**: Vue Router
- **样式方案**: UnoCSS
- **包管理**: pnpm workspace
- **构建工具**:
  - 库构建: Rolldown (`rolldown.config.ts`)
  - 应用构建: Vite (`vite.config.ts`)
- **代码质量**:
  - ESLint + @antfu/eslint-config
  - 类型检查: `pnpm typecheck`
  - 代码格式化: `pnpm lint:fix`

## Project Conventions

### Code Style

- **格式化规则**:
  - 单引号
  - 尾随逗号
  - 无分号
- **命名规范**:
  - Class 类中 private 方法使用下划线开头（如 `_privateMethod()`）
- **代码质量**: 遵循 ESLint 配置，使用 @antfu/eslint-config

### Architecture Patterns

- **事件驱动架构**: 组件通过 EventBus 通信
- **状态管理**: 使用单例 State 类进行全局状态管理
- **组件组合**: Timeline 由多个子组件组合而成
- **模块化设计**: Monorepo 结构，核心功能与演示应用分离

### Project Structure

```
open-clippa/
├── packages/          # 核心库包
│   ├── timeline/      # 时间线编辑器
│   ├── canvas/        # 画布渲染
│   ├── performer/     # 表演者抽象
│   ├── codec/         # 编解码功能
│   ├── selection/     # 选择功能
│   ├── utils/         # 工具函数
│   ├── constants/     # 常量定义
│   └── open-clippa/   # 主入口包
└── app/               # Vue 3 演示应用
    ├── src/
    │   ├── components/
    │   ├── pages/
    │   └── store/     # Pinia 存储
    └── types/         # 自动生成的类型
```

### Directory Conventions

- 核心功能代码仅位于 `packages/`
- 演示应用代码仅位于 `app/`

### Testing Strategy

- 当前项目未强制要求测试用例
- 注重类型安全和代码质量检查

### Git Workflow

- **提交类型规范**:
  - `feat`: 新功能
  - `fix`: 错误修复
  - `docs`: 文档更新
  - `style`: 代码格式调整
  - `refactor`: 代码重构
  - `perf`: 性能优化
  - `test`: 测试相关
  - `build`: 构建系统变更
  - `ci`: CI配置变更
  - `chore`: 其他维护工作

## Domain Context

**核心功能模块**:

- **timeline**: 时间线编辑器核心，支持可拖拽轨道/列车
- **canvas**: 基于 Pixi.js 的画布渲染系统
- **performer**: 视频表演者的抽象接口和实现
- **codec**: 编解码功能，如视频帧提取
- **selection**: 选择相关功能
- **utils**: 共享工具函数库
- **constants**: 常量定义
- **open-clippa**: 主入口包，统一导出所有功能

**关键架构概念**:

- 事件驱动：组件间通过 EventBus 进行通信
- 状态集中：单例 State 类统一管理全局状态
- 高性能渲染：集成 Pixi.js 提供流畅的 2D 图形渲染
- 组件化：Timeline 通过多个子组件组合实现复杂功能

## Important Constraints

- 使用 UnoCSS 样式系统（优先使用 attribute 模式）
- Monorepo 架构，核心库与演示应用严格分离
- TypeScript 类型安全保证
- 面向性能优化的时间线编辑体验

## External Dependencies

- **Pixi.js**: 2D 图形渲染引擎
- **Vue 3**: 前端框架（演示应用）
- **Pinia**: Vue 3 状态管理
- **Vue Router**: 路由管理
- **UnoCSS**: 原子化 CSS 引擎
- **Rolldown**: 库构建工具
- **Vite**: 应用构建工具
- **pnpm**: 包管理器和工作空间
