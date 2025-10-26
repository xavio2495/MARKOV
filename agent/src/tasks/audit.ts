/**
 * Markov Audit System - Main Audit Task
 * Version: 2.0.0
 * Updated: 2025-10-26 05:50:45 UTC
 * Developer: charlesms-eth
 * License: MIT (FREE OPEN SOURCE)
 */

import { task } from "hardhat/config";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import * as fs from "fs";
import * as path from "path";
import axios from "axios";
import chalk from "chalk";
import ora from "ora";

/**
 * Main Markov task
 */
task("markov", "🔍 Markov - Free AI-powered smart contract audit system")
  .addPositionalParam("action", "Action: audit, chat, config, health, version", "audit")
  .addOptionalParam("contract", "Specific contract file or address")
  .addOptionalParam("address", "On-chain contract address")
  .addOptionalParam("network", "Network for on-chain contracts", "mainnet")
  .addOptionalParam("format", "Output format: pdf, md, both, json")
  .addOptionalParam("output", "Output directory for reports")
  .addOptionalParam("message", "Message for chat action")
  .addFlag("verbose", "Show detailed output")
  .addFlag("local", "Only audit local contracts (skip on-chain)")
  .setAction(async (taskArgs, hre) => {
    const { action } = taskArgs;

    switch (action) {
      case "audit":
        await runAudit(taskArgs, hre);
        break;
      case "chat":
        await runChat(taskArgs, hre);
        break;
      case "config":
        showConfig(hre);
        break;
      case "health":
        await checkHealth(taskArgs, hre);
        break;
      case "version":
        showVersion();
        break;
      default:
        console.log(chalk.red(`Unknown action: ${action}`));
        console.log(chalk.yellow("Valid actions: audit, chat, config, health, version"));
    }
  });

/**
 * Run audit on contracts
 */
async function runAudit(args: any, hre: HardhatRuntimeEnvironment) {
  // Banner
  console.log(chalk.bold.magenta("\n" + "═".repeat(70)));
  console.log(chalk.bold.magenta("🔍 MARKOV - FREE AI SMART CONTRACT AUDIT SYSTEM"));
  console.log(chalk.bold.magenta("═".repeat(70)));
  console.log(chalk.gray("Version: 2.0.0 | Developer: charlesms-eth | License: MIT\n"));
  console.log(chalk.cyan("💡 Powered by: Fetch.ai uAgents + MeTTa Reasoning + Blockscout MCP"));
  console.log(chalk.green("🆓 Completely FREE and Open Source - No API Keys Required!\n"));
  console.log(chalk.gray("═".repeat(70) + "\n"));

  const engineUrl = args.engineUrl || hre.config.markov.engineUrl;
  const spinner = ora();

  // Check engine health
  spinner.start("Connecting to Markov audit engine...");
  
  try {
    const healthCheck = await axios.get(`${engineUrl}/health`, { timeout: 5000 });
    
    spinner.succeed(chalk.green("✓ Audit engine connected"));
    
    if (args.verbose) {
      console.log(chalk.gray(`   Engine Version: ${healthCheck.data.version}`));
      console.log(chalk.gray(`   Status: ${healthCheck.data.status}`));
      console.log(chalk.gray(`   Components: ${Object.entries(healthCheck.data.components || {})
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")}\n`));
    }
  } catch (error: any) {
    spinner.fail(chalk.red("✗ Audit engine not running"));
    console.log(chalk.yellow("\n🚀 Start the engine with:"));
    console.log(chalk.white("   $ cd python && source venv/bin/activate && python main.py\n"));
    console.log(chalk.gray("   Or use setup script: $ npm run setup\n"));
    process.exit(1);
  }

  let contracts: Array<{
    name: string;
    source: string;
    path?: string;
    address?: string;
  }> = [];

  // Scenario 1: Audit on-chain contract by address
  if (args.address) {
    console.log(chalk.cyan("📡 Fetching contract from Blockscout MCP...\n"));
    console.log(chalk.white(`   Address: ${args.address}`));
    console.log(chalk.white(`   Network: ${args.network}\n`));

    spinner.start("Fetching verified contract source...");

    try {
      const response = await axios.post(`${engineUrl}/api/audit/fetch`, {
        address: args.address,
        network: args.network,
      });

      contracts.push({
        name: response.data.name,
        source: response.data.source,
        address: args.address,
      });

      spinner.succeed(chalk.green(`✓ Fetched: ${response.data.name}`));
      
      if (args.verbose && response.data.compiler) {
        console.log(chalk.gray(`   Compiler: ${response.data.compiler}`));
      }
      console.log();
    } catch (error: any) {
      spinner.fail(chalk.red("✗ Failed to fetch contract"));
      console.log(chalk.red(`   Error: ${error.response?.data?.detail || error.message}\n`));
      process.exit(1);
    }
  }
  // Scenario 2: Audit specific local contract
  else if (args.contract) {
    const contractPath = path.resolve(args.contract);

    if (!fs.existsSync(contractPath)) {
      console.log(chalk.red(`✗ Contract not found: ${args.contract}\n`));
      process.exit(1);
    }

    console.log(chalk.cyan(`📂 Reading local contract: ${args.contract}\n`));

    const source = fs.readFileSync(contractPath, "utf-8");
    const name = path.basename(contractPath, ".sol");

    contracts.push({ name, source, path: contractPath });
  }
  // Scenario 3: Audit all contracts in ./contracts folder
  else {
    console.log(chalk.cyan("📂 Scanning contracts/ folder...\n"));

    spinner.start("Discovering Solidity files...");

    const contractsDir = hre.config.paths.sources;
    const files = getAllSolidityFiles(contractsDir);

    spinner.succeed(chalk.green(`✓ Found ${files.length} contract file(s)`));

    if (files.length === 0) {
      console.log(chalk.yellow("\n⚠️  No Solidity files found in contracts/ folder\n"));
      console.log(chalk.gray("   Create some contracts and run again!\n"));
      return;
    }

    if (args.verbose) {
      console.log(chalk.gray("   Files:"));
      files.forEach(file => {
        const relativePath = path.relative(process.cwd(), file);
        console.log(chalk.gray(`   • ${relativePath}`));
      });
    }
    console.log();

    for (const file of files) {
      const source = fs.readFileSync(file, "utf-8");
      const name = path.basename(file, ".sol");
      const relativePath = path.relative(process.cwd(), file);

      contracts.push({ name, source, path: relativePath });
    }
  }

  // Start audit
  console.log(chalk.bold.cyan(`🚀 Starting AI-powered audit of ${contracts.length} contract(s)...\n`));
  console.log(chalk.gray("   Using: 6 AI Agents + MeTTa Reasoning + 50+ Security Checks"));
  console.log(chalk.gray("─".repeat(70) + "\n"));

  const format = args.format || hre.config.markov.outputFormat;
  const outputDir = args.output || hre.config.markov.outputDir;

  let totalIssues = 0;
  let criticalCount = 0;
  let highCount = 0;
  const results: any[] = [];

  for (let i = 0; i < contracts.length; i++) {
    const contract = contracts[i];
    const num = chalk.gray(`[${i + 1}/${contracts.length}]`);

    console.log(chalk.bold.white(`${num} 🔍 Analyzing: ${contract.name}`));

    const startTime = Date.now();
    spinner.start("Coordinating AI agents...");

    try {
      const response = await axios.post(
        `${engineUrl}/api/audit`,
        {
          contract_name: contract.name,
          source_code: contract.source,
          contract_address: contract.address,
          network: args.network || "mainnet",
          output_format: format,
        },
        {
          timeout: 180000, // 3 minutes
          onUploadProgress: () => {
            spinner.text = "Sending contract to AI agents...";
          },
        }
      );

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      const result = response.data;
      results.push(result);

      spinner.succeed(chalk.green("✓ Audit complete"));

      // Display summary
      displayAuditSummary(contract.name, result, elapsed, args.verbose);

      const issueCount =
        result.summary.critical_issues +
        result.summary.high_issues +
        result.summary.medium_issues +
        result.summary.low_issues;

      totalIssues += issueCount;
      criticalCount += result.summary.critical_issues;
      highCount += result.summary.high_issues;

      // Show report paths
      if (result.pdf_path) {
        console.log(chalk.gray(`   📄 PDF: ${result.pdf_path}`));
      }
      if (result.md_path) {
        console.log(chalk.gray(`   📄 MD: ${result.md_path}`));
      }

    } catch (error: any) {
      spinner.fail(chalk.red("✗ Audit failed"));
      console.log(chalk.red(`   Error: ${error.response?.data?.detail || error.message}`));
    }

    if (i < contracts.length - 1) {
      console.log(chalk.gray("\n" + "─".repeat(70) + "\n"));
    }
  }

  // Final summary
  console.log(chalk.gray("\n" + "═".repeat(70)));
  console.log(chalk.bold.green("\n✅ AUDIT COMPLETE\n"));

  console.log(chalk.white("📊 Overall Summary:"));
  console.log(chalk.white(`   Contracts Audited: ${contracts.length}`));
  console.log(chalk.white(`   Total Issues Found: ${totalIssues}`));

  if (criticalCount > 0) {
    console.log(chalk.red.bold(`   🔴 Critical Issues: ${criticalCount}`));
  }
  if (highCount > 0) {
    console.log(chalk.red(`   🟠 High Issues: ${highCount}`));
  }

  const passRate = contracts.length > 0
    ? (((results.reduce((sum, r) => sum + r.summary.passed_checks, 0) /
        results.reduce((sum, r) => sum + r.summary.total_checks, 0)) * 100).toFixed(1))
    : "0";

  console.log(chalk.white(`   Overall Pass Rate: ${passRate}%`));

  console.log(chalk.white(`\n📁 Reports saved to: ${outputDir}/\n`));

  if (criticalCount > 0) {
    console.log(chalk.yellow.bold("⚠️  CRITICAL ISSUES DETECTED"));
    console.log(chalk.yellow("   Review and fix before deployment!\n"));
  } else if (highCount > 0) {
    console.log(chalk.yellow("⚠️  High-severity issues detected"));
    console.log(chalk.yellow("   Recommend fixing before production\n"));
  } else if (totalIssues === 0) {
    console.log(chalk.green("🎉 No security issues detected!"));
    console.log(chalk.green("   Contract follows security best practices\n"));
  }

  console.log(chalk.gray("═".repeat(70)));
  console.log(chalk.cyan("\n💡 Markov is FREE and Open Source!"));
  console.log(chalk.gray("   ⭐ Star: https://github.com/charlesms-eth/markov-audit"));
  console.log(chalk.gray("   🐛 Issues: https://github.com/charlesms-eth/markov-audit/issues"));
  console.log(chalk.gray("   📖 Docs: https://docs.markov-audit.io\n"));

  console.log(chalk.gray("═".repeat(70) + "\n"));
}

/**
 * Interactive chat with Markov assistant
 */
async function runChat(args: any, hre: HardhatRuntimeEnvironment) {
  console.log(chalk.bold.cyan("\n💬 Markov AI Assistant (ASI:One Chat)\n"));

  if (!args.message) {
    console.log(chalk.yellow("Usage: npx hardhat markov chat --message \"Your question\"\n"));
    console.log(chalk.gray("Example:"));
    console.log(chalk.white("  npx hardhat markov chat --message \"Audit my token contract\"\n"));
    return;
  }

  const engineUrl = hre.config.markov.engineUrl;
  const spinner = ora("Thinking...").start();

  try {
    const response = await axios.post(`${engineUrl}/api/chat`, {
      message: args.message,
      conversation_id: "cli-session",
      user_id: "cli-user",
    });

    spinner.stop();

    console.log(chalk.bold.green("🤖 Markov: ") + response.data.message + "\n");

    if (response.data.suggestions && response.data.suggestions.length > 0) {
      console.log(chalk.gray("💡 Suggestions:"));
      response.data.suggestions.forEach((s: string) => {
        console.log(chalk.gray(`   • ${s}`));
      });
      console.log();
    }

    if (response.data.audit_triggered) {
      console.log(chalk.cyan("🔍 Audit was triggered by your message\n"));
    }

  } catch (error: any) {
    spinner.fail("Failed to get response");
    console.log(chalk.red(`Error: ${error.response?.data?.detail || error.message}\n`));
  }
}

/**
 * Show configuration
 */
function showConfig(hre: HardhatRuntimeEnvironment) {
  console.log(chalk.bold.cyan("\n🔧 Markov Configuration\n"));
  
  const config = hre.config.markov;
  
  console.log(chalk.white("Engine:"));
  console.log(chalk.gray(`   URL: ${config.engineUrl}`));
  console.log(chalk.gray(`   Blockscout MCP: ${config.blockscoutMcp}`));
  
  console.log(chalk.white("\nOutput:"));
  console.log(chalk.gray(`   Format: ${config.outputFormat}`));
  console.log(chalk.gray(`   Directory: ${config.outputDir}`));
  
  console.log(chalk.white("\nFeatures:"));
  console.log(chalk.gray(`   ASI:One Chat: ${config.enableChat ? "✓ Enabled" : "✗ Disabled"}`));
  console.log(chalk.gray(`   MeTTa Reasoning: ${config.enableMetta ? "✓ Enabled" : "✗ Disabled"}`));
  console.log(chalk.gray(`   Multi-Agent System: ${config.enableAgents ? "✓ Enabled" : "✗ Disabled"}`));
  
  if (config.coordinatorAddress) {
    console.log(chalk.white("\nAgents:"));
    console.log(chalk.gray(`   Coordinator: ${config.coordinatorAddress}`));
  }
  
  console.log();
}

/**
 * Check health of audit engine
 */
async function checkHealth(args: any, hre: HardhatRuntimeEnvironment) {
  console.log(chalk.bold.cyan("\n🏥 Markov Health Check\n"));

  const engineUrl = hre.config.markov.engineUrl;
  const spinner = ora("Checking components...").start();

  try {
    const response = await axios.get(`${engineUrl}/health`);
    const health = response.data;

    spinner.succeed(chalk.green("✓ System is healthy"));

    console.log(chalk.white("\n📊 Status:"));
    console.log(chalk.gray(`   Version: ${health.version}`));
    console.log(chalk.gray(`   Status: ${health.status}`));
    console.log(chalk.gray(`   Timestamp: ${health.timestamp}`));

    if (health.components) {
      console.log(chalk.white("\n🔧 Components:"));
      Object.entries(health.components).forEach(([name, status]) => {
        const icon = status === "operational" ? "✓" : "✗";
        const color = status === "operational" ? chalk.green : chalk.red;
        console.log(color(`   ${icon} ${name}: ${status}`));
      });
    }

    console.log();

  } catch (error: any) {
    spinner.fail(chalk.red("✗ System is unhealthy"));
    console.log(chalk.red(`   Error: ${error.message}\n`));
    process.exit(1);
  }
}

/**
 * Show version information
 */
function showVersion() {
  console.log(chalk.bold.cyan("\n🔍 Markov Audit System\n"));
  console.log(chalk.white("Version: 2.0.0"));
  console.log(chalk.gray("Updated: 2025-10-26 05:50:45 UTC"));
  console.log(chalk.gray("Developer: charlesms-eth"));
  console.log(chalk.gray("License: MIT (FREE OPEN SOURCE)\n"));
  
  console.log(chalk.cyan("Built with:"));
  console.log(chalk.gray("   • Fetch.ai uAgents Framework"));
  console.log(chalk.gray("   • Hyperon MeTTa Reasoning Engine"));
  console.log(chalk.gray("   • Blockscout MCP Integration"));
  console.log(chalk.gray("   • ASI:One Chat Protocol\n"));
  
  console.log(chalk.green("🆓 Completely FREE - No API Keys - No Subscriptions"));
  console.log(chalk.gray("   Star: https://github.com/charlesms-eth/markov-audit\n"));
}

/**
 * Get all Solidity files recursively
 */
function getAllSolidityFiles(dir: string): string[] {
  const files: string[] = [];

  function traverse(currentDir: string) {
    if (!fs.existsSync(currentDir)) {
      return;
    }

    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      // Skip common directories
      const skipDirs = [
        "node_modules",
        "artifacts",
        "cache",
        "typechain-types",
        ".git",
        "dist",
        "build",
      ];

      if (entry.isDirectory() && !skipDirs.includes(entry.name)) {
        traverse(fullPath);
      } else if (entry.isFile() && entry.name.endsWith(".sol")) {
        files.push(fullPath);
      }
    }
  }

  traverse(dir);
  return files;
}

/**
 * Display audit summary with beautiful formatting
 */
function displayAuditSummary(
  contractName: string,
  result: any,
  elapsed: string,
  verbose: boolean
) {
  const summary = result.summary;

  console.log(chalk.white(`   ├─ Total Checks: ${summary.total_checks}`));
  console.log(chalk.green(`   ├─ ✓ Passed: ${summary.passed_checks}`));
  
  const failed = summary.total_checks - summary.passed_checks;
  if (failed > 0) {
    console.log(chalk.red(`   ├─ ✗ Failed: ${failed}`));
  }

  if (summary.critical_issues > 0) {
    console.log(chalk.red.bold(`   ├─ 🔴 Critical: ${summary.critical_issues}`));
  }
  if (summary.high_issues > 0) {
    console.log(chalk.red(`   ├─ 🟠 High: ${summary.high_issues}`));
  }
  if (summary.medium_issues > 0) {
    console.log(chalk.yellow(`   ├─ 🟡 Medium: ${summary.medium_issues}`));
  }
  if (summary.low_issues > 0) {
    console.log(chalk.blue(`   ├─ 🟢 Low: ${summary.low_issues}`));
  }

  const riskColor = 
    result.risk_score >= 7 ? chalk.red :
    result.risk_score >= 4 ? chalk.yellow :
    chalk.green;

  console.log(chalk.white(`   ├─ Risk Score: ${riskColor(result.risk_score + "/10")}`));
  console.log(chalk.gray(`   └─ Time: ${elapsed}s`));

  if (verbose && result.metta_insights && result.metta_insights.length > 0) {
    console.log(chalk.cyan(`\n   🧠 MeTTa Insights:`));
    result.metta_insights.slice(0, 3).forEach((insight: string) => {
      console.log(chalk.gray(`      • ${insight}`));
    });
  }

  if (verbose && result.recommendations && result.recommendations.length > 0) {
    console.log(chalk.cyan(`\n   💡 Top Recommendations:`));
    result.recommendations.slice(0, 2).forEach((rec: string) => {
      console.log(chalk.gray(`      • ${rec}`));
    });
  }

  console.log();
}