# Technology Stack

## Architecture

**Type**: Modular TypeScript Library
**Pattern**: Monorepo with package-based architecture
**Distribution**: Dual-format (CommonJS and ES Modules)

The library follows a modular design where each reactive primitive lives in its own package, allowing for optimal tree-shaking and minimal bundle size.

## Frontend

Not applicable - Sigrea is a framework-agnostic reactive programming library that can be used with any frontend framework or vanilla JavaScript.

## Backend

Not applicable - Sigrea is a client-side reactive programming library, though it can be used in Node.js environments.

## Core Technologies

### Language & Runtime
- **TypeScript**: 5.7.3 - Primary development language with strict mode
- **Target**: ES2021 - Modern JavaScript features
- **Module System**: Dual CJS/ESM output for maximum compatibility

### Dependencies
- **alien-signals**: ^1.0.3 - Core reactive system foundation
- **es-toolkit**: ^1.32.0 - Modern utility functions library

## Development Environment

### Required Tools
- **Node.js**: 18+ recommended
- **pnpm**: 10.4.1 - Package manager (enforced via packageManager field)
- **Git**: For version control and git hooks

### Build Tools
- **unbuild**: 3.3.1 - Zero-config build tool for TypeScript libraries
- **TypeScript**: 5.7.3 - Type checking and declaration generation

### Testing
- **Vitest**: ^3.2.4 - Fast unit testing framework
- **@vitest/ui**: UI interface for test debugging
- **@vitest/coverage-v8**: Code coverage reporting

### Code Quality
- **Biome**: 1.9.4 - All-in-one formatter and linter (replaces ESLint/Prettier)
- **Lefthook**: 1.10.10 - Git hooks manager for pre-commit checks

## Common Commands

```bash
# Install dependencies
pnpm install

# Build the library (CJS + ESM + types)
pnpm build

# Run tests
pnpm test              # Run all tests
pnpm test:ui           # Run tests with UI interface
pnpm test:coverage     # Generate coverage report

# Code formatting and linting
pnpm format            # Auto-fix formatting and linting issues

# Development workflow
pnpm test --watch      # Run tests in watch mode during development
```

## Environment Variables

No environment variables are required for development or usage of this library.

## Port Configuration

Not applicable - This is a library that doesn't run any servers or require network ports.

## Build Configuration

### TypeScript Configuration
- **Target**: ES2021
- **Module**: CommonJS (for type checking)
- **Strict Mode**: Enabled with all strict checks
- **Output**: Type declarations only (actual JS built by unbuild)

### Unbuild Configuration
- **Entry**: `./index.ts`
- **Output**: 
  - `dist/index.mjs` - ES Module build
  - `dist/index.cjs` - CommonJS build
  - `dist/index.d.ts` - TypeScript declarations
- **Source Maps**: Enabled for debugging

### Package Configuration
- **Side Effects**: false - Enables tree-shaking
- **Type**: module - ES Module package
- **Exports**: Dual CJS/ESM with conditional exports