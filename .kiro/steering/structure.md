# Project Structure

## Root Directory Organization

```
sigrea/
├── .claude/                 # Claude Code configuration
│   └── SPEC-DRIVEN.md      # Spec-driven development documentation
├── .kiro/                  # Kiro spec-driven development
│   └── steering/           # Project steering documents
│       ├── product.md      # Product overview
│       ├── tech.md         # Technology stack
│       └── structure.md    # This file
├── packages/               # Modular package structure
├── dist/                   # Build output (gitignored)
├── index.ts               # Main library entry point
├── build.config.ts        # Unbuild configuration
├── tsconfig.json          # TypeScript configuration
├── biome.json            # Code formatting/linting rules
├── vitest.config.ts      # Test configuration
├── package.json          # Package manifest
├── README.md             # Public documentation
├── CONTRIBUTING.md       # Development guidelines
└── CLAUDE.md            # Claude Code project guidance
```

## Subdirectory Structures

### `/packages/` - Core Library Modules

Each package follows a consistent structure:
```
packages/
├── reactive-system/      # Core reactive system (alien-signals wrapper)
│   └── index.ts         # System initialization and exports
├── signal/              # Mutable reactive values
│   ├── index.ts        # Signal implementation
│   ├── index.test.ts   # Unit tests
│   └── lifecycle.test.ts # Lifecycle-specific tests
├── computed/            # Derived reactive values
│   ├── index.ts        # Computed implementation
│   ├── index.test.ts   # Unit tests
│   └── lifecycle.test.ts # Lifecycle-specific tests
├── effect/              # Side effects
│   ├── index.ts        # Effect implementation
│   └── index.test.ts   # Unit tests
├── watch/               # Explicit dependency tracking
│   ├── index.ts        # Watch implementation
│   └── index.test.ts   # Unit tests
├── batch/               # Transaction support
│   ├── index.ts        # Batch operations
│   └── index.test.ts   # Unit tests
├── asyncComputed/       # Asynchronous reactive values
│   ├── index.ts        # AsyncComputed implementation
│   └── index.test.ts   # Unit tests
├── lifecycle/           # Mount/unmount system
│   ├── index.ts        # Main lifecycle exports
│   ├── api.ts          # Public API implementation
│   └── types.ts        # TypeScript type definitions
├── utils/               # Shared utilities
│   └── index.ts        # Type guards and helpers
├── index.ts            # Central package exports
└── integration.test.ts # Cross-package integration tests
```

### `/dist/` - Build Output
```
dist/
├── index.mjs           # ES Module build
├── index.mjs.map       # Source map for ESM
├── index.cjs           # CommonJS build
├── index.cjs.map       # Source map for CJS
├── index.d.ts          # TypeScript declarations
└── index.d.mts         # ESM-specific type declarations
```

## Code Organization Patterns

### Package Design Pattern
Each reactive primitive follows a consistent pattern:
1. **Implementation** (`index.ts`): Core functionality extending alien-signals
2. **Tests** (`index.test.ts`): Comprehensive unit tests using Vitest
3. **Types**: Inline TypeScript types with full inference support
4. **Exports**: Clean public API with minimal surface area

### Dependency Flow
```
index.ts
  └── packages/index.ts
       ├── signal/
       ├── computed/
       ├── effect/
       ├── watch/
       ├── batch/
       ├── asyncComputed/
       └── utils/
            └── reactive-system/
```

### Testing Strategy
- Unit tests colocated with implementation
- Integration tests in `packages/integration.test.ts`
- Lifecycle-specific tests for signal and computed packages
- Test files follow `*.test.ts` naming convention

## File Naming Conventions

### TypeScript Files
- **Implementation**: `index.ts` - Main package implementation
- **Tests**: `*.test.ts` - Test files with descriptive names
- **Types**: `types.ts` - Dedicated type definitions (when needed)
- **API**: `api.ts` - Public API surface (when separated)

### Configuration Files
- **Build**: `*.config.ts` - Build tool configurations
- **JSON**: `*.json` - Package manifests and tool configs
- **Markdown**: `*.md` - Documentation files (UPPERCASE for root docs)

### Package Naming
- Lowercase, no hyphens: `signal`, `computed`, `effect`
- Descriptive names matching the reactive primitive
- camelCase for compound names: `asyncComputed`

## Import Organization

### Standard Import Order
1. External dependencies (alien-signals, es-toolkit)
2. Reactive system imports
3. Sibling package imports
4. Local type imports
5. Test utilities (in test files)

### Import Examples
```typescript
// In packages/computed/index.ts
import { computed as alienComputed } from 'alien-signals';
import { ReactiveSystem } from '../reactive-system';
import type { Signal } from '../signal';

// In packages/index.ts
export { signal } from './signal';
export { computed, readonly } from './computed';
export type { Signal, Computed } from './types';
```

## Key Architectural Principles

### 1. Modular Architecture
- Each reactive primitive is a separate package
- Packages are independently testable
- Minimal inter-package dependencies

### 2. Type Safety First
- Full TypeScript with strict mode
- Type inference over explicit annotations
- Exported types for public API

### 3. Performance Optimization
- Tree-shakeable exports (sideEffects: false)
- Lazy evaluation for computed values
- Efficient linked-list dependency tracking

### 4. Testing Philosophy
- Comprehensive unit tests for each package
- Integration tests for package interactions
- Test-driven development approach

### 5. Clean API Design
- Minimal public API surface
- Consistent naming and behavior
- Progressive disclosure of complexity

### 6. Build Strategy
- Dual CJS/ESM output for compatibility
- Source maps for debugging
- Type declarations for TypeScript users

### 7. Lifecycle Management
- Global subscriber tracking
- Mount/unmount callbacks with cleanup
- Automatic resource management