/* global ethers */
/* eslint prefer-const: "off" */

/**
 * deployFacet.js — Deploy a new facet contract to be added to a Diamond.
 * 
 * Usage:
 *   npx hardhat run scripts/deployFacet.js --network <network>
 * 
 * This script:
 * 1. Deploys the specified facet contract
 * 2. Outputs the deployed facet address
 * 3. Logs the function selectors for reference
 * 
 * After deployment, use the Diamond's diamondCut function to add this facet.
 * You can do this via:
 * - A script that calls diamondCut programmatically
 * - louper.dev (UI for diamond management)
 * - Direct contract interaction via Etherscan/Hardhat console
 * 
 * To deploy a different facet, modify the FACET_NAME constant below.
 */

// ============================================
// Configuration: Change this to deploy different facets
// ============================================
const FACET_NAME = 'FacetA'; // Replace with your facet contract name

async function deployFacet() {
  console.log(`\n📦 Deploying ${FACET_NAME}...`);
  
  // Get contract factory
  const Facet = await ethers.getContractFactory(FACET_NAME);
  
  // Deploy the facet
  const facet = await Facet.deploy();
  await facet.deployed();
  
  console.log(`✅ ${FACET_NAME} deployed to:`, facet.address);
  
  // Get function selectors for reference
  const functionSelectors = getSelectors(facet);
  console.log(`\n📋 Function selectors (${functionSelectors.length} functions):`);
  functionSelectors.forEach((selector, index) => {
    const fragment = facet.interface.fragments.find(f => 
      facet.interface.getSighash(f) === selector
    );
    const signature = fragment ? fragment.format('sighash') : 'unknown';
    console.log(`  ${index + 1}. ${selector} → ${signature}`);
  });
  
  console.log(`\n📝 Next steps:`);
  console.log(`  1. Verify the contract (optional but recommended):`);
  console.log(`     npx hardhat verify --network <network> ${facet.address}`);
  console.log(`  2. Add the facet to your Diamond using diamondCut:`);
  console.log(`     - Via louper.dev (recommended for UI)`);
  console.log(`     - Via script (see addFacetToDiamond.js example)`);
  console.log(`     - Via Hardhat console or Etherscan Write Contract\n`);
  
  return facet.address;
}

/**
 * Get all function selectors from a contract
 * @param {Contract} contract - Ethers contract instance
 * @returns {string[]} Array of function selectors (bytes4)
 */
function getSelectors(contract) {
  const signatures = Object.keys(contract.interface.functions);
  const selectors = signatures.reduce((acc, val) => {
    // Exclude some common functions that shouldn't be added to diamond
    if (val !== 'init(bytes)') {
      acc.push(contract.interface.getSighash(val));
    }
    return acc;
  }, []);
  return selectors;
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
  deployFacet()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

// Export for use in other scripts
module.exports = { deployFacet, getSelectors };
