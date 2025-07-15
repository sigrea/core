import type { Dependency, Link, Subscriber } from "../reactive-system";
import {
  SubscriberFlags,
  endTracking,
  getActiveSub,
  link,
  processComputedUpdate,
  setActiveSub,
  startTracking,
} from "../reactive-system";
import type { Signal } from "../signal";

export function computed<T>(getter: () => T): Computed<T> {
  return new Computed<T>(getter);
}

export class Computed<T = any> implements Subscriber, Dependency {
  _value: T | undefined = undefined;

  subs: Link | undefined = undefined;
  subsTail: Link | undefined = undefined;

  deps: Link | undefined = undefined;
  depsTail: Link | undefined = undefined;
  flags: SubscriberFlags = SubscriberFlags.Computed | SubscriberFlags.Dirty;

  constructor(public getter: () => T) {}

  get value(): T {
    const flags = this.flags;
    if (flags & (SubscriberFlags.PendingComputed | SubscriberFlags.Dirty)) {
      processComputedUpdate(this, flags);
    }
    const activeSub = getActiveSub();
    if (activeSub !== undefined) {
      link(this, activeSub);
    }
    return this._value as T;
  }

  update(): boolean {
    const prevSub = getActiveSub();
    setActiveSub(this);
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
      setActiveSub(prevSub);
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
