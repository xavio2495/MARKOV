// SPDX-License-Identifier: CC0-1.0
/**
 * IDiamondLoupe — EIP‑2535 introspection ("loupe") interface:
 * - Query facets and their selectors
 * - Query facet addresses and the facet for a selector
 */
pragma solidity ^0.8.0;

/// @title EIP-2535 Diamond Loupe interface
/// @notice These functions allow inspection of a diamond's facets and selectors
interface IDiamondLoupe {
    struct Facet {
        address facetAddress;
        bytes4[] functionSelectors;
    }

    /// @notice Gets all facets and their selectors
    function facets() external view returns (Facet[] memory facets_);

    /// @notice Gets all the function selectors supported by a specific facet
    function facetFunctionSelectors(address _facet) external view returns (bytes4[] memory facetFunctionSelectors_);

    /// @notice Get all facet addresses used by a diamond
    function facetAddresses() external view returns (address[] memory facetAddresses_);

    /// @notice Gets the facet address that supports the given selector
    function facetAddress(bytes4 _functionSelector) external view returns (address facetAddress_);
}
