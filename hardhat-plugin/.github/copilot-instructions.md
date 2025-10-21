# Copilot Instructions for this Repo

This repo is a pnpm monorepo with a Hardhat v3 plugin template, a sample Hardhat v3 project, and a separate EIP-2535 diamond reference project (Hardhat v2). Use these rules to be productive immediately.

## Big picture
- Monorepo layout:
  - `packages/plugin`: Hardhat v3 plugin (currently "hardhat-my-plugin"). Entry: `src/index.ts`. Built output in `dist/`.
  - `packages/example-project`: Minimal Hardhat v3 project that uses the plugin via workspace link (`hardhat-my-plugin": "workspace:*"`).
  - `EIP2535-Diamonds-Reference-Implementation/`: Standalone Hardhat v2 JS project for diamonds; not integrated with the plugin.
- Plugin architecture:
  - Registers via `export default` in `packages/plugin/src/index.ts` with id `hardhat-my-plugin`.
  - Uses Hardhat v3 Plugin API: hook handlers (`src/hooks/config.ts`, `src/hooks/network.ts`), tasks (declared in `index.ts`, action in `src/tasks/*.ts`).
  - Config extension: user config type + validation + resolution in `src/type-extensions.ts` and `src/config.ts`.

## Workflows (use pnpm)
- From repo root:
  - Install/build/test:
    ```pwsh
    pnpm install
    pnpm build
    pnpm test
    ```
  - Develop plugin with watch, then exercise it in the example project:
    ```pwsh
    pnpm -C packages/plugin watch
    cd packages/example-project
    pnpm hardhat my-task
    ```
- EIP2535 reference (isolated; uses Hardhat v2/ethers v5):
  ```pwsh
  cd EIP2535-Diamonds-Reference-Implementation
  npm install
  npx hardhat test
  ```

## Conventions and patterns
- Task pattern:
  - Declare in `src/index.ts` with `task("name").addOption(...).setAction(() => import("./tasks/<file>.js"))`.
  - Implement default-exported action in `src/tasks/<file>.ts` with `(args, hre)`; prefer `hre.config.myConfig` for plugin options. Example: `src/tasks/my-task.ts` prints `${hre.config.myConfig.greeting}, ${args.who}!`.
- Config pattern:
  - Add user-facing fields to `MyPluginUserConfig` and resolved `MyPluginConfig` in `src/types.ts` (generated here as `src/types.ts` is not present; extend existing `src/type-extensions.ts`).
  - Validate in `validatePluginConfig` and resolve defaults in `resolvePluginConfig` (`src/config.ts`). Wire via `src/hooks/config.ts`.
- Hooks:
  - `src/hooks/network.ts` shows how to observe connections and JSON-RPC requests. Follow this structure for additional network behaviors.
- Testing pattern:
  - Node test runner with `@nomicfoundation/hardhat-node-test-reporter`.
  - Two styles in `packages/plugin/test/`:
    - Fixture project: `helpers/fixture-projects.ts` + `fixture-projects/base-project`. Use `createFixtureProjectHRE("base-project")` then `hre.tasks.getTask("...").run()`.
    - Inline HRE: `createHardhatRuntimeEnvironment({ plugins: [Plugin], ... })` to test config and tasks without a fixture.
- Lint/format/TS:
  - ESLint configured in `packages/plugin/eslint.config.js` (TypeScript-aware). TS 5.8, Node 22 target. Use `pnpm -C packages/plugin lint`.

## Integration boundaries
- Do NOT mix the EIP2535 project’s dependencies with the plugin. The diamond reference uses Hardhat v2/ethers v5; the plugin and example use Hardhat v3.
- The root `AGENT.md` describes a future "markov" plugin vision. Treat it as non-authoritative; implement only what exists in `packages/plugin` unless an issue/task requests otherwise.

## Useful references in code
- Plugin entry and task registration: `packages/plugin/src/index.ts`.
- Config validation/resolution: `packages/plugin/src/config.ts` and `src/hooks/config.ts`.
- Type extensions: `packages/plugin/src/type-extensions.ts`.
- Example task: `packages/plugin/src/tasks/my-task.ts`.
- Example usage project: `packages/example-project/hardhat.config.ts`.
- Diamond reference docs: `EIP2535-Diamonds-Reference-Implementation/README.md`.

## When adding features
- Follow the existing patterns: add a task file under `src/tasks`, register it in `src/index.ts`, extend config via `src/config.ts` + `src/type-extensions.ts`, and add tests in `packages/plugin/test` using one of the demonstrated approaches.
- Keep commands and tests runnable from Windows PowerShell (default shell here).
