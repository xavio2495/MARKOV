import type { Commit, BranchConfig, FacetCut } from "../types.js";

/**
 * Strict TypeScript interface for branch JSON files
 * Each branch file is self-contained with its own config and commit history
 */
export interface BranchFile {
  name: string;
  config: BranchConfig;
  commits: Commit[];
}

/**
 * JSON Schema for branch file validation
 * Used to validate .markov/branches/<name>.json files
 */
export const BRANCH_FILE_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["name", "config", "commits"],
  properties: {
    name: {
      type: "string",
      description: "Branch name (must match filename without .json)",
      pattern: "^[a-zA-Z0-9_-]+$",
    },
    config: {
      type: "object",
      required: ["name", "chain", "rpcUrl", "diamondAddress", "createdAt"],
      properties: {
        name: {
          type: "string",
          description: "Branch name (duplicated for validation)",
        },
        chain: {
          type: "string",
          description: "Chain identifier (e.g., mainnet, sepolia, localhost)",
        },
        chainId: {
          type: "number",
          description: "Numeric chain ID (optional)",
        },
        rpcUrl: {
          type: "string",
          description: "RPC endpoint URL for this branch",
        },
        diamondAddress: {
          type: "string",
          description: "Deployed Diamond contract address on this chain",
          pattern: "^0x[a-fA-F0-9]{40}$",
        },
        explorerApiKey: {
          type: "string",
          description: "API key for blockchain explorer (optional)",
        },
        explorerUrl: {
          type: "string",
          description: "Explorer base URL (optional)",
        },
        createdAt: {
          type: "number",
          description: "Unix timestamp of branch creation",
        },
        createdFrom: {
          type: "string",
          description: "Parent branch name (optional)",
        },
        createdFromCommit: {
          type: "string",
          description: "Parent commit hash (optional)",
        },
      },
    },
    commits: {
      type: "array",
      description: "Array of commits for this branch (oldest first)",
      items: {
        type: "object",
        required: [
          "hash",
          "timestamp",
          "author",
          "message",
          "diamondAddress",
          "cut",
          "branch",
        ],
        properties: {
          hash: {
            type: "string",
            description: "SHA-256 hash of commit content (16 chars)",
            pattern: "^[a-fA-F0-9]{16}$",
          },
          timestamp: {
            type: "number",
            description: "Unix timestamp",
          },
          author: {
            type: "string",
            description: "Author name/address",
          },
          message: {
            type: "string",
            description: "Commit message",
          },
          diamondAddress: {
            type: "string",
            description: "Diamond contract address",
            pattern: "^0x[a-fA-F0-9]{40}$",
          },
          cut: {
            type: "array",
            description: "Array of facet cuts",
            items: {
              type: "object",
              required: ["facetAddress", "action", "functionSelectors"],
              properties: {
                facetAddress: {
                  type: "string",
                  description: "Facet contract address",
                  pattern: "^0x[a-fA-F0-9]{40}$",
                },
                action: {
                  type: "number",
                  description: "FacetCut action (0=Add, 1=Replace, 2=Remove)",
                  enum: [0, 1, 2],
                },
                functionSelectors: {
                  type: "array",
                  description: "Array of bytes4 function selectors",
                  items: {
                    type: "string",
                    pattern: "^0x[a-fA-F0-9]{8}$",
                  },
                },
              },
            },
          },
          parentHash: {
            type: ["string", "null"],
            description: "Parent commit hash (null for initial commit)",
            pattern: "^[a-fA-F0-9]{16}$",
          },
          parentHashes: {
            type: "array",
            description: "Multiple parents for merge commits (optional)",
            items: {
              type: "string",
              pattern: "^[a-fA-F0-9]{16}$",
            },
          },
          branch: {
            type: "string",
            description: "Branch name (must match branch file)",
          },
        },
      },
    },
  },
} as const;

/**
 * Validates a branch file against the JSON schema
 * @param data The parsed JSON data to validate
 * @returns Validation result with errors if invalid
 */
export function validateBranchFile(data: unknown): {
  valid: boolean;
  errors: string[];
  data?: BranchFile;
} {
  const errors: string[] = [];

  // Type guard checks
  if (typeof data !== "object" || data === null) {
    return { valid: false, errors: ["Branch file must be a JSON object"] };
  }

  const obj = data as Record<string, unknown>;

  // Check required fields
  if (typeof obj.name !== "string") {
    errors.push("Missing or invalid 'name' field (must be string)");
  }

  if (typeof obj.config !== "object" || obj.config === null) {
    errors.push("Missing or invalid 'config' field (must be object)");
  } else {
    const config = obj.config as Record<string, unknown>;
    if (typeof config.name !== "string") {
      errors.push("Missing or invalid 'config.name' field");
    }
    if (typeof config.chain !== "string") {
      errors.push("Missing or invalid 'config.chain' field");
    }
    if (typeof config.rpcUrl !== "string") {
      errors.push("Missing or invalid 'config.rpcUrl' field");
    }
    if (typeof config.diamondAddress !== "string") {
      errors.push("Missing or invalid 'config.diamondAddress' field");
    } else if (!/^0x[a-fA-F0-9]{40}$/.test(config.diamondAddress)) {
      errors.push("Invalid 'config.diamondAddress' format (must be 0x + 40 hex chars)");
    }
    if (typeof config.createdAt !== "number") {
      errors.push("Missing or invalid 'config.createdAt' field (must be number)");
    }
  }

  if (!Array.isArray(obj.commits)) {
    errors.push("Missing or invalid 'commits' field (must be array)");
  } else {
    // Validate each commit
    for (let i = 0; i < obj.commits.length; i++) {
      const commit = obj.commits[i];
      if (typeof commit !== "object" || commit === null) {
        errors.push(`Commit at index ${i} is not an object`);
        continue;
      }

      const c = commit as Record<string, unknown>;
      if (typeof c.hash !== "string" || !/^[a-fA-F0-9]{16}$/.test(c.hash)) {
        errors.push(`Commit ${i}: invalid 'hash' field`);
      }
      if (typeof c.timestamp !== "number") {
        errors.push(`Commit ${i}: invalid 'timestamp' field`);
      }
      if (typeof c.author !== "string") {
        errors.push(`Commit ${i}: invalid 'author' field`);
      }
      if (typeof c.message !== "string") {
        errors.push(`Commit ${i}: invalid 'message' field`);
      }
      if (
        typeof c.diamondAddress !== "string" ||
        !/^0x[a-fA-F0-9]{40}$/.test(c.diamondAddress)
      ) {
        errors.push(`Commit ${i}: invalid 'diamondAddress' field`);
      }
      if (!Array.isArray(c.cut)) {
        errors.push(`Commit ${i}: 'cut' field must be array`);
      }
      if (typeof c.branch !== "string") {
        errors.push(`Commit ${i}: invalid 'branch' field`);
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, errors: [], data: data as BranchFile };
}

/**
 * Type guard for BranchFile
 */
export function isBranchFile(data: unknown): data is BranchFile {
  const result = validateBranchFile(data);
  return result.valid;
}

/**
 * Creates a new empty branch file with initial config
 */
export function createEmptyBranchFile(
  name: string,
  config: Omit<BranchConfig, "name">,
): BranchFile {
  return {
    name,
    config: {
      name,
      ...config,
    },
    commits: [],
  };
}
