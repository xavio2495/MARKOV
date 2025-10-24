import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskArguments } from "hardhat/types/tasks";
import path from "node:path";
import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import chalk from "chalk";
import * as readline from "node:readline/promises";

type ConfigValue = string | number | boolean;

const ALLOWED_KEYS = new Set([
  "chain",
  "wallet",
  "gasPrice",
  "author",
  "aiApiKey",
  "aiModel",
  "governanceAddress",
  "mcpEndpoint",
  "agentverseApiToken",
  "historyPath",
  "verbose",
  "autoSync",
]);

const DEFAULT_VALUES: Record<string, ConfigValue> = {
  author: "markov",
  chain: "Ethereum Testnet",
  autoSync: true,
  gasPrice: 10000,
  mcpEndpoint: "https://mcp.blockscout.com/mcp",
  verbose: false,
  wallet: "0x00",
  aiApiKey: "",
  aiModel: "",
  governanceAddress: "",
  agentverseApiToken: "",
  historyPath: "",
};

const KEY_DESCRIPTIONS: Record<string, string> = {
  author: "Your name or identifier for commits",
  chain: "Target blockchain network",
  wallet: "Default wallet address for deployments",
  gasPrice: "Default gas price (in wei) or 'auto'",
  autoSync: "Automatically sync with on-chain events",
  verbose: "Enable verbose logging for Diamond contract operations",
  mcpEndpoint: "Model Context Protocol endpoint URL",
  aiApiKey: "API key for AI features (OpenAI, etc.)",
  aiModel: "AI model to use (e.g., gpt-4)",
  governanceAddress: "Governance contract address (for proposals)",
  agentverseApiToken: "Agentverse API token (for autonomous agent)",
  historyPath: "Custom path for history.json (leave empty for default)",
};

interface MarkovConfigFile {
  chain?: string;
  wallet?: string;
  gasPrice?: string | number;
  author?: string;
  aiApiKey?: string;
  aiModel?: string;
  governanceAddress?: string;
  mcpEndpoint?: string;
  agentverseApiToken?: string;
  historyPath?: string;
  verbose?: boolean;
  autoSync?: boolean;
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
    console.log(chalk.yellow("\nWelcome to Markov! Let's set up your configuration."));
    console.log(chalk.gray("   Press Enter to accept default values shown in [brackets]\n"));
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
  
  // Handle --set interactively
  if (anyArgs.set !== undefined) {
    // Interactive mode: prompt for key and value
    const key = await promptForKey();
    if (!key) {
      console.log(chalk.yellow("\nNo key provided. Cancelled."));
      return { type: "none" };
    }
    
    if (!ALLOWED_KEYS.has(key)) {
      console.log(chalk.red(`\nUnknown key: ${key}`));
      console.log(chalk.gray(`\nAllowed keys: ${Array.from(ALLOWED_KEYS).join(", ")}`));
      return { type: "none" };
    }
    
    // Show current value if exists
    await showCurrentValue(markovConfigPath, hre, key);
    
    const rawValue = await promptForValue(key);
    if (rawValue === null) {
      console.log(chalk.yellow("\nNo value provided. Cancelled."));
      return { type: "none" };
    }
    
    const value = coerceValue(key, rawValue);
    return { type: "set", key, value };
  }
  
  if (argsArray.includes("--list")) return { type: "list" };
  
  return { type: "none" };
}

function coerceValue(key: string, raw: any): ConfigValue {
  if (raw === undefined || raw === null) return "";
  const s = String(raw);
  if (key === "verbose" || key === "autoSync") {
    return ["1", "true", "yes", "y"].includes(s.toLowerCase());
  }
  if (key === "gasPrice") {
    // allow number or string like "auto"
    const n = Number(s);
    return Number.isFinite(n) ? n : s;
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
    chain: fileCfg.chain ?? current.chain,
    wallet: fileCfg.wallet ?? current.wallet ?? "",
    author: fileCfg.author ?? current.author,
    gasPrice: fileCfg.gasPrice ?? current.gasPrice,
    aiModel: fileCfg.aiModel ?? current.aiModel,
    aiApiKey: fileCfg.aiApiKey ? mask(fileCfg.aiApiKey) : current.aiApiKey ? mask(String(current.aiApiKey)) : "(not set)",
    mcpEndpoint: fileCfg.mcpEndpoint ?? current.mcpEndpoint,
    verbose: fileCfg.verbose ?? current.verbose,
    autoSync: fileCfg.autoSync ?? current.autoSync,
    historyPath: fileCfg.historyPath ?? current.historyPath,
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

  const cfg = await readConfigFile(markovConfigPath);
  (cfg as any)[key] = value as any;
  await writeConfigFile(markovConfigPath, cfg);
  console.log(chalk.green(`\n✓ Updated .markov/config.json -> ${key} = ${value}`));

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

  // Define the order we want to present keys to the user
  const keyOrder = [
    "author",
    "chain",
    "wallet",
    "gasPrice",
    "autoSync",
    "verbose",
    "mcpEndpoint",
    "aiApiKey",
    "aiModel",
    "governanceAddress",
    "agentverseApiToken",
    "historyPath",
  ];

  console.log(chalk.cyan("Configuration Setup"));

  for (const key of keyOrder) {
    const defaultValue = DEFAULT_VALUES[key];
    const description = KEY_DESCRIPTIONS[key] || "";
    
    let displayDefault = String(defaultValue);
    if (defaultValue === "" || defaultValue === null) {
      displayDefault = "none";
    } else if (typeof defaultValue === "boolean") {
      displayDefault = defaultValue ? "true" : "false";
    }

    const isSensitive = key.toLowerCase().includes("key") || key.toLowerCase().includes("token");
    
    console.log(chalk.yellow(`\n${key}`) + chalk.gray(` - ${description}`));
    const answer = await promptWithDefault(
      `   Enter value [${isSensitive && defaultValue ? "****" : displayDefault}]: `,
      defaultValue,
    );

    const finalValue = answer !== null ? coerceValue(key, answer) : defaultValue;
    (config as any)[key] = finalValue;
    updates[key] = finalValue;
  }

  // Save to .markov/config.json
  await writeConfigFile(markovConfigPath, config);
  console.log(chalk.green("\nConfiguration saved to .markov/config.json"));

  // Update hardhat.config.ts
  await updateHardhatConfig(hre, updates);
  
  console.log(chalk.cyan("\nSetup complete! You can modify settings anytime with:"));
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
    if (key === "verbose" || key === "autoSync") {
      prompt = chalk.cyan(`\nEnter value for '${key}' (true/false): `);
    } else if (key === "gasPrice") {
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
