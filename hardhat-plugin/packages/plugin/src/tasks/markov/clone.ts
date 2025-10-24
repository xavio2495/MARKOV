import * as fs from "fs";
import * as path from "path";
import * as readline from "readline/promises";
import chalk from "chalk";
import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskArguments } from "hardhat/types/tasks";
import { getNetworkResolver, type ChainData } from "../../utils/network-resolver.js";
import { BlockscoutClient } from "../../utils/blockscout.js";

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
 * Clone an existing Diamond contract from another chain.
 */
export default async function markovClone(
  taskArguments: MarkovCloneArguments,
  hre: HardhatRuntimeEnvironment,
) {
  console.log(chalk.bold.blue("\n=== Cloning Diamond Contract ===\n"));

  // Debug: Show what arguments were received
  if (hre.config.markov?.verbose) {
    console.log(chalk.gray("Debug - Received arguments:"));
    console.log(chalk.gray(JSON.stringify(taskArguments, null, 2)));
  }

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

    // Debug: Show what we received
    if (hre.config.markov?.verbose) {
      console.log(chalk.gray(`\nDebug - Address Info:`));
      console.log(chalk.gray(JSON.stringify(addressInfo, null, 2)));
    }

    if (!addressInfo.isContract) {
      console.log(chalk.red(`\nError: Address ${diamondAddress} is not a contract`));
      console.log(chalk.yellow(`API returned isContract: ${addressInfo.isContract}`));
      console.log(chalk.gray("\nTip: Run with verbose mode to see full API response"));
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
    console.log(chalk.blue("\nQuerying Diamond deployments (implementations)..."));
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

  // Restrict cloning to the selected implementation only
  // We'll reuse the existing download flow but only for the chosen address
  console.log(chalk.blue("\nDownloading facet source code..."));
      let downloadedCount = 0;
      let downloadedFileCount = 0;

      const facetAddr = selectedImpl.address;
      console.log(chalk.gray(`  [1/1] ${facetAddr}...`));

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
                // Save with original directory structure
                const baseName = contractCode.name || `Facet_${facetAddr.slice(2, 8)}`;
                const filePath = path.join(projectRoot, "contracts", "facets", baseName, fileName);
                const fileDir = path.dirname(filePath);
                
                if (!fs.existsSync(fileDir)) {
                  fs.mkdirSync(fileDir, { recursive: true });
                }
                
                fs.writeFileSync(filePath, fileCode.sourceCode, "utf-8");
                downloadedFileCount++;
              }
            } catch (fileError) {
              if (hre.config.markov?.verbose) {
                console.log(chalk.gray(`      Failed to fetch ${fileName}: ${fileError instanceof Error ? fileError.message : String(fileError)}`));
              }
            }
          }
          
          console.log(chalk.green(`    Saved ${downloadedFileCount} file(s) to ${chalk.cyan(`contracts/facets/${contractCode.name}/`)}`));
          downloadedCount++;
        }
        // Strategy 2: Single-file contract with sourceCode directly
        else if (contractCode.sourceCode) {
          const facetName = contractCode.name || `Facet_${facetAddr.slice(2, 8)}`;
          const outPath = path.join(projectRoot, "contracts", "facets", `${facetName}.sol`);
          fs.writeFileSync(outPath, contractCode.sourceCode, "utf-8");
          console.log(chalk.green(`    Saved to ${chalk.cyan(`contracts/facets/${facetName}.sol`)}`));
          downloadedCount++;
          downloadedFileCount++;
        }
        // Strategy 3: Try Sourcify if available
        else if (contractCode.sourcifyRepoUrl) {
          console.log(chalk.gray(`    Trying Sourcify repository...`));
          const sourcifyData = await blockscout.fetchSourceFromSourcify(contractCode.sourcifyRepoUrl);
          
          if (sourcifyData && Object.keys(sourcifyData.sources).length > 0) {
            const baseName = contractCode.name || `Facet_${facetAddr.slice(2, 8)}`;
            
            for (const [filePathRel, sourceCode] of Object.entries(sourcifyData.sources)) {
              const targetPath = path.join(projectRoot, "contracts", "facets", baseName, filePathRel);
              const targetDir = path.dirname(targetPath);
              if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
              fs.writeFileSync(targetPath, sourceCode, "utf-8");
              downloadedFileCount++;
            }
            console.log(chalk.green(`    Saved ${Object.keys(sourcifyData.sources).length} file(s) from Sourcify`));
            downloadedCount++;
          } else {
            console.log(chalk.yellow(`    Sourcify fetch failed`));
          }
        } else {
          console.log(chalk.yellow(`    Source code not available (not verified)`));
        }
      } catch (error) {
        console.log(chalk.gray(`    Not verified individually (normal for Diamond facets)`));
      }

      console.log(chalk.green(`\nDownloaded source code for ${chalk.cyan(downloadedCount.toString())}/1 facet(s)`));
      console.log(chalk.green(`Total files saved: ${chalk.cyan(downloadedFileCount.toString())}`));

      // Build and write history.json
      const history = {
        version: "1.0.0",
        timestamp: new Date().toISOString(),
        branch: String(chain.chainId),
        head: selectedImpl.address,
        deployments: implementations,
        commits: [
          {
            hash: selectedImpl.address,
            message: "Cloned Diamond project",
            timestamp: new Date().toISOString(),
            author: "markov-cli",
            facets: [] as any[],
            type: "clone",
          },
        ],
      };

      const markovDir = path.join(projectRoot, ".markov");
      const historyPath = path.join(markovDir, "history.json");
      fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), "utf-8");
      console.log(chalk.green(`\nWrote ${chalk.cyan(".markov/history.json")} with head ${chalk.cyan(selectedImpl.address)}`));

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
      console.log(chalk.white(`  Source Files Downloaded: ${chalk.cyan(downloadedFileCount.toString())}`));
      console.log(chalk.white(`  Cloned At: ${chalk.cyan(metadata.clonedAt)}`));

      console.log(chalk.blue("\nNext steps:"));
      console.log(chalk.gray("  1. Review the downloaded contract sources under contracts/facets/"));
      console.log(chalk.gray("  2. Run 'hardhat markov status' to check the current state"));
      console.log(chalk.gray("  3. Run 'hardhat markov log' to view version history"));

      return;
    }

    // Initialize project structure
    console.log(chalk.blue("\nSetting up project structure..."));
    const projectRoot = process.cwd();
    initializeMarkovDirectory(projectRoot);

    // If no implementations, we can optionally fallback to old behavior, but for now, stop here
    if (implementations.length === 0) {
      console.log(chalk.red("\nNo deployments available to clone from. Exiting."));
      return;
    }

    // (Previously we reconstructed version history via events here; moved to after selection workflow above)

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
