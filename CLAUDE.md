# CLAUDE.md

@project-root/.claude/SPEC-DRIVEN.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Sigrea is a signal-based reactive programming library built on top of alien-signals. It provides a minimal, efficient API for reactive state management with signals, computed values, effects, and watchers.

**Core API**:
- `signal<T>(value)` - Mutable reactive values with `.value` property
- `computed<T>(() => expr)` - Auto-tracked derived values, lazily evaluated
- `asyncComputed<T>(async () => expr, options?)` - Async values with loading/error states
- `effect(() => expr)` - Side effects that auto-track and re-run on changes
- `watch(source, (newVal, oldVal) => {})` - Explicit watchers for specific sources
- `batch(() => { ... })` - Batch multiple updates into single notification cycle

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
npx vitest <file-path>       # Run a single test file directly (e.g., npx vitest packages/signal/index.test.ts)
```

### Format and Lint

```bash
pnpm format                  # Run Biome formatter and linter with automatic fixes
```

### Development Workflow

```bash
pnpm install                 # Install dependencies and set up git hooks
```

**Note**: Pre-commit hooks automatically run Biome on staged files via lefthook.

## Architecture

### Reactive System Core

The library is built on a custom reactive system (`packages/reactive-system/`) that wraps alien-signals and adds lifecycle management capabilities. The reactive system is modularized into sub-modules:

- **`core/`**: Alien-signals wrapper and foundational reactive system
- **`activeSub/`**: Global active subscriber context
- **`batch/`**: Batch operation depth for deferred notifications
- **`tracking/`**: Enhanced dependency tracking with lifecycle cleanup support

Key concepts:
- **Dependency Tracking**: Uses a linked-list structure for efficient dependency management
- **Pull-based Evaluation**: Computed values only recalculate when accessed and dependencies have changed
- **Push-based Effects**: Effects run automatically after dependency changes propagate
- **Global Subscriber Tracking**: `activeSub` tracks the current reactive context for automatic dependency collection
- **Lifecycle Integration**: The tracking module maintains a WeakMap to detect dependency removals and trigger cleanup

### Package Structure

Each reactive primitive is isolated in its own package under `packages/`:

- `reactive-system/` - Core alien-signals wrapper with lifecycle hooks
- `signal/` - Mutable reactive values
- `computed/` - Derived values
- `effect/` - Side effects
- `watch/` - Explicit watchers
- `batch/` - Transaction support
- `asyncComputed/` - Async reactive values
- `lifecycle/` - Mount/unmount callback system
- `utils/` - Type guards and utility functions

### Lifecycle System Architecture

The lifecycle system enables reactive stores to manage resources based on subscriber counts:

1. **Subscriber Tracking**: Each Signal/Computed tracks its active subscribers
2. **Mount Callbacks**: Execute when gaining first subscriber (e.g., start data fetching)
3. **Unmount Callbacks**: Execute 1 second after losing last subscriber (e.g., cleanup)
4. **Cleanup Functions**: Mount callbacks can return cleanup functions
5. **Keep-Alive**: `keepMount()` prevents unmount during temporary subscriber changes

The lifecycle system is modularized into:

- `packages/lifecycle/types/` - Type definitions
- `packages/lifecycle/onMount/` - Mount callbacks
- `packages/lifecycle/onUnmount/` - Unmount callbacks
- `packages/lifecycle/keepMount/` - Keep-alive functionality

**Note**: There is currently a circular dependency between lifecycle modules and Signal/Computed that should be addressed in future refactoring.

### Key Implementation Details

**Type Definitions**:

- `MountCallback = () => (() => void) | undefined` - Mount callbacks can return cleanup functions
- `UnmountCallback = () => void` - Simple unmount callbacks

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
- Pre-commit hook runs Biome on staged files via lefthook (see `lefthook.yml`)
- Build outputs dual CJS/ESM packages with full source maps

## Code Style and Conventions

- **TypeScript**: ES2023 target, strict mode enabled, CommonJS module system
- **Formatting**: Biome with spaces for indentation, double quotes for strings
- **Linting**: Biome with recommended rules, `noExplicitAny` disabled
- **Dependencies**: Managed by Renovate bot with automatic non-major updates

## Commit Message Format

Follow conventional commits:

```
type(scope): description

Types: feat, fix, docs, style, refactor, test, chore
Example: feat(signal): add batch update support
```

## Spec-Driven Development

This project follows Kiro-style Spec-Driven Development. Steering documents are located in `.kiro/steering/`:
- `product.md` - Product overview and value proposition
- `tech.md` - Technology stack and development environment
- `structure.md` - Project structure and architectural principles

For spec management, see `.claude/SPEC-DRIVEN.md` which documents the workflow and slash commands.
