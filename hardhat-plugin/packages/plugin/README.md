# `hardhat-markov`

Git-like versioning system for ERC-2535 Diamond contracts with AI-powered analysis and monitoring.

## Installation

To install this plugin, run the following command:

```bash
npm install --save-dev hardhat-markov
```

In your `hardhat.config.ts` file, import the plugin and add it to the `plugins` array:

```ts
import markov from "hardhat-markov";

export default {
  plugins: [markov],
  markov: {
    chain: "localhost",
    wallet: "0x...",
    author: "Your Name",
    gasPrice: "auto",
    aiApiKey: process.env.OPENAI_API_KEY,
    mcpEndpoint: "https://mcp.blockscout.com/mcp",
    autoSync: true,
  },
};
```

## Splash Screen

The Markov CLI displays a branded splash screen on first invocation:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ███╗   ███╗ █████╗ ██████╗ ██╗  ██╗ ██████╗ ██╗   ██╗                   │
│  ████╗ ████║██╔══██╗██╔══██╗██║ ██╔╝██╔═══██╗██║   ██║                   │
│  ██╔████╔██║███████║██████╔╝█████╔╝ ██║   ██║██║   ██║                   │
│  ██║╚██╔╝██║██╔══██║██╔══██╗██╔═██╗ ██║   ██║╚██╗ ██╔╝                   │
│  ██║ ╚═╝ ██║██║  ██║██║  ██║██║  ██╗╚██████╔╝ ╚████╔╝                    │
│  ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝   ╚═══╝                     │
│                                                                            │
│                    Version 1.0.0 | EIP-2535 Edition                        │
│                                                                            │
└────────────────────────────────────────────────────────────────────────────┘
```

To suppress the splash screen, set the `MARKOV_NO_SPLASH` environment variable.

## Usage

The Markov CLI provides Git-like commands for Diamond contract versioning:

```bash
# Initialize a new Diamond project
npx hardhat markov init

# Deploy a facet and record the change
npx hardhat markov deploy <facet-name>

# View version history
npx hardhat markov log

# Check current Diamond status
npx hardhat markov status

# Create a new branch
npx hardhat markov branch <branch-name>

# Merge branches
npx hardhat markov merge <source-branch>
```

For complete CLI documentation with all 17 commands, see [MARKOV-CLI.md](./MARKOV-CLI.md).

### Configuration

The plugin uses the `markov` field in your Hardhat config:

- `chain`: Target blockchain (default: "localhost")
- `wallet`: Deployment wallet address
- `author`: Commit author name (default: "Anonymous")
- `gasPrice`: Gas pricing strategy (default: "auto")
- `aiApiKey`: OpenAI API key for AI features
- `mcpEndpoint`: Model Context Protocol endpoint (default: "https://mcp.blockscout.com/mcp")
- `autoSync`: Auto-sync with on-chain events (default: true)
