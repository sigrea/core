# Repository guidance

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and release commands.
Formatting, lint, and TypeScript settings are in `vite.config.ts` and `tsconfig.json`.

- Keep evaluation and caching behavior aligned with alien-signals. Discuss any
  departure before implementing it, and keep reactivity internals private.
- Keep existing ESM/CJS exports and declaration paths working when editing
  `index.ts`, `packages/index.ts`, or `package.json`.
- Keep molecule and scope cleanup intact when changing lifecycle code. In tests,
  clean up tracked molecules with `disposeTrackedMolecules()`. Signal-only tests
  do not need molecule setup.
- The local release command must not publish to npm or GitHub. Test release changes
  in temporary Git repositories with mocked npm and gh commands.
