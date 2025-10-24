import * as fs from "fs";
import * as path from "path";

/**
 * ABI decoder for DiamondCut events
 */

// DiamondCut event signature: DiamondCut(FacetCut[] _diamondCut, address _init, bytes _calldata)
// Event topic: keccak256("DiamondCut((address,uint8,bytes4[])[],address,bytes)")
export const DIAMOND_CUT_EVENT_TOPIC =
  "0x8faa70878671ccd212d20771b795c50af8fd3ff6cf27f4bde57e5d4de0aeb673";

export interface DecodedFacetCut {
  facetAddress: string;
  action: number; // 0 = Add, 1 = Replace, 2 = Remove
  functionSelectors: string[];
}

export interface DecodedDiamondCutEvent {
  facetCuts: DecodedFacetCut[];
  initAddress: string;
  initCalldata: string;
  transactionHash: string;
  blockNumber: number;
  timestamp: number;
}

/**
 * Parse DiamondCut event from transaction log
 */
export function parseDiamondCutEvent(
  log: {
    topics: string[];
    data: string;
    transactionHash: string;
    blockNumber: number;
  },
  timestamp: number
): DecodedDiamondCutEvent | null {
  // Verify the event signature
  if (log.topics[0] !== DIAMOND_CUT_EVENT_TOPIC) {
    return null;
  }

  try {
    // The data contains the encoded tuple array, init address, and calldata
    // We'll use a simple hex parsing approach since we don't have ethers/viem yet

    const data = log.data.slice(2); // Remove '0x' prefix
    
    // Parse the data manually (simplified - in production you'd use viem or ethers)
    // For now, return a placeholder that matches the expected structure
    
    return {
      facetCuts: [],
      initAddress: "0x0000000000000000000000000000000000000000",
      initCalldata: "0x",
      transactionHash: log.transactionHash,
      blockNumber: log.blockNumber,
      timestamp,
    };
  } catch (error) {
    console.error(`Failed to parse DiamondCut event: ${error}`);
    return null;
  }
}

/**
 * Decode function selector from bytes4
 */
export function decodeSelector(selector: string): string {
  // Ensure 0x prefix
  if (!selector.startsWith("0x")) {
    return `0x${selector.slice(0, 8)}`;
  }
  return selector.slice(0, 10); // 0x + 8 hex chars = 10 chars total
}

/**
 * Encode function selector from signature
 */
export function encodeSelector(signature: string): string {
  // This would use keccak256 in production
  // For now, return placeholder
  return "0x00000000";
}

/**
 * Parse function signatures from contract ABI
 */
export function extractSelectorsFromABI(abi: any[]): Map<string, string> {
  const selectors = new Map<string, string>();

  for (const item of abi) {
    if (item.type === "function") {
      const signature = `${item.name}(${item.inputs.map((i: any) => i.type).join(",")})`;
      // In production, compute actual selector via keccak256(signature).slice(0, 10)
      // For now, use a placeholder
      const selector = `0x${signature.slice(0, 8).padEnd(8, "0")}`;
      selectors.set(selector, signature);
    }
  }

  return selectors;
}

/**
 * Build function selector map from verified contract source
 */
export function buildSelectorMap(contractPath: string): Map<string, string> {
  const selectors = new Map<string, string>();

  if (!fs.existsSync(contractPath)) {
    return selectors;
  }

  try {
    const content = fs.readFileSync(contractPath, "utf-8");
    
    // Simple regex to find function declarations
    // function name(...) -> extract name and parameters
    const functionRegex = /function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\([^)]*\)/g;
    
    let match;
    while ((match = functionRegex.exec(content)) !== null) {
      const functionName = match[1];
      // Simplified selector generation (in production, use proper keccak256)
      const selector = `0x${functionName.slice(0, 8).padEnd(8, "0")}`;
      selectors.set(selector, functionName);
    }

    return selectors;
  } catch (error) {
    console.error(`Failed to build selector map from ${contractPath}: ${error}`);
    return selectors;
  }
}

/**
 * Compare two selector sets to detect conflicts
 */
export function detectSelectorConflicts(
  existing: Map<string, string>,
  incoming: Map<string, string>
): Array<{ selector: string; existingFunction: string; incomingFunction: string }> {
  const conflicts: Array<{
    selector: string;
    existingFunction: string;
    incomingFunction: string;
  }> = [];

  for (const [selector, incomingFunc] of incoming.entries()) {
    const existingFunc = existing.get(selector);
    if (existingFunc && existingFunc !== incomingFunc) {
      conflicts.push({
        selector,
        existingFunction: existingFunc,
        incomingFunction: incomingFunc,
      });
    }
  }

  return conflicts;
}

/**
 * Load selector map from ABI file
 */
export function loadSelectorsFromABI(abiPath: string): Map<string, string> {
  if (!fs.existsSync(abiPath)) {
    return new Map();
  }

  try {
    const abi = JSON.parse(fs.readFileSync(abiPath, "utf-8"));
    return extractSelectorsFromABI(abi);
  } catch (error) {
    console.error(`Failed to load selectors from ${abiPath}: ${error}`);
    return new Map();
  }
}

/**
 * Save selector map to JSON file
 */
export function saveSelectorMap(
  selectors: Map<string, string>,
  outputPath: string
): void {
  const obj = Object.fromEntries(selectors);
  const dir = path.dirname(outputPath);
  
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify(obj, null, 2), "utf-8");
}
