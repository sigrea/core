# Sigrea

Signal-based reactive programming library built on [alien-signals](https://github.com/stackblitz/alien-signals). Sigrea provides fine-grained reactivity with automatic dependency tracking for building reactive applications.

## Key Features

- **Fine-grained reactivity** - Only update what changed
- **Automatic dependency tracking** - No manual subscription management
- **Lazy evaluation** - Computed values update only when accessed
- **First-class async support** - Handle async operations reactively
- **Lifecycle management** - Run code when stores gain/lose subscribers
- **TypeScript-first** - Full type inference without annotations
- **Lightweight** - Tree-shakeable and minimal runtime overhead

## Prerequisites

- Node.js 20+ (ES2023 features required)
- TypeScript 5.7+ (for development)

## Installation

```bash
npm install sigrea
# or
yarn add sigrea
# or
pnpm add sigrea
# or
bun add sigrea
```

## Quick Start

```typescript
import { signal, computed, effect } from "sigrea";

const count = signal(0);
const doubled = computed(() => count.value * 2);

effect(() => {
  console.log(`Count is ${count.value}, doubled is ${doubled.value}`);
});
// Logs: "Count is 0, doubled is 0"

count.value = 5;
// Logs: "Count is 5, doubled is 10"
```

## API Reference

### Core API

#### `signal<T>(initialValue?: T)`

Creates a reactive value container.

```typescript
const name = signal("Alice");
console.log(name.value); // 'Alice'
name.value = "Bob"; // Triggers updates in dependents
```

#### `computed<T>(fn: () => T)`

Creates a computed value that automatically updates when dependencies change.

```typescript
const firstName = signal("John");
const lastName = signal("Doe");
const fullName = computed(() => `${firstName.value} ${lastName.value}`);

console.log(fullName.value); // 'John Doe'
```

#### `asyncComputed<T>(evaluator: () => Promise<T>, options?)`

Creates an async computed value with built-in loading and error states.

```typescript
const userId = signal(1);
const userData = asyncComputed(
  async () => {
    const response = await fetch(`/api/users/${userId.value}`);
    return response.json();
  },
  {
    initialValue: null, // Initial value while loading
    debounce: 300, // Debounce time in milliseconds
    onError: (err) => console.error(err), // Error handler
  },
);

// Access reactive properties
console.log(userData.value.value); // User data or initial value
console.log(userData.loading.value); // Boolean loading state
console.log(userData.error.value); // Error or null

// Manually refresh
await userData.refresh();
```

#### `effect(fn: () => void)`

Creates a side effect that automatically tracks dependencies and re-runs when they change.

```typescript
const theme = signal("light");
const e = effect(() => {
  document.body.className = theme.value;
});

// Later: stop the effect
e.stop();
```

#### `watch(source, callback, options?)`

Watches a specific reactive source and calls a callback with new and old values.

```typescript
const temperature = signal(20);

const watcher = watch(temperature, (newVal, oldVal) => {
  console.log(`Temperature changed from ${oldVal} to ${newVal}`);
});

temperature.value = 25; // Logs: "Temperature changed from 20 to 25"

// Stop watching
watcher.stop();

// Options: immediate execution
watch(
  temperature,
  (newVal) => {
    console.log(`Current temperature: ${newVal}`);
  },
  { immediate: true },
); // Runs immediately with current value
```

### Utilities

#### `readonly(signal)`

Creates a read-only view of a signal.

```typescript
const writableCount = signal(0);
const readonlyCount = readonly(writableCount);

console.log(readonlyCount.value); // 0
// readonlyCount.value = 1; // TypeScript error!
```

#### Type Guards

Type guards for runtime type checking:

```typescript
import { isSignal, isComputed, isAsyncComputed, isLifecycleCapable } from "sigrea";

const s = signal(1);
const c = computed(() => 2);
const ac = asyncComputed(async () => 3);

console.log(isSignal(s)); // true
console.log(isComputed(c)); // true
console.log(isAsyncComputed(ac)); // true
console.log(isLifecycleCapable(s)); // true - signals support lifecycle
console.log(isLifecycleCapable(c)); // true - computed support lifecycle
```

### Lifecycle Management

Sigrea provides lifecycle management for reactive stores, allowing you to run code when stores gain or lose subscribers.

#### `onMount(store, callback)`

Execute a callback when a signal or computed gains its first subscriber.

```typescript
const data = signal<User | null>(null);

// Start fetching when someone subscribes
onMount(data, () => {
  console.log("Starting data fetch...");
  
  fetchUser().then(user => {
    data.value = user;
  });
  
  // Optional: return cleanup function
  return () => {
    console.log("Canceling pending requests...");
  };
});

// The mount callback runs when this effect is created
effect(() => {
  console.log(data.value); // Triggers mount on first access
});
```

#### `onUnmount(store, callback)`

Execute a callback when a signal or computed loses its last subscriber (after a 1-second delay).

```typescript
const connection = signal<WebSocket | null>(null);

// Cleanup when no one is listening
onUnmount(connection, () => {
  if (connection.value) {
    console.log("Closing WebSocket connection...");
    connection.value.close();
    connection.value = null;
  }
});
```

#### `keepMount(store)`

Prevent a store from unmounting during temporary subscriber changes.

```typescript
const expensiveData = computed(() => {
  // Some expensive computation
  return processLargeDataset();
});

// Keep the computed mounted even if temporarily unused
const release = keepMount(expensiveData);

// Later, when you want to allow normal unmounting
release();
```

#### Lifecycle Example: Auto-Refreshing Data

```typescript
const userId = signal(1);
const userData = signal<User | null>(null);
const refreshInterval = 60000; // 1 minute

// Setup auto-refresh when subscribed
onMount(userData, () => {
  let intervalId: any;
  let abortController: AbortController;
  
  const fetchData = async () => {
    abortController = new AbortController();
    try {
      const response = await fetch(`/api/users/${userId.value}`, {
        signal: abortController.signal
      });
      userData.value = await response.json();
    } catch (error) {
      if (error.name !== 'AbortError') {
        console.error('Fetch failed:', error);
      }
    }
  };
  
  // Initial fetch
  fetchData();
  
  // Setup interval
  intervalId = setInterval(fetchData, refreshInterval);
  
  // Cleanup function
  return () => {
    clearInterval(intervalId);
    abortController?.abort();
  };
});

// Component usage
const userProfile = computed(() => {
  const user = userData.value;
  if (!user) return "Loading...";
  return `${user.name} (${user.email})`;
});

// Data fetching starts when this effect runs
effect(() => {
  console.log(userProfile.value);
});
```

## Examples

### Basic Reactivity

```typescript
import { signal, computed, effect } from "sigrea";

const count = signal(0);
const isEven = computed(() => count.value % 2 === 0);
const message = computed(
  () => `Count is ${count.value} (${isEven.value ? "even" : "odd"})`,
);

effect(() => {
  console.log(message.value);
});

count.value++; // Logs: "Count is 1 (odd)"
count.value++; // Logs: "Count is 2 (even)"
```

### Async Operations

```typescript
import { signal, asyncComputed } from "sigrea";

const searchTerm = signal("");

const searchResults = asyncComputed(
  async () => {
    if (!searchTerm.value) return [];

    const response = await fetch(`/api/search?q=${searchTerm.value}`);
    return response.json();
  },
  {
    initialValue: [],
    debounce: 300, // Wait 300ms after typing
  },
);

// Reactive UI updates
console.log(searchResults.loading.value); // true during fetch
console.log(searchResults.error.value); // null or Error
console.log(searchResults.value.value); // search results

// Trigger search
searchTerm.value = "reactive programming";
```

### Combining Reactive Values

```typescript
import { signal, computed, watch } from "sigrea";

const firstName = signal("John");
const lastName = signal("Doe");
const age = signal(25);

const fullName = computed(() => `${firstName.value} ${lastName.value}`);

const profile = computed(() => ({
  name: fullName.value,
  age: age.value,
  isAdult: age.value >= 18,
}));

// Watch specific values
watch(fullName, (newName, oldName) => {
  console.log(`Name changed from ${oldName} to ${newName}`);
});

// Update triggers chain reaction
firstName.value = "Jane"; // Updates fullName, then profile
```

## TypeScript Support

Full TypeScript support with automatic type inference:

```typescript
const count = signal(0);
const doubled = computed(() => count.value * 2);
// TypeScript infers: Signal<number> and Computed<number>

interface User {
  id: number;
  name: string;
}

const currentUser = signal<User | null>(null);
const userName = computed(() => currentUser.value?.name ?? "Guest");
// Type inference works with complex types too
```

## Contributing

```bash
# Clone the repository
git clone https://github.com/sigrea/core.git
cd sigrea

# Install dependencies
pnpm install

# Run tests
pnpm test

# Build
pnpm build
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

## License

MIT

## Acknowledgments

Built on top of [alien-signals](https://github.com/stackblitz/alien-signals). Initially inspired by [alien-signals-starter](https://github.com/johnsoncodehk/alien-signals-starter).
