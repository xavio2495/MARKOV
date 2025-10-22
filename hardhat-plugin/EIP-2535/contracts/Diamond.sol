// SPDX-License-Identifier: CC0-1.0
/**
 * Diamond.sol — Minimal EIP‑2535 Diamond contract.
 * - Sets initial owner and supported interfaces.
 * - Applies initial facet cut and optional initializer in the constructor.
 * - Routes unknown calls via fallback by selector -> facet delegatecall.
 * - Exposes receive(), supportsInterface (ERC‑165) and owner() helpers.
 */
pragma solidity ^0.8.0;

import { LibDiamond } from "./libraries/LibDiamond.sol";
import { IDiamondCut } from "./interfaces/IDiamondCut.sol";
import { IDiamondLoupe } from "./interfaces/IDiamondLoupe.sol";
import { IERC173 } from "./interfaces/IERC173.sol";
import { IERC165 } from "./interfaces/IERC165.sol";

/// @notice Minimal Diamond implementation (EIP-2535)
contract Diamond {
    error FunctionNotFound(bytes4 selector);

    struct DiamondArgs {
        address owner;
        address init;
        bytes initCalldata;
    }

    constructor(IDiamondCut.FacetCut[] memory _diamondCut, DiamondArgs memory _args) payable {
        LibDiamond.setContractOwner(_args.owner);
        LibDiamond.setSupportedInterfaces();
        LibDiamond.diamondCut(_diamondCut, _args.init, _args.initCalldata);
    }

    // Find facet for function that is called and execute the function if found
    fallback() external payable {
        LibDiamond.DiamondStorage storage ds;
        bytes32 position = LibDiamond.DIAMOND_STORAGE_POSITION;
        // get diamond storage
        assembly {
            ds.slot := position
        }
        // get facet from function selector
        address facet = ds.facetAddressAndSelectorPosition[msg.sig].facetAddress;
        if (facet == address(0)) revert FunctionNotFound(msg.sig);

        // Execute external function from facet using delegatecall and return any value
        assembly {
            // copy function selector and arguments
            calldatacopy(0, 0, calldatasize())
            // delegatecall into the facet
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            // copy return data
            returndatacopy(0, 0, returndatasize())
            switch result
                case 0 {
                    revert(0, returndatasize())
                }
                default {
                    return(0, returndatasize())
                }
        }
    }

    receive() external payable {}

    // ERC‑165 support forwarding via loupe facet mapping
    function supportsInterface(bytes4 interfaceId) external view returns (bool) {
        // Read directly from diamond storage's supportedInterfaces map
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        return ds.supportedInterfaces[interfaceId];
    }

    // Ownership view forwarded from storage (optional helper)
    function owner() external view returns (address) {
        return LibDiamond.contractOwner();
    }
}
