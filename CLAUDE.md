# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an open-source clippa library built with TypeScript, Vue 3, and Pixi.js. The project is structured as a monorepo with multiple packages:

1. `timeline` - A timeline component for visual editing with draggable trains/rails
2. `canvas` - Canvas rendering functionality
3. `performer` - Performance-related utilities
4. `utils` - Shared utilities
5. `open-clippa` - Main package that exports all functionality

The application uses Vue 3 with Pinia for state management, Vue Router for routing, and UnoCSS for styling.

## Common Development Commands

```bash
# Development
pnpm dev          # Start the development server
pnpm build        # Build the library
pnpm build:app    # Build the application
pnpm preview      # Preview the built application

# Code Quality
pnpm lint:fix     # Run ESLint with auto-fix
pnpm test         # Run tests with Vitest

# Other
pnpm cleanup      # Run cleanup script
```

## Project Architecture

### Core Components

1. **Timeline** (`packages/timeline`) - The main timeline editing component
   - Uses Pixi.js for rendering
   - Contains Rails, Ruler, Cursor, and Train components
   - Manages time-based visual editing

2. **Train** (`packages/timeline/src/train`) - Draggable elements on the timeline
   - Has resizable handles on both sides
   - Can be moved between rails
   - Manages its own state and position

3. **Rails** (`packages/timeline/src/rail`) - Container for trains
   - Manages positioning of trains
   - Handles drag and drop between rails

4. **Canvas** (`packages/canvas`) - Rendering canvas functionality
   - Uses Pixi.js for graphics rendering

### Key Patterns

1. **Event-driven architecture** - Components communicate through events
2. **State management** - Uses a singleton State class for global state
3. **Pixi.js integration** - Uses Pixi.js for high-performance 2D graphics
4. **Component composition** - Timeline is composed of multiple sub-components

### File Structure

```
packages/
  timeline/           # Main timeline component
    src/
      train/          # Train components (draggable elements)
      rail/           # Rail components (containers for trains)
      timeline.ts     # Main timeline class
      ruler.ts        # Time ruler component
      cursor.ts       # Playhead cursor
      rails.ts        # Rails manager
      state.ts        # Global state management
  canvas/             # Canvas rendering
  performer/          # Performance utilities
  utils/              # Shared utilities
  open-clippa/        # Main export package
app/                  # Vue 3 application
  src/
    components/       # Vue components
    pages/            # Page components
    store/            # Pinia stores
```

### Development Workflow

1. Make changes to the appropriate package in `packages/`
2. Test changes in the Vue application in `app/`
3. Run `pnpm build` to build the packages
4. Run `pnpm dev` to start the development server
5. Use `pnpm lint:fix` to ensure code quality

### Testing

Tests are run with Vitest:

```bash
pnpm test           # Run all tests
pnpm test --watch   # Run tests in watch mode
```

### Build Process

The project uses Rolldown for building packages and Vite for building the application. The build configuration is in `rolldown.config.ts`.
