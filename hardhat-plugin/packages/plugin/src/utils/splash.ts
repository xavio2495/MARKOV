import chalk from "chalk";
import gradient from "gradient-string";

/**
 * Display the Markov splash screen
 */
export function displaySplashScreen(): void {
  const logo = `
    __    __     ______     ______     __  __     ______     __   __ 
   /\\ "-./  \\   /\\  __ \\   /\\  == \\   /\\ \\/ /    /\\  __ \\   /\\ \\ / / 
   \\ \\ \\-./\\ \\  \\ \\  __ \\  \\ \\  __<   \\ \\  _"-.  \\ \\ \\/\\ \\  \\ \\ \\'/  
    \\ \\_\\ \\ \\_\\  \\ \\_\\ \\_\\  \\ \\_\\ \\_\\  \\ \\_\\ \\_\\  \\ \\_____\\  \\ \\__|  
     \\/_/  \\/_/   \\/_/\\/_/   \\/_/ /_/   \\/_/\\/_/   \\/_____/   \\/_/   
`;

  console.log(gradient(["#e43535", "#4C67D0"]).multiline(logo));
  console.log(
    gradient(["#e43535", "#4C67D0"])(
      "                    WEB3 Version Control System",
    ),
  );
  console.log("");
  console.log(chalk.blue("Version:"));
  console.log(chalk.green("    1.0.0 (Released 25 October, 2025)"));
  console.log("");
  console.log(chalk.blue("Description:"));
  console.log(
    chalk.white(
      "    - CLI tool/Hardhat plugin with extensive features for version control of Smart Contracts through ERC-2535.",
    ),
  );
  console.log(
    chalk.white(
      "    - Supports multi-branching, merging, and hybrid history for safe auditable upgrades.",
    ),
  );
  console.log(
    chalk.white(
      "    - AI powered Smart Contract auditing and gas optimization.",
    ),
  );
  console.log(chalk.white("    - AI powered Smart Contract simulation."));
  console.log(
    chalk.white("    - Smart Contract Monitoring tool (CLI, Discord Webhook)."),
  );
  console.log("");
  console.log(chalk.blue("Dependencies:"));
  console.log(chalk.white("    - Hardhat 3.x (Core framework)"));
  console.log(chalk.white("    - viem (Contract interactions)"));
  console.log(chalk.white("    - fs-extra, crypto, inquirer (utilities)"));
  console.log(
    chalk.white(
      "    - @modelcontextprotocol/typescript-sdk (MCP for monitoring)",
    ),
  );
  console.log("");
  console.log(chalk.yellow("Warnings:"));
  console.log(
    chalk.white(
      "    - Always simulate (--simulate flag) before mainnet deploys to avoid gas waste or exploits.",
    ),
  );
  console.log(
    chalk.white("    - Monitoring requires API keys (markov api --setup)."),
  );
  console.log(
    chalk.white("    - Use markov optimize for gas savings on Diamond cuts."),
  );
  console.log("");
  console.log(chalk.blue("Resources:"));
  console.log(
    chalk.white(
      "    - Docs: https://charles1246.github.com/markov-docs (setup, tutorials)",
    ),
  );
  console.log(
    chalk.white(
      "    - GitHub: https://github.com/xavio2495/MARKOV (issues, contributions)",
    ),
  );
  console.log(chalk.white("    - Extended:"));
  console.log(
    chalk.white(
      "        - Blockscout MCP: https://github.com/blockscout/mcp-server",
    ),
  );
  console.log(
    chalk.white(
      "        - Fetch.ai Innovation Lab: https://innovationlab.fetch.ai/resources/docs/intro",
    ),
  );
  console.log("");
  console.log(chalk.blue("Built by:"));
  console.log(chalk.white("    - xavio2495"));
  console.log(chalk.white("    - charlesms1246"));
  console.log("");
  console.log(chalk.blue("License:"));
  console.log(chalk.white("    GPL 3.0"));
  console.log(chalk.white("    (Open Source Contributions are welcome)"));
  console.log("");
  console.log(chalk.dim("─".repeat(80)));
  console.log("");
}

/**
 * Display a compact version of the splash screen
 */
export function displayCompactSplash(): void {
 const logo = `
    __    __     ______     ______     __  __     ______     __   __ 
   /\\ "-./  \\   /\\  __ \\   /\\  == \\   /\\ \\/ /    /\\  __ \\   /\\ \\ / / 
   \\ \\ \\-./\\ \\  \\ \\  __ \\  \\ \\  __<   \\ \\  _"-.  \\ \\ \\/\\ \\  \\ \\ \\'/  
    \\ \\_\\ \\ \\_\\  \\ \\_\\ \\_\\  \\ \\_\\ \\_\\  \\ \\_\\ \\_\\  \\ \\_____\\  \\ \\__|  
     \\/_/  \\/_/   \\/_/\\/_/   \\/_/ /_/   \\/_/\\/_/   \\/_____/   \\/_/   
`;

  console.log(gradient(["#e43535", "#4C67D0"]).multiline(logo));
  console.log(
    gradient(["#e43535", "#4C67D0"])(
      "                    WEB3 Version Control System",
    ),
  );
  console.log("");
  console.log(chalk.blue("Version:"));
  console.log(chalk.green("    1.0.0 (Released 25 October, 2025)"));
  console.log("");
  console.log(chalk.dim("─".repeat(80)));
  console.log("");}
