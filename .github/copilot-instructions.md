# Copilot Instructions for MARKOV (Monorepo)

This repo hosts two main parts: a Hardhat v3 plugin (TypeScript, pnpm workspaces) for Git-like ERC‑2535 Diamond versioning, and a Python audit engine (FastAPI + uAgents + MeTTa) for AI-powered security analysis.

## Architecture at a glance
- hardhat-plugin (pnpm monorepo)
  - packages/plugin: plugin code. Entry and task registry: `src/index.ts` (ESM, Node 22+).
  - Task dispatch: `npx hardhat markov <cmd>` → `src/tasks/markov/dispatcher.ts` → `markov:<cmd>` file in `src/tasks/markov/`.
  - Config: uppercase snake_case keys in `src/types.ts`, resolved/validated in `src/config.ts`, extended via `src/type-extensions.ts`.
  - Storage: file-based history under `.markov/` using per-branch files: `.markov/branches/<name>.json` (+ `.markov/config.json` for current branch). Schema in `src/storage/validators.ts`.
  - Deploys: Hardhat Ignition (viem planned); EIP-2535 facets and diamondCut handling live in `src/tasks/markov/deploy.ts`.
- agent (Python audit engine)
  - FastAPI server `agent/python/main.py`; multi-agent analysis via `agents/` and MeTTa rules in `python/metta/`.
  - Integrates Blockscout MCP (no API keys) in `python/utils/blockscout.py` and generates reports via `python/utils/report_generator.py`.

## Critical workflows (PowerShell)
- Install & build (root):
  - pnpm install; pnpm build; pnpm test
- Plugin dev loop:
  - Watch build: `pnpm -C hardhat-plugin/packages/plugin watch`
  - Try in example app: `cd hardhat-plugin/packages/example-project; pnpm hardhat markov help`
- Common plugin tasks:
  - `pnpm -C hardhat-plugin/packages/plugin lint` | `lint:fix` | `build` | `clean`
- Audit engine (Python):
  - `cd agent/python; py -3 -m venv .venv; .\.venv\Scripts\Activate.ps1; pip install -r requirements.txt; python main.py`
  - Health/docs: http://localhost:8000/health, /docs

## Conventions and patterns (TypeScript plugin)
- ESM only; include `.js` extensions in imports (see `src/index.ts`).
- Task declaration pattern:
  - In `src/index.ts`: `task("markov:<name>")...setAction(() => import("./tasks/markov/<name>.js"))`.
  - Subtask signature: `export default async function(taskArgs, hre)` in `src/tasks/markov/<name>.ts`.
- Dispatcher forwards flags/args (see `dispatcher.ts`) and prompts when needed (e.g., `stats`).
- Config sync: keep `.markov/config.json`, branch file `config`, and `hardhat.config.ts` mirrored when commands change config (see `tasks/markov/config.ts`).

## Integration boundaries and “don’ts”
- Use Hardhat v3 + viem patterns; don’t add ethers v5 or import from `EIP2535-Diamonds-Reference-Implementation/` (that’s Hardhat v2 CJS).
- Follow existing config keys in `src/types.ts` when adding fields; update validators in `src/config.ts` and `src/storage/validators.ts`.
- Many AI/MCP commands (optimize, analyze, propose, agent) are partially stubbed—match existing output formats and wire incrementally.

## Key references in repo
- Plugin registry: `hardhat-plugin/packages/plugin/src/index.ts`
- Dispatcher: `hardhat-plugin/packages/plugin/src/tasks/markov/dispatcher.ts`
- Types/config: `hardhat-plugin/packages/plugin/src/types.ts`, `src/config.ts`, `src/type-extensions.ts`
- Storage layer: `hardhat-plugin/packages/plugin/src/storage/{history-storage.ts,validators.ts}`
- Agent server: `agent/python/main.py` (endpoints: /health, /api/audit, /api/audit/fetch, /api/chat)
- More guidance: `hardhat-plugin/.github/copilot-instructions.md` (plugin-deep dive), `hardhat-plugin/AGENT.md` (aspirational scope)

Feedback requested: If any build/run steps differ on your machine (e.g., ports, Python version, Ignition usage, or viem integration status), or if additional non-obvious workflows exist, tell me and I’ll refine these instructions.
