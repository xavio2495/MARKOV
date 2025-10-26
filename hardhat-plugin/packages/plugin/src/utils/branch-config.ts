import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { HttpNetworkConfig } from "hardhat/types/config";
import type { BranchConfig } from "../types.js";
import chalk from "chalk";

/**
 * Manages branch configurations and multi-chain settings
 */
export class BranchConfigManager {
  constructor(private hre: HardhatRuntimeEnvironment) {}

  /**
   * Get network configuration for a given chain identifier
   */
  getNetworkConfig(chainIdentifier: string): {
    name: string;
    chainId?: number;
    url?: string;
  } | null {
    // First, check if it's a network name
    const networks = this.hre.config.networks;
    if (networks[chainIdentifier]) {
      const network = networks[chainIdentifier];
      const url = "url" in network ? String(network.url) : undefined;
      return {
        name: chainIdentifier,
        chainId: network.chainId,
        url,
      };
    }

    // Try to find by chain ID
    const chainId = parseInt(chainIdentifier);
    if (!isNaN(chainId)) {
      for (const [name, network] of Object.entries(networks)) {
        if (network.chainId === chainId) {
          const url = "url" in network ? String(network.url) : undefined;
          return {
            name,
            chainId: network.chainId,
            url,
          };
        }
      }
    }

    return null;
  }

  /**
   * Validate that a network is configured in hardhat.config
   */
  validateNetworkExists(chainIdentifier: string): boolean {
    return this.getNetworkConfig(chainIdentifier) !== null;
  }

  /**
   * Get RPC URL for a chain
   */
  getRpcUrl(chainIdentifier: string): string | null {
    const network = this.getNetworkConfig(chainIdentifier);
    return network?.url || null;
  }

  /**
   * Get chain ID for a network
   */
  getChainId(chainIdentifier: string): number | null {
    const network = this.getNetworkConfig(chainIdentifier);
    return network?.chainId || null;
  }

  /**
   * List all available networks
   */
  listAvailableNetworks(): string[] {
    return Object.keys(this.hre.config.networks).filter(
      (name) => name !== "hardhat" // Exclude internal Hardhat network
    );
  }

  /**
   * Get explorer URL for a chain
   */
  getExplorerUrl(chainIdentifier: string): string | null {
    const chainId = this.getChainId(chainIdentifier);
    if (!chainId) return null;

    // Common explorer URLs by chain ID
    const explorerMap: Record<number, string> = {
      1: "https://etherscan.io",
      5: "https://goerli.etherscan.io",
      11155111: "https://sepolia.etherscan.io",
      137: "https://polygonscan.com",
      80001: "https://mumbai.polygonscan.com",
      56: "https://bscscan.com",
      97: "https://testnet.bscscan.com",
      43114: "https://snowtrace.io",
      43113: "https://testnet.snowtrace.io",
      42161: "https://arbiscan.io",
      421613: "https://goerli.arbiscan.io",
      10: "https://optimistic.etherscan.io",
      420: "https://goerli-optimism.etherscan.io",
    };

    return explorerMap[chainId] || null;
  }

  /**
   * Create a branch configuration from user inputs
   */
  async createBranchConfig(
    branchName: string,
    chainIdentifier: string,
    diamondAddress: string,
    createdFrom?: string,
    createdFromCommit?: string
  ): Promise<BranchConfig> {
    const network = this.getNetworkConfig(chainIdentifier);
    if (!network) {
      throw new Error(`Network '${chainIdentifier}' not found in hardhat.config`);
    }

    if (!network.url) {
      throw new Error(`Network '${chainIdentifier}' does not have an RPC URL configured`);
    }

    const config: BranchConfig = {
      name: branchName,
      chain: network.name,
      chainId: network.chainId,
      rpcUrl: network.url,
      diamondAddress,
      explorerUrl: this.getExplorerUrl(chainIdentifier) || undefined,
      createdAt: Date.now(),
      createdFrom,
      createdFromCommit,
    };

    return config;
  }

  /**
   * Display network information
   */
  displayNetworkInfo(config: BranchConfig): void {
    console.log(chalk.cyan("\n📡 Network Configuration:"));
    console.log(chalk.gray("   Network:"), chalk.white(config.chain));
    if (config.chainId) {
      console.log(chalk.gray("   Chain ID:"), chalk.white(config.chainId));
    }
    console.log(chalk.gray("   RPC URL:"), chalk.white(config.rpcUrl));
    console.log(chalk.gray("   Diamond:"), chalk.white(config.diamondAddress));
    if (config.explorerUrl) {
      console.log(chalk.gray("   Explorer:"), chalk.white(config.explorerUrl));
    }
  }

  /**
   * Validate RPC connection
   */
  async validateRpcConnection(rpcUrl: string): Promise<boolean> {
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          method: "eth_chainId",
          params: [],
          id: 1,
        }),
      });

      const data = (await response.json()) as { result?: string };
      return !!data.result;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get current network
   */
  getCurrentNetwork(): string {
    // Use markov config's chain as current network, or fallback to hardhat
    return (this.hre.config.markov as any)?.Chain || "hardhat";
  }

  /**
   * Check if network is localhost/hardhat
   */
  isLocalNetwork(chainIdentifier?: string): boolean {
    const network = chainIdentifier || this.getCurrentNetwork();
    return network === "localhost" || network === "hardhat";
  }
}

/**
 * Factory function to create BranchConfigManager
 */
export function createBranchConfigManager(hre: HardhatRuntimeEnvironment): BranchConfigManager {
  return new BranchConfigManager(hre);
}
