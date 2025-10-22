import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskArguments } from "hardhat/types/tasks";
import { displaySplashScreen } from "../../utils/splash.js";

// Track if splash has been shown this session
let splashShown = false;

/**
 * Main dispatcher for markov CLI commands.
 * Routes to appropriate subtasks based on command.
 */
export default async function markovDispatcher(
  taskArguments: TaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  // Display splash screen on first invocation
  if (!splashShown) {
    displaySplashScreen();
    splashShown = true;
  }

  // Get command and args from taskArguments (parsed by Hardhat)
  const command = taskArguments.command || null;
  const args = taskArguments.args || [];
  
  console.log(`\nExecuting markov command: ${command || 'help'}`);
  console.log(`With args: ${JSON.stringify(args)}\n`);

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
    console.error(` Unknown command: ${command}`);
    console.log("\n Available commands:");
    validCommands.forEach((cmd) => {
      console.log(`  - markov ${cmd ?? 'help'}`);
    });
    console.log("\nFor help on a specific command, run:");
    console.log("  npx hardhat help markov:<command>");
    throw new Error(`Invalid markov command: ${command}`);
  }

  // If no command or 'help', show splash and exit
  if (command === null || command === 'help') {
    return;
  }

  // Construct subtask name
  const subtaskName = `markov:${command}`;

  try {
    // Parse args for the subtask based on command
    const subtaskArgs = parseArgsForCommand(command, args);

    // Get the subtask and run it
    const subtask = hre.tasks.getTask(subtaskName);
    await subtask.run(subtaskArgs);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`❌ Error executing markov ${command}:`, error.message);
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
      // markov clone <address> [--network <network>]
      if (args.length > 0) {
        parsed.address = args[0];
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

    case "agent":
      // markov agent <action>
      if (args.length > 0) {
        parsed.action = args[0];
      }
      break;
      
    case "help":
    case null :
      displaySplashScreen();
      break;
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
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const value = args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : true;
      parsed[key] = value;
      if (value !== true) {
        i++; // Skip next arg as it's the value
      }
    }
  }

  return parsed;
}
