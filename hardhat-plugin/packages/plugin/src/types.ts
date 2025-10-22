export interface MyPluginUserConfig {
  greeting?: string;
}

export interface MyPluginConfig {
  greeting: string;
}

// Markov plugin configuration types
export interface MarkovUserConfig {
  // Network and deployment settings
  chain?: string; // EVM chain identifier
  wallet?: string; // User wallet address
  gasPrice?: string | number; // Gas price for transactions
  author?: string; // Default commit author

  // AI integration settings
  aiApiKey?: string; // API key for AI services (OpenAI, etc.)
  aiModel?: string; // AI model to use (default: gpt-4)

  // Governance settings
  governanceAddress?: string; // Optional DAO/governance contract address

  // MCP (Model Context Protocol) settings
  mcpEndpoint?: string; // MCP server endpoint
  agentverseApiToken?: string; // Agentverse API token for agent integration

  // Storage and behavior settings
  historyPath?: string; // Path to history.json (default: .markov/history.json)
  verbose?: boolean; // Verbose logging
  autoSync?: boolean; // Auto-sync with on-chain events
}

export interface MarkovConfig {
  // Network and deployment settings
  chain: string;
  wallet: string;
  gasPrice: string | number;
  author: string;

  // AI integration settings
  aiApiKey?: string;
  aiModel: string;

  // Governance settings
  governanceAddress?: string;

  // MCP settings
  mcpEndpoint: string;
  agentverseApiToken?: string;

  // Storage and behavior settings
  historyPath: string;
  verbose: boolean;
  autoSync: boolean;
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

export interface BranchInfo {
  name: string;
  commits: Commit[];
  currentCommitHash?: string;
}

export interface HistoryData {
  branches: Map<string, BranchInfo>;
  currentBranch: string;
  diamondAddress?: string;
  commitIndex: Map<string, { branch: string; index: number }>; // Fast lookup
}
