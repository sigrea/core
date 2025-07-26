# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2025-01-26

### ⚠️ BREAKING CHANGES

- **Minimum Node.js version is now 20+** - ES2023 features are required
- **TypeScript target updated to ES2023** - May affect build outputs for older environments

### ✨ Added

- **Lifecycle Management System** - New APIs for managing reactive store lifecycles:
  - `onMount(store, callback)` - Execute callback when store gains its first subscriber
  - `onUnmount(store, callback)` - Execute callback when store loses its last subscriber  
  - `keepMount(store)` - Prevent unmount during temporary subscriber changes
  - Mount callbacks can return cleanup functions that run on unmount
  - 1-second delay before unmount to optimize rapid subscribe/unsubscribe cycles
  
- **Lifecycle Support in Core Primitives**:
  - `Signal` now implements `LifecycleCapable` interface
  - `Computed` now implements `LifecycleCapable` interface
  - Automatic cleanup of resources when stores are no longer used
  
- **Type Guard for Lifecycle Support**:
  - `isLifecycleCapable(value)` - Check if a value supports lifecycle methods

### 🔧 Changed

- **Modular Architecture** - Refactored into focused sub-packages:
  - `reactive-system/` split into `core/`, `activeSub/`, `batch/`, and `tracking/`
  - `lifecycle/` split into `types/`, `onMount/`, `onUnmount/`, and `keepMount/`
  - Better separation of concerns and maintainability
  
- **Enhanced Dependency Tracking**:
  - Added subscriber removal notifications via `_untrackSubscriber()`
  - Improved memory management with WeakSet-based tracking
  - Better cleanup when dependencies are removed

- **Development Environment**:
  - Updated all devDependencies to latest versions
  - Added Renovate for automated dependency updates
  - Added comprehensive CONTRIBUTING.md guide
  - Introduced spec-driven development with CLAUDE.md

### 🐛 Fixed

- Memory leaks in long-running applications with dynamic dependencies
- Race conditions in rapid subscribe/unsubscribe scenarios
- Timer scheduling errors in resource-constrained environments

### 📚 Documentation

- Added comprehensive lifecycle management examples
- Updated API documentation with new features
- Added CONTRIBUTING.md with development guidelines
- Enhanced inline code documentation

### 🔨 Internal

- Added comprehensive test coverage for lifecycle features
- Improved TypeScript strict mode compliance
- Enhanced build configuration for better tree-shaking
- Added pre-commit hooks with Biome formatter

## [1.0.1] - Previous Release

- Initial stable release with core reactive primitives
- Signal, Computed, AsyncComputed, Effect, Watch, and Batch APIs

---

### Migration Guide (1.x → 2.0)

#### Node.js Version Requirement

If you're using Node.js 16 or 18, you must upgrade to Node.js 20 or later:

```bash
# Check your Node.js version
node --version

# Upgrade using your preferred method:
# - nvm: nvm install 20
# - volta: volta install node@20
# - Direct download from nodejs.org
```

#### TypeScript Configuration

If you're targeting older environments, you may need to adjust your TypeScript configuration:

```json
{
  "compilerOptions": {
    "target": "ES2020",  // or your preferred target
    "lib": ["ES2020"]    // adjust as needed
  }
}
```

#### New Lifecycle Features

The new lifecycle management features are opt-in and don't affect existing code. To use them:

```typescript
import { signal, onMount, onUnmount, keepMount } from "sigrea";

const store = signal(0);

// Add mount callback
const unsubscribe = onMount(store, () => {
  console.log("Store is active!");
  
  // Optional: return cleanup function
  return () => {
    console.log("Cleaning up!");
  };
});

// Keep store mounted temporarily
const release = keepMount(store);
// ... do something ...
release(); // Allow normal unmounting
```

No changes are required to existing code that doesn't use these features.