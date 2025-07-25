import { isFunction } from "es-toolkit";
import type { AsyncComputed } from "../asyncComputed";
import { isAsyncComputed } from "../asyncComputed";
import type { Computed } from "../computed";
import { isComputed } from "../computed";
import type { Link, Subscriber } from "../reactive-system";
import {
  SubscriberFlags,
  endTracking,
  getActiveSub,
  setActiveSub,
  startTracking,
  updateDirtyFlag,
} from "../reactive-system";
import type { Signal } from "../signal";
import { isSignal } from "../signal";

export function watch<T>(
  val: Signal<T> | Computed<T> | AsyncComputed<T> | (() => T),
  callback: (newVal: T, oldVal: T) => void,
  options: {
    immediate?: boolean;
  } = {},
): Watcher<T> {
  return new Watcher(val, callback, options);
}

export class Watcher<T = any> implements Subscriber {
  deps: Link | undefined = undefined;
  depsTail: Link | undefined = undefined;
  flags: SubscriberFlags = SubscriberFlags.Effect;
  canRun = false;

  constructor(
    public val: Signal<T> | Computed<T> | AsyncComputed<T> | (() => T),
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
    const prevSub = getActiveSub();
    setActiveSub(this);
    startTracking(this);
    try {
      let newVal: T;
      if (isSignal(this.val) || isComputed(this.val)) {
        newVal = this.val.value;
      } else if (isAsyncComputed(this.val)) {
        newVal = this.val.value.value as T;
      } else if (isFunction(this.val)) {
        newVal = this.val();
      } else {
        return;
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
      setActiveSub(prevSub);
      endTracking(this);
    }
  }

  stop(): void {
    // Notify all dependencies that this watcher is being removed
    let link = this.deps;
    while (link !== undefined) {
      const dep = link.dep;
      // Check if dependency has lifecycle capabilities
      if (
        dep &&
        "_untrackSubscriber" in dep &&
        typeof dep._untrackSubscriber === "function"
      ) {
        (dep as any)._untrackSubscriber(this);
      }
      link = link.nextDep;
    }

    startTracking(this);
    endTracking(this);
  }
}
