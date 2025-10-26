/**
 * Markov Audit System - Type Definitions
 * Version: 2.0.0
 * Developer: charlesms-eth
 */

import "hardhat/types/config";
import "hardhat/types/runtime";

/**
 * Markov plugin configuration
 */
export interface MarkovConfig {
  /** URL of the audit engine MCP server */
  engineUrl: string;
  
  /** Blockscout MCP server URL */
  blockscoutMcp: string;
  
  /** Output format for reports */
  outputFormat: "pdf" | "md" | "both" | "json";
  
  /** Directory for audit reports */
  outputDir: string;
  
  /** Agentverse API key (optional) */
  agentverseApiKey?: string;
  
  /** Coordinator agent address */
  coordinatorAddress?: string;
  
  /** Path to MeTTa knowledge base */
  mettaPath?: string;
  
  /** Enable ASI:One chat interface */
  enableChat?: boolean;
  
  /** Enable MeTTa reasoning */
  enableMetta?: boolean;
  
  /** Enable multi-agent system */
  enableAgents?: boolean;
}

/**
 * Audit summary statistics
 */
export interface AuditSummary {
  total_checks: number;
  passed_checks: number;
  critical_issues: number;
  high_issues: number;
  medium_issues: number;
  low_issues: number;
}

/**
 * Security issue
 */
export interface Issue {
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  description: string;
  location: string;
  recommendation: string;
}

/**
 * Code fix suggestion
 */
export interface CodeFix {
  issue: string;
  original: string;
  fixed: string;
  explanation: string;
}

/**
 * Audit category results
 */
export interface AuditCategory {
  checks: Record<string, boolean>;
  issues: Issue[];
  code_fixes: CodeFix[];
}

/**
 * Complete audit result
 */
export interface AuditResult {
  contract_name: string;
  contract_address?: string;
  audit_date: string;
  network?: string;
  criteria: Record<string, AuditCategory>;
  summary: AuditSummary;
  risk_score: number;
  metta_insights: string[];
  recommendations: string[];
  pdf_path?: string;
  md_path?: string;
}

/**
 * Chat message
 */
export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

/**
 * Chat response
 */
export interface ChatResponse {
  message: string;
  suggestions?: string[];
  audit_triggered?: boolean;
  audit_result?: AuditResult;
}

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: "healthy" | "unhealthy";
  version: string;
  timestamp: string;
  components: {
    engine: string;
    agents: string;
    metta: string;
    blockscout: string;
  };
}

/**
 * Extend Hardhat config
 */
declare module "hardhat/types/config" {
  export interface HardhatUserConfig {
    markov?: Partial<MarkovConfig>;
  }

  export interface HardhatConfig {
    markov: MarkovConfig;
  }
}

/**
 * Extend Hardhat Runtime Environment
 */
declare module "hardhat/types/runtime" {
  export interface HardhatRuntimeEnvironment {
    markov: {
      audit: (contractPath?: string, options?: any) => Promise<AuditResult>;
      chat: (message: string) => Promise<ChatResponse>;
      getConfig: () => MarkovConfig;
      healthCheck: () => Promise<HealthCheckResponse>;
    };
  }
}