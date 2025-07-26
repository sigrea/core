/**
 * Active Subscriber Management Module
 *
 * This module manages the global active subscriber context for the reactive system.
 * The active subscriber is used during dependency tracking to automatically establish
 * relationships between reactive values (dependencies) and their consumers (subscribers).
 *
 * When a computed value or effect is being evaluated, it becomes the "active subscriber"
 * and any reactive values accessed during evaluation are automatically linked as dependencies.
 */

import type { Subscriber } from "../core";

export let activeSub: Subscriber | undefined = undefined;

export function setActiveSub(sub: Subscriber | undefined): void {
  activeSub = sub;
}

export function getActiveSub(): Subscriber | undefined {
  return activeSub;
}
