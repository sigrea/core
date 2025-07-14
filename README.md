# sigrea

The **sig**nal base **rea**ctive programming library.

This library is based on [alien-signals](https://github.com/stackblitz/alien-signals) and [alien-signals-starter](https://github.com/johnsoncodehk/alien-signals-starter).

## Usage

```ts
import { signal, computed, watch } from "sigrea";

const count = signal(1);
const doubleCount = computed(() => count.value * 2);

watch(count, (newVal, oldVal) => {
  console.log(`old count value is: ${oldVal}, new count value is: ${newVal}`);
});

console.log(`count is: ${count.value}`); // 1
console.log(`doubleCount is: ${doubleCount.value}`); // 2

console.log("`count.value = 2`");
count.value = 2; // Console: prev count is: 1, next count is: 2

console.log(`doubleCount is: ${doubleCount.value}`); // 4
```
