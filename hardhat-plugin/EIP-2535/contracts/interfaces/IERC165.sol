// SPDX-License-Identifier: CC0-1.0
/**
 * IERC165 — Standard interface detection used by Diamonds and facets.
 */
pragma solidity ^0.8.0;

/// @title ERC-165 Standard Interface Detection
interface IERC165 {
    /// @notice Query if a contract implements an interface
    /// @param interfaceId The interface identifier, as specified in ERC‑165
    /// @return true if the contract implements interfaceId
    function supportsInterface(bytes4 interfaceId) external view returns (bool);
}
