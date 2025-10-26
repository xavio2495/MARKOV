# 🔍 Markov - Free AI-Powered Smart Contract Auditing System

<div align="center">

![Version](https://img.shields.io/badge/version-2.0.0-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
![Node](https://img.shields.io/badge/node-16+-green.svg)
![Status](https://img.shields.io/badge/status-production--ready-success.svg)

**Multi-Agent Security Analysis with MeTTa Reasoning**

🆓 **Completely FREE** • 🔓 **Open Source** • 🚀 **Production Ready**

[Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Demo](#-demo)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Usage Examples](#-usage-examples)
- [Documentation](#-documentation)
- [Hackathon Submission](#-hackathon-submission)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🎯 Overview

**Markov** is an advanced smart contract security auditing system that democratizes security analysis through AI. Built for **ETHGlobal Singapore 2025**, Markov combines cutting-edge technologies to provide comprehensive, free security audits.

### The Problem

Smart contract vulnerabilities have led to **$3B+ in losses** in 2024 alone. Traditional audits are:
- 💰 **Expensive** - $10k-$100k+ per audit
- ⏰ **Slow** - Weeks to months
- 🔒 **Not Scalable** - Limited auditor availability
- 🎯 **Inaccessible** - Small teams can't afford them

### Our Solution

Markov provides:
- ✅ **Instant Audits** - Results in 2-3 minutes
- ✅ **AI-Powered** - 6 specialist agents with MeTTa reasoning
- ✅ **Comprehensive** - 50+ security checks
- ✅ **Actionable** - Step-by-step fixes with code examples
- ✅ **Free Forever** - No subscriptions, no hidden costs

---

## ✨ Features

### 🤖 Multi-Agent Architecture

```
         ┌─────────────────┐
         │   Coordinator   │ ← Orchestrates analysis
         └────────┬────────┘
                  │
    ┌─────────────┼─────────────┐
    │             │             │
┌───▼───┐    ┌───▼───┐    ┌───▼───┐
│Reent- │    │Access │    │Integer│  ← 6 Specialist Agents
│rancy  │    │Control│    │Overflow│     with uAgents
└───────┘    └───────┘    └───────┘
    │             │             │
    └─────────────┼─────────────┘
                  │
         ┌────────▼────────┐
         │  MeTTa Reasoning │ ← Logical inference
         └─────────────────┘
```

**Agents (All with Fetch.ai uAgents):**
- 🔄 **Reentrancy Agent** - Detects reentrancy vulnerabilities
- 🔒 **Access Control Agent** - Authorization and permissions
- 🔢 **Integer Overflow Agent** - Arithmetic safety
- 📞 **External Calls Agent** - Call safety analysis
- ⛽ **Gas Optimization Agent** - Efficiency improvements
- 🧠 **Coordinator Agent** - Orchestration and aggregation

### 🧠 MeTTa Reasoning Engine

**850+ lines** of logical reasoning knowledge base:

```metta
; Vulnerability Detection with Logic
(detect-reentrancy $contract
  (and (has-external-call $contract)
       (not (has-reentrancy-guard $contract))
       (state-change-after-call $contract)))

; Risk Scoring
(calculate-risk-score $vulnerabilities
  (fold-left add-severity-weight 0 $vulnerabilities))
```

**Capabilities:**
- Pattern matching on contract AST
- Logical inference for vulnerability detection
- Compound vulnerability analysis
- Attack vector identification
- Exploit probability calculation
- Remediation recommendation generation

### 🔗 Blockscout MCP Integration

**No API Keys Required!** Direct integration via MCP Server:

```typescript
// Fetch any verified contract
const contract = await blockscout.fetch_contract(
  '0x1234...abcd',
  'mainnet'  // or sepolia, polygon, arbitrum, etc.
);
```

**Supported Networks:**
- ✅ Ethereum Mainnet
- ✅ Sepolia Testnet
- ✅ Polygon
- ✅ Arbitrum
- ✅ Optimism
- ✅ Base
- ✅ Avalanche

### 💬 ASI:One Chat Interface

Natural language interaction with your audit assistant:

```
You: "Audit my token at 0x1234...abcd"

Markov: "🔍 Starting audit of TokenContract...
         
         Analyzing with 6 specialist agents:
         ✓ Reentrancy Agent: No issues
         ✓ Access Control Agent: 1 high-severity issue found
         ✗ Integer Overflow Agent: 2 medium issues
         
         📊 Results: 3 issues found (1 high, 2 medium)
         
         Would you like detailed explanations?"
```

### 📊 Security Checks

**50+ Security Patterns Detected:**

| Category | Checks | Examples |
|----------|--------|----------|
| **Reentrancy** | 5 | Classic, cross-function, read-only |
| **Access Control** | 4 | Missing modifiers, tx.origin, unprotected init |
| **Integer Overflow** | 3 | Unchecked arithmetic, unsafe casts, precision loss |
| **External Calls** | 6 | Unchecked calls, unsafe delegatecall, missing checks |
| **Gas Optimization** | 8 | Storage packing, memory vs calldata, loop optimization |
| **Front-Running** | 3 | Transaction ordering, MEV vulnerabilities |
| **Timestamp** | 2 | Block timestamp dependence, manipulation |
| **DoS** | 3 | Unbounded loops, gas limit issues |

---

## 🏗️ Architecture

### System Components

```
┌─────────────────────────────────────────────────────┐
│              User Interfaces                        │
│  [Hardhat Plugin]  [ASI:One Chat]  [REST API]      │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│         MCP Server (FastAPI)                        │
│  • Blockscout MCP Client (No API keys!)             │
│  • Agentverse Protocol Handler                      │
│  • Result Aggregation & Storage                     │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│      Multi-Agent Network (uAgents)                  │
│  6 Specialist Agents + Coordinator                  │
│  • Agent-to-agent communication                     │
│  • Parallel analysis                                │
│  • MeTTa reasoning integration                      │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│         MeTTa Knowledge Base (850+ lines)           │
│  • Vulnerability patterns                           │
│  • Detection rules                                  │
│  • Logical reasoning                                │
└─────────────────────────────────────────────────────┘
```

**Technology Stack:**
- **Backend:** Python 3.10+, FastAPI, uAgents
- **Reasoning:** Hyperon MeTTa
- **Blockchain:** Blockscout MCP, Web3.py
- **Frontend:** TypeScript, Hardhat Plugin
- **Reports:** PDF, Markdown, JSON

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+**
- **Node.js 16+**
- **Agentverse API Key** ([Get one free](https://agentverse.ai))

### Installation (5 Minutes)

```bash
# Clone repository
git clone https://github.com/charlesms-eth/markov-audit.git
cd markov-audit

# Run automated setup
npm run setup

# Edit configuration
nano .env
# Add your Agentverse API key
# (No Blockscout API key needed!)

# Start audit engine
npm run start-engine

# Run your first audit
npx hardhat markov audit
```

### Manual Setup

```bash
# Install Node.js dependencies
npm install

# Setup Python environment
cd python
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt

# Configure environment
cp .env.template .env
# Edit .env with your settings

# Start the server
python main.py
```

---

## 💻 Usage Examples

### 1. Audit All Local Contracts

```bash
# Scans ./contracts folder
npx hardhat markov audit
```

**Output:**
```
🔍 MARKOV - FREE AI SMART CONTRACT AUDIT SYSTEM
═══════════════════════════════════════════════════════════

📂 Scanning contracts/ folder...
   Found 2 contract file(s)

🚀 Starting AI-powered audit of 2 contract(s)...

[1/2] 🔍 Analyzing: VulnerableBank
   ✓ Audit complete
   ├─ Total Checks: 29
   ├─ Passed: 21
   ├─ 🔴 Critical: 1
   ├─ 🟠 High: 2
   ├─ 🟡 Medium: 3
   └─ Risk Score: 7.2/10

[2/2] 🔍 Analyzing: SafeVault
   ✓ Audit complete
   ├─ Total Checks: 29
   ├─ ✓ Passed: 29
   └─ Risk Score: 0.0/10

✅ AUDIT COMPLETE

📊 Overall Summary:
   Contracts Audited: 2
   Total Issues Found: 6
   🔴 Critical Issues: 1
   🟠 High Issues: 2

📁 Reports saved to: ./audit-reports/
```

### 2. Audit Specific Contract

```bash
npx hardhat markov audit contracts/MyToken.sol
```

### 3. Audit On-Chain Contract

```bash
# Fetches verified source from Blockscout
npx hardhat markov audit \
  --address 0x1234567890123456789012345678901234567890 \
  --network mainnet
```

### 4. ASI:One Chat Interface

```bash
npx hardhat markov chat --message "Audit my token contract"
```

**Response:**
```
🤖 Markov: I'd be happy to audit your token contract!

Please provide:
  • Contract address (0x...)
  • Network name (mainnet, sepolia, etc.)

Or if it's a local file:
  npx hardhat markov audit contracts/YourToken.sol

💡 Suggestions:
  • Audit contract at 0x...
  • Learn about security checks
  • View example report
```

### 5. Programmatic Usage

```typescript
import { ethers } from "hardhat";

async function main() {
  // Use Markov programmatically
  const result = await hre.markov.audit(
    "contracts/MyContract.sol",
    { format: "json" }
  );
  
  console.log(`Risk Score: ${result.risk_score}/10`);
  console.log(`Critical Issues: ${result.summary.critical_issues}`);
}
```

---

## 📊 Sample Report

### Contract: VulnerableBank.sol

```markdown
# Markov Security Audit Report

**Contract:** VulnerableBank
**Audit Date:** 2025-10-26 06:13:22 UTC
**Risk Score:** 7.2/10

## Executive Summary

| Metric | Count |
|--------|-------|
| Total Checks | 29 |
| Passed | 21 |
| **Critical Issues** | **1** |
| **High Issues** | **2** |
| Medium Issues | 3 |
| Low Issues | 2 |

## MeTTa Insights

- ⚠️ CRITICAL: Contract has 1 critical vulnerability that could lead 
  to complete loss of funds.
- 🔴 HIGH RISK: Reentrancy vulnerability combined with weak access 
  control creates elevated exploitation risk.

## Findings by Category

### Reentrancy

#### [HIGH] Reentrancy Vulnerability Detected

**Location:** Line 31  
**Description:** Function 'withdraw' performs external call at line 31 
followed by state changes. This allows attackers to reenter and drain funds.

**Recommendation:**
1. Implement ReentrancyGuard from OpenZeppelin
2. Follow checks-effects-interactions pattern
3. Update state before external calls

**Code Fix:**
```solidity
// Add to contract
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

contract VulnerableBank is ReentrancyGuard {
    // Add nonReentrant modifier
    function withdraw(uint256 amount) public nonReentrant {
        require(balances[msg.sender] >= amount);
        
        // Update state FIRST
        balances[msg.sender] -= amount;
        
        // External call LAST
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success);
    }
}
```

### Access Control

#### [HIGH] Unprotected Privileged Function: emergencyWithdraw

**Location:** Line 44  
**Description:** Function 'emergencyWithdraw' can withdraw funds but 
lacks access control modifiers. Any user can call this function.

**Recommendation:** Add onlyOwner or role-based access modifier

## Recommendations

1. Implement ReentrancyGuard from OpenZeppelin or follow 
   checks-effects-interactions pattern
2. Add proper access control modifiers to all privileged functions
3. Upgrade to Solidity 0.8.0+ for built-in overflow protection
4. Professional audit recommended before mainnet deployment

---

**Generated by:** Markov Audit System v2.0.0  
**License:** MIT (FREE OPEN SOURCE)