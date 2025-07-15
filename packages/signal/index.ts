import type { Dependency, Link } from "../reactive-system";
import {
  getActiveSub,
  getBatchDepth,
  link,
  processEffectNotifications,
  propagate,
} from "../reactive-system";

export function signal<T>(): Signal<T | undefined>;
export function signal<T>(oldValue: T): Signal<T>;
export function signal<T>(oldValue?: T): Signal<T | undefined> {
  return new Signal(oldValue);
}

export class Signal<T = any> implements Dependency {
  subs: Link | undefined = undefined;
  subsTail: Link | undefined = undefined;

  constructor(private _value: T) {}

  get value(): T {
    const activeSub = getActiveSub();
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
        if (!getBatchDepth()) {
          processEffectNotifications();
        }
      }
    }
  }
}

export function isSignal<T>(value: Signal<T> | any): value is Signal<T> {
  return value instanceof Signal;
}
