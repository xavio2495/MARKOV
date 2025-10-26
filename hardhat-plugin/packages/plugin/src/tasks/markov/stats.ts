import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskArguments } from "hardhat/types/tasks";
import chalk from "chalk";
import { BlockscoutClient, CHAIN_IDS, getChainName } from "../../utils/blockscout.js";
import { getNetworkResolver } from "../../utils/network-resolver.js";

interface MarkovStatsArguments extends TaskArguments {
  address: string;
  chain: string;
  format: string;
}

interface ContractStatistics {
  contractName: string;
  address: string;
  evmVersion: string;
  optimizationRuns: number;
  compilerVersion: string;
  verifiedDate: string;
  createdBy: string;
  creationTxHash: string;
  deploymentTimestamp: string;
  deploymentGasUsed?: string;
  deploymentGasPrice?: string;
  deploymentGasLimit?: string;
  deploymentTxFee?: string;
  totalTransactions: number;
  totalTransfers: number;
  overallGasUsage: string;
  contractTransactions: number;
  upgradeHistory: UpgradeStats[];
  facetStats: FacetStats;
}

interface UpgradeStats {
  blockNumber: number;
  timestamp: number;
  txHash: string;
  gasUsed: string;
  facetsAdded: number;
  facetsReplaced: number;
  facetsRemoved: number;
}

interface FacetStats {
  totalFacets: number;
  totalAdditions: number;
  totalReplacements: number;
  totalRemovals: number;
  facetAddresses: string[];
}

/**
 * Display analytics and statistics.
 */
export default async function markovStats(
  taskArguments: MarkovStatsArguments,
  hre: HardhatRuntimeEnvironment,
) {
  // Centered header
  const headerText = "Smart Contract Statistics";
  const padding = Math.floor((68 - headerText.length) / 2);
  const centeredHeader = " ".repeat(padding) + headerText + " ".repeat(68 - padding - headerText.length);
  
  console.log(chalk.blue("\n╔════════════════════════════════════════════════════════════════════╗"));
  console.log(chalk.blue("║") + chalk.cyan.bold(centeredHeader) + chalk.blue("║"));
  console.log(chalk.blue("╚════════════════════════════════════════════════════════════════════╝\n"));

  // Validate contract address
  const contractAddress = taskArguments.address;
  if (!contractAddress) {
    console.log(chalk.red("❌ Contract address is required"));
    console.log(chalk.cyan("Usage:"));
    console.log(chalk.white("  npx hardhat markov stats <address> [--chain <network>] [--format <table|json>]"));
    console.log(chalk.gray("\nExamples:"));
    console.log(chalk.gray("  npx hardhat markov stats 0x1234567890abcdef1234567890abcdef12345678"));
    console.log(chalk.gray("  npx hardhat markov stats 0x1234567890abcdef1234567890abcdef12345678 --chain ethereum"));
    console.log(chalk.gray("  npx hardhat markov stats 0x1234567890abcdef1234567890abcdef12345678 --chain 1 --format json"));
    return;
  }

  // Validate address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
    console.log(chalk.red("❌ Invalid contract address format"));
    console.log(chalk.yellow("Address must be a valid 40-character hexadecimal string starting with 0x"));
    return;
  }

  console.log(chalk.gray(`Contract Address: ${chalk.cyan(contractAddress)}`));

  try {
    // Get chain ID from arguments or Hardhat config
    const chainId = await getChainId(taskArguments, hre);
    const blockscout = new BlockscoutClient(chainId);

    console.log(chalk.gray(`Network: ${chalk.cyan(getChainName(chainId))} (Chain ID: ${chainId})`));
    console.log(chalk.gray(`Fetching statistics from blockchain...\n`));

    // Gather all statistics
    const stats = await gatherContractStatistics(contractAddress, blockscout);

    // Display statistics based on format
    if (taskArguments.format === "json") {
      displayJsonStats(stats);
    } else {
      displayTableStats(stats);
    }

    console.log(chalk.green("\n✓ Statistics retrieved successfully"));
    console.log(chalk.cyan("\nTip: Use --format json for machine-readable output"));

  } catch (error) {
    console.log(chalk.red("\n❌ Failed to retrieve statistics"));
    console.log(chalk.yellow(`Error: ${error instanceof Error ? error.message : String(error)}`));
    console.log(chalk.gray("\nPlease ensure:"));
    console.log(chalk.gray("  1. The contract address is correct and deployed"));
    console.log(chalk.gray("  2. The network is supported by Blockscout"));
    console.log(chalk.gray("  3. The Blockscout API is accessible"));
    console.log(chalk.gray("  4. The contract is a Diamond proxy (for upgrade history)"));
  }
}

/**
 * Get chain ID from task arguments or Hardhat Runtime Environment
 */
async function getChainId(taskArguments: MarkovStatsArguments, hre: HardhatRuntimeEnvironment): Promise<number> {
  // First try to get from task arguments
  if (taskArguments.chain) {
    const resolver = getNetworkResolver();
    const chain = await resolver.findChain(taskArguments.chain);
    if (chain) {
      return chain.chainId;
    }
  }

  // Then try to get from Hardhat config
  const configChainId = (hre.config.markov as any)?.Chain;

  if (configChainId) {
    // Try to resolve chain name to chain ID
    const resolver = getNetworkResolver();
    const chain = await resolver.findChain(configChainId);
    if (chain) {
      return chain.chainId;
    }
  }

  // Default to Ethereum Sepolia testnet
  console.log(chalk.yellow("No chain specified, defaulting to Ethereum Sepolia (11155111)"));
  return CHAIN_IDS.SEPOLIA;
}

/**
 * Gather all contract statistics
 */
async function gatherContractStatistics(
  address: string,
  blockscout: BlockscoutClient,
): Promise<ContractStatistics> {
  console.log(chalk.blue("Fetching contract information..."));
  const addressInfo = await getAddressInfo(address, blockscout);

  console.log(chalk.blue("Fetching contract code and verification details..."));
  const contractCode = await getContractCodeInfo(address, blockscout);

  console.log(chalk.blue("Fetching deployment transaction details..."));
  const deploymentTx = await getDeploymentTransactionDetails(addressInfo.creationTxHash || "", blockscout);

  console.log(chalk.blue("Fetching transaction history..."));
  const transactionStats = await getTransactionStats(address, blockscout, addressInfo);

  console.log(chalk.blue("Fetching transfer history..."));
  const transferCount = await getTransferCount(address, blockscout, addressInfo);

  console.log(chalk.blue("Calculating gas usage..."));
  const gasUsage = await calculateGasUsage(address, blockscout, addressInfo);

  console.log(chalk.blue("Analyzing upgrade history (from facet implementations)..."));
  const upgradeHistory = await getUpgradeHistory(address, blockscout, contractCode);

  console.log(chalk.blue("Gathering facet statistics (Diamond contracts only)..."));
  const facetStats = await getFacetStatistics(address, blockscout, upgradeHistory, contractCode);

  return {
    contractName: contractCode.name || "Unknown Contract",
    address,
    evmVersion: contractCode.evmVersion || "Unknown",
    optimizationRuns: contractCode.optimizationRuns,
    compilerVersion: contractCode.compiler || "Unknown",
    verifiedDate: "N/A", // Blockscout doesn't provide this directly
    createdBy: addressInfo.creator || "Unknown",
    creationTxHash: addressInfo.creationTxHash || "Unknown",
    deploymentTimestamp: deploymentTx.timestamp || "Unknown",
    deploymentGasUsed: deploymentTx.gasUsed,
    deploymentGasPrice: deploymentTx.gasPrice,
    deploymentGasLimit: deploymentTx.gasLimit,
    deploymentTxFee: deploymentTx.txFee,
    totalTransactions: transactionStats.total,
    totalTransfers: transferCount,
    overallGasUsage: gasUsage.total,
    contractTransactions: transactionStats.contractCalls,
    upgradeHistory,
    facetStats,
  };
}

/**
 * Get address information
 */
async function getAddressInfo(address: string, blockscout: BlockscoutClient) {
  try {
    return await blockscout.getAddressInfo(address);
  } catch (error) {
    throw new Error(`Failed to get address info: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get deployment transaction details
 * Uses transaction data from Blockscout API
 * Extracts: timestamp, gas_used, gas_price, gas_limit, transaction_fee
 */
async function getDeploymentTransactionDetails(
  txHash: string,
  blockscout: BlockscoutClient,
): Promise<{ timestamp: string; gasUsed: string; gasPrice: string; gasLimit?: string; txFee?: string }> {
  try {
    if (!txHash) {
      return { timestamp: "Unknown", gasUsed: "0", gasPrice: "0" };
    }

    // Fetch transaction details from Blockscout REST API using direct_api_call
    // This provides timestamp in the response
    const txInfo = await blockscout.getTransactionByHash(txHash);
    
    if (!txInfo) {
      return { timestamp: "Unknown", gasUsed: "0", gasPrice: "0" };
    }

    // Extract and format timestamp
    // Blockscout REST API v2 returns timestamp as ISO 8601 string: "2025-10-25T16:29:59.000000Z"
    let timestamp = "Unknown";
    
    if (txInfo.timestamp) {
      try {
        let date: Date;
        
        // Check if timestamp is an ISO string or Unix seconds
        if (typeof txInfo.timestamp === "string") {
          // Check if it looks like ISO 8601 format (contains 'T' or '-')
          if (txInfo.timestamp.includes('T') || txInfo.timestamp.includes('-')) {
            // Parse ISO string directly
            date = new Date(txInfo.timestamp);
          } else {
            // Try parsing as Unix seconds
            const unixSeconds = parseInt(txInfo.timestamp, 10);
            date = new Date(unixSeconds * 1000);
          }
        } else {
          // Numeric value - treat as Unix seconds
          date = new Date(txInfo.timestamp * 1000);
        }

        // Validate the date is reasonable (not epoch/error)
        if (date.getTime() > 0 && !isNaN(date.getTime())) {
          timestamp = date.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            timeZoneName: 'short'
          });
        }
      } catch (e) {
        if (process.env.DEBUG_BLOCKSCOUT === "true") {
          console.log(`[DEBUG] Failed to parse timestamp "${txInfo.timestamp}":`, e instanceof Error ? e.message : e);
        }
      }
    }

    // Extract gas information (all in Wei, need conversion for display)
    const gasUsed = txInfo.gas_used ? String(txInfo.gas_used) : "0";
    const gasPrice = txInfo.gas_price ? String(txInfo.gas_price) : "0";
    const gasLimit = txInfo.gas_limit ? String(txInfo.gas_limit) : "0";

    // Calculate transaction fee (gas_used * gas_price = fee in Wei)
    let txFee = "0";
    if (gasUsed !== "0" && gasPrice !== "0") {
      try {
        const feeInWei = BigInt(gasUsed) * BigInt(gasPrice);
        // Convert Wei to ETH (1 ETH = 10^18 Wei)
        const feeInEth = Number(feeInWei) / 1e18;
        txFee = feeInEth.toFixed(18).replace(/\.?0+$/, ""); // Remove trailing zeros
      } catch {
        txFee = "0";
      }
    }

    if (process.env.DEBUG_BLOCKSCOUT === "true") {
      console.log(`[DEBUG] Deployment TX details: timestamp=${timestamp}, gasUsed=${gasUsed}, gasPrice=${gasPrice}, gasLimit=${gasLimit}, txFee=${txFee}`);
    }

    return {
      timestamp,
      gasUsed,
      gasPrice,
      gasLimit,
      txFee,
    };
  } catch (error) {
    console.log(chalk.yellow(`  ⚠️  Failed to get deployment transaction details: ${error instanceof Error ? error.message : String(error)}`));
    return { timestamp: "Unknown", gasUsed: "0", gasPrice: "0" };
  }
}

/**
 * Get contract code information
 */
async function getContractCodeInfo(address: string, blockscout: BlockscoutClient) {
  try {
    return await blockscout.inspectContractCode(address);
  } catch (error) {
    // If contract is not verified, return defaults
    console.log(chalk.yellow("  ⚠️  Contract is not verified on Blockscout"));
    return {
      name: "Unverified Contract",
      compiler: "Unknown",
      optimizationEnabled: false,
      optimizationRuns: 0,
      sourceCode: "",
      abi: [],
      evmVersion: "Unknown",
      isProxy: false,
      implementations: [],
    };
  }
}

/**
 * Get transaction statistics
 */
async function getTransactionStats(
  address: string,
  blockscout: BlockscoutClient,
  addressInfo?: any,
) {
  try {
    // Use tx_count from addressInfo if available (total transaction count)
    if (addressInfo?.tx_count) {
      const contractCalls = addressInfo.transactions_count || 0;
      return {
        total: addressInfo.tx_count,
        contractCalls,
      };
    }

    // Fallback: fetch from transactions (limited to 1000)
    const transactions = await blockscout.getTransactionsByAddress(address, undefined, undefined, 1000);
    
    const contractCalls = transactions.filter(tx => 
      tx.to?.toLowerCase() === address.toLowerCase()
    ).length;

    return {
      total: transactions.length,
      contractCalls,
    };
  } catch (error) {
    console.log(chalk.yellow(`  ⚠️  Failed to get transaction stats: ${error instanceof Error ? error.message : String(error)}`));
    return {
      total: 0,
      contractCalls: 0,
    };
  }
}

/**
 * Get transfer count (token transfers)
 */
async function getTransferCount(
  address: string,
  blockscout: BlockscoutClient,
  addressInfo?: any,
): Promise<number> {
  try {
    // Use token_transfers_count from addressInfo if available (total transfer count)
    if (addressInfo?.token_transfers_count) {
      return addressInfo.token_transfers_count;
    }

    // Fallback: get from transactions and filter for transfer-related ones
    const transactions = await blockscout.getTransactionsByAddress(address, undefined, undefined, 1000);
    
    // Count transactions with value > 0 or token transfer methods
    const transfers = transactions.filter(tx => {
      const hasValue = tx.value && BigInt(tx.value) > 0n;
      const isTransferMethod = tx.method?.toLowerCase().includes("transfer");
      return hasValue || isTransferMethod;
    });

    return transfers.length;
  } catch (error) {
    console.log(chalk.yellow(`  ⚠️  Failed to get transfer count: ${error instanceof Error ? error.message : String(error)}`));
    return 0;
  }
}

/**
 * Calculate overall gas usage
 */
async function calculateGasUsage(
  address: string,
  blockscout: BlockscoutClient,
  addressInfo?: any,
) {
  try {
    // Blockscout doesn't provide total gas usage in addressInfo
    // We need to fetch transaction gas data - but this requires fetching all txs
    // For now, attempt to get from a sample of recent transactions
    const transactions = await blockscout.getTransactionsByAddress(address, undefined, undefined, 1000);
    
    let totalGas = 0n;
    
    for (const tx of transactions) {
      if (tx.gasUsed) {
        totalGas += BigInt(tx.gasUsed);
      }
    }

    return {
      total: totalGas.toString(),
      formatted: formatGasUsage(totalGas),
    };
  } catch (error) {
    console.log(chalk.yellow(`  ⚠️  Failed to calculate gas usage: ${error instanceof Error ? error.message : String(error)}`));
    return {
      total: "0",
      formatted: "0",
    };
  }
}

/**
 * Get Diamond upgrade history
 */
async function getUpgradeHistory(
  address: string,
  blockscout: BlockscoutClient,
  contractCode?: any,
): Promise<UpgradeStats[]> {
  try {
    // If inspectContractCode provided implementations metadata, derive upgrades from those
    const impls = contractCode?.implementations && Array.isArray(contractCode.implementations)
      ? contractCode.implementations
      : null;

    const upgrades: UpgradeStats[] = [];

    if (impls && impls.length > 0) {
      // Each implementation entry corresponds to a facet deployment/upgrade
      for (const impl of impls) {
        const rawAddr = impl.address_hash || impl.address || impl;
        const facetAddr = typeof rawAddr === 'string' ? rawAddr.toLowerCase() : String(rawAddr);

        let txHash = "";
        let blockNumber = 0;
        let timestamp = 0;
        let gasUsed = "0";

        try {
          const info = await blockscout.getAddressInfo(facetAddr);
          txHash = info.creationTxHash || "";
          blockNumber = info.blockNumber || 0;

          // If we have a creation tx hash, fetch transaction details to get timestamp and gas
          if (txHash) {
            try {
              // Try to get transaction logs for block number confirmation
              const logs = await blockscout.getTransactionLogs(txHash);
              if (Array.isArray(logs) && logs.length > 0) {
                blockNumber = logs[0].blockNumber || blockNumber;
              }
              
              // Also fetch transaction details for timestamp and gas
              const txInfo = await blockscout.getTransactionByHash(txHash);
              if (txInfo) {
                // Extract timestamp from transaction (may be ISO string or Unix seconds)
                if (txInfo.timestamp) {
                  try {
                    let date: Date;
                    if (typeof txInfo.timestamp === "string") {
                      if (txInfo.timestamp.includes('T') || txInfo.timestamp.includes('-')) {
                        date = new Date(txInfo.timestamp);
                      } else {
                        const unixSeconds = parseInt(txInfo.timestamp, 10);
                        date = new Date(unixSeconds * 1000);
                      }
                    } else {
                      date = new Date(txInfo.timestamp * 1000);
                    }
                    if (date.getTime() > 0 && !isNaN(date.getTime())) {
                      timestamp = Math.floor(date.getTime() / 1000); // Convert back to Unix seconds for storage
                    }
                  } catch {
                    // keep timestamp as 0
                  }
                }
                
                // Extract gas used if available
                if (txInfo.gas_used) {
                  gasUsed = String(txInfo.gas_used);
                }
              }
            } catch {
              // ignore failures
            }
          }
        } catch {
          // ignore failures per-implementation
        }

        // Each implementation corresponds to an addition in the upgrade history
        upgrades.push({
          blockNumber,
          timestamp,
          txHash: txHash || "",
          gasUsed,
          facetsAdded: 1,
          facetsReplaced: 0,
          facetsRemoved: 0,
        });
      }

      return upgrades.sort((a, b) => a.blockNumber - b.blockNumber);
    }

    // Fallback: use DiamondCut events if implementations metadata not available
    const diamondCutEvents = await blockscout.getDiamondCutEvents(address);
    for (const event of diamondCutEvents) {
      let facetsAdded = 0;
      let facetsReplaced = 0;
      let facetsRemoved = 0;

      let cuts = event.facetCuts || [];
      if ((!cuts || cuts.length === 0) && event.txHash) {
        try {
          const logs = await blockscout.getTransactionLogs(event.txHash);
          for (const log of logs) {
            const decoded = (log as any).decoded || (log as any).decoded_event || null;
            const args = decoded?.args || decoded?.arguments || decoded?.params || decoded?.values || decoded?.data;
            if (Array.isArray(args) && args.length > 0) {
              if (Array.isArray(args[0])) {
                cuts = args[0];
                break;
              } else if (args[0] && typeof args[0] === 'object') {
                cuts = args[0].facets || args[0]._facets || args[0].facetCuts || [];
                if (cuts && cuts.length > 0) break;
              }
            }
          }
        } catch {
          // ignore
        }
      }

      for (const cut of cuts) {
        const action = (cut as any).action ?? (cut as any)[0] ?? (cut as any).type;
        if (action === 0) facetsAdded++;
        else if (action === 1) facetsReplaced++;
        else if (action === 2) facetsRemoved++;
      }

      let gasUsed = "0";
      try {
        const txInfo = await blockscout.getTransactionsByAddress(address);
        const tx = txInfo.find(t => t.hash === event.txHash);
        if (tx?.gasUsed) gasUsed = tx.gasUsed;
      } catch {
        // ignore
      }

      upgrades.push({
        blockNumber: event.blockNumber,
        timestamp: event.timestamp,
        txHash: event.txHash,
        gasUsed,
        facetsAdded,
        facetsReplaced,
        facetsRemoved,
      });
    }

    return upgrades.sort((a, b) => a.blockNumber - b.blockNumber);
  } catch (error) {
    console.log(chalk.yellow(`  ⚠️  Failed to get upgrade history: ${error instanceof Error ? error.message : String(error)}`));
    return [];
  }
}

/**
 * Get facet statistics
 */
async function getFacetStatistics(
  address: string,
  blockscout: BlockscoutClient,
  upgradeHistory: UpgradeStats[],
  contractCode?: any,
): Promise<FacetStats> {
  try {
    console.log(chalk.blue("Fetching current facet list..."));
    const facets = await blockscout.getDiamondFacets(address);
    console.log(chalk.green(`  ✓ Found ${facets.length} facets`));

    let totalAdditions = 0;
    let totalReplacements = 0;
    let totalRemovals = 0;

    // If implementations metadata is available in contractCode, use it to compute totals
    const impls = contractCode?.implementations && Array.isArray(contractCode.implementations)
      ? contractCode.implementations
      : null;

    if (impls && impls.length > 0) {
      totalAdditions = impls.length;
      // metadata doesn't provide explicit replace/remove counts, leave them as 0
      totalReplacements = 0;
      totalRemovals = 0;
    } else {
      for (const upgrade of upgradeHistory) {
        totalAdditions += upgrade.facetsAdded;
        totalReplacements += upgrade.facetsReplaced;
        totalRemovals += upgrade.facetsRemoved;
      }
    }

    const facetAddresses = facets.map(f => f.facetAddress);
    console.log(chalk.green(`  ✓ Facet addresses: ${facetAddresses.length > 0 ? facetAddresses.slice(0, 3).join(', ') + (facetAddresses.length > 3 ? '...' : '') : 'None'}`));

    return {
      totalFacets: facets.length,
      totalAdditions,
      totalReplacements,
      totalRemovals,
      facetAddresses,
    };
  } catch (error) {
    console.log(chalk.yellow(`  ⚠️  Failed to get facet statistics: ${error instanceof Error ? error.message : String(error)}`));
    console.log(chalk.yellow(`  ⚠️  This contract may not be a Diamond proxy or the loupe functions may not be accessible`));
    console.log(chalk.gray(`     Diamond contracts should implement IDiamondLoupe interface with facets() function`));
    return {
      totalFacets: 0,
      totalAdditions: 0,
      totalReplacements: 0,
      totalRemovals: 0,
      facetAddresses: [],
    };
  }
}

/**
 * Display statistics in table format
 */
function displayTableStats(stats: ContractStatistics): void {
  console.log(chalk.bold.cyan("\n=== Contract Information ==="));
  console.log(chalk.white(`  Contract Name:       ${chalk.green(stats.contractName)}`));
  console.log(chalk.white(`  Address:             ${chalk.cyan(stats.address)}`));
  console.log(chalk.white(`  Created By:          ${chalk.yellow(stats.createdBy)}`));
  console.log(chalk.white(`  Creation Tx:         ${chalk.cyan(stats.creationTxHash)}`));
  console.log(chalk.white(`  Deployment Date:     ${chalk.yellow(stats.deploymentTimestamp)}`));
  
  if (stats.deploymentGasUsed && stats.deploymentGasUsed !== "0") {
    console.log(chalk.white(`  Deployment Gas Used: ${chalk.cyan(formatGasUsage(BigInt(stats.deploymentGasUsed)))}`));
  }
  if (stats.deploymentGasPrice && stats.deploymentGasPrice !== "0") {
    const gasPriceGwei = (Number(stats.deploymentGasPrice) / 1e9).toFixed(9);
    console.log(chalk.white(`  Gas Price:           ${chalk.cyan(gasPriceGwei + " Gwei")}`));
  }
  if (stats.deploymentGasLimit && stats.deploymentGasLimit !== "0") {
    console.log(chalk.white(`  Gas Limit:           ${chalk.cyan(formatGasUsage(BigInt(stats.deploymentGasLimit)))}`));
  }
  if (stats.deploymentTxFee && stats.deploymentTxFee !== "0") {
    console.log(chalk.white(`  Transaction Fee:     ${chalk.cyan(stats.deploymentTxFee + " ETH")}`));
  }
  
  console.log(chalk.white(`  EVM Version:         ${chalk.yellow(stats.evmVersion)}`));
  console.log(chalk.white(`  Compiler Version:    ${chalk.yellow(stats.compilerVersion)}`));
  console.log(chalk.white(`  Optimization Runs:   ${chalk.yellow(stats.optimizationRuns.toString())}`));

  console.log(chalk.bold.cyan("\n=== Transaction Statistics ==="));
  console.log(chalk.white(`  Total Transactions:  ${chalk.green(stats.totalTransactions.toString())}`));
  console.log(chalk.white(`  Contract Calls:      ${chalk.green(stats.contractTransactions.toString())}`));
  console.log(chalk.white(`  Total Transfers:     ${chalk.green(stats.totalTransfers.toString())}`));
  console.log(chalk.white(`  Overall Gas Usage:   ${chalk.yellow(formatGasUsage(BigInt(stats.overallGasUsage)))}`));

  console.log(chalk.bold.cyan("\n=== Facet Statistics ==="));
  console.log(chalk.white(`  Current Facets:      ${chalk.green(stats.facetStats.totalFacets.toString())}`));
  console.log(chalk.white(`  Total Additions:     ${chalk.green(stats.facetStats.totalAdditions.toString())}`));
  console.log(chalk.white(`  Total Replacements:  ${chalk.yellow(stats.facetStats.totalReplacements.toString())}`));
  console.log(chalk.white(`  Total Removals:      ${chalk.red(stats.facetStats.totalRemovals.toString())}`));

  if (stats.upgradeHistory.length > 0) {
    console.log(chalk.bold.cyan("\n=== Upgrade History (Diamond Contracts) ==="));
    console.log(chalk.gray(`  Total Upgrades: ${stats.upgradeHistory.length}`));
    
    for (const [index, upgrade] of stats.upgradeHistory.entries()) {
      console.log(chalk.white(`\n  Upgrade #${index + 1}`));
      console.log(chalk.gray(`    Block:      ${upgrade.blockNumber}`));
      console.log(chalk.gray(`    Date:       ${new Date(upgrade.timestamp * 1000).toLocaleString()}`));
      console.log(chalk.gray(`    Tx Hash:    ${upgrade.txHash.slice(0, 10)}...${upgrade.txHash.slice(-8)}`));
      console.log(chalk.gray(`    Gas Used:   ${formatGasUsage(BigInt(upgrade.gasUsed))}`));
      console.log(chalk.gray(`    Changes:    +${upgrade.facetsAdded} Added, ~${upgrade.facetsReplaced} Replaced, -${upgrade.facetsRemoved} Removed`));
    }

    // Calculate average gas per upgrade
    const totalUpgradeGas = stats.upgradeHistory.reduce((sum, u) => sum + BigInt(u.gasUsed), 0n);
    const avgGasPerUpgrade = stats.upgradeHistory.length > 0 
      ? totalUpgradeGas / BigInt(stats.upgradeHistory.length)
      : 0n;

    console.log(chalk.bold.cyan("\n=== Gas Usage Analysis ==="));
    console.log(chalk.white(`  Total Upgrade Gas:   ${chalk.yellow(formatGasUsage(totalUpgradeGas))}`));
    console.log(chalk.white(`  Avg Gas/Upgrade:     ${chalk.yellow(formatGasUsage(avgGasPerUpgrade))}`));
  } else {
    console.log(chalk.bold.cyan("\n=== Upgrade History ==="));
    console.log(chalk.gray("  No upgrades detected (not a Diamond contract or no upgrades yet)"));
  }

  if (stats.facetStats.facetAddresses.length > 0) {
    console.log(chalk.bold.cyan("\n=== Active Facets (Diamond Contracts) ==="));
    for (const [index, facetAddress] of stats.facetStats.facetAddresses.entries()) {
      console.log(chalk.gray(`  ${index + 1}. ${facetAddress}`));
    }
  }
}

/**
 * Display statistics in JSON format
 */
function displayJsonStats(stats: ContractStatistics): void {
  const jsonOutput = {
    contract: {
      name: stats.contractName,
      address: stats.address,
      createdBy: stats.createdBy,
      creationTxHash: stats.creationTxHash,
      deploymentTimestamp: stats.deploymentTimestamp,
      deploymentGasUsed: stats.deploymentGasUsed,
      deploymentGasPrice: stats.deploymentGasPrice,
      deploymentGasLimit: stats.deploymentGasLimit,
      deploymentTxFee: stats.deploymentTxFee,
      evmVersion: stats.evmVersion,
      compilerVersion: stats.compilerVersion,
      optimizationRuns: stats.optimizationRuns,
      verifiedDate: stats.verifiedDate,
    },
    transactions: {
      total: stats.totalTransactions,
      contractCalls: stats.contractTransactions,
      transfers: stats.totalTransfers,
    },
    gas: {
      overall: stats.overallGasUsage,
      formatted: formatGasUsage(BigInt(stats.overallGasUsage)),
    },
    facets: {
      current: stats.facetStats.totalFacets,
      additions: stats.facetStats.totalAdditions,
      replacements: stats.facetStats.totalReplacements,
      removals: stats.facetStats.totalRemovals,
      addresses: stats.facetStats.facetAddresses,
    },
    upgrades: stats.upgradeHistory.map(u => ({
      blockNumber: u.blockNumber,
      timestamp: u.timestamp,
      date: new Date(u.timestamp * 1000).toISOString(),
      txHash: u.txHash,
      gasUsed: u.gasUsed,
      gasFormatted: formatGasUsage(BigInt(u.gasUsed)),
      changes: {
        added: u.facetsAdded,
        replaced: u.facetsReplaced,
        removed: u.facetsRemoved,
      },
    })),
  };

  console.log(JSON.stringify(jsonOutput, null, 2));
}

/**
 * Format gas usage for display
 */
function formatGasUsage(gas: bigint): string {
  if (gas === 0n) return "0";
  
  const gasNum = Number(gas);
  
  if (gasNum >= 1_000_000) {
    return `${(gasNum / 1_000_000).toFixed(2)}M`;
  } else if (gasNum >= 1_000) {
    return `${(gasNum / 1_000).toFixed(2)}K`;
  }
  
  return gasNum.toString();
}
