import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskArguments } from "hardhat/types/tasks";

interface MarkovMergeArguments {
  branch: string;
  message: string;
}

/**
 * Merge another branch into current branch.
 */
export default async function markovMerge(
  taskArguments: TaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  console.log("\n🔀 Merging Branches\n");
  console.log(`Source branch: ${taskArguments.branch}`);
  console.log(`Message: ${taskArguments.message}`);
  console.log("\n⚠️  This command is not yet fully implemented.\n");
  // TODO: Merge cuts, resolve conflicts, create merge commit
}
