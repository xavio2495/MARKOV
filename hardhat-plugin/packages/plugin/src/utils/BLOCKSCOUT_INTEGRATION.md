# Blockscout Integration Plan for MARKOV Commands

## Overview

The `BlockscoutClient` provides blockchain data access for MARKOV's on-chain operations. This document outlines how each command will use Blockscout to interact with deployed Diamond contracts.

## Integration Map

### 1. `markov clone` - Clone On-Chain Diamond Contract

**Purpose:** Clone an existing Diamond contract from any supported chain into local MARKOV project.

**Blockscout Operations:**
1. **Verify Contract Exists**
   ```typescript
   const info = await blockscout.getAddressInfo(diamondAddress);
   if (!info.isContract) throw new Error("Address is not a contract");
   ```

2. **Get Diamond Facets**
   ```typescript
   const facets = await blockscout.getDiamondFacets(diamondAddress);
   // Returns: [{ facetAddress, functionSelectors[] }]
   ```

3. **Retrieve Facet Source Code** (if verified)
   ```typescript
   for (const facet of facets) {
     const code = await blockscout.inspectContractCode(facet.facetAddress);
     // Save to contracts/facets/<FacetName>.sol
   }
   ```

4. **Reconstruct History from DiamondCut Events**
   ```typescript
   const events = await blockscout.getDiamondCutEvents(diamondAddress);
   // Build commit history in DAG from events
   ```

**Workflow:**
```
1. User: npx hardhat markov clone 0x123... --network sepolia
2. Resolve chain ID from network config
3. Verify Diamond contract exists and is verified
4. Query current facet configuration via facets()
5. Download verified source code for each facet
6. Parse DiamondCut events to build version history
7. Initialize local .markov with reconstructed DAG
8. Save facet contracts to contracts/facets/
9. Create initial commit matching on-chain state
```

**Output Structure:**
```
.markov/
  ├── config.json          # Chain ID, Diamond address
  ├── history.json         # DAG with commits from events
  └── branches/
      └── main.json        # Points to latest on-chain state

contracts/
  ├── Diamond.sol          # Cloned Diamond (if verified)
  └── facets/
      ├── DiamondCutFacet.sol
      ├── DiamondLoupeFacet.sol
      └── CustomFacet.sol
```

---

### 2. `markov status` - Diamond Health Check

**Purpose:** Verify local state matches on-chain state.

**Blockscout Operations:**
1. **Get Current Facets**
   ```typescript
   const onChainFacets = await blockscout.getDiamondFacets(diamondAddress);
   ```

2. **Compare with Local State**
   ```typescript
   const localHead = dag.getCommit(dag.getHead("main"));
   const mismatch = compareFacets(onChainFacets, localHead.cut);
   ```

3. **Check Latest Block**
   ```typescript
   const block = await blockscout.getLatestBlock();
   console.log(`On-chain state at block ${block.number}`);
   ```

**Output:**
```
Diamond Status Check
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Chain:           Sepolia (11155111)
Diamond Address: 0x123...abc
Latest Block:    #5,234,567

✓ Local state matches on-chain
✓ 5 facets deployed
✓ All facets verified on Blockscout

Facets:
  • DiamondCutFacet    0x456...
  • DiamondLoupeFacet  0x789...
  • OwnershipFacet     0xabc...
```

---

### 3. `markov sync` - Sync with On-Chain Events

**Purpose:** Update local history with new on-chain DiamondCut events.

**Blockscout Operations:**
1. **Get Latest Local Block**
   ```typescript
   const lastSyncedBlock = getLastSyncedBlock(); // From config
   ```

2. **Fetch New DiamondCut Events**
   ```typescript
   const latestBlock = await blockscout.getLatestBlock();
   const newEvents = await blockscout.getDiamondCutEvents(
     diamondAddress,
     lastSyncedBlock + 1,
     latestBlock.number
   );
   ```

3. **Parse Events into Commits**
   ```typescript
   for (const event of newEvents) {
     const cut = parseFacetCutsFromEvent(event);
     const txSummary = await blockscout.getTransactionSummary(event.txHash);
     
     dag.addCommit(
       txSummary || `Diamond upgrade at block ${event.blockNumber}`,
       event.initAddress,
       diamondAddress,
       cut
     );
   }
   ```

4. **Update Sync Checkpoint**
   ```typescript
   config.lastSyncedBlock = latestBlock.number;
   ```

**Output:**
```
Syncing with chain...
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Found 3 new DiamondCut events

Block #5,234,100 (0x789abc...)
  → Added OwnershipFacet (0x123...)
  → 4 function selectors

Block #5,234,200 (0xdef456...)
  → Replaced DiamondCutFacet (0x456...)
  → 2 function selectors

Block #5,234,300 (0x789ghi...)
  → Removed deprecated selectors
  → 1 function selector

✓ 3 commits added to history
✓ Synced to block #5,234,567
```

---

### 4. `markov merge` - Merge with Conflict Detection

**Purpose:** Merge local branch with on-chain state before proposing.

**Blockscout Operations:**
1. **Get Current On-Chain State**
   ```typescript
   const onChainFacets = await blockscout.getDiamondFacets(diamondAddress);
   ```

2. **Detect Conflicts**
   ```typescript
   const localCuts = dag.getCommit(localBranch).cut;
   const conflicts = detectBlockchainConflicts(localCuts, onChainFacets);
   ```

3. **Verify Each Facet**
   ```typescript
   for (const cut of mergedCuts) {
     try {
       const info = await blockscout.getAddressInfo(cut.facetAddress);
       if (!info.isContract) throw new Error("Facet not deployed");
     } catch (error) {
       console.warn(`⚠ Facet ${cut.facetAddress} not found on-chain`);
     }
   }
   ```

---

### 5. `markov propose` - Submit to Governance

**Purpose:** Create governance proposal for Diamond upgrade.

**Blockscout Operations:**
1. **Verify Governance Contract**
   ```typescript
   const govInfo = await blockscout.getAddressInfo(governanceAddress);
   const govAbi = await blockscout.getContractAbi(governanceAddress);
   ```

2. **Estimate Proposal Cost**
   ```typescript
   const recentTxs = await blockscout.getTransactionsByAddress(
     governanceAddress,
     "7d"
   );
   const avgGas = calculateAverageGas(recentTxs);
   ```

3. **Get Current Proposal Count**
   ```typescript
   const proposalCount = await blockscout.readContract(
     governanceAddress,
     "proposalCount",
     []
   );
   ```

---

### 6. `markov stats` - Analytics Dashboard

**Purpose:** Display upgrade statistics and gas analysis.

**Blockscout Operations:**
1. **Get All Diamond Transactions**
   ```typescript
   const txs = await blockscout.getTransactionsByAddress(
     diamondAddress,
     "30d"
   );
   ```

2. **Analyze Gas Usage**
   ```typescript
   const diamondCutTxs = txs.filter(tx => tx.method === "diamondCut");
   const totalGas = diamondCutTxs.reduce((sum, tx) => 
     sum + BigInt(tx.gasUsed || "0"), 0n
   );
   ```

3. **Get Upgrade Timeline**
   ```typescript
   const events = await blockscout.getDiamondCutEvents(diamondAddress);
   const timeline = events.map(e => ({
     block: e.blockNumber,
     date: new Date(e.timestamp * 1000),
     facetsChanged: e.facetCuts.length
   }));
   ```

**Output:**
```
Diamond Statistics
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Contract: 0x123...abc (Sepolia)

Upgrade History (Last 30 days):
  • Total Upgrades:     8
  • Facets Added:       5
  • Facets Replaced:    3
  • Facets Removed:     1
  • Total Gas Used:     2,450,000

Recent Activity:
  2025-10-24  Block #5,234,567  +2 facets
  2025-10-20  Block #5,230,100  replaced 1 facet
  2025-10-15  Block #5,225,000  -1 facet

Gas Analysis:
  • Average per upgrade: 306,250 gas
  • Peak usage:          450,000 gas
  • Most efficient:      180,000 gas
```

---

### 7. `markov reset` - Revert to Previous State

**Purpose:** Generate reverting diamondCut to undo upgrades.

**Blockscout Operations:**
1. **Get Historical State**
   ```typescript
   const targetCommit = dag.getCommit(commitHash);
   const targetBlock = targetCommit.blockNumber;
   
   const historicalState = await blockscout.getDiamondCutEvents(
     diamondAddress,
     0,
     targetBlock
   );
   ```

2. **Calculate Reverting Cut**
   ```typescript
   const currentFacets = await blockscout.getDiamondFacets(diamondAddress);
   const targetFacets = reconstructFacetsAtBlock(historicalState, targetBlock);
   const revertingCut = calculateRevertingCut(currentFacets, targetFacets);
   ```

3. **Verify Historical Facets Still Exist**
   ```typescript
   for (const facet of targetFacets) {
     const info = await blockscout.getAddressInfo(facet.facetAddress);
     if (!info.isContract) {
       throw new Error(
         `Cannot revert: Historical facet ${facet.facetAddress} no longer exists`
       );
     }
   }
   ```

---

## Error Handling

### Common Scenarios

1. **Unverified Contracts**
   ```typescript
   try {
     await blockscout.inspectContractCode(address);
   } catch (error) {
     console.warn(`⚠ Contract ${address} is not verified`);
     console.log("   Clone will proceed with ABI only");
   }
   ```

2. **Network Connectivity**
   ```typescript
   try {
     await blockscout.getLatestBlock();
   } catch (error) {
     throw new Error(
       `Cannot connect to Blockscout for chain ${chainId}. ` +
       `Check network configuration.`
     );
   }
   ```

3. **Rate Limiting**
   ```typescript
   // Implement exponential backoff
   async function fetchWithRetry(fn: () => Promise<any>, retries = 3) {
     for (let i = 0; i < retries; i++) {
       try {
         return await fn();
       } catch (error) {
         if (i === retries - 1) throw error;
         await sleep(Math.pow(2, i) * 1000);
       }
     }
   }
   ```

---

## Chain Configuration

### Supported Networks

The Blockscout client supports 50+ EVM chains. Users specify chains via Hardhat network config:

```typescript
// hardhat.config.ts
networks: {
  sepolia: {
    url: "https://rpc.sepolia.org",
    chainId: 11155111,
  },
  polygon: {
    url: "https://polygon-rpc.com",
    chainId: 137,
  }
}
```

### Chain ID Resolution

```typescript
function getChainIdFromNetwork(networkName: string, hre: HRE): number {
  const network = hre.config.networks[networkName];
  if (!network || !network.chainId) {
    throw new Error(`Network ${networkName} not configured`);
  }
  return network.chainId;
}
```

---

## Next Steps for `markov clone`

1. **Implement Clone Command** (`src/tasks/markov/clone.ts`)
   - Parse command arguments (address, network)
   - Initialize Blockscout client with chain ID
   - Verify Diamond contract
   - Download facet data
   - Reconstruct history from events
   - Save to local .markov structure

2. **Add Event Parser** (`src/utils/event-parser.ts`)
   - Decode DiamondCut events
   - Convert event data to FacetCut objects
   - Handle different Diamond implementations

3. **Create Contract Downloader** (`src/utils/contract-downloader.ts`)
   - Download verified source code
   - Organize into contracts/ directory
   - Handle multi-file contracts
   - Generate appropriate file structure

4. **Integrate with DAG** (`src/utils/history.ts`)
   - Build commit graph from events
   - Calculate commit hashes
   - Maintain chronological order
   - Handle forks and merges

Ready to implement `markov clone` next!
