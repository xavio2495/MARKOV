# EIP-2535 Diamond Contracts

Minimal Diamond (EIP-2535) implementation with deployment scripts.

## Structure

```
contracts/
  Diamond.sol              # Main diamond proxy contract
  interfaces/              # Standard EIP-2535 interfaces
    IDiamondCut.sol       # Upgrade interface
    IDiamondLoupe.sol     # Introspection interface
    IERC165.sol           # Interface detection
    IERC173.sol           # Ownership
  libraries/
    LibDiamond.sol        # Core diamond storage and logic

scripts/
  createFacet.js          # Generate a new facet contract file
  deployFacet.js          # Deploy a new facet
  addFacetToDiamond.js    # Add deployed facet to Diamond
```

## Quick Start

### 1. Create a New Facet (Optional)

Generate a new facet contract from a template:

```bash
node scripts/createFacet.js
```

The interactive wizard will prompt you for:
- Facet name (e.g., `MyCustomFacet`)
- Author name
- Description
- Whether to include a diamond storage library
- Storage variables (if using library)

This creates:
- `contracts/facets/YourFacet.sol` - The facet contract
- `contracts/libraries/LibYourFacet.sol` - Storage library (if requested)

### 2. Deploy a Facet

Deploy any facet contract (e.g., `FacetA`, `DiamondCutFacet`, etc.):

```bash
# Edit deployFacet.js and set FACET_NAME
npx hardhat run scripts/deployFacet.js --network <network>
```

The script will output:
- Deployed facet address
- Function selectors for the facet
- Next steps for adding to Diamond

### 3. Add Facet to Diamond

You have three options to add the facet to your Diamond:

#### Option A: Via louper.dev (Recommended UI)

1. Go to [louper.dev](https://louper.dev/)
2. Enter your Diamond address and network
3. Click **Edit** tab → **Connect Wallet** → **Add Facet**
4. Enter your deployed facet address
5. Click **Fetch Facet ABI** (contract must be verified on Etherscan)
6. Select functions and click **Upgrade Diamond**

#### Option B: Via Script (Programmatic)

```bash
# Edit addFacetToDiamond.js with your addresses
npx hardhat run scripts/addFacetToDiamond.js --network <network>
```

#### Option C: Via Hardhat Console

```javascript
const diamond = await ethers.getContractAt('IDiamondCut', '<DIAMOND_ADDRESS>');
const cut = [{
  facetAddress: '<FACET_ADDRESS>',
  action: 0, // Add
  functionSelectors: ['0x...', '0x...'] // function selectors
}];
await diamond.diamondCut(cut, ethers.constants.AddressZero, '0x');
```

### 4. Verify on Etherscan (Optional but Recommended)

```bash
npx hardhat verify --network <network> <DEPLOYED_ADDRESS>
```

Verification is required if you want to use louper.dev's "Fetch Facet ABI" feature.

## Deployment Flow

1. **Create facet** (optional) using `createFacet.js` interactive wizard
2. **Deploy Diamond** (with initial facets like DiamondCutFacet, DiamondLoupeFacet)
3. **Deploy new facet** using `deployFacet.js`
4. **Verify facet** on Etherscan (optional)
5. **Add facet to Diamond** using `diamondCut` (via script, louper.dev, or console)
6. **Test facet functions** by calling them via the Diamond address

## Key Concepts

- **Diamond**: Single contract address that routes calls to facets via `delegatecall`
- **Facet**: Modular contract containing logic functions
- **diamondCut**: Function to add/replace/remove facet selectors
- **Loupe**: Introspection functions to query Diamond's facets and selectors

## Resources

- [EIP-2535 Specification](https://eips.ethereum.org/EIPS/eip-2535)
- [louper.dev](https://louper.dev/) - Diamond inspection tool
- [QuickNode Guide Part 1](https://www.quicknode.com/guides/ethereum-development/smart-contracts/the-diamond-standard-eip-2535-explained-part-1)
- [QuickNode Guide Part 2](https://www.quicknode.com/guides/ethereum-development/smart-contracts/the-diamond-standard-eip-2535-explained-part-2)

## License

CC0-1.0
