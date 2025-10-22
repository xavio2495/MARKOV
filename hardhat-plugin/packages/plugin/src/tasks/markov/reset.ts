import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskArguments } from "hardhat/types/tasks";

interface MarkovResetArguments {
  hash: string;
  simulate: boolean;
}

/**
 * Revert Diamond to a previous state.
 */
export default async function markovReset(
  taskArguments: TaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  console.log("\n⏮️  Resetting to Previous State\n");
  console.log(`Target hash: ${taskArguments.hash}`);
  console.log(`Simulate: ${taskArguments.simulate ? "Yes" : "No"}`);
  console.log("\n⚠️  This command is not yet fully implemented.\n");
  // TODO: Load commit, compute reverting cut, execute, update history
}
