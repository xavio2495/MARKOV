import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskArguments } from "hardhat/types/tasks";

interface MarkovProposeArguments {
  facets: string;
  message: string;
}

/**
 * Submit diamondCut proposal to governance contract.
 */
export default async function markovPropose(
  taskArguments: TaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  console.log("\n📝 Creating Governance Proposal\n");
  console.log(`Facets: ${taskArguments.facets}`);
  console.log(`Description: ${taskArguments.message}`);
  console.log("\n⚠️  This command is not yet fully implemented.\n");
  // TODO: Interact with governance contract, submit proposal
}
