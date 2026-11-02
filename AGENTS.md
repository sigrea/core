# Repository guidance

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and release commands.
Formatting, lint, and TypeScript settings are in `vite.config.ts` and `tsconfig.json`.

- Follow alien-signals when changing evaluation or caching behavior. Keep the
  reactivity internals private.
- When changing public exports in `index.ts` or `packages/index.ts`, check both
  ESM/CJS entry points and the declaration paths in `package.json`.
- Keep molecule and scope cleanup intact when changing lifecycle code. In tests,
  clean up tracked molecules with `disposeTrackedMolecules()`. Signal-only tests
  do not need molecule setup.
- The local release command must not publish to npm or GitHub. Test release changes
  in temporary Git repositories with mocked npm and gh commands.
