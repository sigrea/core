import { endBatch, startBatch } from "../batch";
import type { Computed } from "../computed";
import { computed } from "../computed";
import type { Effect } from "../effect";
import { effect } from "../effect";
import type { Signal } from "../signal";
import { signal } from "../signal";

export function asyncComputed<T>(
  evaluator: () => Promise<T>,
  options: {
    initialValue?: T;
    onError?: (error: unknown) => void;
    debounce?: number;
  } = {},
): AsyncComputed<T> {
  return new AsyncComputed(evaluator, options);
}

export class AsyncComputed<T = any> {
  _value: Signal<T | undefined>;
  _loading: Signal<boolean>;
  _error: Signal<unknown>;

  executionId = 0;
  abortController: AbortController | null = null;
  timer: any = null;
  tracker: Effect<void> | null = null;

  readonly value: Computed<T | undefined>;
  readonly loading: Computed<boolean>;
  readonly error: Computed<unknown>;

  constructor(
    public evaluator: () => Promise<T>,
    public options: {
      initialValue?: T;
      onError?: (error: unknown) => void;
      debounce?: number;
    } = {},
  ) {
    this._value = signal<T | undefined>(options.initialValue);
    this._loading = signal(false);
    this._error = signal<unknown>(null);

    this.value = computed(() => this._value.value);
    this.loading = computed(() => this._loading.value);
    this.error = computed(() => this._error.value);

    // Track dependencies and execute
    this.track();
  }

  async execute(): Promise<void> {
    const currentId = ++this.executionId;

    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();

    startBatch();
    this._loading.value = true;
    this._error.value = null;
    endBatch();

    try {
      let promise: Promise<T>;
      try {
        promise = this.evaluator();
      } catch (err) {
        promise = Promise.reject(err);
      }

      const result = await promise;

      if (
        currentId === this.executionId &&
        this.abortController &&
        !this.abortController.signal.aborted
      ) {
        startBatch();
        this._value.value = result;
        this._loading.value = false;
        endBatch();
      }
    } catch (err) {
      if (
        currentId === this.executionId &&
        this.abortController &&
        !this.abortController.signal.aborted
      ) {
        startBatch();
        this._error.value = err;
        this._loading.value = false;
        endBatch();

        if (this.options.onError) {
          this.options.onError(err);
        }
      }
    }
  }

  refresh(): Promise<void> {
    return this.execute();
  }

  stop(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    if (this.tracker) {
      this.tracker.stop();
      this.tracker = null;
    }
  }

  track(): void {
    this.tracker = effect(() => {
      // Simply access evaluator to track dependencies
      // This is the key: just referencing the evaluator function
      // allows the effect to track any signals accessed within it
      this.evaluator;

      if (this.options.debounce && this.options.debounce > 0) {
        if (this.timer) {
          clearTimeout(this.timer);
        }
        this.timer = setTimeout(() => {
          this.execute();
        }, this.options.debounce);
      } else {
        this.execute();
      }
    });
  }
}

export function isAsyncComputed<T>(
  value: AsyncComputed<T> | any,
): value is AsyncComputed<T> {
  return value instanceof AsyncComputed;
}
