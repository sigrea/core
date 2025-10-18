# Outline Core Stores

## Why
Sigrea currently ships only the reactive-system bridge while the legacy package exported concrete stores such as `signal`, `computed`, and `effect`, plus lifecycle helpers.  Downstream features (`watch`, `asyncComputed`, `logic`) depend on those stores’ contracts, but the new repository lacks documentation and scoped tasks to reintroduce them.

## Constraints
- Preserve behavioural contracts from `core_deprecated`, including lifecycle grace periods and dependency cleanup.
- Remain compatible with `alien-signals`’ subscriber semantics and `SubscriberFlags`.
- Keep the scope limited to the foundational stores; higher-level features continue as separate changes.

## What Changes
Document requirements and tasks for rebuilding the core stores (`signal`, `computed`, `effect`, `batch`, read-only wrapper, lifecycle helpers) so implementation can proceed in focused follow-up workstreams with accompanying tests.

## Impact
- Enables downstream features to reference authoritative specs while preventing scope creep beyond foundational stores.
- Signals that future implementation work should respect legacy behavioural contracts and compatibility requirements.
