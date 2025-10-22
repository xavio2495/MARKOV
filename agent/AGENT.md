# AIM:
1. To develop an AI agent for smart contract analysis and gas optimization assisting Solidity developers. This agent receives Solidity code, uses AI (e.g., ASI:One Mini) to detect vulnerabilities (reentrancy, overflows, access control issues) and suggest gas optimizations (variable packing, loop unrolling, constant folding). It should handle user queries via natural language, provide detailed reports, and integrate with Hardhat for file input.
2. To develop an AI agent for smart contract simulation analysis, works together with Hardhat 3 network simulator. This agent simulates deployments/tx scenarios using Hardhat's anvil/forking, predicts gas usage/outcomes, and analyzes results with AI for edge cases, potential failures, or optimizations. It supports multi-chain forks and generates visual reports (e.g., gas charts).
3. To develop an autonomous AI agent that leverages Model Context Protocol (MCP) to connect to external blockchain data sources for real-time on-chain activity tracking and reporting of the Diamond contract (e.g., monitoring events, transactions, and generating summaries/reports). Using Blockscout MCP server for blockchain data access, Fetch.ai uAgents for agent orchestration, and Agentverse for MCP integration where applicable. The agent polls/watches events, summarizes anomalies (e.g., high gas txs), and sends alerts (CLI/Discord). It registers on Agentverse for discoverability by ASI:One.

# DETAILED INSTRUCTIONS:
- All agents are built in Python using Fetch.ai uAgents framework (primary language per docs; no native TS bindings found—integrate via API calls from TS plugin if needed). Setup: pip install uagents openai requests. Use ASI:One API (base_url='https://api.asi1.ai/v1', api_key from config) for LLM. Make agents ASI:One compatible with chat protocol (import from uagents_core.contrib.protocols.chat: ChatMessage, TextContent, etc.). Register on Agentverse (via mailbox=True, publish_agent_details=True) for discovery/chat via ASI:One. Deploy: Run locally or host on Agentverse; use mailbox for external access. Best practices: Use @agent.on_interval for periodic tasks (e.g., monitoring); handle errors with try/except; log with ctx.logger. For MCP: Use requests to Blockscout server (hosted: https://mcp.blockscout.com/mcp; local: run python -m blockscout_mcp_server --http for HTTP mode). Call tools by POST to /mcp with JSON {"tool": "tool_name", "args": {...}}; first call __unlock_blockchain_analysis__() for instructions. Tools: get_chains_list(), get_address_info(chain_id, address), transaction_summary(chain_id, hash), etc. (full list in docs). Multi-chain: Query Chainscout for Blockscout URLs. Telemetry: Opt-out with env BLOCKSCOUT_DISABLE_COMMUNITY_TELEMETRY=true.

- Agent 1 (Analysis/Gas Opt): Define Agent with subject="Solidity auditing/optimization". Handler: @protocol.on_message(ChatMessage) - Extract code from msg, prompt ASI:One (system: "Audit for vulns like reentrancy and suggest gas opts"), respond with ChatMessage. Example code: Use client.chat.completions.create(model="asi1-mini", messages=[{"role":"system", "content":"Audit this Solidity..."}]). Run: python agent.py; register via inspector for mailbox.

- Agent 2 (Simulation): Integrate with Hardhat (run subprocess.call('npx hardhat ...') for sims). Handler: Receive scenario, fork chain via Hardhat, simulate tx, analyze output with ASI:One prompt ("Predict failures in this sim"). Generate reports (e.g., print gas charts via matplotlib if installed). Periodic: @agent.on_interval(period=60) for ongoing sims.

- Agent 3 (MCP Monitoring): Autonomous: @agent.on_interval for polling MCP (requests.post('https://mcp.blockscout.com/mcp', json={"tool": "get_transaction_logs", "args": {"chain_id": "1", "hash": "tx_hash"}})). Monitor Diamond addr: Query events/tx, summarize with ASI:One ("Anomaly in this log?"). Alerts: Send to Discord webhook (requests.post(webhook_url, json={"content": "Alert: ..."})). Orchestrate with uAgents: Multi-agent if needed (one for query, one for analysis). Register on Agentverse; use ASI:One chat for queries. Start with __unlock_blockchain_analysis__ for MCP setup.

# EXAMPLE PROMPTS FOR AGENTS:
- For analysis: "Is there blacklisting in USDT on Arbitrum? Use inspect_contract_code and ASI:One to check."
- For simulation: "Simulate tx 0xf8a... on Redstone; predict gas and failures."
- For monitoring: "Latest logs from 0xFe89... before Nov 08 2024; check anomalies with get_transaction_logs."

# LINKS:
1. https://uagents.fetch.ai/docs/
2. https://uagents.fetch.ai/docs/examples/asi-1
3. https://github.com/fetchai/uAgent-Examples/tree/main/2-solutions
4. https://github.com/fetchai/uAgent-Examples/tree/main/3-applications
5. https://docs.asi1.ai/documentation/getting-started/overview
6. https://docs.agentverse.ai/documentation/getting-started/overview
7. https://github.com/blockscout/mcp-server (MCP server repo; install with git clone, uv pip install -e .; run python -m blockscout_mcp_server --http for integration)
8. https://www.blog.blockscout.com/how-to-set-up-mcp-ai-onchain-data-block-explorer/ (Setup guide; examples for DeFi/wallet/security queries)