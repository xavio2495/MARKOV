import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskArguments } from "hardhat/types/tasks";
import chalk from "chalk";

// Color scheme constants for easy customization
const COLORS = {
  // CLI components
  NPX: chalk.yellow("npx"),
  HARDHAT: chalk.yellow("hardhat"),
  MARKOV: chalk.red("markov"),
  COMMAND: chalk.green,  // Function to color commands
  ARGUMENT: chalk.white, // Function to color arguments
  OPTION: chalk.gray,   // Function to color options

  // Documentation components
  NAME: chalk.green,    // Function to color command names
  USAGE: chalk.blue,    // Function to color usage sections
  DESCRIPTION: chalk.cyan,
  ARGS_HEADER: chalk.white.bold("Arguments:"),
  OPTIONS_HEADER: chalk.white.bold("Options:"),
  ARG_DESC: chalk.gray, // Function to color argument descriptions
  OPT_DESC: chalk.gray, // Function to color option descriptions

  // Formatting
  BORDER: chalk.cyan,
  HEADER: chalk.cyan.bold,
  SECTION: chalk.white.bold,
  EXAMPLE: chalk.gray,
} as const;

/**
 * Formats a command usage string with proper coloring
 */
function formatUsage(usage: string): string {
  return usage
    .split(" ")
    .map((part) => {
      if (part === "markov") return COLORS.MARKOV;
      if (part.startsWith("--")) return COLORS.OPTION(part);
      if (part.startsWith("<") || part.startsWith("[")) return COLORS.ARGUMENT(part);
      if (!part.includes("<") && !part.includes("[") && part !== "markov") return COLORS.COMMAND(part);
      return part;
    })
    .join(" ");
}

/**
 * Display help information for markov commands
 */
export default async function helpTask(
  _taskArguments: TaskArguments,
  _hre: HardhatRuntimeEnvironment,
) {
  console.log("\n" + COLORS.BORDER("╔════════════════════════════════════════════════════════════════════╗"));
  console.log(COLORS.BORDER("║") + COLORS.HEADER("                    MARKOV CLI - Command Reference                  ") + COLORS.BORDER("║"));
  console.log(COLORS.BORDER("╚════════════════════════════════════════════════════════════════════╝\n"));
  
  console.log(COLORS.DESCRIPTION("\nRefer to ") + COLORS.NAME("https://markov.mintlify.app/cli-reference/") + COLORS.DESCRIPTION(" for detailed documentation.\n"));

  const commands = [
    {
      name: "help",
      usage: "markov help",
      description: "Displays basic Information on CLI commands",
      args: [],
      options: [],
    },
    {
      name: "config",
      usage: "markov config [--set <key> <value>] [--get <key>] [--list]",
      description: "Configure Markov settings",
      args: [],
      options: [
        { name: "--set <key> <value>", desc: "Set a configuration value" },
        { name: "--get <key>", desc: "Get a configuration value" },
        { name: "--list", desc: "List all configuration values" },
      ],
    },
    {
      name: "init",
      usage: "markov init [--name <name>] [--force]",
      description: "Initialize a new Diamond contract with ERC-2535 structure",
      args: [],
      options: [
        { name: "--name <string>", desc: "Name of the Diamond contract (default: 'Diamond')" },
        { name: "--force", desc: "Force reinitialization even if project already exists" },
      ],
    },
    {
      name: "clone",
      usage: "markov clone <address> [--sourceNetwork <network>]",
      description: "Clone an existing Diamond contract from on-chain",
      args: [
        { name: "<address>", desc: "Diamond contract address to clone" },
      ],
      options: [
        { name: "--sourceNetwork <network>", desc: "Source network name (defaults to current network)" },
      ],
    },
    {
      name: "log",
      usage: "markov log [--branch <name>] [--limit <number>]",
      description: "Display version history (commit log)",
      args: [],
      options: [
        { name: "--branch <string>", desc: "Branch to show logs for (default: current branch)" },
        { name: "--limit <number>", desc: "Number of commits to show (default: 10)" },
      ],
    },
    {
      name: "deploy",
      usage: "markov deploy <facets> [--message <msg>] [--simulate]",
      description: "Deploy facets and execute diamondCut upgrade",
      args: [
        { name: "<facets>", desc: "Facet names to deploy (comma-separated, e.g., 'Facet1,Facet2')" },
      ],
      options: [
        { name: "--message <string>", desc: "Commit message (default: 'Deploy facets')" },
        { name: "--simulate", desc: "Simulate without executing on-chain" },
      ],
    },
    {
      name: "reset",
      usage: "markov reset <hash> [--simulate]",
      description: "Revert Diamond to a previous state (like git reset)",
      args: [
        { name: "<hash>", desc: "Commit hash to reset to" },
      ],
      options: [
        { name: "--simulate", desc: "Simulate without executing on-chain" },
      ],
    },
    {
      name: "status",
      usage: "markov status",
      description: "Check Diamond contract health and current state",
      args: [],
      options: [],
    },
    {
      name: "sync",
      usage: "markov sync",
      description: "Syncs local history with on-chain DiamondCut events",
      args: [],
      options: [],
    },
    {
      name: "branch",
      usage: "markov branch <action> [name]",
      description: "Manage branches (create, switch, list, delete)",
      args: [
        { name: "<action>", desc: "Branch action: 'create', 'switch', 'list', or 'delete'" },
        { name: "[name]", desc: "Branch name (required for create, switch, delete)" },
      ],
      options: [],
    },
    {
      name: "merge",
      usage: "markov merge <branch> [--message <msg>]",
      description: "Merge branches (creates a merge commit)",
      args: [
        { name: "<branch>", desc: "Branch to merge from" },
      ],
      options: [
        { name: "--message <string>", desc: "Merge commit message (default: 'Merge branch')" },
      ],
    },
    {
      name: "optimize",
      usage: "markov optimize <facets> [--apply]",
      description: "AI-powered gas optimization suggestions",
      args: [
        { name: "<facets>", desc: "Facet names to optimize (comma-separated)" },
      ],
      options: [
        { name: "--apply", desc: "Apply optimizations automatically" },
      ],
    },
    {
      name: "analyze",
      usage: "markov analyze <facets>",
      description: "AI-powered security analysis and vulnerability detection",
      args: [
        { name: "<facets>", desc: "Facet names to analyze (comma-separated)" },
      ],
      options: [],
    },
    {
      name: "propose",
      usage: "markov propose <facets> [--message <msg>]",
      description: "Submit diamondCut proposal to governance system",
      args: [
        { name: "<facets>", desc: "Facet names for proposal (comma-separated)" },
      ],
      options: [
        { name: "--message <string>", desc: "Proposal description (default: 'Diamond upgrade proposal')" },
      ],
    },
    {
      name: "viz",
      usage: "markov viz [--format <format>]",
      description: "Visualize Diamond structure (facets, selectors, dependencies)",
      args: [],
      options: [
        { name: "--format <string>", desc: "Output format: 'ascii' or 'json' (default: 'ascii')" },
      ],
    },
    {
      name: "migrate",
      usage: "markov migrate <from> <to>",
      description: "Generate state migration scripts between commits",
      args: [
        { name: "<from>", desc: "Source commit hash" },
        { name: "<to>", desc: "Target commit hash" },
      ],
      options: [],
    },
    {
      name: "stats",
      usage: "markov stats [--format <format>]",
      description: "Display analytics and statistics about the Diamond",
      args: [],
      options: [
        { name: "--format <string>", desc: "Output format: 'table' or 'json' (default: 'table')" },
      ],
    },
    {
      name: "agent",
      usage: "markov agent <action>",
      description: "Manage autonomous AI agent for monitoring and maintenance",
      args: [
        { name: "<action>", desc: "Agent action: 'start', 'stop', or 'report'" },
      ],
      options: [],
    },
  ];

  // Print each command with details
  commands.forEach((cmd) => {
    // Command name and description
    console.log(COLORS.NAME(cmd.name));
    console.log(`  ${COLORS.DESCRIPTION(cmd.description)}`);
    
    // Usage with colored components
    console.log(`  ${COLORS.SECTION("Usage:")} ${COLORS.NPX} ${COLORS.HARDHAT} ${formatUsage(cmd.usage)}`);
    
    // Arguments section
    if (cmd.args.length > 0) {
      console.log(`  ${COLORS.ARGS_HEADER}`);
      cmd.args.forEach((arg) => {
        console.log(`    ${COLORS.ARGUMENT(arg.name.padEnd(30))} ${COLORS.ARG_DESC(arg.desc)}`);
      });
    }
    
    // Options section
    if (cmd.options.length > 0) {
      console.log(`  ${COLORS.OPTIONS_HEADER}`);
      cmd.options.forEach((opt) => {
        console.log(`    ${COLORS.OPTION(opt.name.padEnd(30))} ${COLORS.OPT_DESC(opt.desc)}`);
      });
    }
    
    console.log();
  });

  /* console.log(COLORS.BORDER("╔════════════════════════════════════════════════════════════════════╗"));
  console.log(COLORS.BORDER("║") + "  For detailed help on a specific command:                         " + COLORS.BORDER("║"));
  console.log(COLORS.BORDER("║") + `  ${COLORS.NPX} ${COLORS.HARDHAT} help ${COLORS.MARKOV}:${COLORS.COMMAND("<command>")}` + " ".repeat(33) + COLORS.BORDER("║"));
  console.log(COLORS.BORDER("║                                                                    ║"));
  console.log(COLORS.BORDER("║") + "  Examples:                                                         " + COLORS.BORDER("║"));
  
  // Format example commands
  const examples = [
    `${COLORS.NPX} ${COLORS.HARDHAT} ${COLORS.MARKOV} ${COLORS.COMMAND("init")} ${COLORS.OPTION("--name")} ${COLORS.ARGUMENT("MyDiamond")}`,
    `${COLORS.NPX} ${COLORS.HARDHAT} ${COLORS.MARKOV} ${COLORS.COMMAND("deploy")} ${COLORS.ARGUMENT("Facet1,Facet2")} ${COLORS.OPTION("--message")} ${COLORS.ARGUMENT("\"Add features\"")}`,
    `${COLORS.NPX} ${COLORS.HARDHAT} ${COLORS.MARKOV} ${COLORS.COMMAND("log")} ${COLORS.OPTION("--limit")} ${COLORS.ARGUMENT("5")}`,
    `${COLORS.NPX} ${COLORS.HARDHAT} ${COLORS.MARKOV} ${COLORS.COMMAND("branch")} ${COLORS.COMMAND("create")} ${COLORS.ARGUMENT("feature-x")}`
  ];
  
  examples.forEach(example => {
    console.log(COLORS.BORDER("║") + "    " + COLORS.EXAMPLE(example) + " ".repeat(Math.max(0, 60 - example.length)) + COLORS.BORDER("║"));
  });
  
  console.log(COLORS.BORDER("╚════════════════════════════════════════════════════════════════════╝\n")); */
}
