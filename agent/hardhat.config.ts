import { HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-ethers";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Import Markov audit task
import "./src/tasks/audit";

/**
 * Markov Audit System - Hardhat Configuration
 * Version: 2.0.0
 * Updated: 2025-10-26 05:46:53 UTC
 * Developer: charlesms-eth
 * License: MIT (FREE OPEN SOURCE)
 */
const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  
  networks: {
    hardhat: {
      chainId: 31337,
    },
    mainnet: {
      url: process.env.MAINNET_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || "",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  
  // Markov Audit Configuration
  markov: {
    // MCP Server
    engineUrl: process.env.MCP_SERVER_URL || "http://localhost:8000",
    
    // Blockscout MCP (No API key needed!)
    blockscoutMcp: process.env.BLOCKSCOUT_MCP_SERVER || "https://mcp.blockscout.com",
    
    // Output preferences
    outputFormat: (process.env.OUTPUT_FORMAT as "pdf" | "md" | "both" | "json") || "both",
    outputDir: process.env.OUTPUT_DIR || "./audit-reports",
    
    // Agent configuration
    agentverseApiKey: process.env.AGENTVERSE_API_KEY,
    coordinatorAddress: process.env.COORDINATOR_AGENT_ADDRESS,
    
    // MeTTa configuration
    mettaPath: process.env.METTA_KNOWLEDGE_BASE_PATH || "./python/metta",
    
    // Features
    enableChat: true,  // ASI:One chat interface
    enableMetta: true, // MeTTa reasoning
    enableAgents: true, // Multi-agent system
  },
};

export default config;