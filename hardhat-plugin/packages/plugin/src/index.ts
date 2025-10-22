import { task } from "hardhat/config";
import { ArgumentType } from "hardhat/types/arguments";
import type { HardhatPlugin } from "hardhat/types/plugins";

import "./type-extensions.js";

const plugin: HardhatPlugin = {
  id: "hardhat-markov",
  hookHandlers: {
    config: () => import("./hooks/config.js"),
    network: () => import("./hooks/network.js"),
  },
  tasks: [
    // Legacy example task (can be removed later)
    task("my-task", "Prints a greeting.")
      .addOption({
        name: "who",
        description: "Who is receiving the greeting.",
        type: ArgumentType.STRING,
        defaultValue: "Hardhat",
      })
      .setAction(() => import("./tasks/my-task.js"))
      .build(),

    // Main markov task dispatcher with optional command and variadic args
    task("markov", "Git-like versioning for ERC-2535 Diamond contracts")
      .addPositionalArgument({
        name: "command",
        description: "Markov command to execute (config, init, deploy, log, status, etc.)",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .addVariadicArgument({
        name: "args",
        description: "Additional arguments for the command",
        type: ArgumentType.STRING,
        defaultValue: [],
      })
      .setAction(() => import("./tasks/markov/dispatcher.js"))
      .build(),

    // Markov tasks for individual commands
    task("markov:config", "Configure Markov settings")
      .setAction(() => import("./tasks/markov/config.js"))
      .build(),

    task("markov:init", "Initialize a new Diamond contract")
      .addOption({
        name: "name",
        description: "Name of the Diamond contract",
        type: ArgumentType.STRING,
        defaultValue: "Diamond",
      })
      .setAction(() => import("./tasks/markov/init.js"))
      .build(),

    task("markov:clone", "Clone an existing Diamond contract")
      .addOption({
        name: "address",
        description: "Diamond contract address to clone",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .addOption({
        name: "sourceNetwork",
        description: "Source network name (avoids conflict with global --network)",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .setAction(() => import("./tasks/markov/clone.js"))
      .build(),

    task("markov:log", "Display version history")
      .addOption({
        name: "branch",
        description: "Branch to show logs for",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .addOption({
        name: "limit",
        description: "Number of commits to show",
        type: ArgumentType.INT,
        defaultValue: 10,
      })
      .setAction(() => import("./tasks/markov/log.js"))
      .build(),

    task("markov:deploy", "Deploy facets and execute diamondCut")
      .addOption({
        name: "facets",
        description: "Facet names to deploy (comma-separated)",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .addOption({
        name: "message",
        description: "Commit message",
        type: ArgumentType.STRING,
        defaultValue: "Deploy facets",
      })
      .addOption({
        name: "simulate",
        description: "Simulate without executing",
        type: ArgumentType.BOOLEAN,
        defaultValue: false,
      })
      .setAction(() => import("./tasks/markov/deploy.js"))
      .build(),

    task("markov:reset", "Revert to a previous state")
      .addOption({
        name: "hash",
        description: "Commit hash to reset to",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .addOption({
        name: "simulate",
        description: "Simulate without executing",
        type: ArgumentType.BOOLEAN,
        defaultValue: false,
      })
      .setAction(() => import("./tasks/markov/reset.js"))
      .build(),

    task("markov:status", "Check Diamond contract health")
      .setAction(() => import("./tasks/markov/status.js"))
      .build(),

    task("markov:sync", "Sync local history with on-chain events")
      .setAction(() => import("./tasks/markov/sync.js"))
      .build(),

    task("markov:branch", "Manage branches")
      .addOption({
        name: "action",
        description: "Branch action (create, switch, list)",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .addOption({
        name: "name",
        description: "Branch name",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .setAction(() => import("./tasks/markov/branch.js"))
      .build(),

    task("markov:merge", "Merge branches")
      .addOption({
        name: "branch",
        description: "Branch to merge from",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .addOption({
        name: "message",
        description: "Merge commit message",
        type: ArgumentType.STRING,
        defaultValue: "Merge branch",
      })
      .setAction(() => import("./tasks/markov/merge.js"))
      .build(),

    task("markov:optimize", "AI-powered gas optimization")
      .addOption({
        name: "facets",
        description: "Facet names to optimize (comma-separated)",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .addOption({
        name: "apply",
        description: "Apply optimizations automatically",
        type: ArgumentType.BOOLEAN,
        defaultValue: false,
      })
      .setAction(() => import("./tasks/markov/optimize.js"))
      .build(),

    task("markov:analyze", "AI-powered security analysis")
      .addOption({
        name: "facets",
        description: "Facet names to analyze (comma-separated)",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .setAction(() => import("./tasks/markov/analyze.js"))
      .build(),

    task("markov:propose", "Submit diamondCut proposal to governance")
      .addOption({
        name: "facets",
        description: "Facet names for proposal (comma-separated)",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .addOption({
        name: "message",
        description: "Proposal description",
        type: ArgumentType.STRING,
        defaultValue: "Diamond upgrade proposal",
      })
      .setAction(() => import("./tasks/markov/propose.js"))
      .build(),

    task("markov:viz", "Visualize Diamond structure")
      .addOption({
        name: "format",
        description: "Output format (ascii, json)",
        type: ArgumentType.STRING,
        defaultValue: "ascii",
      })
      .setAction(() => import("./tasks/markov/viz.js"))
      .build(),

    task("markov:migrate", "Generate state migration scripts")
      .addOption({
        name: "from",
        description: "Source commit hash",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .addOption({
        name: "to",
        description: "Target commit hash",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .setAction(() => import("./tasks/markov/migrate.js"))
      .build(),

    task("markov:stats", "Display analytics and statistics")
      .addOption({
        name: "format",
        description: "Output format (table, json)",
        type: ArgumentType.STRING,
        defaultValue: "table",
      })
      .setAction(() => import("./tasks/markov/stats.js"))
      .build(),

    task("markov:agent", "Manage autonomous AI agent")
      .addOption({
        name: "action",
        description: "Agent action (start, stop, report)",
        type: ArgumentType.STRING,
        defaultValue: "",
      })
      .setAction(() => import("./tasks/markov/agent.js"))
      .build(),
  ],
};

export default plugin;
