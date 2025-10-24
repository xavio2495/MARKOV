/**
 * Chain data from chainlist.org
 * Used for network validation and RPC resolution
 */

export interface ChainData {
  name: string;
  chain: string;
  icon?: string;
  rpc: string[];
  features?: Array<{ name: string }>;
  faucets: string[];
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  infoURL: string;
  shortName: string;
  chainId: number;
  networkId: number;
  slip44?: number;
  ens?: { registry: string };
  explorers?: Array<{
    name: string;
    url: string;
    standard: string;
  }>;
  testnet?: boolean;
  slug?: string;
}

/**
 * Network resolver for validating and resolving network names/IDs to chain data
 */
export class NetworkResolver {
  private chains: ChainData[] = [];
  private chainsLoaded = false;

  /**
   * Load chain data from chainlist.org
   */
  async loadChains(): Promise<void> {
    if (this.chainsLoaded) return;

    try {
      const response = await fetch("https://chainlist.org/rpcs.json");
      if (!response.ok) {
        throw new Error(`Failed to fetch chains: ${response.statusText}`);
      }

      this.chains = await response.json() as ChainData[];
      this.chainsLoaded = true;
    } catch (error) {
      throw new Error(
        `Failed to load chain data from chainlist.org: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Find a chain by name, chain identifier, short name, network ID, or chain ID
   */
  async findChain(identifier: string | number): Promise<ChainData | null> {
    await this.loadChains();

    const searchTerm = String(identifier).toLowerCase();
    const numericId = typeof identifier === "number" ? identifier : parseInt(searchTerm, 10);

    // Try exact numeric match first (chainId or networkId)
    if (!isNaN(numericId)) {
      const byChainId = this.chains.find(c => c.chainId === numericId);
      if (byChainId) return byChainId;

      const byNetworkId = this.chains.find(c => c.networkId === numericId);
      if (byNetworkId) return byNetworkId;
    }

    // Try exact string matches
    const exactMatches = this.chains.filter(c => 
      c.name.toLowerCase() === searchTerm ||
      c.chain.toLowerCase() === searchTerm ||
      c.shortName.toLowerCase() === searchTerm
    );

    if (exactMatches.length === 1) {
      return exactMatches[0];
    }

    // Try partial matches
    const partialMatches = this.chains.filter(c =>
      c.name.toLowerCase().includes(searchTerm) ||
      c.chain.toLowerCase().includes(searchTerm) ||
      c.shortName.toLowerCase().includes(searchTerm)
    );

    if (partialMatches.length === 1) {
      return partialMatches[0];
    }

    // If multiple matches, prefer non-testnet
    if (partialMatches.length > 1) {
      const mainnetMatches = partialMatches.filter(c => !c.testnet);
      if (mainnetMatches.length === 1) {
        return mainnetMatches[0];
      }
    }

    return null;
  }

  /**
   * Search for chains matching a query
   */
  async searchChains(query: string, limit: number = 10): Promise<ChainData[]> {
    await this.loadChains();

    const searchTerm = query.toLowerCase();
    const matches = this.chains.filter(c =>
      c.name.toLowerCase().includes(searchTerm) ||
      c.chain.toLowerCase().includes(searchTerm) ||
      c.shortName.toLowerCase().includes(searchTerm)
    );

    return matches.slice(0, limit);
  }

  /**
   * Get chain by exact chain ID
   */
  async getChainById(chainId: number): Promise<ChainData | null> {
    await this.loadChains();
    return this.chains.find(c => c.chainId === chainId) || null;
  }

  /**
   * Get all loaded chains
   */
  getChains(): ChainData[] {
    return this.chains;
  }

  /**
   * Get RPC URLs for a chain (filters out empty strings)
   */
  getRpcUrls(chain: ChainData): string[] {
    return chain.rpc.filter(url => url && url.trim().length > 0);
  }

  /**
   * Get block explorer URL for a chain
   */
  getExplorerUrl(chain: ChainData): string | null {
    if (!chain.explorers || chain.explorers.length === 0) {
      return null;
    }

    // Prefer Blockscout explorers
    const blockscout = chain.explorers.find(e => 
      e.name.toLowerCase().includes("blockscout")
    );
    if (blockscout) return blockscout.url;

    // Otherwise return the first explorer
    return chain.explorers[0].url;
  }

  /**
   * Check if chain is a testnet
   */
  isTestnet(chain: ChainData): boolean {
    return chain.testnet === true;
  }

  /**
   * Format chain info for display
   */
  formatChainInfo(chain: ChainData): string {
    const parts = [
      chain.name,
      chain.testnet ? "(Testnet)" : "(Mainnet)",
      `Chain ID: ${chain.chainId}`,
    ];
    return parts.join(" ");
  }
}

/**
 * Singleton instance
 */
let networkResolverInstance: NetworkResolver | null = null;

/**
 * Get or create the network resolver instance
 */
export function getNetworkResolver(): NetworkResolver {
  if (!networkResolverInstance) {
    networkResolverInstance = new NetworkResolver();
  }
  return networkResolverInstance;
}
