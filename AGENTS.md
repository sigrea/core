# Repository guidance

Use [CONTRIBUTING.md](CONTRIBUTING.md) for development and release commands.
Formatting, lint, and TypeScript rules live in `vite.config.ts` and `tsconfig.json`.

- Keep reactivity behavior close to alien-signals. A new evaluation or caching rule
  needs an explicit design decision; do not expose internals as an incidental fix.
- Preserve the public exports in `index.ts` and `packages/index.ts`, including the
  ESM/CJS entry points and declaration paths in `package.json`.
- Preserve molecule and scope cleanup when changing lifecycle behavior. Tests that
  track molecules must dispose them; ordinary signal tests do not need that setup.
- Keep release preparation local. npm and GitHub Releases are published by the tag
  workflow. Test release changes with disposable repositories and mocked services.
