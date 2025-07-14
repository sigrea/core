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

### Format Code
```bash
pnpm format
```
Runs Biome formatter and linter with automatic fixes.

### Run Example
```bash
pnpm start
```
Executes the example code in start.ts to demonstrate library usage.

### Install Dependencies
```bash
pnpm install
```
Installs dependencies and sets up git hooks via lefthook.

## Architecture

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

### Implementation Details

- Built on alien-signals reactive system
- Uses linked-list based dependency tracking for efficiency
- Implements pull-based lazy evaluation for computed values
- Effects are push-based and run after propagation
- Type guards: `isSignal()`, `isComputed()`
- `readonly()` utility to create read-only computed from signals

### Build Configuration

- **TypeScript**: Targets ES2021, strict mode enabled
- **Unbuild**: Generates both CJS and ESM builds with source maps
- **Biome**: Handles formatting and linting (replaces ESLint/Prettier)
- **Lefthook**: Git hooks for pre-commit formatting

### File Structure

- `index.ts` - Main library implementation and exports
- `start.ts` - Example usage demonstrating the API
- `build.config.ts` - Unbuild configuration
- `biome.json` - Code formatting and linting rules
- `dist/` - Build output (dual CJS/ESM packages)

## Development Notes

- No test suite currently exists - consider adding tests when implementing new features
- The library maintains a minimal API surface for performance
- All reactive primitives extend from alien-signals base classes
- Uses es-toolkit for utility functions like `isFunction`