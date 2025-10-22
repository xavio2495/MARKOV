## Copilot instructions for the MARKOV agent workspace

These notes are targeted at AI coding agents working in this repository. They capture the minimal, actionable knowledge you need to be immediately productive here.

- Quick orientation
  - This workspace contains two primary specification docs that drive implementation and workflows:
    - `AGENT.md` (root): Python uAgents-based AI agents for Solidity analysis, simulation (Hardhat), and MCP monitoring.
    - `hardhat-plugin/AGENT.md`: TypeScript/Hardhat plugin design (`markov` CLI) for Diamond (ERC-2535) versioning and viem-based contract ops.

- Big-picture architecture (what to assume)
  - Two complementary stacks coexist:
    1. Python uAgents agents: audit/gas-opt agent, Hardhat-backed simulation agent, and an MCP-based monitoring agent. Uses ASI:One for LLM calls and Blockscout MCP for on-chain tooling.
    2. Hardhat 3 plugin (TypeScript): a `markov` CLI that manages Diamond contracts (deploy, branch, merge, optimize) and integrates with viem via `hre.viem`.
  - Integration points: Python agents call Hardhat (via `npx hardhat` subprocesses) for simulations; both stacks call external services: ASI:One (LLM) and Blockscout MCP (HTTP /mcp tools). Agentverse/Fetch.ai uAgents may be used for registration/orchestration.

- Key developer workflows and commands (executable / reproducible)
  - Python agent setup: install dependencies and run agent locally.
    - pip install uagents openai requests
    - Run an agent: `python agent.py` (agents expect ASI/API keys in env/config and may register mailbox for external access).
  - Hardhat plugin / simulation flows:
    - Run Hardhat tasks and the plugin: `npx hardhat markov <subcommand>` (examples: `markov deploy`, `markov init`, `markov simulate`, `markov agent start`).
    - Use Hardhat anvil/forking for simulation tests; the Python simulation agent runs `npx hardhat` subprocesses to run scenarios.
  - Blockscout MCP server (local HTTP mode): `python -m blockscout_mcp_server --http` — agents POST to `/mcp` to call tools like `get_transaction_logs`, `transaction_summary`, etc.

- Project-specific conventions & patterns
  - uAgents (Python): follow example patterns from `AGENT.md` — use the chat protocol objects (ChatMessage/TextContent), call ASI:One via `client.chat.completions.create(model="asi1-mini", messages=...)`, use `@agent.on_interval` for periodic tasks, and `ctx.logger` for logging.
  - Hardhat plugin (TypeScript): use `hre.viem` for all chain interactions (`deployContract`, `simulateContract`, `getWalletClient`, `getPublicClient`). Extend `hardhat.config` with a `markov` section for chain, wallet, AI keys, and MCP endpoints.
  - History model: the plugin design expects a hybrid `.markov/history.json` persisted format — a branch→commits map and a hash map for O(1) lookups. Commits include fields: `hash`, `timestamp`, `author`, `message`, `diamondAddress`, `cut`.

- Important environment variables and secrets
  - ASI/API key for ASI:One (used by Python agents). Look for config or env keys in `AGENT.md` samples.
  - `BLOCKSCOUT_DISABLE_COMMUNITY_TELEMETRY=true` can be set to opt-out of Blockscout telemetry.
  - Hardhat `markov` config keys: `aiApiKey`, `mcpEndpoint`, `agentverseApiToken` (if used).

- Integration & testing notes
  - Simulation-first approach: prefer `--simulate`/`simulateContract` and Hardhat dry-runs before executing cuts or deploys. Tests should use anvil/forking.
  - For MCP usage, the agents begin interactions by calling the unlock/setup tool (see `AGENT.md` note about `__unlock_blockchain_analysis__()`), then call tools by POSTing to `/mcp`.

- Useful examples to copy from the repo
  - LLM call (Python): client.chat.completions.create(model="asi1-mini", messages=[{"role":"system","content":"Audit this Solidity..."}])
  - Periodic agent (Python): use `@agent.on_interval(period=60)` to poll MCP or run recurring sims/analysis.
  - Hardhat command example: `npx hardhat markov deploy --simulate` (plugin should support `--simulate` flags to dry-run a cut).

- Files to inspect first when editing code
  - `AGENT.md` (root) — primary source for Python agent behavior and examples.
  - `hardhat-plugin/AGENT.md` — plugin feature list, CLI, and data-model expectations.
  - Look for `packages/plugin`, `src/` or `src/*.ts` if you need to implement the plugin; look for `agent.py` or `src/*.py` for Python agents (these may not exist yet — AGENT.md is the current spec).

- Python agent deployment & Hardhat integration (practical)
  - Recommended model (production): run the Python agent as a long-running HTTP microservice on the server. This makes it easy for the Hardhat plugin to call the agent from CLI tasks and for the agent to push notifications (Discord).
    - Typical endpoints to implement in the agent service:
      - POST /asi/analyze  -> body { "source": "<solidity code>", "metadata": {...} } returns JSON report
      - POST /asi/track    -> body { "address":"0x...", "chainId":1, "options": {...} } returns status and periodic report ids
    - Recommended env vars:
      - AGENT_HOST (default 127.0.0.1)
      - AGENT_PORT (default 8000)
      - AGENT_API_KEY (simple shared secret for plugin->agent auth)
      - AGENT_DISCORD_WEBHOOK (optional default webhook)
    - Security: accept requests only from localhost or private network; require Authorization: Bearer <AGENT_API_KEY> header.

  - Alternative (ad-hoc / dev): spawn the agent as a subprocess from the Hardhat task. Useful for one-off runs or CI. Example CLI contract:
    - `python agent.py analyze --file facet7.sol --output json` (prints JSON to stdout)
    - Hardhat plugin may invoke this via Node's child_process.spawn and parse stdout.
    - Drawbacks: no persistent state for tracking, less suitable for event-driven pushes to Discord.

  - Hardhat CLI mapping (examples)
    - `pnpm hardhat markov asi analyse facet7.sol`
      - Plugin behavior (recommended): read `facet7.sol`, POST {source} to `http://AGENT_HOST:AGENT_PORT/asi/analyze` with Authorization header, then present or forward the JSON result.
    - `pnpm hardhat markov asi track 0x000... --discord wcc:/...`
      - Plugin behavior: POST {address, chainId, webhook} to `/asi/track`; the agent will subscribe/poll and POST summaries to the given Discord webhook.

  - Discord webhooks
    - Agent should accept a per-request webhook URL (preferred) or use AGENT_DISCORD_WEBHOOK env var as default.
    - When sending, POST JSON { "content": "<summary text>", ... } to the webhook URL using requests.post.

  - Quick local run (PowerShell) — example to start a simple agent server and test an analyze request:
```powershell
$env:AGENT_API_KEY = 'supersecret'
$env:AGENT_DISCORD_WEBHOOK = 'wcc:/your/webhook'
python -m agent_server --host 0.0.0.0 --port 8000
# then (from another shell) test
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/asi/analyze -Headers @{ Authorization = "Bearer $env:AGENT_API_KEY" } -Body (@{ source = "contract C { }" } | ConvertTo-Json)
```

If you want, I can add a minimal Python `agent_server` skeleton (Flask/FastAPI) and an example Hardhat task that POSTs to it, or implement subprocess-based invocation in the plugin. Which integration would you prefer me to implement next?

If any section is unclear, tell me which area you want expanded (environment setup, exact filenames to edit, or CI/test commands) and I will iterate.
