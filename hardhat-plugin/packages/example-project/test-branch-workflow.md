# Branch Command Testing Workflow

This document provides a step-by-step testing procedure for all branch commands.

## Prerequisites

1. Build the plugin:
   ```powershell
   cd d:\MARKOV\hardhat-plugin\packages\plugin
   pnpm build
   ```

2. Ensure example project has multiple networks configured in `hardhat.config.ts`:
   ```typescript
   networks: {
     localhost: {
       url: "http://127.0.0.1:8545",
       chainId: 31337,
     },
     sepolia: {
       url: process.env.SEPOLIA_RPC_URL || "https://eth-sepolia.public.blastapi.io",
       chainId: 11155111,
     },
   }
   ```

## Test Sequence

### 1. Initialize Project
```powershell
cd d:\MARKOV\hardhat-plugin\packages\example-project
pnpm hardhat markov init
```

**Expected Output:**
- Creates `.markov/` directory
- Creates `main` branch file
- Creates `.markov/config.json`
- Creates `.markov/HEAD` with "main"

**Verify:**
```powershell
cat .markov/HEAD
cat .markov/config.json
cat .markov/branches/main.json
```

### 2. List Branches (Initial State)
```powershell
pnpm hardhat markov branch list
```

**Expected Output:**
```
╔════════════════════════════════════════════════════════════════════╗
║                    Branch Management                               ║
╚════════════════════════════════════════════════════════════════════╝

Available branches:

* main
    Commits: 1 | Latest: <hash> | Chain: localhost
```

### 3. Create Development Branch
```powershell
pnpm hardhat markov branch create dev
```

**Interactive Prompts:**
1. Network selection: Enter `localhost` or `1`
2. Diamond setup: Select option `1` (existing address)
3. Enter Diamond address: `0x1234567890123456789012345678901234567890`

**Expected Output:**
- Branch 'dev' created successfully
- Shows branch details (chain, diamond, created from)
- Suggests switch command

**Verify:**
```powershell
cat .markov/branches/dev.json
```

Should contain:
- `name: "dev"`
- `config.chain: "localhost"`
- `config.diamondAddress: "0x1234..."`
- `commits: [...]` with initial commit

### 4. Create Sepolia Branch
```powershell
pnpm hardhat markov branch create sepolia-test
```

**Interactive Prompts:**
1. Network selection: Enter `sepolia` or `2`
2. Diamond setup: Select option `1`
3. Enter Diamond address: `0xabcdefabcdefabcdefabcdefabcdefabcdefabcd`

**Expected Output:**
- Branch created on sepolia network
- Different chain ID and RPC URL in config

### 5. List All Branches
```powershell
pnpm hardhat markov branch list
```

**Expected Output:**
```
Available branches:

* main
    Commits: 1 | Latest: <hash> | Chain: localhost
  dev
    Commits: 1 | Latest: <hash> | Chain: localhost
  sepolia-test
    Commits: 1 | Latest: <hash> | Chain: sepolia
```

**Verify:**
- Current branch (main) marked with `*`
- All 3 branches listed
- Correct chain names

### 6. Switch to Dev Branch
```powershell
pnpm hardhat markov branch switch dev
```

**Expected Output:**
```
✓ Switched to branch 'dev'
  Commits: 1
  Latest: <hash>
  Chain: localhost
```

**Verify Config Sync:**
```powershell
cat .markov/HEAD
# Should show: dev

cat .markov/config.json
# Should match dev branch config (localhost, dev's diamond address)
```

### 7. List Branches After Switch
```powershell
pnpm hardhat markov branch list
```

**Expected Output:**
- Current branch indicator `*` now on `dev`
- Main no longer marked as current

### 8. Switch to Sepolia Branch
```powershell
pnpm hardhat markov branch switch sepolia-test
```

**Verify Config Sync:**
```powershell
cat .markov/config.json
# Should now show sepolia chain and sepolia's diamond address
```

### 9. Try to Delete Current Branch (Should Fail)
```powershell
pnpm hardhat markov branch delete sepolia-test
```

**Expected Output:**
```
✗ Cannot delete the currently active branch 'sepolia-test'.
  Switch to another branch first using: npx hardhat markov branch switch <other-branch>
```

### 10. Switch to Main and Delete Dev Branch
```powershell
pnpm hardhat markov branch switch main
pnpm hardhat markov branch delete dev
```

**Interactive Prompt:**
- Confirmation: "Delete branch 'dev' with 1 commit(s)? This cannot be undone. (y/N):"
- Enter: `y`

**Expected Output:**
```
✓ Branch 'dev' deleted successfully.
```

**Verify:**
```powershell
pnpm hardhat markov branch list
# Should only show main and sepolia-test

ls .markov/branches/
# dev.json should be gone
```

### 11. Try to Delete Non-Existent Branch
```powershell
pnpm hardhat markov branch delete nonexistent
```

**Expected Output:**
```
✗ Branch 'nonexistent' does not exist.
```

### 12. Test Config Sync Persistence
```powershell
# On main branch
pnpm hardhat markov config --get Chain
# Should show: localhost (or whatever main is configured to)

pnpm hardhat markov branch switch sepolia-test
pnpm hardhat markov config --get Chain
# Should show: sepolia

pnpm hardhat markov branch switch main
pnpm hardhat markov config --get Chain
# Should show: localhost again
```

## Test Results Checklist

- [ ] `markov init` creates proper structure
- [ ] `markov branch list` shows all branches with current indicator
- [ ] `markov branch create` creates branch with proper config
- [ ] `markov branch create` validates network exists
- [ ] `markov branch create` validates Diamond address format
- [ ] `markov branch switch` updates HEAD pointer
- [ ] `markov branch switch` syncs config to `.markov/config.json`
- [ ] `markov branch switch` prevents switching to current branch
- [ ] `markov branch delete` prevents deleting current branch
- [ ] `markov branch delete` requires confirmation
- [ ] `markov branch delete` removes branch file
- [ ] Config sync maintains branch-specific settings
- [ ] All commands display proper headers and formatting

## Advanced Tests

### Test RPC Validation
```powershell
# Edit hardhat.config.ts to add a network with invalid RPC
networks: {
  invalid: {
    url: "http://invalid-rpc-url:9999",
    chainId: 99999,
  }
}

pnpm hardhat markov branch create test-invalid
# Select 'invalid' network
# Should warn: "Cannot connect to RPC"
# Should ask: "Continue anyway?"
```

### Test Network Auto-Add
```powershell
pnpm hardhat markov branch create polygon-test
# Enter: "137" (Polygon chain ID)
# Should find Polygon via network-resolver
# Should offer to add to hardhat.config.ts
# Select: Y
# Should add Polygon network config
```

### Test Clone Option
```powershell
pnpm hardhat markov branch create clone-test
# Select option 3 (clone from current branch)
# Should show: "Diamond cloning via 'markov clone' not yet integrated"
# Should provide recommended workflow
# Should still allow entering target address
```

## Cleanup
```powershell
# Remove test branches
pnpm hardhat markov branch switch main
pnpm hardhat markov branch delete sepolia-test

# Or remove entire .markov directory to start fresh
rm -r .markov
```

## Notes

- All branch files are self-contained with embedded config
- `.markov/config.json` is synced FROM current branch on switch
- HEAD file contains only the branch name
- Commits array in each branch file tracks that branch's history
- Branch names are stored in `.markov/branches/<name>.json` filenames
