import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskArguments } from "hardhat/types/tasks";

interface MarkovLogArguments {
  branch?: string;
  limit: number;
}

/**
 * Display version history logs.
 */
export default async function markovLog(
  taskArguments: TaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  console.log("\n📜 Commit History\n");
  console.log(`Branch: ${taskArguments.branch || "current"}`);
  console.log(`Limit: ${taskArguments.limit}`);
  console.log("\n⚠️  This command is not yet fully implemented.\n");
  // TODO: Load history, display commits in git-log style
}
