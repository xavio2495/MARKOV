import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskArguments } from "hardhat/types/tasks";
import type { DeploymentReport, DeployedFacetInfo } from "../../types.js";
import { ensureConfigKeys } from "./config.js";
import { createHistoryStorage } from "../../storage/history-storage.js";
import {
  parseFacetList,
  isValidFacetName,
  parseConstructorParams,
  promptForConstructorArgs,
  promptForAction,
  generateIgnitionModule,
  writeCombinedModule,
  formatGas,
} from "../../utils/deployment.js";
import chalk from "chalk";

interface MarkovDeployArguments extends TaskArguments {
  facets: string;
  message: string;
  simulate: boolean;
  skipCompile?: boolean;
  action?: string;
  separateModules?: boolean;
}

/**
 * Deploy facets and execute diamondCut.
 */
export default async function markovDeploy(
  taskArguments: TaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  const args = taskArguments as MarkovDeployArguments;

  console.log(chalk.cyan("\n╔════════════════════════════════════════════════════════════════════╗"));
  console.log(chalk.cyan("║") + chalk.bold.white("                  🚀 MARKOV - Deploy Facets                      ") + chalk.cyan("║"));
  console.log(chalk.cyan("╚════════════════════════════════════════════════════════════════════╝\n"));

  // Phase 3: Pre-Deploy Validation
  try {
    await validateDeployment(hre, args);
  } catch (error: any) {
    console.error(chalk.red(`\n❌ Validation failed: ${error.message}\n`));
    return;
  }

  // Parse facet list
  const facetNames = parseFacetList(args.facets);
  if (facetNames.length === 0) {
    console.error(chalk.red("\n❌ No facets specified. Use --facets <FacetName1,FacetName2>\n"));
    return;
  }

  console.log(chalk.green(`✓ Deploying ${facetNames.length} facet(s): ${facetNames.join(", ")}\n`));

  // Validate facet names
  for (const name of facetNames) {
    if (!isValidFacetName(name)) {
      console.error(chalk.red(`\n❌ Invalid facet name: "${name}". Must start with uppercase, alphanumeric only.\n`));
      return;
    }
  }

  // Phase 2: Generate Ignition Modules
  const facetsWithArgs: Array<{ name: string; args: any[]; action: 0 | 1 | 2 }> = [];

  for (const facetName of facetNames) {
    console.log(chalk.blue(`\n📦 Processing facet: ${facetName}`));

    // Parse constructor parameters
    const params = await parseConstructorParams(hre, facetName);
    let constructorArgs: any[] = [];

    if (params.length > 0) {
      console.log(chalk.yellow(`  ⚠️  Constructor requires ${params.length} parameter(s)`));
      constructorArgs = await promptForConstructorArgs(params);
    } else {
      console.log(chalk.gray("  ✓ No constructor parameters required"));
    }

    // Prompt for action (add/replace/remove)
    const existingFacets: string[] = []; // TODO: Query Diamond for existing facets
    const action = args.action
      ? parseActionString(args.action)
      : await promptForAction(facetName, existingFacets);

    facetsWithArgs.push({ name: facetName, args: constructorArgs, action });

    // Generate Ignition module (if separate modules mode)
    if (args.separateModules) {
      const modulePath = await generateIgnitionModule(hre, facetName, constructorArgs);
      console.log(chalk.green(`  ✓ Generated Ignition module: ${modulePath}`));
    }
  }

  // Generate combined module if not using separate modules
  if (!args.separateModules) {
    const modulePath = await writeCombinedModule(
      hre,
      facetsWithArgs.map(({ name, args }) => ({ name, args })),
    );
    console.log(chalk.green(`\n✓ Generated combined Ignition module: ${modulePath}`));
  }

  console.log(chalk.yellow("\n⚠️  Phase 4-11 not yet implemented (deploy, diamondCut, validation, reporting)\n"));

  // Phase 4: Deploy facets using Hardhat Ignition
  let deployedFacets: DeployedFacetInfo[] = [];
  
  try {
    deployedFacets = await deployFacetsWithIgnition(hre, facetsWithArgs, args.separateModules || false);
  } catch (error: any) {
    console.error(chalk.red(`\n❌ Deployment failed: ${error.message}\n`));
    return;
  }

  // Display deployment results
  console.log(chalk.cyan("\n" + "═".repeat(70)));
  console.log(chalk.bold.white("Deployment Results:"));
  console.log(chalk.cyan("═".repeat(70)));
  
  for (const facet of deployedFacets) {
    const statusIcon = facet.status === "success" ? chalk.green("✓") : chalk.red("✗");
    console.log(`${statusIcon} ${chalk.bold(facet.name)}`);
    if (facet.status === "success") {
      console.log(`  Address: ${chalk.blue(facet.address)}`);
      console.log(`  Gas Used: ${chalk.yellow(formatGas(facet.gasUsed))}`);
      console.log(`  Selectors: ${facet.selectors.length}`);
    } else {
      console.log(`  Error: ${chalk.red(facet.error || "Unknown error")}`);
    }
  }
  
  console.log(chalk.cyan("═".repeat(70) + "\n"));

  // TODO: Phase 5 - Execute diamondCut transaction
  // TODO: Phase 6 - Validate deployment via Blockscout
  // TODO: Phase 7 - Handle simulate mode
  // TODO: Phase 8 - Generate deployment report
  // TODO: Phase 9 - Record commit to branch
  // TODO: Phase 10 - Polish UX with progress indicators
}

/**
 * Phase 3: Validate deployment prerequisites
 */
async function validateDeployment(
  hre: HardhatRuntimeEnvironment,
  args: MarkovDeployArguments,
): Promise<void> {
  // Check config keys
  await ensureConfigKeys(hre);

  // Get current branch
  const storage = createHistoryStorage(hre.config.paths.root);
  const currentBranch = await storage.getCurrentBranchName();
  if (!currentBranch) {
    throw new Error("No current branch. Run 'npx hardhat markov branch create <name>' first.");
  }

  // Get branch config
  const branchFile = await storage.getBranchFile(currentBranch);
  if (!branchFile) {
    throw new Error(`Branch file not found for "${currentBranch}". This should not happen.`);
  }
  
  const diamondAddress = branchFile.config.diamondAddress;

  if (!diamondAddress || diamondAddress === "0x0000000000000000000000000000000000000000") {
    throw new Error(
      `No Diamond address configured for branch "${currentBranch}". Set it in config or clone from an existing Diamond.`,
    );
  }

  console.log(chalk.green(`✓ Current branch: ${currentBranch}`));
  console.log(chalk.green(`✓ Diamond address: ${diamondAddress}`));

  // TODO: Query Diamond contract to verify it exists on-chain
  // TODO: Check compilation status (compare artifact timestamps)

  // Skip compilation if requested
  if (!args.skipCompile) {
    console.log(chalk.blue("\n📝 Compiling contracts..."));
    try {
      await hre.tasks.getTask("compile").run({});
      console.log(chalk.green("✓ Compilation successful"));
    } catch (error: any) {
      throw new Error(`Compilation failed: ${error.message}`);
    }
  } else {
    console.log(chalk.yellow("⚠️  Skipping compilation (--skip-compile)"));
  }
}

/**
 * Parse action string to FacetCut action enum
 */
function parseActionString(action: string): 0 | 1 | 2 {
  const normalized = action.trim().toLowerCase();
  switch (normalized) {
    case "add":
      return 0;
    case "replace":
      return 1;
    case "remove":
      return 2;
    default:
      throw new Error(`Invalid action: "${action}". Use add, replace, or remove.`);
  }
}

/**
 * Phase 4: Deploy facets using Hardhat Ignition
 */
async function deployFacetsWithIgnition(
  hre: HardhatRuntimeEnvironment,
  facets: Array<{ name: string; args: any[]; action: 0 | 1 | 2 }>,
  separateModules: boolean,
): Promise<DeployedFacetInfo[]> {
  const deployedFacets: DeployedFacetInfo[] = [];
  
  console.log(chalk.blue("\n🚀 Deploying facets with Hardhat Ignition...\n"));

  if (separateModules) {
    // Deploy each facet separately
    for (const facet of facets) {
      console.log(chalk.gray(`Deploying ${facet.name}...`));
      
      try {
        // Run Ignition deploy task
        const moduleId = `${facet.name}Module`;
        const result = await hre.tasks.getTask("ignition:deploy").run({
          moduleId,
          reset: false,
          verify: false,
        });
        
        // Extract deployment info from result
        // Note: Actual structure depends on Hardhat Ignition's return value
        const address = result?.deployedContracts?.[facet.name] || "0x0";
        const gasUsed = result?.gasUsed || 0;
        
        // Extract selectors from ABI
        const artifact = await hre.artifacts.readArtifact(facet.name);
        const selectors = extractSelectorsFromABI(artifact.abi);
        
        deployedFacets.push({
          name: facet.name,
          address,
          gasUsed,
          status: "success",
          selectors,
          action: facet.action,
        });
        
        console.log(chalk.green(`  ✓ ${facet.name} deployed at ${address}`));
      } catch (error: any) {
        console.error(chalk.red(`  ✗ ${facet.name} failed: ${error.message}`));
        deployedFacets.push({
          name: facet.name,
          address: "",
          gasUsed: 0,
          status: "failed",
          error: error.message,
          selectors: [],
          action: facet.action,
        });
      }
    }
  } else {
    // Deploy with combined module
    console.log(chalk.gray("Deploying all facets with combined module..."));
    
    try {
      const result = await hre.tasks.getTask("ignition:deploy").run({
        moduleId: "DiamondFacetsModule",
        reset: false,
        verify: false,
      });
      
      // Extract deployment info for each facet
      for (const facet of facets) {
        const address = result?.deployedContracts?.[facet.name] || "0x0";
        const gasUsed = result?.gasUsed?.[facet.name] || 0;
        
        // Extract selectors from ABI
        const artifact = await hre.artifacts.readArtifact(facet.name);
        const selectors = extractSelectorsFromABI(artifact.abi);
        
        deployedFacets.push({
          name: facet.name,
          address,
          gasUsed,
          status: "success",
          selectors,
          action: facet.action,
        });
        
        console.log(chalk.green(`  ✓ ${facet.name} deployed at ${address}`));
      }
    } catch (error: any) {
      console.error(chalk.red(`  ✗ Combined deployment failed: ${error.message}`));
      throw error;
    }
  }

  return deployedFacets;
}

/**
 * Extract function selectors from contract ABI
 */
function extractSelectorsFromABI(abi: readonly any[]): string[] {
  const selectors: string[] = [];
  
  for (const item of abi) {
    if (item.type === "function") {
      // For now, return empty array - will implement selector calculation with viem later
      // TODO: Use viem's toFunctionSelector() to compute selectors
    }
  }
  
  return selectors;
}

