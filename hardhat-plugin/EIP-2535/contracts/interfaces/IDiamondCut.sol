// SPDX-License-Identifier: CC0-1.0
/**
 * IDiamondCut — EIP‑2535 upgrade interface:
 * - FacetCutAction: Add / Replace / Remove
 * - FacetCut struct to describe selector changes
 * - DiamondCut event emitted after a cut
 */
pragma solidity ^0.8.0;

/// @title EIP-2535 Diamond Standard, DiamondCut interface
interface IDiamondCut {
    /// @notice Facet cut actions: Add=0, Replace=1, Remove=2
    enum FacetCutAction { Add, Replace, Remove }

    /// @notice A facet cut: add/replace/remove selectors pointing to facetAddress
    struct FacetCut {
        address facetAddress;
        FacetCutAction action;
        bytes4[] functionSelectors;
    }

    /// @notice Emitted when diamondCut is performed
    event DiamondCut(FacetCut[] _diamondCut, address _init, bytes _calldata);
}
