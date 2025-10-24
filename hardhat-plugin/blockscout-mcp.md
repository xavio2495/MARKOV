# Blockscout MCP Server - AI Agent Guide
**`https://mcp.blockscout.com`**
> This server provides blockchain data access via both MCP (Model Context Protocol) and REST API. Choose the interface that best fits your agent's capabilities and integration requirements.

## Quick Start for AI Agents

### MCP Interface (Recommended for Native MCP Clients)

**Best for:** Claude Desktop, Cursor, MCP Inspector, and other native MCP clients
**Benefits:** Context-aware, progress tracking, intelligent pagination, optimized for LLM token usage

**Configuration:**
- **Cloud instance/Code/Github Copilot** `https://mcp.blockscout.com/mcp`

**Key Tools:** `get_address_info`, `get_transactions_by_address`, `get_tokens_by_address`, `transaction_summary`

### REST API Interface

**Best for:** Custom integrations, code generation, batch processing, legacy systems
**Benefits:** Standard HTTP, easier debugging, universal compatibility, direct endpoint access

**Base URL:** `https://mcp.blockscout.com/v1/`
**Format:** All endpoints return structured JSON with `data`, `notes`, `instructions`, and `pagination` fields

**Tool Discovery:** For detailed tool descriptions and parameters, call `/v1/tools`
**Examples:**
```
GET /v1/tools
GET /v1/get_latest_block?chain_id=1
GET /v1/get_address_info?chain_id=1&address=0x...
GET /v1/get_transactions_by_address?chain_id=1&address=0x...&age_from=7d
```

## Available Tools

All tools are available via both MCP and REST API interfaces:

1. **`__unlock_blockchain_analysis__`** (MCP) / `/v1/unlock_blockchain_analysis` (REST) - Provides custom instructions for the MCP host. This is a mandatory first step.
2. **`get_chains_list`** - Returns a list of all known chains
3. **`get_address_by_ens_name`** - Converts an ENS name to its Ethereum address
4. **`lookup_token_by_symbol`** - Searches for tokens by symbol or name
5. **`get_contract_abi`** - Retrieves the ABI for a smart contract
6. **`inspect_contract_code`** - Inspects a verified contract's source code
7. **`get_address_info`** - Gets comprehensive information about an address
8. **`get_tokens_by_address`** - Returns ERC20 token holdings for an address
9. **`get_latest_block`** - Returns the latest indexed block number and timestamp
10. **`get_transactions_by_address`** - Gets transactions for an address with time range filtering
11. **`get_token_transfers_by_address`** - Returns ERC-20 token transfers for an address
12. **`transaction_summary`** - Provides human-readable transaction summaries
13. **`nft_tokens_by_address`** - Retrieves NFT tokens owned by an address
14. **`get_block_info`** - Returns detailed block information
15. **`get_transaction_info`** - Gets comprehensive transaction information
16. **`get_transaction_logs`** - Returns transaction logs with decoded event data
17. **`read_contract`** - Executes a read-only smart contract function
18. **`direct_api_call`** - Calls a curated raw Blockscout API endpoint

## When to Use Each Interface

### Use MCP Interface When:
- Working with native MCP clients (Claude, Cursor)
- Need intelligent context optimization for LLM conversations
- Want progress tracking for long-running operations
- Prefer guided pagination with automatic instructions
- Need session-based context management
- **Claude Desktop users:** Use DXT extension for easiest setup, or Docker proxy for custom configurations

### Use REST API When:
- Generating code for different programming languages
- Building web/mobile applications
- Integrating with API gateways or existing systems
- Need deterministic, stateless interactions
- Prefer direct HTTP endpoint access
- Building batch processing workflows
- Creating monitoring and analytics dashboards
- Integrating with third-party tools that expect REST endpoints

## Key Features for AI Agents

1. **Multi-chain Support:** 50+ EVM-compatible blockchains via dynamic URL resolution
2. **Context Optimization:** Intelligent response slicing and field truncation to conserve tokens
3. **Smart Pagination:** Opaque cursors prevent parameter confusion
4. **Progress Tracking:** Real-time updates for long-running blockchain queries
5. **Structured Responses:** Consistent JSON format with data, metadata, and guidance
6. **Truncation Handling:** Clear indicators when data is truncated with access instructions

## Common Use Cases

### For Code Generation:
- Generate Python/JavaScript/Go clients for blockchain data access
- Create wrapper functions for specific blockchain analysis tasks
- Build integration libraries for existing applications

### For Direct Analysis:
- Analyze wallet activities and transaction patterns
- Track token transfers and DeFi interactions
- Monitor smart contract events and logs
- Calculate gas usage and fee analysis

### For Application Integration:
- Build blockchain explorers and analytics dashboards
- Create portfolio tracking applications
- Develop DeFi protocol monitoring tools
- Implement compliance and AML screening systems

## Best Practices for AI Agents

1. **Start with Instructions:** Always call `__unlock_blockchain_analysis__` first in MCP sessions
2. **Use Pagination:** Continue fetching pages for comprehensive analysis
3. **Handle Truncation:** Check for `*_truncated` flags and fetch full data when needed
4. **Chain Selection:** Use `get_chains_list` to understand available networks
5. **Rate Limiting:** Implement exponential backoff for API calls
6. **Error Handling:** Parse structured error responses for better debugging

## Documentation Links

- **Full API Reference:** https://github.com/blockscout/mcp-server/blob/main/API.md
- **Technical Architecture:** https://github.com/blockscout/mcp-server/blob/main/SPEC.md
- **Setup Instructions:** https://github.com/blockscout/mcp-server/blob/main/README.md

## Support

For issues or questions, visit: https://github.com/blockscout/mcp-server/issues