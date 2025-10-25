import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskArguments } from "hardhat/types/tasks";
import { displaySplashScreen } from "../../utils/splash.js";

// Track if splash has been shown this session
//let splashShown = false;

/**
 * Main dispatcher for markov CLI commands.
 * Routes to appropriate subtasks based on command.
 */
export default async function markovDispatcher(
  taskArguments: TaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  // Display splash screen on first invocation
/*   if (!splashShown) {
    displaySplashScreen();
    splashShown = true;
  } */

  // Get command and args from taskArguments (parsed by Hardhat)
  const command = taskArguments.command || null;
  // Start with positional args parsed by Hardhat
  const positionalArgs: string[] = Array.isArray((taskArguments as any).args)
    ? ([...(taskArguments as any).args] as string[])
    : [];
  const anyArgs = taskArguments as Record<string, any>;
  let args: string[] = [...positionalArgs];

  // Merge selected options from taskArguments into args so subtasks receive them
  if (command === "config") {
    if (anyArgs.list === true) {
      args.push("--list");
    }
    if (typeof anyArgs.get === "string" && anyArgs.get.length > 0) {
      args.push("--get", anyArgs.get);
    }
    if (typeof anyArgs.set === "string" && anyArgs.set.length > 0) {
      const v = typeof anyArgs.value === "string" ? anyArgs.value : anyArgs.setValue;
      if (typeof v === "string" && v.length > 0) {
        args.push("--set", anyArgs.set, v);
      }
    }
  } else {
    // Generic merge for boolean/string options (e.g., --force)
    for (const [k, v] of Object.entries(anyArgs)) {
      if (k === "command" || k === "args") continue;
      if (typeof v === "boolean" && v) {
        args.push(`--${k}`);
      } else if (typeof v === "string" && v.length > 0) {
        args.push(`--${k}`, v);
      }
    }
  }
  
  //console.log(`\nExecuting markov command: ${command || 'help'}`);
  //console.log(`With args: ${JSON.stringify(args)}\n`);

  // Map of valid commands
  const validCommands = [
    null,
    "help",
    "config",
    "init",
    "clone",
    "log",
    "deploy",
    "reset",
    "status",
    "sync",
    "branch",
    "merge",
    "optimize",
    "analyze",
    "propose",
    "viz",
    "migrate",
    "stats",
    "agent",
  ];

  if (!validCommands.includes(command)) {
    console.error(`Unknown command: ${command}`);
    console.log("\nAvailable commands:");
    validCommands
      .filter(cmd => cmd !== null)
      .forEach((cmd) => {
        console.log(`  - markov ${cmd}`);
      });
    console.log("\nFor detailed help, run:");
    console.log("  npx hardhat markov help");
    console.log("\nFor help on a specific command, run:");
    console.log("  npx hardhat help markov:<command>");
    throw new Error(`Invalid markov command: ${command}`);
  }

  // If no command, show splash and exit
  if (command === null || command === "") {
    displaySplashScreen();
    return;
  }

  // Construct subtask name
  const subtaskName = `markov:${command}`;

  try {
    // Parse args for the subtask based on command
    const subtaskArgs = parseArgsForCommand(command, args);

    // If this is the stats command and required inputs are missing, prompt the user
    if (command === "stats") {
      const sa = subtaskArgs as Record<string, any>;
      const readline = await import("readline");

      // Prompt for address if missing
      if (!sa.address || String(sa.address).trim() === "") {
        sa.address = await new Promise<string>((resolve) => {
          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          rl.question("Contract address: ", (answer: string) => {
            rl.close();
            resolve(answer.trim());
          });
        });

        if (!sa.address) {
          throw new Error("Contract address is required for 'markov stats'");
        }
      }

      // Prompt for chain if missing (allow empty to keep default)
      if (!sa.chain || String(sa.chain).trim() === "") {
        const chainAnswer = await new Promise<string>((resolve) => {
          const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
          rl.question("Chain (name or id) [leave empty for default]: ", (answer: string) => {
            rl.close();
            resolve(answer.trim());
          });
        });
        if (chainAnswer) sa.chain = chainAnswer;
      }
    }

    // Get the subtask and run it
    const subtask = hre.tasks.getTask(subtaskName);
    await subtask.run(subtaskArgs);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error executing markov ${command}:`, error.message);
      if (hre.config.markov.verbose) {
        console.error(error.stack);
      }
    }
    throw error;
  }
}

/**
 * Parse additional arguments for specific commands
 */
function parseArgsForCommand(
  command: string,
  args: string[],
): Record<string, unknown> {
  const parsed: Record<string, unknown> = {};

  switch (command) {
    case "clone":
      // markov clone <address> [sourceNetwork]
      if (args.length > 0) {
        parsed.address = args[0];
      }
      if (args.length > 1) {
        parsed.sourceNetwork = args[1];
      }
      break;

    case "deploy":
      // markov deploy <facets> [--message <msg>] [--simulate]
      if (args.length > 0) {
        parsed.facets = args[0];
      }
      break;

    case "reset":
      // markov reset <hash> [--simulate]
      if (args.length > 0) {
        parsed.hash = args[0];
      }
      break;

    case "branch":
      // markov branch <action> [name]
      if (args.length > 0) {
        parsed.action = args[0];
      }
      if (args.length > 1) {
        parsed.name = args[1];
      }
      break;

    case "merge":
      // markov merge <branch> [--message <msg>]
      if (args.length > 0) {
        parsed.branch = args[0];
      }
      break;

    case "optimize":
    case "analyze":
      // markov optimize <facets> [--apply]
      if (args.length > 0) {
        parsed.facets = args[0];
      }
      break;

    case "propose":
      // markov propose <facets> [--message <msg>]
      if (args.length > 0) {
        parsed.facets = args[0];
      }
      break;

    case "migrate":
      // markov migrate <from> <to>
      if (args.length > 0) {
        parsed.from = args[0];
      }
      if (args.length > 1) {
        parsed.to = args[1];
      }
      break;

    case "stats":
      // markov stats <address> [--chain <network>] [--format <table|json>]
      if (args.length > 0) {
        parsed.address = args[0];
      }
      if (args.length > 1) {
        // support second positional arg as chain (same as clone supports sourceNetwork)
        parsed.chain = args[1];
      }
      break;
      
    case "help":
    case "log":
    case "status":
    case "sync":
    case "viz":
    case "stats":
    case "config":
    case "init":
      // These commands use options only
      break;

    default:
      break;
  }

  // Parse common flags from args (basic implementation)
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg.startsWith("--")) continue;

    // Special handling for config command which may need two values after --set
    if (command === "config") {
      if (arg === "--set") {
        const key = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : undefined;
        const value = args[i + 2] && !args[i + 2].startsWith("--") ? args[i + 2] : undefined;
        if (key !== undefined && value !== undefined) {
          (parsed as any).set = key;
          (parsed as any).setValue = value;
          i += 2;
          continue;
        }
      }
      if (arg === "--get") {
        const key = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : undefined;
        if (key !== undefined) {
          (parsed as any).get = key;
          i += 1;
          continue;
        }
      }
      if (arg === "--list") {
        (parsed as any).list = true;
        continue;
      }
    }

    const key = arg.slice(2);
    const value = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
    parsed[key] = value;
    if (value !== true) {
      i++; // Skip next arg as it's the value
    }
  }

  return parsed;
}
