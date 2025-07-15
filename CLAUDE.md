# CLAUDE.md

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
pnpm test          # Run all tests
pnpm test:ui       # Run tests with UI interface
pnpm test:coverage # Generate test coverage report
```
Runs the test suite using Vitest. Each package has its own test file.

### Format Code
```bash
pnpm format
```
Runs Biome formatter and linter with automatic fixes.


### Install Dependencies
```bash
pnpm install
```
Installs dependencies and sets up git hooks via lefthook.

## Architecture

### Package Structure

The library is organized as a modular monorepo with each reactive primitive in its own package:

```
packages/
├── reactive-system/    # Core reactive system (alien-signals wrapper)
├── signal/            # Mutable reactive values
├── computed/          # Derived reactive values
├── effect/            # Side effects that run when dependencies change
├── watch/             # Explicit dependency tracking with callbacks
├── batch/             # Transaction support for batching updates
├── asyncComputed/     # Asynchronous reactive values
└── utils/             # Type guards and utility functions
```

Each package has:
- `index.ts` - Implementation and exports
- `index.test.ts` - Unit tests
- Consistent structure for maintainability

### Core API Structure

The library exports a minimal reactive API from `index.ts`:

1. **Signal** - Mutable reactive values
   - `signal<T>(initialValue?: T)` - Creates a reactive signal
   - Access via `.value` property
   - Setting `.value` triggers reactive updates

2. **Computed** - Derived reactive values  
   - `computed<T>(getter: () => T)` - Creates a computed value from signals
   - Automatically tracks dependencies
   - Lazily evaluated and cached

3. **Effect** - Side effects that run when dependencies change
   - `effect(fn: () => void)` - Creates an effect that auto-runs
   - Returns an Effect instance with `.run()` and `.stop()` methods

4. **Watch** - Explicit dependency tracking with callbacks
   - `watch(source, callback, options?)` - Watches for changes
   - Provides both new and old values to callback
   - Supports immediate execution option

5. **Batching** - Transaction support
   - `startBatch()` / `endBatch()` - Batch multiple updates
   - Prevents intermediate effect notifications

6. **AsyncComputed** - Asynchronous reactive values
   - `asyncComputed<T>(evaluator: () => Promise<T>, options?)` - Creates async computed values
   - Tracks loading state, errors, and results as reactive signals
   - Supports debouncing, initial values, and error handling
   - Provides `.refresh()` method to manually re-execute
   - Auto-cancels previous executions when dependencies change

### Implementation Details

- Built on alien-signals reactive system (`packages/reactive-system/`)
- Uses linked-list based dependency tracking for efficiency
- Implements pull-based lazy evaluation for computed values
- Effects are push-based and run after propagation
- Type guards: `isSignal()`, `isComputed()`, `isAsyncComputed()` (in `packages/utils/`)
- `readonly()` utility to create read-only computed from signals
- AsyncComputed exposes `.value`, `.loading`, and `.error` as computed properties
- Global subscriber tracking via `setActiveSubscriber()`/`getActiveSubscriber()`

### Build Configuration

- **TypeScript**: Targets ES2021, strict mode enabled
- **Unbuild**: Generates both CJS and ESM builds with source maps
- **Biome**: Handles formatting and linting (replaces ESLint/Prettier)
- **Lefthook**: Git hooks for pre-commit formatting

### File Structure

- `index.ts` - Main library re-exports from packages
- `packages/index.ts` - Central export hub for all reactive primitives
- `build.config.ts` - Unbuild configuration
- `biome.json` - Code formatting and linting rules
- `vitest.config.ts` - Test configuration
- `dist/` - Build output (dual CJS/ESM packages)

## Development Notes

- Test suite uses Vitest with individual test files per package
- The library maintains a minimal API surface for performance
- All reactive primitives extend from alien-signals base classes
- Uses es-toolkit for utility functions like `isFunction`
- Package marked as `"sideEffects": false` for optimal tree-shaking
- Exports field in package.json provides dual CJS/ESM support