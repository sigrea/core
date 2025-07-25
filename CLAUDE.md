# CLAUDE.md

@project-root/.claude/SPEC-DRIVEN.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sigrea is a signal-based reactive programming library built on top of alien-signals. It provides a minimal, efficient API for reactive state management with signals, computed values, effects, and watchers.

## Key Commands

### Build

```bash
pnpm build
```

Builds the project using unbuild, generating CommonJS (.cjs) and ES modules (.mjs) along with TypeScript declarations.

### Test

```bash
pnpm test                    # Run all tests
pnpm test <pattern>          # Run specific test files (e.g., pnpm test signal)
pnpm test:ui                 # Run tests with UI interface
pnpm test:coverage          # Generate test coverage report
pnpm test --watch           # Run tests in watch mode during development
```

### Format and Lint

```bash
pnpm format                  # Run Biome formatter and linter with automatic fixes
```

### Development Workflow

```bash
pnpm install                 # Install dependencies and set up git hooks
npx vitest <file-path>       # Run a single test file directly
```

## Architecture

### Reactive System Core

The library is built on a custom reactive system (`packages/reactive-system/`) that wraps alien-signals and adds lifecycle management capabilities. Key concepts:

- **Dependency Tracking**: Uses a linked-list structure for efficient dependency management
- **Pull-based Evaluation**: Computed values only recalculate when accessed and dependencies have changed
- **Push-based Effects**: Effects run automatically after dependency changes propagate
- **Global Subscriber Tracking**: `activeSub` tracks the current reactive context for automatic dependency collection

### Package Structure

Each reactive primitive is isolated in its own package under `packages/`:

- `reactive-system/` - Core alien-signals wrapper with lifecycle hooks
- `signal/` - Mutable reactive values with `.value` property
- `computed/` - Derived values that auto-track dependencies
- `effect/` - Side effects that re-run on dependency changes
- `watch/` - Explicit watchers with old/new value callbacks
- `batch/` - Transaction support to batch multiple updates
- `asyncComputed/` - Async reactive values with loading/error states
- `lifecycle/` - Mount/unmount callback system for resource management
- `utils/` - Type guards and utility functions

### Lifecycle System Architecture

The lifecycle system enables reactive stores to manage resources based on subscriber counts:

1. **Subscriber Tracking**: Each Signal/Computed tracks its active subscribers
2. **Mount Callbacks**: Execute when gaining first subscriber (e.g., start data fetching)
3. **Unmount Callbacks**: Execute 1 second after losing last subscriber (e.g., cleanup)
4. **Cleanup Functions**: Mount callbacks can return cleanup functions
5. **Keep-Alive**: `keepMount()` prevents unmount during temporary subscriber changes

Implementation is split across:

- `packages/lifecycle/` - Public API and type definitions
- `packages/signal/` and `packages/computed/` - Lifecycle tracking logic
- `packages/reactive-system/` - Enhanced tracking with cleanup notifications

### Key Implementation Details

**Dependency Management**:

- `startTracking()` begins dependency collection for a subscriber
- `link()` connects dependencies to subscribers
- `endTracking()` finalizes dependencies and notifies removed ones
- Enhanced to support lifecycle cleanup via `_untrackSubscriber()`

**Batching System**:

- `startBatch()` increments batch depth, deferring effect notifications
- `endBatch()` decrements depth and processes pending effects at depth 0
- Prevents intermediate updates during complex state changes

**Type System**:

- Full TypeScript support with generic types
- Type guards in `utils/` for runtime type checking
- Separate type exports to avoid circular dependencies

### Critical Files

- `packages/index.ts` - Central export hub, defines public API surface
- `packages/reactive-system/index.ts` - Core reactive system with lifecycle enhancements
- `packages/lifecycle/api.ts` - Unified lifecycle API for Signal and Computed
- `index.ts` - Main library entry that re-exports from packages

## Development Notes

- When modifying the reactive system, ensure lifecycle notifications work correctly
- Test files are colocated with implementations (e.g., `signal/index.test.ts`)
- Integration tests in `packages/integration.test.ts` verify cross-package behavior
- Pre-commit hook runs Biome on staged files via lefthook
- Build outputs dual CJS/ESM packages with full source maps
