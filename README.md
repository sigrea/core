# sigrea

Use the `createReactiveSystem` API to build a simple signal library.

## Usage

```ts
import { signal, computed, watch } from 'sigrea';

const count = signal(1);
const doubleCount = computed(() => count.value * 2);

watch(count, (newVal, oldVal) => {
  console.log(`prev count is: ${oldVal}`, next count is: ${newVal});
}); 

console.log(doubleCount.value); // 2

count.value = 2; // Console: prev count is: 1, next count is: 2

console.log(doubleCount.value); // 4
```
