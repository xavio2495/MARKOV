import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskArguments } from "hardhat/types/tasks";

interface MarkovStatsArguments {
  format: string;
}

/**
 * Display analytics and statistics.
 */
export default async function markovStats(
  taskArguments: TaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  console.log("\n📈 Diamond Statistics\n");
  console.log(`Format: ${taskArguments.format}`);
  console.log("\n⚠️  This command is not yet fully implemented.\n");
  // TODO: Aggregate gas usage, upgrade frequency, etc.
}
