/* global ethers */
/* eslint prefer-const: "off" */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

/**
 * createFacet.js — Generate a new facet contract from a template.
 * 
 * Usage:
 *   node scripts/createFacet.js
 *   or
 *   npx hardhat run scripts/createFacet.js
 * 
 * This interactive script will:
 * 1. Prompt for facet name and details
 * 2. Generate a .sol file with a complete facet template
 * 3. Generate a corresponding library for diamond storage (optional)
 * 4. Create the files in contracts/facets/ directory
 */

// ============================================
// Configuration
// ============================================
const FACETS_DIR = path.join(__dirname, '..', 'contracts', 'facets');
const LIBRARIES_DIR = path.join(__dirname, '..', 'contracts', 'libraries');

// Ensure directories exist
if (!fs.existsSync(FACETS_DIR)) {
  fs.mkdirSync(FACETS_DIR, { recursive: true });
}
if (!fs.existsSync(LIBRARIES_DIR)) {
  fs.mkdirSync(LIBRARIES_DIR, { recursive: true });
}

/**
 * Create readline interface for user input
 */
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

/**
 * Promisified question
 */
function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

/**
 * Generate facet contract template
 */
function generateFacetTemplate(config) {
  const {
    facetName,
    author,
    description,
    includeLibrary,
    libraryName,
    storageVars
  } = config;

  let template = `// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.0;

/**
 * ${facetName} — ${description}
 * @author ${author}
 */
`;

  // Add library import if needed
  if (includeLibrary) {
    template += `\nimport { ${libraryName} } from "../libraries/${libraryName}.sol";\n`;
  }

  template += `
contract ${facetName} {
`;

  // Add events
  template += `    // Events
    event ${facetName}Updated(address indexed updater, uint256 timestamp);
\n`;

  // Add errors
  template += `    // Errors
    error ${facetName}Unauthorized();
    error ${facetName}InvalidInput();
\n`;

  // Add example functions based on whether library is included
  if (includeLibrary) {
    template += `    // Example setter function
    function setData(bytes32 _data) external {
        ${libraryName}.DiamondStorage storage ds = ${libraryName}.diamondStorage();
        ds.data = _data;
        emit ${facetName}Updated(msg.sender, block.timestamp);
    }

    // Example getter function
    function getData() external view returns (bytes32) {
        return ${libraryName}.diamondStorage().data;
    }
`;
  } else {
    template += `    // Example function
    function execute() external {
        // Add your logic here
        emit ${facetName}Updated(msg.sender, block.timestamp);
    }

    // Example view function
    function getInfo() external pure returns (string memory) {
        return "${facetName} is ready";
    }
`;
  }

  template += `}
`;

  return template;
}

/**
 * Generate library template for diamond storage
 */
function generateLibraryTemplate(config) {
  const { libraryName, author, storageVars } = config;

  let template = `// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.0;

/**
 * ${libraryName} — Diamond storage library for ${libraryName.replace('Lib', '')} functionality
 * @author ${author}
 */

library ${libraryName} {
    // Storage position (unique hash to avoid collisions)
    bytes32 constant DIAMOND_STORAGE_POSITION = keccak256("diamond.storage.${libraryName}");

    struct DiamondStorage {
`;

  // Add storage variables
  if (storageVars && storageVars.length > 0) {
    storageVars.forEach(varDef => {
      template += `        ${varDef}\n`;
    });
  } else {
    template += `        address owner;\n`;
    template += `        bytes32 data;\n`;
    template += `        uint256 counter;\n`;
  }

  template += `    }

    /**
     * Get diamond storage
     */
    function diamondStorage() internal pure returns (DiamondStorage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }
}
`;

  return template;
}

/**
 * Validate facet name
 */
function validateFacetName(name) {
  // Must start with uppercase letter and contain only alphanumeric
  const regex = /^[A-Z][a-zA-Z0-9]*$/;
  if (!regex.test(name)) {
    return 'Facet name must start with uppercase letter and contain only alphanumeric characters';
  }
  if (!name.endsWith('Facet')) {
    return 'Facet name should end with "Facet" (e.g., MyCustomFacet)';
  }
  return null;
}

/**
 * Main function
 */
async function createFacet() {
  console.log('\n✨ Diamond Facet Generator\n');
  console.log('This wizard will help you create a new facet contract.\n');

  try {
    // Get facet name
    let facetName = '';
    let isValidName = false;
    while (!isValidName) {
      facetName = await question('Facet name (e.g., MyCustomFacet): ');
      const validationError = validateFacetName(facetName);
      if (validationError) {
        console.log(`❌ ${validationError}`);
      } else {
        // Check if file already exists
        const facetPath = path.join(FACETS_DIR, `${facetName}.sol`);
        if (fs.existsSync(facetPath)) {
          const overwrite = await question(`⚠️  ${facetName}.sol already exists. Overwrite? (y/n): `);
          if (overwrite.toLowerCase() === 'y') {
            isValidName = true;
          }
        } else {
          isValidName = true;
        }
      }
    }

    // Get author
    const author = await question('Author name (default: Anonymous): ') || 'Anonymous';

    // Get description
    const description = await question('Brief description (default: Custom Diamond Facet): ') || 'Custom Diamond Facet';

    // Ask if they want a storage library
    const wantLibrary = await question('Include diamond storage library? (y/n, default: y): ') || 'y';
    const includeLibrary = wantLibrary.toLowerCase() === 'y';

    let libraryName = '';
    let storageVars = [];

    if (includeLibrary) {
      // Generate library name from facet name
      libraryName = facetName.replace('Facet', '');
      libraryName = `Lib${libraryName}`;
      
      const customLibName = await question(`Library name (default: ${libraryName}): `);
      if (customLibName) {
        libraryName = customLibName;
      }

      // Ask for custom storage variables
      console.log('\nDefine storage variables (press Enter with empty line to finish):');
      console.log('Format: type name; (e.g., "uint256 counter;", "address owner;")');
      
      let addingVars = true;
      while (addingVars) {
        const varDef = await question('Variable: ');
        if (varDef.trim() === '') {
          addingVars = false;
        } else {
          // Add semicolon if missing
          const cleanVarDef = varDef.trim().endsWith(';') ? varDef.trim() : varDef.trim() + ';';
          storageVars.push(cleanVarDef);
        }
      }

      if (storageVars.length === 0) {
        console.log('Using default storage variables (owner, data, counter)');
      }
    }

    // Generate config object
    const config = {
      facetName,
      author,
      description,
      includeLibrary,
      libraryName,
      storageVars
    };

    console.log('\n📝 Generating files...\n');

    // Generate and write facet contract
    const facetContent = generateFacetTemplate(config);
    const facetPath = path.join(FACETS_DIR, `${facetName}.sol`);
    fs.writeFileSync(facetPath, facetContent);
    console.log(`✅ Created: ${path.relative(process.cwd(), facetPath)}`);

    // Generate and write library if needed
    if (includeLibrary) {
      const libraryContent = generateLibraryTemplate(config);
      const libraryPath = path.join(LIBRARIES_DIR, `${libraryName}.sol`);
      
      // Check if library already exists
      if (fs.existsSync(libraryPath)) {
        const overwriteLib = await question(`⚠️  ${libraryName}.sol already exists. Overwrite? (y/n): `);
        if (overwriteLib.toLowerCase() === 'y') {
          fs.writeFileSync(libraryPath, libraryContent);
          console.log(`✅ Created: ${path.relative(process.cwd(), libraryPath)}`);
        } else {
          console.log(`⏩ Skipped library creation`);
        }
      } else {
        fs.writeFileSync(libraryPath, libraryContent);
        console.log(`✅ Created: ${path.relative(process.cwd(), libraryPath)}`);
      }
    }

    console.log('\n🎉 Facet created successfully!\n');
    console.log('📋 Next steps:');
    console.log('  1. Review and customize the generated contract');
    console.log('  2. Compile: npx hardhat compile');
    console.log(`  3. Deploy: Edit scripts/deployFacet.js to set FACET_NAME="${facetName}"`);
    console.log('  4. Run: npx hardhat run scripts/deployFacet.js --network <network>');
    console.log('  5. Add to Diamond using diamondCut\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exitCode = 1;
  } finally {
    rl.close();
  }
}

// Run if called directly
if (require.main === module) {
  createFacet()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = { createFacet, generateFacetTemplate, generateLibraryTemplate };
