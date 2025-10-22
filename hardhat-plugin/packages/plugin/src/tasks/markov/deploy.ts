import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskArguments } from "hardhat/types/tasks";

interface MarkovDeployArguments {
  facets: string;
  message: string;
  simulate: boolean;
}

/**
 * Deploy facets and execute diamondCut.
 */
export default async function markovDeploy(
  taskArguments: TaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  console.log("\n🚀 Deploying Facets\n");
  console.log(`Facets: ${taskArguments.facets}`);
  console.log(`Message: ${taskArguments.message}`);
  console.log(`Simulate: ${taskArguments.simulate ? "Yes" : "No"}`);
  console.log("\n⚠️  This command is not yet fully implemented.\n");
  // TODO: Deploy facets, compute selectors, execute diamondCut, record commit
}
