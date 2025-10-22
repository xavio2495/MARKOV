# Markov CLI Documentation

Git-like versioning system for ERC-2535 Diamond contracts.

## Overview

Markov provides a comprehensive CLI for managing Diamond contract upgrades with version control, branching, AI-powered analysis, and autonomous monitoring.

## Installation

```bash
npm install --save-dev hardhat-markov
```

In your `hardhat.config.ts`:

```typescript
import markov from "hardhat-markov";

export default {
  plugins: [markov],
  markov: {
    chain: "localhost",
    wallet: "0x...",
    author: "Your Name",
    gasPrice: "auto",
    aiApiKey: process.env.OPENAI_API_KEY,
    mcpEndpoint: "https://mcp.blockscout.com/mcp",
    autoSync: true,
  },
};
```

## Commands

### Configuration

#### `markov config`
Display current Markov configuration.

```bash
npx hardhat markov config
```

### Diamond Initialization & Cloning

#### `markov init [--name <name>]`
Initialize a new Diamond contract with standard facets.

```bash
npx hardhat markov init
npx hardhat markov init --name MyDiamond
```

**What it does:**
- Deploys DiamondCutFacet, DiamondLoupeFacet, OwnershipFacet
- Deploys Diamond contract with initial cuts
- Initializes `.markov/history.json` for version tracking

#### `markov clone <address> [--network <network>]`
Clone an existing Diamond from another chain/network.

```bash
npx hardhat markov clone 0x1234... --network mainnet
```

**What it does:**
- Queries source Diamond via loupe functions
- Replicates facet structure locally
- Recreates version history

### Version Control

#### `markov log [--branch <branch>] [--limit <n>]`
Display commit history (similar to `git log`).

```bash
npx hardhat markov log
npx hardhat markov log --branch feature-branch --limit 20
```

#### `markov deploy <facets> [--message <msg>] [--simulate]`
Deploy facets and execute diamondCut.

```bash
npx hardhat markov deploy TokenFacet,GovernanceFacet --message "Add token functionality"
npx hardhat markov deploy MyFacet --simulate  # Dry-run
```

**What it does:**
- Compiles and deploys specified facets
- Computes function selectors
- Simulates diamondCut (if --simulate)
- Executes diamondCut
- Records commit in history

#### `markov reset <hash> [--simulate]`
Revert Diamond to a previous state.

```bash
npx hardhat markov reset abc123
npx hardhat markov reset abc123 --simulate
```

**What it does:**
- Loads target commit from history
- Computes reverting diamondCut
- Executes cut to restore previous state
- Updates history with reset commit

#### `markov status`
Check Diamond contract health.

```bash
npx hardhat markov status
```

**What it displays:**
- Current Diamond address
- Active facets and their selectors
- Loupe function availability
- Storage slot integrity

#### `markov sync`
Sync local history with on-chain DiamondCut events.

```bash
npx hardhat markov sync
```

**What it does:**
- Queries DiamondCut events from blockchain
- Reconciles with local `.markov/history.json`
- Resolves conflicts (on-chain takes precedence)

### Branching & Merging

#### `markov branch <create|switch|list> [name]`
Manage branches for parallel development.

```bash
npx hardhat markov branch list
npx hardhat markov branch create feature-governance
npx hardhat markov branch switch feature-governance
```

**What it does:**
- **create**: Create new branch from current commit
- **switch**: Switch to existing branch
- **list**: Show all branches with commit counts

#### `markov merge <branch> [--message <msg>]`
Merge another branch into current branch.

```bash
npx hardhat markov merge feature-governance --message "Merge governance features"
```

**What it does:**
- Combines cuts from source branch
- Detects and resolves selector conflicts
- Creates merge commit with multiple parents
- Executes merged diamondCut

### AI-Powered Features

#### `markov optimize <facets> [--apply]`
AI-powered gas optimization analysis.

```bash
npx hardhat markov optimize TokenFacet
npx hardhat markov optimize TokenFacet,GovernanceFacet --apply
```

**What it does:**
- Analyzes facet code with AI
- Suggests gas optimizations
- Optionally applies changes (--apply)
- Requires `aiApiKey` in config

#### `markov analyze <facets>`
AI-powered security vulnerability scan.

```bash
npx hardhat markov analyze TokenFacet,GovernanceFacet
```

**What it does:**
- Scans for common vulnerabilities (reentrancy, overflow, etc.)
- Uses AI to identify complex attack vectors
- Generates security report
- Requires `aiApiKey` in config

### Governance

#### `markov propose <facets> [--message <description>]`
Submit diamondCut proposal to governance contract.

```bash
npx hardhat markov propose NewFacet --message "Add new features via governance"
```

**What it does:**
- Prepares diamondCut calldata
- Submits proposal to configured governance contract
- Returns proposal ID for voting
- Requires `governanceAddress` in config

### Visualization & Analytics

#### `markov viz [--format <ascii|json>]`
Visualize Diamond structure and history.

```bash
npx hardhat markov viz
npx hardhat markov viz --format json > diamond-structure.json
```

**What it displays:**
- ASCII tree of facets and functions
- Commit history graph
- Branch visualization
- Or JSON export for external tools

#### `markov stats [--format <table|json>]`
Display analytics and statistics.

```bash
npx hardhat markov stats
npx hardhat markov stats --format json
```

**What it shows:**
- Gas usage per upgrade
- Upgrade frequency timeline
- Facet addition/removal stats
- Branch activity

#### `markov migrate <from> <to>`
Generate state migration scripts for upgrades.

```bash
npx hardhat markov migrate abc123 def456
```

**What it does:**
- Analyzes storage layout changes between commits
- Generates migration script
- Provides warnings for incompatible changes

### Autonomous Agent

#### `markov agent <start|stop|report>`
Manage autonomous AI monitoring agent.

```bash
npx hardhat markov agent start
npx hardhat markov agent report
npx hardhat markov agent stop
```

**What it does:**
- **start**: Launch background agent process
- **report**: Display agent activity summary
- **stop**: Terminate agent

**Agent Features:**
- Monitors DiamondCut events in real-time
- Uses MCP to query blockchain data
- Generates alerts for anomalies
- Produces periodic activity reports
- Requires `mcpEndpoint` in config

## Configuration Reference

### `hardhat.config.ts` options

```typescript
markov: {
  // Required
  chain: "localhost" | "mainnet" | "sepolia" | ...,
  wallet: "0x...",         // Deployer address
  author: "Your Name",     // Commit author

  // Optional
  gasPrice: "auto" | number,
  aiApiKey: string,              // OpenAI, etc.
  aiModel: "gpt-4",
  governanceAddress: "0x...",
  mcpEndpoint: "https://...",
  agentverseApiToken: string,
  historyPath: ".markov/history.json",
  verbose: false,
  autoSync: true,
}
```

## File Structure

```
.markov/
  history.json          # Version history and commits
  config.json           # Optional user config
  agent.log             # Agent activity logs
```

## Workflow Example

```bash
# 1. Initialize Diamond
npx hardhat markov init --name MyDiamond

# 2. Deploy initial facets
npx hardhat markov deploy TokenFacet --message "Initial token implementation"

# 3. Create feature branch
npx hardhat markov branch create feature-staking

# 4. Deploy on feature branch
npx hardhat markov deploy StakingFacet --message "Add staking"

# 5. Switch back to main
npx hardhat markov branch switch main

# 6. Merge feature
npx hardhat markov merge feature-staking

# 7. Analyze security
npx hardhat markov analyze StakingFacet

# 8. Check status
npx hardhat markov status

# 9. View history
npx hardhat markov log --limit 10
```

## Advanced Usage

### Using with Scripts

```typescript
import { HardhatRuntimeEnvironment } from "hardhat/types";

// In a Hardhat script
const hre: HardhatRuntimeEnvironment = require("hardhat");

await hre.tasks.getTask("markov:deploy").run({
  facets: "MyFacet",
  message: "Scripted deployment",
  simulate: false,
});
```

### Multi-Chain Deployments

```typescript
// Deploy to multiple chains
const chains = ["localhost", "sepolia", "mainnet"];

for (const chain of chains) {
  await hre.changeNetwork(chain);
  await hre.run("markov:deploy", { facets: "MyFacet" });
}
```

## Troubleshooting

### Common Issues

**"Diamond address not found"**
- Run `markov init` first to create a Diamond

**"History file not found"**
- Run `markov init` or `markov sync` to create/restore history

**"AI features not working"**
- Set `aiApiKey` in config
- Verify API key is valid

**"Agent won't start"**
- Check `mcpEndpoint` configuration
- Verify network connectivity

## Next Steps

- See `AGENT.md` for full specification
- Check `packages/plugin/src/tasks/markov/` for implementation details
- Review `.github/copilot-instructions.md` for development guidelines

## License

MIT
