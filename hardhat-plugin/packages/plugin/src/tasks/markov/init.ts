import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskArguments } from "hardhat/types/tasks";
import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";
import chalk from "chalk";
import * as readline from "readline/promises";

interface MarkovInitArguments extends TaskArguments {
  name: string;
  force?: boolean;
}

/**
 * Initialize a new Diamond contract in the repository.
 * Creates contracts directory structure and .markov folder for version tracking.
 * 
 * NEW SIMPLIFIED ARCHITECTURE:
 * - Only creates .markov/, branches/, and .gitignore
 * - No commits folder, history.json, or HEAD file
 * - Prompts user to run config command after initialization
 */
export default async function markovInit(
  taskArguments: TaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  const args = taskArguments as MarkovInitArguments;
  const diamondName = args.name || "Diamond";
  
  console.log(chalk.blue("\n╔════════════════════════════════════════════════════════════════════╗"));
  console.log(chalk.blue("║") + chalk.cyan.bold("              Initializing MARKOV Diamond Project                   ") + chalk.blue("║"));
  console.log(chalk.blue("╚════════════════════════════════════════════════════════════════════╝\n"));
  
  console.log(chalk.yellow("Diamond Name:"), chalk.white(diamondName));
  console.log(chalk.yellow("Project Root:"), chalk.white(hre.config.paths.root));
  console.log();

  try {
    // Check if project is already initialized
    const alreadyInitialized = await checkIfInitialized(hre.config.paths.root);
    
    if (alreadyInitialized && !args.force) {
      console.log(chalk.yellow("Warning: MARKOV project already initialized!\n"));
      console.log(chalk.gray("   Found existing:"));
      if (alreadyInitialized.markov) {
        console.log(chalk.gray("   ✓ .markov/ directory"));
      }
      if (alreadyInitialized.contracts) {
        console.log(chalk.gray("   ✓ contracts/ directory with Diamond files"));
      }
      console.log();
      
      const shouldContinue = await promptUser(
        chalk.yellow("   Do you want to reinitialize? This will overwrite existing files. (y/N): ")
      );
      
      if (!shouldContinue) {
        console.log(chalk.blue("\nInitialization cancelled.\n"));
        console.log(chalk.cyan("To force reinitialization, use:"), chalk.green("npx hardhat markov init --force"));
        console.log();
        return;
      }
      
      console.log(chalk.yellow("\nProceeding with reinitialization...\n"));
    }
    
    // Step 1: Create contracts directory structure
    await createContractsStructure(hre.config.paths.root, diamondName);
    
    // Step 2: Create .markov directory (simplified - no commits, history.json, or HEAD)
    await createMarkovDirectory(hre.config.paths.root);
    
    console.log(chalk.green("\n✓ Initialization complete!\n"));
    console.log(chalk.cyan("Next steps:"));
    console.log(chalk.white("  1. Configure Markov settings:"), chalk.green("npx hardhat markov config"));
    console.log(chalk.white("  2. Review the generated Diamond contracts in"), chalk.yellow("contracts/"));
    console.log(chalk.white("  3. Customize your facets in"), chalk.yellow("contracts/facets/"));
    console.log(chalk.white("  4. Deploy your Diamond:"), chalk.green(`npx hardhat markov deploy`));
    console.log();
    
    // Prompt user to run config command
    const shouldRunConfig = await promptUser(
      chalk.cyan("\nWould you like to configure Markov settings now? (Y/n): ")
    );
    
    if (shouldRunConfig) {
      console.log(chalk.blue("\nLaunching configuration wizard...\n"));
      // Run config command
      await hre.tasks.getTask("markov:config").run({});
    } else {
      console.log(chalk.yellow("\nPlease run"), chalk.green("npx hardhat markov config"), chalk.yellow("to configure your settings before deploying.\n"));
    }
    
  } catch (error) {
    console.error(chalk.red("\nInitialization failed:"), error instanceof Error ? error.message : error);
      console.error(error);
    throw error;
  }
}

/**
 * Check if the project is already initialized
 */
async function checkIfInitialized(rootPath: string): Promise<{
  markov: boolean;
  contracts: boolean;
} | null> {
  const markovPath = path.join(rootPath, ".markov");
  const contractsPath = path.join(rootPath, "contracts");
  const configPath = path.join(markovPath, "config.json");
  const diamondFiles = existsSync(contractsPath) ? await fs.readdir(contractsPath).catch(() => []) : [];
  
  const markovExists = existsSync(markovPath) && existsSync(configPath);
  const contractsExist = diamondFiles.some(file => 
    file.endsWith("Diamond.sol") || 
    file === "interfaces" || 
    file === "libraries" || 
    file === "facets"
  );
  
  if (markovExists || contractsExist) {
    return {
      markov: markovExists,
      contracts: contractsExist,
    };
  }
  
  return null;
}

/**
 * Prompt user for confirmation
 * Returns true for "yes" (default for empty input in Y/n prompts)
 */
async function promptUser(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(question);
    rl.close();
    
    // If question ends with (Y/n), default to yes on empty input
    if (question.includes("(Y/n)")) {
      return answer.trim() === '' || answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
    }
    
    // Otherwise, require explicit yes
    return answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
  } catch (error) {
    rl.close();
    return false;
  }
}

/**
 * Create the contracts directory structure with Diamond template
 */
async function createContractsStructure(rootPath: string, diamondName: string): Promise<void> {
  console.log(chalk.cyan("Step 1:"), chalk.white("Creating contracts directory structure..."));
  
  const contractsPath = path.join(rootPath, "contracts");
  const interfacesPath = path.join(contractsPath, "interfaces");
  const librariesPath = path.join(contractsPath, "libraries");
  const facetsPath = path.join(contractsPath, "facets");
  
  // Create directories
  await fs.mkdir(contractsPath, { recursive: true });
  await fs.mkdir(interfacesPath, { recursive: true });
  await fs.mkdir(librariesPath, { recursive: true });
  await fs.mkdir(facetsPath, { recursive: true });
  
  console.log(chalk.gray("   ├─ contracts/"));
  console.log(chalk.gray("   ├─ contracts/interfaces/"));
  console.log(chalk.gray("   ├─ contracts/libraries/"));
  console.log(chalk.gray("   └─ contracts/facets/"));
  
  // Copy template files from EIP-2535 folder
  const templatePath = path.resolve(import.meta.dirname, "../../../..", "EIP-2535");
  
  // Check if template exists, if not use the workspace root template
  let sourcePath = templatePath;
  if (!existsSync(templatePath)) {
    sourcePath = path.resolve(rootPath, "../..", "EIP-2535");
  }
  
  if (!existsSync(sourcePath)) {
    throw new Error(`Template directory not found. Expected at: ${sourcePath}`);
  }
  
  console.log(chalk.cyan("   Copying Diamond template files..."));
  
  // Copy Diamond.sol (with custom name)
  const diamondTemplate = await fs.readFile(path.join(sourcePath, "contracts/Diamond.sol"), "utf-8");
  const customDiamond = diamondTemplate.replace(/contract Diamond/g, `contract ${diamondName}`);
  await fs.writeFile(path.join(contractsPath, `${diamondName}.sol`), customDiamond);
  console.log(chalk.green("   ✓"), chalk.white(`${diamondName}.sol`));
  
  // Copy interfaces
  const interfaces = ["IDiamondCut.sol", "IDiamondLoupe.sol", "IERC165.sol", "IERC173.sol"];
  for (const iface of interfaces) {
    const content = await fs.readFile(path.join(sourcePath, "contracts/interfaces", iface), "utf-8");
    await fs.writeFile(path.join(interfacesPath, iface), content);
    console.log(chalk.green("   ✓"), chalk.white(`interfaces/${iface}`));
  }
  
  // Copy LibDiamond.sol
  const libDiamond = await fs.readFile(path.join(sourcePath, "contracts/libraries/LibDiamond.sol"), "utf-8");
  await fs.writeFile(path.join(librariesPath, "LibDiamond.sol"), libDiamond);
  console.log(chalk.green("   ✓"), chalk.white("libraries/LibDiamond.sol"));
  
  // Create initial facets (from EIP2535-Diamonds-Reference-Implementation if available)
  await createInitialFacets(rootPath, facetsPath);
  
  console.log(chalk.green("   ✓ Contracts structure created\n"));
}

/**
 * Create initial facets (DiamondCutFacet, DiamondLoupeFacet, OwnershipFacet)
 */
async function createInitialFacets(rootPath: string, facetsPath: string): Promise<void> {
  const referencePath = path.resolve(rootPath, "../..", "EIP2535-Diamonds-Reference-Implementation/contracts/facets");
  
  const facets = ["DiamondCutFacet.sol", "DiamondLoupeFacet.sol", "OwnershipFacet.sol"];
  
  if (existsSync(referencePath)) {
    for (const facet of facets) {
      const facetPath = path.join(referencePath, facet);
      if (existsSync(facetPath)) {
        const content = await fs.readFile(facetPath, "utf-8");
        await fs.writeFile(path.join(facetsPath, facet), content);
        console.log(chalk.green("   ✓"), chalk.white(`facets/${facet}`));
      }
    }
  } else {
    // Create minimal facet stubs if reference implementation not available
    await createMinimalFacets(facetsPath);
  }
}

/**
 * Create minimal facet stubs if reference implementation is not available
 */
async function createMinimalFacets(facetsPath: string): Promise<void> {
  const diamondCutFacet = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { IDiamondCut } from "../interfaces/IDiamondCut.sol";
import { LibDiamond } from "../libraries/LibDiamond.sol";

/// @notice Facet that implements the diamondCut function
contract DiamondCutFacet is IDiamondCut {
    /// @notice Add/replace/remove any number of functions and optionally execute a function with delegatecall
    function diamondCut(
        FacetCut[] calldata _diamondCut,
        address _init,
        bytes calldata _calldata
    ) external override {
        LibDiamond.enforceIsContractOwner();
        LibDiamond.diamondCut(_diamondCut, _init, _calldata);
    }
}
`;

  const diamondLoupeFacet = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { LibDiamond } from "../libraries/LibDiamond.sol";
import { IDiamondLoupe } from "../interfaces/IDiamondLoupe.sol";
import { IERC165 } from "../interfaces/IERC165.sol";

/// @notice Facet that implements the Diamond Loupe interface
contract DiamondLoupeFacet is IDiamondLoupe, IERC165 {
    function facets() external view override returns (Facet[] memory facets_) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        uint256 numFacets = ds.facetAddresses.length;
        facets_ = new Facet[](numFacets);
        for (uint256 i; i < numFacets; i++) {
            address facetAddress_ = ds.facetAddresses[i];
            facets_[i].facetAddress = facetAddress_;
            facets_[i].functionSelectors = ds.facetFunctionSelectors[facetAddress_].selectors;
        }
    }

    function facetFunctionSelectors(address _facet) external view override returns (bytes4[] memory) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        return ds.facetFunctionSelectors[_facet].selectors;
    }

    function facetAddresses() external view override returns (address[] memory) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        return ds.facetAddresses;
    }

    function facetAddress(bytes4 _functionSelector) external view override returns (address) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        return ds.facetAddressAndSelectorPosition[_functionSelector].facetAddress;
    }

    function supportsInterface(bytes4 _interfaceId) external view override returns (bool) {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        return ds.supportedInterfaces[_interfaceId];
    }
}
`;

  const ownershipFacet = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import { LibDiamond } from "../libraries/LibDiamond.sol";
import { IERC173 } from "../interfaces/IERC173.sol";

/// @notice Facet that implements ownership functionality
contract OwnershipFacet is IERC173 {
    function transferOwnership(address _newOwner) external override {
        LibDiamond.enforceIsContractOwner();
        LibDiamond.setContractOwner(_newOwner);
    }

    function owner() external view override returns (address owner_) {
        owner_ = LibDiamond.contractOwner();
    }
}
`;

  await fs.writeFile(path.join(facetsPath, "DiamondCutFacet.sol"), diamondCutFacet);
  console.log(chalk.green("   ✓"), chalk.white("facets/DiamondCutFacet.sol"));
  
  await fs.writeFile(path.join(facetsPath, "DiamondLoupeFacet.sol"), diamondLoupeFacet);
  console.log(chalk.green("   ✓"), chalk.white("facets/DiamondLoupeFacet.sol"));
  
  await fs.writeFile(path.join(facetsPath, "OwnershipFacet.sol"), ownershipFacet);
  console.log(chalk.green("   ✓"), chalk.white("facets/OwnershipFacet.sol"));
}

/**
 * Create .markov directory for version tracking
 * NEW SIMPLIFIED VERSION: Only creates .markov/, branches/, and .gitignore
 * No commits folder, history.json, or HEAD file
 */
async function createMarkovDirectory(rootPath: string): Promise<void> {
  console.log(chalk.cyan("Step 2:"), chalk.white("Creating .markov directory..."));
  
  const markovPath = path.join(rootPath, ".markov");
  await fs.mkdir(markovPath, { recursive: true });
  
  // Create branches subdirectory
  const branchesPath = path.join(markovPath, "branches");
  await fs.mkdir(branchesPath, { recursive: true });
  
  console.log(chalk.gray("   ├─ .markov/"));
  console.log(chalk.gray("   └─ .markov/branches/"));
  
  // Create .gitignore for .markov directory
  const gitignore = `# Markov version tracking
# Diamond contract deployment artifacts and build cache
*.json.bak
*.tmp
node_modules/
cache/
artifacts/

# Keep branch files but config.json is created by config command
!branches/*.json
`;
  await fs.writeFile(path.join(markovPath, ".gitignore"), gitignore);
  console.log(chalk.green("   ✓ .gitignore created"));
  
  // DO NOT create config.json here - it will be created by the config command
  console.log(chalk.green("   ✓ .markov directory created\n"));
}
