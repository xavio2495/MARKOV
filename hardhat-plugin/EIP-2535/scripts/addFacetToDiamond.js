/* global ethers */
/* eslint prefer-const: "off" */

/**
 * addFacetToDiamond.js — Add a deployed facet to an existing Diamond.
 * 
 * Usage:
 *   npx hardhat run scripts/addFacetToDiamond.js --network <network>
 * 
 * This script demonstrates how to programmatically call diamondCut to add
 * a new facet to your Diamond contract.
 * 
 * Prerequisites:
 * 1. Diamond contract already deployed
 * 2. Facet contract already deployed
 * 3. You are the owner of the Diamond
 */

const { getSelectors } = require('./deployFacet');

// ============================================
// Configuration: Update these values
// ============================================
const DIAMOND_ADDRESS = '0x...'; // Your deployed Diamond address
const FACET_ADDRESS = '0x...';   // Your deployed facet address
const FACET_NAME = 'FacetA';     // Name of the facet contract

// FacetCutAction enum
const FacetCutAction = { Add: 0, Replace: 1, Remove: 2 };

async function addFacetToDiamond() {
  console.log(`\n💎 Adding ${FACET_NAME} to Diamond...`);
  
  // Validate configuration
  if (DIAMOND_ADDRESS === '0x...' || FACET_ADDRESS === '0x...') {
    throw new Error('Please update DIAMOND_ADDRESS and FACET_ADDRESS in the script');
  }
  
  // Get the Diamond contract
  const diamond = await ethers.getContractAt('IDiamondCut', DIAMOND_ADDRESS);
  
  // Get the facet contract to extract selectors
  const facet = await ethers.getContractAt(FACET_NAME, FACET_ADDRESS);
  const selectors = getSelectors(facet);
  
  console.log(`📋 Facet: ${FACET_ADDRESS}`);
  console.log(`📋 Selectors to add: ${selectors.length}`);
  selectors.forEach((selector, index) => {
    const fragment = facet.interface.fragments.find(f => 
      facet.interface.getSighash(f) === selector
    );
    const signature = fragment ? fragment.format('sighash') : 'unknown';
    console.log(`  ${index + 1}. ${selector} → ${signature}`);
  });
  
  // Prepare the diamondCut
  const cut = [{
    facetAddress: FACET_ADDRESS,
    action: FacetCutAction.Add,
    functionSelectors: selectors
  }];
  
  // Get signer
  const [signer] = await ethers.getSigners();
  console.log(`\n🔑 Executing diamondCut as:`, signer.address);
  
  // Execute diamondCut (no initializer in this example)
  const tx = await diamond.diamondCut(cut, ethers.constants.AddressZero, '0x');
  console.log(`⏳ Transaction hash: ${tx.hash}`);
  
  const receipt = await tx.wait();
  console.log(`✅ Facet added! Gas used: ${receipt.gasUsed.toString()}`);
  
  // Verify the facet was added by checking loupe
  try {
    const diamondLoupe = await ethers.getContractAt('IDiamondLoupe', DIAMOND_ADDRESS);
    const facets = await diamondLoupe.facets();
    console.log(`\n📊 Diamond now has ${facets.length} facet(s):`);
    facets.forEach((f, i) => {
      console.log(`  ${i + 1}. ${f.facetAddress} with ${f.functionSelectors.length} selectors`);
    });
  } catch (error) {
    console.log(`\n⚠️  Could not query loupe (facet may not be installed): ${error.message}`);
  }
  
  console.log(`\n🎉 Done! You can now call ${FACET_NAME} functions via the Diamond at ${DIAMOND_ADDRESS}\n`);
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
if (require.main === module) {
  addFacetToDiamond()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = { addFacetToDiamond };
