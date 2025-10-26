/**
 * Markov Audit System - Hardhat Plugin
 * Version: 2.0.0
 * Updated: 2025-10-26 05:46:53 UTC
 * Developer: charlesms-eth
 * License: MIT (FREE OPEN SOURCE)
 * 
 * Main entry point for the Hardhat plugin
 */

import { extendConfig, extendEnvironment } from "hardhat/config";
import { HardhatConfig, HardhatUserConfig } from "hardhat/types";
import { lazyObject } from "hardhat/plugins";

// Import tasks
import "./tasks/audit";

// Import types
import "./types";

/**
 * Extend Hardhat configuration with Markov settings
 */
extendConfig(
  (config: HardhatConfig, userConfig: Readonly<HardhatUserConfig>) => {
    const defaultConfig = {
      engineUrl: "http://localhost:8000",
      blockscoutMcp: "https://mcp.blockscout.com",
      outputFormat: "both" as const,
      outputDir: "./audit-reports",
      enableChat: true,
      enableMetta: true,
      enableAgents: true,
    };

    config.markov = {
      ...defaultConfig,
      ...(userConfig.markov || {}),
    };
  }
);

/**
 * Extend Hardhat Runtime Environment with Markov utilities
 */
extendEnvironment((hre) => {
  // Lazy load Markov utilities
  hre.markov = lazyObject(() => {
    return {
      /**
       * Audit a contract
       * @param contractPath - Path to contract or address
       * @param options - Audit options
       */
      async audit(contractPath?: string, options?: any) {
        return hre.run("markov", {
          action: "audit",
          contract: contractPath,
          ...options,
        });
      },

      /**
       * Chat with Markov assistant
       * @param message - User message
       */
      async chat(message: string) {
        return hre.run("markov", {
          action: "chat",
          message,
        });
      },

      /**
       * Get configuration
       */
      getConfig() {
        return hre.config.markov;
      },

      /**
       * Check health of audit engine
       */
      async healthCheck() {
        return hre.run("markov", {
          action: "health",
        });
      },
    };
  });
});

// Export types
export * from "./types";

// Plugin metadata
export const PLUGIN_NAME = "hardhat-plugin-markov";
export const PLUGIN_VERSION = "2.0.0";
export const PLUGIN_AUTHOR = "charlesms-eth";
export const PLUGIN_LICENSE = "MIT";