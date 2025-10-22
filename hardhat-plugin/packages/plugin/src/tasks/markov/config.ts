import type { HardhatRuntimeEnvironment } from "hardhat/types/hre";
import type { TaskArguments } from "hardhat/types/tasks";

/**
 * Configure Markov settings.
 * Displays current configuration and instructions for updating.
 */
export default async function markovConfig(
  _taskArguments: TaskArguments,
  hre: HardhatRuntimeEnvironment,
) {
  console.log("\nMarkov Configuration\n");

  const currentConfig = hre.config.markov;

  console.log("Current configuration:");
  console.log(`  Chain: ${currentConfig.chain}`);
  console.log(`  Wallet: ${currentConfig.wallet || "(not set)"}`);
  console.log(`  Author: ${currentConfig.author}`);
  console.log(`  Gas Price: ${currentConfig.gasPrice}`);
  console.log(`  AI Model: ${currentConfig.aiModel}`);
  console.log(
    `  AI API Key: ${currentConfig.aiApiKey ? "****" + currentConfig.aiApiKey.slice(-4) : "(not set)"}`,
  );
  console.log(`  MCP Endpoint: ${currentConfig.mcpEndpoint}`);
  console.log(`  Auto-sync: ${currentConfig.autoSync}`);
  console.log(`  Verbose: ${currentConfig.verbose}`);
  console.log(`  History Path: ${currentConfig.historyPath}`);

  console.log("\n💡 To update configuration, edit hardhat.config.ts:");
  console.log("\n  export default {");
  console.log("    markov: {");
  console.log(`      chain: "localhost",`);
  console.log(`      wallet: "0x...",`);
  console.log(`      author: "Your Name",`);
  console.log(`      gasPrice: "auto",`);
  console.log(`      aiApiKey: process.env.OPENAI_API_KEY,`);
  console.log(`      aiModel: "gpt-4",`);
  console.log(`      mcpEndpoint: "https://mcp.blockscout.com/mcp",`);
  console.log(`      autoSync: true,`);
  console.log(`      verbose: false,`);
  console.log("    },");
  console.log("  };\n");
}
