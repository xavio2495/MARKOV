# Markov Plugin Architecture - Viem via Ignition & Blockscout MCP

## Executive Summary

Based on your feedback, the Markov plugin architecture has been redesigned to:

1. **Use Hardhat Toolbox Viem** - Leverage `@nomicfoundation/hardhat-toolbox-viem` for all viem functionality
2. **Centralize Deployment in `markov deploy`** - All contract deployments use Hardhat Ignition modules
3. **Use Blockscout MCP for Reading** - All blockchain reads use Model Context Protocol
4. **Modular Design** - Other commands call `deploy` internally rather than duplicating logic

## Key Architectural Decisions

###  1. **Viem Only in Deploy Command**

```typescript
// ❌ OLD: Direct viem usage in multiple files
import { createPublicClient, createWalletClient } from "viem";

// ✅ NEW: Viem only accessed via hre.viem in deploy.ts
const client = await hre.viem.getWalletClient();
const deployment = await hre.ignition.deploy(DiamondModule);
```

**Rationale:**
- Hardhat Ignition handles deployment lifecycle (builds, deploys, verifies)
- `hre.viem` provided by toolbox eliminates manual client setup
- Centralized deployment logic is easier to test and maintain

### 2. **Blockscout MCP for All Reads**

```typescript
// ❌ OLD: Direct viem for reading facets
const facets = await publicClient.readContract({
  address: diamondAddress,
  abi: DIAMOND_LOUPE_ABI,
  functionName: "facets"
});

// ✅ NEW: Blockscout MCP read_contract tool
const facets = await blockscout.readContract({
  chain_id: chainId,
  address: diamondAddress,
  method: "facets",
  args: []
});
```

**Rationale:**
- Multi-chain support (50+ EVMs) without managing RPCs
- Unified interface for all blockchain reads
- Verified contract ABIs automatically fetched
- Better error handling and retries built-in

### 3. **markov clone Already Implements This!**

Your `clone.ts` is already perfectly aligned with this architecture:
- Uses BlockscoutClient for all reads ✅
- Fetches implementations and source code via MCP ✅
- Downloads verified contract sources ✅
- **Only missing:** Calling `markov deploy` for target chain deployment

## New File Structure

```
packages/plugin/
├── src/
│   ├── ignition/                    # NEW: Hardhat Ignition modules
│   │   ├── modules/
│   │   │   ├── DiamondModule.ts     # Deploy Diamond contract
│   │   │   ├── FacetModule.ts       # Deploy individual facets
│   │   │   └── DiamondCutModule.ts  # Execute diamondCut after facet deployment
│   │   └── index.ts
│   │
│   ├── utils/
│   │   ├── blockscout.ts            # ✅ ALREADY EXISTS (used in clone.ts)
│   │   ├── blockscout-client.ts     # NEW: MCP wrapper (optional enhancement)
│   │   ├── branch-config.ts         # ✅ Already done (multi-chain config)
│   │   └── diamond-clone.ts         # ⚠️ DEPRECATED (use clone task instead)
│   │
│   ├── storage/
│   │   └── history-storage.ts       # ✅ Already done (file + MongoDB ready)
│   │
│   └── tasks/markov/
│       ├── deploy.ts                # 🔄 REFACTOR: Use Ignition
│       ├── clone.ts                 # ✅ ALMOST PERFECT: Add deploy call
│       ├── branch.ts                # 🔄 REFACTOR: Call clone + deploy
│       ├── sync.ts                  # 🔄 Use Blockscout for DiamondCut events
│       └── reset.ts                 # 🔄 Use deploy for reverting facets
```

## Command Workflows

### `markov deploy` (Core Deployment Command)

**Purpose:** Deploy facets and execute diamondCut using Hardhat Ignition

```typescript
// packages/plugin/src/tasks/markov/deploy.ts
export default async function markovDeploy(args, hre) {
  // 1. Parse facet names from args
  const facetNames = args.facets.split(',');
  
  // 2. Deploy facets using Ignition
  const deployments = await Promise.all(
    facetNames.map(name => 
      hre.ignition.deploy(buildFacetModule(name))
    )
  );
  
  // 3. Compute function selectors from ABIs
  const cuts = deployments.map(dep => ({
    facetAddress: dep.address,
    action: 0, // Add
    functionSelectors: computeSelectors(dep.abi)
  }));
  
  // 4. Execute diamondCut via Ignition
  await hre.ignition.deploy(DiamondCutModule, {
    parameters: { cuts, diamond: currentDiamondAddress }
  });
  
  // 5. Record commit in history
  await storage.addCommit(branchName, {
    hash: generateHash(cuts),
    message: args.message,
    cut: cuts,
    // ...
  });
}
```

**Key Features:**
- Uses `hre.ignition.deploy()` for all deployments
- Automatic gas estimation and transaction management
- Built-in deployment verification
- Idempotent (can re-run safely)

### `markov clone` (Already Excellent!)

**Current Flow:**
```typescript
// ✅ Already uses Blockscout MCP
const addressInfo = await blockscout.getAddressInfo(diamondAddress);
const implementations = await blockscout.getImplementations(diamondAddress);
const contractCode = await blockscout.inspectContractCode(facetAddress);

// ✅ Downloads source code
await downloadAllDeployments(implementations);

// ❌ Missing: Deploy to target chain
```

**Enhanced Flow:**
```typescript
// Add after source code download:
if (targetChain) {
  console.log(chalk.blue("\nDeploying to target chain..."));
  
  // Call markov deploy for each facet
  await hre.tasks.getTask("markov:deploy").run({
    facets: facetNames.join(','),
    message: `Clone from ${sourceChain}`,
    network: targetChain // Pass target network
  });
}
```

### `markov branch create` (Simplified)

**Old Flow (Complex):**
```typescript
// 1. Prompt for network
// 2. Prompt for Diamond address or clone
// 3. Read facets with viem
// 4. Manual deployment prompts
// 5. Create branch config
```

**New Flow (Simple):**
```typescript
export default async function branchCreate(args, hre) {
  // 1. Get current branch
  const currentBranch = await storage.getCurrentBranch();
  
  // 2. Prompt for target network
  const targetChain = await promptForNetwork();
  
  // 3. Clone Diamond to target chain
  await hre.tasks.getTask("markov:clone").run({
    address: currentBranch.config.diamondAddress,
    sourceNetwork: currentBranch.config.chain,
    targetNetwork: targetChain,
    deploy: true // NEW: Triggers deployment on target
  });
  
  // 4. Create branch configuration
  const branchConfig = {
    name: args.name,
    chain: targetChain,
    diamondAddress: cloneResult.diamondAddress,
    // ... other config
  };
  
  await storage.createBranch(branchConfig);
}
```

**Benefits:**
- Reuses `clone` logic (DRY principle)
- Automatic deployment via Ignition
- Single source of truth for deployment logic

### `markov sync` (Blockscout MCP)

```typescript
export default async function markovSync(args, hre) {
  const branch = await storage.getCurrentBranch();
  const blockscout = new BlockscoutClient(branch.config.chainId);
  
  // Get DiamondCut events via MCP
  const logs = await blockscout.getTransactionLogs({
    address: branch.config.diamondAddress,
    event: "DiamondCut"
  });
  
  // Reconstruct history from events
  for (const log of logs) {
    const commit = parseEventToCommit(log);
    await storage.addCommit(branch.name, commit);
  }
}
```

## Ignition Modules

### DiamondModule.ts
```typescript
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("DiamondModule", (m) => {
  // Deploy DiamondCutFacet
  const diamondCutFacet = m.contract("DiamondCutFacet");
  
  // Deploy DiamondLoupeFacet
  const diamondLoupeFacet = m.contract("DiamondLoupeFacet");
  
  // Deploy OwnershipFacet
  const ownershipFacet = m.contract("OwnershipFacet");
  
  // Compute initial cuts
  const cuts = [
    {
      facetAddress: m.getAddress(diamondCutFacet),
      action: 0,
      functionSelectors: m.call(diamondCutFacet, "selectors")
    },
    // ... other facets
  ];
  
  // Deploy Diamond with initial cuts
  const diamond = m.contract("Diamond", [cuts]);
  
  return { diamond, diamondCutFacet, diamondLoupeFacet, ownershipFacet };
});
```

### FacetModule.ts (Dynamic)
```typescript
export function buildFacetModule(facetName: string) {
  return buildModule(`${facetName}Module`, (m) => {
    const facet = m.contract(facetName);
    return { facet };
  });
}
```

### DiamondCutModule.ts
```typescript
export default buildModule("DiamondCutModule", (m) => {
  const diamond = m.getParameter("diamond");
  const cuts = m.getParameter("cuts");
  
  // Execute diamondCut
  m.call(diamond, "diamondCut", [cuts, "0x0", "0x"]);
  
  return { diamond };
});
```

## Migration Path

### Phase 1: Update Dependencies ✅
```bash
# Already done in package.json
pnpm add @nomicfoundation/hardhat-toolbox-viem
pnpm add @modelcontextprotocol/sdk
```

### Phase 2: Create Ignition Modules
```bash
# Create module directory structure
mkdir -p src/ignition/modules

# Create basic modules
touch src/ignition/modules/DiamondModule.ts
touch src/ignition/modules/FacetModule.ts
touch src/ignition/modules/DiamondCutModule.ts
```

### Phase 3: Refactor Deploy Command
- Update `deploy.ts` to use Ignition
- Add function selector computation
- Integrate with history storage

### Phase 4: Enhance Clone Command
- Add optional `--deploy` flag
- Call `markov:deploy` when deploying to target
- Return deployed Diamond address

### Phase 5: Simplify Branch Create
- Remove manual Diamond prompts
- Call `clone` with `--deploy` flag
- Simplify user experience

### Phase 6: Update Other Commands
- `sync`: Use Blockscout for event logs
- `reset`: Use `deploy` for reverting
- `status`: Use Blockscout for health checks

## Benefits of New Architecture

### 1. **Modularity**
- Single deployment command used by all features
- Easy to test in isolation
- Clear separation of concerns

### 2. **Maintainability**
- Less code duplication
- Centralized error handling
- Consistent behavior across commands

### 3. **Best Practices**
- Follows Hardhat conventions
- Leverages Ignition's advanced features
- Uses official toolbox plugins

### 4. **Multi-Chain Support**
- Blockscout MCP: 50+ chains
- No manual RPC management
- Automatic chain resolution

### 5. **Developer Experience**
- Ignition provides deployment UI
- Automatic gas estimation
- Transaction retry logic
- Deployment verification

## What You Already Have

✅ **Excellent Clone Command**
- Already uses Blockscout MCP
- Downloads verified sources
- Handles bulk cloning
- Just needs deploy integration

✅ **History Storage**
- File-based with MongoDB abstraction
- Branch management
- Commit indexing

✅ **Branch Configuration**
- Multi-chain support
- Network resolution
- RPC validation

## What Needs Building

🔄 **Ignition Modules** (3 files, ~150 lines total)
- DiamondModule
- FacetModule
- DiamondCutModule

🔄 **Deploy Command** (~200 lines)
- Use Ignition for deployment
- Compute selectors
- Execute diamondCut
- Record commits

🔄 **Minor Updates** (~50 lines total)
- Add `--deploy` flag to clone
- Simplify branch create
- Update sync to use Blockscout events

## Timeline Estimate

- **Ignition Modules**: 2-3 hours
- **Deploy Refactor**: 3-4 hours
- **Clone Enhancement**: 1 hour
- **Branch Simplification**: 1 hour
- **Testing**: 2-3 hours

**Total**: ~10-12 hours for full implementation

## Next Immediate Steps

1. **Review this architecture** - Confirm it matches your vision
2. **Create Ignition modules** - Start with DiamondModule
3. **Refactor deploy.ts** - Use Ignition + compute selectors
4. **Test basic deployment** - Verify Ignition works
5. **Integrate with clone** - Add deployment to target chain
6. **Update branch create** - Simplify to call clone

Would you like me to proceed with implementing the Ignition modules first?
