# Branch Commands Reference

Complete reference for Markov branch management commands.

## Overview

Markov branches enable multi-chain Diamond contract development. Each branch can target a different blockchain network with its own Diamond instance, allowing parallel development across testnets and mainnets.

## Commands

### `markov branch create <name>`

Create a new branch with a different network configuration.

**Usage:**
```bash
npx hardhat markov branch create <branch-name>
```

**Interactive Workflow:**
1. **Network Selection**: Choose target network from hardhat.config or enter chain ID/name
2. **RPC Validation**: Validates connection to selected network
3. **Diamond Setup**: Three options:
   - Option 1: Enter existing Diamond address
   - Option 2: Deploy new Diamond (not yet implemented)
   - Option 3: Clone from current branch (prepares facet list)

**Examples:**
```bash
# Create dev branch on localhost
npx hardhat markov branch create dev

# Create staging branch on Sepolia
npx hardhat markov branch create staging

# Create production branch on mainnet
npx hardhat markov branch create production
```

**Features:**
- ✅ Multi-chain support (any network in hardhat.config)
- ✅ RPC connection validation
- ✅ Automatic network discovery via chain ID
- ✅ Auto-add networks to hardhat.config.ts
- ✅ Branch-specific config storage
- ✅ Initial commit creation
- ⏳ Automated Diamond deployment (planned)
- ⏳ Full Diamond cloning (planned)

**File Changes:**
- Creates `.markov/branches/<name>.json` with:
  - Branch config (chain, RPC, Diamond address, explorer)
  - Initial commit (empty cut)
  
**Example Branch File:**
```json
{
  "name": "dev",
  "config": {
    "name": "dev",
    "chain": "sepolia",
    "chainId": 11155111,
    "rpcUrl": "https://eth-sepolia.public.blastapi.io",
    "diamondAddress": "0x1234567890123456789012345678901234567890",
    "explorerUrl": "https://sepolia.etherscan.io",
    "createdAt": 1735689600000,
    "createdFrom": "main",
    "createdFromCommit": "a1b2c3d4"
  },
  "commits": [
    {
      "hash": "e5f6g7h8",
      "timestamp": 1735689600000,
      "author": "developer",
      "message": "Create branch 'dev' from 'main'",
      "diamondAddress": "0x1234567890123456789012345678901234567890",
      "cut": [],
      "parentHash": "a1b2c3d4",
      "branch": "dev"
    }
  ]
}
```

---

### `markov branch switch <name>`

Switch to a different branch and sync configuration.

**Usage:**
```bash
npx hardhat markov branch switch <branch-name>
```

**Examples:**
```bash
# Switch to dev branch
npx hardhat markov branch switch dev

# Switch back to main
npx hardhat markov branch switch main
```

**Behavior:**
- ✅ Validates branch exists
- ✅ Prevents switching to current branch
- ✅ Updates `.markov/HEAD` to new branch name
- ✅ Syncs `.markov/config.json` FROM target branch
- ✅ Displays commit count and latest commit info

**File Changes:**
- Updates `.markov/HEAD` with branch name
- Syncs `.markov/config.json` with branch's config:
  ```json
  {
    "Chain": "sepolia",
    "Wallet_Address": "0x...",
    "Author": "developer",
    "Gas_Price": 10000,
    "ASI_API_Key": "",
    "Governance_Address": "",
    "AGENTVERSE_API_TOKEN": "",
    "Auto_Sync": true
  }
  ```

**Config Sync Details:**
- Chain-specific settings preserved per branch
- Main branch → localhost config
- Dev branch → sepolia config  
- Production branch → mainnet config
- Enables context switching without manual reconfiguration

---

### `markov branch list`

List all branches with metadata.

**Usage:**
```bash
npx hardhat markov branch list
```

**Output:**
```
╔════════════════════════════════════════════════════════════════════╗
║                    Branch Management                               ║
╚════════════════════════════════════════════════════════════════════╝

Available branches:

* main
    Commits: 5 | Latest: a1b2c3d | Chain: localhost
  dev
    Commits: 3 | Latest: e5f6g7h | Chain: sepolia
  production
    Commits: 2 | Latest: i9j0k1l | Chain: mainnet
```

**Features:**
- ✅ Current branch marked with `*` (green)
- ✅ Shows commit count per branch
- ✅ Shows latest commit hash (short)
- ✅ Shows target chain for each branch
- ✅ Handles empty branch list gracefully

**Use Cases:**
- View all development environments
- Check which branch is active
- See commit history at a glance
- Identify branches by target network

---

### `markov branch delete <name>`

Delete a branch with safety checks.

**Usage:**
```bash
npx hardhat markov branch delete <branch-name>
```

**Examples:**
```bash
# Delete old feature branch
npx hardhat markov branch delete old-feature

# Attempt to delete current branch (will fail)
npx hardhat markov branch delete dev
```

**Safety Features:**
- ✅ Validates branch exists
- ✅ Prevents deleting current branch
- ✅ Requires explicit confirmation
- ✅ Shows commit count in warning
- ✅ Provides switch instructions if deleting current

**Interactive Confirmation:**
```
⚠️  Delete branch 'dev' with 3 commit(s)? This cannot be undone. (y/N):
```

**File Changes:**
- Removes `.markov/branches/<name>.json`
- Preserves all other branches
- No changes to current branch or config

**Error Messages:**
```
✗ Branch 'name' does not exist.

✗ Cannot delete the currently active branch 'dev'.
  Switch to another branch first using: npx hardhat markov branch switch <other-branch>
```

---

## Architecture

### Storage Structure
```
.markov/
├── config.json           # Active config (synced from current branch)
├── HEAD                  # Current branch name (e.g., "main")
├── .gitignore           # Ignore Diamond build artifacts
└── branches/
    ├── main.json        # Main branch (config + commits)
    ├── dev.json         # Dev branch (config + commits)
    └── production.json  # Production branch (config + commits)
```

### Branch File Schema
Each `branches/<name>.json` contains:
```typescript
{
  name: string;           // Branch name
  config: {              // Branch-specific config
    name: string;
    chain: string;       // Target blockchain
    chainId: number;     // Numeric chain ID
    rpcUrl: string;      // RPC endpoint
    diamondAddress: string;
    explorerUrl?: string;
    explorerApiKey?: string;
    createdAt: number;   // Timestamp
    createdFrom?: string;    // Parent branch
    createdFromCommit?: string;
  };
  commits: Commit[];     // Branch commit history
}
```

### Config Sync Flow

**On Branch Switch:**
1. User runs `markov branch switch dev`
2. Storage reads `branches/dev.json`
3. Extracts `config` object
4. Writes to `.markov/config.json`
5. Updates `HEAD` to "dev"
6. All subsequent commands use dev config

**On Config Update:**
1. User runs `markov config --set Chain sepolia`
2. Updates `.markov/config.json`
3. Syncs back to current branch file
4. Both files stay in sync

### Multi-Chain Workflow

**Typical Development Flow:**
```bash
# 1. Initialize on localhost
npx hardhat markov init

# 2. Create testnet branch
npx hardhat markov branch create sepolia
# → Select sepolia network
# → Enter testnet Diamond address

# 3. Switch to testnet
npx hardhat markov branch switch sepolia
# → Config now points to Sepolia

# 4. Deploy facets to testnet
npx hardhat markov deploy MyFacet
# → Deploys to Sepolia Diamond

# 5. Create production branch
npx hardhat markov branch create production
# → Select mainnet
# → Enter mainnet Diamond address

# 6. Switch to production
npx hardhat markov branch switch production
# → Config now points to mainnet

# 7. Deploy to production
npx hardhat markov deploy MyFacet
# → Deploys to mainnet Diamond

# 8. View all environments
npx hardhat markov branch list
```

**Benefits:**
- Separate Diamond instances per environment
- Independent commit history per branch
- Network-specific configurations
- Easy context switching
- Parallel development across chains

## Integration with Other Commands

### Deploy Command
```bash
npx hardhat markov branch switch sepolia
npx hardhat markov deploy DiamondCutFacet
# → Deploys to Diamond at current branch's address
# → Uses current branch's RPC URL
# → Records commit in sepolia branch
```

### Log Command
```bash
npx hardhat markov branch switch main
npx hardhat markov log
# → Shows commits from main branch only

npx hardhat markov branch switch dev
npx hardhat markov log
# → Shows commits from dev branch only
```

### Status Command
```bash
npx hardhat markov branch switch production
npx hardhat markov status
# → Queries production Diamond
# → Uses production RPC URL
# → Compares with production branch history
```

## Best Practices

### Naming Conventions
```bash
# Environment-based
main          # Production mainnet
staging       # Staging environment (testnet)
dev           # Development (localhost/testnet)

# Feature-based
feature-erc20    # ERC20 token integration
feature-staking  # Staking mechanism
bugfix-security  # Security fix

# Network-based
ethereum-mainnet
polygon-mainnet
arbitrum-testnet
sepolia-testing
```

### Branch Protection
- Keep `main` for production
- Use `dev` for active development
- Create feature branches for experiments
- Delete merged/abandoned branches
- Never delete current branch

### Configuration Management
- Each branch has independent config
- Config syncs automatically on switch
- Modify config per branch as needed
- Verify config after switching: `markov config --list`

### Multi-Chain Deployment
1. Create branch per network
2. Deploy Diamond on each network
3. Use branch switching for deployments
4. Track history independently
5. Merge strategies TBD (future work)

## Troubleshooting

### "Branch does not exist"
```bash
# List available branches
npx hardhat markov branch list

# Create if needed
npx hardhat markov branch create <name>
```

### "Cannot delete current branch"
```bash
# Switch to another branch first
npx hardhat markov branch switch main

# Then delete
npx hardhat markov branch delete <old-branch>
```

### "Network not found"
```bash
# Add to hardhat.config.ts
networks: {
  sepolia: {
    url: "https://eth-sepolia.public.blastapi.io",
    chainId: 11155111,
  }
}

# Or use chain ID (auto-adds network)
npx hardhat markov branch create test
# Enter: 11155111
# Confirms: "Add this network to hardhat.config.ts? (Y/n)"
```

### "RPC connection failed"
- Verify RPC URL is correct
- Check API key is valid
- Ensure network is reachable
- You can continue anyway (warning shown)

### Config not syncing
```bash
# Manually sync from branch
npx hardhat markov config --sync

# Or switch away and back
npx hardhat markov branch switch other
npx hardhat markov branch switch original
```

## Future Enhancements

### Planned Features
- [ ] Automated Diamond deployment (option 2)
- [ ] Full Diamond cloning across chains (option 3)
- [ ] Branch merging with conflict resolution
- [ ] Remote branch tracking (on-chain sync)
- [ ] Branch permissions/governance
- [ ] Multi-signature branch operations
- [ ] Branch comparison tools
- [ ] Visual branch tree (`markov viz`)

### Merge Strategy (Future)
```bash
# Create feature branch
npx hardhat markov branch create feature-upgrade

# Make changes
npx hardhat markov deploy NewFacet

# Merge back to main
npx hardhat markov branch switch main
npx hardhat markov merge feature-upgrade
# → Combines facet cuts
# → Resolves conflicts interactively
# → Creates merge commit
```

## Related Documentation

- [MARKOV-CLI.md](./MARKOV-CLI.md) - Full CLI reference
- [BRANCH_CREATE_IMPLEMENTATION.md](./BRANCH_CREATE_IMPLEMENTATION.md) - Implementation details
- [storage/history-storage.ts](../src/storage/history-storage.ts) - Storage layer
- [utils/branch-config.ts](../src/utils/branch-config.ts) - Config management
- [tasks/markov/branch.ts](../src/tasks/markov/branch.ts) - Command implementation

## Support

For issues or questions:
- GitHub: https://github.com/xavio2495/MARKOV
- Documentation: https://markov.mintlify.app/cli-reference/
