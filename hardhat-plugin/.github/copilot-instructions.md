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
  - Dispatcher merges flags/options into args array before routing to subtasks (see `dispatcher.ts` for option forwarding logic).
- **Configuration**:
  - User config: `MarkovUserConfig` in `src/types.ts`, extended via `src/type-extensions.ts`.
  - Dual config storage: `.markov/config.json` (authoritative) + `hardhat.config.ts` (mirrored for visibility).
  - Validation/resolution in `src/config.ts`, default values applied in `resolvePluginConfig`.
  - 12 allowed config keys: chain, wallet, gasPrice, author, aiApiKey, aiModel, governanceAddress, mcpEndpoint, agentverseApiToken, historyPath, verbose, autoSync.
- **Data model & storage**:
  - Abstract `IHistoryStorage` interface in `src/storage/history-storage.ts` (file-based impl; MongoDB planned).
  - **File structure** (NEW simplified architecture):
    - `.markov/config.json`: Active configuration (synced from current branch file)
    - `.markov/branches/<name>.json`: Branch file containing both `config` and `commits` arrays
    - `.markov/.gitignore`: Git ignore rules for Diamond artifacts
  - **No longer used**: `history.json`, `HEAD`, `commits/` folder (removed for simplicity)
  - **Branch file schema**: Validated via JSON schema in `src/storage/validators.ts`
  - `Commit` interface includes hash, timestamp, author, Diamond address, `FacetCut[]`, parent hash(es), and branch name.
  - `FacetCut` action enum: `0=Add`, `1=Replace`, `2=Remove`.
  - `BranchConfig` embedded in each branch JSON file (multi-chain support: different chain/RPC/explorer per branch).

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
   - `src/tasks/markov/config.ts`: Interactive config with readline, bidirectional sync (config.json ↔ active branch file + hardhat.config.ts mirror).
   - `src/tasks/markov/init.ts`: Creates `.markov/`, `branches/`, `.gitignore`; prompts user to run config (auto-launches if confirmed).
   - `src/tasks/markov/dispatcher.ts`: Argument parsing, command routing, flag forwarding (--format, --chain, etc.), splash screen control.
   - `src/tasks/markov/help.ts`: Command-specific help with formatted boxes; `markov help <command>` shows detailed usage for single command.

### Config Extension Pattern
- **Define types in `src/types.ts`**: Separate `MarkovUserConfig` (optional fields) and `MarkovConfig` (resolved with defaults).
  - Also includes `BranchUserConfig` and `BranchConfig` for multi-chain branch configurations.
- **Extend Hardhat types in `src/type-extensions.ts`**: Declare module augmentations for `HardhatUserConfig` and `HardhatConfig`.
- **Validate in `src/config.ts`**: 
  - `validatePluginConfig`: Check types, return `HardhatUserConfigValidationError[]`.
  - `resolvePluginConfig`: Apply defaults, merge with partially resolved config.
  - Validates nested `branches` config for multi-chain support.
- **Wire via `src/hooks/config.ts`**: Return `validateUserConfig` and `resolveUserConfig` handlers.
- **12 allowed config keys**: chain, wallet, gasPrice, author, aiApiKey, aiModel, governanceAddress, mcpEndpoint, agentverseApiToken, historyPath, verbose, autoSync.

### Testing Strategy
- **Framework**: Node.js test runner with `@nomicfoundation/hardhat-node-test-reporter`.
- **Two approaches**:
  1. **Fixture projects** (`test/fixture-projects/base-project`): Use `createFixtureProjectHRE("base-project")` from `test/helpers/fixture-projects.ts`, then run tasks via `hre.tasks.getTask("...").run()`.
  2. **Inline HRE**: Call `createHardhatRuntimeEnvironment({ plugins: [Plugin], ... })` for isolated config/task tests.
- **Run tests**: `pnpm test` (from root or `packages/plugin`). Pretest hook auto-runs build.

### Help System Format (Command-Specific)
- **Pattern**: `markov help` shows all commands; `markov help <command>` shows detailed help for one command.
- **Format template**:
  ```
  ╔════════════════════════════════════════════════════════════════════╗
  ║                    MARKOV CLI - Command Reference                  ║
  ╚════════════════════════════════════════════════════════════════════╝
  
  
  Refer to https://markov.mintlify.app/cli-reference/ for detailed documentation.
  
  <command>
    <description>
  <additional context lines>
    Usage: npx hardhat markov <command> [options]
    Options:
      --flag                         Description
      --option <value>               Description
  ```
- **Implementation**: Each command in `help.ts` has its own formatted section; chalk used for colors; box drawing characters for headers.

### Config Management (Tri-Directional Sync Pattern)
- **Three config locations**:
  1. `.markov/config.json`: Active configuration (synced from current branch)
  2. `.markov/branches/<branch-name>.json`: Branch-specific config embedded in `config` field
  3. `hardhat.config.ts`: Mirrored for code visibility and IDE autocomplete
- **Sync flow**:
  - `markov config --set`: Updates `.markov/config.json` + active branch file + `hardhat.config.ts`
  - `markov branch switch <name>`: Syncs `.markov/config.json` FROM target branch's config
  - Branch switch preserves per-branch settings (e.g., main on mainnet, dev on localhost)
- **Implementation**: See `src/tasks/markov/config.ts` functions `writeConfigFile`, `syncBranchConfig`, `updateHardhatConfig`.
- **Default values**: Defined in `DEFAULT_VALUES` constant (author: "markov", chain: "Ethereum Testnet", autoSync: true, gasPrice: 10000, etc.).

### Storage Architecture
- **`IHistoryStorage` interface**: Abstract storage layer in `src/storage/history-storage.ts` with methods for branch/commit/config operations.
- **JSON Schema Validation**: `src/storage/validators.ts` provides strict TypeScript interfaces and JSON schema for branch files.
- **File-based implementation**: `FileHistoryStorage` class stores data in `.markov/` directory:
  - `config.json`: Active configuration synced bidirectionally with current branch's config
  - `branches/<name>.json`: Self-contained branch file with embedded `config` object and `commits` array
  - `.gitignore`: Generated during init to ignore build artifacts
- **Bi-directional sync**: When switching branches, `.markov/config.json` updates from target branch; when updating config, both files update.
- **Commit hash generation**: `generateCommitHash()` uses SHA-256 of commit metadata (timestamp, author, message, diamondAddress, cut, parentHash, branch).
- **Factory pattern**: `createHistoryStorage()` returns storage instance (MongoDB support planned but not implemented).

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
2. **Config changes**: Update `src/types.ts` (both UserConfig and Config interfaces), add validation in `src/config.ts` AND `src/storage/validators.ts` schema, extend `ALLOWED_KEYS` in `config.ts` task if user-settable.
3. **Branch file changes**: Update JSON schema in `validators.ts`; maintain bidirectional sync between config.json and active branch file.
4. **UI/UX standards**: Use chalk for colored output, add formatted headers/splash screens (see `utils/splash.ts`), center important headers.
5. **Test both ways**: Add fixture-based test for full integration, inline HRE test for config validation.
6. **Windows-first**: All commands/tests must work in PowerShell (avoid bash-isms like `&&`, use cross-platform paths).
7. **Error handling**: Validate inputs early, provide actionable error messages with examples.
8. **Storage operations**: Use `IHistoryStorage` interface methods; never read/write `.markov/` files directly in task code.
9. **Flag forwarding**: Add new flags to dispatcher's option merging logic so subtasks receive them properly.

## Common Pitfalls

- **Don't reference EIP2535-Diamonds-Reference-Implementation code in plugin**—it's Hardhat v2/ethers v5.
- **Tri-directional config sync**: When adding config fields, update ALL THREE: `.markov/config.json`, active branch file's config object, AND `hardhat.config.ts`.
- **Branch switching**: Always sync `.markov/config.json` FROM target branch when switching; preserve branch-specific settings.
- **Task naming**: Subtasks use colon separator (`markov:init`), but user invokes without colon (`markov init`). Dispatcher handles routing.
- **Import paths**: Plugin uses ESM with `.js` extensions in imports (TypeScript convention for Node ESM).
- **Splash screen**: Add splash screens to user-facing commands (clone, branch, stats) with centered headers using chalk.
- **Type safety**: Always use `TaskArguments` typed interfaces (e.g., `MarkovInitArguments extends TaskArguments`) rather than casting.
- **JSON schema validation**: Validate branch files using schemas from `src/storage/validators.ts` before reading/writing.
- **Flag parsing**: Add new flags to dispatcher's option merging logic (see `dispatcher.ts` conditional blocks) for proper forwarding.
