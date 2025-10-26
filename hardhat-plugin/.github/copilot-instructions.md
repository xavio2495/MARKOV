# Copilot Instructions for MARKOV Plugin

This repo is a pnpm monorepo containing the **Markov** Hardhat v3 plugin—a Git-like versioning system for ERC-2535 Diamond contracts with AI-powered analysis, branching/merging, and autonomous monitoring capabilities.

## Quick Start for AI Agents

### Essential Context
- **What**: Hardhat v3 plugin for Git-like version control of ERC-2535 Diamond smart contracts
- **Primary language**: TypeScript (ESM, Node 22+)
- **Build tool**: pnpm workspaces + TypeScript compiler
- **Key pattern**: Dispatcher task routes `markov <command>` to subtasks `markov:<command>`
- **Storage**: JSON files in `.markov/` directory (branch files contain config + commit history)
- **Dev workflow**: `pnpm watch` for auto-rebuild, test in `packages/example-project`

### First Actions for New Tasks
1. Run `pnpm install && pnpm build` if starting fresh
2. Check `src/index.ts` for existing task declarations
3. Look at similar tasks in `src/tasks/markov/` for patterns
4. Verify config keys in `src/types.ts` (use uppercase snake_case)
5. Remember: Hardhat v3 + viem (NOT v2 + ethers v5)

### Critical "Don't" List
- ❌ Don't use ethers v5 or reference `EIP2535-Diamonds-Reference-Implementation/` code
- ❌ Don't assume AI features (optimize, analyze, agent) are complete—they're stubs
- ❌ Don't add config keys without updating `src/types.ts` + `src/config.ts` + `src/storage/validators.ts`
- ❌ Don't forget `.js` extensions in ESM imports
- ❌ Don't use bash-specific syntax (use PowerShell-compatible commands)

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
  - **19 task files**: agent, analyze, branch, clone, config, deploy, dispatcher, help, init, log, merge, migrate, optimize, propose, reset, stats, status, sync, viz (plus legacy `my-task`).
  - Each subtask declared in `src/index.ts` with `.setAction(() => import("./tasks/markov/<command>.js"))`.
  - Subtasks implement `default async function(taskArguments: TaskArguments, hre: HardhatRuntimeEnvironment)` pattern.
  - Dispatcher merges flags/options into args array before routing to subtasks (see `dispatcher.ts` for option forwarding logic).
  - User invokes: `npx hardhat markov <command>` → dispatcher routes to `markov:<command>` subtask.
- **Configuration**:
  - User config: `MarkovUserConfig` in `src/types.ts`, extended via `src/type-extensions.ts`.
  - Dual config storage: `.markov/config.json` (authoritative) + `hardhat.config.ts` (mirrored for visibility).
  - Validation/resolution in `src/config.ts`, default values applied in `resolvePluginConfig`.
  - **8 config keys** (uppercase snake_case): `AGENTVERSE_API_TOKEN`, `ASI_API_KEY`, `Author`, `Auto_Sync`, `Chain`, `Gas_Price`, `Governance_Address`, `Wallet_Address`.
  - Plus nested `branches` config object for multi-chain branch configurations.
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

## Package Structure & Dependencies

### Plugin Dependencies (`packages/plugin/package.json`)
- **Runtime dependencies**:
  - `chalk@^4.1.2`: Terminal color/styling (v4 for CommonJS compatibility)
  - `gradient-string@^3.0.0`: Gradient text for splash screen
  - `@modelcontextprotocol/sdk@^1.0.4`: MCP integration (planned feature)
- **Dev dependencies**:
  - TypeScript 5.8, ESLint 9, Prettier 3.6
  - Hardhat 3.0.6 + testing utilities
  - `@nomicfoundation/hardhat-toolbox-viem@^3.0.0`: Viem integration
  - `tsx@^4.19.3`: TypeScript execution for tests
- **Peer dependencies**: Hardhat 3.0.6, hardhat-toolbox-viem 3.0.0, viem 2.7.6
- **Package.json scripts**:
  - `build`: Compile TypeScript (`tsc --build`)
  - `watch`: Auto-rebuild on file changes (`tsc --build --watch`)
  - `test`: Run Node.js test runner with Hardhat reporter
  - `lint`: Check code style (ESLint + Prettier)
  - `lint:fix`: Auto-fix linting issues
  - `clean`: Remove `dist/` build artifacts

### Monorepo Workspace (`pnpm-workspace.yaml`)
- Packages: `packages/*` (plugin + example-project)
- Use `pnpm -C packages/plugin <script>` to run scripts in specific package from root
- Workspace links allow example-project to use plugin without publishing

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
  - Config keys use **uppercase snake_case**: `Author`, `Chain`, `Gas_Price`, `Auto_Sync`, etc.
  - Also includes `BranchUserConfig` and `BranchConfig` for multi-chain branch configurations.
- **Extend Hardhat types in `src/type-extensions.ts`**: Declare module augmentations for `HardhatUserConfig` and `HardhatConfig`.
- **Validate in `src/config.ts`**: 
  - `validatePluginConfig`: Check types, return `HardhatUserConfigValidationError[]`.
  - `resolvePluginConfig`: Apply defaults, merge with partially resolved config.
  - Validates nested `branches` config for multi-chain support.
- **Wire via `src/hooks/config.ts`**: Return `validateUserConfig` and `resolveUserConfig` handlers.
- **8 config keys**: `AGENTVERSE_API_TOKEN`, `ASI_API_KEY`, `Author`, `Auto_Sync`, `Chain`, `Gas_Price`, `Governance_Address`, `Wallet_Address`.

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
- **Implementation**: See `src/tasks/markov/config.ts` for sync logic and `src/storage/history-storage.ts` for file operations.
- **Default values**: Applied in `src/config.ts` via `resolvePluginConfig` (author: "markov", chain: "Ethereum Testnet", autoSync: true, gasPrice: 10000, etc.).

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

### Deployment Architecture (Hardhat Ignition Integration)
- **Deployment tool**: Uses `@nomicfoundation/hardhat-ignition` for facet deployments (called via `hre.tasks.getTask("ignition:deploy")`).
- **Deploy flow** (in `src/tasks/markov/deploy.ts`):
  1. Compile contracts with `hre.tasks.getTask("compile").run({})` (skippable via `--skipCompile`).
  2. Deploy facets using Ignition modules (auto-generated or user-provided).
  3. Compute function selectors from ABIs using viem's ABI utilities.
  4. Simulate `diamondCut` operation before execution (optional via `--simulate`).
  5. Execute `diamondCut` on Diamond contract to add/replace/remove facets.
  6. Record commit with deployment metadata (txHash, gasUsed, etc.) to branch history.
- **Module generation**: Can create separate Ignition modules per facet with `--separateModules` flag.
- **Action types**: Global `--action` flag (add/replace/remove) or inferred from contract state.

## Integration Boundaries (Critical)

### Version Isolation
- **Plugin (Hardhat v3)**: Uses viem (planned, not fully integrated yet), modern ESM, Node 22, TypeScript 5.8.
- **Reference (Hardhat v2)**: Uses ethers v5, CommonJS, older ecosystem. **NEVER import or reference from plugin code.**
- **Dependency rule**: Plugin's `package.json` MUST NOT include ethers v5 or Hardhat v2 packages.

### AGENT.md vs Reality
- **`AGENT.md`** describes an aspirational future state (17 commands with full AI/MCP integration, viem for all contract interactions, autonomous agent with Fetch.ai uAgents).
- **Current implementation**: Core CLI commands exist (config, init, deploy, log, etc.), but AI features (optimize, analyze, agent), viem integration, and MCP are stubs or incomplete.
- **Guidance**: Build only what's requested in issues/tasks; don't assume `AGENT.md` features are complete unless they exist in `src/`.

### Stub Commands & Expected Outputs
Commands that currently show "⚠️ This command is not yet fully implemented":

**`markov optimize <facets> [--apply]`** - AI-powered gas optimization
- Should analyze facet code for gas inefficiencies
- Mock output structure:
  ```
  ⚡ AI Gas Optimization
  
  Analyzing facets: FacetA, FacetB
  
  🔍 Analysis Results:
  
  FacetA.sol:
    ✓ Line 42: Use unchecked{} for counter increment → Saves ~50 gas
    ✓ Line 67: Cache array length in loop → Saves ~200 gas per iteration
    ⚠ Line 89: Consider using uint256 instead of uint8 → Saves ~20 gas
  
  FacetB.sol:
    ✓ Line 23: Replace storage read with memory → Saves ~1,800 gas
    ✓ Line 45: Use custom errors instead of require strings → Saves ~100 gas
  
  Total estimated savings: ~2,200 gas per transaction
  
  Apply changes? (y/N):
  ```

**`markov analyze <facets>`** - AI-powered security analysis
- Should scan for vulnerabilities (reentrancy, overflow, access control)
- Mock output structure:
  ```
  🔍 AI Security Analysis
  
  Scanning facets: FacetA, FacetB
  
  🛡️ Security Report:
  
  FacetA.sol:
    🔴 HIGH: Potential reentrancy at line 45 (withdraw function)
       → Recommendation: Use ReentrancyGuard or checks-effects-interactions
    🟡 MEDIUM: Missing access control on line 67 (updateConfig)
       → Recommendation: Add onlyOwner modifier
    🟢 LOW: Unbounded loop at line 89
       → Recommendation: Add max iteration limit
  
  FacetB.sol:
    ✅ No critical issues found
    🟡 MEDIUM: Unchecked external call result at line 34
       → Recommendation: Validate return value
  
  Summary: 1 HIGH, 2 MEDIUM, 1 LOW issues found
  ```

**`markov propose <facets> [--message <msg>]`** - Submit to governance
- Should create on-chain governance proposal for Diamond upgrade
- Mock output structure:
  ```
  📝 Creating Governance Proposal
  
  Proposal Details:
    Title: Upgrade Diamond with FacetA and FacetB
    Description: Deploy security patches and gas optimizations
    Target: 0x1234...5678 (Diamond contract)
    Facets: FacetA (Add), FacetB (Replace)
  
  DiamondCut Preview:
    + FacetA: 0xabcd...ef01 (5 selectors)
    ↻ FacetB: 0x9876...5432 (8 selectors)
  
  Governance Contract: 0xdead...beef
  Proposal ID: 42
  Voting Period: 7 days
  
  ✅ Proposal submitted successfully!
  View at: https://governance.example.com/proposals/42
  ```

**`markov agent <start|stop|report>`** - Autonomous AI monitoring
- Should run background agent using MCP to monitor Diamond contract
- Mock output structure:
  ```
  🤖 AI Agent Manager
  
  Command: start
  
  Starting autonomous agent...
  ├─ Connecting to MCP server: https://mcp.blockscout.com/mcp
  ├─ Initializing Fetch.ai uAgent
  ├─ Subscribing to Diamond events: 0x1234...5678
  └─ Monitoring interval: 5 minutes
  
  ✅ Agent started (PID: 12345)
  
  Monitoring:
    • DiamondCut events
    • Function call patterns
    • Gas anomalies
    • Security events
  
  View logs: .markov/agent/logs/agent.log
  Stop agent: npx hardhat markov agent stop
  Get report: npx hardhat markov agent report
  ```

- **`markov agent report`** mock output:
  ```
  📊 Agent Activity Report
  
  Period: Last 24 hours
  Diamond: 0x1234...5678 (mainnet)
  
  📈 Activity Summary:
    Total transactions: 1,247
    Unique users: 89
    Average gas: 142,500
    Total value: 45.3 ETH
  
  🔔 Notable Events:
    • 3x DiamondCut executed (facet upgrades)
    • 15x Large transfers (>10 ETH)
    • 2x Failed transactions (gas estimation errors)
  
  ⚠️ Anomalies Detected:
    • Gas spike at 14:32 UTC (+350% above average)
      → Likely cause: Complex batch operation
    • New function selector called: 0x12345678
      → Added in recent upgrade (block 18923456)
  
  🔍 Security Alerts: None
  
  Next report: 2025-10-27 14:00 UTC
  ```

**`markov migrate <from> <to>`** - State migration generator
- Should analyze storage layout changes between commits and generate migration scripts
- Mock output structure:
  ```
  🔄 Generating Migration Script
  
  Analyzing commits:
    From: abc1234567890123 (Deploy initial facets)
    To:   def9876543210987 (Add storage variables)
  
  📊 Storage Layout Changes:
  
  FacetA:
    + uint256 newCounter (slot 5)
    + mapping(address => bool) authorized (slot 6)
    ~ uint8 status → uint256 status (slot 3, type upgraded)
  
  FacetB:
    - bytes32 deprecated (slot 2, removed)
    + string metadata (slot 7)
  
  ⚠️  Breaking Changes Detected:
    • Type change in FacetA.status requires data migration
    • Removed storage in FacetB.deprecated may leave orphaned data
  
  Generated migration script: migrations/migrate_abc1234_to_def9876.sol
  
  Migration Steps:
    1. Deploy new facet versions
    2. Run migration script to transform data
    3. Execute diamondCut to replace facets
  
  Review script before executing!
  ```

**`markov viz [--format <ascii|json>]`** - Contract visualization
- IMPLEMENTED: Visualizes contract structure and dependencies
- Outputs ASCII dependency tree and statistics
- Use `--format json` for programmatic parsing

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

## Error Handling & Debugging Patterns

### Task-Level Error Handling
- **Early validation**: Check required args at task start, throw descriptive errors before expensive operations.
- **Hardhat errors**: Use standard Error throwing; Hardhat will format stack traces based on `--show-stack-traces` flag.
- **User-friendly messages**: Avoid technical jargon in error messages; suggest next steps (e.g., "Run 'markov init' first").
- **Example pattern** (from tasks):
  ```typescript
  if (!taskArguments.address) {
    throw new Error("Contract address is required. Usage: markov clone <address> [network]");
  }
  ```

### Debugging Workflows
- **Watch mode**: Run `pnpm watch` in plugin directory for auto-rebuild during development.
- **Stack traces**: Add `--show-stack-traces` to any markov command for full error details.
- **Test single task**: Use `hre.tasks.getTask("markov:<command>").run({...args})` in tests.
- **Verbose logging**: Check `hre.config.markov.verbose` (planned) or add `console.log()` statements during dev.
- **Network debugging**: Hook handler in `src/hooks/network.ts` logs RPC connections (currently prints debug messages).

### Common Error Patterns
- **"Task not found"**: Ensure task is declared in `src/index.ts` tasks array AND has matching file in `src/tasks/markov/`.
- **"Invalid config"**: Check `validatePluginConfig()` in `src/config.ts` for validation errors; ensure uppercase snake_case for config keys.
- **"Branch not found"**: Verify `.markov/branches/<name>.json` exists; check `getCurrentBranchName()` from storage.
- **Import errors**: Remember `.js` extension in imports (ESM requirement); use `import type` for type-only imports.

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
