import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskArguments } from "hardhat/types/tasks";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import chalk from "chalk";
import * as readline from "node:readline/promises";

type ConfigValue = string | number | boolean;

const ALLOWED_KEYS = new Set([
  "AGENTVERSE_API_TOKEN",
  "ASI_API_KEY",
  "Author",
  "Auto_Sync",
  "Chain",
  "Gas_Price",
  "Governance_Address",
  "Wallet_Address",
  "currentBranch", // Internal key for tracking active branch
]);

// The 8 required user-settable keys (excluding internal tracking keys)
export const REQUIRED_KEYS: ReadonlyArray<string> = [
  "AGENTVERSE_API_TOKEN",
  "ASI_API_KEY",
  "Author",
  "Auto_Sync",
  "Chain",
  "Gas_Price",
  "Governance_Address",
  "Wallet_Address",
] as const;

const DEFAULT_VALUES: Record<string, ConfigValue> = {
  AGENTVERSE_API_TOKEN: "",
  ASI_API_KEY: "",
  Author: "markov",
  Auto_Sync: true,
  Chain: "Ethereum Testnet",
  Gas_Price: 10000,
  Governance_Address: "",
  Wallet_Address: "",
};

const KEY_DESCRIPTIONS: Record<string, string> = {
  AGENTVERSE_API_TOKEN: "Agentverse API token for autonomous agent",
  ASI_API_KEY: "ASI API key for AI-powered features",
  Author: "Your name or identifier for commits",
  Auto_Sync: "Automatically sync with on-chain events (true/false)",
  Chain: "Target blockchain network (name or chain ID)",
  Gas_Price: "Default gas price (in gwei)",
  Governance_Address: "Governance contract address for proposals",
  Wallet_Address: "Wallet address for deployments (viem,ethers)",
};

interface MarkovConfigFile {
  currentBranch?: string; // Track active branch
  AGENTVERSE_API_TOKEN?: string;
  ASI_API_KEY?: string;
  Author?: string;
  Auto_Sync?: boolean;
  Chain?: string;
  Gas_Price?: number;
  Governance_Address?: string;
  Wallet_Address?: string;
  diamondAddress?: string; // Optional: synced from branch config
}

/**
 * Ensure .markov/config.json contains all 8 required keys.
 * If any are missing/empty, prompt the user and append them, then mirror to hardhat.config.ts.
 * Note: This function intentionally avoids syncing to branch files to prevent unintended
 * branch creation during commands like `clone`. Branch sync is handled separately.
 */
export async function ensureConfigKeys(
  hre: HardhatRuntimeEnvironment,
  options?: { promptIfMissing?: boolean }
): Promise<{ updated: boolean; missingKeys: string[] }> {
  const promptIfMissing = options?.promptIfMissing !== false;
  const root = hre.config.paths.root;
  const markovDir = path.join(root, ".markov");
  const markovConfigPath = path.join(markovDir, "config.json");

  // Ensure .markov directory exists
  if (!existsSync(markovDir)) {
    await fs.mkdir(markovDir, { recursive: true });
  }

  const current = await readConfigFile(markovConfigPath);

  // Determine which keys are missing or empty
  const missing: string[] = [];
  for (const key of REQUIRED_KEYS) {
    const v = (current as any)[key];
    const isEmptyString = typeof v === "string" && v.trim() === "";
    const isMissing = v === undefined || v === null || isEmptyString;
    if (isMissing) missing.push(key);
  }

  if (missing.length === 0) {
    // Nothing to do
    return { updated: false, missingKeys: [] };
  }

  console.log(chalk.cyan("\nConfiguration checkpoint"));
  console.log(chalk.yellow(`   Missing keys detected: ${missing.join(", ")}`));

  const updates: Record<string, ConfigValue> = {};
  for (const key of missing) {
    const defaultValue = (DEFAULT_VALUES as any)[key];
    let value: any = defaultValue;

    if (promptIfMissing) {
      const description = (KEY_DESCRIPTIONS as any)[key] || "";
      const isSensitive = key.toLowerCase().includes("key") || key.toLowerCase().includes("token");
      let displayDefault = String(defaultValue ?? "");
      if (displayDefault === "") displayDefault = "none";
      if (typeof defaultValue === "boolean") displayDefault = defaultValue ? "true" : "false";

      console.log(chalk.yellow(`${key}`) + (description ? chalk.gray(` - ${description}`) : ""));
      const answer = await promptWithDefault(
        `   Enter value [${isSensitive && defaultValue ? "****" : displayDefault}]: `,
        defaultValue,
      );
      value = answer !== null ? coerceValue(key, answer) : defaultValue;
    }

    updates[key] = value as ConfigValue;
  }

  // Write directly to config.json (avoid branch sync here)
  const newConfig = { ...current, ...updates } as MarkovConfigFile;
  await writeConfigFile(markovConfigPath, newConfig);

  // Mirror to hardhat.config.ts
  await updateHardhatConfig(hre, updates);

  console.log(chalk.green("\n✓ Configuration updated with missing keys"));
  console.log(chalk.gray("   Synced to: .markov/config.json and hardhat.config.ts"));

  return { updated: true, missingKeys: missing };
}

/**
 * Configure Markov settings.
 * Allows getting/setting config values and keeps them in two places:
 *  - .markov/config.json (authoritative, easy to edit programmatically)
 *  - hardhat.config.ts (mirrors key values for visibility in code)
 *
 * Usage:
 *   - markov config --list
 *   - markov config --get <key>
 *   - markov config --set (interactive prompt for key and value)
 */
export default async function markovConfig(
  taskArguments: TaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  // Centered header
  const headerText = "Configuration Management";
  const padding = Math.floor((68 - headerText.length) / 2);
  const centeredHeader = " ".repeat(padding) + headerText + " ".repeat(68 - padding - headerText.length);
  
  console.log(chalk.blue("\n╔════════════════════════════════════════════════════════════════════╗"));
  console.log(chalk.blue("║") + chalk.cyan.bold(centeredHeader) + chalk.blue("║"));
  console.log(chalk.blue("╚════════════════════════════════════════════════════════════════════╝\n"));

  const root = hre.config.paths.root;
  const markovDir = path.join(root, ".markov");
  const markovConfigPath = path.join(markovDir, "config.json");

  // Notify about existing config or missing .markov
  const hasMarkovDir = existsSync(markovDir);
  const hasConfigFile = existsSync(markovConfigPath);

  if (!hasMarkovDir) {
    console.log(chalk.yellow("\nThe .markov directory was not found."));
    console.log(chalk.cyan("Please run:"), chalk.green("npx hardhat markov init"), chalk.cyan("first."));
    return;
  }

  // If no config file exists and no flags provided, run initial setup
  if (!hasConfigFile && !taskArguments.list && !taskArguments.get && !taskArguments.set) {
    await runInitialSetup(markovConfigPath, hre);
    return;
  }

  // If --set is called without a config file, also run initial setup
  if (!hasConfigFile && taskArguments.set) {
    await runInitialSetup(markovConfigPath, hre);
    return;
  }

  if (hasConfigFile) {
    console.log(chalk.gray("Found existing .markov/config.json"));
  } else {
    console.log(chalk.gray("No .markov/config.json found. One will be created on first --set."));
  }

  const action = await inferAction(taskArguments, markovConfigPath, hre);

  switch (action.type) {
    case "list":
      await listConfig(markovConfigPath, hre);
      break;
    case "get":
      await getConfigValue(markovConfigPath, hre, action.key);
      break;
    case "set":
      await setConfigValue(markovConfigPath, hre, action.key, action.value);
      await updateHardhatConfig(hre, { [action.key]: action.value });
      break;
    default:
      // Default to list if no action
      await listConfig(markovConfigPath, hre);
      break;
  }
}

async function inferAction(
  args: TaskArguments,
  markovConfigPath: string,
  hre: HardhatRuntimeEnvironment,
): Promise<
  | { type: "list" }
  | { type: "get"; key: string }
  | { type: "set"; key: string; value: ConfigValue }
  | { type: "none" }
> {
  const anyArgs = args as Record<string, any>;
  
  if (anyArgs.list) return { type: "list" };
  
  // Handle --get with key
  if (typeof anyArgs.get === "string" && anyArgs.get) {
    return { type: "get", key: anyArgs.get };
  }
  
  // Check for --get in args array
  const argsArray: any[] = (anyArgs.args as any[]) || [];
  const getIndex = argsArray.findIndex((x) => x === "--get");
  if (getIndex >= 0 && argsArray.length >= getIndex + 2) {
    const key = String(argsArray[getIndex + 1]);
    return { type: "get", key };
  }
  
  // Handle --set interactively (only if config already exists)
  if (anyArgs.set !== undefined) {
    // If no config file exists, this should have been caught above
    // This is for updating existing config one key at a time
    console.log(chalk.yellow("\n'--set' is for updating individual keys in existing configuration."));
    console.log(chalk.cyan("To set up initial configuration, run:"));
    console.log(chalk.white("  npx hardhat markov config"));
    console.log(chalk.gray("\nOr to update a specific key:"));
    console.log(chalk.white("  npx hardhat markov config --get <key>"));
    console.log(chalk.white("  npx hardhat markov config --list\n"));
    return { type: "none" };
  }
  
  if (argsArray.includes("--list")) return { type: "list" };
  
  return { type: "none" };
}

function coerceValue(key: string, raw: any): ConfigValue {
  if (raw === undefined || raw === null) return "";
  const s = String(raw);
  if (key === "Auto_Sync") {
    return ["1", "true", "yes", "y"].includes(s.toLowerCase());
  }
  if (key === "Gas_Price") {
    const n = Number(s);
    return Number.isFinite(n) ? n : 10000; // Default to 10000 if invalid
  }
  return s;
}

async function readConfigFile(markovConfigPath: string): Promise<MarkovConfigFile> {
  if (!existsSync(markovConfigPath)) return {};
  try {
    const content = await fs.readFile(markovConfigPath, "utf-8");
    return JSON.parse(content) as MarkovConfigFile;
  } catch {
    return {};
  }
}

async function writeConfigFile(markovConfigPath: string, data: MarkovConfigFile) {
  const dir = path.dirname(markovConfigPath);
  if (!existsSync(dir)) {
    await fs.mkdir(dir, { recursive: true });
  }
  await fs.writeFile(markovConfigPath, JSON.stringify(data, null, 2));
}

async function listConfig(markovConfigPath: string, hre: HardhatRuntimeEnvironment) {
  const fileCfg = await readConfigFile(markovConfigPath);
  const current = hre.config.markov;
  console.log(chalk.cyan("\nMarkov Configuration"));
  console.log(chalk.gray("(Values shown from .markov/config.json if present, otherwise from HRE defaults)\n"));

  const out: Record<string, ConfigValue> = {
     Chain: fileCfg.Chain ?? "Ethereum Testnet",
    Wallet_Address: fileCfg.Wallet_Address ?? "",
    Author: fileCfg.Author ?? "markov",
    Gas_Price: fileCfg.Gas_Price ?? 10000,
    Auto_Sync: fileCfg.Auto_Sync ?? true,
    ASI_API_KEY: fileCfg.ASI_API_KEY ? mask(fileCfg.ASI_API_KEY) : "(not set)",
    AGENTVERSE_API_TOKEN: fileCfg.AGENTVERSE_API_TOKEN ? mask(fileCfg.AGENTVERSE_API_TOKEN) : "(not set)",
    Governance_Address: fileCfg.Governance_Address ?? "",
  };

  for (const [k, v] of Object.entries(out)) {
    console.log(`  ${k}: ${v}`);
  }
  console.log();
}

async function getConfigValue(markovConfigPath: string, hre: HardhatRuntimeEnvironment, key: string) {
  if (!ALLOWED_KEYS.has(key)) {
    console.log(chalk.red(`\nUnknown key: ${key}`));
    console.log(chalk.gray(`Allowed keys: ${Array.from(ALLOWED_KEYS).join(", ")}`));
    return;
  }
  const fileCfg = await readConfigFile(markovConfigPath);
  const current = hre.config.markov as any;
  const value = (fileCfg as any)[key] ?? current[key];
  console.log(`\n${key}: ${key.toLowerCase().includes("key") && typeof value === "string" ? mask(value) : value}`);
}

async function setConfigValue(markovConfigPath: string, hre: HardhatRuntimeEnvironment, key: string, value: ConfigValue) {
  if (!ALLOWED_KEYS.has(key)) {
    console.log(chalk.red(`\nUnknown key: ${key}`));
    console.log(chalk.gray(`Allowed keys: ${Array.from(ALLOWED_KEYS).join(", ")}`));
    return;
  }

  // Warn before overwriting existing config
  const exists = existsSync(markovConfigPath);
  if (exists) {
    console.log(chalk.yellow("\nA .markov/config.json already exists."));
    const proceed = await promptYesNo("   Do you want to update it? (Y/n): ", true);
    if (!proceed) {
      console.log(chalk.blue("\nUpdate cancelled."));
      return;
    }
  }

  // Use tri-directional sync
  const updates = { [key]: value };
  await syncAllConfigs(updates, hre);
  
  console.log(chalk.green(`\n✓ Updated configuration -> ${key} = ${value}`));
  console.log(chalk.gray("   Synced to: .markov/config.json, active branch, hardhat.config.ts"));

  // Also reflect in current HRE config for this session (non-persistent)
  (hre.config.markov as any)[key] = value as any;
}

async function updateHardhatConfig(
  hre: HardhatRuntimeEnvironment,
  updates: Record<string, ConfigValue>,
) {
  const root = hre.config.paths.root;
  const configPath = (hre.config.paths as any).config ?? path.join(root, "hardhat.config.ts");
  if (!existsSync(configPath)) {
    console.log(chalk.gray("hardhat.config.ts not found; skipping file update."));
    return;
  }

  let content = await fs.readFile(configPath, "utf-8");

  const hasMarkovBlock = /\bmarkov\s*:\s*\{[\s\S]*?\},?/m.test(content);

  const blockStr = buildMarkovBlock(updates);

  if (hasMarkovBlock) {
    // Update existing block by replacing lines for provided keys
    content = replaceKeysInMarkovBlock(content, updates);
  } else {
    // Insert after solidity line or at top of export default
    const solidityLine = content.match(/(solidity\s*:\s*["'`][^"'`]+["'`],?)/);
    if (solidityLine) {
      content = content.replace(solidityLine[0], `${solidityLine[0]}\n  ${blockStr}`);
    } else {
      content = content.replace(/export\s+default\s*\{/, (m) => `${m}\n  ${blockStr}`);
    }
  }

  await fs.writeFile(configPath, content);
  console.log(chalk.green("✓ Updated hardhat.config.ts"));
}

function buildMarkovBlock(updates: Record<string, ConfigValue>): string {
  // Minimal block including only the provided keys; users can expand later
  const entries = Object.entries(updates)
    .filter(([k, v]) => v !== undefined && ALLOWED_KEYS.has(k))
    .map(([k, v]) => `    ${k}: ${tsValue(v)},`)
    .join("\n");
  return `markov: {\n${entries}\n  },`;
}

function replaceKeysInMarkovBlock(content: string, updates: Record<string, ConfigValue>): string {
  return content.replace(/(markov\s*:\s*\{[\s\S]*?\})/m, (block) => {
    let newBlock = block;
    for (const [k, v] of Object.entries(updates)) {
      if (!ALLOWED_KEYS.has(k) || v === undefined) continue;
      const lineRegex = new RegExp(`(^|\n)\s*${k}\s*:\s*[^,]*,?`, "m");
      if (lineRegex.test(newBlock)) {
        newBlock = newBlock.replace(lineRegex, (m0, p1) => `${p1}    ${k}: ${tsValue(v)},`);
      } else {
        // insert before closing brace
        newBlock = newBlock.replace(/\n\s*\}$/, `\n    ${k}: ${tsValue(v)},\n  }`);
      }
    }
    return newBlock;
  });
}

function tsValue(v: ConfigValue): string {
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : JSON.stringify(String(v));
  return JSON.stringify(String(v));
}

function mask(v: string): string {
  if (!v) return "(not set)";
  return "****" + v.slice(-4);
}

async function runInitialSetup(
  markovConfigPath: string,
  hre: HardhatRuntimeEnvironment,
) {
  const config: MarkovConfigFile = {};
  const updates: Record<string, ConfigValue> = {};

  // Define the 8 required keys with their display names and actual storage keys
  const keyMapping = [
    { internal: "AGENTVERSE_API_TOKEN", display: "AGENTVERSE_API_TOKEN", storage: "AGENTVERSE_API_TOKEN" },
    { internal: "ASI_API_KEY", display: "ASI_API_KEY", storage: "ASI_API_KEY" },
    { internal: "Author", display: "Author", storage: "Author" },
    { internal: "Auto_Sync", display: "Auto_Sync", storage: "Auto_Sync" },
    { internal: "Chain", display: "Chain", storage: "Chain" },
    { internal: "Gas_Price", display: "Gas_Price", storage: "Gas_Price" },
    { internal: "Governance_Address", display: "Governance_Address", storage: "Governance_Address" },
    { internal: "Wallet_Address", display: "Wallet_Address", storage: "Wallet_Address" },
  ];

  console.log(chalk.cyan("\n⚙️  Initial Configuration Setup"));
  console.log(chalk.gray("   Configure all settings in one session. Press Enter to use default values.\n"));

  for (const { internal, display, storage } of keyMapping) {
  const defaultValue = (DEFAULT_VALUES as any)[storage];
  const description = (KEY_DESCRIPTIONS as any)[storage] || "";
    
    let displayDefault = String(defaultValue);
    if (defaultValue === "" || defaultValue === null || defaultValue === undefined) {
      displayDefault = "none";
    } else if (typeof defaultValue === "boolean") {
      displayDefault = defaultValue ? "true" : "false";
    }

  const isSensitive = storage.toLowerCase().includes("key") || storage.toLowerCase().includes("token");
    
    console.log(chalk.yellow(`${display}`) + chalk.gray(` - ${description}`));
    const answer = await promptWithDefault(
      `   Enter value [${isSensitive && defaultValue ? "****" : displayDefault}]: `,
      defaultValue,
    );

  const finalValue = answer !== null ? coerceValue(storage, answer) : defaultValue;
    (config as any)[storage] = finalValue;
    updates[storage] = finalValue;
  }

  // Add currentBranch to the initial config
  updates.currentBranch = "main";

  // Use tri-directional sync to save everywhere
  await syncAllConfigs(updates, hre);
  console.log(chalk.green("\n✓ Configuration complete!"));
  console.log(chalk.gray("   Synced to: .markov/config.json, active branch, hardhat.config.ts"));
  
  console.log(chalk.cyan("\nYou can modify settings anytime with:"));
  console.log(chalk.gray("   • ") + chalk.white("npx hardhat markov config --list") + chalk.gray(" (view all)"));
  console.log(chalk.gray("   • ") + chalk.white("npx hardhat markov config --get <key>") + chalk.gray(" (view one)"));
  console.log(chalk.gray("   • ") + chalk.white("npx hardhat markov config --set") + chalk.gray(" (update interactively)\n"));
}

async function promptYesNo(question: string, defaultYes = false): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(question)).trim().toLowerCase();
    rl.close();
    if (!answer) return defaultYes;
    return ["y", "yes"].includes(answer);
  } catch {
    rl.close();
    return defaultYes;
  }
}

async function promptWithDefault(
  question: string,
  defaultValue: ConfigValue,
): Promise<string | null> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(chalk.cyan(question))).trim();
    rl.close();
    // Return null if empty (use default), otherwise return the answer
    return answer === "" ? null : answer;
  } catch {
    rl.close();
    return null;
  }
}

async function promptForKey(): Promise<string> {
  console.log(chalk.cyan("\nAvailable configuration keys:"));
  const keys = Array.from(ALLOWED_KEYS).sort();
  keys.forEach((key, idx) => {
    console.log(chalk.gray(`   ${idx + 1}. ${key}`));
  });
  
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(chalk.cyan("\nEnter key name: "))).trim();
    rl.close();
    return answer;
  } catch {
    rl.close();
    return "";
  }
}

async function promptForValue(key: string): Promise<string | null> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    let prompt = chalk.cyan(`\nEnter value for '${key}': `);
    
    // Add hints for certain keys
      if (key === "Auto_Sync") {
      prompt = chalk.cyan(`\nEnter value for '${key}' (true/false): `);
      } else if (key === "Gas_Price") {
      prompt = chalk.cyan(`\nEnter value for '${key}' (number or 'auto'): `);
    } else if (key.toLowerCase().includes("key") || key.toLowerCase().includes("token")) {
      prompt = chalk.cyan(`\nEnter value for '${key}' (sensitive - will be masked): `);
    }
    
    const answer = (await rl.question(prompt)).trim();
    rl.close();
    return answer || null;
  } catch {
    rl.close();
    return null;
  }
}

async function showCurrentValue(
  markovConfigPath: string,
  hre: HardhatRuntimeEnvironment,
  key: string,
) {
  const fileCfg = await readConfigFile(markovConfigPath);
  const current = hre.config.markov as any;
  const value = (fileCfg as any)[key] ?? current[key];
  
  if (value !== undefined && value !== null && value !== "") {
    const displayValue = key.toLowerCase().includes("key") || key.toLowerCase().includes("token")
      ? mask(String(value))
      : value;
    console.log(chalk.gray(`   Current value: ${displayValue}`));
  } else {
    console.log(chalk.gray(`   Current value: (not set)`));
  }
}

/**
 * TRI-DIRECTIONAL CONFIG SYNC FUNCTIONS
 * Syncs configuration between:
 * 1. .markov/config.json (active config)
 * 2. .markov/branches/<current-branch>.json (branch-specific config)
 * 3. hardhat.config.ts (code mirror for IDE autocomplete)
 */

/**
 * Sync config FROM active branch TO .markov/config.json
 * Called when switching branches
 */
export async function syncConfigFromBranch(
  branchName: string,
  hre: HardhatRuntimeEnvironment,
): Promise<void> {
  const root = hre.config.paths.root;
  const markovDir = path.join(root, ".markov");
  const branchFilePath = path.join(markovDir, "branches", `${branchName}.json`);
  const configPath = path.join(markovDir, "config.json");

  if (!existsSync(branchFilePath)) {
    console.log(chalk.yellow(`Warning: Branch file '${branchName}.json' not found`));
    return;
  }

  try {
    // Read branch file
    const branchContent = await fs.readFile(branchFilePath, "utf-8");
    const branchData = JSON.parse(branchContent);

    // Extract config from branch file
    const branchConfig = branchData.config || {};

    // Read current config.json
    const currentConfig = await readConfigFile(configPath);

    // Merge: branch config takes precedence for branch-specific fields
    // Keep other fields from current config
    const mergedConfig: MarkovConfigFile = {
      ...currentConfig,
      currentBranch: branchName,
      Chain: branchConfig.chain || currentConfig.Chain,
      Wallet_Address: currentConfig.Wallet_Address, // Keep wallet from config.json
      Author: currentConfig.Author, // Keep author from config.json
      // Branch-specific overrides (optional)
      ...(branchConfig.diamondAddress && { diamondAddress: branchConfig.diamondAddress }),
    };

    // Write merged config back to config.json
    await writeConfigFile(configPath, mergedConfig);
    
      console.log(chalk.gray(`   ✓ Synced config from branch '${branchName}'`));
  } catch (error) {
    console.log(chalk.red(`Error syncing config from branch: ${error instanceof Error ? error.message : String(error)}`));
  }
}

/**
 * Sync config FROM .markov/config.json TO active branch file
 * Called when updating config
 */
export async function syncConfigToBranch(
  configData: MarkovConfigFile,
  hre: HardhatRuntimeEnvironment,
): Promise<void> {
  const root = hre.config.paths.root;
  const markovDir = path.join(root, ".markov");
  const configPath = path.join(markovDir, "config.json");
  const branchesDir = path.join(markovDir, "branches");

  // Ensure branches directory exists
  await fs.mkdir(branchesDir, { recursive: true });

  // Read current branch from config.json
  const currentConfig = await readConfigFile(configPath);
  const currentBranch = (currentConfig as any).currentBranch || "main";

  const branchFilePath = path.join(branchesDir, `${currentBranch}.json`);
  const headFilePath = path.join(markovDir, "HEAD");

  // If branch file doesn't exist, create initial branch
  if (!existsSync(branchFilePath)) {
    console.log(chalk.cyan(`   Creating initial branch '${currentBranch}'...`));
    
    // Import needed types
    const { generateCommitHash } = await import("../../storage/history-storage.js");
    
    // Create initial commit
    const initialCommit = {
      hash: "",
      timestamp: Date.now(),
      author: configData.Author || "markov",
      message: `Initialize ${currentBranch} branch`,
      diamondAddress: configData.diamondAddress || "",
      cut: [],
      branch: currentBranch,
    };
    
    initialCommit.hash = generateCommitHash(initialCommit);
    
    // Create branch file with config and initial commit
    const branchData = {
      name: currentBranch,
      config: {
        name: currentBranch,
        chain: configData.Chain || "localhost",
        rpcUrl: "http://127.0.0.1:8545", // Default localhost RPC
        diamondAddress: configData.diamondAddress || "",
        createdAt: Date.now(),
      },
      commits: [initialCommit],
    };
    
    await fs.writeFile(branchFilePath, JSON.stringify(branchData, null, 2));
    
    // Create HEAD file pointing to this branch
    await fs.writeFile(headFilePath, currentBranch);
    
    console.log(chalk.green(`   ✓ Created branch '${currentBranch}' with initial commit`));
    return;
  }

  try {
    // Read branch file
    const branchContent = await fs.readFile(branchFilePath, "utf-8");
    const branchData = JSON.parse(branchContent);

    // Update branch config with relevant fields from config.json
    branchData.config = {
      ...branchData.config,
      // Update fields that are relevant to branch config
      chain: configData.Chain || branchData.config.chain,
      // Keep branch-specific fields unchanged
      name: branchData.config.name,
      rpcUrl: branchData.config.rpcUrl,
      diamondAddress: branchData.config.diamondAddress || configData.diamondAddress || "",
      createdAt: branchData.config.createdAt,
      createdFrom: branchData.config.createdFrom,
      createdFromCommit: branchData.config.createdFromCommit,
    };

    // Write updated branch file
    await fs.writeFile(branchFilePath, JSON.stringify(branchData, null, 2));

    console.log(chalk.gray(`   ✓ Synced config to branch '${currentBranch}'`));
  } catch (error) {
    console.log(chalk.red(`Error syncing config to branch: ${error instanceof Error ? error.message : String(error)}`));
  }
}

/**
 * Full tri-directional sync: config.json ↔ branch file ↔ hardhat.config.ts
 * Called after any config update
 */
export async function syncAllConfigs(
  updates: Record<string, ConfigValue>,
  hre: HardhatRuntimeEnvironment,
): Promise<void> {
  const root = hre.config.paths.root;
  const markovDir = path.join(root, ".markov");
  const configPath = path.join(markovDir, "config.json");

  // 1. Update .markov/config.json
  const currentConfig = await readConfigFile(configPath);
  const updatedConfig = { ...currentConfig, ...updates };
  await writeConfigFile(configPath, updatedConfig);

  // 2. Sync to active branch file
  await syncConfigToBranch(updatedConfig, hre);

  // 3. Update hardhat.config.ts
  await updateHardhatConfig(hre, updates);
}
