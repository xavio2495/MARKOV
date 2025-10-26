import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskArguments } from "hardhat/types/tasks";
import type { BranchConfig, Commit } from "../../types.js";
import type { BranchFile } from "../../storage/validators.js";
import chalk from "chalk";
import * as readline from "readline/promises";
import path from "path";
import { existsSync } from "fs";
import * as fsp from "fs/promises";
import { createHistoryStorage, generateCommitHash } from "../../storage/history-storage.js";
import { createBranchConfigManager } from "../../utils/branch-config.js";
import { syncConfigFromBranch } from "./config.js";

/**
 * Read Author from .markov/config.json (fallback to "markov")
 */
async function getAuthorFromConfig(hre: HardhatRuntimeEnvironment): Promise<string> {
  try {
    const cfgPath = path.join(hre.config.paths.root, ".markov", "config.json");
    if (!existsSync(cfgPath)) return "markov";
    const content = await fsp.readFile(cfgPath, "utf-8");
    const json = JSON.parse(content);
    return (json.Author && typeof json.Author === "string" && json.Author.trim()) ? json.Author : "markov";
  } catch {
    return "markov";
  }
}

interface MarkovBranchArguments extends TaskArguments {
  action: string;
  name?: string;
}

/**
 * Manage branches (create, switch, list).
 */
export default async function markovBranch(
  taskArguments: TaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  const args = taskArguments as MarkovBranchArguments;

  // Centered header
  const headerText = "Branch Management";
  const padding = Math.floor((68 - headerText.length) / 2);
  const centeredHeader = " ".repeat(padding) + headerText + " ".repeat(68 - padding - headerText.length);
  
  console.log(chalk.blue("\n╔════════════════════════════════════════════════════════════════════╗"));
  console.log(chalk.blue("║") + chalk.cyan.bold(centeredHeader) + chalk.blue("║"));
  console.log(chalk.blue("╚════════════════════════════════════════════════════════════════════╝\n"));

  // Route to appropriate handler
  switch (args.action.toLowerCase()) {
    case "create":
      await handleBranchCreate(args, hre);
      break;
    case "switch":
      await handleBranchSwitch(args, hre);
      break;
    case "list":
      await handleBranchList(args, hre);
      break;
    case "delete":
      await handleBranchDelete(args, hre);
      break;
    default:
      console.log(chalk.red(`Unknown action: ${args.action}`));
      console.log(chalk.cyan("\nAvailable actions:"));
      console.log(chalk.white("  create <name>  - Create a new branch"));
      console.log(chalk.white("  switch <name>  - Switch to an existing branch"));
      console.log(chalk.white("  list           - List all branches"));
      console.log(chalk.white("  delete <name>  - Delete a branch"));
  }
}

/**
 * Handle branch create action
 */
async function handleBranchCreate(
  args: MarkovBranchArguments,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  console.log(chalk.cyan("Action:"), chalk.white("Create new branch\n"));

  // Validate branch name
  if (!args.name) {
    console.log(chalk.red("Error: Branch name is required"));
    console.log(chalk.cyan("Usage:"), chalk.white("npx hardhat markov branch create <name>"));
    return;
  }

  const branchName = args.name;

  // Initialize storage
  const storage = createHistoryStorage(hre.config.paths.root);
  
  if (!(await storage.exists())) {
    console.log(chalk.red("Error: Project not initialized"));
    console.log(chalk.cyan("Run:"), chalk.green("npx hardhat markov init"));
    return;
  }

  // Check if branch already exists
  const existingBranch = await storage.getBranchFile(branchName);
  if (existingBranch) {
    console.log(chalk.red(`Error: Branch '${branchName}' already exists`));
    return;
  }

  // Get current branch to clone from
  const currentBranchName = await storage.getCurrentBranchName();
  const currentBranch = await storage.getBranchFile(currentBranchName);

  if (!currentBranch) {
    console.log(chalk.red(`Error: Current branch '${currentBranchName}' not found`));
    return;
  }

  // Get the latest commit hash from current branch
  const currentCommitHash = currentBranch.commits.length > 0 
    ? currentBranch.commits[currentBranch.commits.length - 1].hash 
    : null;

  console.log(chalk.gray("Creating branch from:"), chalk.white(currentBranchName));
  if (currentCommitHash) {
    console.log(chalk.gray("At commit:"), chalk.white(currentCommitHash.substring(0, 8)));
  }

  // Initialize config manager
  const configManager = createBranchConfigManager(hre);

  // Prompt for target chain/network
  console.log();
  const targetChain = await promptForChain(configManager, hre);

  if (!targetChain) {
    console.log(chalk.yellow("\nBranch creation cancelled."));
    return;
  }

  // Get network config
  const networkConfig = configManager.getNetworkConfig(targetChain);
  if (!networkConfig || !networkConfig.url) {
    console.log(chalk.red(`Error: Network '${targetChain}' not configured or missing RPC URL`));
    return;
  }

  // Validate RPC connection
  console.log(chalk.cyan("\n🔍 Validating RPC connection..."));
  const isConnected = await configManager.validateRpcConnection(networkConfig.url);
  
  if (!isConnected) {
    console.log(chalk.red(`   ✗ Cannot connect to RPC: ${networkConfig.url}`));
    console.log(chalk.yellow("\n   Continue anyway? (y/N): "));
    const proceed = await promptUser("");
    if (!proceed) {
      console.log(chalk.yellow("\nBranch creation cancelled."));
      return;
    }
  } else {
    console.log(chalk.green(`   ✓ RPC connection successful`));
  }

  // Prompt for Diamond address (will be deployed or provided)
  console.log(chalk.cyan("\n💎 Diamond Contract Setup"));
  console.log(chalk.gray("   You need a Diamond contract on"), chalk.white(targetChain));
  console.log(chalk.gray("\n   Options:"));
  console.log(chalk.white("   1. Enter an existing Diamond address"));
  console.log(chalk.white("   2. Deploy a new Diamond (not yet implemented)"));
  console.log(chalk.white("   3. Clone from current branch (reads facets and prepares config)"));
  console.log();

  const diamondOption = await promptForInput("   Select option (1-3): ");

  let diamondAddress: string;

  if (diamondOption === "1") {
    diamondAddress = await promptForInput("   Enter Diamond address: ");
    
    if (!diamondAddress.startsWith("0x") || diamondAddress.length !== 42) {
      console.log(chalk.red("\nError: Invalid Ethereum address"));
      return;
    }
  } else if (diamondOption === "3") {
    // Clone from current branch
    if (!currentBranch.config?.diamondAddress) {
      console.log(chalk.red("\nError: Current branch does not have a Diamond address configured"));
      return;
    }

    if (!currentBranch.config.rpcUrl) {
      console.log(chalk.red("\nError: Current branch does not have an RPC URL configured"));
      return;
    }

    console.log(chalk.cyan("\n📋 Cloning Diamond to new branch..."));
    console.log(chalk.gray(`   Source: ${currentBranch.config.diamondAddress} on ${currentBranch.config.chain}`));
    console.log(chalk.gray(`   Target: ${targetChain}`));
    
    console.log(chalk.yellow("\n⚠️  Note: Diamond cloning via 'markov clone' not yet integrated"));
    console.log(chalk.gray("   For now, you'll need to deploy a Diamond manually on the target chain"));
    console.log();
    console.log(chalk.cyan("   Recommended workflow:"));
    console.log(chalk.white("   1. Run:"), chalk.green(`npx hardhat markov clone ${currentBranch.config.diamondAddress} --network ${targetChain}`));
    console.log(chalk.white("   2. Note the deployed Diamond address"));
    console.log(chalk.white("   3. Enter it below"));
    console.log();

    // For now, ask for the Diamond address they will deploy
    diamondAddress = await promptForInput("   Enter target Diamond address (after deployment): ");
    
    if (!diamondAddress.startsWith("0x") || diamondAddress.length !== 42) {
      console.log(chalk.red("\nError: Invalid Ethereum address"));
      return;
    }
  } else {
    console.log(chalk.yellow("\nOption 2 (deploy new Diamond) is not yet implemented"));
    console.log(chalk.cyan("Please deploy a Diamond manually and use option 1"));
    return;
  }

  // Create branch configuration
  const branchConfig: BranchConfig = await configManager.createBranchConfig(
    branchName,
    targetChain,
    diamondAddress,
    currentBranchName,
    currentCommitHash || undefined
  );

  // Display configuration
  configManager.displayNetworkInfo(branchConfig);

  // Create initial commit for the branch
  const initialCommit: Commit = {
    hash: "", // Will be generated
    timestamp: Date.now(),
    author: await getAuthorFromConfig(hre),
    message: `Create branch '${branchName}' from '${currentBranchName}'`,
    diamondAddress: diamondAddress,
    cut: [], // Empty cut for branch creation
    parentHash: currentCommitHash || undefined,
    branch: branchName,
  };

  initialCommit.hash = generateCommitHash(initialCommit);

  // Create branch file (new simplified architecture)
  const newBranchFile: BranchFile = {
    name: branchName,
    config: branchConfig,
    commits: [initialCommit],
  };

  // Save branch
  try {
    await storage.createBranch(branchName, branchConfig);
    // Add the initial commit
    await storage.addCommit(branchName, initialCommit);
    console.log(chalk.green(`\n✓ Branch '${branchName}' created successfully!`));
    console.log(chalk.gray("\nBranch details:"));
    console.log(chalk.gray("  Name:"), chalk.white(branchName));
    console.log(chalk.gray("  Chain:"), chalk.white(branchConfig.chain));
    console.log(chalk.gray("  Diamond:"), chalk.white(diamondAddress));
    console.log(chalk.gray("  Created from:"), chalk.white(currentBranchName));
    console.log();
    console.log(chalk.cyan("To switch to this branch:"));
    console.log(chalk.green(`  npx hardhat markov branch switch ${branchName}`));
    console.log();
  } catch (error) {
    console.log(chalk.red(`\nError creating branch: ${error instanceof Error ? error.message : String(error)}`));
  }
}

/**
 * Handle branch switch action
 */
async function handleBranchSwitch(
  args: MarkovBranchArguments,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const branchName = args.name;
  if (!branchName) {
    console.log(chalk.red("\n✗ Branch name is required for switch operation.\n"));
    return;
  }

  const storage = createHistoryStorage(hre.config.paths.root);

  // Check if the branch exists
  const targetBranch = await storage.getBranchFile(branchName);
  if (!targetBranch) {
    console.log(chalk.red(`\n✗ Branch '${branchName}' does not exist.\n`));
    return;
  }

  const currentBranchName = await storage.getCurrentBranchName();
  if (currentBranchName === branchName) {
    console.log(chalk.yellow(`\n⚠️  Already on branch '${branchName}'.\n`));
    return;
  }

  // Switch to the new branch
  await storage.setCurrentBranchName(branchName);

  // Sync config from the target branch to .markov/config.json
  await syncConfigFromBranch(branchName, hre);

  const commitCount = targetBranch.commits.length;
  const latestCommit = commitCount > 0 ? targetBranch.commits[commitCount - 1].hash.slice(0, 7) : "none";

  console.log(chalk.green(`\n✓ Switched to branch '${branchName}'`));
  console.log(chalk.gray(`  Commits: ${commitCount}`));
  console.log(chalk.gray(`  Latest: ${latestCommit}`));
  console.log(chalk.gray(`  Chain: ${targetBranch.config.chain || "default"}\n`));
}

/**
 * Handle branch list action
 */
async function handleBranchList(
  args: MarkovBranchArguments,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const storage = createHistoryStorage(hre.config.paths.root);
  const branches = await storage.listBranches();
  const currentBranchName = await storage.getCurrentBranchName();

  if (branches.length === 0) {
    console.log(chalk.yellow("\n⚠️  No branches found. Use 'npx hardhat markov branch create <name>' to create one.\n"));
    return;
  }

  console.log(chalk.cyan("\nAvailable branches:\n"));

  for (const branchName of branches) {
    const branchFile = await storage.getBranchFile(branchName);
    if (!branchFile) continue;

    const isCurrent = branchName === currentBranchName;
    const prefix = isCurrent ? chalk.green("* ") : "  ";
    const nameColor = isCurrent ? chalk.green.bold : chalk.white;
    const commitCount = branchFile.commits.length;
    const latestHash = commitCount > 0 ? branchFile.commits[commitCount - 1].hash.slice(0, 7) : "none";
    const chain = branchFile.config.chain || "default";

    console.log(`${prefix}${nameColor(branchName)}`);
    console.log(chalk.gray(`    Commits: ${commitCount} | Latest: ${latestHash} | Chain: ${chain}`));
  }

  console.log();
}

/**
 * Handle branch delete action
 */
async function handleBranchDelete(
  args: MarkovBranchArguments,
  hre: HardhatRuntimeEnvironment
): Promise<void> {
  const branchName = args.name;
  if (!branchName) {
    console.log(chalk.red("\n✗ Branch name is required for delete operation.\n"));
    return;
  }

  const storage = createHistoryStorage(hre.config.paths.root);
  
  // Check if branch exists
  const targetBranch = await storage.getBranchFile(branchName);
  if (!targetBranch) {
    console.log(chalk.red(`\n✗ Branch '${branchName}' does not exist.\n`));
    return;
  }

  // Prevent deleting current branch
  const currentBranchName = await storage.getCurrentBranchName();
  if (currentBranchName === branchName) {
    console.log(chalk.red(`\n✗ Cannot delete the currently active branch '${branchName}'.`));
    console.log(chalk.gray(`  Switch to another branch first using: npx hardhat markov branch switch <other-branch>\n`));
    return;
  }

  // Confirm deletion
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(
      chalk.yellow(`\n⚠️  Delete branch '${branchName}' with ${targetBranch.commits.length} commit(s)? This cannot be undone. (y/N): `)
    );

    if (answer.toLowerCase() !== "y" && answer.toLowerCase() !== "yes") {
      console.log(chalk.gray("\nDeletion cancelled.\n"));
      return;
    }

    await storage.deleteBranch(branchName);
    console.log(chalk.green(`\n✓ Branch '${branchName}' deleted successfully.\n`));
  } finally {
    rl.close();
  }
}

/**
 * Get a public RPC suggestion for well-known chains
 */
function getPublicRpcSuggestion(chainId: number): string {
  const knownRpcs: Record<number, string> = {
    1: "https://eth.llamarpc.com",           // Ethereum Mainnet
    56: "https://bsc-dataseed.binance.org",   // BNB Smart Chain
    137: "https://polygon-rpc.com",           // Polygon
    42161: "https://arb1.arbitrum.io/rpc",    // Arbitrum One
    10: "https://mainnet.optimism.io",        // Optimism
    43114: "https://api.avax.network/ext/bc/C/rpc", // Avalanche C-Chain
    250: "https://rpc.ftm.tools",             // Fantom
    8453: "https://mainnet.base.org",         // Base
    // Testnets
    11155111: "https://eth-sepolia.public.blastapi.io", // Sepolia
    80001: "https://rpc-mumbai.maticvigil.com", // Polygon Mumbai
    421614: "https://sepolia-rollup.arbitrum.io/rpc", // Arbitrum Sepolia
  };

  return knownRpcs[chainId] || "YOUR_RPC_URL";
}

/**
 * Add a network to hardhat.config.ts
 */
async function addNetworkToHardhatConfig(
  hre: HardhatRuntimeEnvironment,
  networkName: string,
  rpcUrl: string,
  chainId: number
): Promise<boolean> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const { existsSync } = await import("node:fs");

  const root = hre.config.paths.root;
  const configPath = (hre.config.paths as any).config ?? path.join(root, "hardhat.config.ts");

  if (!existsSync(configPath)) {
    console.log(chalk.red("   ✗ hardhat.config.ts not found"));
    return false;
  }

  try {
    let content = await fs.readFile(configPath, "utf-8");

    // Check if networks section exists
    const hasNetworks = /\bnetworks\s*:\s*\{[\s\S]*?\},?/m.test(content);

    if (hasNetworks) {
      // Add to existing networks section
      content = content.replace(
        /(networks\s*:\s*\{[\s\S]*?)(\s*\},?)/m,
        (match, networksStart, networksEnd) => {
          return `${networksStart}    ${networkName}: {\n      url: "${rpcUrl}",\n      chainId: ${chainId},\n    },\n${networksEnd}`;
        }
      );
    } else {
      // Add networks section after solidity or at the beginning
      const insertPoint = content.match(/(solidity\s*:\s*["'`][^"'`]+["'`],?)/) ||
                         content.match(/export\s+default\s*\{/);

      if (insertPoint) {
        const networksBlock = `  networks: {\n    ${networkName}: {\n      url: "${rpcUrl}",\n      chainId: ${chainId},\n    },\n  },`;
        content = content.replace(insertPoint[0], `${insertPoint[0]}\n${networksBlock}`);
      } else {
        // Fallback: add at the end before the closing brace
        content = content.replace(/(\s*\}\s*;?\s*)$/m, (match) => {
          const networksBlock = `  networks: {\n    ${networkName}: {\n      url: "${rpcUrl}",\n      chainId: ${chainId},\n    },\n  },\n${match}`;
          return networksBlock;
        });
      }
    }

    await fs.writeFile(configPath, content);
    console.log(chalk.green(`   ✓ Added ${networkName} network to hardhat.config.ts`));
    return true;
  } catch (error) {
    console.log(chalk.red(`   ✗ Failed to update hardhat.config.ts: ${error instanceof Error ? error.message : String(error)}`));
    return false;
  }
}

/**
 * Prompt user for chain selection
 */
async function promptForChain(configManager: typeof import("../../utils/branch-config.js").BranchConfigManager.prototype, hre: HardhatRuntimeEnvironment): Promise<string | null> {
  const networks = configManager.listAvailableNetworks();

  console.log(chalk.cyan("📡 Available networks from hardhat.config:"));
  networks.forEach((network, index) => {
    const chainId = configManager.getChainId(network);
    console.log(chalk.gray(`   ${index + 1}.`), chalk.white(network), chainId ? chalk.gray(`(Chain ID: ${chainId})`) : "");
  });

  console.log();
  console.log(chalk.gray("You can enter:"));
  console.log(chalk.white("  • Network number from list above"));
  console.log(chalk.white("  • Network name (e.g., 'sepolia', 'polygon')"));
  console.log(chalk.white("  • Chain ID (e.g., 1, 137, 11155111)"));
  console.log(chalk.white("  • Chain name (e.g., 'Ethereum', 'Polygon')"));
  console.log(chalk.gray("\nDefault: localhost"));
  console.log();

  const input = await promptForInput("   Enter network [localhost]: ");
  const trimmedInput = input.trim();

  // If empty, use localhost
  if (trimmedInput === "") {
    if (networks.includes("localhost")) {
      return "localhost";
    }
    console.log(chalk.yellow("\nWarning: 'localhost' not found in hardhat.config networks"));
    console.log(chalk.gray("Add it to your hardhat.config.ts:\n"));
    console.log(chalk.gray("  networks: {"));
    console.log(chalk.gray("    localhost: {"));
    console.log(chalk.gray("      url: 'http://127.0.0.1:8545'"));
    console.log(chalk.gray("    }"));
    console.log(chalk.gray("  }"));
    return null;
  }

  // Check if input is a number from the list
  const selectedIndex = parseInt(trimmedInput) - 1;
  if (!isNaN(selectedIndex) && selectedIndex >= 0 && selectedIndex < networks.length) {
    return networks[selectedIndex];
  }

  // Check if input is a network name from hardhat.config
  if (networks.includes(trimmedInput)) {
    return trimmedInput;
  }

  // Check if input is a numeric chain ID - try to find it in hardhat networks first
  const numericChainId = parseInt(trimmedInput, 10);
  if (!isNaN(numericChainId)) {
    // Search hardhat.config networks for matching chainId
    for (const network of networks) {
      const networkChainId = configManager.getChainId(network);
      if (networkChainId === numericChainId) {
        console.log(chalk.green(`   ✓ Found network '${network}' with Chain ID ${numericChainId}`));
        return network;
      }
    }

    // If not found in hardhat.config, try network-resolver
    console.log(chalk.cyan(`   🔍 Searching for Chain ID ${numericChainId}...`));
    const { getNetworkResolver } = await import("../../utils/network-resolver.js");
    const resolver = getNetworkResolver();
    
    try {
      const chain = await resolver.getChainById(numericChainId);
      if (chain) {
        const rpcUrls = resolver.getRpcUrls(chain);
        const suggestedRpc = rpcUrls.length > 0 ? rpcUrls[0] : getPublicRpcSuggestion(chain.chainId);
        
        console.log(chalk.yellow(`\n   ⚠️  Found chain: ${resolver.formatChainInfo(chain)}`));
        console.log(chalk.gray(`   But it's not configured in your hardhat.config.ts`));
        console.log(chalk.gray(`\n   Add it to hardhat.config.ts:\n`));
        console.log(chalk.gray(`   networks: {`));
        console.log(chalk.gray(`     ${chain.shortName}: {`));
        console.log(chalk.gray(`       url: '${suggestedRpc}'`));
        console.log(chalk.gray(`       chainId: ${chain.chainId}`));
        console.log(chalk.gray(`     }`));
        console.log(chalk.gray(`   }`));

        const addNetwork = await promptUser("   Add this network to hardhat.config.ts? (Y/n): ");
        if (addNetwork) {
          const success = await addNetworkToHardhatConfig(hre, chain.shortName, suggestedRpc, chain.chainId);
          if (success) {
            console.log(chalk.green(`   ✓ Network '${chain.shortName}' added successfully!`));
            return chain.shortName;
          }
        }
        
        return null;
      }
    } catch (error) {
      console.log(chalk.gray(`   (Could not fetch chain data: ${error instanceof Error ? error.message : String(error)})`));
    }
  }

  // Try network-resolver for chain/network name lookup
  console.log(chalk.cyan(`   🔍 Searching for '${trimmedInput}'...`));
  const { getNetworkResolver } = await import("../../utils/network-resolver.js");
  const resolver = getNetworkResolver();

  try {
    const chain = await resolver.findChain(trimmedInput);
    if (chain) {
      const rpcUrls = resolver.getRpcUrls(chain);
      const suggestedRpc = rpcUrls.length > 0 ? rpcUrls[0] : getPublicRpcSuggestion(chain.chainId);
      
      console.log(chalk.yellow(`\n   ⚠️  Found chain: ${resolver.formatChainInfo(chain)}`));
      console.log(chalk.gray(`   But it's not configured in your hardhat.config.ts`));
      console.log(chalk.gray(`\n   Add it to hardhat.config.ts:\n`));
      console.log(chalk.gray(`   networks: {`));
      console.log(chalk.gray(`     ${chain.shortName}: {`));
      console.log(chalk.gray(`       url: '${suggestedRpc}'`));
      console.log(chalk.gray(`       chainId: ${chain.chainId}`));
      console.log(chalk.gray(`     }`));
      console.log(chalk.gray(`   }`));

      const addNetwork = await promptUser("   Add this network to hardhat.config.ts? (Y/n): ");
      if (addNetwork) {
        const success = await addNetworkToHardhatConfig(hre, chain.shortName, suggestedRpc, chain.chainId);
        if (success) {
          console.log(chalk.green(`   ✓ Network '${chain.shortName}' added successfully!`));
          return chain.shortName;
        }
      }
      
      return null;
    }
  } catch (error) {
    console.log(chalk.gray(`   (Could not fetch chain data: ${error instanceof Error ? error.message : String(error)})`));
  }

  console.log(chalk.red(`\n   ✗ Network not found: ${trimmedInput}`));
  console.log(chalk.gray(`   Please add it to your hardhat.config.ts networks section`));
  return null;
}

/**
 * Prompt user for input
 */
async function promptForInput(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(chalk.yellow(question));
    rl.close();
    return answer.trim();
  } catch (error) {
    rl.close();
    return "";
  }
}

/**
 * Prompt user for confirmation
 */
async function promptUser(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const answer = await rl.question(question);
    rl.close();
    return answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
  } catch (error) {
    rl.close();
    return false;
  }
}
