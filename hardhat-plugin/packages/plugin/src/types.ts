export interface MyPluginUserConfig {
  greeting?: string;
}

export interface MyPluginConfig {
  greeting: string;
}

// Markov plugin configuration types
export interface MarkovUserConfig {
  // Configuration keys (stored as uppercase snake_case)
  AGENTVERSE_API_TOKEN?: string; // Agentverse API token
  ASI_API_KEY?: string; // ASI API key for AI services
  Author?: string; // Default commit author
  Auto_Sync?: boolean; // Auto-sync with on-chain events
  Chain?: string; // EVM chain identifier
  Gas_Price?: number; // Gas price for transactions
  Governance_Address?: string; // DAO/governance contract address
  Wallet_Address?: string; // User wallet address

  // Branch configurations (multi-chain support)
  branches?: Record<string, BranchUserConfig>; // Branch-specific settings
}

export interface BranchUserConfig {
  chain?: string; // Chain identifier for this branch
  rpcUrl?: string; // RPC URL override
  diamondAddress?: string; // Diamond address for this branch
  explorerApiKey?: string; // Explorer API key
  explorerUrl?: string; // Explorer URL
}

export interface MarkovConfig {
  // Configuration keys (uppercase snake_case with defaults applied)
  AGENTVERSE_API_TOKEN?: string;
  ASI_API_KEY?: string;
  Author: string;
  Auto_Sync: boolean;
  Chain: string;
  Gas_Price: number;
  Governance_Address?: string;
  Wallet_Address: string;

  // Branch configurations
  branches: Record<string, BranchConfig>;
}

// Diamond-related types
export interface FacetCut {
  facetAddress: string;
  action: 0 | 1 | 2; // Add=0, Replace=1, Remove=2
  functionSelectors: string[]; // Array of bytes4 selectors
}

export interface Commit {
  hash: string; // SHA-256 hash of commit content
  timestamp: number; // Unix timestamp
  author: string; // Author name/address
  message: string; // Commit message
  diamondAddress: string; // Address of the Diamond contract
  cut: FacetCut[]; // Array of facet cuts
  parentHash?: string; // Parent commit hash (for DAG)
  parentHashes?: string[]; // Multiple parents for merge commits
  branch: string; // Branch name
}

// Branch configuration for multi-chain deployment
export interface BranchConfig {
  name: string; // Branch name (e.g., "main", "dev", "staging")
  chain: string; // Chain identifier (e.g., "mainnet", "sepolia", "localhost")
  chainId?: number; // Numeric chain ID
  rpcUrl: string; // RPC endpoint URL
  diamondAddress: string; // Deployed Diamond contract address on this chain
  explorerApiKey?: string; // API key for blockchain explorer (Blockscout, Etherscan, etc.)
  explorerUrl?: string; // Explorer base URL
  createdAt: number; // Unix timestamp of branch creation
  createdFrom?: string; // Parent branch name (if cloned)
  createdFromCommit?: string; // Parent commit hash (if cloned)
}

export interface BranchInfo {
  name: string;
  commits: Commit[];
  currentCommitHash?: string;
  config: BranchConfig; // Multi-chain configuration
}

export interface HistoryData {
  branches: Map<string, BranchInfo>;
  currentBranch: string;
  diamondAddress?: string; // Deprecated: use BranchInfo.config.diamondAddress
  commitIndex: Map<string, { branch: string; index: number }>; // Fast lookup
}
