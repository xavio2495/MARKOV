# Copilot Instructions for MARKOV Plugin

This repo is a pnpm monorepo containing the **Markov** Hardhat v3 plugin—a Git-like versioning system for ERC-2535 Diamond contracts with AI-powered analysis, branching/merging, and autonomous monitoring capabilities.

## Big Picture

### Monorepo Structure
- **`packages/plugin`**: The Markov plugin (`markov-plugin`). Entry: `src/index.ts`. Plugin ID: `hardhat-markov`.
- **`packages/example-project`**: Minimal Hardhat v3 project for testing the plugin via workspace link.
- **`EIP2535-Diamonds-Reference-Implementation/`**: Standalone Hardhat v2 reference (NOT integrated with plugin; uses ethers v5).
- **`EIP-2535/`**: Additional Diamond contract reference materials.

### Plugin Architecture
- **Registration**: Exports default `HardhatPlugin` object in `packages/plugin/src/index.ts` with id `hardhat-markov`.
- **Hook handlers**: 
  - `src/hooks/config.ts`: Validates and resolves `markov` config (see `src/config.ts`).
  - `src/hooks/network.ts`: Monitors network connections and RPC requests.
- **Task dispatch pattern**:
  - Main task: `markov` (dispatcher in `src/tasks/markov/dispatcher.ts`) routes to subtasks like `markov:init`, `markov:deploy`, etc.
  - 19 total commands (config, init, clone, log, deploy, reset, status, sync, branch, merge, optimize, analyze, propose, viz, migrate, stats, agent, help, plus legacy `my-task`).
  - Each subtask declared in `src/index.ts` with `.setAction(() => import("./tasks/markov/<command>.js"))`.
  - Subtasks implement `default async function(taskArguments, hre)` pattern.
- **Configuration**:
  - User config: `MarkovUserConfig` in `src/types.ts`, extended via `src/type-extensions.ts`.
  - Dual config storage: `.markov/config.json` (authoritative) + `hardhat.config.ts` (mirrored for visibility).
  - Validation/resolution in `src/config.ts`, default values applied in `resolvePluginConfig`.
- **Data model**:
  - Version history stored in `.markov/history.json` as DAG (directed acyclic graph) for branches/merges.
  - `Commit` interface includes hash, timestamp, author, Diamond address, `FacetCut[]`, parent hash(es), and branch name.
  - `FacetCut` action enum: `0=Add`, `1=Replace`, `2=Remove`.

## Critical Workflows (Use pnpm + PowerShell)

### Development & Testing
```pwsh
# From repo root - install, build all packages, run tests
pnpm install
pnpm build
pnpm test

# Watch mode for active plugin development
pnpm -C packages/plugin watch

# Test plugin in example project (in separate terminal after watch starts)
cd packages/example-project
pnpm hardhat markov config
pnpm hardhat markov init
```

### Plugin-Specific Commands
```pwsh
# Lint and format
pnpm -C packages/plugin lint
pnpm -C packages/plugin lint:fix

# Build plugin only
pnpm -C packages/plugin build

# Clean build artifacts
pnpm -C packages/plugin clean
```

### EIP2535 Reference (Isolated Sandbox)
```pwsh
# Standalone Hardhat v2 project - do NOT mix with plugin code
cd EIP2535-Diamonds-Reference-Implementation
npm install
npx hardhat test
```

## Project-Specific Conventions

### Task Implementation Pattern
1. **Declare in `src/index.ts`**:
   ```typescript
   task("markov:command", "Description")
     .addOption({ name: "arg", type: ArgumentType.STRING, defaultValue: "" })
     .setAction(() => import("./tasks/markov/command.js"))
     .build()
   ```

2. **Implement in `src/tasks/markov/command.ts`**:
   ```typescript
   import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
   import type { TaskArguments } from "hardhat/types/tasks";
   
   export default async function markovCommand(
     taskArguments: TaskArguments,
     hre: HardhatRuntimeEnvironment,
   ) {
     // Access config: hre.config.markov.<field>
     // Validate args, execute logic, handle errors
   }
   ```

3. **Key examples**:
   - `src/tasks/markov/config.ts`: Interactive config with readline, dual file updates (.markov/config.json + hardhat.config.ts).
   - `src/tasks/markov/init.ts`: Multi-step initialization with user prompts, directory creation, file scaffolding.
   - `src/tasks/markov/dispatcher.ts`: Argument parsing, command routing, splash screen control.

### Config Extension Pattern
- **Define types in `src/types.ts`**: Separate `MarkovUserConfig` (optional fields) and `MarkovConfig` (resolved with defaults).
- **Extend Hardhat types in `src/type-extensions.ts`**: Declare module augmentations for `HardhatUserConfig` and `HardhatConfig`.
- **Validate in `src/config.ts`**: 
  - `validatePluginConfig`: Check types, return `HardhatUserConfigValidationError[]`.
  - `resolvePluginConfig`: Apply defaults, merge with partially resolved config.
- **Wire via `src/hooks/config.ts`**: Return `validateUserConfig` and `resolveUserConfig` handlers.
- **12 allowed config keys**: chain, wallet, gasPrice, author, aiApiKey, aiModel, governanceAddress, mcpEndpoint, agentverseApiToken, historyPath, verbose, autoSync.

### Testing Strategy
- **Framework**: Node.js test runner with `@nomicfoundation/hardhat-node-test-reporter`.
- **Two approaches**:
  1. **Fixture projects** (`test/fixture-projects/base-project`): Use `createFixtureProjectHRE("base-project")` from `test/helpers/fixture-projects.ts`, then run tasks via `hre.tasks.getTask("...").run()`.
  2. **Inline HRE**: Call `createHardhatRuntimeEnvironment({ plugins: [Plugin], ... })` for isolated config/task tests.
- **Run tests**: `pnpm test` (from root or `packages/plugin`). Pretest hook auto-runs build.

### Dual Config Management (Unique Pattern)
- **Why two files?**: `.markov/config.json` is machine-editable and authoritative; `hardhat.config.ts` provides code visibility and IDE autocomplete.
- **Update flow**: `markov config --set` writes to both files; `.markov/config.json` takes precedence if values conflict.
- **Implementation**: See `src/tasks/markov/config.ts` functions `writeConfigFile`, `updateHardhatConfig`, `replaceKeysInMarkovBlock`.

## Integration Boundaries (Critical)

### Version Isolation
- **Plugin (Hardhat v3)**: Uses viem (planned, not fully integrated yet), modern ESM, Node 22, TypeScript 5.8.
- **Reference (Hardhat v2)**: Uses ethers v5, CommonJS, older ecosystem. **NEVER import or reference from plugin code.**
- **Dependency rule**: Plugin's `package.json` MUST NOT include ethers v5 or Hardhat v2 packages.

### AGENT.md vs Reality
- **`AGENT.md`** describes an aspirational future state (17 commands with full AI/MCP integration, viem for all contract interactions, autonomous agent with Fetch.ai uAgents).
- **Current implementation**: Core CLI commands exist (config, init, deploy, log, etc.), but AI features (optimize, analyze, agent), viem integration, and MCP are stubs or incomplete.
- **Guidance**: Build only what's requested in issues/tasks; don't assume `AGENT.md` features are complete unless they exist in `src/`.

## Key Files Reference

### Plugin Core
- **Entry/Registration**: `packages/plugin/src/index.ts` (plugin object, all task declarations).
- **Config logic**: `src/config.ts` (validation/resolution), `src/hooks/config.ts` (hook wiring).
- **Type definitions**: `src/types.ts` (MarkovConfig, Commit, FacetCut, etc.), `src/type-extensions.ts` (module augmentations).
- **Dispatcher**: `src/tasks/markov/dispatcher.ts` (routes `markov <command>` to subtasks).

### Example Tasks
- **Interactive config**: `src/tasks/markov/config.ts` (readline prompts, dual file updates).
- **Project init**: `src/tasks/markov/init.ts` (scaffolds .markov/, contracts/, history.json).
- **Help system**: `src/tasks/markov/help.ts` (command reference).

### Utilities & Assets
- **Splash screen**: `src/utils/splash.ts` (ASCII logo with gradient-string, version info).
- **CLI docs**: `packages/plugin/MARKOV-CLI.md` (comprehensive usage guide for all 17 commands).

### Testing Fixtures
- **Fixture setup**: `test/helpers/fixture-projects.ts` (creates isolated HRE for tests).
- **Base fixture**: `test/fixture-projects/base-project/hardhat.config.ts` (minimal test project config).

### Example Usage
- **Consumer config**: `packages/example-project/hardhat.config.ts` (shows plugin import and minimal markov config).

### Reference Materials
- **Diamond docs**: `EIP2535-Diamonds-Reference-Implementation/README.md` (understand Diamond standard, not for plugin use).

## When Adding Features

1. **Follow dispatcher pattern**: Add task declaration in `src/index.ts`, implement in `src/tasks/markov/<name>.ts`.
2. **Config changes**: Update `src/types.ts` (both UserConfig and Config interfaces), add validation in `src/config.ts`, extend `ALLOWED_KEYS` in `config.ts` task if user-settable.
3. **Test both ways**: Add fixture-based test for full integration, inline HRE test for config validation.
4. **Windows-first**: All commands/tests must work in PowerShell (avoid bash-isms like `&&`, use cross-platform paths).
5. **Error handling**: Use chalk for colored output, validate inputs early, provide actionable error messages.
6. **Incremental**: Markov has 19 commands; many are stubs. Implement requested features fully rather than adding more stubs.

## Common Pitfalls

- **Don't reference EIP2535-Diamonds-Reference-Implementation code in plugin**—it's Hardhat v2/ethers v5.
- **Dual config sync**: When adding new config fields, update BOTH `.markov/config.json` logic AND `updateHardhatConfig` in `config.ts`.
- **Task naming**: Subtasks use colon separator (`markov:init`), but user invokes without colon (`markov init`). Dispatcher handles routing.
- **Import paths**: Plugin uses ESM with `.js` extensions in imports (TypeScript convention for Node ESM).
- **Splash screen**: Controlled by `displaySplashScreen()` call in dispatcher; can be disabled via env var (not yet implemented).
- **Type safety**: Always use `TaskArguments` typed interfaces (e.g., `MarkovInitArguments extends TaskArguments`) rather than casting.
