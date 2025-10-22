// SPDX-License-Identifier: CC0-1.0
/**
 * LibDiamond — Core storage and logic for a Diamond:
 * - DiamondStorage layout, selector -> facet mapping, facet address registry.
 * - Ownership management and ERC‑165 support flags.
 * - diamondCut implementation (Add/Replace/Remove) and initializer delegatecall.
 * - Utility errors and helpers (enforceIsContractOwner, etc.).
 * DIAMOND_STORAGE_POSITION constant anchors storage slot for safe delegatecalls.
 */
pragma solidity ^0.8.0;

import { IDiamondCut } from "../interfaces/IDiamondCut.sol";
import { IERC165 } from "../interfaces/IERC165.sol";
import { IERC173 } from "../interfaces/IERC173.sol";
import { IDiamondLoupe } from "../interfaces/IDiamondLoupe.sol";

/// @notice Library that holds Diamond storage and the core diamondCut logic
library LibDiamond {
    bytes32 internal constant DIAMOND_STORAGE_POSITION = keccak256("diamond.standard.diamond.storage");

    error InitializationFunctionReverted(address _init, bytes _calldata);
    error InvalidFacetAddress(address facet);
    error NoSelectorsProvidedForFacet(address facet);
    error CannotReplaceWithSameFunction(address facet, bytes4 selector);
    error FunctionAlreadyExists(bytes4 selector);
    error FunctionDoesNotExist(bytes4 selector);
    error NotContractOwner(address caller);

    struct FacetAddressAndSelectorPosition {
        address facetAddress;
        uint16 selectorPosition; // position in selectors array
    }

    struct FacetFunctionSelectors {
        bytes4[] selectors; // function selectors for this facet
        uint16 facetAddressPosition; // position of facetAddress in facetAddresses array
    }

    struct DiamondStorage {
        // selector => (facet address, selector position)
        mapping(bytes4 => FacetAddressAndSelectorPosition) facetAddressAndSelectorPosition;
        // facet address => selectors + facet index
        mapping(address => FacetFunctionSelectors) facetFunctionSelectors;
        // list of facet addresses
        address[] facetAddresses;
        // ERC-165 support
        mapping(bytes4 => bool) supportedInterfaces;
        // ownership
        address contractOwner;
    }

    function diamondStorage() internal pure returns (DiamondStorage storage ds) {
        bytes32 position = DIAMOND_STORAGE_POSITION;
        assembly {
            ds.slot := position
        }
    }

    // Ownership
    function setContractOwner(address _newOwner) internal {
        DiamondStorage storage ds = diamondStorage();
        address previousOwner = ds.contractOwner;
        ds.contractOwner = _newOwner;
        emit IERC173.OwnershipTransferred(previousOwner, _newOwner);
    }

    function contractOwner() internal view returns (address) {
        return diamondStorage().contractOwner;
    }

    function enforceIsContractOwner() internal view {
        if (msg.sender != diamondStorage().contractOwner) {
            revert NotContractOwner(msg.sender);
        }
    }

    // Diamond cut
    function diamondCut(
        IDiamondCut.FacetCut[] memory _diamondCut,
        address _init,
        bytes memory _calldata
    ) internal {
        for (uint256 facetIndex = 0; facetIndex < _diamondCut.length; facetIndex++) {
            IDiamondCut.FacetCutAction action = _diamondCut[facetIndex].action;
            if (action == IDiamondCut.FacetCutAction.Add) {
                addFunctions(_diamondCut[facetIndex].facetAddress, _diamondCut[facetIndex].functionSelectors);
            } else if (action == IDiamondCut.FacetCutAction.Replace) {
                replaceFunctions(_diamondCut[facetIndex].facetAddress, _diamondCut[facetIndex].functionSelectors);
            } else if (action == IDiamondCut.FacetCutAction.Remove) {
                removeFunctions(_diamondCut[facetIndex].facetAddress, _diamondCut[facetIndex].functionSelectors);
            }
        }
        emit IDiamondCut.DiamondCut(_diamondCut, _init, _calldata);
        initializeDiamondCut(_init, _calldata);
    }

    function addFunctions(address _facetAddress, bytes4[] memory _selectors) private {
        if (_selectors.length == 0) revert NoSelectorsProvidedForFacet(_facetAddress);
        if (_facetAddress == address(0)) revert InvalidFacetAddress(_facetAddress);

        DiamondStorage storage ds = diamondStorage();

        uint16 selectorPosition = uint16(ds.facetFunctionSelectors[_facetAddress].selectors.length);
        // if new facet, add to facetAddresses array
        if (selectorPosition == 0) {
            addFacet(ds, _facetAddress);
        }

        for (uint256 i = 0; i < _selectors.length; i++) {
            bytes4 selector = _selectors[i];
            address oldFacetAddress = ds.facetAddressAndSelectorPosition[selector].facetAddress;
            if (oldFacetAddress != address(0)) revert FunctionAlreadyExists(selector);

            ds.facetFunctionSelectors[_facetAddress].selectors.push(selector);
            ds.facetAddressAndSelectorPosition[selector] = FacetAddressAndSelectorPosition({
                facetAddress: _facetAddress,
                selectorPosition: selectorPosition
            });
            selectorPosition++;
        }
    }

    function replaceFunctions(address _facetAddress, bytes4[] memory _selectors) private {
        if (_selectors.length == 0) revert NoSelectorsProvidedForFacet(_facetAddress);
        if (_facetAddress == address(0)) revert InvalidFacetAddress(_facetAddress);

        DiamondStorage storage ds = diamondStorage();

        uint16 selectorPosition = uint16(ds.facetFunctionSelectors[_facetAddress].selectors.length);
        if (selectorPosition == 0) {
            addFacet(ds, _facetAddress);
        }

        for (uint256 i = 0; i < _selectors.length; i++) {
            bytes4 selector = _selectors[i];
            address oldFacetAddress = ds.facetAddressAndSelectorPosition[selector].facetAddress;
            if (oldFacetAddress == _facetAddress) revert CannotReplaceWithSameFunction(_facetAddress, selector);
            if (oldFacetAddress == address(0)) revert FunctionDoesNotExist(selector);

            // remove selector from old facet
            removeSelector(ds, oldFacetAddress, selector);

            // add to new facet
            ds.facetFunctionSelectors[_facetAddress].selectors.push(selector);
            ds.facetAddressAndSelectorPosition[selector] = FacetAddressAndSelectorPosition({
                facetAddress: _facetAddress,
                selectorPosition: selectorPosition
            });
            selectorPosition++;
        }
    }

    function removeFunctions(address _facetAddress, bytes4[] memory _selectors) private {
        if (_selectors.length == 0) revert NoSelectorsProvidedForFacet(_facetAddress);
        if (_facetAddress != address(0)) revert InvalidFacetAddress(_facetAddress); // must be zero address for remove

        DiamondStorage storage ds = diamondStorage();

        for (uint256 i = 0; i < _selectors.length; i++) {
            bytes4 selector = _selectors[i];
            address oldFacetAddress = ds.facetAddressAndSelectorPosition[selector].facetAddress;
            if (oldFacetAddress == address(0)) revert FunctionDoesNotExist(selector);
            removeSelector(ds, oldFacetAddress, selector);
            delete ds.facetAddressAndSelectorPosition[selector];
        }
    }

    function addFacet(DiamondStorage storage ds, address _facetAddress) private {
        ds.facetFunctionSelectors[_facetAddress].facetAddressPosition = uint16(ds.facetAddresses.length);
        ds.facetAddresses.push(_facetAddress);
    }

    function removeSelector(
        DiamondStorage storage ds,
        address _facetAddress,
        bytes4 _selector
    ) private {
        FacetFunctionSelectors storage ffs = ds.facetFunctionSelectors[_facetAddress];
        uint256 selectorIndex = ffs.facetAddressPosition; // temp reuse var
        // find selector position
        selectorIndex = ds.facetAddressAndSelectorPosition[_selector].selectorPosition;
        uint256 lastSelectorIndex = ffs.selectors.length - 1;
        if (selectorIndex != lastSelectorIndex) {
            bytes4 lastSelector = ffs.selectors[lastSelectorIndex];
            ffs.selectors[selectorIndex] = lastSelector;
            ds.facetAddressAndSelectorPosition[lastSelector].selectorPosition = uint16(selectorIndex);
        }
        ffs.selectors.pop();

        // if no more selectors for facet, remove facet address
        if (ffs.selectors.length == 0) {
            uint16 lastFacetIndex = uint16(ds.facetAddresses.length - 1);
            uint16 facetIndex = ffs.facetAddressPosition;
            if (facetIndex != lastFacetIndex) {
                address lastFacet = ds.facetAddresses[lastFacetIndex];
                ds.facetAddresses[facetIndex] = lastFacet;
                ds.facetFunctionSelectors[lastFacet].facetAddressPosition = facetIndex;
            }
            ds.facetAddresses.pop();
            delete ds.facetFunctionSelectors[_facetAddress].facetAddressPosition;
        }
    }

    function initializeDiamondCut(address _init, bytes memory _calldata) private {
        if (_init == address(0)) {
            if (_calldata.length > 0) revert InitializationFunctionReverted(_init, _calldata);
            return;
        }
        if (_calldata.length == 0) revert InitializationFunctionReverted(_init, _calldata);
        (bool success, bytes memory error) = _init.delegatecall(_calldata);
        if (!success) revert InitializationFunctionReverted(_init, error);
    }

    // ERC-165
    function setSupportedInterfaces() internal {
        DiamondStorage storage ds = diamondStorage();
        ds.supportedInterfaces[type(IERC165).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondCut).interfaceId] = true;
        ds.supportedInterfaces[type(IDiamondLoupe).interfaceId] = true;
        ds.supportedInterfaces[type(IERC173).interfaceId] = true;
    }
}
