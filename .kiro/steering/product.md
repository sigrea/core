# Product Overview

## What is Sigrea?

Sigrea is a signal-based reactive programming library that provides fine-grained reactivity with automatic dependency tracking. Built on top of the alien-signals reactive system, it offers a minimal yet powerful API for building reactive applications in TypeScript and JavaScript.

## Core Features

- **Fine-grained Reactivity**: Only update components that actually changed, minimizing unnecessary re-renders
- **Automatic Dependency Tracking**: No manual subscription management - dependencies are tracked automatically
- **Lazy Evaluation**: Computed values only recalculate when accessed and dependencies have changed
- **First-class Async Support**: Built-in async reactive values with loading and error states
- **TypeScript-first Design**: Full type inference without requiring type annotations
- **Lightweight & Tree-shakeable**: Minimal runtime overhead with modular architecture
- **Lifecycle Management**: Mount/unmount callbacks for reactive stores with automatic cleanup
- **Batched Updates**: Transaction support to prevent intermediate notifications

## Target Use Cases

### Primary Use Cases
- **Reactive State Management**: Managing application state in frontend frameworks
- **Data Flow Orchestration**: Coordinating complex data dependencies in applications
- **Real-time Updates**: Building UIs that respond to changing data sources
- **Computed Properties**: Deriving values from multiple reactive sources efficiently

### Specific Scenarios
- Building reactive UI components without framework overhead
- Managing complex form state with interdependent fields
- Creating data visualization dashboards with real-time updates
- Implementing reactive business logic that responds to state changes
- Building reactive data models for applications

## Key Value Proposition

### Unique Benefits
- **Simplicity**: Minimal API surface (signal, computed, effect, watch) covers all reactive needs
- **Performance**: Pull-based lazy evaluation ensures optimal performance
- **Developer Experience**: Intuitive API with excellent TypeScript support
- **Framework Agnostic**: Can be integrated with any JavaScript framework or used standalone
- **Battle-tested Foundation**: Built on alien-signals, a proven reactive system

### Differentiators
- **No Compilation Step**: Works directly in JavaScript/TypeScript without build-time transforms
- **Granular Reactivity**: Updates propagate only to affected computations
- **Memory Efficient**: Linked-list based dependency tracking minimizes memory overhead
- **Predictable Behavior**: Clear semantics for when effects run and values update
- **Async-first Design**: AsyncComputed primitive handles async operations elegantly