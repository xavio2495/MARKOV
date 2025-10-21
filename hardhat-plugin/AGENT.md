# Git-like Versioning for ERC-2535 Diamond Contracts

You are an expert TypeScript developer and Ethereum smart contract engineer specializing in Hardhat plugins and the ERC-2535 Diamond standard. Your task is to develop a complete Hardhat plugin called "markov" based on the following specifications. Use the Hardhat 3 plugin template as the starting point. Ensure the plugin is efficient, using a dynamic array combined with a hash map for single-branch version history management. Output the full code structure, including all necessary files, configurations, and implementations. Provide explanations where needed, but focus on delivering functional, testable code.

Use viem for all contract interactions, as Hardhat supports it via the `@nomicfoundation/hardhat-viem` plugin. Integrate this by adding it as a dependency and using `hre.viem` for clients and deployments.

## Project Overview
- **Aim**:
  1. Develop a Hardhat plugin that functions as a Git-like versioning system for smart contracts.
  2. Use ERC-2535 Diamond standard contracts to represent the "repository," where facets are modular code versions that can be added, replaced, or removed via `diamondCut`.
  3. Automate tasks similar to Git and GitHub, with version history stored off-chain in a local JSON file for quick access, verifiable via on-chain `DiamondCut` events.

- **Features (CLI Commands)**:
  1. `markov config`: Sets EVM chain, user wallet address, gas fees, and author details (updates `hardhat.config.ts` or a dedicated config file).
  2. `markov init`: Creates and deploys a new Diamond contract ERC-2535 structure in the repo.
  3. `markov clone`: Clones a Diamond contract from a source chain using a provided contract ID/address.
  4. `markov log`: Displays logs of contract updates, deployments, and status (from local history and on-chain events).
  5. `markov deploy`: Deploys new/updated facets, executes `diamondCut`, and logs the output.
  6. `markov reset`: Reverts to a previous contract state by executing a reverting `diamondCut`.
  7. `markov status`: Performs a health check on the deployed smart contract (e.g., via loupe facets).

- **Notes**:
  - Base the folder structure on the Hardhat 3 plugin template: `packages/plugin` for plugin code, `packages/example-project` for testing.
  - Persist version history in `.markov/history.json` using a linear array for commits (oldest at index 0) and a `Map<string, number>` for hash-to-index lookups.
  - Use viem via `hre.viem` for contract interactions (e.g., `hre.viem.deployContract`, `hre.viem.getWalletClient`).
  - Assume the Hardhat project has Solidity files for Diamond components (e.g., `Diamond.sol`, `DiamondCutFacet.sol`, `DiamondLoupeFacet.sol`, and custom facets).
  - Handle gas prices, signers, and network configurations from the plugin's extended config.

- **Links for Reference** (do not fetch new content; use knowledge of these):
  - Hardhat Plugin Development: https://hardhat.org/plugin-development
  - Tutorial: https://hardhat.org/plugin-development/tutorial
  - Network Connection: https://hardhat.org/plugin-development/tutorial/network-connection
  - Config: https://hardhat.org/plugin-development/tutorial/config
  - Tasks: https://hardhat.org/plugin-development/tutorial/task
  - Testing: https://hardhat.org/plugin-development/tutorial/testing
  - Next Steps: https://hardhat.org/plugin-development/tutorial/next-steps
  - Template Guide: https://hardhat.org/plugin-development/guides/hardhat3-plugin-template
  - Dependencies: https://hardhat.org/plugin-development/guides/dependencies
  - Publishing: https://hardhat.org/plugin-development/guides/publishing
  - Integration Tests: https://hardhat.org/plugin-development/guides/integration-tests
  - Plugin Object: https://hardhat.org/plugin-development/reference/hardhat-plugin-object
  - Hooks: https://hardhat.org/plugin-development/explanations/hooks
  - Type Extensions: https://hardhat.org/plugin-development/explanations/type-extensions
  - Peer Dependencies: https://hardhat.org/plugin-development/explanations/peer-dependencies

## Data Structure for Version Control
- Use a single-branch linear history.
- **Structure**:
  - Array of `Commit` objects: For sequential storage and O(1) index access.
  - Hash map (`Map<string, number>`) for O(1) lookups by commit hash.
- **Commit Interface**:
  ```typescript
  interface Commit {
    hash: string;  // SHA-256 of content
    timestamp: number;
    author: string;
    message: string;
    diamondAddress: string;
    cut: FacetCut[];  // { facetAddress: string, action: number, functionSelectors: string[] }
    parentHash?: string;
  }
  ```
- **FacetCut Enum**: `0 = Add, 1 = Replace, 2 = Remove`.
- Persist to JSON; load on task start, save after changes.
- Operations: Append (O(1)), get by hash (O(1)), log (O(n) traversal), reset (slice array).

## Step-by-Step Implementation Requirements
1. **Setup Repository (This step has already been completed by the user, as the current file structure matches )**:
   - Start from Hardhat 3 plugin template.
   - Rename to `@yourname/hardhat-markov`.
   - Install dependencies: `hardhat`, `@nomicfoundation/hardhat-viem`, `viem`, `fs-extra`, `crypto`.

2. **Extend Hardhat Config**:
   - Add `markov` config options: chain, wallet, gasPrice, author.
   - Validate and resolve defaults.
   - Use type extensions for `HardhatUserConfig` and `HardhatConfig`.

3. **Implement VersionHistory Class**:
   - In `src/history.ts`: Load/save from JSON, append commits with hashing, get by hash, get log, reset to hash.

4. **Add Tasks**:
   - Use subtask structure: `hardhat markov <subcommand>`.
   - Implement each feature as specified, using viem via `hre.viem` for deployments and interactions.
   - For `init`: Deploy DiamondCutFacet, Diamond, LoupeFacet; execute initial cut; append to history.
   - For `clone`: Query source Diamond via loupe, replicate deployments and cuts.
   - For `deploy`: Deploy new facets, compute selectors, execute cut, append commit.
   - For `reset`: Fetch commit, compute reverting cut, execute, update history.
   - Handle errors, log outputs.

5. **Testing**:
   - Add integration tests for tasks.
   - Use example project for manual verification.

6. **Publishing**:
   - Prepare for npm publish.

Output the complete code for key files (e.g., `src/index.ts`, `src/history.ts`, task files). Ensure it's production-ready, with proper error handling and TypeScript types. If any assumptions are made, note them.