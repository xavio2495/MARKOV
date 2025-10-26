import * as fs from "fs";
import * as path from "path";
import * as readline from "readline/promises";
import chalk from "chalk";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskArguments } from "hardhat/types/tasks";
import { getNetworkResolver, type ChainData } from "../../utils/network-resolver.js";
import { BlockscoutClient } from "../../utils/blockscout.js";
import { createHistoryStorage, generateCommitHash } from "../../storage/history-storage.js";
import type { BranchConfig, Commit } from "../../types.js";
import { syncConfigFromBranch, ensureConfigKeys } from "./config.js";

interface MarkovCloneArguments extends TaskArguments {
  address?: string;
  sourceNetwork?: string;
}

/**
 * Prompt user for input with validation
 */
async function promptUser(
  question: string,
  validator?: (answer: string) => boolean
): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let answer = "";
  let isValid = false;

  while (!isValid) {
    answer = await rl.question(chalk.cyan(question + " "));
    answer = answer.trim();

    if (!answer) {
      console.log(chalk.yellow("Input cannot be empty. Please try again."));
      continue;
    }

    if (validator) {
      isValid = validator(answer);
      if (!isValid) {
        console.log(chalk.yellow("Invalid input. Please try again."));
      }
    } else {
      isValid = true;
    }
  }

  rl.close();
  return answer;
}

/**
 * Validate Ethereum address format
 */
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Prompt user if they want to clone all deployments
 */
async function promptForBulkClone(implementationCount: number): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const question = chalk.cyan(
    `\nDo you want to clone all ${implementationCount} deployment(s)? (y/n): `
  );
  
  let answer = "";
  while (true) {
    answer = (await rl.question(question)).trim().toLowerCase();
    if (answer === "y" || answer === "yes") {
      rl.close();
      return true;
    }
    if (answer === "n" || answer === "no") {
      rl.close();
      return false;
    }
    console.log(chalk.yellow("Please answer 'y' or 'n'"));
  }
}

/**
 * Determine the Diamond project name from implementations
 */
async function getDiamondProjectName(
  diamondAddress: string,
  implementations: any[],
  blockscout: BlockscoutClient
): Promise<string> {
  // Try to get name from the first verified implementation
  for (const impl of implementations) {
    try {
      const contractCode = await blockscout.inspectContractCode(impl.address);
      if (contractCode.name && contractCode.name.trim()) {
        // Extract a clean project name (remove "Facet" suffix if present)
        let name = contractCode.name.trim();
        // If it's a facet name, try to extract the project name
        if (name.includes('Diamond')) {
          return name;
        }
        // Otherwise use a generic name based on the contract
        const parts = name.split(/(?=[A-Z])/); // Split on capital letters
        if (parts.length > 1 && parts[parts.length - 1].toLowerCase() === 'facet') {
          return parts.slice(0, -1).join('') + '-Diamond';
        }
      }
    } catch (error) {
      // Continue to next implementation
    }
  }
  
  // Fallback: use address-based name
  return `Diamond-${diamondAddress.slice(2, 10)}`;
}

/**
 * Resolve network from user input
 */
async function resolveNetwork(
  networkInput: string,
  resolver: ReturnType<typeof getNetworkResolver>
): Promise<ChainData | null> {
  console.log(chalk.blue("\nResolving network..."));

  // Try numeric chain ID first
  const numericId = parseInt(networkInput, 10);
  if (!isNaN(numericId)) {
    const chain = await resolver.getChainById(numericId);
    if (chain) {
      return chain;
    }
  }

  // Try name/shortName lookup
  const chain = await resolver.findChain(networkInput);
  if (chain) {
    return chain;
  }

  // If no exact match, show suggestions
  console.log(chalk.yellow(`\nNetwork "${networkInput}" not found.`));
  const suggestions = await resolver.searchChains(networkInput, 5);

  if (suggestions.length > 0) {
    console.log(chalk.cyan("\nDid you mean one of these?"));
    suggestions.forEach((s: any, i: number) => {
      console.log(
        chalk.gray(`  ${i + 1}. ${s.name} ${s.testnet ? "(Testnet)" : "(Mainnet)"} - Chain ID: ${s.chainId}`)
      );
    });
  }

  return null;
}

/**
 * Display chain information
 */
function displayChainInfo(chain: ChainData): void {
  console.log(chalk.green("\nNetwork found:"));
  console.log(chalk.white(`  ${"Name:".padEnd(20)} ${chain.name}`));
  console.log(chalk.white(`  ${"Chain ID:".padEnd(20)} ${chain.chainId}`));
  console.log(chalk.white(`  ${"Network ID:".padEnd(20)} ${chain.networkId}`));
  console.log(chalk.white(`  ${"Type:".padEnd(20)} ${chain.testnet ? "Testnet" : "Mainnet"}`));
  console.log(chalk.white(`  ${"Native Currency:".padEnd(20)} ${chain.nativeCurrency.symbol}`));

  const explorer = chain.explorers?.[0];
  if (explorer) {
    console.log(chalk.white(`  ${"Explorer:".padEnd(20)} ${explorer.url}`));
  }

  const rpcUrls = chain.rpc.filter((url: any) => 
    typeof url === "string" && url.trim().length > 0
  );
  if (rpcUrls.length > 0) {
    console.log(chalk.white(`  ${"RPC URLs:".padEnd(20)} ${rpcUrls.length} available`));
  }
}

/**
 * Initialize .markov directory structure
 */
function initializeMarkovDirectory(projectRoot: string): void {
  const markovDir = path.join(projectRoot, ".markov");
  const branchesDir = path.join(markovDir, "branches");
  const contractsDir = path.join(projectRoot, "contracts", "facets");

  // Create directories
  if (!fs.existsSync(markovDir)) {
    fs.mkdirSync(markovDir, { recursive: true });
  }

  if (!fs.existsSync(branchesDir)) {
    fs.mkdirSync(branchesDir, { recursive: true });
  }

  if (!fs.existsSync(contractsDir)) {
    fs.mkdirSync(contractsDir, { recursive: true });
  }

  console.log(chalk.green("\nInitialized .markov directory structure"));
}

/**
 * Read Author from .markov/config.json (fallback to "markov")
 */
async function getAuthorFromConfig(root: string): Promise<string> {
  try {
    const cfgPath = path.join(root, ".markov", "config.json");
    if (!fs.existsSync(cfgPath)) return "markov";
    const content = fs.readFileSync(cfgPath, "utf-8");
    const json = JSON.parse(content);
    return json.Author && typeof json.Author === "string" && json.Author.trim() ? json.Author : "markov";
  } catch {
    return "markov";
  }
}

/**
 * Suggest a branch name based on the source chain
 */
function suggestBranchName(chain: ChainData): string {
  const base = (chain.shortName || chain.name || "imported")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "imported";
}

/**
 * Create a Markov branch and set it as current based on clone details
 */
async function createBranchFromClone(
  hre: HardhatRuntimeEnvironment,
  chain: ChainData,
  diamondAddress: string,
  rpcUrl: string | undefined
): Promise<string> {
  const root = hre.config.paths.root;
  const storage = createHistoryStorage(root);
  await storage.initialize(root);

  // Find a unique branch name
  const baseName = suggestBranchName(chain);
  const existing = await storage.listBranches();
  let branchName = baseName;
  let i = 1;
  while (existing.includes(branchName)) {
    branchName = `${baseName}-${i++}`;
  }

  const author = await getAuthorFromConfig(root);

  const branchConfig: Omit<BranchConfig, "name"> = {
    chain: chain.shortName || chain.name,
    chainId: chain.chainId,
    rpcUrl: rpcUrl || "",
    diamondAddress,
    explorerUrl: chain.explorers && chain.explorers[0] ? chain.explorers[0].url : undefined,
    explorerApiKey: undefined,
    createdAt: Date.now(),
    createdFrom: "clone",
    createdFromCommit: undefined,
  };

  // Create branch file
  await storage.createBranch(branchName, branchConfig);

  // Initial commit
  const initialCommit: Omit<Commit, "hash"> = {
    timestamp: Date.now(),
    author,
    message: `Clone '${diamondAddress}' from ${chain.name}`,
    diamondAddress,
    cut: [],
    parentHash: undefined,
    branch: branchName,
  };
  const commitWithHash: Commit = { ...initialCommit, hash: generateCommitHash(initialCommit) };
  await storage.addCommit(branchName, commitWithHash);

  // Set as current and sync config.json from branch
  await storage.setCurrentBranchName(branchName);
  await syncConfigFromBranch(branchName, hre);

  return branchName;
}

/**
 * Save cloned contract metadata
 */
function saveCloneMetadata(
  projectRoot: string,
  metadata: {
    address: string;
    chainId: number;
    chainName: string;
    clonedAt: string;
    facetCount: number;
  }
): void {
  const markovDir = path.join(projectRoot, ".markov");
  const metadataPath = path.join(markovDir, "clone-metadata.json");

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
  console.log(chalk.green(`\nSaved clone metadata to ${chalk.cyan(".markov/clone-metadata.json")}`));
}

/**
 * Download source code for a single facet deployment
 */
async function downloadFacetSource(
  facetAddr: string,
  index: number,
  total: number,
  projectRoot: string,
  projectName: string,
  blockscout: BlockscoutClient,
  verbose: boolean = false
): Promise<{ filesDownloaded: number; success: boolean }> {
  console.log(chalk.gray(`  [${index}/${total}] ${facetAddr}...`));
  
  let downloadedFileCount = 0;

  try {
    // Get initial contract metadata
    const contractCode = await blockscout.inspectContractCode(facetAddr);

    // Strategy 1: Multi-file contract with source_code_tree_structure
    if (contractCode.sourceCodeTreeStructure && contractCode.sourceCodeTreeStructure.length > 0) {
      console.log(chalk.gray(`    Found ${contractCode.sourceCodeTreeStructure.length} source file(s)`));
      
      for (const fileName of contractCode.sourceCodeTreeStructure) {
        try {
          const fileCode = await blockscout.inspectContractCode(facetAddr, fileName);
          
          if (fileCode.sourceCode) {
            // Save directly into project structure, preserving file paths
            const filePath = path.join(projectRoot, projectName, fileName);
            const fileDir = path.dirname(filePath);
            
            if (!fs.existsSync(fileDir)) {
              fs.mkdirSync(fileDir, { recursive: true });
            }
            
            // Overwrite if exists to ensure latest version
            fs.writeFileSync(filePath, fileCode.sourceCode, "utf-8");
            downloadedFileCount++;
          }
        } catch (fileError) {
          if (verbose) {
            console.log(chalk.gray(`      Failed to fetch ${fileName}: ${fileError instanceof Error ? fileError.message : String(fileError)}`));
          }
        }
      }
      
      console.log(chalk.green(`    Saved ${downloadedFileCount} file(s)`));
      return { filesDownloaded: downloadedFileCount, success: true };
    }
    // Strategy 2: Single-file contract with sourceCode directly
    else if (contractCode.sourceCode) {
      const facetName = contractCode.name || `Facet_${facetAddr.slice(2, 8)}`;
      // Save in contracts/facets/ subdirectory within project
      const outPath = path.join(projectRoot, projectName, "contracts", "facets", `${facetName}.sol`);
      const outDir = path.dirname(outPath);
      
      if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
      }
      
      // Overwrite if exists
      fs.writeFileSync(outPath, contractCode.sourceCode, "utf-8");
      console.log(chalk.green(`    Saved ${facetName}.sol`));
      downloadedFileCount++;
      return { filesDownloaded: downloadedFileCount, success: true };
    }
    // Strategy 3: Try Sourcify if available
    else if (contractCode.sourcifyRepoUrl) {
      console.log(chalk.gray(`    Trying Sourcify repository...`));
      const sourcifyData = await blockscout.fetchSourceFromSourcify(contractCode.sourcifyRepoUrl);
      
      if (sourcifyData && Object.keys(sourcifyData.sources).length > 0) {
        for (const [filePathRel, sourceCode] of Object.entries(sourcifyData.sources)) {
          // Save directly into project structure
          const targetPath = path.join(projectRoot, projectName, filePathRel);
          const targetDir = path.dirname(targetPath);
          if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
          
          // Overwrite if exists
          fs.writeFileSync(targetPath, sourceCode, "utf-8");
          downloadedFileCount++;
        }
        console.log(chalk.green(`    Saved ${Object.keys(sourcifyData.sources).length} file(s) from Sourcify`));
        return { filesDownloaded: downloadedFileCount, success: true };
      } else {
        console.log(chalk.yellow(`    Sourcify fetch failed`));
      }
    } else {
      console.log(chalk.yellow(`    Source code not available (not verified)`));
    }
  } catch (error) {
    console.log(chalk.gray(`    Not verified individually (normal for Diamond facets)`));
  }

  return { filesDownloaded: 0, success: false };
}

/**
 * Download all deployments (bulk clone)
 */
async function downloadAllDeployments(
  diamondAddress: string,
  implementations: any[],
  projectRoot: string,
  blockscout: BlockscoutClient,
  verbose: boolean = false
): Promise<{ totalFiles: number; successCount: number; projectName: string }> {
  // Determine the project name
  const projectName = await getDiamondProjectName(diamondAddress, implementations, blockscout);
  console.log(chalk.green(`\nProject name: ${chalk.cyan(projectName)}`));
  
  console.log(chalk.blue(`\nDownloading source code for all ${implementations.length} deployment(s)...`));
  console.log(chalk.gray(`Files will be merged into: ${chalk.cyan(projectName)}/`));
  
  let totalFiles = 0;
  let successCount = 0;

  for (let i = 0; i < implementations.length; i++) {
    const impl = implementations[i];
    const result = await downloadFacetSource(
      impl.address,
      i + 1,
      implementations.length,
      projectRoot,
      projectName,
      blockscout,
      verbose
    );
    
    totalFiles += result.filesDownloaded;
    if (result.success) {
      successCount++;
    }
  }

  return { totalFiles, successCount, projectName };
}

/**
 * Clone an existing Diamond contract from another chain.
 */
export default async function markovClone(
  taskArguments: MarkovCloneArguments,
  hre: HardhatRuntimeEnvironment,
) {
  // Centered header
  const headerText = "Cloning Diamond Contract";
  const padding = Math.floor((68 - headerText.length) / 2);
  const centeredHeader = " ".repeat(padding) + headerText + " ".repeat(68 - padding - headerText.length);
  
  console.log(chalk.blue("\n╔════════════════════════════════════════════════════════════════════╗"));
  console.log(chalk.blue("║") + chalk.cyan.bold(centeredHeader) + chalk.blue("║"));
  console.log(chalk.blue("╚════════════════════════════════════════════════════════════════════╝\n"));

  // Pre-flight: ensure config has all 8 required keys
  await ensureConfigKeys(hre, { promptIfMissing: true });

  // Debug: Show what arguments were received (disabled by default)
  // console.log(chalk.gray("Debug - Received arguments:"));
  // console.log(chalk.gray(JSON.stringify(taskArguments, null, 2)));

  const resolver = getNetworkResolver();

  try {
    // Load chain data
    console.log(chalk.blue("Loading chain data from chainlist.org..."));
    await resolver.loadChains();
    console.log(chalk.green("Chain data loaded successfully"));

  // Get or prompt for Diamond address
  let diamondAddress = taskArguments.address;
  if (!diamondAddress) {
    diamondAddress = await promptUser(
      "Enter Diamond contract address:",
      isValidAddress
    );
  } else if (!isValidAddress(diamondAddress)) {
    console.log(chalk.red(`\nError: Invalid address format: ${diamondAddress}`));
    console.log(chalk.yellow("Address must be a valid Ethereum address (0x followed by 40 hex characters)"));
    return;
  }

  console.log(chalk.green(`\nDiamond address: ${chalk.cyan(diamondAddress)}`));

  // Get or prompt for network
  let chain: ChainData | null = null;
  let networkInput = taskArguments.sourceNetwork;

  if (!networkInput) {
    networkInput = await promptUser(
      "Enter network (name, chain ID, or short name):"
    );
  }    chain = await resolveNetwork(networkInput, resolver);

    if (!chain) {
      console.log(chalk.red("\nError: Could not resolve network"));
      console.log(chalk.yellow("Please check the network name or chain ID and try again"));
      console.log(chalk.gray("\nExamples:"));
      console.log(chalk.gray("  - ethereum"));
      console.log(chalk.gray("  - polygon"));
      console.log(chalk.gray("  - 1 (for Ethereum mainnet)"));
      console.log(chalk.gray("  - 137 (for Polygon mainnet)"));
      return;
    }

    displayChainInfo(chain);

    // Initialize Blockscout client
    console.log(chalk.blue("\nInitializing Blockscout client..."));
    const blockscout = new BlockscoutClient(chain.chainId);

    // Verify the address is a contract
    console.log(chalk.blue("\nVerifying contract address..."));
    const addressInfo = await blockscout.getAddressInfo(diamondAddress);

    // Debug: Show what we received (disabled by default)
    // console.log(chalk.gray(`\nDebug - Address Info:`));
    // console.log(chalk.gray(JSON.stringify(addressInfo, null, 2)));

    if (!addressInfo.isContract) {
      console.log(chalk.red(`\nError: Address ${diamondAddress} is not a contract`));
      console.log(chalk.yellow(`API returned isContract: ${addressInfo.isContract}`));
      // console.log(chalk.gray("\nTip: Enable debug logging to see full API response"));
      return;
    }

    console.log(chalk.green("Contract verified"));
    
    if (addressInfo.isVerified) {
      console.log(chalk.green("Contract source code is verified on Blockscout"));
    } else {
      console.log(chalk.yellow("Warning: Contract source code is not verified"));
      console.log(chalk.yellow("Clone will proceed but may have limited information"));
    }

    // Get Deployments/Implementations and prompt user to choose one
    console.log(chalk.blue("\nQuerying Diamond Facet deployments (implementations)..."));
    const implementations = await blockscout.getImplementations(diamondAddress);

    if (implementations.length === 0) {
      console.log(chalk.yellow("\nWarning: No implementations found via Blockscout."));
      console.log(chalk.yellow("Attempting to continue without deployment selection..."));
    } else {
      console.log(chalk.green(`Found ${chalk.cyan(implementations.length.toString())} deployment(s):`));
      implementations.forEach((impl, i) => {
        const label = impl.name ? `${impl.name}`.padEnd(25) + ` (${impl.address})` : `${impl.address}`.padEnd(25);
        console.log(chalk.white(`  ${i + 1}.`.padEnd(2) + ` ${label}`));
      });

      // Ask if user wants to clone all deployments
      const cloneAll = await promptForBulkClone(implementations.length);

      if (cloneAll) {
        // Bulk clone workflow: download all deployments
        console.log(chalk.blue("\nSetting up project structure..."));
        const projectRoot = process.cwd();
        initializeMarkovDirectory(projectRoot);

        const { totalFiles, successCount, projectName } = await downloadAllDeployments(
          diamondAddress,
          implementations,
          projectRoot,
          blockscout,
          false
        );

        console.log(chalk.green(`\nDownloaded source code for ${chalk.cyan(successCount.toString())}/${chalk.cyan(implementations.length.toString())} deployment(s)`));
        console.log(chalk.green(`Total files saved: ${chalk.cyan(totalFiles.toString())}`));
          console.log(chalk.green(`Project location: ${chalk.cyan(projectName)}/`));

        // Create Markov branch in new simplified architecture
  const rpcUrl = ((chain.rpc || []).find((u: any) => typeof u === "string" && /^https?:/i.test(u)) as string | undefined);
        const newBranch = await createBranchFromClone(hre, chain, diamondAddress!, rpcUrl);
        console.log(chalk.green(`\n✓ Created Markov branch '${newBranch}' (set as current)`));

        // Update clone metadata
        const metadata = {
          address: diamondAddress,
          chainId: chain.chainId,
          chainName: chain.name,
          clonedAt: new Date().toISOString(),
          facetCount: implementations.length,
        };
        saveCloneMetadata(projectRoot, metadata);

        // Summary
        console.log(chalk.bold.green("\n=== Bulk Clone Completed Successfully ===\n"));
        console.log(chalk.white("Summary:"));
        console.log(chalk.white(`  Diamond Address: ${chalk.cyan(diamondAddress)}`));
        console.log(chalk.white(`  Network: ${chalk.cyan(chain.name)} (Chain ID: ${chain.chainId})`));
          console.log(chalk.white(`  Project Name: ${chalk.cyan(projectName)}`));
        console.log(chalk.white(`  Deployments Cloned: ${chalk.cyan(successCount.toString())}/${chalk.cyan(implementations.length.toString())}`));
        console.log(chalk.white(`  Source Files Downloaded: ${chalk.cyan(totalFiles.toString())}`));
        console.log(chalk.white(`  Cloned At: ${chalk.cyan(metadata.clonedAt)}`));

        console.log(chalk.blue("\nNext steps:"));
          console.log(chalk.gray(`  1. Review the downloaded contract sources in ${projectName}/`));
        console.log(chalk.gray("  2. Run 'hardhat markov status' to check the current state"));
        console.log(chalk.gray("  3. Run 'hardhat markov log' to view version history"));
          console.log(chalk.gray(`\nAll ${implementations.length} deployment(s) have been merged into a unified codebase.`));
          console.log(chalk.gray("Duplicate files were overwritten with the latest version."));

        return;
      }

      // Single deployment selection workflow
      const selection = await promptUser(
        "Enter the serial no or full address of the deployment to clone:",
        (answer) => {
          const trimmed = answer.trim();
          if (/^\d+$/.test(trimmed)) {
            const idx = parseInt(trimmed, 10);
            return idx >= 1 && idx <= implementations.length;
          }
          if (isValidAddress(trimmed)) {
            return implementations.some((i) => i.address.toLowerCase() === trimmed.toLowerCase());
          }
          return false;
        }
      );

      // Resolve selection to an address
      let selectedImpl = implementations[0];
      if (/^\d+$/.test(selection)) {
        selectedImpl = implementations[parseInt(selection, 10) - 1];
      } else {
        const addr = selection.toLowerCase();
        const found = implementations.find((i) => i.address.toLowerCase() === addr);
        if (found) selectedImpl = found;
      }

      console.log(chalk.green(`\nSelected deployment: ${chalk.cyan(selectedImpl.name ?? "(unnamed)")} ${chalk.gray(selectedImpl.address)}`));

      // Set up project structure before downloading
      console.log(chalk.blue("\nSetting up project structure..."));
      const projectRoot = process.cwd();
      initializeMarkovDirectory(projectRoot);

      // Download the selected deployment
        // For single deployment, use deployment name or create a folder structure
        const singleProjectName = selectedImpl.name 
          ? `${selectedImpl.name}-Clone`
          : `Diamond-${diamondAddress.slice(2, 10)}`;
      
      console.log(chalk.blue("\nDownloading facet source code..."));
      const result = await downloadFacetSource(
        selectedImpl.address,
        1,
        1,
        projectRoot,
          singleProjectName,
        blockscout,
        false
      );

      console.log(chalk.green(`\nDownloaded source code for ${chalk.cyan("1")}/1 facet(s)`));
      console.log(chalk.green(`Total files saved: ${chalk.cyan(result.filesDownloaded.toString())}`));
        console.log(chalk.green(`Project location: ${chalk.cyan(singleProjectName)}/`));

      // Create Markov branch in new simplified architecture
  const rpcUrl = ((chain.rpc || []).find((u: any) => typeof u === "string" && /^https?:/i.test(u)) as string | undefined);
      const newBranch = await createBranchFromClone(hre, chain, diamondAddress!, rpcUrl);
      console.log(chalk.green(`\n✓ Created Markov branch '${newBranch}' (set as current)`));

      // Update clone metadata
      const metadata = {
        address: diamondAddress,
        chainId: chain.chainId,
        chainName: chain.name,
        clonedAt: new Date().toISOString(),
        facetCount: 1,
      };
      saveCloneMetadata(projectRoot, metadata);

      // Summary
      console.log(chalk.bold.green("\n=== Clone Completed Successfully ===\n"));
      console.log(chalk.white("Summary:"));
      console.log(chalk.white(`  Diamond Address: ${chalk.cyan(diamondAddress)}`));
      console.log(chalk.white(`  Network: ${chalk.cyan(chain.name)} (Chain ID: ${chain.chainId})`));
      console.log(chalk.white(`  Selected Deployment: ${chalk.cyan(selectedImpl.name ?? "(unnamed)")} ${chalk.gray(selectedImpl.address)}`));
    console.log(chalk.white(`  Project Name: ${chalk.cyan(singleProjectName)}`));
      console.log(chalk.white(`  Source Files Downloaded: ${chalk.cyan(result.filesDownloaded.toString())}`));
      console.log(chalk.white(`  Cloned At: ${chalk.cyan(metadata.clonedAt)}`));

      console.log(chalk.blue("\nNext steps:"));
    console.log(chalk.gray(`  1. Review the downloaded contract sources in ${singleProjectName}/`));
      console.log(chalk.gray("  2. Run 'hardhat markov status' to check the current state"));
      console.log(chalk.gray("  3. Run 'hardhat markov log' to view version history"));

      return;
    }

    // Initialize project structure
    console.log(chalk.blue("\nSetting up project structure..."));
    const projectRoot = process.cwd();
    initializeMarkovDirectory(projectRoot);

    // If no implementations, still create a Markov branch so user can proceed
    if (implementations.length === 0) {
  const rpcUrl = ((chain.rpc || []).find((u: any) => typeof u === "string" && /^https?:/i.test(u)) as string | undefined);
      const newBranch = await createBranchFromClone(hre, chain, diamondAddress!, rpcUrl);
      console.log(chalk.yellow("\nWarning: No implementations found via Blockscout."));
      console.log(chalk.green(`✓ Created Markov branch '${newBranch}' (set as current)`));
      return;
    }

  // (History.json legacy flow removed; branch files are created instead)

  } catch (error) {
    console.log(chalk.red("\nError during clone operation:"));
    console.log(chalk.red(error instanceof Error ? error.message : String(error)));
    
    if (error instanceof Error && error.stack) {
      console.log(chalk.gray("\nStack trace:"));
      console.log(chalk.gray(error.stack));
    }

    process.exit(1);
  }
}
