import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskArguments } from "hardhat/types/tasks";

interface MarkovSyncArguments {}

/**
 * Sync local history with on-chain DiamondCut events.
 */
export default async function markovSync(
  _taskArguments: TaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  console.log("\n🔄 Syncing with On-Chain Events\n");
  console.log("⚠️  This command is not yet fully implemented.\n");
  // TODO: Query DiamondCut events, reconcile with local history
}
