import {
  type Dependency,
  type Link,
  type Subscriber,
  SubscriberFlags,
  createReactiveSystem,
} from "alien-signals";

import { isFunction } from "es-toolkit";

const {
  link,
  propagate,
  endTracking,
  startTracking,
  updateDirtyFlag,
  processComputedUpdate,
  processEffectNotifications,
} = createReactiveSystem({
  updateComputed(computed: Computed) {
    return computed.update();
  },
  notifyEffect(effect: Effect) {
    effect.notify();
    return true;
  },
});

let activeSub: Subscriber | undefined = undefined;
let batchDepth = 0;

export function startBatch(): void {
  ++batchDepth;
}

export function endBatch(): void {
  if (!--batchDepth) {
    processEffectNotifications();
  }
}

export function signal<T>(): Signal<T | undefined>;
export function signal<T>(oldValue: T): Signal<T>;
export function signal<T>(oldValue?: T): Signal<T | undefined> {
  return new Signal(oldValue);
}

export class Signal<T = any> implements Dependency {
  // Dependency fields
  subs: Link | undefined = undefined;
  subsTail: Link | undefined = undefined;

  constructor(private _value: T) {}

  get value(): T {
    if (activeSub !== undefined) {
      link(this, activeSub);
    }
    return this._value;
  }

  set value(newVal: T) {
    if (this._value !== newVal) {
      this._value = newVal;
      const subs = this.subs;
      if (subs !== undefined) {
        propagate(subs);
        if (!batchDepth) {
          processEffectNotifications();
        }
      }
    }
  }
}

export function isSignal<T>(value: Signal<T> | any): value is Signal<T> {
  return value instanceof Signal;
}

export function computed<T>(getter: () => T): Computed<T> {
  return new Computed<T>(getter);
}

export class Computed<T = any> implements Subscriber, Dependency {
  _value: T | undefined = undefined;

  // Dependency fields
  subs: Link | undefined = undefined;
  subsTail: Link | undefined = undefined;

  // Subscriber fields
  deps: Link | undefined = undefined;
  depsTail: Link | undefined = undefined;
  flags: SubscriberFlags = SubscriberFlags.Computed | SubscriberFlags.Dirty;

  constructor(public getter: () => T) {}

  get value(): T {
    const flags = this.flags;
    if (flags & (SubscriberFlags.PendingComputed | SubscriberFlags.Dirty)) {
      processComputedUpdate(this, flags);
    }
    if (activeSub !== undefined) {
      link(this, activeSub);
    }
    return this._value as T;
  }

  update(): boolean {
    const prevSub = activeSub;
    activeSub = this;
    startTracking(this);
    try {
      const oldValue = this._value;
      const newValue = this.getter();
      if (oldValue !== newValue) {
        this._value = newValue;
        return true;
      }
      return false;
    } finally {
      activeSub = prevSub;
      endTracking(this);
    }
  }
}

export function isComputed<T>(value: Computed<T> | any): value is Computed<T> {
  return value instanceof Computed;
}

export function readonly<T extends Signal<any>>(
  signal: T,
): Computed<T["value"]> {
  return computed(() => signal.value);
}

export function effect<T>(fn: () => T): Effect<T> {
  const e = new Effect(fn);
  e.run();
  return e;
}

export class Effect<T = any> implements Subscriber {
  // Subscriber fields
  deps: Link | undefined = undefined;
  depsTail: Link | undefined = undefined;
  flags: SubscriberFlags = SubscriberFlags.Effect;

  constructor(public fn: () => T) {}

  notify(): void {
    const flags = this.flags;
    if (
      flags & SubscriberFlags.Dirty ||
      (flags & SubscriberFlags.PendingComputed && updateDirtyFlag(this, flags))
    ) {
      this.run();
    }
  }

  run(): T {
    const prevSub = activeSub;
    activeSub = this;
    startTracking(this);
    try {
      return this.fn();
    } finally {
      activeSub = prevSub;
      endTracking(this);
    }
  }

  stop(): void {
    startTracking(this);
    endTracking(this);
  }
}

export function watch<T>(
  val: Signal<T> | Computed<T> | (() => T),
  callback: (newVal: T, oldVal: T) => void,
  options: {
    immediate?: boolean;
  } = {},
): Watcher<T> {
  return new Watcher(val, callback, options);
}

export class Watcher<T = any> implements Subscriber {
  // Subscriber fields
  deps: Link | undefined = undefined;
  depsTail: Link | undefined = undefined;
  flags: SubscriberFlags = SubscriberFlags.Effect;
  canRun = false;

  constructor(
    public val: Signal<T> | Computed<T> | (() => T),
    public callback: (newVal: T, oldVal: T) => void,
    options: {
      immediate?: boolean;
    } = {},
    private oldVal?: T,
  ) {
    if (options.immediate) {
      this.canRun = options.immediate;
    }
    this.run();
  }

  notify(): void {
    const flags = this.flags;
    if (
      flags & SubscriberFlags.Dirty ||
      (flags & SubscriberFlags.PendingComputed && updateDirtyFlag(this, flags))
    ) {
      this.run();
    }
  }

  run(): void {
    const prevSub = activeSub;
    activeSub = this;
    startTracking(this);
    try {
      let newVal: T = undefined as T;
      if (isSignal(this.val) || isComputed(this.val)) {
        newVal = this.val.value;
      } else if (isFunction(this.val)) {
        newVal = this.val();
      }
      if (this.oldVal !== newVal) {
        if (this.canRun) {
          this.callback(newVal, this.oldVal as T);
        } else {
          this.canRun = true;
        }
        this.oldVal = newVal;
      }
    } finally {
      activeSub = prevSub;
      endTracking(this);
    }
  }

  stop(): void {
    startTracking(this);
    endTracking(this);
  }
}

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

    this.track();
  }

  track(): void {
    this.tracker = effect(() => {
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
}

export function isAsyncComputed<T>(
  value: AsyncComputed<T> | any,
): value is AsyncComputed<T> {
  return value instanceof AsyncComputed;
}
