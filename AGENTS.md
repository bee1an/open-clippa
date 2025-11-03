# open-clippa

总是使用简体中文回复

开源视频剪辑库构建工具，基于 TypeScript、Vue 3 和 Pixi.js 构建的高性能时间线编辑器。

## Architecture Overview

Monorepo 结构包含以下核心包：

### 核心包

- **timeline** - 时间线编辑器核心，支持可拖拽轨道/列车
- **canvas** - 基于 Pixi.js 的画布渲染系统
- **performer** - 视频表演者的抽象接口和实现
- **codec** - 编解码功能，如视频帧提取
- **selection** - 选择相关功能
- **utils** - 共享工具函数库
- **constants** - 常量定义
- **open-clippa** - 主入口包，统一导出所有功能

### 应用

- **app** - Vue 3 演示应用，使用 Pinia 状态管理、Vue Router 路由、UnoCSS 样式

#### Unocss 样式

- 优先使用 UnoCSS 样式，提供更好的性能和可维护性
- UnoCSS 使用方式参考配置文件, 注意使用 attribute 模式
- UnoCSS 配置文件：app/uno.config.ts

### 关键架构模式

- 事件驱动架构：组件通过 EventBus 通信
- 状态管理：使用单例 State 类进行全局状态管理
- Pixi.js 集成：高性能 2D 图形渲染
- 组件组合：Timeline 由多个子组件组合而成

## Project Layout

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

## Conventions & Patterns

**代码风格**

- ESLint + @antfu/eslint-config
- 单引号、尾随逗号、无分号
- class类中private方法使用下划线开头

**目录规范**

- 核心功能代码仅位于 `packages/`
- 演示应用代码仅位于 `app/`

**构建系统**

- 库构建：Rolldown (`rolldown.config.ts`)
- 应用构建：Vite (`vite.config.ts`)
- 包管理：pnpm workspace

## Git Workflows

**提交类型**

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

## Core Concepts

**关键架构模式**

- 事件驱动架构：组件通过 EventBus 通信

## 重要注意事项

完成后非必要不写测试和用例
完成后运行 `pnpm typecheck` 进行类型检查
完成后使用 `pnpm lint:fix` 确保代码质量
