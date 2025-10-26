import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { FacetCut } from "../types.js";
import chalk from "chalk";

/**
 * @deprecated This file is being refactored to use the new architecture:
 * 
 * NEW ARCHITECTURE:
 * 1. Blockscout MCP Client (src/utils/blockscout-client.ts) - For reading blockchain data
 * 2. Hardhat Ignition Modules (src/ignition/modules/) - For deploying contracts
 * 3. markov deploy command (src/tasks/markov/deploy.ts) - Central deployment command
 * 
 * Diamond cloning will work as follows:
 * - Use BlockscoutClient.readContract() to get facets from source Diamond
 * - Call hre.tasks.getTask("markov:deploy").run() to deploy on target chain
 * - Keep all deployment logic centralized in deploy.ts using Ignition
 * 
 * This keeps the codebase modular and follows Hardhat best practices.
 */

// Placeholder types until refactoring is complete
export interface FacetInfo {
  facetAddress: string;
  functionSelectors: string[];
}

export interface CloneConfig {
  sourceDiamond: string;
  sourceChain: string;
  targetChain: string;
}

export interface CloneResult {
  diamondAddress: string;
  facets: FacetInfo[];
  txHash: string;
}

/**
 * DiamondCloner class - To be refactored
 * @deprecated Use markov clone command directly
 */
export class DiamondCloner {
  constructor(private hre: HardhatRuntimeEnvironment) {
    console.log(chalk.yellow("\n⚠️  DiamondCloner is deprecated"));
    console.log(chalk.gray("   Use 'markov clone' command instead"));
    console.log(chalk.gray("   Deployment now handled by Hardhat Ignition\n"));
  }
}

/**
 * Factory function
 * @deprecated
 */
export function createDiamondCloner(hre: HardhatRuntimeEnvironment): DiamondCloner {
  return new DiamondCloner(hre);
}
