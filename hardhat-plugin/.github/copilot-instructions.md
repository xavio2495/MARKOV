# AI coding agent guide

This repo is a pnpm monorepo for a Hardhat 3 plugin and a minimal example project. Build in `packages/plugin`; try it in `packages/example-project`.

## Big picture
- Packages
  - `packages/plugin`: Plugin source (TypeScript ESM). Entry `src/index.ts`; built to `dist/`.
  - `packages/example-project`: Minimal Hardhat project to run the plugin.
- Plugin (Hardhat 3) architecture
  - Default export in `src/index.ts` with: `id`, `hookHandlers` (config, network), and `tasks` built via `task(...).build()`.
  - Config lifecycle: `src/hooks/config.ts` wires `validatePluginConfig` and `resolvePluginConfig` from `src/config.ts`.
  - Types: `src/type-extensions.ts` extends `HardhatUserConfig`/`HardhatConfig` with `myConfig` (see `src/types.ts`).
  - Network hooks: `src/hooks/network.ts` logs `newConnection` and `onRequest`.

## Key files to know
- `packages/plugin/src/index.ts` — registers task `my-task` and hooks.
- `packages/plugin/src/tasks/my-task.ts` — action; prints `hre.config.myConfig.greeting`.
- `packages/plugin/test/` — Node test runner tests (`test/example-tests.ts`); fixture utilities in `test/helpers/fixture-projects.ts` load `test/fixture-projects/base-project`.
- `packages/example-project/hardhat.config.ts` — consumes plugin; sets `myConfig.greeting`.

## Conventions and patterns
- ESM throughout; in TS source import local modules with `.js` (e.g., `import "./tasks/my-task.js"`) so compiled JS resolves.
- Define tasks in `src/index.ts`; keep actions in `src/tasks/<name>.ts` and dynamically import in `setAction`.
- Extend config only via `src/config.ts` (validate/resolve) and surface types in `src/type-extensions.ts`.
- Testing helpers:
  - Inline HRE: `createHardhatRuntimeEnvironment({ plugins: [MyPlugin], ... })`.
  - Fixture HRE: `createFixtureProjectHRE("base-project")`.

## Developer workflows
- From repo root:
  - Install/build: `pnpm install` then `pnpm build`
  - Test: `pnpm test` (Node test runner + `@nomicfoundation/hardhat-node-test-reporter`)
  - Lint/format: `pnpm lint` / `pnpm lint:fix`
  - Dev watch (plugin): `pnpm watch`
- Manual try-out:
  - `cd packages/example-project`
  - Run task: `pnpm hardhat my-task` → prints greeting (default "Hello" or configured)
  - Run script: `pnpm hardhat run scripts/example-script.ts` (demonstrates provider usage)
- CI: `.github/workflows/ci.yml` runs build, test, lint on Node 22 and 24.

## Extending the plugin (examples)
- New task: add `src/tasks/hello.ts` (default export action) and in `src/index.ts` register with `task("hello").addOption(...).setAction(() => import("./tasks/hello.js")).build()`.
- New config option: update `src/types.ts` + `src/type-extensions.ts`; validate in `validatePluginConfig`; default in `resolvePluginConfig`; consume via `hre.config.myConfig.<field>`.
- Network behavior: modify `src/hooks/network.ts` handlers (`newConnection`, `onRequest`).

## Important context
- `AGENT.md` outlines a future “markov” diamond-versioning plugin. Current code is the minimal template (`hardhat-my-plugin`). Treat `AGENT.md` as a proposal, not current behavior.

## EIP-2535 reference (included in repo)
- The folder `EIP2535-Diamonds-Reference-Implementation/` contains the upstream reference diamond contracts and a standalone Hardhat (JS) project:
  - Key contracts: `contracts/Diamond.sol`, `contracts/facets/*.sol`, `contracts/interfaces/*.sol`, `contracts/libraries/LibDiamond.sol`.
  - Scripts/tests: `scripts/deploy.js`, `scripts/libraries/diamond.js`, `test/diamondTest.js`.
- It is not wired into the plugin or example project; use it as a reference for future “markov” work in `AGENT.md`.
- Keep it isolated (JS/CommonJS). The plugin uses TypeScript + ESM. Don’t copy files into `packages/example-project` unless you’re intentionally integrating.
- To run the reference project (optional):
  - From repo root:
    - `cd EIP2535-Diamonds-Reference-Implementation`
    - `npm install`
    - `npx hardhat test` (runs its own tests)
    - `npx hardhat run scripts/deploy.js`
