<p align="center">
  <img src="design/logo/logo-white.png" alt="MARKOV-logo-1" width="150"/>
  <br><br>
  <img src="design/logo/logo-large-white.png" alt="MARKOV-logo-2" width="350"/>
</p>

# ABOUT
MARKOV is a monorepo with two parts:
- A Hardhat v3 plugin (TypeScript, ESM) that brings Git-like versioning to ERC‑2535 Diamond contracts: branching, history, deploys, and visualization.
- A Python audit engine (FastAPI + uAgents + MeTTa) for AI-powered security analysis and reporting.

Core development lives in `hardhat-plugin/` (pnpm workspaces). The plugin uses a dispatcher pattern: `npx hardhat markov <command>` routes to `markov:<command>` tasks under `packages/plugin/src/tasks/markov/`.

Why Diamonds? ERC‑2535 lets you upgrade modular facets safely; MARKOV adds branchable history and repeatable deploys so teams can work like Git—create branches, propose/merge cuts, and track every diamondCut as a commit.

# FEATURES
- Hardhat plugin (core)
  - Git-like flows for Diamonds: `init`, `log`, `branch create|switch|list`, `merge`, `reset`, `deploy`, `sync`, `status`.
  - Per-branch file storage under `.markov/branches/<name>.json` (+ `.markov/config.json` for current branch).
  - Config keys use uppercase snake_case; validated and resolved in the plugin.
  - Visualization: `markov viz --format ascii|json` for structure/dep trees.
  - Analytics: `markov stats <address> --chain <network> --format table|json` (prompts if missing).
  - ESM-only with “.js” import extensions; Hardhat v3-first; viem integration planned; deployments use Ignition.
  - Command reference (short):
    - `markov init` — scaffold .markov, branches folder, and guard files.
    - `markov config [--list|--get KEY|--set KEY VALUE]` — manage config with tri-sync to `.markov/config.json`, branch file, and `hardhat.config.ts` mirror.
    - `markov branch --action <create|switch|list> --name <branch>` — multi-branch workflows.
    - `markov deploy --facets "A,B" [--message msg] [--simulate] [--action add|replace|remove] [--separateModules]` — compile (unless `--skipCompile`), deploy facets (Ignition), execute diamondCut, record commit.
    - `markov log [--branch name] [--limit N]` — show history per branch (most recent first).
    - `markov reset <hash> [--simulate]` — compute reverting cut to restore a prior state.
    - `markov sync` — reconcile local history with on‑chain DiamondCut events (planned).
    - `markov status` — basic health checks (loupe-style queries).
    - `markov viz [--format ascii|json]` — dependency tree / selectors.
    - `markov stats <address> [--chain net] [--format table|json]` — tx and selector stats.
- AI/audit (Python)
  - FastAPI server with 6 uAgents, MeTTa reasoning, Blockscout MCP (no API keys required).
  - Endpoints: `/health`, `/api/audit/fetch`, `/api/audit`, `/api/chat`.
  - Generates PDF/Markdown/JSON reports.

Note: Some AI/MCP plugin commands (`optimize`, `analyze`, `propose`, `agent`) are partially stubbed—match existing output formats and wire incrementally.

# PREREQUISITES
- Node.js 22+ and pnpm
- Git
- Hardhat 3 (the example project is included)
- Optional (for audit engine): Python 3.10+ and pip
 - OS: Windows supported (commands use PowerShell); macOS/Linux also work (adapt shells accordingly)

# INSTALLATION
From the repo root (Windows PowerShell):

```pwsh
pnpm install
pnpm build
pnpm test
```

Plugin-only build:

```pwsh
pnpm -C hardhat-plugin/packages/plugin build
```

Optional — audit engine setup:

```pwsh
cd agent/python
py -3 -m venv .venv
./.venv/Scripts/Activate.ps1
pip install -r requirements.txt
python main.py
# Visit: http://localhost:8000/health and /docs
```

# HOW TO USE
Develop the plugin and try it in the example project:

```pwsh
# 1) In one terminal: watch the plugin build
pnpm -C hardhat-plugin/packages/plugin watch

# 2) In another terminal: use the example project
cd hardhat-plugin/packages/example-project
pnpm hardhat markov help
```

Common commands (run inside the example project):

```pwsh
# Initialize .markov/ structure
pnpm hardhat markov init

# Configure values (uppercase snake_case keys)
pnpm hardhat markov config --list
pnpm hardhat markov config --set Author "Your Name"
pnpm hardhat markov config --set Wallet_Address 0xYourAddressHere

# Work with branches
pnpm hardhat markov branch create dev
pnpm hardhat markov branch list
pnpm hardhat markov branch switch dev

# View history
pnpm hardhat markov log --branch dev

# Deploy facets (comma-separated names)
pnpm hardhat markov deploy "FacetA,FacetB" --message "Add A and B" --simulate false

# Revert to a previous commit
pnpm hardhat markov reset <commitHash> --simulate

# Visualize and analyze
pnpm hardhat markov viz --format ascii
pnpm hardhat markov stats 0xYourDiamondAddress --chain sepolia --format json
```

Integration boundaries:
- Use Hardhat v3 patterns and viem; don’t import ethers v5 or copy from `EIP2535-Diamonds-Reference-Implementation/` (that’s a Hardhat v2 CJS sandbox).
- Keep ESM with explicit “.js” import extensions in TypeScript outputs.

Tips & notes:
- Dispatcher: `npx hardhat markov <cmd>` → `markov:<cmd>` subtask defined in `src/index.ts` and implemented in `src/tasks/markov/<cmd>.ts`.
- Config tri‑sync: updates `.markov/config.json`, active branch file (`.markov/branches/<name>.json`), and a mirror in `hardhat.config.ts`.
- Storage schema: branch files validated by `src/storage/validators.ts` (commit hashes are 16‑char hex; selectors are 4‑byte hex).
- Deploy flow: optional `--skipCompile`, simulate diamondCut, supports global `--action` and `--separateModules` for Ignition.
- Windows-first: commands are PowerShell-friendly; avoid bash‑isms in scripts.

# LINE OF CODE
- Key entry points and directories
  - Plugin registry: `hardhat-plugin/packages/plugin/src/index.ts`
  - Dispatcher: `hardhat-plugin/packages/plugin/src/tasks/markov/dispatcher.ts`
  - Types/config: `hardhat-plugin/packages/plugin/src/types.ts`, `src/config.ts`, `src/type-extensions.ts`
  - Storage: `hardhat-plugin/packages/plugin/src/storage/{history-storage.ts,validators.ts}` (per-branch JSON schema)
  - Example app: `hardhat-plugin/packages/example-project/`
  - Agent server: `agent/python/main.py` (FastAPI endpoints)

- Notable commands implemented under `src/tasks/markov/`: `config`, `init`, `clone`, `log`, `deploy`, `reset`, `status`, `sync`, `branch`, `merge`, `optimize` (stub), `analyze` (stub), `propose` (stub), `viz`, `migrate`, `stats`, `agent` (stub)
  - Helpful references:
    - Deploy flow & diamondCut: `packages/plugin/src/tasks/markov/deploy.ts`
    - Help UI template: `packages/plugin/src/tasks/markov/help.ts`
    - Splash/branding: `packages/plugin/src/utils/splash.ts`
    - Branch file schema: `packages/plugin/src/storage/validators.ts`
    - Commit hash util & storage factory: `packages/plugin/src/storage/history-storage.ts`

# DEVELOPERS
### [Antony Xavio Immanuel](https://github.com/xavio2495)
### [Charles M S](https://github.com/charlesms1246)

<p align="center">
  <img src="design/images/ETHOnline-25.png" alt="ethonline-logo" width="150"/>
</p>
