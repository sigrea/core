import type { Link, Subscriber } from "../reactive-system";
import {
  SubscriberFlags,
  endTracking,
  getActiveSub,
  setActiveSub,
  startTracking,
  updateDirtyFlag,
} from "../reactive-system";

export function effect<T>(fn: () => T): Effect<T> {
  const e = new Effect(fn);
  e.run();
  return e;
}

export class Effect<T = any> implements Subscriber {
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
    const prevSub = getActiveSub();
    setActiveSub(this);
    startTracking(this);
    try {
      return this.fn();
    } finally {
      setActiveSub(prevSub);
      endTracking(this);
    }
  }

  stop(): void {
    startTracking(this);
    endTracking(this);
  }
}
